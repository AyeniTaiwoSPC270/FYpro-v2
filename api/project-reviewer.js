// Project Reviewer proxy — requires valid Supabase JWT with defense_pack entitlement.
// Server-side enforcement: frontend gating alone is not enough.

import { supabaseAdmin } from './_lib/supabase-admin.js';
import { rateLimitCheck } from './_lib/rate-limit.js';
import { checkDailyCap, trackUsage, trackUserUsage, checkUserCap } from './_lib/usage-tracker.js';
import { writeSystemLog } from './_lib/system-log.js';
import { setCorsHeaders } from './_lib/cors.js';
import { sendTelegramAlert } from './_lib/telegram.js';
import { getReviewerSystemPrompt } from './_lib/ai-prompts.js';
import { reserveRun, syncRunCount } from './_lib/run-reservation.js';
import { EXPRESS_TOTAL_LIMITS } from './_lib/express-limits.js';

export const config = { maxDuration: 60 };

const ALLOWED_MODELS   = new Set(['claude-sonnet-4-6', 'claude-haiku-4-5-20251001']);
const MAX_TOKENS_LIMIT = 4096;

/**
 * Project Reviewer — accepts a PDF (base64-encoded in the messages array) and returns
 * a Claude AI review. Requires a valid JWT with defense_pack entitlement. Validates PDF
 * magic bytes (%PDF) and enforces a 4 MB total file size limit server-side before forwarding.
 * System prompt is resolved server-side from promptType + previousSteps (never client-supplied).
 * @param {object} req - Vercel request; expects Authorization header and JSON body with promptType, previousSteps, messages, model, max_tokens
 * @param {object} res - Vercel response
 * @returns {Promise<void>}
 * @throws {Error} If Anthropic request times out after 50s (returns 504)
 */
const handler = async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[project-reviewer] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  // Phase 1: rate limit + auth in parallel
  let authResult, rl;
  try {
    [authResult, rl] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      rateLimitCheck(req, { userDay: 10, ipDay: 100, prefix: 'reviewer' }).catch(() => ({ allowed: true, reason: '' })),
    ]);
  } catch (err) {
    console.error('[project-reviewer] auth.getUser threw:', err.message);
    return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
  }

  const { data: { user } = {}, error: authError } = authResult;
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

  // Phase 2: entitlements + daily cap in parallel (both need user.id or are independent)
  const [entResult, cap] = await Promise.all([
    supabaseAdmin.from('user_entitlements').select('paid_features, run_counts').eq('user_id', user.id).maybeSingle(),
    checkDailyCap().catch(() => ({ allowed: true })),
  ]);

  if (entResult.error) {
    console.error('[project-reviewer] entitlements query error:', entResult.error.message);
    return res.status(500).json({ error: 'Failed to verify entitlements. Please try again.' });
  }

  const paidFeatures = Array.isArray(entResult.data?.paid_features)
    ? entResult.data.paid_features
    : [];

  if (!paidFeatures.includes('defense_pack') && !paidFeatures.includes('express_defense')) {
    return res.status(403).json({ error: 'Feature not unlocked. Please purchase the Defense Pack.' });
  }

  if (!cap.allowed) {
    return res.status(503).json({ error: 'FYPro is at capacity for today. Please try again tomorrow.' });
  }

  // Per-user daily spend ceiling. Reviewer is paid-only, so use the paid tier.
  // PDF reviews are the heaviest calls — this stops one account running up the bill.
  const userCap = await checkUserCap(user.id, true);
  if (!userCap.allowed) {
    return res.status(429).json({ error: "You've reached today's usage limit. It resets at midnight UTC." });
  }

  // Lifetime cap for express-only users. Express Defence is a one-time unlock, so
  // the daily ceiling alone leaves total cost unbounded. Defense Pack holders are
  // exempt (richer purchase, bounded by daily caps only). Reserved below, after
  // PDF validation passes, so a malformed upload never consumes a slot.
  const expressOnly = paidFeatures.includes('express_defense') && !paidFeatures.includes('defense_pack');
  const dbRunCounts = (entResult.data?.run_counts && typeof entResult.data.run_counts === 'object')
    ? entResult.data.run_counts
    : {};
  let refundRun = () => {};
  let reservedCount = null;

  try {
    const {
      promptType,
      previousSteps,
      messages,
      max_tokens: rawMaxTokens = 2000,
      model: rawModel = 'claude-sonnet-4-6',
    } = req.body || {};

    // System prompt resolved server-side from promptType + structured context.
    // The client can no longer send a raw system string — closes the loophole
    // where a Defense Pack user could use this endpoint as a general Claude proxy.
    const system = getReviewerSystemPrompt(promptType, { previousSteps });
    if (!system) {
      return res.status(400).json({ error: 'Invalid or missing promptType.' });
    }

    const model      = ALLOWED_MODELS.has(rawModel) ? rawModel : 'claude-sonnet-4-6';
    const max_tokens = Math.min(Number(rawMaxTokens) || 2000, MAX_TOKENS_LIMIT);

    // Server-side file validation: find the PDF source blocks (if any) and check
    // magic bytes + size. The frontend encodes PDFs as base64 and embeds them in
    // the messages array as { type:'document', source:{ type:'base64', data:'...' } }.
    // Size is summed across ALL document blocks and capped at 4 MB decoded
    // (~5.6 MB base64) — matches the frontend MAX_BYTES limit and stays under
    // Vercel's ~4.5 MB request body cap, which would reject larger payloads anyway.
    if (Array.isArray(messages)) {
      const MAX_TOTAL_B64_CHARS = 5_600_000;
      let totalB64Chars = 0;
      for (const msg of messages) {
        const content = Array.isArray(msg.content) ? msg.content : [];
        for (const block of content) {
          if (block?.type === 'document' && block?.source?.type === 'base64') {
            const b64 = block.source.data || '';
            totalB64Chars += b64.length;
            if (totalB64Chars > MAX_TOTAL_B64_CHARS) {
              return res.status(400).json({ error: 'File too large. Maximum size is 4 MB.' });
            }
            // Magic-byte check: first 4 bytes of a PDF must be %PDF (25 50 44 46)
            const headerBytes = Buffer.from(b64.slice(0, 8), 'base64');
            if (headerBytes.slice(0, 4).toString('ascii') !== '%PDF') {
              return res.status(400).json({ error: 'Invalid file type. Only PDF files are accepted.' });
            }
          }
        }
      }
    }

    // Reserve a lifetime slot for express-only users now that the PDF is valid.
    if (expressOnly) {
      const r = await reserveRun({
        dbKey: 'express_reviewer',
        userId: user.id,
        limit: EXPRESS_TOTAL_LIMITS.express_reviewer,
        dbRunCounts,
      });
      if (!r.allowed) {
        return res.status(429).json({
          error: `You've used all ${EXPRESS_TOTAL_LIMITS.express_reviewer} of your Express project reviews.`,
        });
      }
      refundRun     = r.refund;
      reservedCount = r.reservedCount;
    }

    const start    = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({ model, max_tokens, system, messages, temperature: 0 }),
      signal: AbortSignal.timeout(50000),
    });

    const data = await response.json();
    console.log('[project-reviewer] Anthropic responded with status:', response.status);
    if (data.usage) {
      await trackUsage(data.usage.input_tokens, data.usage.output_tokens, model);
      await trackUserUsage(user.id, data.usage.input_tokens, data.usage.output_tokens);
    }

    if (response.ok) {
      // Persist the reserved lifetime count (display/fallback only — Redis is the
      // enforcement source). Fire before responding; Vercel freezes after.
      if (expressOnly && reservedCount !== null) {
        await syncRunCount({ userId: user.id, dbKey: 'express_reviewer', newCount: reservedCount, dbRunCounts });
      }

      const duration = Date.now() - start;
      const insertPromise  = supabaseAdmin.from('response_times').insert({ feature: 'project-reviewer', duration_ms: duration, user_id: user.id });
      const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
      await Promise.race([insertPromise, timeoutPromise]).catch(err => {
        console.error('[project-reviewer] response_times insert failed:', err?.message, err?.code, err?.details, err?.hint, JSON.stringify(err));
      });
    } else {
      refundRun(); // Anthropic returned an error status — don't charge the run
    }

    return res.status(response.status).json(data);
  } catch (err) {
    refundRun(); // request never produced a result — don't charge the run
    if (err.name === 'TimeoutError' || err.name === 'AbortError') {
      console.error('[project-reviewer] Anthropic request timed out after 50s');
      sendTelegramAlert(`⏱️ Project Reviewer timed out for user:${user.id.slice(0, 8)} (Defense Pack)`).catch(() => null);
      return res.status(504).json({ error: 'Request timed out. Please try again.' });
    }
    console.error('[project-reviewer] error:', err.message);
    sendTelegramAlert(`🔴 Project Reviewer failed for user:${user.id.slice(0, 8)} — ${err.message}`).catch(() => null);
    writeSystemLog({
      severity: 'error',
      feature: 'Project Reviewer',
      source: 'ai',
      plain_message: 'A project review failed — PDF may be too large or AI timed out',
      raw_detail: { error: err.message, userId: user.id },
    });
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
};

export default handler;
