// Atomic lifetime-run reservation for capped features (Express Defence).
//
// Mirrors the proven free-tier reservation pattern in api/ai.js handleGeneral:
// seed a Redis counter from the DB run_counts value, SET NX, INCR to reserve a
// slot atomically (closing the concurrency race where N parallel requests all
// pass a plain read-check before any increment lands), compare against the limit,
// and DECR (refund) if the downstream Anthropic call never produces a result.
//
// Fails OPEN on any Redis error — an infra outage must never block paying users.
// admin.js reset-run-counts deletes these same keys so admin resets take effect.

import { redis, freeRunKey } from './rate-limit.js';
import { supabaseAdmin } from './supabase-admin.js';

/**
 * Atomically reserve one lifetime run of a capped feature for a user.
 * @param {object}  args
 * @param {string}  args.dbKey        - snake_case run_counts key, e.g. 'express_reviewer'
 * @param {string}  args.userId       - verified Supabase user id
 * @param {number}  args.limit        - lifetime cap for this feature
 * @param {object}  args.dbRunCounts  - the user's run_counts object from user_entitlements
 * @returns {Promise<{ allowed: boolean, reservedCount: number, refund: () => Promise<void> }>}
 *          allowed=false when the cap is already reached. refund() decrements the
 *          reserved slot — call it if the Anthropic call fails (no-op when nothing
 *          was reserved, e.g. the read-check or a Redis-down fail-open path).
 *          refund() returns the underlying Redis promise so callers on a route that
 *          responds/streams immediately after can `await` it before Vercel freezes
 *          the function — existing fire-and-forget callers can keep ignoring the
 *          return value. It is also self-disarming: after the first invocation,
 *          further calls are no-ops that resolve immediately, so a route that calls
 *          refund() again from an outer catch (e.g. after already refunding in the
 *          try block) can never double-decrement the counter.
 */
export async function reserveRun({ dbKey, userId, limit, dbRunCounts }) {
  const noop = () => Promise.resolve();
  const seed = (dbRunCounts && typeof dbRunCounts[dbKey] === 'number') ? dbRunCounts[dbKey] : 0;

  // Read-check first: cheap reject when already at/over the cap.
  if (seed >= limit) {
    return { allowed: false, reservedCount: seed, refund: noop };
  }

  try {
    const key = freeRunKey(dbKey, userId);
    await redis.set(key, seed, { nx: true }); // seed the counter on first use only
    const reservedCount = await redis.incr(key);

    if (reservedCount > limit) {
      // Over the cap — leave the counter where it is (staying above the limit is
      // harmless and keeps subsequent reads rejecting). No refund needed.
      return { allowed: false, reservedCount, refund: noop };
    }

    let refunded = false;
    return {
      allowed: true,
      reservedCount,
      refund: () => {
        if (refunded) return Promise.resolve();
        refunded = true;
        return redis.decr(key).catch(() => {});
      },
    };
  } catch (err) {
    // Redis unavailable — fail open to the read-check we already passed above.
    // Nothing was reserved, so refund is a no-op.
    console.error('[run-reservation] reserve failed (failing open):', err?.message);
    return { allowed: true, reservedCount: seed + 1, refund: noop };
  }
}

/**
 * Mirror a reserved run count into user_entitlements.run_counts. Display/fallback
 * only — the Redis reservation above is the enforcement source of truth. Fire it
 * after a successful Anthropic call. Best-effort: never throws.
 * @param {object} args
 * @param {string} args.userId       - verified Supabase user id
 * @param {string} args.dbKey        - snake_case run_counts key
 * @param {number} args.newCount     - the reserved count to persist
 * @param {object} args.dbRunCounts  - the user's existing run_counts object
 * @returns {Promise<void>}
 */
export async function syncRunCount({ userId, dbKey, newCount, dbRunCounts }) {
  const base = (dbRunCounts && typeof dbRunCounts === 'object') ? dbRunCounts : {};
  try {
    await supabaseAdmin
      .from('user_entitlements')
      .upsert(
        { user_id: userId, run_counts: { ...base, [dbKey]: newCount }, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      );
  } catch (err) {
    console.error('[run-reservation] run count sync failed (non-fatal):', err?.message);
  }
}
