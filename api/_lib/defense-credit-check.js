// Defense session credit check — imported by the defense API endpoint.
// Call checkAndConsumeDefenseAccess(userId) before creating a defense session.
// Returns { access: 'pack' | 'credit' | 'none', creditId?: string }

import { supabaseAdmin } from './supabase-admin.js';

/**
 * @param {string} userId
 * @returns {Promise<{ access: 'pack' | 'credit' | 'none', creditId?: string }>}
 */
export async function checkAndConsumeDefenseAccess(userId) {
  // 1. Check paid_features — unlimited if defense_pack is present
  const { data: entitlements } = await supabaseAdmin
    .from('user_entitlements')
    .select('paid_features')
    .eq('user_id', userId)
    .maybeSingle();

  const features = Array.isArray(entitlements?.paid_features)
    ? entitlements.paid_features
    : [];

  if (features.includes('defense_pack')) {
    return { access: 'pack' };
  }

  // 2. Check for an unconsumed referral credit
  const { data: credit } = await supabaseAdmin
    .from('defense_credits')
    .select('id')
    .eq('user_id', userId)
    .eq('consumed', false)
    .limit(1)
    .maybeSingle();

  if (!credit) {
    return { access: 'none' };
  }

  // 3. Consume the credit atomically — .eq('consumed', false) is the race guard
  const { data: consumed } = await supabaseAdmin
    .from('defense_credits')
    .update({ consumed: true, consumed_at: new Date().toISOString() })
    .eq('id', credit.id)
    .eq('consumed', false)
    .select('id');

  if (!consumed?.length) {
    // Lost the race to a concurrent call — try to find another credit
    const { data: retry } = await supabaseAdmin
      .from('defense_credits')
      .select('id')
      .eq('user_id', userId)
      .eq('consumed', false)
      .limit(1)
      .maybeSingle();

    if (!retry) return { access: 'none' };

    const { data: retryConsumed } = await supabaseAdmin
      .from('defense_credits')
      .update({ consumed: true, consumed_at: new Date().toISOString() })
      .eq('id', retry.id)
      .eq('consumed', false)
      .select('id');

    if (!retryConsumed?.length) return { access: 'none' };

    return { access: 'credit', creditId: retry.id };
  }

  return { access: 'credit', creditId: credit.id };
}
