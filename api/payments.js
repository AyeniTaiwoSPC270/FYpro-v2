import { supabaseAdmin } from './_lib/supabase-admin.js';
import { expectedAmountKobo } from './_lib/pricing.js';
import { creditUser } from './_lib/credit-user.js';

if (!process.env.PAYSTACK_SECRET_KEY) throw new Error('Missing env var: PAYSTACK_SECRET_KEY');

function generateReference(userId) {
  const ts   = Date.now();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `FYP_${userId}_${ts}_${rand}`;
}

// action: "check-status" — reads reference from query string
async function handleCheckStatus(req, res) {
  const { reference } = req.query;
  if (!reference || typeof reference !== 'string') {
    return res.status(400).json({ error: 'Missing reference' });
  }

  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('status')
    .eq('paystack_reference', reference)
    .single();

  if (error || !data) {
    return res.status(200).json({ status: 'not_found' });
  }

  return res.status(200).json({
    status: data.status === 'success' ? 'success' : 'pending',
  });
}

// action: "initiate" — reads tier/userId/email from body
async function handleInitiate(req, res) {
  try {
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
        user_id:             userId,
        tier,
        amount_kobo:         amountKobo,
        paystack_reference:  reference,
        status:              'pending',
      });

    if (insertError) {
      console.error('[payments/initiate] insert failed', insertError.message);
      return res.status(500).json({ error: 'Failed to create payment record' });
    }

    return res.status(200).json({
      reference,
      amount_kobo: amountKobo,
      publicKey:   process.env.PAYSTACK_PUBLIC_KEY,
    });
  } catch (err) {
    console.error('[payments/initiate] error:', err);
    return res.status(500).json({ error: err.message });
  }
}

// action: "verify" — reads reference from body
async function handleVerify(req, res) {
  const { reference } = req.body || {};
  if (!reference || typeof reference !== 'string' || !reference.trim()) {
    return res.status(400).json({ error: 'Missing or invalid reference' });
  }

  let paystackData;
  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      { headers: { Authorization: 'Bearer ' + process.env.PAYSTACK_SECRET_KEY } }
    );

    if (!response.ok || response.status === 404) {
      console.warn('[payments/verify] Paystack verify failed', { reference, httpStatus: response.status });
      return res.status(400).json({ error: 'Payment could not be verified' });
    }

    const json = await response.json();
    paystackData = json.data;
  } catch (err) {
    console.error('[payments/verify] fetch error', { reference, message: err.message });
    return res.status(400).json({ error: 'Payment could not be verified' });
  }

  try {
    const result = await creditUser({
      reference,
      paystackAmountKobo: paystackData.amount,
      paystackStatus:     paystackData.status,
      paystackCurrency:   paystackData.currency,
      source:             'verify',
    });
    return res.status(200).json({ status: result.status, tier: result.tier });
  } catch (err) {
    if (err.code === 'KNOWN_REJECTION') {
      console.warn('[payments/verify] known rejection', { reference, reason: err.message });
      return res.status(400).json({ error: 'Payment could not be verified' });
    }
    console.error('[payments/verify] unexpected error', { reference, message: err.message });
    return res.status(500).json({ error: 'Internal error' });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const action = req.query.action || (req.body && req.body.action);

  if (!action) {
    return res.status(400).json({ error: 'Missing action parameter' });
  }

  if (action === 'check-status') {
    return handleCheckStatus(req, res);
  }
  if (action === 'initiate') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    return handleInitiate(req, res);
  }
  if (action === 'verify') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    return handleVerify(req, res);
  }

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
