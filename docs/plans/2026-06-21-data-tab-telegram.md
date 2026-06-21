# Data Tab + Telegram /data Command — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Data tab to the admin dashboard showing 8 curated charts + a searchable/sortable table browser for all 29 Supabase tables, plus a `/data <table> [limit]` Telegram bot command.

**Architecture:** Hybrid read-only data view — curated KPI + chart section at top (8 tables, single API call), raw table browser below (all 29 tables, separate paginated API call). Everything goes through two new actions on `api/admin.js`. Telegram `/data` command added to `api/notify.js`.

**Tech Stack:** React, Recharts (already imported), Supabase service-role client, Vercel serverless functions (JS), Telegram Bot API.

## Global Constraints

- Read-only everywhere — no INSERT, UPDATE, DELETE from Data tab or Telegram
- All data via `api/admin.js` using `supabaseAdmin` (service-role) — never query Supabase from the frontend directly
- Admin auth on every new action: verify JWT with `supabaseAdmin.auth.getUser(token)` then check `caller.email === process.env.ADMIN_EMAIL`
- Table name in `data-browse` validated against a hardcoded allowlist — no string interpolation into queries
- Search uses Supabase `.ilike()` on text columns only — never client-side filtering
- No new npm packages — Recharts already installed; `PieChart`, `Pie`, `Cell` to be added to existing import
- `docs/specs/2026-06-21-data-tab-telegram-design.md` is the source of truth for the spec

---

## File Map

| File | Change |
|------|--------|
| `api/admin.js` | Add `handleDataTab()` and `handleDataBrowse()` functions + 2 action routes |
| `src/pages/admin/Health.jsx` | Add `'data'` tab, `loadDataTab()`, `loadTableBrowser()`, all render sections |
| `api/notify.js` | Add `cmdData(args)` function + register in `runCommand()` |

No new files needed.

---

## Task 1: Backend — `data-tab` action in `api/admin.js`

Returns KPIs + all 8 chart datasets + table row counts in one call.

**Files:**
- Modify: `api/admin.js` (add `handleDataTab` function + route)

**Interfaces:**
- Produces: `GET /api/admin?action=data-tab` with `Authorization: Bearer <jwt>`
- Response shape:
  ```json
  {
    "kpis": {
      "total_users": 13, "users_today": 2,
      "revenue_ngn": 178500, "revenue_today_ngn": 3500,
      "defense_sessions": 31, "avg_score": 6.4,
      "certificates": 2, "pass_rate": 6.5
    },
    "charts": {
      "users_by_day": [{ "date": "2026-06-15", "count": 2 }, ...],
      "payments_by_tier": [{ "name": "defense_pack", "value": 71400 }, ...],
      "projects_by_status": [{ "name": "active", "value": 10 }, ...],
      "projects_by_mode": [{ "name": "standard", "value": 11 }, { "name": "express", "value": 2 }],
      "score_distribution": [{ "score": 1, "count": 0 }, ..., { "score": 10, "count": 1 }],
      "certs_by_day": [{ "date": "2026-06-01", "count": 0 }, ...],
      "top_achievements": [{ "name": "first_defense", "value": 5 }, ...],
      "referrals_by_day": [{ "date": "2026-06-01", "count": 0 }, ...],
      "failures_by_feature": [{ "name": "defense_simulator", "value": 61 }, ...]
    },
    "table_counts": { "users": 13, "payments": 89, "auth_attempts": 450, ... }
  }
  ```

- [ ] **Step 1: Add helper functions above `handleDataTab` in `api/admin.js`**

  Add these three pure functions anywhere before `handleDataTab` (e.g., right above it). They have no side effects.

  ```javascript
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

  // Buckets defense session scores into 10 slots (score 1–10), returns [{score,count}]
  function scoreHistogram(rows) {
    const buckets = Array.from({ length: 10 }, (_, i) => ({ score: i + 1, count: 0 }))
    for (const row of rows) {
      const s = Math.round(row.total_score || 0)
      if (s >= 1 && s <= 10) buckets[s - 1].count++
    }
    return buckets
  }
  ```

- [ ] **Step 2: Add `handleDataTab` function in `api/admin.js`**

  Add this function after the helper functions from Step 1, before the `export default` handler:

  ```javascript
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
          score_distribution: scoreHistogram(sessionScores || []),
          certs_by_day:       groupByDay(certRows          || [], 'issued_at', 30),
          top_achievements:   groupByField(achievementRows || [], 'achievement_key').slice(0, 8),
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
  ```

- [ ] **Step 3: Register the route in the handler**

  In `api/admin.js`, inside the `export default async function handler`, add before the `return res.status(400)` fallback line:

  ```javascript
  if (action === 'data-tab')    return handleDataTab(req, res);
  ```

- [ ] **Step 4: Manual smoke test**

  With the dev server running (`npm run dev`), open a browser console on `/admin/health` (logged in as admin) and run:
  ```javascript
  const s = (await (await fetch('/api/admin?action=data-tab', { headers: { Authorization: `Bearer ${(await (await import('/src/lib/supabase.ts')).supabase.auth.getSession()).data.session.access_token}` } })).json())
  console.log(s.kpis, Object.keys(s.charts), Object.keys(s.table_counts).length)
  ```
  Expected: kpis object with real numbers, 9 chart keys, 29 table count keys.

- [ ] **Step 5: Commit**

  ```bash
  git add api/admin.js
  git commit -m "feat(admin): add data-tab action — KPIs, 8 chart datasets, 29 table counts"
  ```

---

## Task 2: Backend — `data-browse` action in `api/admin.js`

Paginated, searchable, sortable row browser for any of the 29 tables.

**Files:**
- Modify: `api/admin.js` (add `handleDataBrowse` + route)

**Interfaces:**
- Consumes: nothing from Task 1
- Produces: `GET /api/admin?action=data-browse&table=payments&search=abc&page=1&limit=20&sort=created_at&dir=desc`
- Response:
  ```json
  { "rows": [...], "total": 89, "page": 1, "limit": 20 }
  ```

- [ ] **Step 1: Add `ALLOWED_TABLES` constant near the top of `api/admin.js`**

  Add this after the existing imports, before the first function definition:

  ```javascript
  const ALLOWED_TABLES = new Set([
    'admin_users','app_config','auth_attempts','daily_usage',
    'defense_certificates','defense_credits','defense_sessions','defense_turns',
    'email_log','email_preferences','feature_feedback','generation_failures',
    'institutions','notifications','payment_issues','payments',
    'project_steps','projects','push_subscriptions','referrals',
    'response_times','system_logs','user_achievements','user_entitlements',
    'user_onboarding','user_progress','user_ratings','user_reports','users',
  ])
  ```

- [ ] **Step 2: Add `handleDataBrowse` function in `api/admin.js`**

  Add after `handleDataTab`:

  ```javascript
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

      // Get total count
      const { count: total, error: countErr } = await supabaseAdmin
        .from(table)
        .select('*', { count: 'exact', head: true })
      if (countErr) throw countErr

      // Get a sample row to discover text columns and validate sort column
      const { data: sample } = await supabaseAdmin.from(table).select('*').limit(1)
      const sampleRow = sample?.[0] || {}
      const textColumns = Object.entries(sampleRow)
        .filter(([k, v]) => typeof v === 'string' && k !== 'id' && !k.endsWith('_id'))
        .map(([k]) => k)
      const safeSortCol = (sort in sampleRow) ? sort : 'created_at'

      // Build main query
      let query = supabaseAdmin.from(table).select('*').range(offset, offset + limit - 1)

      if (search && textColumns.length > 0) {
        const orFilter = textColumns.map(col => `${col}.ilike.%${search}%`).join(',')
        query = query.or(orFilter)
      }

      query = query.order(safeSortCol, { ascending: dir })

      const { data: rows, error: rowErr } = await query
      if (rowErr) throw rowErr

      return res.status(200).json({ rows: rows || [], total: total || 0, page, limit })
    } catch (err) {
      console.error('[admin/data-browse] error:', err.message)
      return res.status(500).json({ error: 'Internal server error' })
    }
  }
  ```

- [ ] **Step 3: Register the route**

  In the `export default` handler, add next to the `data-tab` route:

  ```javascript
  if (action === 'data-browse') return handleDataBrowse(req, res);
  ```

- [ ] **Step 4: Manual smoke test**

  In browser console on `/admin/health` (logged in as admin):
  ```javascript
  const tok = (await (await import('/src/lib/supabase.ts')).supabase.auth.getSession()).data.session.access_token
  const r = await (await fetch('/api/admin?action=data-browse&table=payments&limit=3&sort=created_at&dir=desc', { headers: { Authorization: `Bearer ${tok}` } })).json()
  console.log(r.total, r.rows.length, r.rows[0])
  ```
  Expected: `total` = 89, `rows.length` = 3, first row has payment fields.

  Test invalid table:
  ```javascript
  const r2 = await (await fetch('/api/admin?action=data-browse&table=evil_table', { headers: { Authorization: `Bearer ${tok}` } })).json()
  console.log(r2) // { error: "Unknown table: evil_table" }
  ```

- [ ] **Step 5: Commit**

  ```bash
  git add api/admin.js
  git commit -m "feat(admin): add data-browse action — paginated table viewer with search + sort"
  ```

---

## Task 3: Frontend — Data tab shell, KPI cards, polling

Add the `'data'` tab to `Health.jsx` with state, polling, and KPI card row.

**Files:**
- Modify: `src/pages/admin/Health.jsx`

**Interfaces:**
- Consumes: `GET /api/admin?action=data-tab` (Task 1)
- Produces: `dataTabData` state used by Tasks 4 and 5

- [ ] **Step 1: Add `PieChart`, `Pie`, `Cell` to the Recharts import**

  Find the existing import at the top of `Health.jsx`:
  ```javascript
  import {
    LineChart, Line, BarChart, Bar,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  } from 'recharts'
  ```
  Replace it with:
  ```javascript
  import {
    LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
    XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  } from 'recharts'
  ```

- [ ] **Step 2: Add state variables for the Data tab**

  In the main `Health` component, after the existing `ratingsData/ratingsLoading/ratingsError` state block, add:

  ```javascript
  const [dataTabData,    setDataTabData]    = useState(null)
  const [dataTabLoading, setDataTabLoading] = useState(false)
  const [dataTabError,   setDataTabError]   = useState(null)
  const dataTabTimerRef                     = useRef(null)

  const [browserTable,   setBrowserTable]   = useState('users')
  const [browserSearch,  setBrowserSearch]  = useState('')
  const [browserPage,    setBrowserPage]    = useState(1)
  const [browserLimit,   setBrowserLimit]   = useState(20)
  const [browserSort,    setBrowserSort]    = useState('created_at')
  const [browserDir,     setBrowserDir]     = useState('desc')
  const [browserData,    setBrowserData]    = useState(null)
  const [browserLoading, setBrowserLoading] = useState(false)
  const [browserError,   setBrowserError]   = useState(null)
  const browserSearchTimerRef               = useRef(null)
  ```

- [ ] **Step 3: Add `loadDataTab` function**

  After the existing `loadRatings` / `loadRatingForce` functions, add:

  ```javascript
  const loadDataTab = useCallback(() => {
    if (!session) return
    setDataTabLoading(true)
    setDataTabError(null)
    return fetch('/api/admin?action=data-tab', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setDataTabData(d)
        setDataTabError(null)
      })
      .catch(e => setDataTabError(e.message || 'Failed to load'))
      .finally(() => setDataTabLoading(false))
  }, [session])
  ```

- [ ] **Step 4: Wire polling for the Data tab**

  After the existing ratings polling `useEffect` blocks, add:

  ```javascript
  useEffect(() => {
    if (!isAdmin || !session) return
    dataTabTimerRef.current = setInterval(() => {
      if (activeTab === 'data') loadDataTab()
    }, 60 * 1000)
    return () => clearInterval(dataTabTimerRef.current)
  }, [isAdmin, session, loadDataTab, activeTab])
  ```

- [ ] **Step 5: Wire `loadDataTab` into `switchTab` and initial load**

  Find the existing `switchTab` function:
  ```javascript
  function switchTab(id) {
    if (id === 'overview') counterKeyRef.current += 1
    setActiveTab(id)
    if (id === 'overview' || id === 'users') loadData()
    else if (id === 'vitals') { loadVitals(); loadAuthAttempts() }
    else if (id === 'payments') { loadPaymentIssues(); loadFeedbackSummary() }
    else if (id === 'logs') { loadSystemLogs(); loadFailures() }
    else if (id === 'reports') loadReports()
    else if (id === 'ratings') { loadRatings(); loadRatingForce() }
  }
  ```
  Add the data case:
  ```javascript
  function switchTab(id) {
    if (id === 'overview') counterKeyRef.current += 1
    setActiveTab(id)
    if (id === 'overview' || id === 'users') loadData()
    else if (id === 'vitals') { loadVitals(); loadAuthAttempts() }
    else if (id === 'payments') { loadPaymentIssues(); loadFeedbackSummary() }
    else if (id === 'logs') { loadSystemLogs(); loadFailures() }
    else if (id === 'reports') loadReports()
    else if (id === 'ratings') { loadRatings(); loadRatingForce() }
    else if (id === 'data') loadDataTab()
  }
  ```

  Also add `loadDataTab` to the initial `loadData` call array and the `loadAll` block. Find the existing `Promise.all` call that runs on mount (contains `loadData(), loadVitals()...`) and add `loadDataTab()` to that array.

- [ ] **Step 6: Add the `'data'` tab button**

  Find where the other tab buttons are rendered (they say `Overview`, `Users`, `Vitals`, etc.). Add the Data tab button following the same pattern as the existing ones. The exact JSX pattern used — replicate it:

  ```jsx
  <button
    onClick={() => switchTab('data')}
    style={{
      .../* same inline style as other tabs */,
      borderBottom: activeTab === 'data' ? `2px solid ${BLUE}` : '2px solid transparent',
      color: activeTab === 'data' ? WHITE : MUTED,
    }}
  >
    Data
  </button>
  ```

  Also add `'data'` as an `<option>` in the mobile `<select>` tab switcher if one exists.

- [ ] **Step 7: Add KPI cards section in the tab content area**

  Find where each tab renders its content (the `activeTab === 'overview'` block etc.). Add after the last tab's block:

  ```jsx
  {activeTab === 'data' && (
    <div className="mc-tab-content">

      {dataTabError && (
        <div style={{ color: RED, padding: '16px 0', fontSize: 13 }}>
          ⚠ {dataTabError}
        </div>
      )}

      {/* ── KPI Row ───────────────────────────────────────────────────── */}
      <div className="mc-section-divider">Key Metrics</div>
      <div className="mc-kpi-grid" style={{ marginBottom: 20 }}>
        <OverviewCard
          label="Total Users"
          value={dataTabData?.kpis?.total_users ?? '—'}
          sub={dataTabData ? `+${dataTabData.kpis.users_today} today` : ''}
          accent={BLUE}
        />
        <OverviewCard
          label="Total Revenue"
          value={dataTabData ? `₦${dataTabData.kpis.revenue_ngn.toLocaleString()}` : '—'}
          sub={dataTabData ? `+₦${dataTabData.kpis.revenue_today_ngn.toLocaleString()} today` : ''}
          accent={GREEN}
        />
        <OverviewCard
          label="Defense Sessions"
          value={dataTabData?.kpis?.defense_sessions ?? '—'}
          sub={dataTabData ? `avg ${dataTabData.kpis.avg_score}/10` : ''}
          accent={BLUE}
        />
        <OverviewCard
          label="Certificates"
          value={dataTabData?.kpis?.certificates ?? '—'}
          sub={dataTabData ? `pass rate ${dataTabData.kpis.pass_rate}%` : ''}
          accent={GREEN}
        />
      </div>

      {/* Charts and table browser render here — added in Tasks 4 and 5 */}

    </div>
  )}
  ```

- [ ] **Step 8: Visual check**

  Run `npm run dev`, go to `/admin/health`, click the Data tab. You should see 4 KPI cards with real numbers. No console errors.

- [ ] **Step 9: Commit**

  ```bash
  git add src/pages/admin/Health.jsx
  git commit -m "feat(admin): add Data tab shell with KPI cards and polling"
  ```

---

## Task 4: Frontend — 8 curated charts

Render all 8 chart cards inside the Data tab, below the KPI row.

**Files:**
- Modify: `src/pages/admin/Health.jsx`

**Interfaces:**
- Consumes: `dataTabData.charts` from Task 3

- [ ] **Step 1: Define chart colors array near the top of the component**

  Add after the existing color constants at the top of `Health.jsx`:

  ```javascript
  const PIE_COLORS = ['#0066FF', '#16A34A', '#F59E0B', '#DC2626', '#8B5CF6', '#06B6D4']
  ```

- [ ] **Step 2: Replace the `{/* Charts and table browser render here */}` comment with the charts grid**

  Inside the `activeTab === 'data'` block, replace that comment with:

  ```jsx
  {/* ── Charts Grid ───────────────────────────────────────────────── */}
  <div className="mc-section-divider">Charts</div>
  {dataTabLoading && !dataTabData && (
    <div style={{ color: MUTED, fontSize: 13, padding: '24px 0' }}>Loading charts…</div>
  )}
  {dataTabData && (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16, marginBottom: 24 }}>

      {/* 1. Users — signups last 7 days */}
      <div className="mc-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: DIM, marginBottom: 12 }}>
          Users — signups last 7 days
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={dataTabData.charts.users_by_day} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: MUTED }} tickFormatter={d => d.slice(5)} />
            <YAxis tick={{ fontSize: 9, fill: MUTED }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: SURFACE, border: `1px solid ${BORDER}`, fontSize: 11 }} />
            <Bar dataKey="count" fill={BLUE} radius={[3, 3, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 2. Payments — revenue by tier (pie) */}
      <div className="mc-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: DIM, marginBottom: 12 }}>
          Payments — revenue by tier (₦)
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie data={dataTabData.charts.payments_by_tier} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50}>
                {dataTabData.charts.payments_by_tier.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: SURFACE, border: `1px solid ${BORDER}`, fontSize: 11 }}
                formatter={(v) => [`₦${v.toLocaleString()}`, '']} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, lineHeight: 2 }}>
            {dataTabData.charts.payments_by_tier.map((item, i) => (
              <div key={item.name}>
                <span style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>● </span>
                <span style={{ color: DIM }}>{item.name}</span>
                <span style={{ color: MUTED }}> ₦{item.value.toLocaleString()}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Projects — status breakdown (pie) */}
      <div className="mc-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: DIM, marginBottom: 12 }}>
          Projects — by status
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <ResponsiveContainer width={120} height={120}>
            <PieChart>
              <Pie data={dataTabData.charts.projects_by_status} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={50}>
                {dataTabData.charts.projects_by_status.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: SURFACE, border: `1px solid ${BORDER}`, fontSize: 11 }} />
            </PieChart>
          </ResponsiveContainer>
          <div style={{ fontSize: 11, lineHeight: 2 }}>
            {dataTabData.charts.projects_by_status.map((item, i) => (
              <div key={item.name}>
                <span style={{ color: PIE_COLORS[i % PIE_COLORS.length] }}>● </span>
                <span style={{ color: DIM }}>{item.name}</span>
                <span style={{ color: MUTED }}> {item.value}</span>
              </div>
            ))}
            <div style={{ marginTop: 6, paddingTop: 6, borderTop: `1px solid ${BORDER}`, fontSize: 10, color: MUTED }}>
              {dataTabData.charts.projects_by_mode.map(m => `${m.name}: ${m.value}`).join(' · ')}
            </div>
          </div>
        </div>
      </div>

      {/* 4. Defense Sessions — score distribution (histogram) */}
      <div className="mc-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: DIM, marginBottom: 12 }}>
          Defense Sessions — score distribution
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={dataTabData.charts.score_distribution} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
            <XAxis dataKey="score" tick={{ fontSize: 9, fill: MUTED }} />
            <YAxis tick={{ fontSize: 9, fill: MUTED }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: SURFACE, border: `1px solid ${BORDER}`, fontSize: 11 }} />
            <Bar dataKey="count" radius={[3, 3, 0, 0]}>
              {dataTabData.charts.score_distribution.map((entry) => (
                <Cell key={entry.score} fill={entry.score >= 7 ? GREEN : entry.score >= 4 ? AMBER : RED} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 5. Certificates — issued last 30 days (line) */}
      <div className="mc-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: DIM, marginBottom: 12 }}>
          Certificates — issued last 30 days
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={dataTabData.charts.certs_by_day} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: MUTED }} tickFormatter={d => d.slice(5)} interval={6} />
            <YAxis tick={{ fontSize: 9, fill: MUTED }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: SURFACE, border: `1px solid ${BORDER}`, fontSize: 11 }} />
            <Line type="monotone" dataKey="count" stroke={GREEN} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 6. Achievements — top unlocked (bar) */}
      <div className="mc-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: DIM, marginBottom: 12 }}>
          Achievements — top unlocked
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={dataTabData.charts.top_achievements} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
            <XAxis type="number" tick={{ fontSize: 9, fill: MUTED }} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: MUTED }} width={90} />
            <Tooltip contentStyle={{ background: SURFACE, border: `1px solid ${BORDER}`, fontSize: 11 }} />
            <Bar dataKey="value" fill={BLUE} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 7. Referrals — last 30 days (line) */}
      <div className="mc-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: DIM, marginBottom: 12 }}>
          Referrals — last 30 days
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <LineChart data={dataTabData.charts.referrals_by_day} margin={{ top: 0, right: 0, left: -30, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
            <XAxis dataKey="date" tick={{ fontSize: 9, fill: MUTED }} tickFormatter={d => d.slice(5)} interval={6} />
            <YAxis tick={{ fontSize: 9, fill: MUTED }} allowDecimals={false} />
            <Tooltip contentStyle={{ background: SURFACE, border: `1px solid ${BORDER}`, fontSize: 11 }} />
            <Line type="monotone" dataKey="count" stroke={AMBER} strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* 8. Generation Failures — by feature (horizontal bar) */}
      <div className="mc-card" style={{ padding: 20 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: DIM, marginBottom: 12 }}>
          Generation Failures — by feature (top 6)
        </div>
        <ResponsiveContainer width="100%" height={140}>
          <BarChart data={dataTabData.charts.failures_by_feature} layout="vertical" margin={{ top: 0, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
            <XAxis type="number" tick={{ fontSize: 9, fill: MUTED }} allowDecimals={false} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 9, fill: MUTED }} width={90} />
            <Tooltip contentStyle={{ background: SURFACE, border: `1px solid ${BORDER}`, fontSize: 11 }} />
            <Bar dataKey="value" fill={RED} radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

    </div>
  )}

  {/* Table browser placeholder — added in Task 5 */}
  ```

- [ ] **Step 3: Visual check**

  Reload `/admin/health`, click the Data tab. You should see 8 chart cards in a 2-column grid. All charts render with real data. No blank cards, no console errors.

- [ ] **Step 4: Commit**

  ```bash
  git add src/pages/admin/Health.jsx
  git commit -m "feat(admin): add 8 curated charts to Data tab"
  ```

---

## Task 5: Frontend — Table browser

Searchable, sortable, paginated table viewer below the charts.

**Files:**
- Modify: `src/pages/admin/Health.jsx`

**Interfaces:**
- Consumes: `dataTabData.table_counts` (Task 3), `GET /api/admin?action=data-browse` (Task 2)
- Consumes state: `browserTable`, `browserSearch`, `browserPage`, `browserLimit`, `browserSort`, `browserDir`, `browserData`, `browserLoading`, `browserError` (all added in Task 3)

- [ ] **Step 1: Add `loadTableBrowser` function**

  After `loadDataTab`, add:

  ```javascript
  const loadTableBrowser = useCallback((table, search, page, limit, sort, dir) => {
    if (!session) return
    setBrowserLoading(true)
    setBrowserError(null)
    const params = new URLSearchParams({
      action: 'data-browse',
      table,
      search: search || '',
      page:   String(page),
      limit:  String(limit),
      sort,
      dir,
    })
    return fetch(`/api/admin?${params}`, {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setBrowserData(d)
        setBrowserError(null)
      })
      .catch(e => setBrowserError(e.message || 'Failed to load'))
      .finally(() => setBrowserLoading(false))
  }, [session])
  ```

- [ ] **Step 2: Add `useEffect` to load table browser when browser state changes**

  After the data tab polling `useEffect`, add:

  ```javascript
  useEffect(() => {
    if (activeTab !== 'data' || !isAdmin || !session) return
    // debounce search changes, immediate otherwise
    if (browserSearchTimerRef.current) clearTimeout(browserSearchTimerRef.current)
    browserSearchTimerRef.current = setTimeout(() => {
      loadTableBrowser(browserTable, browserSearch, browserPage, browserLimit, browserSort, browserDir)
    }, 400)
    return () => clearTimeout(browserSearchTimerRef.current)
  }, [activeTab, isAdmin, session, browserTable, browserSearch, browserPage, browserLimit, browserSort, browserDir, loadTableBrowser])
  ```

- [ ] **Step 3: Add helper functions for cell rendering**

  Add near the top of the component (or just before the render return):

  ```javascript
  function fmtCell(value) {
    if (value === null || value === undefined) return <span style={{ color: MUTED }}>—</span>
    if (typeof value === 'boolean') {
      return (
        <span style={{
          background: value ? 'rgba(22,163,74,0.15)' : 'rgba(220,38,38,0.15)',
          color: value ? GREEN : RED,
          padding: '2px 7px', borderRadius: 4, fontSize: 10, fontWeight: 600,
        }}>
          {value ? 'true' : 'false'}
        </span>
      )
    }
    if (typeof value === 'object') return <span style={{ color: MUTED, fontSize: 10 }}>[object]</span>
    const str = String(value)
    // UUID pattern: 8-4-4-4-12
    if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str)) {
      return <span style={{ color: MUTED, fontFamily: 'JetBrains Mono, monospace', fontSize: 10 }}>{str.slice(0, 8)}…</span>
    }
    // ISO timestamp pattern
    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(str)) {
      return <span style={{ color: MUTED, fontSize: 11 }}>{fmtDate(str)} {new Date(str).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</span>
    }
    // Long strings
    if (str.length > 60) return <span title={str}>{str.slice(0, 60)}…</span>
    return str
  }
  ```

- [ ] **Step 4: Replace the `{/* Table browser placeholder */}` comment with the full table browser**

  ```jsx
  {/* ── Table Browser ─────────────────────────────────────────────── */}
  <div className="mc-section-divider" style={{ marginTop: 8 }}>Table Browser</div>
  <div className="mc-card" style={{ padding: 20, marginBottom: 32 }}>

    {/* Controls row */}
    <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16, flexWrap: 'wrap' }}>
      <select
        value={browserTable}
        onChange={e => { setBrowserTable(e.target.value); setBrowserPage(1); setBrowserSearch('') }}
        style={{ background: CARD, border: `1px solid ${BORDER}`, color: WHITE, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontFamily: "'Poppins', sans-serif", cursor: 'pointer' }}
      >
        {Array.from(BROWSER_TABLES).map(t => (
          <option key={t} value={t}>
            {t}{dataTabData?.table_counts?.[t] != null ? ` (${dataTabData.table_counts[t]})` : ''}
          </option>
        ))}
      </select>
      <input
        value={browserSearch}
        onChange={e => { setBrowserSearch(e.target.value); setBrowserPage(1) }}
        placeholder="🔍 Search rows…"
        style={{ flex: 1, minWidth: 160, background: CARD, border: `1px solid ${BORDER}`, color: WHITE, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontFamily: "'Poppins', sans-serif' }}
      />
      <select
        value={browserLimit}
        onChange={e => { setBrowserLimit(Number(e.target.value)); setBrowserPage(1) }}
        style={{ background: CARD, border: `1px solid ${BORDER}`, color: WHITE, borderRadius: 8, padding: '6px 12px', fontSize: 12, fontFamily: "'Poppins', sans-serif", cursor: 'pointer' }}
      >
        <option value={20}>20 rows</option>
        <option value={50}>50 rows</option>
        <option value={100}>100 rows</option>
      </select>
    </div>

    {browserError && <div style={{ color: RED, fontSize: 12, marginBottom: 12 }}>⚠ {browserError}</div>}
    {browserLoading && <div style={{ color: MUTED, fontSize: 12, marginBottom: 12 }}>Loading…</div>}

    {/* Table */}
    {browserData && (
      <>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
            <thead>
              <tr style={{ borderBottom: `1px solid ${BORDER}` }}>
                {browserData.rows[0]
                  ? Object.keys(browserData.rows[0]).map(col => (
                    <th
                      key={col}
                      onClick={() => {
                        if (browserSort === col) setBrowserDir(d => d === 'desc' ? 'asc' : 'desc')
                        else { setBrowserSort(col); setBrowserDir('desc') }
                        setBrowserPage(1)
                      }}
                      style={{ padding: '6px 10px', textAlign: 'left', color: MUTED, fontWeight: 600, cursor: 'pointer', userSelect: 'none', whiteSpace: 'nowrap' }}
                    >
                      {col}
                      {browserSort === col && (
                        <span style={{ marginLeft: 4 }}>{browserDir === 'desc' ? '↓' : '↑'}</span>
                      )}
                    </th>
                  ))
                  : <th style={{ color: MUTED, padding: '6px 10px' }}>No columns</th>
                }
              </tr>
            </thead>
            <tbody>
              {browserData.rows.length === 0 ? (
                <tr><td colSpan={99} style={{ padding: '16px 10px', color: MUTED, textAlign: 'center' }}>No rows found</td></tr>
              ) : browserData.rows.map((row, ri) => (
                <tr key={ri} style={{ borderBottom: `1px solid rgba(255,255,255,0.03)` }}>
                  {Object.values(row).map((val, ci) => (
                    <td key={ci} style={{ padding: '5px 10px', color: DIM, verticalAlign: 'top' }}>
                      {fmtCell(val)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {(() => {
          const totalPages = Math.ceil(browserData.total / browserLimit)
          const start = (browserPage - 1) * browserLimit + 1
          const end   = Math.min(browserPage * browserLimit, browserData.total)
          return (
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 14, flexWrap: 'wrap' }}>
              <button
                disabled={browserPage <= 1}
                onClick={() => setBrowserPage(p => p - 1)}
                className="mc-action-btn"
              >
                ← Prev
              </button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                const p = browserPage <= 4 ? i + 1
                  : browserPage >= totalPages - 3 ? totalPages - 6 + i
                  : browserPage - 3 + i
                if (p < 1 || p > totalPages) return null
                return (
                  <button
                    key={p}
                    onClick={() => setBrowserPage(p)}
                    className="mc-action-btn"
                    style={{ background: p === browserPage ? BLUE : 'transparent', color: p === browserPage ? WHITE : MUTED }}
                  >
                    {p}
                  </button>
                )
              })}
              <button
                disabled={browserPage >= totalPages}
                onClick={() => setBrowserPage(p => p + 1)}
                className="mc-action-btn"
              >
                Next →
              </button>
              <span style={{ marginLeft: 'auto', fontSize: 11, color: MUTED }}>
                {browserData.total > 0 ? `Showing ${start}–${end} of ${browserData.total}` : 'No results'}
              </span>
            </div>
          )
        })()}
      </>
    )}
  </div>
  ```

- [ ] **Step 5: Add `BROWSER_TABLES` constant near the top of the component**

  After `PIE_COLORS`, add:

  ```javascript
  const BROWSER_TABLES = [
    'admin_users','app_config','auth_attempts','daily_usage',
    'defense_certificates','defense_credits','defense_sessions','defense_turns',
    'email_log','email_preferences','feature_feedback','generation_failures',
    'institutions','notifications','payment_issues','payments',
    'project_steps','projects','push_subscriptions','referrals',
    'response_times','system_logs','user_achievements','user_entitlements',
    'user_onboarding','user_progress','user_ratings','user_reports','users',
  ]
  ```

- [ ] **Step 6: Visual check — table browser end-to-end**

  1. Go to `/admin/health` → Data tab
  2. Table browser loads with `users` table by default — verify rows appear
  3. Change table dropdown to `payments` — verify new rows load
  4. Type in search box — verify it filters (debounced, ~400ms delay)
  5. Click a column header — verify sort changes (↓/↑ indicator appears, rows reorder)
  6. Click Prev/Next — verify pagination works
  7. Change rows per page to 50 — verify more rows appear
  8. No console errors throughout

- [ ] **Step 7: Commit**

  ```bash
  git add src/pages/admin/Health.jsx
  git commit -m "feat(admin): add searchable sortable table browser to Data tab"
  ```

---

## Task 6: Telegram `/data` command

Add `cmdData(args)` to `api/notify.js` and register it in `runCommand()`.

**Files:**
- Modify: `api/notify.js`

**Interfaces:**
- Consumes: `supabaseAdmin` (already imported in notify.js)
- Produces: `/data <table> [limit]` bot command, returns formatted text reply

- [ ] **Step 1: Add `DATA_KEY_COLS` config and `cmdData` function in `api/notify.js`**

  Find the last `async function cmd...` before `runCommand`. Add after it:

  ```javascript
  // Key columns shown per table in /data command responses
  const DATA_KEY_COLS = {
    users:                ['email', 'full_name', 'university', 'created_at'],
    payments:             ['amount_kobo', 'tier', 'status', 'created_at'],
    projects:             ['title', 'status', 'mode', 'created_at'],
    defense_sessions:     ['total_score', 'completed_at'],
    defense_certificates: ['certificate_number', 'issued_at'],
    user_achievements:    ['achievement_key', 'earned_at'],
    referrals:            ['created_at'],
    generation_failures:  ['feature', 'error_type', 'error_message', 'created_at'],
    auth_attempts:        ['email', 'success', 'created_at'],
    notifications:        ['type', 'title', 'created_at'],
    system_logs:          ['level', 'message', 'created_at'],
  }

  const DATA_ALLOWED_TABLES = new Set([
    'admin_users','app_config','auth_attempts','daily_usage',
    'defense_certificates','defense_credits','defense_sessions','defense_turns',
    'email_log','email_preferences','feature_feedback','generation_failures',
    'institutions','notifications','payment_issues','payments',
    'project_steps','projects','push_subscriptions','referrals',
    'response_times','system_logs','user_achievements','user_entitlements',
    'user_onboarding','user_progress','user_ratings','user_reports','users',
  ])

  function fmtTgDate(iso) {
    if (!iso) return '—'
    const d = new Date(iso)
    return `${d.getDate()} ${d.toLocaleString('en-GB', { month: 'short' })} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
  }

  function fmtTgRow(row, cols) {
    return cols
      .filter(c => c in row)
      .map(c => {
        const v = row[c]
        if (v === null || v === undefined) return null
        if (c === 'amount_kobo') return `₦${Math.round(v / 100).toLocaleString()}`
        if (c === 'success') return v ? '✅' : '❌'
        if (c.endsWith('_at') || c === 'issued_at' || c === 'earned_at' || c === 'completed_at') return fmtTgDate(v)
        if (typeof v === 'boolean') return v ? '✅' : '❌'
        const s = String(v)
        return s.length > 60 ? s.slice(0, 60) + '…' : s
      })
      .filter(Boolean)
      .join(' · ')
  }

  async function cmdData(args) {
    const table = (args[0] || '').toLowerCase()
    const limit = Math.min(20, Math.max(1, parseInt(args[1]) || 5))

    if (!table || !DATA_ALLOWED_TABLES.has(table)) {
      const sample = ['users', 'payments', 'projects', 'defense_sessions', 'auth_attempts'].join(', ')
      return `❌ Unknown table. Try: ${sample}…\n\nUsage: /data &lt;table&gt; [limit]`
    }

    const cols = DATA_KEY_COLS[table] || ['id', 'created_at']

    try {
      const { count } = await supabaseAdmin
        .from(table).select('*', { count: 'exact', head: true })

      const { data: rows, error } = await supabaseAdmin
        .from(table).select(cols.join(',')).order('created_at', { ascending: false }).limit(limit)

      if (error) throw error
      if (!rows || rows.length === 0) return `📦 <b>${table}</b> — no rows found`

      const lines = rows.map((row, i) => `${i + 1}. ${fmtTgRow(row, cols)}`).join('\n')
      const hint  = count > limit ? `\nTotal rows: ${count} · /data ${table} ${Math.min(limit * 2, 20)} for more` : `\nTotal rows: ${count}`

      return `📦 <b>${table}</b> — last ${rows.length} rows\n\n${lines}${hint}`
    } catch (err) {
      console.error('[notify/cmdData] error:', err.message)
      return `❌ Query failed — check server logs`
    }
  }
  ```

- [ ] **Step 2: Register in `runCommand`**

  Find the `runCommand` function (around line 852). Add the `data` case:

  ```javascript
  async function runCommand(key, args = []) {
    if      (key === 'today'       ) return cmdToday()
    else if (key === 'stats'       ) return cmdStats()
    else if (key === 'revenue'     ) return cmdRevenue()
    else if (key === 'users'       ) return cmdUsers()
    else if (key === 'spend'       ) return cmdSpend()
    else if (key === 'errors'      ) return cmdErrors()
    else if (key === 'payments'    ) return cmdPayments()
    else if (key === 'health'      ) return cmdHealth()
    else if (key === 'projects'    ) return cmdProjects()
    else if (key === 'certs'       ) return cmdCerts()
    else if (key === 'referrals'   ) return cmdReferrals()
    else if (key === 'logs'        ) return cmdLogs()
    else if (key === 'resolve'         ) return cmdResolve(args[0])
    else if (key === 'resolve-report'  ) return cmdResolveReport(args[0])
    else if (key === 'reports'         ) return cmdReports()
    else if (key === 'ratings'         ) return cmdRatings()
    else if (key === 'maintenance'     ) return cmdMaintenance(args)
    else if (key === 'data'            ) return cmdData(args)
    else if (key === 'help'            ) return cmdHelp()
    return null
  }
  ```

- [ ] **Step 3: Add `/data` to the help text**

  Find `cmdHelp()` (or the `KEYBOARD` constant / help message string). Add `/data <table> [limit]` to the command list. Example:

  ```javascript
  // Inside cmdHelp() return string, add one line:
  `/data &lt;table&gt; [limit] — browse last N rows of any table`
  ```

- [ ] **Step 4: Manual smoke test via the Telegram bot**

  Send these messages to `@fypro_admin_bot`:
  ```
  /data payments 3
  ```
  Expected: `📦 payments — last 3 rows` + 3 formatted payment rows + total count footer.

  ```
  /data fakefable
  ```
  Expected: `❌ Unknown table. Try: users, payments, ...`

  ```
  /data users
  ```
  Expected: last 5 users (default limit), formatted with email, name, university, date.

- [ ] **Step 5: Commit**

  ```bash
  git add api/notify.js
  git commit -m "feat(telegram): add /data <table> [limit] bot command"
  ```

---

## Self-Review Checklist

**Spec coverage:**
- [x] KPI row (4 cards) — Task 3
- [x] 8 curated charts — Task 4
- [x] Table browser with search, sort, pagination — Tasks 2, 5
- [x] Table dropdown with row counts — Task 5 (counts from Task 1)
- [x] Read-only everywhere — no writes in any task
- [x] Table name allowlist — Tasks 2, 6
- [x] Search on text columns only — Task 2 (`typeof v === 'string'`)
- [x] Sort validation (falls back to `created_at`) — Task 2
- [x] Telegram `/data` with key columns config — Task 6
- [x] Telegram error cases (unknown table, query error) — Task 6
- [x] Admin auth on all new backend actions — Tasks 1, 2
- [x] `generation_failures` uses `feature` column (not `step`) — Task 1, Task 6

**Type consistency:**
- `groupByDay`, `groupByField`, `scoreHistogram` defined in Task 1, only used in Task 1 ✓
- `loadDataTab` defined in Task 3, called in Task 3 ✓
- `loadTableBrowser` defined in Task 5, effect in Task 5 ✓
- `browserData`, `browserTable` etc. state defined in Task 3, consumed in Task 5 ✓
- `BROWSER_TABLES` and `PIE_COLORS` defined in Task 5/4, same array as `ALLOWED_TABLES` in Task 2 ✓
- `fmtCell` defined and used in Task 5 ✓
- `cmdData` defined in Task 6, registered in Task 6 ✓
