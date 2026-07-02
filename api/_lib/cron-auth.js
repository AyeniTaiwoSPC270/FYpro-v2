// Shared cron authentication — timing-safe CRON_SECRET verification.
// Accepts the secret via the `x-cron-secret` header OR `Authorization: Bearer <secret>`.
// Fails CLOSED: if CRON_SECRET is unset, every request is rejected.
// The secret is read from a header (never a query param) so it does not land in
// access logs, referrers, or browser history.

import crypto from 'crypto';

/**
 * Verifies the cron secret on a request. Sends a 401 response and returns false
 * when unauthorized; returns true when authorized.
 * @param {object} req - Vercel request (reads x-cron-secret / authorization headers)
 * @param {object} res - Vercel response (a 401 is sent on failure)
 * @returns {boolean}
 */
export function verifyCronSecret(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) { res.status(401).json({ error: 'Unauthorized' }); return false; }

  const xSecret    = req.headers['x-cron-secret'] || '';
  const authHeader = req.headers['authorization']  || '';
  const expected   = Buffer.from(cronSecret);
  const bearer     = `Bearer ${cronSecret}`;

  const xMatch = xSecret.length === cronSecret.length &&
    crypto.timingSafeEqual(Buffer.from(xSecret), expected);
  const bearerMatch = authHeader.length === bearer.length &&
    crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(bearer));

  if (!xMatch && !bearerMatch) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}
