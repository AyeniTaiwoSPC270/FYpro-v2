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
 */
export async function trackUsage(tokensIn, tokensOut, model) {
  try {
    const cost =
      (tokensIn  || 0) * INPUT_COST_PER_TOKEN +
      (tokensOut || 0) * OUTPUT_COST_PER_TOKEN;

    await supabaseAdmin.rpc('increment_daily_usage', {
      p_date:       todayDate(),
      p_tokens_in:  tokensIn  || 0,
      p_tokens_out: tokensOut || 0,
      p_cost_usd:   cost,
      p_requests:   1,
    });
  } catch (err) {
    console.error('[usage-tracker] trackUsage failed:', err.message);
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
