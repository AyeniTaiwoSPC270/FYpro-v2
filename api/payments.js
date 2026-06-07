import crypto, { randomBytes } from 'crypto';
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { setCorsHeaders } from './_lib/cors.js';
import { expectedAmountKobo } from './_lib/pricing.js';
import { creditUser } from './_lib/credit-user.js';
import { sendTelegramAlert, sendTelegramAlertOnce } from './_lib/telegram.js';
import { rateLimitCheck } from './_lib/rate-limit.js';
import { Resend } from 'resend';

// bodyParser disabled so the webhook handler can access the raw body for HMAC.
// Non-webhook actions parse the body manually below.
export const config = { maxDuration: 60, api: { bodyParser: false } };

if (!process.env.PAYSTACK_SECRET_KEY) throw new Error('Missing env var: PAYSTACK_SECRET_KEY');

const resend = new Resend(process.env.RESEND_API_KEY);

const PLAN_DISPLAY_NAMES = {
  student_pack:          'Student Pack',
  defense_pack:          'Defense Pack',
  defense_pack_upgrade:  'Defense Pack (Upgrade)',
  project_reset:         'Project Reset',
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
    html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background-color:#060E18;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="height:3px;background-color:#D97706;border-radius:8px 8px 0 0;"></div>
  <div style="background:linear-gradient(160deg,#0D1B2A 0%,#0a1520 100%);padding:20px 22px;text-align:center;">
    <img src="https://fypro.com.ng/fypro-logo.png" alt="FYPro" height="40" style="display:block;margin:0 auto;" />
  </div>
  <div style="background-color:#0D1B2A;padding:22px 22px 20px;border-radius:0 0 8px 8px;border:1px solid rgba(255,255,255,0.06);border-top:none;">
    <div style="display:inline-block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;border-radius:4px;padding:3px 8px;margin-bottom:14px;border:1px solid rgba(217,119,6,0.3);background:rgba(217,119,6,0.08);color:#F59E0B;">Payment Confirmed</div>
    <h1 style="font-size:17px;font-weight:700;color:#f8fafc;line-height:1.35;margin:0 0 16px;">Your FYPro access is unlocked.</h1>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:14px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="font-size:12px;color:rgba(255,255,255,0.35);">Plan</span><span style="font-size:12px;color:rgba(255,255,255,0.75);font-weight:600;">${planDisplay}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="font-size:12px;color:rgba(255,255,255,0.35);">Amount paid</span><span style="font-size:12px;color:#F59E0B;font-weight:600;">&#x20A6;${amount}</span></div>
      <div style="display:flex;justify-content:space-between;"><span style="font-size:12px;color:rgba(255,255,255,0.35);">Reference</span><span style="font-size:11px;color:rgba(255,255,255,0.6);font-family:monospace;">${reference}</span></div>
    </div>
    <p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.75;margin:0 0 16px;">You now have full access. Log in to continue.</p>
    <a href="https://fypro.com.ng/dashboard" style="display:inline-block;background-color:#D97706;color:#ffffff;border-radius:8px;padding:11px 20px;font-size:13px;font-weight:700;text-decoration:none;">Go to my dashboard &#8594;</a>
    <div style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:18px 0 14px;"></div>
    <p style="font-size:10.5px;color:rgba(255,255,255,0.2);line-height:1.6;margin:0;">Keep this email as your receipt.<br>FYPro &middot; Lagos, Nigeria &middot; <a href="mailto:hello@fypro.com.ng" style="color:rgba(255,255,255,0.3);">hello@fypro.com.ng</a></p>
  </div>
</div>
</body></html>`
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

  let event;
  try {
    event = JSON.parse(rawBody.toString('utf8'));
  } catch (parseErr) {
    console.warn('[webhook] malformed JSON body from Paystack:', parseErr.message);
    return res.status(400).json({ error: 'Invalid request body' });
  }

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
          await sendTelegramAlertOnce(`💰 Payment received: ${email} paid ₦${amountNGN} for ${planName}`, `tg:payment:${event.data.reference}`)
        }
        return res.status(200).json({ received: true, status: result.status });
      } catch (err) {
        if (err.code === 'KNOWN_REJECTION') {
          const email = event.data.customer?.email || 'unknown'
          await sendTelegramAlert(`❌ Payment failed: ${email} - ${err.message}`)
          console.warn('[webhook] known rejection', { reference: event.data.reference, reason: err.message });
          return res.status(200).json({ received: true, rejected: err.message });
        }
        console.error('[webhook] creditUser failed', { reference: event.data.reference, message: err.message });
        await sendTelegramAlert(`🚨 PAYMENT PROCESSING FAILED: ${event.data.customer?.email || 'unknown'} paid but entitlement not granted.\nRef: ${event.data.reference}\nError: ${err.message}\nManual fix required.`);
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

  let authResult, rl;
  try {
    [authResult, rl] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      rateLimitCheck(req, { userDay: 120, ipDay: 300, prefix: 'pay_status' }).catch(() => ({ allowed: true, reason: '' })),
    ]);
  } catch {
    return res.status(503).json({ error: 'Service unavailable. Please try again.' });
  }
  const { data: { user } = {}, error: authError } = authResult;
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

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

  if (error || !data) return res.status(404).json({ status: 'not_found' });

  return res.status(200).json({
    status: data.status === 'success' ? 'success' : 'pending',
  });
}

async function handleInitiate(req, res) {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    let authResult, rl;
    try {
      [authResult, rl] = await Promise.all([
        supabaseAdmin.auth.getUser(token),
        rateLimitCheck(req, { userDay: 10, ipDay: 30, prefix: 'pay_initiate' }).catch(() => ({ allowed: true, reason: '' })),
      ]);
    } catch {
      return res.status(503).json({ error: 'Service unavailable. Please try again.' });
    }
    const { data: { user } = {}, error: authError } = authResult;
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });
    if (!rl.allowed) return res.status(429).json({ error: rl.reason });

    const { tier } = req.body || {};
    if (!tier) return res.status(400).json({ error: 'Missing required field: tier' });

    // Detect upgrade: Student Plan holders buying Defense Pack pay ₦1,500 (the difference)
    let effectiveTier = tier;
    if (tier === 'defense_pack') {
      const { data: entitlements } = await supabaseAdmin
        .from('user_entitlements')
        .select('paid_features')
        .eq('user_id', user.id)
        .maybeSingle();
      const features = Array.isArray(entitlements?.paid_features) ? entitlements.paid_features : [];
      if (features.includes('student_pack') && !features.includes('defense_pack')) {
        effectiveTier = 'defense_pack_upgrade';
      }
    }

    let amountKobo;
    try {
      amountKobo = expectedAmountKobo(effectiveTier);
    } catch {
      console.error('[payments/initiate] unknown tier:', effectiveTier);
      return res.status(400).json({ error: 'Invalid payment tier.' });
    }

    const reference = generateReference(user.id);

    const { error: insertError } = await supabaseAdmin
      .from('payments')
      .insert({
        user_id:            user.id,
        tier:               effectiveTier,
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
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
}

async function handleVerify(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let authResult, rl;
  try {
    [authResult, rl] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      rateLimitCheck(req, { userDay: 10, ipDay: 30, prefix: 'pay_verify' }).catch(() => ({ allowed: true, reason: '' })),
    ]);
  } catch {
    return res.status(503).json({ error: 'Service unavailable. Please try again.' });
  }
  const { data: { user } = {}, error: authError } = authResult;
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

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
      // user.email comes from the auth check earlier in handleVerify — no extra queries needed
      try {
        const { data: payment } = await supabaseAdmin
          .from('payments')
          .select('amount_kobo, tier')
          .eq('paystack_reference', reference)
          .single();

        if (payment && user.email) {
          const planName  = PLAN_DISPLAY_NAMES[payment.tier] || payment.tier;
          const amountNGN = payment.amount_kobo / 100;
          await Promise.all([
            sendReceiptEmail(user.email, planName, amountNGN, reference),
            sendTelegramAlertOnce(
              `💰 Payment received: ${user.email} paid ₦${amountNGN.toLocaleString('en-NG')} for ${planName}`,
              `tg:payment:${reference}`
            ),
          ]);
        }
      } catch (emailErr) {
        console.error('[payments/verify] receipt email failed', { reference, message: emailErr.message });
      }
    }

    return res.status(200).json({ status: result.status, tier: result.tier });
  } catch (err) {
    if (err.code === 'KNOWN_REJECTION') {
      await sendTelegramAlert(`❌ Payment failed: ${user.email} - ${err.message}`)
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

  let authResult, rl;
  try {
    [authResult, rl] = await Promise.all([
      supabaseAdmin.auth.getUser(token),
      rateLimitCheck(req, { userDay: 5, ipDay: 20, prefix: 'pay_consume' }).catch(() => ({ allowed: true, reason: '' })),
    ]);
  } catch {
    return res.status(503).json({ error: 'Service unavailable. Please try again.' });
  }
  const { data: { user } = {}, error: authError } = authResult;
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

  const { data: current, error: fetchErr } = await supabaseAdmin
    .from('user_entitlements')
    .select('paid_features')
    .eq('user_id', user.id)
    .maybeSingle();

  if (fetchErr) return res.status(500).json({ error: 'Failed to fetch entitlements' });

  const features = Array.isArray(current?.paid_features) ? current.paid_features : [];
  if (!features.includes('project_reset')) {
    // Defense Pack users with zero existing projects don't need a paid reset slot
    if (features.includes('defense_pack')) {
      const { count } = await supabaseAdmin
        .from('projects')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      if (count === 0) return res.status(200).json({ success: true });
    }
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
