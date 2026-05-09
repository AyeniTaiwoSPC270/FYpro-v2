import crypto           from 'crypto';
import { Resend }         from 'resend';
import { supabaseAdmin }  from './_lib/supabase-admin.js';
import { writeSystemLog } from './_lib/system-log.js';
import { rateLimitCheck } from './_lib/rate-limit.js';

// bodyParser disabled so the sentry_webhook action receives raw bytes for HMAC-SHA256.
// Every other action reads rawBody then re-parses it as JSON before dispatching.
export const config = { api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function mapSentryLevel(level) {
  if (level === 'fatal' || level === 'error') return 'error';
  if (level === 'warning')                    return 'warning';
  return 'info';
}

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

async function readCacheHits() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return 0;
  try {
    const today = new Date().toISOString().slice(0, 10);
    const res  = await fetch(`${UPSTASH_URL}/get/stats:cache_hits:${today}`, {
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
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

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
// Called hourly by external cron. Requires X-Cron-Secret header matching CRON_SECRET env var.
// Sends a Resend email alert when spend crosses 80% of daily cap.
async function handleAlertCheck(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  // Fail closed: if CRON_SECRET is not configured, reject all requests.
  if (!cronSecret) return res.status(401).json({ error: 'Unauthorized' });
  const provided = req.headers['x-cron-secret'];
  if (!provided || provided !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
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
      const pct       = ((spent / cap) * 100).toFixed(1);
      const reqCount  = data?.request_count || 0;
      const adminEmail = process.env.ADMIN_EMAIL;
      if (adminEmail) {
        try {
          const resend = new Resend(process.env.RESEND_API_KEY);
          await resend.emails.send({
            from:    'FYPro Alerts <hello@fypro.com.ng>',
            to:      adminEmail,
            subject: `[FYPro] Spend alert — ${pct}% of daily cap used`,
            html: `<p>Daily spend: <strong>$${spent.toFixed(4)}</strong> of $${cap.toFixed(2)} cap (${pct}%).<br>Requests today: ${reqCount}.</p>`,
          });
        } catch (emailErr) {
          console.error('[admin/alert-check] email send failed:', emailErr.message);
        }
      }
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
    const cap  = parseFloat(process.env.DAILY_CAP_USD || '10');

    const today           = new Date(now).toISOString().slice(0, 10);
    const todayStart      = `${today}T00:00:00.000Z`;
    const yesterday       = new Date(now - 86400000).toISOString().slice(0, 10);
    const yesterdayStart  = `${yesterday}T00:00:00.000Z`;
    const weekAgoISO      = new Date(now - MS7).toISOString();
    const threeDaysAgoISO = new Date(now - MS3).toISOString();

    // run_counts live in user_entitlements, not projects — fetch both
    const [authRes, paymentsRes, projectsRes, entitlementsRes, usageRes, cacheHits, failedPaymentsRes, signupsYesterdayRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 }),
      supabaseAdmin.from('payments').select('user_id, amount_kobo, status, created_at, tier').eq('status', 'success'),
      supabaseAdmin.from('projects').select('user_id, created_at'),
      supabaseAdmin.from('user_entitlements').select('user_id, run_counts').not('run_counts', 'is', null),
      supabaseAdmin.from('daily_usage').select('total_cost_usd, request_count').eq('date', today).maybeSingle(),
      readCacheHits(),
      supabaseAdmin.from('payments').select('*', { count: 'exact', head: true }).neq('status', 'success').gte('created_at', todayStart),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart),
    ]);

    const authUsers    = authRes.data?.users || [];
    const payments     = paymentsRes.data    || [];
    const projects     = projectsRes.data    || [];
    const entitlements = entitlementsRes.data || [];

    const usageRow   = usageRes.data;
    const spentUsd   = parseFloat(usageRow?.total_cost_usd || 0);
    const dailySpend = {
      spent_usd:     spentUsd,
      cap_usd:       cap,
      remaining_usd: parseFloat(Math.max(0, cap - spentUsd).toFixed(4)),
      request_count: usageRow?.request_count || 0,
    };
    // hit_rate = cached / (cached + fresh).  Both counters are now daily-scoped:
    //   cacheHits        — daily Redis key stats:cache_hits:YYYY-MM-DD
    //   request_count    — daily_usage rows (trackUsage only fires for fresh Anthropic calls)
    const freshCalls    = usageRow?.request_count || 0;
    const totalCalls    = cacheHits + freshCalls;
    const cacheHitRate = {
      hits_total:   cacheHits,
      hit_rate_pct: totalCalls > 0
        ? Math.min(100, parseFloat(((cacheHits / totalCalls) * 100).toFixed(1)))
        : 0,
    };
    const failedPaymentsToday = failedPaymentsRes.count || 0;
    const signupsYesterday    = signupsYesterdayRes.count || 0;

    // build userId → run_counts map from entitlements
    const runCountsByUser = {};
    for (const ent of entitlements) {
      if (ent.run_counts && typeof ent.run_counts === 'object') {
        runCountsByUser[ent.user_id] = ent.run_counts;
      }
    }

    // top 3 users by cumulative run count
    const userEmailMap = {};
    for (const u of authUsers) userEmailMap[u.id] = u.email || '';
    const topActiveUsers = Object.entries(runCountsByUser)
      .map(([userId, rc]) => {
        const total    = Object.values(rc).reduce((s, v) => s + (typeof v === 'number' ? v : 0), 0);
        const topEntry = Object.entries(rc).sort((a, b) => (b[1] || 0) - (a[1] || 0))[0];
        return { email: userEmailMap[userId] || userId, total_runs: total, top_feature: topEntry?.[0] || null };
      })
      .sort((a, b) => b.total_runs - a.total_runs)
      .slice(0, 3);

    // ── Overview ──────────────────────────────────────────────────
    const totalUsers     = authUsers.length;
    const activeToday    = authUsers.filter(u => u.last_sign_in_at >= todayStart).length;
    const activeThisWeek = authUsers.filter(u => u.last_sign_in_at >= weekAgoISO).length;
    const signupsToday   = authUsers.filter(u => u.created_at >= todayStart).length;

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

    const todayPayments    = payments.filter(p => p.created_at >= todayStart);
    const revenueTodayNgn  = todayPayments.reduce((sum, p) => sum + Math.round((p.amount_kobo || 0) / 100), 0);
    const payingUsersToday = new Set(todayPayments.map(p => p.user_id)).size;
    const ngnPerUsd        = parseFloat(process.env.NGN_PER_USD || '1600');

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
      'red_flag_detector', 'meeting_prep',
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
        signups_today:     signupsToday,
      },
      users,
      revenue_chart:         revenueChart,
      signups_chart:         signupsChart,
      feature_usage:         featureUsage,
      funnel,
      never_converted:       neverConverted,
      daily_spend:           dailySpend,
      cache_hit_rate:        cacheHitRate,
      top_active_users:      topActiveUsers,
      failed_payments_today: failedPaymentsToday,
      signups_yesterday:     signupsYesterday,
      revenue_today_ngn:     revenueTodayNgn,
      paying_users_today:    payingUsersToday,
      ngn_per_usd:           ngnPerUsd,
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

// action: "vitals"
async function handleVitals(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const today          = new Date().toISOString().slice(0, 10);
    const todayStart     = `${today}T00:00:00.000Z`;
    const thirtyMinAgo   = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const [rtLatestRes, rtAvgRes, failuresTodayRes, usageRes, activeGenFailRes, activeRtRes] = await Promise.all([
      supabaseAdmin.from('response_times').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      // Exclude duration_ms = 0 (cache-hit sentinel) from avg so cached requests don't dilute the mean
      supabaseAdmin.from('response_times').select('duration_ms').gt('duration_ms', 0).order('created_at', { ascending: false }).limit(10),
      supabaseAdmin.from('generation_failures').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabaseAdmin.from('daily_usage').select('request_count').eq('date', today).maybeSingle(),
      // Active users from error events
      supabaseAdmin.from('generation_failures').select('user_id').gte('created_at', thirtyMinAgo),
      // Active users from successful API calls (requires 0009 migration for user_id column)
      supabaseAdmin.from('response_times').select('user_id').gte('created_at', thirtyMinAgo).not('user_id', 'is', null),
    ]);

    const rows          = rtAvgRes.data || [];
    const avgResponseMs = rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + (r.duration_ms || 0), 0) / rows.length)
      : null;

    // Union distinct user_ids from both tables for accurate "active in last 30 min" count
    const genFailUserIds = new Set((activeGenFailRes.data || []).map(r => r.user_id).filter(Boolean));
    const rtUserIds      = new Set((activeRtRes.data      || []).map(r => r.user_id).filter(Boolean));
    const activeSessions = new Set([...genFailUserIds, ...rtUserIds]).size;

    return res.status(200).json({
      avg_response_ms: avgResponseMs,
      last_call_at:    rtLatestRes.data?.created_at || null,
      failures_today:  failuresTodayRes.count || 0,
      requests_today:  usageRes.data?.request_count || 0,
      active_sessions: activeSessions,
    });
  } catch (err) {
    console.error('[admin/vitals] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "failures"
async function handleFailures(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const today      = new Date().toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00.000Z`;

    const [rowsRes, countRes] = await Promise.all([
      supabaseAdmin.from('generation_failures').select('*').order('created_at', { ascending: false }).limit(20),
      supabaseAdmin.from('generation_failures').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
    ]);

    return res.status(200).json({
      rows:        rowsRes.data || [],
      total_today: countRes.count || 0,
    });
  } catch (err) {
    console.error('[admin/failures] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "resolve-failure"
async function handleResolveFailure(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const { error } = await supabaseAdmin
      .from('generation_failures')
      .update({ resolved: true })
      .eq('id', id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/resolve-failure] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "delete-user"
// Deletes the auth.users record, which cascades through the full chain:
//   auth.users → public.users → {user_entitlements, projects, project_steps,
//                                  defense_sessions, defense_turns, payments}
// generation_failures and payment_issues use ON DELETE SET NULL, so their rows
// are preserved with user_id=null for admin review.
// Run migrations/0007_cascade_audit.sql to verify cascades are in place.
async function handleDeleteUser(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
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

// action: "self-delete"
// Called by the authenticated user to permanently delete their own account.
// Verifies the user's own JWT — does NOT require ADMIN_EMAIL.
// Deletes auth.users, which cascades through:
//   public.users → {user_entitlements, projects, project_steps,
//                    defense_sessions, defense_turns, payments}
// generation_failures and payment_issues use ON DELETE SET NULL — rows kept for admin.
async function handleSelfDelete(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let userId;
  try {
    const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
    if (error || !user) return res.status(401).json({ error: 'Unauthorized' });
    userId = user.id;
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/self-delete]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "auth-attempts" — last 24h of auth_attempts, with suspicious IP summary
async function handleAuthAttempts(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  try {
    const { data, error } = await supabaseAdmin
      .from('auth_attempts')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;

    const rows = data || [];

    // Suspicious = IP with 5+ failed logins in the window
    const failsByIp = {};
    rows.forEach(r => {
      if (!r.success && r.action === 'login' && r.ip) {
        failsByIp[r.ip] = (failsByIp[r.ip] || 0) + 1;
      }
    });
    const suspicious = Object.entries(failsByIp)
      .filter(([, n]) => n >= 5)
      .sort(([, a], [, b]) => b - a)
      .map(([ip, failed_count]) => ({ ip, failed_count }));

    return res.status(200).json({ attempts: rows, suspicious });
  } catch (err) {
    console.error('[admin/auth-attempts] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "payment-issues"
async function handlePaymentIssues(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const { data, error } = await supabaseAdmin
      .from('payment_issues')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return res.status(200).json({ issues: data || [] });
  } catch (err) {
    console.error('[admin/payment-issues] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "resolve-payment-issue"
async function handleResolvePaymentIssue(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const { error } = await supabaseAdmin
      .from('payment_issues')
      .update({ resolved: true })
      .eq('id', id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/resolve-payment-issue] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "report-payment-issue" — user-facing (no admin gate)
async function handleReportPaymentIssue(req, res) {
  const rl = await rateLimitCheck(req, { userDay: 3, ipDay: 10, prefix: 'payment-issue' });
  if (!rl.allowed) return res.status(429).json({ error: 'Too many reports. Please try again tomorrow or email hello@fypro.com.ng directly.' });

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
  if (!transactionRef?.trim()) return res.status(400).json({ error: 'Transaction reference is required.' });

  const { error: insertError } = await supabaseAdmin.from('payment_issues').insert({
    user_id:         userId,
    user_email:      userEmail,
    transaction_ref: transactionRef.trim(),
    description:     description?.trim() || null,
  });
  if (insertError) {
    console.error('[admin/report-payment-issue] insert error:', insertError.message);
    return res.status(500).json({ error: 'Failed to save report. Please email hello@fypro.com.ng directly.' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  resend.emails.send({
    from:    'FYPro Alerts <hello@fypro.com.ng>',
    to:      'hello@fypro.com.ng',
    subject: `URGENT: Payment issue — ${userEmail}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;"><h2 style="color:#DC2626;">⚠️ Payment Issue Report</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>User email:</strong></td><td style="padding:8px 0;font-size:14px;">${userEmail}</td></tr><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>User ID:</strong></td><td style="padding:8px 0;font-size:14px;font-family:monospace;">${userId}</td></tr><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>Transaction ref:</strong></td><td style="padding:8px 0;font-size:14px;font-family:monospace;">${transactionRef.trim()}</td></tr><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>Description:</strong></td><td style="padding:8px 0;font-size:14px;">${description?.trim() || '(none)'}</td></tr><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>Reported at:</strong></td><td style="padding:8px 0;font-size:14px;">${new Date().toISOString()}</td></tr></table><p style="margin-top:24px;color:#333;font-size:14px;">Resolve in the <a href="https://fypro.vercel.app/admin/health">admin dashboard</a>.</p></div>`,
  }).catch(e => console.error('[admin/report-payment-issue] resend error:', e.message));

  return res.status(200).json({ ok: true });
}

// action: "sentry_webhook"
// No admin auth — access is controlled by HMAC-SHA256 signature verification.
// Sentry webhook URL: https://fypro.com.ng/api/admin?action=sentry_webhook
async function handleSentryWebhook(req, res, rawBody) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.SENTRY_WEBHOOK_SECRET;
  if (!secret) {
    console.error('[sentry-webhook] SENTRY_WEBHOOK_SECRET is not set — rejecting request');
    return res.status(500).json({ error: 'Webhook secret not configured on server.' });
  }

  const sig      = req.headers['sentry-hook-signature'] || '';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (sig !== expected) {
    console.error('[sentry-webhook] invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const event      = payload?.data?.event || {};
  const level      = event.level || 'info';
  const title      = String(event.title || 'Unknown Sentry event').slice(0, 200);
  const tags       = Array.isArray(event.tags) ? event.tags : [];
  const featureTag = tags.find(([k]) => k === 'feature');
  const feature    = featureTag ? featureTag[1] : 'Unknown';

  await writeSystemLog({
    severity:      mapSentryLevel(level),
    feature,
    source:        'sentry',
    plain_message: title,
    raw_detail:    payload,
  });

  return res.status(200).json({ ok: true });
}

// action: "system_logs"
async function handleSystemLogs(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const { data, error } = await supabaseAdmin
      .from('system_logs')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return res.status(200).json({ logs: data || [] });
  } catch (err) {
    console.error('[admin/system_logs] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "resolve_log"
async function handleResolveLog(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const { error } = await supabaseAdmin
      .from('system_logs')
      .update({ resolved: true })
      .eq('id', id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/resolve_log] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "feedback-summary" — per-feature thumbs aggregates, last 30 days
async function handleFeedbackSummary(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const since30d = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await supabaseAdmin
      .from('feature_feedback')
      .select('feature, rating')
      .gte('created_at', since30d);

    if (error) throw error;

    const map = {};
    for (const row of data || []) {
      if (!map[row.feature]) map[row.feature] = { up: 0, down: 0 };
      if (row.rating === 1) map[row.feature].up++;
      else map[row.feature].down++;
    }

    const rows = Object.entries(map)
      .map(([feature, { up, down }]) => {
        const total = up + down;
        return { feature, up, down, total, score: total > 0 ? (up - down) / total : 0 };
      })
      .sort((a, b) => b.total - a.total);

    return res.status(200).json({ rows });
  } catch (err) {
    console.error('[admin/feedback-summary] error:', err.message);
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

  // Read raw body once. sentry_webhook uses the raw bytes for HMAC; every other
  // action gets the body re-parsed as JSON and assigned back to req.body.
  const rawBody = await readRawBody(req);
  if (action === 'sentry_webhook') return handleSentryWebhook(req, res, rawBody);

  try {
    req.body = rawBody.length ? JSON.parse(rawBody.toString('utf8')) : {};
  } catch {
    req.body = {};
  }

  if (action === 'health')           return handleHealth(req, res);
  if (action === 'alert-check')      return handleAlertCheck(req, res);
  if (action === 'dashboard')        return handleDashboard(req, res);
  if (action === 'vitals')           return handleVitals(req, res);
  if (action === 'failures')         return handleFailures(req, res);
  if (action === 'resolve-failure')  return handleResolveFailure(req, res);
  if (action === 'delete-user')      return handleDeleteUser(req, res);
  if (action === 'ban-user')         return handleBanUser(req, res);
  if (action === 'self-delete')            return handleSelfDelete(req, res);
  if (action === 'auth-attempts')          return handleAuthAttempts(req, res);
  if (action === 'payment-issues')         return handlePaymentIssues(req, res);
  if (action === 'resolve-payment-issue')  return handleResolvePaymentIssue(req, res);
  if (action === 'system_logs')        return handleSystemLogs(req, res);
  if (action === 'resolve_log')        return handleResolveLog(req, res);
  if (action === 'feedback-summary')        return handleFeedbackSummary(req, res);
  if (action === 'report-payment-issue')    return handleReportPaymentIssue(req, res);

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
