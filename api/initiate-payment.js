import { supabaseAdmin } from './_lib/supabase-admin.js';
import { expectedAmountKobo } from './_lib/pricing.js';

function generateReference(userId) {
  const ts = Date.now();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FYP_${userId}_${ts}_${rand}`;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { tier, userId, email } = req.body || {};

  if (!tier || !userId || !email) {
    return res.status(400).json({ error: 'Missing required fields: tier, userId, email' });
  }

  let amountKobo;
  try {
    amountKobo = expectedAmountKobo(tier);
  } catch {
    return res.status(400).json({ error: `Unknown tier: ${tier}` });
  }

  const reference = generateReference(userId);

  const { error: insertError } = await supabaseAdmin
    .from('payments')
    .insert({
      user_id: userId,
      tier,
      amount_kobo: amountKobo,
      paystack_reference: reference,
      status: 'pending',
    });

  if (insertError) {
    console.error('[initiate-payment] insert failed', insertError.message);
    return res.status(500).json({ error: 'Failed to create payment record' });
  }

  return res.status(200).json({
    reference,
    amount_kobo: amountKobo,
    publicKey: process.env.PAYSTACK_PUBLIC_KEY,
  });
}
