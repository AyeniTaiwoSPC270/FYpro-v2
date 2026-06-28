import crypto           from 'crypto';
import { Sentry }      from './_lib/sentry-server.js';
import { Resend }              from 'resend';
import { Redis }               from '@upstash/redis';
import { supabaseAdmin }       from './_lib/supabase-admin.js';
import { writeSystemLog }      from './_lib/system-log.js';
import { rateLimitCheck, redis, freeRunKey } from './_lib/rate-limit.js';
import { setCorsHeaders }       from './_lib/cors.js';
import { sendTelegramAlert }   from './_lib/telegram.js';
import { setMaintenanceMode as setMaintenanceModeLib } from './_lib/maintenance.js';
import { getExpressBetaFree, setExpressBetaFree } from './_lib/express-beta.js';
import { getRatingForce, setRatingForce as setRatingForceLib } from './_lib/rating-force.js';
import { validate, SubmitRatingSchema } from './_lib/validate.js';

const ALLOWED_TABLES = new Set([
  'admin_users','app_config','auth_attempts','daily_usage',
  'defense_certificates','defense_credits','defense_sessions','defense_turns',
  'email_log','email_preferences','feature_feedback','generation_failures',
  'institutions','notifications','payment_issues','payments',
  'project_steps','projects','push_subscriptions','referrals',
  'response_times','system_logs','user_achievements','user_entitlements',
  'user_onboarding','user_progress','user_ratings','user_reports','users',
])

// Redis client used exclusively by admin actions (key inspection, reset)
let _adminRedis = null;
function getAdminRedis() {
  if (!_adminRedis) {
    _adminRedis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
  }
  return _adminRedis;
}

// bodyParser disabled so the sentry_webhook action receives raw bytes for HMAC-SHA256.
// Every other action reads rawBody then re-parses it as JSON before dispatching.
export const config = { maxDuration: 60, api: { bodyParser: false } };

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end',  () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

// Timing-safe cron secret verification.
// Accepts x-cron-secret header OR Authorization: Bearer <secret>.
// Returns true if authorized, false (and sends 401) if not.
function verifyCronSecret(req, res) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) { res.status(401).json({ error: 'Unauthorized' }); return false; }
  const xSecret    = req.headers['x-cron-secret']   || '';
  const authHeader = req.headers['authorization']    || '';
  const expected   = Buffer.from(cronSecret);
  const bearer     = `Bearer ${cronSecret}`;

  const xMatch = xSecret.length === cronSecret.length &&
    crypto.timingSafeEqual(Buffer.from(xSecret), expected);
  const bearerMatch = authHeader.length === bearer.length &&
    crypto.timingSafeEqual(Buffer.from(authHeader), Buffer.from(bearer));

  if (!xMatch && !bearerMatch) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
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
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// action: "alert-check"
// Called by Vercel cron or external cron (cron-job.org).
// Accepts either Vercel-native (Authorization: Bearer) or x-cron-secret header.
// Sends a Resend email alert when spend crosses 80% of daily cap.
async function handleAlertCheck(req, res) {
  if (!verifyCronSecret(req, res)) return;
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
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// Fetches every page of auth.users — Supabase caps listUsers at 1,000 per page.
// Without pagination, handleDashboard and handleDailyReport silently return incomplete
// data when the user count exceeds 1,000.
async function listAllAuthUsers() {
  const allUsers = [];
  let page = 1;
  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page });
    if (error) throw error;
    const batch = data?.users || [];
    allUsers.push(...batch);
    if (batch.length < 1000) break;
    page++;
  }
  return allUsers;
}

/**
 * Comprehensive admin analytics: users table, revenue/signups charts, feature usage,
 * drop-off funnel, never-converted list, daily spend, cache hit rate, and live event feed.
 * Gated to ADMIN_EMAIL by server-side JWT verification (not just a client-side check).
 * @param {object} req - Vercel request; expects Authorization: Bearer <admin JWT>
 * @param {object} res - Vercel response
 * @returns {Promise<void>}
 */
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
    const [authUsers, paymentsRes, projectsRes, entitlementsRes, usageRes, cacheHits, failedPaymentsRes, signupsYesterdayRes, recentStepsRes] = await Promise.all([
      listAllAuthUsers(),
      supabaseAdmin.from('payments').select('user_id, amount_kobo, status, created_at, tier').eq('status', 'success'),
      supabaseAdmin.from('projects').select('user_id, created_at'),
      supabaseAdmin.from('user_entitlements').select('user_id, run_counts, paid_features, banned_until'),
      supabaseAdmin.from('daily_usage').select('total_cost_usd, request_count').eq('date', today).maybeSingle(),
      readCacheHits(),
      supabaseAdmin.from('payments').select('*', { count: 'exact', head: true }).neq('status', 'success').gte('created_at', todayStart),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart),
      supabaseAdmin.from('project_steps').select('user_id, step_name, completed_at').not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(20),
    ]);

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

    // build userId → run_counts map, paid_features map, and banned set from entitlements
    const runCountsByUser    = {};
    const paidFeaturesByUser = {};
    const bannedByUser       = new Set();
    for (const ent of entitlements) {
      if (ent.run_counts && typeof ent.run_counts === 'object') {
        runCountsByUser[ent.user_id] = ent.run_counts;
      }
      if (Array.isArray(ent.paid_features) && ent.paid_features.length > 0) {
        paidFeaturesByUser[ent.user_id] = ent.paid_features;
      }
      if (ent.banned_until && new Date(ent.banned_until).getTime() > now) {
        bannedByUser.add(ent.user_id);
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
        if (paid.tiers.includes('defense_pack')) plan = 'Defense';
        else if (paid.tiers.includes('express_defense')) plan = 'Express';
        else plan = 'Student';
      }
      // Also check admin-granted entitlements (not reflected in payments)
      const grantedFeatures = paidFeaturesByUser[u.id] ?? [];
      if (grantedFeatures.includes('defense_pack')) plan = 'Defense';
      else if (grantedFeatures.includes('express_defense') && plan === 'Free') plan = 'Express';
      else if (grantedFeatures.includes('student_pack') && plan === 'Free') plan = 'Student';

      let status = 'never_used';
      if (projCount > 0 && lastActive) {
        const daysSince = (now - new Date(lastActive).getTime()) / 86400000;
        if      (daysSince <= 7)  status = 'active';
        else if (daysSince <= 30) status = 'inactive';
        else                      status = 'churned';
      }
      if (bannedByUser.has(u.id)) status = 'banned';

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

    // ── Recent Events for Live Activity Feed ─────────────────────────────
    const recentSteps = recentStepsRes.data || [];
    const recentEvents = [
      ...[...authUsers]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10)
        .map(u => ({
          type: 'signup',
          label: 'Signed up',
          user_prefix: (u.email || '…').split('@')[0],
          time: u.created_at,
        })),
      ...[...payments]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 10)
        .map(p => ({
          type: 'payment',
          label: (p.tier || 'payment').replace(/_/g, ' '),
          user_prefix: (userEmailMap[p.user_id] || '…').split('@')[0],
          time: p.created_at,
        })),
      ...recentSteps.map(s => ({
        type: 'feature',
        label: (s.step_name || 'step').replace(/_/g, ' '),
        user_prefix: (userEmailMap[s.user_id] || '…').split('@')[0],
        time: s.completed_at,
      })),
    ]
      .sort((a, b) => new Date(b.time) - new Date(a.time))
      .slice(0, 20);

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
      recent_events:         recentEvents,
    });

  } catch (err) {
    console.error('[admin/dashboard] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
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
    const adminEmail = process.env.ADMIN_EMAIL;
    const callerBuf  = Buffer.from(caller.email  || '');
    const adminBuf   = Buffer.from(adminEmail     || '');
    if (!adminEmail || callerBuf.length !== adminBuf.length ||
        !crypto.timingSafeEqual(callerBuf, adminBuf)) {
      res.status(403).json({ error: 'Forbidden' }); return null;
    }
    return caller;
  } catch {
    res.status(401).json({ error: 'Unauthorized' }); return null;
  }
}

/**
 * Real-time API health vitals: avg latency (last 10 fresh calls), last call timestamp,
 * failure count today, request count today, and distinct active sessions in the last 30 min.
 * Gated to ADMIN_EMAIL via verifyAdmin.
 * @param {object} req - Vercel request; expects Authorization: Bearer <admin JWT>
 * @param {object} res - Vercel response
 * @returns {Promise<void>}
 */
// action: "vitals"
async function handleVitals(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const today          = new Date().toISOString().slice(0, 10);
    const todayStart     = `${today}T00:00:00.000Z`;
    const thirtyMinAgo   = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [rtLatestRes, rtAvgRes, failuresTodayRes, rtTodayCountRes, activeRtRes] = await Promise.all([
      // Most recent call timestamp for "Last API Call"
      supabaseAdmin.from('response_times').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
      // Last 10 requests only — fresh latency snapshot. duration_ms=0 cache-hits excluded.
      supabaseAdmin.from('response_times').select('duration_ms').gt('duration_ms', 0).gte('created_at', oneDayAgo).order('created_at', { ascending: false }).limit(10),
      // Failures today
      supabaseAdmin.from('generation_failures').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      // Requests today — count response_times rows directly (reliable even if increment_daily_usage RPC was disrupted)
      supabaseAdmin.from('response_times').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      // Active sessions — distinct user_ids in response_times last 30 min
      supabaseAdmin.from('response_times').select('user_id').gte('created_at', thirtyMinAgo).not('user_id', 'is', null),
    ]);

    const rows          = rtAvgRes.data || [];
    const avgResponseMs = rows.length > 0
      ? Math.round(rows.reduce((s, r) => s + (r.duration_ms || 0), 0) / rows.length)
      : null;

    const activeSessions = new Set((activeRtRes.data || []).map(r => r.user_id).filter(Boolean)).size;

    return res.status(200).json({
      avg_response_ms: avgResponseMs,
      last_call_at:    rtLatestRes.data?.created_at || null,
      failures_today:  failuresTodayRes.count || 0,
      requests_today:  rtTodayCountRes.count || 0,
      active_sessions: activeSessions,
    });
  } catch (err) {
    console.error('[admin/vitals] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
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
    return res.status(500).json({ error: 'Internal server error' });
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
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// action: "delete-user"
// Deletes the auth.users record, which cascades through the full chain:
//   auth.users → public.users → {user_entitlements, projects, project_steps,
//                                  defense_sessions, defense_turns, payments}
// generation_failures and payment_issues use ON DELETE SET NULL, so their rows
// are preserved with user_id=null for admin review.
// Run migrations/0007_cascade_audit.sql to verify cascades are in place.
// action: "reset-run-counts" — clears a user's per-feature usage counters so they can use features again
// Sets run_counts to { _reset_at: ISO } — the _reset_at key signals the client to discard its
// localStorage cache instead of merging with Math.max (which local would otherwise win).
async function handleResetRunCounts(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;
  const rl = await rateLimitCheck(req, { userDay: 50, ipDay: 60, prefix: 'admin:reset-run-counts' });
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limited' });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    console.log(`[audit] action=reset-run-counts admin=${caller.email} target=${userId} at=${new Date().toISOString()}`);
    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert({
        user_id:    userId,
        run_counts: { _reset_at: new Date().toISOString() },
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (error) throw error;
    // Also clear the Redis reservation counters ai.js enforces against —
    // otherwise the reset only touches the DB copy and the user stays blocked.
    await redis.del(
      freeRunKey('topic_validator', userId),
      freeRunKey('chapter_architect', userId),
      freeRunKey('methodology_advisor', userId),
      // Express Defence lifetime-cap reservation counters (reviewer + defence brief).
      // The simulator cap is derived from completed defense_sessions, not a Redis
      // counter, so it is intentionally not reset here.
      freeRunKey('express_reviewer', userId),
      freeRunKey('express_defence_brief', userId),
    ).catch(err => console.error('[admin/reset-run-counts] redis del failed:', err?.message));
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/reset-run-counts]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

async function handleDeleteUser(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;
  const rl = await rateLimitCheck(req, { userDay: 20, ipDay: 30, prefix: 'admin:delete-user' });
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limited' });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    console.log(`[audit] action=delete-user admin=${caller.email} target=${userId} at=${new Date().toISOString()}`);

    // Explicitly delete from tables that may not have CASCADE DELETE on the FK chain.
    // Same pattern as handleSelfDelete — prevents FK constraint violations in deleteUser.
    const tablesToClear = [
      'notifications',
      'user_progress',
      'defense_certificates',
      'defense_credits',
      'feature_feedback',
      'email_preferences',
      'user_onboarding',
      'response_times',
      'auth_attempts',
      'email_log',
    ];
    await Promise.allSettled(
      tablesToClear.map(table => supabaseAdmin.from(table).delete().eq('user_id', userId))
    );
    await Promise.allSettled([
      supabaseAdmin.from('referrals').delete().eq('referrer_user_id', userId),
      supabaseAdmin.from('referrals').delete().eq('referred_user_id', userId),
    ]);

    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/delete-user]', err.message);
    return res.status(500).json({ error: err.message || 'Internal server error' });
  }
}

// action: "reset-usage" — clears Upstash rate limit keys for a user so they can make requests again
// Clears both user-day keys (matched by userId) and IP keys (matched by last known IP from auth_attempts)
async function handleResetUsage(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;
  const rl = await rateLimitCheck(req, { userDay: 50, ipDay: 60, prefix: 'admin:reset-usage' });
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limited' });

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
    return res.status(500).json({ error: 'Internal server error' });
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
    return res.status(500).json({ error: 'Internal server error' });
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
    const redis       = getAdminRedis();
    const userRlKeys  = await redis.keys(`rl:*${userId}*`);
    const allRlSample = await redis.keys('rl:*');
    return res.status(200).json({
      keys_for_user:       userRlKeys   || [],
      all_rl_keys_sample:  (allRlSample || []).slice(0, 20),
    });
  } catch (err) {
    console.error('[admin/debug-redis-keys]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// action: "grant-entitlement" — admin grants student or defense plan to a user at no charge
async function handleGrantEntitlement(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;
  const rl = await rateLimitCheck(req, { userDay: 20, ipDay: 30, prefix: 'admin:grant-entitlement' });
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limited' });

  const { userId, plan } = req.body || {};
  if (!userId || !['student', 'defense', 'express'].includes(plan)) {
    return res.status(400).json({ error: 'userId and plan (student|defense|express) required' });
  }

  try {
    console.log(`[audit] action=grant-entitlement admin=${caller.email} target=${userId} plan=${plan} at=${new Date().toISOString()}`);
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
    } else if (plan === 'express') {
      features.add('express_defense');
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
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// action: "ban-user"
// SQL required (run once in Supabase SQL Editor):
//   ALTER TABLE user_entitlements
//   ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ DEFAULT NULL;
async function handleBanUser(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;
  const rl = await rateLimitCheck(req, { userDay: 20, ipDay: 30, prefix: 'admin:ban-user' });
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limited' });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    console.log(`[audit] action=ban-user admin=${caller.email} target=${userId} at=${new Date().toISOString()}`);

    // 1. Server-side enforcement: ban at the GoTrue auth level so the user's JWT
    // can no longer be refreshed and is rejected by supabaseAdmin.auth.getUser()
    // across every API endpoint. Without this, the ban is cosmetic — a banned
    // user holding a valid token could still call /api/* directly.
    // 876000h ≈ 100 years. Use 'none' to lift (see unban-user).
    const { error: authBanErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: '876000h',
    });
    if (authBanErr) throw authBanErr;

    // 2. Mirror into user_entitlements so the admin dashboard shows banned status
    // and ProtectedRoute can sign the user out immediately on their next page load.
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
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// action: "unban-user" — clears banned_until so the user can access the app again
async function handleUnbanUser(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;
  const rl = await rateLimitCheck(req, { userDay: 20, ipDay: 30, prefix: 'admin:unban-user' });
  if (!rl.allowed) return res.status(429).json({ error: 'Rate limited' });

  const { userId } = req.body || {};
  if (!userId) return res.status(400).json({ error: 'userId required' });

  try {
    console.log(`[audit] action=unban-user admin=${caller.email} target=${userId} at=${new Date().toISOString()}`);

    // 1. Lift the GoTrue auth-level ban so the user can log in / refresh again.
    const { error: authUnbanErr } = await supabaseAdmin.auth.admin.updateUserById(userId, {
      ban_duration: 'none',
    });
    if (authUnbanErr) throw authUnbanErr;

    // 2. Clear the mirrored flag in user_entitlements.
    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert({
        user_id:      userId,
        banned_until: null,
        updated_at:   new Date().toISOString(),
      }, { onConflict: 'user_id' });
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/unban-user]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// action: "self-delete"
// Called by the authenticated user to permanently delete their own account.
// Verifies the user's own JWT — does NOT require ADMIN_EMAIL.
// Deletes all user data across every table, then deletes auth.users.
// Tables with CASCADE (handled automatically by deleteUser):
//   public.users → user_entitlements, projects, project_steps,
//                  defense_sessions, defense_turns, payments
// generation_failures and payment_issues use ON DELETE SET NULL — rows kept for admin.
// All other user-data tables are deleted explicitly before the auth delete.
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
    // 1. Explicitly delete from tables not guaranteed to CASCADE.
    //    Each delete is independent — a missing table or empty result is non-fatal.
    const singleColumnTables = [
      'notifications',
      'user_progress',
      'defense_certificates',
      'defense_credits',
      'feature_feedback',
      'email_preferences',
      'user_onboarding',
      'response_times',
      'auth_attempts',
      'email_log',
    ];
    await Promise.allSettled(
      singleColumnTables.map(table =>
        supabaseAdmin.from(table).delete().eq('user_id', userId)
      )
    );

    // referrals may store user as referrer or referred party
    await Promise.allSettled([
      supabaseAdmin.from('referrals').delete().eq('referrer_user_id', userId),
      supabaseAdmin.from('referrals').delete().eq('referred_user_id', userId),
    ]);

    // 2. Delete Upstash Redis rate-limit keys for this user (non-fatal if Redis unavailable).
    if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
      try {
        const redis = getAdminRedis();
        const found = await redis.keys(`*${userId}*`);
        const userKeys = (found || []).filter(k => k.startsWith('rl:user:'));
        if (userKeys.length > 0) await redis.del(...userKeys);
      } catch (redisErr) {
        console.error('[admin/self-delete] Redis cleanup non-fatal:', redisErr.message);
      }
    }

    // 3. Delete auth user — cascades through public.users to all dependent tables.
    const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (error) throw error;

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/self-delete]', err.message);
    return res.status(500).json({ error: 'Internal server error' });
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
    return res.status(500).json({ error: 'Internal server error' });
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

    const issues  = data || [];
    const userIds = [...new Set(issues.map(i => i.user_id).filter(Boolean))];
    let emailMap  = {};
    if (userIds.length > 0) {
      const { data: usersData } = await supabaseAdmin
        .from('users')
        .select('id, email')
        .in('id', userIds);
      for (const u of usersData || []) emailMap[u.id] = u.email;
    }

    return res.status(200).json({
      issues: issues.map(i => ({ ...i, user_email: emailMap[i.user_id] || null })),
    });
  } catch (err) {
    console.error('[admin/payment-issues] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
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
    return res.status(500).json({ error: 'Internal server error' });
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
  const ref = transactionRef?.trim() ?? '';
  if (!ref) return res.status(400).json({ error: 'Transaction reference is required.' });
  if (!/^[A-Za-z0-9_-]{8,100}$/.test(ref)) return res.status(400).json({ error: 'Transaction reference format is invalid.' });

  try {
    const { error: insertError } = await supabaseAdmin.from('payment_issues').insert({
      user_id:         userId,
      transaction_ref: ref,
      description:     description?.trim() || null,
    });
    if (insertError) throw insertError;
  } catch (err) {
    console.error('[admin/report-payment-issue] insert error:', err?.message, err?.code, err?.details);
    return res.status(500).json({ error: 'Failed to save report. Please email hello@fypro.com.ng directly.' });
  }

  const resend = new Resend(process.env.RESEND_API_KEY);
  await Promise.allSettled([
    resend.emails.send({
      from:    'FYPro Alerts <hello@fypro.com.ng>',
      to:      'hello@fypro.com.ng',
      subject: `URGENT: Payment issue — ${userEmail}`,
      html: `<div style="font-family:Arial,sans-serif;max-width:520px;margin:0 auto;"><h2 style="color:#DC2626;">⚠️ Payment Issue Report</h2><table style="width:100%;border-collapse:collapse;"><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>User email:</strong></td><td style="padding:8px 0;font-size:14px;">${userEmail}</td></tr><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>User ID:</strong></td><td style="padding:8px 0;font-size:14px;font-family:monospace;">${userId}</td></tr><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>Transaction ref:</strong></td><td style="padding:8px 0;font-size:14px;font-family:monospace;">${ref}</td></tr><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>Description:</strong></td><td style="padding:8px 0;font-size:14px;">${description?.trim() || '(none)'}</td></tr><tr><td style="padding:8px 0;color:#555;font-size:14px;"><strong>Reported at:</strong></td><td style="padding:8px 0;font-size:14px;">${new Date().toISOString()}</td></tr></table><p style="margin-top:24px;color:#333;font-size:14px;">Resolve in the <a href="https://www.fypro.com.ng/admin/health">admin dashboard</a>.</p></div>`,
    }).catch(e => console.error('[admin/report-payment-issue] resend error:', e.message)),
    sendTelegramAlert(
      `🚨 Payment issue reported: ${userEmail} says they paid but don't have access.\nRef: ${ref}\nCheck Paystack dashboard.`
    ).catch(e => console.error('[admin/report-payment-issue] telegram error:', e.message)),
  ]);

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
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const sig      = req.headers['sentry-hook-signature'] || '';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const sigBuf   = Buffer.from(sig);
  const expBuf   = Buffer.from(expected);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    console.error('[sentry-webhook] invalid signature');
    return res.status(401).json({ error: 'Unauthorized' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  // Issue lifecycle webhooks (issue.created, issue.unresolved, etc.) use data.issue.
  // Error Alert Rule webhooks use data.event. Support both.
  const event      = payload?.data?.event || payload?.data?.issue || {};
  const level      = event.level || 'error';
  const title      = String(event.title || event.metadata?.value || 'Unknown Sentry event').slice(0, 200);
  const tags       = Array.isArray(event.tags) ? event.tags : [];
  const featureTag = tags.find(([k]) => k === 'feature');
  const feature    = featureTag ? featureTag[1] : (event.project?.slug || 'Unknown');

  await writeSystemLog({
    severity:      mapSentryLevel(level),
    feature,
    source:        'sentry',
    plain_message: title,
    raw_detail:    payload,
  });

  if (level === 'fatal' || level === 'error') {
    await sendTelegramAlert(`🚨 Sentry ${level}: [${feature}]\n${title}`);
  } else if (level === 'warning') {
    await sendTelegramAlert(`⚠️ Sentry warning: [${feature}]\n${title}`);
  }

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
    return res.status(500).json({ error: 'Internal server error' });
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
    return res.status(500).json({ error: 'Internal server error' });
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
          body:    JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
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

// action: "test-sentry-webhook" — POSTs a fake signed Sentry payload to the webhook endpoint
// and returns whether the signature check passed and Telegram alert was sent.
async function handleTestSentryWebhook(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const secret = process.env.SENTRY_WEBHOOK_SECRET;
  if (!secret) {
    return res.status(500).json({ ok: false, error: 'SENTRY_WEBHOOK_SECRET is not set in Vercel env — webhook will reject all Sentry requests' });
  }

  const appUrl = process.env.APP_URL || 'https://www.fypro.com.ng';
  const payload = JSON.stringify({
    action: 'created',
    data: {
      event: {
        level:   'error',
        title:   '[TEST] Sentry webhook self-test — FYPro admin',
        tags:    [['feature', 'sentry-webhook-test']],
      },
    },
  });

  const sig = crypto.createHmac('sha256', secret).update(payload).digest('hex');

  try {
    const r = await fetch(`${appUrl}/api/admin?action=sentry_webhook`, {
      method:  'POST',
      headers: {
        'Content-Type':                    'application/json',
        'sentry-hook-signature':           sig,
        'sentry-hook-resource':            'event_alert',
      },
      body: payload,
    });
    const data = await r.json().catch(() => ({}));
    return res.status(200).json({ ok: r.ok, status: r.status, response: data });
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
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
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// action: "submit-rating" — authenticated users only (no admin gate)
async function handleSubmitRating(req, res) {
  // Rate limit: 3 req/user/day, 10 req/IP/hour
  const rl = await rateLimitCheck(req, { userDay: 3, ipDay: 10, prefix: 'rating' });
  if (!rl.allowed) return res.status(429).json({ error: 'Too many requests. Please try again tomorrow.' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let user;
  try {
    const { data, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !data?.user) return res.status(401).json({ error: 'Unauthorized' });
    user = data.user;
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const v = validate(SubmitRatingSchema, req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });

  const { stars, trigger_type, feature, suggestion_feature, suggestion_ui } = req.body;

  const { error: insertErr } = await supabaseAdmin.from('user_ratings').insert({
    user_id:            user.id,
    stars,
    trigger_type,
    feature,
    suggestion_feature: suggestion_feature ?? null,
    suggestion_ui:      suggestion_ui ?? null,
  });
  if (insertErr) {
    console.error('[admin/submit-rating] insert error:', insertErr.message);
    return res.status(500).json({ error: 'Failed to save rating' });
  }

  const starStr   = '★'.repeat(stars) + '☆'.repeat(5 - stars);
  const featLine  = suggestion_feature ? `\n💡 Feature request: "${suggestion_feature.slice(0, 120)}"` : '';
  const uiLine    = suggestion_ui      ? `\n🎨 UI feedback: "${suggestion_ui.slice(0, 120)}"` : '';

  await sendTelegramAlert(
    `⭐ <b>New Rating</b>\n` +
    `👤 ${user.email}\n` +
    `📋 Feature: ${feature}\n` +
    `⭐ Stars: ${starStr} (${stars}/5)` +
    featLine +
    uiLine
  ).catch(err => console.error('[admin/submit-rating] Telegram error:', err.message));

  return res.status(200).json({ ok: true });
}

// action: "get-ratings" — admin only
async function handleGetRatings(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from('user_ratings')
      .select('id, user_id, stars, trigger_type, feature, suggestion_feature, suggestion_ui, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (fetchErr) throw fetchErr;

    const allRows = rows || [];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const total          = allRows.length;
    const withSuggestions = allRows.filter(r => r.suggestion_feature || r.suggestion_ui).length;
    const thisWeek       = allRows.filter(r => r.created_at >= weekAgo).length;
    const avgStars       = total > 0
      ? parseFloat((allRows.reduce((s, r) => s + r.stars, 0) / total).toFixed(1))
      : 0;

    const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    const byTriggerAcc = {};
    for (const r of allRows) {
      distribution[String(r.stars)] = (distribution[String(r.stars)] || 0) + 1;
      if (!byTriggerAcc[r.trigger_type]) byTriggerAcc[r.trigger_type] = { sum: 0, count: 0 };
      byTriggerAcc[r.trigger_type].sum += r.stars;
      byTriggerAcc[r.trigger_type].count++;
    }
    const by_trigger = {};
    for (const [k, v] of Object.entries(byTriggerAcc)) {
      by_trigger[k] = { avg: parseFloat((v.sum / v.count).toFixed(1)), count: v.count };
    }

    const recent = allRows.slice(0, 20);
    const emailMap = {};
    await Promise.all(
      [...new Set(recent.map(r => r.user_id))].map(async uid => {
        try {
          const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(uid);
          if (user) emailMap[uid] = user.email;
        } catch {}
      })
    );

    return res.status(200).json({
      stats: { avg_stars: avgStars, total, with_suggestions: withSuggestions, this_week: thisWeek, by_trigger, distribution },
      recent: recent.map(r => ({ ...r, user_email: emailMap[r.user_id] || '—' })),
    });
  } catch (err) {
    console.error('[admin/get-ratings] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── Nurture email dispatcher helpers ────────────────────────────────────────

const NURTURE_BASE_URL = 'https://www.fypro.com.ng';
const NURTURE_FROM     = 'FYPro <hello@fypro.com.ng>';
const NURTURE_UNSUB    = '<mailto:unsubscribe@fypro.com.ng>, <https://fypro.com.ng/account/email-preferences>';
const NURTURE_SUBJECTS = {
  welcome:          'Welcome to FYPro — validate your topic now',
  defense_nudge:    'Have you met your AI examiners yet?',
  urgency_reminder: 'Defense checklist — where do you stand?',
};

function buildNurtureHtml(type, name) {
  const n = name ? name.split(' ')[0] : 'there';
  const logo = `<div style="background:linear-gradient(160deg,#0D1B2A 0%,#0a1520 100%);padding:20px 22px;text-align:center;"><img src="${NURTURE_BASE_URL}/fypro-logo.png" alt="FYPro" style="height:40px;width:auto;display:block;margin:0 auto;" /></div>`;
  const divider = `<hr style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:18px 0 14px;">`;
  const ftr = `${divider}<p style="font-size:10.5px;color:rgba(255,255,255,0.2);line-height:1.6;margin:0;">You're receiving this because you signed up at fypro.com.ng<br>FYPro · Lagos, Nigeria · <a href="${NURTURE_BASE_URL}/account/email-preferences" style="color:rgba(255,255,255,0.3);">Manage preferences</a></p>`;
  const wrap = (accent, pillBg, pillBorder, pillLabel, body) =>
    `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#060E18;font-family:Arial,sans-serif;"><div style="max-width:560px;margin:0 auto;padding:32px 16px;"><div style="height:3px;background:${accent};border-radius:8px 8px 0 0;"></div>${logo}<div style="background:#0D1B2A;padding:28px;border-radius:0 0 12px 12px;border:1px solid rgba(255,255,255,0.06);border-top:none;"><span style="display:inline-block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;border-radius:4px;padding:3px 8px;margin-bottom:14px;border:1px solid ${pillBorder};background:${pillBg};color:${accent};">${pillLabel}</span>${body}${ftr}</div></div></body></html>`;
  if (type === 'welcome') return wrap('#16A34A', 'rgba(22,163,74,0.08)', 'rgba(22,163,74,0.3)', 'Welcome', `<h1 style="font-size:17px;font-weight:700;color:#f8fafc;line-height:1.35;margin:0 0 10px;">${n}, your research journey starts today.</h1><p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.75;margin:0 0 18px;">You've joined thousands of Nigerian final year students who are taking their project seriously. Your next step is simple — paste your topic idea and find out if it's defensible before your supervisor ever sees it.</p><a href="${NURTURE_BASE_URL}/app" style="display:inline-block;background:#16A34A;color:#ffffff;border-radius:8px;padding:11px 20px;font-size:13px;font-weight:700;text-decoration:none;">Validate your topic now →</a>`);
  if (type === 'defense_nudge') return wrap('#0066FF', 'rgba(0,102,255,0.08)', 'rgba(0,102,255,0.3)', 'Defense Prep', `<h1 style="font-size:17px;font-weight:700;color:#f8fafc;line-height:1.35;margin:0 0 10px;">${n}, have you met your examiners yet?</h1><p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.75;margin:0 0 18px;">Most students walk into their defense never having practiced out loud. FYPro's Defense Simulator puts you in front of three AI examiners who push back exactly the way the real panel will. Find out where you're weak before it matters.</p><a href="${NURTURE_BASE_URL}/app" style="display:inline-block;background:#0066FF;color:#ffffff;border-radius:8px;padding:11px 20px;font-size:13px;font-weight:700;text-decoration:none;">Try a Defense Simulation →</a>`);
  return wrap('#DC2626', 'rgba(220,38,38,0.08)', 'rgba(220,38,38,0.3)', 'Checklist', `<h1 style="font-size:17px;font-weight:700;color:#f8fafc;line-height:1.35;margin:0 0 10px;">${n} — a week in. Are you ready?</h1><p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.75;margin:0 0 8px;">The clock is moving. Run through this before you do anything else:</p><p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.75;margin:0 0 8px;">☐ &nbsp; Topic locked and validated?</p><p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.75;margin:0 0 8px;">☐ &nbsp; Methodology chosen and defensible?</p><p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.75;margin:0 0 8px;">☐ &nbsp; Project PDF uploaded for review?</p><p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.75;margin:0 0 18px;">☐ &nbsp; Defense Simulator score 7 or above?</p><a href="${NURTURE_BASE_URL}/app" style="display:inline-block;background:#DC2626;color:#ffffff;border-radius:8px;padding:11px 20px;font-size:13px;font-weight:700;text-decoration:none;">Open my dashboard →</a>`);
}

async function sendOneNurtureEmail(resend, userId, email, name, emailType) {
  let resendId = null;
  let status   = 'sent';
  try {
    const { data, error } = await resend.emails.send({
      from:    NURTURE_FROM,
      to:      email,
      subject: NURTURE_SUBJECTS[emailType],
      html:    buildNurtureHtml(emailType, name || ''),
      headers: { 'List-Unsubscribe': NURTURE_UNSUB, 'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click' },
    });
    if (error) throw new Error(error.message);
    resendId = data?.id ?? null;
  } catch (err) {
    status = 'failed';
    console.error('[dispatch-nurture] send error', { userId, emailType, err: err.message });
  }
  try {
    await supabaseAdmin.from('email_log').insert({ user_id: userId, email_type: emailType, resend_id: resendId, status });
  } catch (dbErr) {
    if (dbErr?.code !== '23505') console.error('[dispatch-nurture] email_log insert failed', { userId, emailType });
  }
  return { userId, emailType, status };
}

// action: "dispatch-nurture-emails"
// Called daily by cron-job.org at 09:00 UTC.
// Sends defense_nudge (Day 3), urgency_reminder (Day 7), and welcome fallback (missed on signup).
// Auth: x-cron-secret header or Authorization: Bearer CRON_SECRET.
async function handleDispatchNurtureEmails(req, res) {
  if (!verifyCronSecret(req, res)) return;

  const now    = Date.now();
  const DAY    = 24 * 60 * 60 * 1000;
  const WINDOW = 13 * 60 * 60 * 1000; // ±13h so a daily cron never misses anyone

  const nudgeStart   = new Date(now - 3 * DAY - WINDOW).toISOString();
  const nudgeEnd     = new Date(now - 3 * DAY + WINDOW).toISOString();
  const remindStart  = new Date(now - 7 * DAY - WINDOW).toISOString();
  const remindEnd    = new Date(now - 7 * DAY + WINDOW).toISOString();
  const welcomeStart = new Date(now - 2 * DAY).toISOString(); // catch anyone missed in last 48h

  try {
    const resend = new Resend(process.env.RESEND_API_KEY);

    const [nudgeRes, remindRes, welcomeCandRes] = await Promise.all([
      supabaseAdmin.from('users').select('id, email, full_name').gte('created_at', nudgeStart).lte('created_at', nudgeEnd),
      supabaseAdmin.from('users').select('id, email, full_name').gte('created_at', remindStart).lte('created_at', remindEnd),
      supabaseAdmin.from('users').select('id, email, full_name').gte('created_at', welcomeStart),
    ]);

    const nudgeUsers   = nudgeRes.data   || [];
    const remindUsers  = remindRes.data  || [];
    const welcomeCands = welcomeCandRes.data || [];

    const allIds = [...new Set([
      ...nudgeUsers.map(u => u.id),
      ...remindUsers.map(u => u.id),
      ...welcomeCands.map(u => u.id),
    ])];

    const sentinel = '00000000-0000-0000-0000-000000000000';
    const [logRes, prefsRes] = await Promise.all([
      supabaseAdmin.from('email_log').select('user_id, email_type').in('user_id', allIds.length ? allIds : [sentinel]),
      supabaseAdmin.from('email_preferences').select('user_id, welcome_enabled, defense_nudge_enabled, urgency_reminder_enabled, unsubscribed_all').in('user_id', allIds.length ? allIds : [sentinel]),
    ]);

    const sent    = new Set((logRes.data || []).map(r => `${r.user_id}:${r.email_type}`));
    const prefs   = {};
    for (const p of prefsRes.data || []) prefs[p.user_id] = p;

    const results = [];

    // Welcome fallback — users who never received welcome
    for (const u of welcomeCands) {
      if (sent.has(`${u.id}:welcome`)) continue;
      const p = prefs[u.id];
      if (p?.unsubscribed_all || p?.welcome_enabled === false) { results.push({ userId: u.id, emailType: 'welcome', status: 'skipped_optout' }); continue; }
      results.push(await sendOneNurtureEmail(resend, u.id, u.email, u.full_name, 'welcome'));
    }

    // Day-3 defense_nudge
    for (const u of nudgeUsers) {
      if (sent.has(`${u.id}:defense_nudge`)) { results.push({ userId: u.id, emailType: 'defense_nudge', status: 'skipped_duplicate' }); continue; }
      const p = prefs[u.id];
      if (p?.unsubscribed_all || p?.defense_nudge_enabled === false) { results.push({ userId: u.id, emailType: 'defense_nudge', status: 'skipped_optout' }); continue; }
      results.push(await sendOneNurtureEmail(resend, u.id, u.email, u.full_name, 'defense_nudge'));
    }

    // Day-7 urgency_reminder
    for (const u of remindUsers) {
      if (sent.has(`${u.id}:urgency_reminder`)) { results.push({ userId: u.id, emailType: 'urgency_reminder', status: 'skipped_duplicate' }); continue; }
      const p = prefs[u.id];
      if (p?.unsubscribed_all || p?.urgency_reminder_enabled === false) { results.push({ userId: u.id, emailType: 'urgency_reminder', status: 'skipped_optout' }); continue; }
      results.push(await sendOneNurtureEmail(resend, u.id, u.email, u.full_name, 'urgency_reminder'));
    }

    const sentCount    = results.filter(r => r.status === 'sent').length;
    const skippedCount = results.filter(r => r.status?.startsWith('skipped')).length;
    const failedCount  = results.filter(r => r.status === 'failed').length;
    console.log(`[dispatch-nurture] done — sent:${sentCount} skipped:${skippedCount} failed:${failedCount}`);
    return res.status(200).json({ ok: true, sent: sentCount, skipped: skippedCount, failed: failedCount, results });
  } catch (err) {
    console.error('[dispatch-nurture-emails] fatal error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// action: "daily-report"
// Triggered by Vercel cron or external cron (cron-job.org).
// Accepts either Vercel-native (Authorization: Bearer) or x-cron-secret header.
// Aggregates today's key metrics and posts a summary to Telegram.
async function handleDailyReport(req, res) {
  if (!verifyCronSecret(req, res)) return;

  try {
    const today      = new Date().toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00.000Z`;
    const cap        = parseFloat(process.env.DAILY_CAP_USD || '10');

    const [
      authUsers,
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
      orphanedPaymentsRes,
    ] = await Promise.all([
      listAllAuthUsers(),
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
      supabaseAdmin
        .from('payments')
        .select('paystack_reference, tier, created_at')
        .eq('status', 'pending')
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10),
    ]);

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

    const orphanedRows = orphanedPaymentsRes.data || [];
    if (orphanedPaymentsRes.error) {
      console.warn('[admin/daily-report] orphaned payments query failed:', orphanedPaymentsRes.error.message);
    }
    const orphanedSection = orphanedRows.length > 0
      ? [
          ``,
          `⚠️ Orphaned Payments (${orphanedRows.length} stuck >24h)`,
          ...orphanedRows.slice(0, 3).map(p => {
            const age = Math.round((Date.now() - new Date(p.created_at).getTime()) / 3600000);
            return `- ${p.tier} | ${p.paystack_reference} | ${age}h ago`;
          }),
          ...(orphanedRows.length > 3 ? [`- ...and ${orphanedRows.length - 3} more`] : []),
        ]
      : [];

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
      ...orphanedSection,
    ].join('\n');

    await sendTelegramAlert(message);
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/daily-report] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
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
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// action: "get-express-beta" — admin only
async function handleGetExpressBeta(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const { data, error } = await supabaseAdmin
      .from('app_config')
      .select('key, value, updated_at')
      .eq('key', 'express_beta_free')
      .maybeSingle();

    if (error) throw error;

    return res.status(200).json({
      express_beta_free: data?.value === 'true',
      updated_at:        data?.updated_at || null,
    });
  } catch (err) {
    console.error('[admin/get-express-beta] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// action: "set-express-beta" — admin only
async function handleSetExpressBeta(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { enabled } = req.body || {};
  if (typeof enabled !== 'boolean') {
    return res.status(400).json({ error: 'enabled (boolean) required' });
  }

  try {
    await setExpressBetaFree(enabled);

    sendTelegramAlert(
      `🎓 Express beta mode ${enabled ? 'ENABLED 🟢 — Express Defence is now free for all users' : 'DISABLED 🔒 — ₦2,000 paywall restored'}`
    ).catch(() => {});

    return res.status(200).json({ ok: true, express_beta_free: enabled });
  } catch (err) {
    console.error('[admin/set-express-beta] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// action: "express-beta-info" — public, no auth
async function handleExpressBetaInfo(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const active = await getExpressBetaFree();
    return res.status(200).json({ express_beta_free: active });
  } catch {
    return res.status(200).json({ express_beta_free: false });
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
    return res.status(500).json({ error: 'Internal server error' });
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
    return res.status(500).json({ error: 'Internal server error' });
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

// action: "check-rating-force" — public, no auth required
// Called by AppShell on mount to decide whether to force-show the rating modal.
async function handleCheckRatingForce(req, res) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const force = await getRatingForce();
    return res.status(200).json({ force });
  } catch {
    return res.status(200).json({ force: false });
  }
}

// action: "get-rating-force" — admin only
async function handleGetRatingForce(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const { data } = await supabaseAdmin
      .from('app_config')
      .select('value, updated_at')
      .eq('key', 'rating_modal_force')
      .maybeSingle();
    return res.status(200).json({
      enabled:    data?.value === 'true',
      updated_at: data?.updated_at || null,
    });
  } catch (err) {
    console.error('[admin/get-rating-force] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// action: "set-rating-force" — admin only
async function handleSetRatingForce(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { enabled } = req.body;

  try {
    await setRatingForceLib(!!enabled);

    await sendTelegramAlert(
      `⭐ <b>Rating Modal Force: ${enabled ? 'ON' : 'OFF'}</b>\n` +
      `👤 ${caller.email}`
    ).catch(() => {});

    return res.status(200).json({ ok: true, enabled: !!enabled });
  } catch (err) {
    console.error('[admin/set-rating-force] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

// ─── action: sync-run-counts ──────────────────────────────────────────────────
// Moved from api/ai.js — belongs in admin/entitlements surface, not the AI proxy.

async function handleSyncRunCounts(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  let user;
  try {
    const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !data?.user) return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    user = data.user;
  } catch (authErr) {
    console.error('[admin/sync-run-counts] auth.getUser threw:', authErr.message);
    return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
  }

  const { run_counts } = req.body || {};
  if (!run_counts || typeof run_counts !== 'object' || Array.isArray(run_counts)) {
    return res.status(400).json({ error: 'run_counts must be a plain object.' });
  }

  try {
    const { data: existing } = await supabaseAdmin
      .from('user_entitlements')
      .select('run_counts')
      .eq('user_id', user.id)
      .maybeSingle();

    const serverCounts = (existing?.run_counts && typeof existing.run_counts === 'object')
      ? existing.run_counts
      : {};

    const merged = { ...serverCounts };
    for (const k of Object.keys(run_counts)) {
      if (k === '_reset_at') { merged[k] = run_counts[k]; continue; }
      const clientVal = typeof run_counts[k] === 'number' ? run_counts[k] : 0;
      const serverVal = typeof serverCounts[k] === 'number' ? serverCounts[k] : 0;
      merged[k] = Math.max(clientVal, serverVal);
    }

    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert(
        { user_id: user.id, run_counts: merged, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select('user_id');

    if (error) {
      console.error('[admin/sync-run-counts] upsert error:', error.message);
      return res.status(500).json({ error: 'Failed to sync run counts.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/sync-run-counts] error:', err.message);
    return res.status(500).json({ error: 'Unexpected error syncing run counts.' });
  }
}

const ERROR_SPIKE_THRESHOLD = 5;

// action: "error-check" — cron-triggered (every 4 hours via cron-job.org).
// Fires a Telegram alert if unresolved errors in the last 24h exceed the threshold.
// Deduplicated via Redis so at most one alert fires per UTC day.
async function handleErrorCheck(req, res) {
  if (!verifyCronSecret(req, res)) return;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const today    = new Date().toISOString().slice(0, 10);

  let errorCount = 0;
  try {
    const { count, error } = await supabaseAdmin
      .from('system_logs')
      .select('*', { count: 'exact', head: true })
      .eq('severity', 'error')
      .eq('resolved', false)
      .gte('created_at', since24h);

    if (error) throw error;
    errorCount = count || 0;
  } catch (err) {
    console.error('[admin/error-check] DB query failed:', err.message);
    return res.status(500).json({ error: 'DB query failed' });
  }

  if (errorCount <= ERROR_SPIKE_THRESHOLD) {
    return res.status(200).json({ ok: true, error_count: errorCount, alert_sent: false });
  }

  // Deduplicate: only fire once per UTC day
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    console.error('[admin/error-check] Redis not configured — cannot deduplicate, skipping alert');
    return res.status(500).json({ error: 'Redis not configured' });
  }

  let alertSent = false;
  try {
    const redis     = getAdminRedis();
    const dedupeKey = `alert:error-spike:${today}`;
    const result    = await redis.set(dedupeKey, '1', { nx: true, ex: 90000 });
    // result is 'OK' when the key was freshly set (first alert of the day)
    // result is null when the key already existed (alert already sent today)
    if (result === 'OK') {
      await sendTelegramAlert(
        `🚨 Error spike: <b>${errorCount}</b> unresolved errors in the last 24h\nCheck /errors in the admin bot.`
      );
      alertSent = true;
    }
  } catch (err) {
    console.error('[admin/error-check] Redis/Telegram failed:', err.message);
    // Non-fatal — still return success so cron doesn't retry aggressively
  }

  return res.status(200).json({ ok: true, error_count: errorCount, alert_sent: alertSent });
}

// action: "ping" — public health check for UptimeRobot and other external monitors.
// No auth required. Returns 200 as long as the function is reachable.
async function handlePing(req, res) {
  return res.status(200).json({ ok: true, service: 'fypro', ts: Date.now() });
}

// ── Data Tab helpers ────────────────────────────────────────────────────────

// Groups rows by date bucket for the last `days` days, returns [{date,count}]
function groupByDay(rows, dateField, days) {
  const result = {}
  const now = new Date()
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now)
    d.setDate(d.getDate() - i)
    result[d.toISOString().slice(0, 10)] = 0
  }
  for (const row of rows) {
    const key = (row[dateField] || '').slice(0, 10)
    if (key in result) result[key]++
  }
  return Object.entries(result).map(([date, count]) => ({ date, count }))
}

// Groups rows by a string field, returns [{name,value}] sorted desc by value
function groupByField(rows, field) {
  const result = {}
  for (const row of rows) {
    const key = String(row[field] || 'unknown')
    result[key] = (result[key] || 0) + 1
  }
  return Object.entries(result)
    .sort((a, b) => b[1] - a[1])
    .map(([name, value]) => ({ name, value }))
}

// Buckets defense session scores into 10 slots (score 1–10), returns [{bucket,count}]
function scoreHistogram(rows) {
  const buckets = Array.from({ length: 10 }, (_, i) => ({ bucket: i + 1, count: 0 }))
  for (const row of rows) {
    const s = Math.round(row.total_score || 0)
    if (s >= 1 && s <= 10) buckets[s - 1].count++
  }
  return buckets
}

// action: "data-tab" — curated KPIs + 8 chart datasets + 29 table row counts
async function handleDataTab(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !caller) return res.status(401).json({ error: 'Unauthorized' })
    if (!process.env.ADMIN_EMAIL || caller.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const today        = new Date().toISOString().slice(0, 10)
    const todayStart   = `${today}T00:00:00.000Z`
    const sevenDaysAgo = new Date(Date.now() - 7  * 86400000).toISOString()
    const thirtyDaysAgo= new Date(Date.now() - 30 * 86400000).toISOString()

    // ── Parallel data fetches ────────────────────────────────────────────────
    const [
      { count: totalUsers },
      { count: usersToday },
      { data: successPayments },
      { data: todayPayments },
      { count: totalSessions },
      { data: sessionScores },
      { count: totalCerts },
      { data: usersByDayRows },
      { data: paymentTierRows },
      { data: projectRows },
      { data: certRows },
      { data: achievementRows },
      { data: referralRows },
      { data: failureRows },
    ] = await Promise.all([
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', todayStart),
      supabaseAdmin.from('payments').select('amount_kobo').eq('status', 'success'),
      supabaseAdmin.from('payments').select('amount_kobo').eq('status', 'success').gte('created_at', todayStart),
      supabaseAdmin.from('defense_sessions').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('defense_sessions').select('total_score').not('total_score', 'is', null),
      supabaseAdmin.from('defense_certificates').select('*', { count: 'exact', head: true }),
      supabaseAdmin.from('users').select('created_at').gte('created_at', sevenDaysAgo),
      supabaseAdmin.from('payments').select('tier, amount_kobo').eq('status', 'success'),
      supabaseAdmin.from('projects').select('status, mode'),
      supabaseAdmin.from('defense_certificates').select('issued_at').gte('issued_at', thirtyDaysAgo),
      supabaseAdmin.from('user_achievements').select('achievement_key'),
      supabaseAdmin.from('referrals').select('created_at').gte('created_at', thirtyDaysAgo),
      supabaseAdmin.from('generation_failures').select('feature'),
    ])

    // ── KPIs ────────────────────────────────────────────────────────────────
    const revenueNgn      = Math.round((successPayments || []).reduce((s, r) => s + (r.amount_kobo || 0), 0) / 100)
    const revenueTodayNgn = Math.round((todayPayments  || []).reduce((s, r) => s + (r.amount_kobo || 0), 0) / 100)
    const avgScore        = sessionScores?.length
      ? parseFloat((sessionScores.reduce((s, r) => s + (r.total_score || 0), 0) / sessionScores.length).toFixed(1))
      : 0
    const passRate        = totalSessions > 0
      ? parseFloat(((totalCerts / totalSessions) * 100).toFixed(1))
      : 0

    // ── Payment tier revenue (in ₦) ─────────────────────────────────────────
    const tierMap = {}
    for (const r of paymentTierRows || []) {
      const t = r.tier || 'unknown'
      tierMap[t] = (tierMap[t] || 0) + (r.amount_kobo || 0)
    }
    const paymentsByTier = Object.entries(tierMap)
      .sort((a, b) => b[1] - a[1])
      .map(([name, kobo]) => ({ name, value: Math.round(kobo / 100) }))

    // ── Table row counts (all 29 tables in parallel) ─────────────────────────
    const ALL_TABLES = [
      'admin_users','app_config','auth_attempts','daily_usage',
      'defense_certificates','defense_credits','defense_sessions','defense_turns',
      'email_log','email_preferences','feature_feedback','generation_failures',
      'institutions','notifications','payment_issues','payments',
      'project_steps','projects','push_subscriptions','referrals',
      'response_times','system_logs','user_achievements','user_entitlements',
      'user_onboarding','user_progress','user_ratings','user_reports','users',
    ]
    const countResults = await Promise.all(
      ALL_TABLES.map(t =>
        supabaseAdmin.from(t).select('*', { count: 'exact', head: true })
          .then(({ count, error }) => [t, error ? 0 : (count || 0)])
      )
    )
    const tableCounts = Object.fromEntries(countResults)

    return res.status(200).json({
      kpis: {
        total_users:       totalUsers    || 0,
        users_today:       usersToday    || 0,
        revenue_ngn:       revenueNgn,
        revenue_today_ngn: revenueTodayNgn,
        defense_sessions:  totalSessions || 0,
        avg_score:         avgScore,
        certificates:      totalCerts    || 0,
        pass_rate:         passRate,
      },
      charts: {
        users_by_day:       groupByDay(usersByDayRows   || [], 'created_at', 7),
        payments_by_tier:   paymentsByTier,
        projects_by_status: groupByField(projectRows    || [], 'status'),
        projects_by_mode:   groupByField(projectRows    || [], 'mode'),
        defense_score_histogram: scoreHistogram(sessionScores || []),
        certs_by_day:            groupByDay(certRows          || [], 'issued_at', 30),
        achievements_by_key:     groupByField(achievementRows || [], 'achievement_key').slice(0, 8),
        referrals_by_day:   groupByDay(referralRows      || [], 'created_at', 30),
        failures_by_feature: groupByField(failureRows   || [], 'feature').slice(0, 6),
      },
      table_counts: tableCounts,
    })
  } catch (err) {
    console.error('[admin/data-tab] error:', err.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

// action: "data-browse" — paginated table viewer with search + sort
async function handleDataBrowse(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })
  try {
    const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token)
    if (authErr || !caller) return res.status(401).json({ error: 'Unauthorized' })
    if (!process.env.ADMIN_EMAIL || caller.email !== process.env.ADMIN_EMAIL) {
      return res.status(403).json({ error: 'Forbidden' })
    }
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const table  = String(req.query.table  || '').toLowerCase()
  const search = String(req.query.search || '').slice(0, 200).trim()
  const page   = Math.max(1, parseInt(req.query.page)  || 1)
  const limit  = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
  const sort   = String(req.query.sort || 'created_at')
  const dir    = req.query.dir === 'asc'

  if (!ALLOWED_TABLES.has(table)) {
    return res.status(400).json({ error: `Unknown table: ${table}` })
  }

  try {
    const offset = (page - 1) * limit

    // Get a sample row first to discover text columns and validate sort column
    const { data: sample } = await supabaseAdmin.from(table).select('*').limit(1)
    const sampleRow = sample?.[0] || {}
    const textColumns = Object.entries(sampleRow)
      .filter(([k, v]) => typeof v === 'string' && k !== 'id' && !k.endsWith('_id'))
      .map(([k]) => k)
    // Only sort by a column that actually exists in this table
    const safeSortCol = (sort in sampleRow) ? sort
      : ('created_at' in sampleRow) ? 'created_at'
      : null

    // Build orFilter once — used by both count and main query
    const orFilter = (search && textColumns.length > 0)
      ? textColumns.map(col => `${col}.ilike.%${search}%`).join(',')
      : null

    // Get total count — with search filter applied when present
    let countQuery = supabaseAdmin.from(table).select('*', { count: 'exact', head: true })
    if (orFilter) countQuery = countQuery.or(orFilter)
    const { count: total, error: countErr } = await countQuery
    if (countErr) throw countErr

    // Build main query — with search filter applied when present
    let query = supabaseAdmin.from(table).select('*').range(offset, offset + limit - 1)
    if (orFilter) query = query.or(orFilter)

    const { data: rows, error: rowErr } = safeSortCol
      ? await query.order(safeSortCol, { ascending: dir })
      : await query
    if (rowErr) throw rowErr

    const allRows = rows || []
    return res.status(200).json({
      rows:    allRows,
      total:   total || 0,
      columns: allRows.length > 0 ? Object.keys(allRows[0]) : Object.keys(sampleRow),
      page,
      limit,
    })
  } catch (err) {
    console.error('[admin/data-browse] error:', err.message)
    return res.status(500).json({ error: 'Internal server error' })
  }
}

async function handleGetFounderPhotoUploadUrl(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !caller) return res.status(401).json({ error: 'Unauthorized' })
  if (!process.env.ADMIN_EMAIL || caller.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { data, error } = await supabaseAdmin.storage
    .from('admin-assets')
    .createSignedUploadUrl('founder/profile.jpg')

  if (error) {
    console.error('[admin/get-founder-photo-upload-url]', error.message)
    return res.status(500).json({ error: 'Failed to create upload URL' })
  }

  return res.status(200).json({ signedUrl: data.signedUrl, token: data.token, path: data.path })
}

async function handleUpdateFounderPhoto(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user: caller }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !caller) return res.status(401).json({ error: 'Unauthorized' })
  if (!process.env.ADMIN_EMAIL || caller.email !== process.env.ADMIN_EMAIL) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { url } = req.body || {}
  if (!url || typeof url !== 'string' || !url.startsWith('https://')) {
    return res.status(400).json({ error: 'Invalid url' })
  }

  const { error } = await supabaseAdmin
    .from('app_config')
    .upsert({ key: 'founder_photo', value: url, updated_at: new Date().toISOString() })

  if (error) {
    console.error('[admin/update-founder-photo]', error.message)
    return res.status(500).json({ error: 'Failed to save photo URL' })
  }

  return res.status(200).json({ ok: true })
}

export default async function handler(req, res) {
  try {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method === 'HEAD' && req.query.action === 'ping') return res.status(200).end();
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
  if (action === 'ping')           return handlePing(req, res);

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
  if (action === 'unban-user')         return handleUnbanUser(req, res);
  if (action === 'reset-usage')        return handleResetUsage(req, res);
  if (action === 'reset-run-counts')   return handleResetRunCounts(req, res);
  if (action === 'grant-entitlement')  return handleGrantEntitlement(req, res);
  if (action === 'debug-redis-keys')   return handleDebugRedisKeys(req, res);
  if (action === 'diagnose-user')      return handleDiagnoseUser(req, res);
  if (action === 'self-delete')            return handleSelfDelete(req, res);
  if (action === 'auth-attempts')          return handleAuthAttempts(req, res);
  if (action === 'payment-issues')         return handlePaymentIssues(req, res);
  if (action === 'resolve-payment-issue')  return handleResolvePaymentIssue(req, res);
  if (action === 'system_logs')        return handleSystemLogs(req, res);
  if (action === 'resolve_log')         return handleResolveLog(req, res);
  if (action === 'feedback-summary')        return handleFeedbackSummary(req, res);
  if (action === 'submit-rating')           return handleSubmitRating(req, res);
  if (action === 'get-ratings')             return handleGetRatings(req, res);
  if (action === 'report-payment-issue')    return handleReportPaymentIssue(req, res);
  if (action === 'test-all-alerts')         return handleTestAllAlerts(req, res);
  if (action === 'test-sentry-webhook')     return handleTestSentryWebhook(req, res);
  if (action === 'daily-report')            return handleDailyReport(req, res);
  if (action === 'error-check')             return handleErrorCheck(req, res);
  if (action === 'dispatch-nurture-emails') return handleDispatchNurtureEmails(req, res);
  if (action === 'resolve-sentry-issues')   return handleResolveSentryIssues(req, res);
  if (action === 'get-maintenance-mode')    return handleGetMaintenanceMode(req, res);
  if (action === 'set-maintenance-mode')    return handleSetMaintenanceMode(req, res);
  if (action === 'maintenance-info')        return handleMaintenanceInfo(req, res);
  if (action === 'get-express-beta')        return handleGetExpressBeta(req, res);
  if (action === 'set-express-beta')        return handleSetExpressBeta(req, res);
  if (action === 'express-beta-info')       return handleExpressBetaInfo(req, res);
  if (action === 'check-rating-force')     return handleCheckRatingForce(req, res);
  if (action === 'get-rating-force')       return handleGetRatingForce(req, res);
  if (action === 'set-rating-force')       return handleSetRatingForce(req, res);
  if (action === 'sync-run-counts') {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
    return handleSyncRunCounts(req, res);
  }
  if (action === 'data-tab')    return handleDataTab(req, res);
  if (action === 'data-browse') return handleDataBrowse(req, res);
  if (action === 'get-founder-photo-upload-url') return handleGetFounderPhotoUploadUrl(req, res)
  if (action === 'update-founder-photo')         return handleUpdateFounderPhoto(req, res)

  return res.status(400).json({ error: `Unknown action: ${action}` });
  } catch (err) {
    Sentry.captureException(err);
    console.error('[api/admin] unhandled error:', err);
    if (!res.headersSent) return res.status(500).json({ error: 'Internal server error' });
  }
}
