// POST /api/referral?action=track  — record referral + grant signup credit (no auth)
// POST /api/referral?action=credit — qualify referral + award milestone (auth required)

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { extractUserId } from './_lib/rate-limit.js';
import { sendTelegramAlert } from './_lib/telegram.js';

const CODE_RE  = /^[A-Z0-9]{6}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

const trackLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(5, '1 h'),
  prefix: 'rl:ip:referral-track',
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action;

  if (action === 'track') return handleTrack(req, res);
  if (action === 'credit') return handleCredit(req, res);

  return res.status(400).json({ error: 'Unknown action' });
}

// ─── track ────────────────────────────────────────────────────────────────────

async function handleTrack(req, res) {
  const ip = String(
    req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
  ).split(',')[0].trim();

  const { success: ipOk } = await trackLimiter.limit(ip);
  if (!ipOk) {
    return res.status(429).json({ error: 'Too many referral attempts. Try again later.' });
  }

  const { email, ref_code } = req.body ?? {};

  if (!email || typeof email !== 'string' || !EMAIL_RE.test(email.trim())) {
    return res.status(400).json({ error: 'Invalid email' });
  }

  if (!ref_code || typeof ref_code !== 'string') {
    return res.status(200).json({ tracked: false, reason: 'missing_code' });
  }

  const code        = ref_code.trim().toUpperCase();
  const normalEmail = email.trim().toLowerCase();

  if (!CODE_RE.test(code)) {
    return res.status(200).json({ tracked: false, reason: 'invalid_code_format' });
  }

  const { data: referrer } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('referral_code', code)
    .maybeSingle();

  if (!referrer) {
    return res.status(200).json({ tracked: false, reason: 'code_not_found' });
  }

  const { data: newUser } = await supabaseAdmin
    .from('users')
    .select('id')
    .eq('email', normalEmail)
    .maybeSingle();

  if (!newUser) {
    return res.status(404).json({ error: 'User not found. Try again in a moment.' });
  }

  if (referrer.id === newUser.id) {
    return res.status(200).json({ tracked: false, reason: 'self_referral' });
  }

  const { data: existing } = await supabaseAdmin
    .from('referrals')
    .select('id')
    .eq('referred_user_id', newUser.id)
    .maybeSingle();

  if (existing) {
    return res.status(200).json({ tracked: true, reason: 'already_tracked' });
  }

  const { data: referral, error: insertErr } = await supabaseAdmin
    .from('referrals')
    .insert({ referrer_user_id: referrer.id, referred_user_id: newUser.id, status: 'pending' })
    .select('id')
    .single();

  if (insertErr) {
    if (insertErr.code === '23505') return res.status(200).json({ tracked: true, reason: 'already_tracked' });
    if (insertErr.code === '23514') return res.status(200).json({ tracked: false, reason: 'self_referral' });
    console.error('[referral/track]', insertErr.message);
    return res.status(500).json({ error: 'Database error' });
  }

  const { error: creditErr } = await supabaseAdmin
    .from('defense_credits')
    .insert({ user_id: newUser.id, reason: 'referral_signup_bonus', source_referral_id: referral.id });

  if (creditErr) console.error('[referral/track] credit insert:', creditErr.message);

  sendTelegramAlert(`🔗 Referral signup: ${normalEmail} used code <code>${code}</code>`).catch(() => null);

  return res.status(200).json({ tracked: true });
}

// ─── credit ───────────────────────────────────────────────────────────────────

async function handleCredit(req, res) {
  const userId = extractUserId(req);
  if (!userId) return res.status(401).json({ error: 'Unauthorized' });

  const token = (req.headers.authorization || '').replace('Bearer ', '');
  const { data: { user: authUser }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authUser || authUser.id !== userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: referral } = await supabaseAdmin
    .from('referrals')
    .select('id, referrer_user_id, status')
    .eq('referred_user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();

  if (!referral) return res.status(200).json({ qualified: false });

  if (!authUser.email_confirmed_at) return res.status(200).json({ qualified: false });

  const { data: progress } = await supabaseAdmin
    .from('user_progress')
    .select('topic_validator_completed_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (!progress?.topic_validator_completed_at) return res.status(200).json({ qualified: false });

  const now = new Date().toISOString();

  const { error: qualifyErr } = await supabaseAdmin
    .from('referrals')
    .update({ status: 'qualified', qualified_at: now })
    .eq('id', referral.id)
    .eq('status', 'pending');

  if (qualifyErr) {
    console.error('[referral/credit] qualify:', qualifyErr.message);
    return res.status(500).json({ error: 'Database error' });
  }

  const { count } = await supabaseAdmin
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_user_id', referral.referrer_user_id)
    .in('status', ['qualified', 'rewarded']);

  if (count > 0 && count % 3 === 0) {
    await awardMilestoneCredit(referral.referrer_user_id, referral.id, now);
  }

  return res.status(200).json({ qualified: true });
}

async function awardMilestoneCredit(referrerId, triggerReferralId, now) {
  const { data: existing } = await supabaseAdmin
    .from('defense_credits')
    .select('id')
    .eq('user_id', referrerId)
    .eq('source_referral_id', triggerReferralId)
    .eq('reason', 'referral_milestone')
    .maybeSingle();

  if (existing) return;

  const { error: creditErr } = await supabaseAdmin
    .from('defense_credits')
    .insert({ user_id: referrerId, reason: 'referral_milestone', source_referral_id: triggerReferralId });

  if (creditErr) {
    if (creditErr.code !== '23505') console.error('[referral/credit] milestone insert:', creditErr.message);
    return;
  }

  supabaseAdmin.auth.admin.getUserById(referrerId)
    .then(({ data }) => {
      const email = data?.user?.email || referrerId;
      return sendTelegramAlert(`🎯 Referral milestone: ${email} earned a free defense credit (3 qualified referrals)`);
    })
    .catch(() => null);

  const { data: toReward } = await supabaseAdmin
    .from('referrals')
    .select('id')
    .eq('referrer_user_id', referrerId)
    .eq('status', 'qualified')
    .order('qualified_at', { ascending: true })
    .limit(3);

  if (toReward?.length) {
    await supabaseAdmin
      .from('referrals')
      .update({ status: 'rewarded', rewarded_at: now })
      .in('id', toReward.map((r) => r.id));
  }

}
