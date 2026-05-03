import { supabaseAdmin } from './supabase-admin.js';
import { expectedAmountKobo } from './pricing.js';

export async function creditUser({ reference, paystackAmountKobo, paystackStatus, paystackCurrency, source }) {
  // 1. Look up payment row by reference
  const { data: payment, error: lookupErr } = await supabaseAdmin
    .from('payments')
    .select('id, user_id, project_id, tier, amount_kobo, status, webhook_verified_at')
    .eq('paystack_reference', reference)
    .single();

  if (lookupErr || !payment) {
    const e = new Error('Unknown reference: ' + reference);
    e.code = 'KNOWN_REJECTION';
    throw e;
  }

  // 2. Idempotency: already fully processed
  if (payment.status === 'success' && payment.webhook_verified_at) {
    console.log('[creditUser] already processed', { reference, source });
    return { status: 'already_processed', reference };
  }

  // 3. Paystack status must be 'success'
  if (paystackStatus !== 'success') {
    await supabaseAdmin
      .from('payments')
      .update({ status: 'failed' })
      .eq('paystack_reference', reference);
    const e = new Error('Paystack status not success: ' + paystackStatus);
    e.code = 'KNOWN_REJECTION';
    throw e;
  }

  // 4. Currency must be NGN
  if (paystackCurrency !== 'NGN') {
    const e = new Error('Unexpected currency: ' + paystackCurrency);
    e.code = 'KNOWN_REJECTION';
    throw e;
  }

  // 5. Amount lock — amount paid must match the price for this tier
  const expected = expectedAmountKobo(payment.tier);
  if (paystackAmountKobo !== expected) {
    console.error('[creditUser] AMOUNT MISMATCH', {
      reference,
      tier: payment.tier,
      expected,
      received: paystackAmountKobo,
    });
    await supabaseAdmin
      .from('payments')
      .update({ status: 'failed' })
      .eq('paystack_reference', reference);
    const e = new Error(`Amount mismatch: expected ${expected}, got ${paystackAmountKobo}`);
    e.code = 'KNOWN_REJECTION';
    throw e;
  }

  // 6. Mark payment success — .eq('status', 'pending') is the race-condition guard:
  // if two concurrent calls both pass the idempotency check above, only one UPDATE
  // will match 'pending'; the loser gets back an empty array and must not credit.
  const { data: updated } = await supabaseAdmin
    .from('payments')
    .update({
      status: 'success',
      webhook_verified_at: new Date().toISOString(),
    })
    .eq('paystack_reference', reference)
    .eq('status', 'pending')
    .select('id');

  if (!updated || updated.length === 0) {
    console.log('[creditUser] lost race — already processed by concurrent call', { reference, source });
    return { status: 'already_processed', reference };
  }

  // 7. Grant entitlement
  await grantEntitlement(payment.user_id, payment.tier, payment.amount_kobo);

  return { status: 'success', reference, tier: payment.tier };
}

async function grantEntitlement(userId, tier, amountKobo) {
  const { data: current } = await supabaseAdmin
    .from('user_entitlements')
    .select('paid_features, defense_packs_remaining, total_lifetime_paid_ngn')
    .eq('user_id', userId)
    .single();

  const features = new Set(current?.paid_features || []);
  let defensePacks = current?.defense_packs_remaining || 0;

  if (tier === 'student_pack') features.add('student_pack');
  if (tier === 'defense_pack') {
    features.add('defense_pack');
    defensePacks += 1;
  }
  if (tier === 'project_reset') features.add('project_reset');

  await supabaseAdmin
    .from('user_entitlements')
    .update({
      paid_features: Array.from(features),
      defense_packs_remaining: defensePacks,
      total_lifetime_paid_ngn: (current?.total_lifetime_paid_ngn || 0) + Math.floor(amountKobo / 100),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', userId);
}
