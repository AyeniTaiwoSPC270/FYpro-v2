// Auth proxy — adds IP rate limiting and attempt logging in front of Supabase GoTrue.
// The frontend calls these endpoints instead of supabase.auth.* directly.

import { createClient }   from '@supabase/supabase-js';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis }     from '@upstash/redis';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { setCorsHeaders } from './_lib/cors.js';
import { sendTelegramAlert } from './_lib/telegram.js';

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
  const ip = getIp(req);

  const rl = await makeIpLimiter(10, '15 m', 'login').limit(ip);
  if (!rl.success) {
    return res.status(429).json({
      error: 'Too many login attempts from your location. Please wait 15 minutes and try again.',
    });
  }

  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const response = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
    body:    JSON.stringify({ email, password }),
  });

  const data    = await response.json();
  const success = response.ok && !!data.access_token;

  logAttempt(email, ip, 'login', success);

  if (!success) {
    return res.status(401).json({ error: 'Invalid email or password' });
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
  const ip = getIp(req);

  const rl = await makeIpLimiter(5, '1 h', 'signup').limit(ip);
  if (!rl.success) {
    return res.status(429).json({
      error: 'Too many signup attempts from your location. Please try again later.',
    });
  }

  const { email, password, full_name, university } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required.' });
  }

  const { data, error } = await supabaseAnon.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${APP_URL}/auth/confirm`,
      data: { full_name, university },
    },
  });

  const userId  = data?.user?.id;
  const success = !error && !!userId;

  logAttempt(email, ip, 'signup', success);

  if (success) {
    sendTelegramAlert(`👤 New signup: ${email} (free)`);
    // Fire welcome email immediately — don't wait for cron (up to 24h delay)
    if (process.env.CRON_SECRET) {
      fetch(`${APP_URL}/api/send-nurture-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
        body:    JSON.stringify({ userId, emailType: 'welcome', email, name: full_name || '' }),
      }).catch(e => console.error('[auth/signup] welcome email failed:', e.message));
    }
  }

  if (error) {
    const msg = error.message || 'Sign up failed. Please try again.';
    return res.status(400).json({ error: msg });
  }

  // Update public.users row with full_name and university (created by DB trigger on signup).
  if (userId && full_name) {
    supabaseAdmin
      .from('users')
      .update({ full_name, university_name: university })
      .eq('id', userId)
      .then(({ error }) => { if (error) console.error('[auth/signup] users update:', error.message) })
      .catch(e => console.error('[auth/signup] users update:', e.message));
  }

  return res.status(200).json({ ok: true });
}

// ── action: forgot-password ───────────────────────────────────────────────────

async function handleForgotPassword(req, res) {
  const ip = getIp(req);

  const rl = await makeIpLimiter(5, '1 h', 'forgot').limit(ip);
  if (!rl.success) {
    return res.status(429).json({
      error: 'Too many requests. Please try again later.',
    });
  }

  const { email } = req.body || {};
  if (!email) return res.status(400).json({ error: 'Email is required.' });

  // Fire and forget — never reveal whether the email is registered.
  fetch(`${SUPABASE_URL}/auth/v1/recover`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON },
    body:    JSON.stringify({ email }),
  }).catch(e => console.error('[auth/forgot] recover error:', e.message));

  logAttempt(email, ip, 'forgot_password', true);

  return res.status(200).json({ ok: true });
}

// ── Router ────────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const action = req.query.action;

  if (action === 'login')            return handleLogin(req, res);
  if (action === 'signup')           return handleSignup(req, res);
  if (action === 'forgot-password')  return handleForgotPassword(req, res);

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
