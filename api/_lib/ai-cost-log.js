// Per-call AI cost/token/cache/trace ledger (W3). One row per Anthropic call or
// cache hit — see docs/specs/2026-08-03-w3-cost-telemetry-design.md. This is the
// single write path every Anthropic-call site routes through.

import { supabaseAdmin } from './supabase-admin.js';
import { estimateCallCostUsd } from './usage-tracker.js';

/**
 * Records one row in ai_call_log: a real Anthropic call (with token counts) or a
 * cache hit (tokensIn/tokensOut default to 0, cacheHit: true). Never throws; the
 * insert races a 3s timeout so a slow/unavailable Supabase never delays the
 * response — mirrors the response_times insert pattern in anthropic-proxy.js.
 * Must be awaited before the response is sent (Vercel freezes the function
 * immediately after).
 * @param {object} params
 * @param {string}  [params.userId]     - Verified Supabase user id
 * @param {string}  params.feature      - Label matching the response_times `feature` convention
 * @param {string}  params.model        - Anthropic model ID used (or would have been used, on a cache hit)
 * @param {number}  [params.tokensIn=0]
 * @param {number}  [params.tokensOut=0]
 * @param {boolean} [params.cacheHit=false]
 * @param {string}  [params.traceId]
 * @param {number}  [params.durationMs]
 * @returns {Promise<void>}
 */
export async function logAiCall({ userId, feature, model, tokensIn = 0, tokensOut = 0, cacheHit = false, traceId, durationMs }) {
  const cost = estimateCallCostUsd(tokensIn, tokensOut, model);
  // .catch() here turns a thrown/network rejection into a resolved { error }
  // result, so insertPromise itself can never reject — Promise.race below
  // never throws, and a late resolution (after losing the race) can't produce
  // an unhandled rejection either.
  const insertPromise = supabaseAdmin.from('ai_call_log').insert({
    user_id: userId || null,
    feature,
    model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: cost,
    cache_hit: cacheHit,
    trace_id: traceId || null,
    duration_ms: durationMs ?? null,
  }).catch(err => ({ error: err }));
  const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
  const result = await Promise.race([insertPromise, timeoutPromise]);
  if (result?.error) {
    console.error(`[ai-cost-log] insert failed (${feature}):`, result.error?.message ?? result.error);
  }
}
