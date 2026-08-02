// Shared policy for what happens when a Redis- or Supabase-backed guard is
// unavailable. Before this file, each call site in api/ai.js hand-rolled its
// own `.catch(() => ({ allowed: true }))` — meaning the fail-open/fail-closed
// choice was an accident of whichever fallback someone typed, not a decision.
// See docs/architecture/2026-08-02-w2-failure-policy-decision-table.md for the
// full per-mechanism rationale this file implements.

import { sendTelegramAlertOnce } from './telegram.js';
import { Sentry } from './sentry-server.js';
import { writeSystemLog } from './system-log.js';

/**
 * Runs `checkFn`. If it throws — the guarded dependency (Redis or Supabase)
 * is unavailable — applies `policy` instead of letting the error propagate:
 *   - 'closed': return `closedResult` (block the request). Use for anything
 *     that bounds spend — an infra outage must never uncap it.
 *   - 'open':   return `openResult` (let the request through). Use for
 *     availability-over-abuse checks like rate limits.
 * Either way, the trip is recorded once: a system_logs row (queryable
 * counter) plus a deduplicated Sentry + Telegram alert, so a fail-open/closed
 * event is never silent. Never throws.
 * @template T
 * @param {() => Promise<T>} checkFn
 * @param {object} opts
 * @param {'open'|'closed'} opts.policy
 * @param {string} opts.name         - short id, e.g. 'checkDailyCap' (used in the alert key)
 * @param {T} opts.openResult        - value returned when policy is 'open'
 * @param {T} opts.closedResult      - value returned when policy is 'closed'
 * @returns {Promise<T>}
 */
export async function guardedCheck(checkFn, { policy, name, openResult, closedResult }) {
  try {
    return await checkFn();
  } catch (err) {
    recordFailurePolicyTrip(name, policy, err);
    return policy === 'closed' ? closedResult : openResult;
  }
}

function recordFailurePolicyTrip(name, policy, err) {
  const message = String(err?.message || err);
  console.error(`[failure-policy] ${name} unavailable — failing ${policy}:`, message);

  writeSystemLog({
    severity:      'error',
    feature:       `fail-${policy}:${name}`,
    source:        'failure-policy',
    plain_message: `${name} dependency unavailable — failed ${policy}`,
    raw_detail:    { error: message },
  });

  Sentry.captureMessage(`[fail-${policy}] ${name} dependency unavailable: ${message}`, 'error');

  const today = new Date().toISOString().slice(0, 10);
  sendTelegramAlertOnce(
    `🛑 ${name} failing ${policy === 'closed' ? 'CLOSED (blocking requests)' : 'OPEN'} — dependency unavailable: ${message}`,
    `tg:failpolicy:${name}:${today}`,
    3600
  );
}
