// Rate limiting via Upstash Redis — enforces per-user and per-IP daily caps.
// Both limiters use fixedWindow so counters reset at UTC midnight each calendar day.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

/**
 * Redis key for the atomic free-tier run counter of one step for one user.
 * Used by ai.js (reserve/refund) and admin.js (cleared on reset-run-counts).
 * @param {string} dbKey  - snake_case step key, e.g. 'chapter_architect'
 * @param {string} userId - Supabase user id
 */
export function freeRunKey(dbKey, userId) {
  return `runs:${dbKey}:${userId}`;
}

/**
 * Extracts the Supabase user ID from a Bearer JWT without verifying the signature.
 * Signature verification is done by supabaseAdmin.auth.getUser() in the calling handler.
 * Here we only need the sub claim to key the rate limiter — a forged sub would just
 * hit a different (attacker-controlled) bucket, which is the correct behavior.
 */
export function extractUserId(req) {
  const authHeader = req.headers.authorization || '';
  if (!authHeader.startsWith('Bearer ')) return null;
  try {
    const parts = authHeader.slice(7).split('.');
    if (parts.length !== 3) return null;
    const payload = JSON.parse(Buffer.from(parts[1], 'base64').toString('utf8'));
    return payload.sub || null;
  } catch {
    return null;
  }
}

/**
 * Returns today's date as a UTC string — used to scope per-user rate limit keys
 * so the counter resets at midnight UTC each calendar day.
 */
function utcDateKey() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}

/**
 * Enforces per-IP and per-user daily rate limits via Upstash Redis fixedWindow counters.
 * Call at the top of any serverless handler; callers should `.catch()` with a fail-open default.
 * @param {object} req            - Vercel request object (reads x-forwarded-for and Authorization)
 * @param {object} limits         - Rate limit configuration
 * @param {number} limits.userDay - Max requests per authenticated user per UTC calendar day
 * @param {number} limits.ipDay   - Max requests per IP per UTC calendar day
 * @param {string} limits.prefix  - Redis key namespace (e.g. 'claude', 'defense')
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 * @throws {Error} If Redis is unavailable (callers should catch and fail open)
 */
export async function rateLimitCheck(req, limits) {
  const { userDay, ipDay, prefix = 'default' } = limits;

  const ip = String(
    req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
  ).split(',')[0].trim();

  const userId = extractUserId(req);

  // IP check — fixed calendar-day window, applies to all requests (authenticated or not)
  const ipLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(ipDay, '1 d'),
    prefix: `rl:ip:${prefix}`,
  });

  const ipResult = await ipLimiter.limit(ip);
  if (!ipResult.success) {
    return { allowed: false, reason: 'Rate limit exceeded. Try again tomorrow.' };
  }

  // User check — fixed calendar-day key resets at UTC midnight.
  // Key: userId:YYYY-MM-DD — each new day gets a fresh Redis entry.
  if (userId) {
    const userLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(userDay, '1 d'),
      prefix: `rl:user:${prefix}`,
    });

    const dateKey = `${userId}:${utcDateKey()}`;
    const userResult = await userLimiter.limit(dateKey);
    if (!userResult.success) {
      return { allowed: false, reason: 'Daily limit reached. Your allowance resets at midnight UTC.' };
    }
  }

  return { allowed: true, reason: '' };
}
