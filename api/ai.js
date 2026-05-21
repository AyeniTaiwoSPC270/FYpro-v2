// FYPro — AI proxy
// ?action=defense → Defense Simulator (JWT + defense_pack required, no cache)
// default         → General Claude proxy (cached, no auth required)

import { rateLimitCheck, extractUserId } from './_lib/rate-limit.js';
import { checkDailyCap, trackUsage }     from './_lib/usage-tracker.js';
import { getCached, setCached, buildCacheKey } from './_lib/cache.js';
import { supabaseAdmin }  from './_lib/supabase-admin.js';
import { writeSystemLog } from './_lib/system-log.js';
import { setCorsHeaders }  from './_lib/cors.js';
import { sendTelegramAlert, sendTelegramAlertOnce } from './_lib/telegram.js';

const ALLOWED_MODELS   = new Set(['claude-sonnet-4-6', 'claude-haiku-4-5-20251001']);
const MAX_TOKENS_LIMIT = 4096;

const TTL_BY_STEP = {
  'topic-validator':     86400,
  'chapter-architect':   86400,
  'methodology-advisor': 43200,
  'writing-planner':     21600,
};

async function handleGeneral(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  let user;
  try {
    const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !data?.user) return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    user = data.user;
  } catch (authErr) {
    console.error('[ai/general] auth.getUser threw:', authErr.message);
    return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
  }

  let rl;
  try {
    rl = await rateLimitCheck(req, { userDay: 30, ipDay: 60, prefix: 'claude' });
  } catch (rlErr) {
    console.error('[ai/general] rateLimitCheck threw (failing open):', rlErr.message);
    rl = { allowed: true, reason: '' };
  }
  if (!rl.allowed) {
    const today = new Date().toISOString().slice(0, 10);
    sendTelegramAlertOnce(`⏱️ Rate limit: ${user.id.slice(0, 8)} blocked on general AI`, `tg:rl:general:${user.id}:${today}`);
    return res.status(429).json({ error: rl.reason });
  }

  const cap = await checkDailyCap();
  const today = new Date().toISOString().slice(0, 10);
  if (!cap.allowed) {
    sendTelegramAlertOnce(`⚠️ Spend cap hit: $${cap.spent.toFixed(2)} spent today. Claude requests blocked.`, `tg:spend:cap:${today}`)
    return res.status(503).json({ error: 'FYPro is at capacity for today. Please try again tomorrow.' });
  }
  if (cap.spent / cap.cap >= 0.8) {
    sendTelegramAlertOnce(`🔶 Spend warning: 80% of daily cap used ($${cap.spent.toFixed(2)}/$${cap.cap.toFixed(2)})`, `tg:spend:warn:${today}`)
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[ai/general] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  try {
    const {
      system,
      messages,
      max_tokens: rawMaxTokens = 2000,
      model: rawModel = 'claude-sonnet-4-6',
      step,
    } = req.body || {};

    const model      = ALLOWED_MODELS.has(rawModel) ? rawModel : 'claude-sonnet-4-6';
    const max_tokens = Math.min(Number(rawMaxTokens) || 2000, MAX_TOKENS_LIMIT);

    const prefix      = step || 'general';
    const userContent = messages?.find(m => m.role === 'user')?.content ?? '';
    const userPrompt  = typeof userContent === 'string' ? userContent : JSON.stringify(userContent);
    const cacheKey    = buildCacheKey(prefix, system ?? '', userPrompt);
    const ttl         = TTL_BY_STEP[prefix] ?? 21600;

    const cached = await getCached(cacheKey);
    if (cached) {
      const userId = extractUserId(req);
      (async () => { try { await supabaseAdmin.from('response_times').insert({ feature: prefix, duration_ms: 0, user_id: userId }) } catch {} })();
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    const start    = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'pdfs-2024-09-25',
      },
      body:   JSON.stringify({ model, max_tokens, system, messages, temperature: 0 }),
      signal: AbortSignal.timeout(50000),
    });

    const data = await response.json();
    if (data.usage) trackUsage(data.usage.input_tokens, data.usage.output_tokens, model);

    if (response.ok) {
      const duration = Date.now() - start;
      const userId   = extractUserId(req);
      (async () => { try { await supabaseAdmin.from('response_times').insert({ feature: prefix, duration_ms: duration, user_id: userId }) } catch {} })();
      setCached(cacheKey, data, ttl); // intentional fire-and-forget: cache write failure does not affect response
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(response.status).json(data);
  } catch (err) {
    // AbortSignal.timeout() throws a DOMException with name 'TimeoutError' in Node 18+
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      console.error('[ai/general] Anthropic request timed out after 50s');
      return res.status(504).json({ error: 'Request timed out. Please try again.' });
    }
    console.error('[ai/general] error:', err.message);
    const feature  = req.body?.step || 'general'
    const userId   = extractUserId(req) || 'anonymous'
    await sendTelegramAlert(`🔴 Generation failed: ${feature} for ${userId} - ${err.message}`)
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
}

async function handleDefense(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  let user;
  try {
    const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !data?.user) return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    user = data.user;
  } catch (authErr) {
    console.error('[ai/defense] auth.getUser threw:', authErr.message);
    return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
  }

  let rl;
  try {
    rl = await rateLimitCheck(req, { userDay: 20, ipDay: 40, prefix: 'defense' });
  } catch (rlErr) {
    console.error('[ai/defense] rateLimitCheck threw (failing open):', rlErr.message);
    rl = { allowed: true, reason: '' };
  }
  if (!rl.allowed) {
    const today = new Date().toISOString().slice(0, 10);
    sendTelegramAlertOnce(`⏱️ Rate limit: ${user.id.slice(0, 8)} blocked on Defense Simulator`, `tg:rl:defense:${user.id}:${today}`);
    return res.status(429).json({ error: rl.reason });
  }

  const { data: entitlements, error: entError } = await supabaseAdmin
    .from('user_entitlements')
    .select('paid_features')
    .eq('user_id', user.id)
    .single();

  if (entError || !entitlements) return res.status(403).json({ error: 'Feature not unlocked.' });

  const paidFeatures = Array.isArray(entitlements.paid_features) ? entitlements.paid_features : [];
  if (!paidFeatures.includes('defense_pack')) {
    return res.status(403).json({ error: 'Feature not unlocked. Please purchase the Defense Pack.' });
  }

  const cap = await checkDailyCap();
  const today = new Date().toISOString().slice(0, 10);
  if (!cap.allowed) {
    sendTelegramAlertOnce(`⚠️ Spend cap hit: $${cap.spent.toFixed(2)} spent today. Claude requests blocked.`, `tg:spend:cap:${today}`)
    return res.status(503).json({ error: 'FYPro is at capacity for today. Please try again tomorrow.' });
  }
  if (cap.spent / cap.cap >= 0.8) {
    sendTelegramAlertOnce(`🔶 Spend warning: 80% of daily cap used ($${cap.spent.toFixed(2)}/$${cap.cap.toFixed(2)})`, `tg:spend:warn:${today}`)
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[ai/defense] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  try {
    const {
      system,
      messages,
      max_tokens: rawMaxTokens = 2000,
      model: rawModel = 'claude-sonnet-4-6',
      answerWordCount,
    } = req.body || {};

    const model      = ALLOWED_MODELS.has(rawModel) ? rawModel : 'claude-sonnet-4-6';
    const max_tokens = Math.min(Number(rawMaxTokens) || 2000, MAX_TOKENS_LIMIT);

    if (answerWordCount !== undefined && answerWordCount > 300) {
      return res.status(400).json({ error: 'Input too long. Please shorten your text to continue.' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'pdfs-2024-09-25',
      },
      body:   JSON.stringify({ model, max_tokens, system, messages, temperature: 0 }),
      signal: AbortSignal.timeout(50000),
    });

    const data = await response.json();
    console.log('[ai/defense] Anthropic status:', response.status);
    if (data.usage) trackUsage(data.usage.input_tokens, data.usage.output_tokens, model);
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[ai/defense] error:', err.message);
    await Promise.all([
      sendTelegramAlert(`🔴 Generation failed: defense-simulator for user:${user.id.slice(0, 8)} - ${err.message}`),
      writeSystemLog({
        severity:      'error',
        feature:       'Defense Simulator',
        source:        'ai',
        plain_message: 'A defense session failed — the AI did not respond in time or hit the token limit',
        raw_detail:    { error: err.message, userId: user.id },
      }),
    ]);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
}

const SUPERVISOR_PREP_SYSTEM = `You are a final year project advisor at a Nigerian university.
A student is preparing for a supervisor meeting.
Based on their project stage, last supervisor feedback, and current blockers,
generate 8 specific questions they should ask their supervisor in their next meeting.
Questions must be concrete and actionable — not generic.
Format: return ONLY a JSON array of 8 strings. No preamble. No markdown.`;

const SUPERVISOR_PREP_TTL = 21600; // 6 hours

async function handleSupervisorPrep(req, res) {
  const rl = await rateLimitCheck(req, { userDay: 5, ipDay: 15, prefix: 'supervisor-prep' });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

  const cap = await checkDailyCap();
  if (!cap.allowed) return res.status(503).json({ error: 'FYPro is at capacity for today. Please try again tomorrow.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server.' });

  try {
    const { stage, lastFeedback, stuckOn } = req.body || {};

    if (!stage || typeof stage !== 'string' || !stage.trim()) {
      return res.status(400).json({ error: 'Project stage is required.' });
    }

    const fbWords = !lastFeedback ? 0 : lastFeedback.trim().split(/\s+/).length;
    const stWords = !stuckOn     ? 0 : stuckOn.trim().split(/\s+/).length;
    if (fbWords > 500 || stWords > 500) {
      return res.status(400).json({ error: 'Input too long. Please shorten your text to continue.' });
    }

    const userPrompt = `Stage: ${stage.trim()}. Last feedback: ${lastFeedback || 'none'}. Stuck on: ${stuckOn || 'nothing specific'}.`;
    const cacheKey   = buildCacheKey('supervisor-prep', SUPERVISOR_PREP_SYSTEM, userPrompt);

    const cached = await getCached(cacheKey);
    if (cached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:       'claude-sonnet-4-6',
        max_tokens:  1000,
        system:      SUPERVISOR_PREP_SYSTEM,
        messages:    [{ role: 'user', content: userPrompt }],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(25000),
    });

    const data = await response.json();
    if (data.usage) trackUsage(data.usage.input_tokens, data.usage.output_tokens, 'claude-sonnet-4-6');

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic error' });
    }

    const text = data.content?.[0]?.text ?? '';
    let questions;
    try {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const match   = cleaned.match(/\[[\s\S]*\]/);
      questions     = JSON.parse(match ? match[0] : cleaned);
      if (!Array.isArray(questions)) throw new Error('Not an array');
    } catch {
      console.error('[supervisor-prep] parse error — raw text:', text.slice(0, 200));
      return res.status(500).json({ error: 'Failed to parse response. Please try again.' });
    }

    const result = { questions };
    res.setHeader('X-Cache', 'MISS');
    setCached(cacheKey, result, SUPERVISOR_PREP_TTL);
    return res.status(200).json(result);
  } catch (err) {
    console.error('[supervisor-prep] error:', err.message);
    await sendTelegramAlert(`🔴 Generation failed: supervisor-prep - ${err.message}`)
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
}

async function handleSyncRunCounts(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  let user;
  try {
    const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !data?.user) return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    user = data.user;
  } catch (authErr) {
    console.error('[ai/sync-run-counts] auth.getUser threw:', authErr.message);
    return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
  }

  const { run_counts } = req.body || {};
  if (!run_counts || typeof run_counts !== 'object' || Array.isArray(run_counts)) {
    return res.status(400).json({ error: 'run_counts must be a plain object.' });
  }

  try {
    // Read existing counts from DB so we can take Math.max — prevents clients
    // from gaming the system by submitting artificially low values.
    const { data: existing } = await supabaseAdmin
      .from('user_entitlements')
      .select('run_counts')
      .eq('user_id', user.id)
      .maybeSingle();

    const serverCounts = (existing?.run_counts && typeof existing.run_counts === 'object')
      ? existing.run_counts
      : {};

    const merged = { ...serverCounts };
    for (const k of Object.keys(run_counts)) {
      if (k === '_reset_at') { merged[k] = run_counts[k]; continue; }
      const clientVal = typeof run_counts[k] === 'number' ? run_counts[k] : 0;
      const serverVal = typeof serverCounts[k] === 'number' ? serverCounts[k] : 0;
      merged[k] = Math.max(clientVal, serverVal);
    }

    // Only write run_counts — paid_features is never touched here.
    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert(
        { user_id: user.id, run_counts: merged, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select('user_id');

    if (error) {
      console.error('[ai/sync-run-counts] upsert error:', error.message);
      return res.status(500).json({ error: 'Failed to sync run counts.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[ai/sync-run-counts] error:', err.message);
    return res.status(500).json({ error: 'Unexpected error syncing run counts.' });
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.query.action === 'defense')          return handleDefense(req, res);
  if (req.query.action === 'supervisor-prep')  return handleSupervisorPrep(req, res);
  if (req.query.action === 'sync-run-counts')  return handleSyncRunCounts(req, res);
  return handleGeneral(req, res);
}
