import { creditUser } from './_lib/credit-user.js';

if (!process.env.PAYSTACK_SECRET_KEY) throw new Error('Missing env var: PAYSTACK_SECRET_KEY');

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

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
      console.warn('[verify-payment] Paystack verify failed', { reference, httpStatus: response.status });
      return res.status(400).json({ error: 'Payment could not be verified' });
    }

    const json = await response.json();
    paystackData = json.data;
  } catch (err) {
    console.error('[verify-payment] fetch error', { reference, message: err.message });
    return res.status(400).json({ error: 'Payment could not be verified' });
  }

  try {
    const result = await creditUser({
      reference,
      paystackAmountKobo: paystackData.amount,
      paystackStatus: paystackData.status,
      paystackCurrency: paystackData.currency,
      source: 'verify',
    });
    return res.status(200).json({ status: result.status, tier: result.tier });
  } catch (err) {
    if (err.code === 'KNOWN_REJECTION') {
      console.warn('[verify-payment] known rejection', { reference, reason: err.message });
      return res.status(400).json({ error: 'Payment could not be verified' });
    }
    console.error('[verify-payment] unexpected error', { reference, message: err.message });
    return res.status(500).json({ error: 'Internal error' });
  }
}
