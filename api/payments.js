import { supabaseAdmin } from './_lib/supabase-admin.js';
import { expectedAmountKobo } from './_lib/pricing.js';
import { creditUser } from './_lib/credit-user.js';
import nodemailer from 'nodemailer';

if (!process.env.PAYSTACK_SECRET_KEY) throw new Error('Missing env var: PAYSTACK_SECRET_KEY');

const PLAN_DISPLAY_NAMES = {
  student_pack:  'Student Pack',
  defense_pack:  'Defense Pack',
  project_reset: 'Project Reset',
};

async function sendReceiptEmail(toEmail, plan, amount, reference) {
  const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
      user: process.env.GMAIL_USER,
      pass: process.env.GMAIL_APP_PASSWORD
    }
  });

  const planDisplay = PLAN_DISPLAY_NAMES[plan] || plan;

  await transporter.sendMail({
    from: '"FYPro" <team.fypro@gmail.com>',
    to: toEmail,
    subject: `Your FYPro receipt — ${planDisplay}`,
    html: `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
  <div style="background-color: #0f172a; padding: 24px; border-radius: 8px 8px 0 0; text-align: center;">
    <img src="https://f-ypro-v2.vercel.app/fypro-logo.png" alt="FYPro" style="height: 40px;" />
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
    <a href="https://f-ypro-v2.vercel.app/dashboard"
       style="display: inline-block; background-color: #2563eb; color: white;
              padding: 14px 28px; border-radius: 8px; text-decoration: none;
              font-size: 16px; font-weight: bold; margin: 24px 0;">
      Go to my dashboard
    </a>
    <p style="color: #999; font-size: 13px; margin-top: 32px;">
      Keep this email as your receipt.<br>
      Questions? Reply to this email.<br>
      — The FYPro Team · fypro.vercel.app
    </p>
  </div>
</div>`
  });
}

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
          }
        }
      } catch (emailErr) {
        console.error('[payments/verify] receipt email failed', { reference, message: emailErr.message });
      }
    }

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
