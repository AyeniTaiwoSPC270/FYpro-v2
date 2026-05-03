import { supabaseAdmin } from '../_lib/supabase-admin.js';

// Called hourly by Vercel cron. Logs a console.error when spend crosses 80% of daily cap.
// TODO (Week 5): replace console.error with Resend API email to ADMIN_EMAIL.
// POST to https://api.resend.com/emails with RESEND_API_KEY in env vars.

const handler = async (req, res) => {
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const today = new Date().toISOString().slice(0, 10);
    const cap = parseFloat(process.env.DAILY_CAP_USD || '10');
    const threshold = cap * 0.8;

    const { data, error } = await supabaseAdmin
      .from('daily_usage')
      .select('total_cost_usd, request_count')
      .eq('date', today)
      .maybeSingle();

    if (error) throw error;

    const spent = parseFloat(data?.total_cost_usd || 0);
    const alertTriggered = spent >= threshold;

    if (alertTriggered) {
      const pct = ((spent / cap) * 100).toFixed(1);
      console.error(
        `[alert-check] SPEND ALERT — $${spent.toFixed(4)} of $${cap.toFixed(2)} cap used (${pct}%). ` +
        `Requests: ${data?.request_count || 0}. Admin: ${process.env.ADMIN_EMAIL}`
      );
    }

    return res.status(200).json({
      checked:         true,
      spent_usd:       spent,
      cap_usd:         cap,
      threshold_usd:   threshold,
      alert_triggered: alertTriggered,
    });
  } catch (err) {
    console.error('[alert-check] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

export default handler;
