import crypto, { randomBytes } from 'crypto';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { setCorsHeaders } from './_lib/cors.js';
import { expectedAmountKobo } from './_lib/pricing.js';
import { creditUser } from './_lib/credit-user.js';
import { sendTelegramAlert } from './_lib/telegram.js';
import { Resend } from 'resend';

// bodyParser disabled so the webhook handler can access the raw body for HMAC.
// Non-webhook actions parse the body manually below.
export const config = { api: { bodyParser: false } };

if (!process.env.PAYSTACK_SECRET_KEY) throw new Error('Missing env var: PAYSTACK_SECRET_KEY');

const resend = new Resend(process.env.RESEND_API_KEY);

const PLAN_DISPLAY_NAMES = {
  student_pack:  'Student Pack',
  defense_pack:  'Defense Pack',
  project_reset: 'Project Reset',
};

async function getRawBody(req) {
  const chunks = [];
  for await (const chunk of req) {
    chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  }
  return Buffer.concat(chunks);
}

async function sendReceiptEmail(toEmail, plan, amount, reference) {
  const planDisplay = PLAN_DISPLAY_NAMES[plan] || plan;

  await resend.emails.send({
    from: 'FYPro <hello@fypro.com.ng>',
    to: toEmail,
    subject: `Your FYPro receipt — ${planDisplay}`,
    html: `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
  <div style="background-color: #0f172a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
    <img src="https://fypro.com.ng/fypro-logo.png" alt="FYPro" style="height: 40px;" />
  </div>
  <div style="padding: 32px 24px;">
    <h2 style="color: #1a1a2e; font-size: 24px; margin-bottom: 8px;">Payment confirmed</h2>
    <p style="color: #555; font-size: 15px;">Your project journey just got serious.</p>
    <div style="background-color: #f8fafc; border-radius: 8px; padding: 20px; margin: 24px 0;">
      <p style="margin: 0 0 8px 0; color: #333; font-size: 14px;"><strong>Plan:</strong> ${planDisplay}</p>
      <p style="margin: 0 0 8px 0; color: #333; font-size: 14px;"><strong>Amount paid:</strong> ₦${amount}</p>
      <p style="margin: 0; color: #333; font-size: 14px;"><strong>Reference:</strong> ${reference}</p>
    </div>
    <p style="color: #333; font-size: 15px;">You now have full access. Log in to continue:</p>
    <a href="https://fypro.com.ng/dashboard"
       style="display: inline-block; background-color: #2563eb; color: white;
              padding: 14px 28px; border-radius: 8px; text-decoration: none;
              font-size: 16px; font-weight: bold; margin: 24px 0;">
      Go to my dashboard
    </a>
    <p style="color: #999; font-size: 13px; margin-top: 32px;">
      Keep this email as your receipt.<br>
      Questions? Reply to this email.<br>
      — The FYPro Team · fypro.com.ng
    </p>
  </div>
</div>`
  });
}

function generateReference(userId) {
  const rand = randomBytes(4).toString('hex').toUpperCase();
  return `FYP_${userId}_${Date.now()}_${rand}`;
}

// ─── Webhook ──────────────────────────────────────────────────────────────────

async function handleWebhook(req, res, rawBody) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const signature = req.headers['x-paystack-signature'];
  if (!signature) {
    console.warn('[webhook] missing signature header from', req.headers['x-forwarded-for']);
    return res.status(400).json({ error: 'Missing signature' });
  }

  const computed = crypto
    .createHmac('sha512', process.env.PAYSTACK_SECRET_KEY)
    .update(rawBody)
    .digest('hex');

  const sigBuf  = Buffer.from(signature, 'hex');
  const compBuf = Buffer.from(computed, 'hex');
  if (sigBuf.length !== compBuf.length || !crypto.timingSafeEqual(sigBuf, compBuf)) {
    console.warn('[webhook] invalid signature from', req.headers['x-forwarded-for']);
    return res.status(400).json({ error: 'Invalid signature' });
  }

  const event = JSON.parse(rawBody.toString('utf8'));

  switch (event.event) {
    case 'charge.success': {
      try {
        const result = await creditUser({
          reference:          event.data.reference,
          paystackAmountKobo: event.data.amount,
          paystackStatus:     event.data.status,
          paystackCurrency:   event.data.currency,
          source:             'webhook',
        });
        if (result.status === 'success') {
          const email     = event.data.customer?.email || 'unknown'
          const amountNGN = (event.data.amount / 100).toLocaleString('en-NG')
          const planName  = PLAN_DISPLAY_NAMES[result.tier] || result.tier
          sendTelegramAlert(`💰 Payment received: ${email} paid ₦${amountNGN} for ${planName}`)
        }
        return res.status(200).json({ received: true, status: result.status });
      } catch (err) {
        if (err.code === 'KNOWN_REJECTION') {
          const email = event.data.customer?.email || 'unknown'
          sendTelegramAlert(`❌ Payment failed: ${email} - ${err.message}`)
          console.warn('[webhook] known rejection', { reference: event.data.reference, reason: err.message });
          return res.status(200).json({ received: true, rejected: err.message });
        }
        console.error('[webhook] creditUser failed', { reference: event.data.reference, message: err.message });
        return res.status(500).json({ error: 'Internal error' });
      }
    }
    default:
      return res.status(200).json({ received: true, ignored: event.event });
  }
}

// ─── Payment actions ──────────────────────────────────────────────────────────

async function handleCheckStatus(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { reference } = req.query;
  if (!reference || typeof reference !== 'string') {
    return res.status(400).json({ error: 'Missing reference' });
  }

  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('status')
    .eq('paystack_reference', reference)
    .eq('user_id', user.id)
    .single();

  if (error || !data) return res.status(200).json({ status: 'not_found' });

  return res.status(200).json({
    status: data.status === 'success' ? 'success' : 'pending',
  });
}

async function handleInitiate(req, res) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { tier } = req.body || {};
    if (!tier) return res.status(400).json({ error: 'Missing required field: tier' });

    let amountKobo;
    try {
      amountKobo = expectedAmountKobo(tier);
    } catch {
      return res.status(400).json({ error: `Unknown tier: ${tier}` });
    }

    const reference = generateReference(user.id);

    const { error: insertError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id:            user.id,
        tier,
        amount_kobo:        amountKobo,
        paystack_reference: reference,
        status:             'pending',
      });

    if (insertError) {
      console.error('[payments/initiate] insert failed', insertError.message);
      return res.status(500).json({ error: 'Failed to create payment record' });
    }

    return res.status(200).json({
      reference,
      amount_kobo: amountKobo,
      email:       user.email,
      publicKey:   process.env.PAYSTACK_PUBLIC_KEY,
    });
  } catch (err) {
    console.error('[payments/initiate] error:', err);
    return res.status(500).json({ error: err.message });
  }
}

async function handleVerify(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

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

    if (result.status === 'success') {
      try {
        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('user_id, amount_kobo, tier')
          .eq('paystack_reference', reference)
          .single();

        if (payment) {
          const { data: user } = await supabaseAdmin
            .from('users')
            .select('email')
            .eq('id', payment.user_id)
            .single();

          if (user?.email) {
            const planName  = PLAN_DISPLAY_NAMES[payment.tier] || payment.tier;
            const amountNGN = payment.amount_kobo / 100;
            await sendReceiptEmail(user.email, planName, amountNGN, reference);
            sendTelegramAlert(`💰 Payment received: ${user.email} paid ₦${amountNGN.toLocaleString('en-NG')} for ${planName}`)
          }
        }
      } catch (emailErr) {
        console.error('[payments/verify] receipt email failed', { reference, message: emailErr.message });
      }
    }

    return res.status(200).json({ status: result.status, tier: result.tier });
  } catch (err) {
    if (err.code === 'KNOWN_REJECTION') {
      sendTelegramAlert(`❌ Payment failed: ${user.email} - ${err.message}`)
      console.warn('[payments/verify] known rejection', { reference, reason: err.message });
      return res.status(400).json({ error: 'Payment could not be verified' });
    }
    console.error('[payments/verify] unexpected error', { reference, message: err.message });
    return res.status(500).json({ error: 'Internal error' });
  }
}

// ─── Consume project_reset entitlement ───────────────────────────────────────

async function handleConsumeReset(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

  const { data: current, error: fetchErr } = await supabaseAdmin
    .from('user_entitlements')
    .select('paid_features')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) return res.status(500).json({ error: 'Failed to fetch entitlements' });

  const features = Array.isArray(current?.paid_features) ? current.paid_features : [];
  if (!features.includes('project_reset')) {
    return res.status(403).json({ error: 'No project_reset entitlement to consume' });
  }

  const updated = features.filter(f => f !== 'project_reset');

  const { error: updateErr } = await supabaseAdmin
    .from('user_entitlements')
    .update({ paid_features: updated, updated_at: new Date().toISOString() })
    .eq('user_id', user.id);

  if (updateErr) {
    console.error('[payments/consume-reset] update failed', updateErr.message);
    return res.status(500).json({ error: 'Failed to consume entitlement' });
  }

  return res.status(200).json({ success: true });
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  let rawBody;
  try {
    rawBody = await getRawBody(req);
  } catch (err) {
    console.error('[payments] failed to read body', err.message);
    return res.status(400).json({ error: 'Bad request' });
  }

  // Paystack webhook — detected by signature header, not action param
  if (req.headers['x-paystack-signature']) {
    return handleWebhook(req, res, rawBody);
  }

  // All other actions — parse body manually (bodyParser is disabled globally)
  if (rawBody.length > 0) {
    try {
      req.body = JSON.parse(rawBody.toString('utf8'));
    } catch {
      return res.status(400).json({ error: 'Invalid JSON body' });
    }
  } else {
    req.body = {};
  }

  const action = req.query.action || req.body.action;

  if (!action) return res.status(400).json({ error: 'Missing action parameter' });

  if (action === 'check-status') return handleCheckStatus(req, res);
  if (action === 'initiate') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    return handleInitiate(req, res);
  }
  if (action === 'verify') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    return handleVerify(req, res);
  }
  if (action === 'consume-reset') return handleConsumeReset(req, res);

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
