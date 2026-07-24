// Auth proxy — adds IP rate limiting and attempt logging in front of Supabase GoTrue.
// The frontend calls these endpoints instead of supabase.auth.* directly.

import { createHash }     from 'crypto';
import { createClient }   from '@supabase/supabase-js';
import { Sentry }         from './_lib/sentry-server.js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis }     from '@upstash/redis';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { setCorsHeaders } from './_lib/cors.js';
import { sendTelegramAlert, sendTelegramAlertOnce, escapeTgHtml } from './_lib/telegram.js';
import { generateTraceId, traceLog } from './_lib/trace.js';
import { validate, AuthLoginSchema, AuthSignupSchema, AuthForgotSchema } from './_lib/validate.js';

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

// SUPABASE_ANON_KEY must be set in Vercel env vars (same value as VITE_SUPABASE_ANON_KEY).
const SUPABASE_URL  = process.env.SUPABASE_URL;
const SUPABASE_ANON = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY;
const APP_URL       = process.env.APP_URL || 'https://www.fypro.com.ng';

// Anon client — used for signUp so email confirmation is not bypassed.
// Never use supabaseAdmin for signUp: service-role key auto-confirms users.
const supabaseAnon = createClient(SUPABASE_URL, SUPABASE_ANON, {
  auth: { persistSession: false, autoRefreshToken: false },
});

function getIp(req) {
  return String(
    req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
  ).split(',')[0].trim();
}

function makeIpLimiter(requests, window, prefix) {
  return new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(requests, window),
    prefix: `rl:ip:auth:${prefix}`,
  });
}

async function logAttempt(email, ip, action, success) {
  supabaseAdmin
    .from('auth_attempts')
    .insert({ email, ip, action, success })
    .then(({ error }) => { if (error) console.error('[auth] log failed:', error.message) })
    .catch(e => console.error('[auth] log failed:', e.message));
}

// ── action: login ─────────────────────────────────────────────────────────────

async function handleLogin(req, res) {
  const traceId = generateTraceId();
  res.setHeader('X-Trace-Id', traceId);

  const v = validate(AuthLoginSchema, req.body || {});
  if (!v.ok) return res.status(400).json({ error: v.error });

  const { email, password } = req.body;
  const ip = getIp(req);
  // Hash email so plaintext never lands in Redis keys
  const emailHash = createHash('sha256').update(email.toLowerCase()).digest('hex').slice(0, 16);

  let rlIp, rlEmail;
  try {
    [rlIp, rlEmail] = await Promise.all([
      makeIpLimiter(10, '15 m', 'login').limit(ip),
      new Ratelimit({ redis, limiter: Ratelimit.slidingWindow(20, '1 h'), prefix: 'rl:email:login' }).limit(emailHash),
    ]);
  } catch (rlErr) {
    traceLog(traceId, 'error', '[auth/login] rate limiter threw (failing open):', rlErr.message);
    rlIp = rlEmail = { success: true };
  }
  if (!rlIp.success) {
    const today = new Date().toISOString().slice(0, 10);
    sendTelegramAlertOnce(`⚠️ Brute-force detected: 10+ login attempts from IP ${ip}`, `tg:auth:bruteforce:${ip}:${today}`).catch(() => null);
    return res.status(429).json({
      error: 'Too many login attempts from your location. Please wait 15 minutes and try again.',
    });
  }
  if (!rlEmail.success) {
    const today = new Date().toISOString().slice(0, 10);
    sendTelegramAlertOnce(`⚠️ Account targeted: 20+ login attempts on ${email}`, `tg:auth:acct:${emailHash}:${today}`).catch(() => null);
    return res.status(429).json({
      error: 'Too many login attempts on this account. Please wait 1 hour or use forgot password.',
    });
  }

  let response, data;
  try {
    response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
      body:    JSON.stringify({ email, password }),
    });
    data = await response.json();
  } catch (fetchErr) {
    traceLog(traceId, 'error', '[auth/login] GoTrue fetch failed:', fetchErr.message);
    return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
  }
  const success = response.ok && !!data.access_token;

  logAttempt(email, ip, 'login', success);

  if (!success) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }

  // The Telegram alert is awaited — every other alert send in this codebase
  // (payments.js, notify.js, including the sibling oauth_login branch) does
  // the same, because an un-awaited fetch here can get cut off when Vercel
  // freezes the function right after res.json() below. sendTelegramAlert
  // itself never throws and has its own 8s timeout, so this can't hang or
  // fail the login. The send-nurture-email call stays fire-and-forget,
  // matching the accepted latency of the existing signup welcome email.
  try {
    await sendTelegramAlert(`🔓 Login: ${escapeTgHtml(email)} (IP: ${escapeTgHtml(ip)})`);
    if (process.env.CRON_SECRET) {
      fetch(`${APP_URL}/api/send-nurture-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
        body:    JSON.stringify({
          userId:    data.user?.id,
          emailType: 'login_alert',
          email,
          name:      data.user?.user_metadata?.full_name || '',
          ip,
          userAgent: req.headers['user-agent'] || '',
          loginAt:   new Date().toISOString(),
        }),
      }).catch(e => traceLog(traceId, 'error', '[auth/login] login alert email failed:', e.message));
    }
  } catch (e) {
    traceLog(traceId, 'error', '[auth/login] notification block failed:', e.message);
  }

  return res.status(200).json({
    access_token:  data.access_token,
    refresh_token: data.refresh_token,
    expires_in:    data.expires_in,
    token_type:    data.token_type,
  });
}

// ── action: signup ────────────────────────────────────────────────────────────

async function handleSignup(req, res) {
  const traceId = generateTraceId();
  res.setHeader('X-Trace-Id', traceId);

  const v = validate(AuthSignupSchema, req.body || {});
  if (!v.ok) return res.status(400).json({ error: v.error });

  const ip = getIp(req);
  let rl;
  try {
    rl = await makeIpLimiter(5, '1 h', 'signup').limit(ip);
  } catch (rlErr) {
    traceLog(traceId, 'error', '[auth/signup] rate limiter threw (failing open):', rlErr.message);
    rl = { success: true };
  }
  if (!rl.success) {
    return res.status(429).json({
      error: 'Too many signup attempts from your location. Please try again later.',
    });
  }

  const { email, password, full_name, university } = req.body;

  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${APP_URL}/auth/confirm`,
      data: { full_name, university },
    },
  });

  const userId  = data?.user?.id;
  // Supabase returns the existing user (no error) when the email is already registered,
  // but sets identities to [] to signal it. Treat that as "not a new signup."
  const isNewUser = !error && !!userId &&
    Array.isArray(data?.user?.identities) && data.user.identities.length > 0;

  logAttempt(email, ip, 'signup', !!userId);

  if (isNewUser) {
    await Promise.all([
      sendTelegramAlert(`👤 New signup: ${email} (free)`),
      (async () => {
        try {
          const { count } = await supabaseAdmin
            .from('notifications')
            .select('id', { count: 'exact', head: true })
            .eq('user_id', userId)
            .eq('type', 'welcome');
          if (count === 0) {
            await supabaseAdmin.from('notifications').insert({
              user_id: userId,
              type:    'welcome',
              title:   'Welcome to FYPro',
              message: "Your research journey starts here. Let's go.",
            });
          }
        } catch (e) {
          traceLog(traceId, 'error', '[auth/signup] welcome notification failed:', e.message);
        }
      })(),
    ]);
    if (process.env.CRON_SECRET) {
      fetch(`${APP_URL}/api/send-nurture-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
        body:    JSON.stringify({ userId, emailType: 'welcome', email, name: full_name || '' }),
      }).catch(e => traceLog(traceId, 'error', '[auth/signup] welcome email failed:', e.message));
    }
  }

  if (error) {
    const msg = error.message || 'Sign up failed. Please try again.';
    return res.status(400).json({ error: msg });
  }

  if (isNewUser && userId && full_name) {
    supabaseAdmin
      .from('users')
      .update({ full_name, university_name: university })
      .eq('id', userId)
      .then(({ error }) => { if (error) traceLog(traceId, 'error', '[auth/signup] users update:', error.message) })
      .catch(e => traceLog(traceId, 'error', '[auth/signup] users update:', e.message));
  }

  return res.status(200).json({ ok: true });
}

// ── action: forgot-password ───────────────────────────────────────────────────

async function handleForgotPassword(req, res) {
  const traceId = generateTraceId();
  res.setHeader('X-Trace-Id', traceId);

  const v = validate(AuthForgotSchema, req.body || {});
  if (!v.ok) return res.status(400).json({ error: v.error });

  const ip = getIp(req);
  let rl;
  try {
    rl = await makeIpLimiter(5, '1 h', 'forgot').limit(ip);
  } catch (rlErr) {
    traceLog(traceId, 'error', '[auth/forgot] rate limiter threw (failing open):', rlErr.message);
    rl = { success: true };
  }
  if (!rl.success) {
    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
    });
  }

  const { email } = req.body;

  fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
    body:    JSON.stringify({ email, redirect_to: `${APP_URL}/auth/confirm` }),
  }).catch(e => traceLog(traceId, 'error', '[auth/forgot] recover error:', e.message));

  logAttempt(email, ip, 'forgot_password', true);

  return res.status(200).json({ ok: true });
}

// ── Router ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  try {
    setCorsHeaders(req, res);

    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

    const action = req.query.action;

    if (action === 'login')            return handleLogin(req, res);
    if (action === 'signup')           return handleSignup(req, res);
    if (action === 'forgot-password')  return handleForgotPassword(req, res);

    return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[api/auth] unhandled error:', err);
    if (!res.headersSent) return res.status(500).json({ error: 'Internal server error' });
  }
}
