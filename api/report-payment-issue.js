import { supabaseAdmin }  from './_lib/supabase-admin.js';
import { rateLimitCheck } from './_lib/rate-limit.js';
import { Resend }         from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit: 3 reports per user per day, 10 per IP per day
  const rl = await rateLimitCheck(req, { userDay: 3, ipDay: 10, prefix: 'payment-issue' });
  if (!rl.allowed) return res.status(429).json({ error: 'Too many reports. Please try again tomorrow or email hello@fypro.com.ng directly.' });

  // Verify JWT
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let userId, userEmail;
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Unauthorized' });
    userId    = user.id;
    userEmail = user.email;
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { transactionRef, description } = req.body || {};
  if (!transactionRef?.trim()) {
    return res.status(400).json({ error: 'Transaction reference is required.' });
  }

  // Insert into payment_issues
  const { error: insertError } = await supabaseAdmin.from('payment_issues').insert({
    user_id:         userId,
    user_email:      userEmail,
    transaction_ref: transactionRef.trim(),
    description:     description?.trim() || null,
  });

  if (insertError) {
    console.error('[report-payment-issue] insert error:', insertError.message);
    return res.status(500).json({ error: 'Failed to save report. Please email hello@fypro.com.ng directly.' });
  }

  // Send alert email to admin — fire and forget
  resend.emails.send({
    from:    'FYPro Alerts <hello@fypro.com.ng>',
    to:      'hello@fypro.com.ng',
    subject: `URGENT: Payment issue — ${userEmail}`,
    html: `
<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;">
  <h2 style="color:#DC2626;">⚠️ Payment Issue Report</h2>
  <table style="width:100%;border-collapse:collapse;">
    <tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>User email:</strong></td><td style="padding:8px 0;font-size:14px;">${userEmail}</td></tr>
    <tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>User ID:</strong></td><td style="padding:8px 0;font-size:14px;font-family:monospace;">${userId}</td></tr>
    <tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>Transaction ref:</strong></td><td style="padding:8px 0;font-size:14px;font-family:monospace;">${transactionRef.trim()}</td></tr>
    <tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>Description:</strong></td><td style="padding:8px 0;font-size:14px;">${description?.trim() || '(none)'}</td></tr>
    <tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>Reported at:</strong></td><td style="padding:8px 0;font-size:14px;">${new Date().toISOString()}</td></tr>
  </table>
  <p style="margin-top:24px;color:#333;font-size:14px;">Resolve in the <a href="https://fypro.vercel.app/admin/health">admin dashboard</a>.</p>
</div>`,
  }).catch(e => console.error('[report-payment-issue] resend error:', e.message));

  return res.status(200).json({ ok: true });
}
