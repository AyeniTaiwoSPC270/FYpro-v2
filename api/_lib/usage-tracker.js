import { supabaseAdmin } from './supabase-admin.js';

// Sonnet pricing: $3 per 1M input tokens, $15 per 1M output tokens
const INPUT_COST_PER_TOKEN  = 3  / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

function todayDate() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

/**
 * Fire-and-forget — call after every Claude response.
 * Never throws; logs errors only.
 * Primary path: supabaseAdmin.rpc('increment_daily_usage') — atomic, race-safe.
 * Fallback path: direct SELECT + UPDATE/INSERT — non-atomic but ensures rows
 *   are written even if the RPC EXECUTE privilege is misconfigured.
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
 * Call before every Claude response.
 * Fails open (returns allowed: true) if the DB is unreachable — never blocks users on infra errors.
 * @returns {{ allowed: boolean, spent: number, cap: number }}
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
