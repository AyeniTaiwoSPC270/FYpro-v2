import crypto from 'crypto';
import { creditUser } from './_lib/credit-user.js';

export const config = { api: { bodyParser: false } };

if (!process.env.PAYSTACK_SECRET_KEY) throw new Error('Missing env var: PAYSTACK_SECRET_KEY');

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error('[webhook] failed to read raw body', err.message);
    return res.status(400).json({ error: 'Bad request' });
  }

  const signature = req.headers['x-paystack-signature'];
  if (!signature) {
    console.warn('[webhook] missing signature header from', req.headers['x-forwarded-for']);
    return res.status(400).json({ error: 'Missing signature' });
  }

  const computed = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  // Constant-time compare prevents timing attacks on the HMAC
  const sigBuf = Buffer.from(signature, 'hex');
  const compBuf = Buffer.from(computed, 'hex');
  if (sigBuf.length !== compBuf.length || !crypto.timingSafeEqual(sigBuf, compBuf)) {
    console.warn('[webhook] invalid signature from', req.headers['x-forwarded-for']);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  // Signature valid — safe to parse
  const event = JSON.parse(rawBody.toString('utf8'));

  switch (event.event) {
    case 'charge.success': {
      try {
        const result = await creditUser({
          reference: event.data.reference,
          paystackAmountKobo: event.data.amount,
          paystackStatus: event.data.status,
          paystackCurrency: event.data.currency,
          source: 'webhook',
        });
        return res.status(200).json({ received: true, status: result.status });
      } catch (err) {
        if (err.code === 'KNOWN_REJECTION') {
          // 200 prevents Paystack from retrying forever on a permanent rejection
          console.warn('[webhook] known rejection', { reference: event.data.reference, reason: err.message });
          return res.status(200).json({ received: true, rejected: err.message });
        }
        // 500 tells Paystack to retry — genuine transient failure
        console.error('[webhook] creditUser failed', { reference: event.data.reference, message: err.message });
        return res.status(500).json({ error: 'Internal error' });
      }
    }
    default:
      return res.status(200).json({ received: true, ignored: event.event });
  }
}
