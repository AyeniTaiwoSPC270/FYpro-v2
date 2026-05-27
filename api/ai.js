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
import { isAllowedGeneralStep, getGeneralSystemPrompt } from './_lib/ai-prompts.js';

export const config = { maxDuration: 60 };

const ALLOWED_MODELS   = new Set(['claude-sonnet-4-6', 'claude-haiku-4-5-20251001']);
const MAX_TOKENS_LIMIT = 4096;

const TTL_BY_STEP = {
  'topic-validator':     86400,
  'chapter-architect':   86400,
  'methodology-advisor': 43200,
  'writing-planner':     21600,
};

/**
 * General Claude proxy for all six workflow steps (topic-validator, chapter-architect, etc.).
 * Validates the JWT, checks rate limits and daily spend cap, resolves the system prompt
 * server-side, and returns a cached or fresh Anthropic response.
 * @param {object} req - Vercel request; expects Authorization header and JSON body with step, messages, model, max_tokens
 * @param {object} res - Vercel response
 * @returns {Promise<void>}
 */
async function handleGeneral(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[ai/general] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  const {
    messages,
    max_tokens: rawMaxTokens = 2000,
    model: rawModel = 'claude-sonnet-4-6',
    step,
    previousSteps,
  } = req.body || {};

  // Reject unknown steps immediately — closes the prompt injection surface.
  // Client can no longer send an arbitrary system prompt; the server resolves one by step name.
  if (!isAllowedGeneralStep(step)) {
    return res.status(400).json({ error: 'Invalid or missing step.' });
  }

  const model      = ALLOWED_MODELS.has(rawModel) ? rawModel : 'claude-sonnet-4-6';
  const max_tokens = Math.min(Number(rawMaxTokens) || 2000, MAX_TOKENS_LIMIT);
  const userContent = messages?.find(m => m.role === 'user')?.content ?? '';
  const userPrompt  = typeof userContent === 'string' ? userContent : JSON.stringify(userContent);

  // Phase 1 — auth + rate limit + daily cap in parallel (none depend on each other)
  let authResult, rl, cap;
  try {
    [authResult, rl, cap] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      rateLimitCheck(req, { userDay: 30, ipDay: 60, prefix: 'claude' }).catch(rlErr => {
        console.error('[ai/general] rateLimitCheck threw (failing open):', rlErr.message);
        return { allowed: true, reason: '' };
      }),
      checkDailyCap().catch(() => ({ allowed: true, spent: 0, cap: 10 })),
    ]);
  } catch (authErr) {
    console.error('[ai/general] auth.getUser threw:', authErr.message);
    return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
  }

  const { data: { user } = {}, error: authError } = authResult;
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired authentication token.' });

  if (!rl.allowed) {
    const today = new Date().toISOString().slice(0, 10);
    sendTelegramAlertOnce(`⏱️ Rate limit: ${user.id.slice(0, 8)} blocked on general AI`, `tg:rl:general:${user.id}:${today}`);
    return res.status(429).json({ error: rl.reason });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (!cap.allowed) {
    sendTelegramAlertOnce(`⚠️ Spend cap hit: $${cap.spent.toFixed(2)} spent today. Claude requests blocked.`, `tg:spend:cap:${today}`);
    return res.status(503).json({ error: 'FYPro is at capacity for today. Please try again tomorrow.' });
  }
  if (cap.spent / cap.cap >= 0.8) {
    sendTelegramAlertOnce(`🔶 Spend warning: 80% of daily cap used ($${cap.spent.toFixed(2)}/$${cap.cap.toFixed(2)})`, `tg:spend:warn:${today}`);
  }

  // Phase 2 — fetch entitlements (sequential: needs verified user.id from phase 1)
  let entData = null;
  try {
    const { data } = await supabaseAdmin
      .from('user_entitlements')
      .select('paid_features')
      .eq('user_id', user.id)
      .maybeSingle();
    entData = data;
  } catch (e) {
    console.error('[ai/general] entitlements fetch error:', e.message);
  }

  const paidFeatures = Array.isArray(entData?.paid_features) ? entData.paid_features : [];
  const isPaid = paidFeatures.includes('student_pack') || paidFeatures.includes('defense_pack');

  // System prompt resolved server-side — client never controls this
  const system   = getGeneralSystemPrompt(step, { isPaid, previousSteps });
  const cacheKey = buildCacheKey(step, system, userPrompt);
  const ttl      = TTL_BY_STEP[step] ?? 21600;

  // Phase 3 — cache check (sequential: needs cache key from phase 2)
  const cached = await getCached(cacheKey).catch(() => null);

  if (cached) {
    await supabaseAdmin.from('response_times').insert({ feature: step, duration_ms: 0, user_id: user.id }).catch(err => {
      console.error('[ai/general] response_times insert failed (cache-hit):', err?.message, err?.code, err?.details, err?.hint, JSON.stringify(err));
    });
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {
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
    if (data.usage) await trackUsage(data.usage.input_tokens, data.usage.output_tokens, model);

    if (response.ok) {
      const duration       = Date.now() - start;
      const insertPromise  = supabaseAdmin.from('response_times').insert({ feature: step, duration_ms: duration, user_id: user.id });
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
      await Promise.race([insertPromise, timeoutPromise]).catch(err => {
        console.error('[ai/general] response_times insert failed:', err?.message, err?.code, err?.details, err?.hint, JSON.stringify(err));
      });
      setCached(cacheKey, data, ttl); // intentional fire-and-forget: cache write failure does not affect response
    }

    if (!response.ok && response.status >= 500) {
      const uid = extractUserId(req) || 'anonymous';
      sendTelegramAlert(`🔴 Anthropic ${response.status}: ${step} for ${uid}`);
    }
    res.setHeader('X-Cache', 'MISS');
    return res.status(response.status).json(data);
  } catch (err) {
    // AbortSignal.timeout() throws a DOMException with name 'TimeoutError' in Node 18+
    const userId = extractUserId(req) || 'anonymous';
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      console.error('[ai/general] Anthropic request timed out after 50s');
      await sendTelegramAlert(`⏱️ Generation timed out: ${step} for ${userId}`);
      return res.status(504).json({ error: 'Request timed out. Please try again.' });
    }
    console.error('[ai/general] error:', err.message);
    await sendTelegramAlert(`🔴 Generation failed: ${step} for ${userId} - ${err.message}`);
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
}

/**
 * Defense Simulator proxy. Requires defense_pack entitlement — enforced server-side.
 * Not cached (each turn is unique). Enforces a 300-word answer limit to prevent token abuse.
 * @param {object} req - Vercel request; expects Authorization header and JSON body with system, messages, model, max_tokens, answerWordCount
 * @param {object} res - Vercel response
 * @returns {Promise<void>}
 */
async function handleDefense(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Parallelize auth + rate limit + daily cap
  let authResult, rl, cap;
  try {
    [authResult, rl, cap] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      rateLimitCheck(req, { userDay: 20, ipDay: 40, prefix: 'defense' }).catch(rlErr => {
        console.error('[ai/defense] rateLimitCheck threw (failing open):', rlErr.message);
        return { allowed: true, reason: '' };
      }),
      checkDailyCap().catch(() => ({ allowed: true, spent: 0, cap: 10 })),
    ]);
  } catch (authErr) {
    console.error('[ai/defense] auth.getUser threw:', authErr.message);
    return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
  }

  const { data: { user } = {}, error: authError } = authResult;
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired authentication token.' });

  if (!rl.allowed) {
    const today = new Date().toISOString().slice(0, 10);
    sendTelegramAlertOnce(`⏱️ Rate limit: ${user.id.slice(0, 8)} blocked on Defense Simulator`, `tg:rl:defense:${user.id}:${today}`);
    return res.status(429).json({ error: rl.reason });
  }

  // Entitlements check requires user.id — runs after auth resolves
  const { data: entitlements, error: entError } = await supabaseAdmin
    .from('user_entitlements')
    .select('paid_features')
    .eq('user_id', user.id)
    .maybeSingle();  // maybeSingle: returns null (not an error) when row doesn't exist

  if (entError) {
    console.error('[ai/defense] entitlements fetch error:', entError.message);
    return res.status(503).json({ error: 'Service unavailable. Please try again.' });
  }

  const paidFeatures = Array.isArray(entitlements?.paid_features) ? entitlements.paid_features : [];
  if (!paidFeatures.includes('defense_pack')) {
    return res.status(403).json({ error: 'Feature not unlocked. Please purchase the Defense Pack.' });
  }

  const today = new Date().toISOString().slice(0, 10);
  if (!cap.allowed) {
    sendTelegramAlertOnce(`⚠️ Spend cap hit: $${cap.spent.toFixed(2)} spent today. Claude requests blocked.`, `tg:spend:cap:${today}`)
    return res.status(503).json({ error: 'FYPro is at capacity for today. Please try again tomorrow.' });
  }
  if (cap.spent / cap.cap >= 0.8) {
    sendTelegramAlertOnce(`🔶 Spend warning: 80% of daily cap used ($${cap.spent.toFixed(2)}/$${cap.cap.toFixed(2)})`, `tg:spend:warn:${today}`)
  }

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
    console.log('[ai/defense] Anthropic status:', response.status);
    if (data.usage) await trackUsage(data.usage.input_tokens, data.usage.output_tokens, model);
    if (response.ok) {
      const duration       = Date.now() - start;
      const insertPromise  = supabaseAdmin.from('response_times').insert({ feature: 'defense-simulator', duration_ms: duration, user_id: user.id });
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
      await Promise.race([insertPromise, timeoutPromise]).catch(err => {
        console.error('[ai/defense] response_times insert failed:', err?.message, err?.code, err?.details, err?.hint, JSON.stringify(err));
      });
    }
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

/**
 * Generates 8 targeted supervisor meeting questions based on project stage and last feedback.
 * Requires a valid JWT. Input word counts are validated before forwarding. Responses cached 6h.
 * @param {object} req - Vercel request; expects Authorization header and JSON body with stage, lastFeedback, stuckOn
 * @param {object} res - Vercel response
 * @returns {Promise<void>}
 */
async function handleSupervisorPrep(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server.' });

  const { stage, lastFeedback, stuckOn } = req.body || {};

  if (!stage || typeof stage !== 'string' || !stage.trim()) {
    return res.status(400).json({ error: 'Project stage is required.' });
  }

  const stageWords = stage.trim().split(/\s+/).length;
  const fbWords    = !lastFeedback ? 0 : lastFeedback.trim().split(/\s+/).length;
  const stWords    = !stuckOn      ? 0 : stuckOn.trim().split(/\s+/).length;
  if (stageWords > 100 || fbWords > 500 || stWords > 500) {
    return res.status(400).json({ error: 'Input too long. Please shorten your text to continue.' });
  }

  const userPrompt = `Stage: ${stage.trim()}. Last feedback: ${lastFeedback || 'none'}. Stuck on: ${stuckOn || 'nothing specific'}.`;
  const cacheKey   = buildCacheKey('supervisor-prep', SUPERVISOR_PREP_SYSTEM, userPrompt);

  let authResult, rl, cap, cached;
  try {
    [authResult, rl, cap, cached] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      rateLimitCheck(req, { userDay: 5, ipDay: 15, prefix: 'supervisor-prep' }).catch(() => ({ allowed: true, reason: '' })),
      checkDailyCap().catch(() => ({ allowed: true })),
      getCached(cacheKey).catch(() => null),
    ]);
  } catch (err) {
    console.error('[ai/supervisor-prep] auth.getUser threw:', err.message);
    return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
  }

  const { data: { user } = {}, error: authError } = authResult;
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired authentication token.' });

  if (!rl.allowed) return res.status(429).json({ error: rl.reason });
  if (!cap.allowed) return res.status(503).json({ error: 'FYPro is at capacity for today. Please try again tomorrow.' });

  if (cached) {
    await supabaseAdmin.from('response_times').insert({ feature: 'supervisor-prep', duration_ms: 0, user_id: user.id }).catch(err => {
      console.error('[ai/supervisor-prep] response_times insert failed (cache-hit):', err?.message, err?.code, err?.details, err?.hint, JSON.stringify(err));
    });
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {

    const start    = Date.now();
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
      signal: AbortSignal.timeout(50000),
    });

    const data = await response.json();
    if (data.usage) await trackUsage(data.usage.input_tokens, data.usage.output_tokens, 'claude-sonnet-4-6');

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic error' });
    }

    const duration       = Date.now() - start;
    const insertPromise  = supabaseAdmin.from('response_times').insert({ feature: 'supervisor-prep', duration_ms: duration, user_id: user.id });
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
    await Promise.race([insertPromise, timeoutPromise]).catch(err => {
      console.error('[ai/supervisor-prep] response_times insert failed:', err?.message, err?.code, err?.details, err?.hint, JSON.stringify(err));
    });

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
