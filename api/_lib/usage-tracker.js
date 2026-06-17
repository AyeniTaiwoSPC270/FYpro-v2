import { supabaseAdmin } from './supabase-admin.js';
import { redis }         from './rate-limit.js';

// Sonnet pricing: $3 per 1M input tokens, $15 per 1M output tokens
const INPUT_COST_PER_TOKEN  = 3  / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

// ── Per-user daily spend ceilings (USD) ────────────────────────────────────
// The global DAILY_CAP_USD protects the whole budget, but on its own a single
// free-tier abuser can drain it and deny service to PAYING users. These per-user
// ceilings cap how much any one account can spend per UTC day. Free users are
// held low (abuse defence); paid users get headroom well above legitimate usage
// (a full workflow + defense day runs ~$1–2).
const FREE_USER_DAILY_CAP_USD = 0.75;
const PAID_USER_DAILY_CAP_USD = 4;
// TTL comfortably past UTC midnight so the per-user counter self-expires; the key
// is date-stamped so a new day always starts from zero regardless of TTL timing.
const USER_COST_TTL_SECONDS   = 60 * 60 * 36; // 36h

function todayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

function userCostKey(userId) {
  return `cost:user:${userId}:${todayDate()}`;
}

/** Estimated USD cost of one Anthropic call from its token usage (Sonnet pricing). */
function estimateCallCostUsd(tokensIn, tokensOut) {
  return (tokensIn || 0) * INPUT_COST_PER_TOKEN + (tokensOut || 0) * OUTPUT_COST_PER_TOKEN;
}

/**
 * Records token usage and estimated USD cost for a single Anthropic API call.
 * Must be awaited before sending the response — Vercel terminates the function after the response is sent.
 * Never throws; falls back from the atomic RPC to a direct table write if the RPC privilege is missing.
 * @param {number} tokensIn  - Input (prompt) token count from data.usage.input_tokens
 * @param {number} tokensOut - Output (completion) token count from data.usage.output_tokens
 * @param {string} model     - Model ID used for the call (e.g. 'claude-sonnet-4-6')
 * @returns {Promise<void>}
 */
export async function trackUsage(tokensIn, tokensOut, model) {
  const cost =
    (tokensIn  || 0) * INPUT_COST_PER_TOKEN +
    (tokensOut || 0) * OUTPUT_COST_PER_TOKEN;

  // ── Primary: RPC (atomic UPSERT inside the function) ──────────────────
  const { error: rpcError } = await supabaseAdmin.rpc('increment_daily_usage', {
    p_tokens_in:  tokensIn  || 0,
    p_tokens_out: tokensOut || 0,
    p_cost_usd:   cost,
    p_requests:   1,
  });

  if (!rpcError) return; // success — done

  // ── Fallback: direct table write ───────────────────────────────────────
  // The RPC failed (most likely a missing EXECUTE grant on service_role after
  // the security audit). Log loudly so it appears in Vercel function logs,
  // then fall back to a direct read-modify-write on daily_usage.
  // This is not atomic — concurrent requests may lose increments — but is
  // far better than silently dropping all usage data.
  console.error('[usage-tracker] RPC increment_daily_usage failed — falling back to direct write. Error:', rpcError.message, rpcError.code);

  try {
    const today = todayDate();
    const { data: existing, error: selectErr } = await supabaseAdmin
      .from('daily_usage')
      .select('total_tokens_in, total_tokens_out, total_cost_usd, request_count')
      .eq('date', today)
      .maybeSingle();

    if (selectErr) throw selectErr;

    if (existing) {
      const { error: updateErr } = await supabaseAdmin
        .from('daily_usage')
        .update({
          total_tokens_in:  (existing.total_tokens_in  || 0) + (tokensIn  || 0),
          total_tokens_out: (existing.total_tokens_out || 0) + (tokensOut || 0),
          total_cost_usd:   (parseFloat(existing.total_cost_usd) || 0) + cost,
          request_count:    (existing.request_count    || 0) + 1,
          updated_at:       new Date().toISOString(),
        })
        .eq('date', today);
      if (updateErr) throw updateErr;
    } else {
      const { error: insertErr } = await supabaseAdmin
        .from('daily_usage')
        .insert({
          date:             today,
          total_tokens_in:  tokensIn  || 0,
          total_tokens_out: tokensOut || 0,
          total_cost_usd:   cost,
          request_count:    1,
        });
      if (insertErr) throw insertErr;
    }
  } catch (fallbackErr) {
    console.error('[usage-tracker] fallback direct write also failed:', fallbackErr.message);
  }
}

/**
 * Checks whether today's cumulative Claude spend is still under DAILY_CAP_USD.
 * Fails open (returns allowed: true) if the DB is unreachable — never blocks users on infra errors.
 * @returns {Promise<{ allowed: boolean, spent: number, cap: number }>}
 */
export async function checkDailyCap() {
  const cap = parseFloat(process.env.DAILY_CAP_USD || '10');
  try {
    const { data, error } = await supabaseAdmin
      .from('daily_usage')
      .select('total_cost_usd')
      .eq('date', todayDate())
      .maybeSingle();

    if (error) throw error;
    if (!data) return { allowed: true, spent: 0, cap };

    const spent = parseFloat(data.total_cost_usd) || 0;
    return { allowed: spent < cap, spent, cap };
  } catch (err) {
    console.error('[usage-tracker] checkDailyCap failed (failing open):', err.message);
    return { allowed: true, spent: 0, cap };
  }
}

/**
 * Adds one call's estimated USD cost to the caller's per-user daily Redis counter.
 * Shared across every Claude endpoint so the per-user cap reflects total spend,
 * not per-feature spend. Fire-and-forget safe: never throws; no-op without a userId.
 * Must be awaited before sending the response (Vercel freezes the function after).
 * @param {string} userId    - Verified Supabase user id
 * @param {number} tokensIn  - Input token count from data.usage.input_tokens
 * @param {number} tokensOut - Output token count from data.usage.output_tokens
 * @returns {Promise<void>}
 */
export async function trackUserUsage(userId, tokensIn, tokensOut) {
  if (!userId) return;
  try {
    const key = userCostKey(userId);
    await redis.incrbyfloat(key, estimateCallCostUsd(tokensIn, tokensOut));
    // Refresh TTL on every write so an active user's key always outlives the day.
    await redis.expire(key, USER_COST_TTL_SECONDS);
  } catch (err) {
    console.error('[usage-tracker] trackUserUsage failed (non-fatal):', err.message);
  }
}

/**
 * Checks whether a single user is still under their per-user daily spend ceiling.
 * Free and paid users get different ceilings. Fails OPEN (allowed: true) on any
 * Redis error — a cache outage must never block users, matching checkDailyCap.
 * @param {string}  userId - Verified Supabase user id
 * @param {boolean} isPaid - true if the user holds any paid entitlement
 * @returns {Promise<{ allowed: boolean, spent: number, cap: number, isPaid: boolean }>}
 */
export async function checkUserCap(userId, isPaid) {
  const cap = isPaid ? PAID_USER_DAILY_CAP_USD : FREE_USER_DAILY_CAP_USD;
  if (!userId) return { allowed: true, spent: 0, cap, isPaid: !!isPaid };
  try {
    const raw   = await redis.get(userCostKey(userId));
    const spent = parseFloat(raw) || 0;
    return { allowed: spent < cap, spent, cap, isPaid: !!isPaid };
  } catch (err) {
    console.error('[usage-tracker] checkUserCap failed (failing open):', err.message);
    return { allowed: true, spent: 0, cap, isPaid: !!isPaid };
  }
}
