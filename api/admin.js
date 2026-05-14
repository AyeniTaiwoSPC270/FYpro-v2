import crypto           from 'crypto';
import { Resend }              from 'resend';
import { Redis }               from '@upstash/redis';
import { supabaseAdmin }       from './_lib/supabase-admin.js';
import { writeSystemLog }      from './_lib/system-log.js';
import { rateLimitCheck }      from './_lib/rate-limit.js';
import { setCorsHeaders }       from './_lib/cors.js';
import { sendTelegramAlert }   from './_lib/telegram.js';
import { setMaintenanceMode as setMaintenanceModeLib } from './_lib/maintenance.js';

// Redis client used exclusively by admin actions (key inspection, reset)
function getAdminRedis() {
  return new Redis({
    url:   process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
}

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
      supabaseAdmin.from('user_entitlements').select('user_id, run_counts, paid_features'),
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

    // build userId → run_counts map and userId → paid_features map from entitlements
    const runCountsByUser   = {};
    const paidFeaturesByUser = {};
    for (const ent of entitlements) {
      if (ent.run_counts && typeof ent.run_counts === 'object') {
        runCountsByUser[ent.user_id] = ent.run_counts;
      }
      if (Array.isArray(ent.paid_features) && ent.paid_features.length > 0) {
        paidFeaturesByUser[ent.user_id] = ent.paid_features;
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
      // Also check admin-granted entitlements (not reflected in payments)
      const grantedFeatures = paidFeaturesByUser[u.id] ?? [];
      if (grantedFeatures.includes('defense_pack')) plan = 'Defense';
      else if (grantedFeatures.includes('student_pack') && plan === 'Free') plan = 'Student';

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

// action: "reset-usage" — clears Upstash rate limit keys for a user so they can make requests again
// Clears both user-day keys (matched by userId) and IP keys (matched by last known IP from auth_attempts)
async function handleResetUsage(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  try {
    const redis = getAdminRedis();

    // 1. User-day rate limit keys (contain the UUID)
    const userFound = await redis.keys(`*${userId}*`);
    const userRlKeys = (userFound || []).filter(k => k.startsWith('rl:'));

    // 2. IP rate limit keys — look up last known IP from auth_attempts
    let ipRlKeys = [];
    const { data: attempts } = await supabaseAdmin
      .from('auth_attempts')
      .select('ip')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    const lastIp = attempts?.[0]?.ip ?? null;
    if (lastIp) {
      const ipFound = await redis.keys(`*${lastIp}*`);
      // Only clear Claude-API IP keys, not auth login keys
      ipRlKeys = (ipFound || []).filter(k => k.startsWith('rl:ip:') && !k.includes(':auth:'));
    }

    const allKeys = [...new Set([...userRlKeys, ...ipRlKeys])];
    let deleted = 0;
    if (allKeys.length > 0) {
      deleted = await redis.del(...allKeys);
    }

    return res.status(200).json({ ok: true, keys_deleted: deleted, user_keys: userRlKeys, ip_keys: ipRlKeys, last_ip: lastIp });
  } catch (err) {
    console.error('[admin/reset-usage]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "diagnose-user" — checks all three possible blocking conditions for a user
// Returns a plain-English status for each: user-day limit, IP limit, global spend cap
async function handleDiagnoseUser(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  const today = new Date().toISOString().slice(0, 10);
  const cap   = parseFloat(process.env.DAILY_CAP_USD || '10');

  try {
    // 1. Check user-day Redis rate limit keys
    const redis       = getAdminRedis();
    const userRlKeys  = ((await redis.keys(`*${userId}*`)) || []).filter(k => k.startsWith('rl:'));

    // 2. Find user's last known IP from auth_attempts, then check IP limit keys
    const { data: attempts } = await supabaseAdmin
      .from('auth_attempts')
      .select('ip, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(1);
    const lastIp   = attempts?.[0]?.ip ?? null;
    let   ipRlKeys = [];
    if (lastIp) {
      ipRlKeys = ((await redis.keys(`*${lastIp}*`)) || []).filter(k => k.startsWith('rl:'));
    }

    // 3. Check global daily spend cap
    const { data: usage } = await supabaseAdmin
      .from('daily_usage')
      .select('total_cost_usd, request_count')
      .eq('date', today)
      .maybeSingle();
    const spent      = parseFloat(usage?.total_cost_usd || 0);
    const capHit     = spent >= cap;
    const capPct     = cap > 0 ? Math.round((spent / cap) * 100) : 0;

    const blocks = [];
    if (userRlKeys.length > 0) blocks.push(`user-day limit (${userRlKeys.length} key${userRlKeys.length > 1 ? 's' : ''})`);
    if (ipRlKeys.length  > 0) blocks.push(`IP limit for ${lastIp} (${ipRlKeys.length} key${ipRlKeys.length > 1 ? 's' : ''})`);
    if (capHit)               blocks.push(`global spend cap ($${spent.toFixed(2)} / $${cap.toFixed(2)}, ${capPct}%)`);

    return res.status(200).json({
      user_rl_keys:  userRlKeys,
      ip_rl_keys:    ipRlKeys,
      last_ip:       lastIp,
      cap_hit:       capHit,
      cap_pct:       capPct,
      spent_usd:     spent,
      cap_usd:       cap,
      is_blocked:    blocks.length > 0,
      block_reasons: blocks,
    });
  } catch (err) {
    console.error('[admin/diagnose-user]', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "debug-redis-keys" — lists all rl: keys for a userId (admin diagnostics only)
async function handleDebugRedisKeys(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return res.status(500).json({ error: 'Redis not configured' });
  }

  try {
    const redis  = getAdminRedis();
    const found  = await redis.keys(`*${userId}*`);
    const allRl  = await redis.keys('rl:*');
    return res.status(200).json({ keys_for_user: found || [], all_rl_keys_sample: (allRl || []).slice(0, 20) });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// action: "grant-entitlement" — admin grants student or defense plan to a user at no charge
async function handleGrantEntitlement(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { userId, plan } = req.body || {};
  if (!userId || !['student', 'defense'].includes(plan)) {
    return res.status(400).json({ error: 'userId and plan (student|defense) required' });
  }

  try {
    const { data: current } = await supabaseAdmin
      .from('user_entitlements')
      .select('paid_features, defense_packs_remaining, total_lifetime_paid_ngn')
      .eq('user_id', userId)
      .maybeSingle();

    const features      = new Set(Array.isArray(current?.paid_features) ? current.paid_features : []);
    let   defensePacks  = typeof current?.defense_packs_remaining === 'number' ? current.defense_packs_remaining : 0;
    const lifetimeTotal = typeof current?.total_lifetime_paid_ngn  === 'number' ? current.total_lifetime_paid_ngn  : 0;

    if (plan === 'student') {
      features.add('student_pack');
    } else {
      features.add('defense_pack');
      features.add('project_reset');
      defensePacks += 1;
    }

    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert({
        user_id:                 userId,
        paid_features:           Array.from(features),
        defense_packs_remaining: defensePacks,
        total_lifetime_paid_ngn: lifetimeTotal,
        updated_at:              new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/grant-entitlement]', err.message);
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
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;"><h2 style="color:#DC2626;">⚠️ Payment Issue Report</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>User email:</strong></td><td style="padding:8px 0;font-size:14px;">${userEmail}</td></tr><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>User ID:</strong></td><td style="padding:8px 0;font-size:14px;font-family:monospace;">${userId}</td></tr><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>Transaction ref:</strong></td><td style="padding:8px 0;font-size:14px;font-family:monospace;">${transactionRef.trim()}</td></tr><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>Description:</strong></td><td style="padding:8px 0;font-size:14px;">${description?.trim() || '(none)'}</td></tr><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>Reported at:</strong></td><td style="padding:8px 0;font-size:14px;">${new Date().toISOString()}</td></tr></table><p style="margin-top:24px;color:#333;font-size:14px;">Resolve in the <a href="https://www.fypro.com.ng/admin/health">admin dashboard</a>.</p></div>`,
  }).catch(e => console.error('[admin/report-payment-issue] resend error:', e.message));

  sendTelegramAlert(
    `🚨 Payment issue reported: ${userEmail} says they paid but don't have access.\nRef: ${transactionRef.trim()}\nCheck Paystack dashboard.`
  ).catch(e => console.error('[admin/report-payment-issue] telegram error:', e.message));

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

async function fetchSentryIssues() {
  const token   = process.env.SENTRY_AUTH_TOKEN;
  const org     = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  if (!token || !org || !project) return [];
  try {
    const r = await fetch(
      `https://sentry.io/api/0/projects/${org}/${project}/issues/?query=is:unresolved&limit=10`,
      { headers: { Authorization: `Bearer ${token}` } }
    );
    if (!r.ok) {
      console.error('[admin/system_logs] Sentry API responded', r.status);
      return [];
    }
    const issues = await r.json();
    return Array.isArray(issues) ? issues.map(i => ({
      id:         i.id,
      title:      i.title,
      level:      i.level,
      count:      i.count,
      first_seen: i.firstSeen,
      last_seen:  i.lastSeen,
      permalink:  i.permalink,
    })) : [];
  } catch (err) {
    console.error('[admin/system_logs] Sentry fetch error:', err.message);
    return [];
  }
}

// action: "system_logs"
async function handleSystemLogs(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const [logsRes, sentryIssues] = await Promise.all([
      supabaseAdmin
        .from('system_logs')
        .select('*')
        .eq('resolved', false)
        .order('created_at', { ascending: false })
        .limit(50),
      fetchSentryIssues(),
    ]);
    if (logsRes.error) throw logsRes.error;
    return res.status(200).json({ logs: logsRes.data || [], sentry_issues: sentryIssues });
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

// action: "test-all-alerts" — fires one test message per alert type so you can
// verify the Telegram connection and all 10 wired events in one shot.
// Uses direct Telegram API calls (not sendTelegramAlert) so each result is
// individually reported even if the helper would swallow the error.
async function handleTestAllAlerts(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const token  = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) {
    return res.status(500).json({ error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID not configured on server.' });
  }

  const ALERTS = [
    { key: 'signup',                 message: '👤 [TEST] New signup: test@example.com (free)' },
    { key: 'payment_success',        message: '💰 [TEST] Payment received: test@example.com paid ₦3,500 for Defense Pack' },
    { key: 'payment_failed',         message: '❌ [TEST] Payment failed: test@example.com — card declined' },
    { key: 'spend_warning_80pct',    message: '🔶 [TEST] Spend warning: 80% of daily cap used ($8.00/$10.00)' },
    { key: 'spend_cap_hit',          message: '⚠️ [TEST] Spend cap hit: $10.00 spent today. Claude requests blocked.' },
    { key: 'gen_failed_general',     message: '🔴 [TEST] Generation failed: topic-validator for anonymous — timeout' },
    { key: 'gen_failed_defense',     message: '🔴 [TEST] Generation failed: defense-simulator for test@example.com — timeout' },
    { key: 'gen_failed_supervisor',  message: '🔴 [TEST] Generation failed: supervisor-prep — timeout' },
    { key: 'defense_completed',      message: '🎓 [TEST] Defense completed: test@example.com scored 7/10' },
    { key: 'project_created',        message: '📁 [TEST] New project: test@example.com started \'My Research Project\'' },
  ];

  const results = await Promise.all(
    ALERTS.map(async ({ key, message }) => {
      try {
        const r    = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ chat_id: chatId, text: message }),
        });
        const data = await r.json();
        return { key, ok: r.ok && data.ok === true, http_status: r.status };
      } catch (err) {
        return { key, ok: false, error: err.message };
      }
    })
  );

  const allOk    = results.every(r => r.ok);
  const failures = results.filter(r => !r.ok);
  return res.status(200).json({ all_ok: allOk, sent: results.length, failures: failures.length, results });
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

// action: "daily-report"
// Triggered by cron-job.org. Gate: ?secret=CRON_SECRET query param.
// Aggregates today's key metrics and posts a summary to Telegram.
async function handleDailyReport(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return res.status(401).json({ error: 'Unauthorized' });
  if (!req.query.secret || req.query.secret !== cronSecret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  try {
    const today      = new Date().toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00.000Z`;
    const cap        = parseFloat(process.env.DAILY_CAP_USD || '10');

    const [
      authRes,
      paymentsAllRes,
      paymentsTodayRes,
      usageRes,
      failedGenRes,
      defenseRes,
      projectsRes,
      stepFeaturesRes,
      cacheHits,
      newUsersRes,
      totalUsersRes,
    ] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 }),
      supabaseAdmin.from('payments').select('amount_kobo').eq('status', 'success'),
      supabaseAdmin.from('payments').select('amount_kobo').eq('status', 'success').gte('created_at', todayStart),
      supabaseAdmin.from('daily_usage').select('total_cost_usd, request_count').eq('date', today).maybeSingle(),
      supabaseAdmin.from('generation_failures').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabaseAdmin.from('defense_sessions').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabaseAdmin.from('project_steps').select('step_name').gte('completed_at', todayStart),
      readCacheHits(),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
    ]);

    const authUsers   = authRes.data?.users || [];
    const activeToday = authUsers.filter(u => u.last_sign_in_at >= todayStart).length;
    const totalUsers  = totalUsersRes.count || 0;
    const newUsers    = newUsersRes.count   || 0;

    const allPayments   = paymentsAllRes.data  || [];
    const todayPayments = paymentsTodayRes.data || [];
    const totalRevNgn   = allPayments.reduce((s, p)   => s + Math.round((p.amount_kobo || 0) / 100), 0);
    const todayRevNgn   = todayPayments.reduce((s, p) => s + Math.round((p.amount_kobo || 0) / 100), 0);

    const usageRow         = usageRes.data;
    const spentUsd         = parseFloat(usageRow?.total_cost_usd || 0);
    const generationsToday = usageRow?.request_count || 0;
    const failedToday      = failedGenRes.count || 0;

    const totalCalls  = cacheHits + generationsToday;
    const cacheHitPct = totalCalls > 0 ? Math.round((cacheHits / totalCalls) * 100) : 0;

    const defensesToday = defenseRes.count  || 0;
    const projectsToday = projectsRes.count || 0;

    // Top feature today from completed project_steps
    const stepRows   = stepFeaturesRes.data || [];
    const stepCounts = {};
    for (const row of stepRows) {
      if (row.step_name) stepCounts[row.step_name] = (stepCounts[row.step_name] || 0) + 1;
    }
    const topEntry = Object.entries(stepCounts).sort((a, b) => b[1] - a[1])[0];
    const topFeatureLabel = topEntry
      ? `${topEntry[0].replace(/_/g, ' ')} (${topEntry[1]} runs)`
      : 'None yet';

    const MONTHS  = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    const now     = new Date();
    const dateStr = `${now.getUTCDate()} ${MONTHS[now.getUTCMonth()]} ${now.getUTCFullYear()}`;

    const message = [
      `📊 FYPro Daily Report — ${dateStr}`,
      ``,
      `👥 Users`,
      `- Total: ${totalUsers} | New today: ${newUsers} | Active: ${activeToday}`,
      ``,
      `💰 Revenue`,
      `- Today: ₦${todayRevNgn.toLocaleString()} | Total: ₦${totalRevNgn.toLocaleString()} | Payments: ${todayPayments.length}`,
      ``,
      `🤖 AI Usage`,
      `- Runs: ${generationsToday} | Failed: ${failedToday} | Spend: $${spentUsd.toFixed(2)}/$${cap.toFixed(0)} | Cache: ${cacheHitPct}%`,
      ``,
      `🎓 Academic`,
      `- Defenses: ${defensesToday} | Projects: ${projectsToday}`,
      ``,
      `📈 Top feature: ${topFeatureLabel}`,
    ].join('\n');

    await sendTelegramAlert(message);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/daily-report] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "resolve-sentry-issues"
// Resolves specific Sentry issues by ID using the bulk update API.
// Body: { ids: string[] }
async function handleResolveSentryIssues(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { ids } = req.body || {};
  if (!Array.isArray(ids) || ids.length === 0) {
    return res.status(400).json({ error: 'ids array required' });
  }

  const token   = process.env.SENTRY_AUTH_TOKEN;
  const org     = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  if (!token || !org || !project) {
    return res.status(500).json({ error: 'Sentry env vars not configured' });
  }

  const query = ids.map(id => `id=${encodeURIComponent(id)}`).join('&');
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const r = await fetch(
      `https://sentry.io/api/0/projects/${org}/${project}/issues/?${query}`,
      {
        method:  'PUT',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body:    JSON.stringify({ status: 'resolved' }),
        signal:  controller.signal,
      }
    );
    clearTimeout(timeout);
    const responseText = await r.text();
    if (!r.ok) {
      console.error('[admin/resolve-sentry-issues] Sentry API error', r.status, responseText.slice(0, 300));
      return res.status(502).json({ error: `Sentry returned ${r.status} — check token has Issues: Write scope` });
    }
    return res.status(200).json({ ok: true, resolved: ids.length });
  } catch (err) {
    clearTimeout(timeout);
    const msg = err.name === 'AbortError' ? 'Sentry API timed out (8s)' : err.message;
    console.error('[admin/resolve-sentry-issues] error:', msg);
    return res.status(500).json({ error: msg });
  }
}

// action: "get-maintenance-mode" — admin only
async function handleGetMaintenanceMode(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const { data, error } = await supabaseAdmin
      .from('app_config')
      .select('key, value, updated_at')
      .in('key', ['maintenance_mode', 'maintenance_message']);

    if (error) throw error;

    const rows    = data || [];
    const modeRow = rows.find(r => r.key === 'maintenance_mode');
    const msgRow  = rows.find(r => r.key === 'maintenance_message');

    return res.status(200).json({
      maintenance_mode:    modeRow?.value === 'true',
      maintenance_message: msgRow?.value  || '',
      updated_at:          modeRow?.updated_at || null,
    });
  } catch (err) {
    console.error('[admin/get-maintenance-mode] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "set-maintenance-mode" — admin only
async function handleSetMaintenanceMode(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { enabled, message } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) required' });
  }

  try {
    await setMaintenanceModeLib(enabled);

    if (typeof message === 'string') {
      await supabaseAdmin.from('app_config').upsert({
        key:        'maintenance_message',
        value:      message,
        updated_at: new Date().toISOString(),
      });
    }

    sendTelegramAlert(
      `🔧 Maintenance mode ${enabled ? 'ENABLED 🔴' : 'DISABLED 🟢'} by admin${message ? `\nMessage: ${message}` : ''}`
    ).catch(() => {});

    return res.status(200).json({ ok: true, maintenance_mode: enabled });
  } catch (err) {
    console.error('[admin/set-maintenance-mode] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

// action: "maintenance-info" — public, no auth, only exposes the maintenance message
async function handleMaintenanceInfo(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { data } = await supabaseAdmin
      .from('app_config')
      .select('value')
      .eq('key', 'maintenance_message')
      .maybeSingle();
    return res.status(200).json({ maintenance_message: data?.value || '' });
  } catch {
    return res.status(200).json({ maintenance_message: '' });
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const action = req.query.action;

  let rawBody;
  try {
    rawBody = await readRawBody(req);
  } catch (err) {
    console.error('[admin] readRawBody failed:', err.message);
    return res.status(500).json({ error: 'Failed to read request body' });
  }

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
  if (action === 'delete-user')        return handleDeleteUser(req, res);
  if (action === 'ban-user')           return handleBanUser(req, res);
  if (action === 'reset-usage')        return handleResetUsage(req, res);
  if (action === 'grant-entitlement')  return handleGrantEntitlement(req, res);
  if (action === 'debug-redis-keys')   return handleDebugRedisKeys(req, res);
  if (action === 'diagnose-user')      return handleDiagnoseUser(req, res);
  if (action === 'self-delete')            return handleSelfDelete(req, res);
  if (action === 'auth-attempts')          return handleAuthAttempts(req, res);
  if (action === 'payment-issues')         return handlePaymentIssues(req, res);
  if (action === 'resolve-payment-issue')  return handleResolvePaymentIssue(req, res);
  if (action === 'system_logs')        return handleSystemLogs(req, res);
  if (action === 'resolve_log')        return handleResolveLog(req, res);
  if (action === 'feedback-summary')        return handleFeedbackSummary(req, res);
  if (action === 'report-payment-issue')    return handleReportPaymentIssue(req, res);
  if (action === 'test-all-alerts')         return handleTestAllAlerts(req, res);
  if (action === 'daily-report')            return handleDailyReport(req, res);
  if (action === 'resolve-sentry-issues')   return handleResolveSentryIssues(req, res);
  if (action === 'get-maintenance-mode')    return handleGetMaintenanceMode(req, res);
  if (action === 'set-maintenance-mode')    return handleSetMaintenanceMode(req, res);
  if (action === 'maintenance-info')        return handleMaintenanceInfo(req, res);

  return res.status(400).json({ error: `Unknown action: ${action}` });
}
