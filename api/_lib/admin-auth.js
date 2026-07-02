// Shared admin gate — verifies a Bearer JWT and timing-safe-compares the caller's
// email against ADMIN_EMAIL. Fails CLOSED if ADMIN_EMAIL is unset.
// This is the server-side source of truth for admin access (the client adminOnly
// route guard is convenience only). Used by api/admin.js and api/notify.js.

import crypto from 'crypto';
import { supabaseAdmin } from './supabase-admin.js';

/**
 * Returns the caller user object when they are the admin, or sends a 401/403 and
 * returns null. Callers must `return` immediately when null is returned.
 * @param {object} req - Vercel request (reads Authorization: Bearer <jwt>)
 * @param {object} res - Vercel response (a 401/403 is sent on failure)
 * @returns {Promise<object|null>}
 */
export async function verifyAdmin(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  try {
    const { data: { user: caller }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !caller) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    const adminEmail = process.env.ADMIN_EMAIL;
    const callerBuf  = Buffer.from(caller.email || '');
    const adminBuf   = Buffer.from(adminEmail    || '');
    if (!adminEmail || callerBuf.length !== adminBuf.length ||
        !crypto.timingSafeEqual(callerBuf, adminBuf)) {
      res.status(403).json({ error: 'Forbidden' }); return null;
    }
    return caller;
  } catch {
    res.status(401).json({ error: 'Unauthorized' }); return null;
  }
}
