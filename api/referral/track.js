// POST /api/referral/track
// Called by signup.jsx after a successful sign-up when a ?ref= code was stored.
// Records the referral relationship and grants the new user 1 free Defense credit.
// No auth token required — user just signed up and has no session yet.
// Rate-limited to 5 attempts per IP per hour to prevent brute-force code guessing.

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { supabaseAdmin } from '../_lib/supabase-admin.js';

const CODE_RE = /^[A-Z0-9]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const ipLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'rl:ip:referral-track',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Rate limit by IP ─────────────────────────────────────────────────────────
  const ip = String(
    req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
  ).split(',')[0].trim();

  const { success: ipOk } = await ipLimiter.limit(ip);
  if (!ipOk) {
    return res.status(429).json({ error: 'Too many referral attempts. Try again later.' });
  }

  // ── Input validation ─────────────────────────────────────────────────────────
  const { email, ref_code } = req.body ?? {};

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  if (!ref_code || typeof ref_code !== 'string') {
    return res.status(400).json({ tracked: false, reason: 'missing_code' });
  }

  const code = ref_code.trim().toUpperCase();
  if (!CODE_RE.test(code)) {
    return res.status(400).json({ tracked: false, reason: 'invalid_code_format' });
  }

  const normalEmail = email.trim().toLowerCase();

  // ── Look up referrer by referral_code ────────────────────────────────────────
  const { data: referrer, error: referrerErr } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('referral_code', code)
    .maybeSingle();

  if (referrerErr) {
    console.error('[referral/track] referrer lookup error', referrerErr.message);
    return res.status(500).json({ error: 'Database error' });
  }

  if (!referrer) {
    // Unknown code — silent no-op per spec (not a security issue)
    return res.status(200).json({ tracked: false, reason: 'code_not_found' });
  }

  // ── Look up the new user by email ────────────────────────────────────────────
  // The handle_new_user trigger mirrors auth.users → public.users on signup,
  // so this row exists by the time the client calls this endpoint.
  const { data: newUser, error: newUserErr } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', normalEmail)
    .maybeSingle();

  if (newUserErr) {
    console.error('[referral/track] new user lookup error', newUserErr.message);
    return res.status(500).json({ error: 'Database error' });
  }

  if (!newUser) {
    return res.status(404).json({ error: 'User not found. Try again in a moment.' });
  }

  // ── Self-referral guard ───────────────────────────────────────────────────────
  if (referrer.id === newUser.id) {
    return res.status(200).json({ tracked: false, reason: 'self_referral' });
  }

  // ── Idempotency: one referral per referred user ───────────────────────────────
  const { data: existing, error: existingErr } = await supabaseAdmin
    .from('referrals')
    .select('id')
    .eq('referred_user_id', newUser.id)
    .maybeSingle();

  if (existingErr) {
    console.error('[referral/track] idempotency check error', existingErr.message);
    return res.status(500).json({ error: 'Database error' });
  }

  if (existing) {
    // Already tracked — return success so client clears localStorage
    return res.status(200).json({ tracked: true, reason: 'already_tracked' });
  }

  // ── Insert referral row ───────────────────────────────────────────────────────
  const { data: referral, error: insertErr } = await supabaseAdmin
    .from('referrals')
    .insert({
      referrer_user_id: referrer.id,
      referred_user_id: newUser.id,
      status: 'pending',
    })
    .select('id')
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') {
      // Unique constraint violation — concurrent insert won the race
      return res.status(200).json({ tracked: true, reason: 'already_tracked' });
    }
    if (insertErr.code === '23514') {
      // no_self_referral CHECK — should be caught above but belt-and-braces
      return res.status(200).json({ tracked: false, reason: 'self_referral' });
    }
    console.error('[referral/track] insert referral error', insertErr.message);
    return res.status(500).json({ error: 'Database error' });
  }

  // ── Grant 1 free Defense credit to the new user ──────────────────────────────
  const { error: creditErr } = await supabaseAdmin
    .from('defense_credits')
    .insert({
      user_id: newUser.id,
      reason: 'referral_signup_bonus',
      source_referral_id: referral.id,
    });

  if (creditErr) {
    // Non-fatal: log and continue. The referral row is committed.
    console.error('[referral/track] insert defense_credit error', creditErr.message);
  }

  console.log('[referral/track] tracked', {
    referrer: referrer.id,
    referred: newUser.id,
    referral: referral.id,
  });

  return res.status(200).json({ tracked: true });
}
