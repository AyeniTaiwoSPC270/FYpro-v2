import { supabaseAdmin } from './_lib/supabase-admin.js';

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function readCacheHits() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return 0;
  try {
    const res  = await fetch(`${UPSTASH_URL}/get/stats:cache_hits`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    });
    const json = await res.json();
    return parseInt(json.result || '0', 10);
  } catch {
    return 0;
  }
}

// action: "health"
async function handleHealth(req, res) {
  try {
    const today      = new Date().toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00.000Z`;
    const weekAgo    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const cap        = parseFloat(process.env.DAILY_CAP_USD || '10');

    const [usageRes, paymentsRes, signupsTodayRes, signupsWeekRes, cacheHits] = await Promise.all([
      supabaseAdmin
        .from('daily_usage')
        .select('total_cost_usd, request_count, total_tokens_in, total_tokens_out')
        .eq('date', today)
        .maybeSingle(),

      supabaseAdmin
        .from('payments')
        .select('amount_kobo')
        .eq('status', 'success')
        .gte('created_at', todayStart),

      supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart),

      supabaseAdmin
        .from('users')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', weekAgo),

      readCacheHits(),
    ]);

    const usage           = usageRes.data;
    const payments        = paymentsRes.data || [];
    const totalRevenueNgn = payments.reduce((sum, p) => sum + Math.round((p.amount_kobo || 0) / 100), 0);

    return res.status(200).json({
      status: 'ok',
      date:   today,
      usage: {
        spent_usd:     parseFloat(usage?.total_cost_usd || 0),
        cap_usd:       cap,
        request_count: usage?.request_count    || 0,
        tokens_in:     usage?.total_tokens_in  || 0,
        tokens_out:    usage?.total_tokens_out || 0,
      },
      payments: {
        success_count_today: payments.length,
        total_revenue_ngn:   totalRevenueNgn,
      },
      signups: {
        count_today:     signupsTodayRes.count || 0,
        count_this_week: signupsWeekRes.count  || 0,
      },
      cache: {
        hits_total: cacheHits,
      },
    });
  } catch (err) {
    console.error('[admin/health] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "alert-check"
// Called hourly by external cron. Logs a console.error when spend crosses 80% of daily cap.
// TODO (Week 5): replace console.error with Resend API email to ADMIN_EMAIL.
async function handleAlertCheck(req, res) {
  try {
    const today     = new Date().toISOString().slice(0, 10);
    const cap       = parseFloat(process.env.DAILY_CAP_USD || '10');
    const threshold = cap * 0.8;

    const { data, error } = await supabaseAdmin
      .from('daily_usage')
      .select('total_cost_usd, request_count')
      .eq('date', today)
      .maybeSingle();

    if (error) throw error;

    const spent          = parseFloat(data?.total_cost_usd || 0);
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
    console.error('[admin/alert-check] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action;

  if (action === 'health')       return handleHealth(req, res);
  if (action === 'alert-check')  return handleAlertCheck(req, res);

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
