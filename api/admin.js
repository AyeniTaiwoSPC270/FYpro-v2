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

// action: "dashboard" — comprehensive admin analytics
async function handleDashboard(req, res) {
  // Server-side admin gate: verify JWT and check email
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !caller) return res.status(401).json({ error: 'Unauthorized' });
    if (!process.env.ADMIN_EMAIL || caller.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden' });
    }
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const now  = Date.now();
    const MS7  = 7  * 24 * 60 * 60 * 1000;
    const MS30 = 30 * 24 * 60 * 60 * 1000;
    const MS3  =  3 * 24 * 60 * 60 * 1000;

    const today           = new Date(now).toISOString().slice(0, 10);
    const todayStart      = `${today}T00:00:00.000Z`;
    const weekAgoISO      = new Date(now - MS7).toISOString();
    const threeDaysAgoISO = new Date(now - MS3).toISOString();

    // run_counts live in user_entitlements, not projects — fetch both
    const [authRes, paymentsRes, projectsRes, entitlementsRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 }),
      supabaseAdmin.from('payments').select('user_id, amount_kobo, status, created_at, tier').eq('status', 'success'),
      supabaseAdmin.from('projects').select('user_id, created_at'),
      supabaseAdmin.from('user_entitlements').select('user_id, run_counts'),
    ]);

    const authUsers    = authRes.data?.users || [];
    const payments     = paymentsRes.data    || [];
    const projects     = projectsRes.data    || [];
    const entitlements = entitlementsRes.data || [];

    // build userId → run_counts map from entitlements
    const runCountsByUser = {};
    for (const ent of entitlements) {
      if (ent.run_counts && typeof ent.run_counts === 'object') {
        runCountsByUser[ent.user_id] = ent.run_counts;
      }
    }

    // ── Overview ──────────────────────────────────────────────────
    const totalUsers     = authUsers.length;
    const activeToday    = authUsers.filter(u => u.last_sign_in_at >= todayStart).length;
    const activeThisWeek = authUsers.filter(u => u.last_sign_in_at >= weekAgoISO).length;

    const paidByUser = {};
    let   totalRevNgn = 0;
    for (const p of payments) {
      const ngn = Math.round((p.amount_kobo || 0) / 100);
      totalRevNgn += ngn;
      if (!paidByUser[p.user_id]) paidByUser[p.user_id] = { totalNgn: 0, tiers: [] };
      paidByUser[p.user_id].totalNgn += ngn;
      paidByUser[p.user_id].tiers.push(p.tier);
    }

    const paidUserIds    = new Set(Object.keys(paidByUser));
    const totalPaid      = paidUserIds.size;
    const conversionRate = totalUsers > 0 ? ((totalPaid / totalUsers) * 100).toFixed(1) : '0.0';

    const projCountByUser = {};
    for (const p of projects) {
      projCountByUser[p.user_id] = (projCountByUser[p.user_id] || 0) + 1;
    }

    // ── Users Table ───────────────────────────────────────────────
    const users = authUsers.map(u => {
      const paid      = paidByUser[u.id];
      const projCount = projCountByUser[u.id] || 0;
      const lastActive = u.last_sign_in_at;

      let plan = 'Free';
      if (paid) {
        plan = paid.tiers.includes('defense_pack') ? 'Defense' : 'Student';
      }

      let status = 'never_used';
      if (projCount > 0 && lastActive) {
        const daysSince = (now - new Date(lastActive).getTime()) / 86400000;
        if      (daysSince <= 7)  status = 'active';
        else if (daysSince <= 30) status = 'inactive';
        else                      status = 'churned';
      }

      return {
        id:            u.id,
        email:         u.email || '',
        signup_date:   u.created_at,
        last_active:   lastActive || null,
        plan,
        project_count: projCount,
        status,
        paid_amount:   paid?.totalNgn || 0,
      };
    });

    // ── Revenue Chart (last 30 days) ──────────────────────────────
    const revByDay = {};
    for (let i = 29; i >= 0; i--) {
      revByDay[new Date(now - i * 86400000).toISOString().slice(0, 10)] = 0;
    }
    for (const p of payments) {
      const day = p.created_at?.slice(0, 10);
      if (day && day in revByDay) revByDay[day] += Math.round((p.amount_kobo || 0) / 100);
    }
    const revenueChart = Object.entries(revByDay).map(([date, amount]) => ({ date, amount }));

    // ── Signups Chart (last 30 days) ──────────────────────────────
    const sigByDay = {};
    for (let i = 29; i >= 0; i--) {
      sigByDay[new Date(now - i * 86400000).toISOString().slice(0, 10)] = 0;
    }
    for (const u of authUsers) {
      const day = u.created_at?.slice(0, 10);
      if (day && day in sigByDay) sigByDay[day]++;
    }
    const signupsChart = Object.entries(sigByDay).map(([date, count]) => ({ date, count }));

    // ── Feature Usage — read from user_entitlements.run_counts ────
    const FEATURE_KEYS = [
      'topic_validator', 'chapter_architect', 'methodology_advisor',
      'writing_planner', 'literature_map', 'abstract_generator',
      'instrument_builder', 'project_reviewer', 'defense_simulator',
      'supervisor_meeting_prep',
    ];
    const featureTotals = Object.fromEntries(FEATURE_KEYS.map(k => [k, 0]));
    for (const rc of Object.values(runCountsByUser)) {
      for (const k of FEATURE_KEYS) featureTotals[k] += (rc[k] || 0);
    }
    const featureUsage = FEATURE_KEYS
      .map(k => ({ feature: k, count: featureTotals[k] }))
      .sort((a, b) => b.count - a.count);

    // ── Drop-off Funnel ───────────────────────────────────────────
    const FUNNEL_STEPS = [
      'topic_validator', 'chapter_architect', 'methodology_advisor',
      'writing_planner', 'defense_simulator',
    ];
    const stepUsers = Object.fromEntries(FUNNEL_STEPS.map(s => [s, new Set()]));
    for (const [userId, rc] of Object.entries(runCountsByUser)) {
      for (const s of FUNNEL_STEPS) {
        if ((rc[s] || 0) > 0) stepUsers[s].add(userId);
      }
    }
    const funnel = FUNNEL_STEPS.map((step, i) => {
      const count      = stepUsers[step].size;
      const prevCount  = i > 0 ? stepUsers[FUNNEL_STEPS[i - 1]].size : count;
      const dropoffPct = prevCount > 0 ? (((prevCount - count) / prevCount) * 100).toFixed(1) : '0.0';
      const pctOfTotal = totalUsers > 0 ? ((count / totalUsers) * 100).toFixed(1) : '0.0';
      return { step, count, dropoff_pct: dropoffPct, pct_of_total: pctOfTotal };
    });

    // ── Never Converted ───────────────────────────────────────────
    const neverConverted = authUsers
      .filter(u =>
        u.created_at < threeDaysAgoISO &&
        !paidUserIds.has(u.id) &&
        (projCountByUser[u.id] || 0) > 0
      )
      .map(u => {
        const rc = runCountsByUser[u.id] || {};
        const stepsUsed = FEATURE_KEYS.filter(k => (rc[k] || 0) > 0);
        return {
          id:              u.id,
          email:           u.email || '',
          signup_date:     u.created_at,
          last_active:     u.last_sign_in_at || null,
          steps_completed: stepsUsed.length,
        };
      });

    return res.status(200).json({
      overview: {
        total_users:       totalUsers,
        active_today:      activeToday,
        active_this_week:  activeThisWeek,
        total_paid:        totalPaid,
        total_revenue_ngn: totalRevNgn,
        conversion_rate:   conversionRate,
      },
      users,
      revenue_chart:   revenueChart,
      signups_chart:   signupsChart,
      feature_usage:   featureUsage,
      funnel,
      never_converted: neverConverted,
    });

  } catch (err) {
    console.error('[admin/dashboard] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// Shared admin JWT gate — returns the caller user or sends a 401/403 response.
// Returns null when it has already sent a response (caller must return immediately).
async function verifyAdmin(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) { res.status(401).json({ error: 'Unauthorized' }); return null; }
  try {
    const { data: { user: caller }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !caller) { res.status(401).json({ error: 'Unauthorized' }); return null; }
    if (!process.env.ADMIN_EMAIL || caller.email !== process.env.ADMIN_EMAIL) {
      res.status(403).json({ error: 'Forbidden' }); return null;
    }
    return caller;
  } catch {
    res.status(401).json({ error: 'Unauthorized' }); return null;
  }
}

// action: "delete-user"
// SQL required (run once):
//   -- no extra migration needed; deletes cascade via FK if set, otherwise manual
async function handleDeleteUser(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    await supabaseAdmin.from('project_steps').delete().eq('user_id', userId);
    await supabaseAdmin.from('defense_sessions').delete().eq('user_id', userId);
    await supabaseAdmin.from('projects').delete().eq('user_id', userId);
    await supabaseAdmin.from('user_entitlements').delete().eq('user_id', userId);
    await supabaseAdmin.from('users').delete().eq('id', userId);
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/delete-user]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "ban-user"
// SQL required (run once in Supabase SQL Editor):
//   ALTER TABLE user_entitlements
//   ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ DEFAULT NULL;
async function handleBanUser(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert({
        user_id: userId,
        banned_until: '2099-01-01T00:00:00.000Z',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/ban-user]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action;

  if (action === 'health')       return handleHealth(req, res);
  if (action === 'alert-check')  return handleAlertCheck(req, res);
  if (action === 'dashboard')    return handleDashboard(req, res);
  if (action === 'delete-user')  return handleDeleteUser(req, res);
  if (action === 'ban-user')     return handleBanUser(req, res);

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
