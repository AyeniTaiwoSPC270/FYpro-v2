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
import { callAnthropic } from './_lib/anthropic-proxy.js';

export const config = { maxDuration: 60 };

const ALLOWED_MODELS   = new Set(['claude-sonnet-4-6', 'claude-haiku-4-5-20251001']);
const MAX_TOKENS_LIMIT = 4096;

const TTL_BY_STEP = {
  'topic-validator':     86400,
  'chapter-architect':   86400,
  'methodology-advisor': 43200,
  'writing-planner':     21600,
};

// Server-enforced per-step limits for free-tier users.
// Mirrors the FREE_LIMITS object in src/hooks/useRunLimit.js.
// Keep these two in sync when adjusting free tier quotas.
const SERVER_FREE_LIMITS = {
  'topic-validator':     3,
  'chapter-architect':   3,
  'methodology-advisor': 3,
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
      .select('paid_features, run_counts')
      .eq('user_id', user.id)
      .maybeSingle();
    entData = data;
  } catch (e) {
    console.error('[ai/general] entitlements fetch error:', e.message);
  }

  const paidFeatures = Array.isArray(entData?.paid_features) ? entData.paid_features : [];
  const isPaid = paidFeatures.includes('student_pack') || paidFeatures.includes('defense_pack');

  // Server-side run limit gate — only applies to free (unpaid) users.
  if (!isPaid && SERVER_FREE_LIMITS[step] !== undefined) {
    const dbRunCounts = (entData?.run_counts && typeof entData.run_counts === 'object')
      ? entData.run_counts
      : {};
    // DB stores keys as snake_case (topic_validator); step param uses kebab-case (topic-validator)
    const dbKey = step.replace(/-/g, '_');
    const serverCount = typeof dbRunCounts[dbKey] === 'number' ? dbRunCounts[dbKey] : 0;
    if (serverCount >= SERVER_FREE_LIMITS[step]) {
      return res.status(429).json({
        error: 'Free tier limit reached for this feature. Upgrade to the Student Pack to continue.',
      });
    }
  }

  // System prompt resolved server-side — client never controls this
  const system   = getGeneralSystemPrompt(step, { isPaid, previousSteps });
  const cacheKey = buildCacheKey(step, system, userPrompt);
  const ttl      = TTL_BY_STEP[step] ?? 21600;

  // Phase 3 — cache check (sequential: needs cache key from phase 2)
  const cached = await getCached(cacheKey).catch(() => null);

  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {
    const { response, data } = await callAnthropic({
      feature:    step,
      userId:     user.id,
      model,
      max_tokens,
      system,
      messages,
    });

    if (response.ok) {
      setCached(cacheKey, data, ttl); // intentional fire-and-forget: cache write failure does not affect response

      // Increment server-side run count for free users — fire-and-forget, eventual consistency.
      if (!isPaid && SERVER_FREE_LIMITS[step] !== undefined) {
        const dbKey = step.replace(/-/g, '_');
        const existingCounts = (entData?.run_counts && typeof entData.run_counts === 'object')
          ? entData.run_counts
          : {};
        const newCount = (typeof existingCounts[dbKey] === 'number' ? existingCounts[dbKey] : 0) + 1;
        supabaseAdmin
          .from('user_entitlements')
          .upsert(
            { user_id: user.id, run_counts: { ...existingCounts, [dbKey]: newCount }, updated_at: new Date().toISOString() },
            { onConflict: 'user_id' }
          )
          .catch(err => console.error('[ai/general] run count increment failed:', err?.message));
      }
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(response.status).json(data);
  } catch (err) {
    const userId = extractUserId(req) || 'anonymous';
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      console.error('[ai/general] Anthropic request timed out after 50s');
      await sendTelegramAlert(`⏱️ Generation timed out: ${step} for ${userId}`);
      return res.status(504).json({ error: 'Request timed out. Please try again.' });
    }
    if (err.isConfig) {
      console.error('[ai/general] ANTHROPIC_API_KEY is not set');
      return res.status(500).json({ error: 'API key not configured on server.' });
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

  const paidFeatures = Array.isArray(entitlements?.paid_features) ? entitlements?.paid_features : [];
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

  try {
    const { response, data } = await callAnthropic({
      feature:    'defense-simulator',
      userId:     user.id,
      model,
      max_tokens,
      system,
      messages,
    });
    console.log('[ai/defense] Anthropic status:', response.status);
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

// Moved to /api/admin?action=sync-run-counts — kept as 410 stub for 30 days
// to handle any stale client code. Remove after 2026-06-27.
async function handleSyncRunCounts(req, res) {
  return res.status(410).json({
    error: 'This action has moved. Use /api/admin?action=sync-run-counts instead.',
  });
}

/**
 * Checks all 19 achievement conditions for the authenticated user server-side,
 * writes any newly earned ones to user_achievements via service role,
 * and returns the list of newly earned keys.
 * Called after: step completion, defense session end, referral qualification, certificate share.
 */
async function handleCheckAchievements(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  const { data: { user } = {}, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token.' });

  const userId = user.id;
  const shared = req.body?.shared === true;

  // Rate limit: 30 per user per day, 60 per IP per hour
  const rl = await rateLimitCheck(req, { userDay: 30, ipDay: 60, prefix: 'check-achievements' }).catch(rlErr => {
    console.error('[ai/check-achievements] rateLimitCheck threw (failing open):', rlErr.message);
    return { allowed: true, reason: '' };
  });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

  try {
    // Fetch all user data + existing achievements in parallel
    const [
      { data: steps },
      { data: defSessions },
      { data: certs },
      { data: referrals },
      { data: credits },
      { data: existing },
    ] = await Promise.all([
      supabaseAdmin.from('project_steps').select('step_type, created_at').eq('user_id', userId),
      supabaseAdmin.from('defense_sessions').select('final_score, completed_at').eq('user_id', userId).order('completed_at', { ascending: true }),
      supabaseAdmin.from('defense_certificates').select('id').eq('user_id', userId).limit(1),
      supabaseAdmin.from('referrals').select('status, created_at').eq('referrer_user_id', userId),
      supabaseAdmin.from('defense_credits').select('id').eq('user_id', userId).limit(1),
      supabaseAdmin.from('user_achievements').select('achievement_key').eq('user_id', userId),
    ]);

    const earned = new Set((existing ?? []).map(r => r.achievement_key));
    const newlyEarned = [];
    const userCreatedAt = new Date(user.created_at);

    function check(key, condition) {
      if (!earned.has(key) && condition) {
        newlyEarned.push({ user_id: userId, achievement_key: key });
        earned.add(key);
      }
    }

    const stepNames = (steps ?? []).map(s => s.step_type);
    const scores = (defSessions ?? []).map(s => s.final_score).filter(n => typeof n === 'number');
    const maxScore = scores.length > 0 ? Math.max(...scores) : -1;
    const WAT_OFFSET_MS = 60 * 60 * 1000; // UTC+1

    // ── MILESTONE ──────────────────────────────────────────────────────────────
    check('first_step',    stepNames.includes('topic_validator'));
    check('halfway',       stepNames.length >= 3);
    check('defense_ready', stepNames.length >= 6 && (defSessions ?? []).length > 0);
    check('certified',     (certs ?? []).length > 0);

    // ── SPEED ──────────────────────────────────────────────────────────────────
    const tvStep = (steps ?? []).find(s => s.step_type === 'topic_validator');
    if (tvStep && tvStep.created_at) {
      const tvMs   = new Date(tvStep.created_at).getTime();
      const signupMs = userCreatedAt.getTime();
      check('fast_starter', tvMs - signupMs <= 60 * 60 * 1000);
    }

    // Sprint: 3 steps on same WAT calendar day
    const stepsByWatDay = {};
    for (const s of (steps ?? [])) {
      const watDate = new Date(new Date(s.created_at).getTime() + WAT_OFFSET_MS);
      const key = watDate.toISOString().slice(0, 10);
      stepsByWatDay[key] = (stepsByWatDay[key] ?? 0) + 1;
    }
    check('sprint', Object.values(stepsByWatDay).some(n => n >= 3));

    // Speed run: all 6 steps within 7 days of signup
    if (stepNames.length >= 6) {
      const latestStepMs = Math.max(...(steps ?? []).map(s => new Date(s.created_at).getTime()));
      check('speed_run', latestStepMs - userCreatedAt.getTime() <= 7 * 24 * 60 * 60 * 1000);
    }

    // ── EFFORT ─────────────────────────────────────────────────────────────────
    check('sharp_mind',    maxScore >= 8);
    check('excellence',    maxScore >= 9);
    check('perfectionist', maxScore === 10);
    check('persistent',    (defSessions ?? []).length >= 3);

    // Never Give Up: ran defense again after a score < 7
    // defense_sessions is fetched ORDER BY completed_at ASC, so scores array is chronological
    const firstBadIndex = scores.findIndex(s => s < 7);
    const hasLaterRun   = firstBadIndex !== -1 && firstBadIndex < scores.length - 1;
    check('never_give_up', hasLaterRun);

    // ── SOCIAL ─────────────────────────────────────────────────────────────────
    const qualifiedRefs = (referrals ?? []).filter(r => r.status === 'qualified' || r.status === 'rewarded');
    check('ambassador',  (referrals ?? []).length > 0);
    check('connector',   qualifiedRefs.length >= 3);
    check('earned_it',   (credits ?? []).length > 0);
    check('shared',      shared);

    // ── HIDDEN ─────────────────────────────────────────────────────────────────
    // Night Owl: step completed midnight–4 AM WAT
    const nightOwl = (steps ?? []).some(s => {
      const localHour = (new Date(s.created_at).getUTCHours() + 1) % 24;
      return localHour < 4;
    });
    check('night_owl', nightOwl);

    // Early Bird: step completed before 7 AM WAT
    const earlyBird = (steps ?? []).some(s => {
      const localHour = (new Date(s.created_at).getUTCHours() + 1) % 24;
      return localHour < 7;
    });
    check('early_bird', earlyBird);

    // Dedicated: meaningful actions on 5+ distinct WAT calendar days
    const actionDays = new Set();
    for (const s of (steps ?? [])) {
      actionDays.add(new Date(new Date(s.created_at).getTime() + WAT_OFFSET_MS).toISOString().slice(0, 10));
    }
    for (const d of (defSessions ?? [])) {
      if (d.completed_at) {
        actionDays.add(new Date(new Date(d.completed_at).getTime() + WAT_OFFSET_MS).toISOString().slice(0, 10));
      }
    }
    check('dedicated', actionDays.size >= 5);

    // Write newly earned — upsert is safe (UNIQUE constraint prevents duplicates)
    if (newlyEarned.length > 0) {
      await supabaseAdmin
        .from('user_achievements')
        .upsert(newlyEarned, { onConflict: 'user_id,achievement_key', ignoreDuplicates: true })
        .catch(err => console.error('[check-achievements] upsert error:', err?.message));
    }

    return res.status(200).json({ newlyEarned: newlyEarned.map(r => r.achievement_key) });
  } catch (err) {
    console.error('[check-achievements] error:', err?.message);
    return res.status(503).json({ error: 'Could not load achievement data. Please try again.' });
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.query.action === 'defense')             return handleDefense(req, res);
  if (req.query.action === 'supervisor-prep')     return handleSupervisorPrep(req, res);
  if (req.query.action === 'sync-run-counts')     return handleSyncRunCounts(req, res);
  if (req.query.action === 'check-achievements')  return handleCheckAchievements(req, res);
  return handleGeneral(req, res);
}
