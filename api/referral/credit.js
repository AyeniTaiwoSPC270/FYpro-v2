// POST /api/referral/credit
// Called by the Topic Validator after the referred user's first successful completion.
// Flips the referral to 'qualified' and awards the referrer a Defense credit at each
// 3rd qualified referral milestone. Idempotent — safe to call multiple times.
// Requires a valid Bearer JWT (user must be signed in).

import { supabaseAdmin } from '../_lib/supabase-admin.js';
import { extractUserId } from '../_lib/rate-limit.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // ── Auth ──────────────────────────────────────────────────────────────────────
  const userId = extractUserId(req);
  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Verify the JWT against Supabase auth
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  const { data: { user: authUser }, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !authUser || authUser.id !== userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // ── Find pending referral for this user ───────────────────────────────────────
  const { data: referral, error: referralErr } = await supabaseAdmin
    .from('referrals')
    .select('id, referrer_user_id, status')
    .eq('referred_user_id', userId)
    .eq('status', 'pending')
    .maybeSingle();

  if (referralErr) {
    console.error('[referral/credit] referral lookup error', referralErr.message);
    return res.status(500).json({ error: 'Database error' });
  }

  if (!referral) {
    // No pending referral — no-op
    return res.status(200).json({ qualified: false });
  }

  // ── Verify email confirmation ─────────────────────────────────────────────────
  // authUser.email_confirmed_at is set by Supabase after the user clicks the
  // verification link. Without this, a signup-and-abandon bot can't qualify.
  if (!authUser.email_confirmed_at) {
    return res.status(200).json({ qualified: false });
  }

  // ── Verify first Topic Validator completion ───────────────────────────────────
  // progress.ts writes to user_progress via markStepComplete('topic_validator').
  // The client awaits markStepComplete before calling this endpoint.
  const { data: progress, error: progressErr } = await supabaseAdmin
    .from('user_progress')
    .select('topic_validator_completed_at')
    .eq('user_id', userId)
    .maybeSingle();

  if (progressErr) {
    console.error('[referral/credit] progress lookup error', progressErr.message);
    return res.status(500).json({ error: 'Database error' });
  }

  if (!progress?.topic_validator_completed_at) {
    return res.status(200).json({ qualified: false });
  }

  // ── Mark referral as qualified ────────────────────────────────────────────────
  const now = new Date().toISOString();

  const { error: qualifyErr } = await supabaseAdmin
    .from('referrals')
    .update({ status: 'qualified', qualified_at: now })
    .eq('id', referral.id)
    .eq('status', 'pending'); // optimistic concurrency guard

  if (qualifyErr) {
    console.error('[referral/credit] qualify update error', qualifyErr.message);
    return res.status(500).json({ error: 'Database error' });
  }

  console.log('[referral/credit] qualified', { referral: referral.id, referred: userId });

  // ── Check referrer milestone ──────────────────────────────────────────────────
  // Count all qualified + rewarded referrals for this referrer.
  // At each multiple of 3, issue one Defense credit.
  const { count, error: countErr } = await supabaseAdmin
    .from('referrals')
    .select('id', { count: 'exact', head: true })
    .eq('referrer_user_id', referral.referrer_user_id)
    .in('status', ['qualified', 'rewarded']);

  if (countErr) {
    console.error('[referral/credit] milestone count error', countErr.message);
    // Don't fail the whole request — referral is already qualified
    return res.status(200).json({ qualified: true });
  }

  if (count > 0 && count % 3 === 0) {
    await awardMilestoneCredit(referral.referrer_user_id, referral.id, now);
  }

  return res.status(200).json({ qualified: true });
}

async function awardMilestoneCredit(referrerId, triggerReferralId, now) {
  // Idempotency: only award if no milestone credit already points to this referral
  const { data: existing } = await supabaseAdmin
    .from('defense_credits')
    .select('id')
    .eq('user_id', referrerId)
    .eq('source_referral_id', triggerReferralId)
    .eq('reason', 'referral_milestone')
    .maybeSingle();

  if (existing) {
    console.log('[referral/credit] milestone already awarded for referral', triggerReferralId);
    return;
  }

  // Insert the milestone credit for the referrer
  const { error: creditErr } = await supabaseAdmin
    .from('defense_credits')
    .insert({
      user_id: referrerId,
      reason: 'referral_milestone',
      source_referral_id: triggerReferralId,
    });

  if (creditErr) {
    if (creditErr.code === '23505') {
      // Concurrent insert won — credit already awarded
      return;
    }
    console.error('[referral/credit] milestone credit insert error', creditErr.message);
    return;
  }

  // Mark the 3 oldest 'qualified' referrals for this referrer as 'rewarded'
  const { data: toReward, error: selectErr } = await supabaseAdmin
    .from('referrals')
    .select('id')
    .eq('referrer_user_id', referrerId)
    .eq('status', 'qualified')
    .order('qualified_at', { ascending: true })
    .limit(3);

  if (selectErr || !toReward?.length) {
    console.error('[referral/credit] toReward select error', selectErr?.message);
    return;
  }

  const { error: rewardErr } = await supabaseAdmin
    .from('referrals')
    .update({ status: 'rewarded', rewarded_at: now })
    .in('id', toReward.map((r) => r.id));

  if (rewardErr) {
    console.error('[referral/credit] reward update error', rewardErr.message);
    return;
  }

  console.log('[referral/credit] milestone awarded', {
    referrer: referrerId,
    triggerReferral: triggerReferralId,
    rewardedReferrals: toReward.map((r) => r.id),
  });
}
