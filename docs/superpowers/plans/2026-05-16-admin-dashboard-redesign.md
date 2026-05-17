# Admin Dashboard Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign `src/pages/admin/Health.jsx` from a single long scroll page to a Mission Control tabbed interface with glassmorphism cards, KPI counter animations, stagger entrance animations, and full mobile responsiveness.

**Architecture:** All state management and data-fetch handlers remain unchanged (lines 1–899). Only the `return` block is restructured. A new `activeTab` state controls which of 5 panels renders. Animations use CSS keyframes injected via `<style>` tag — no new libraries.

**Tech Stack:** React, framer-motion (already installed), inline CSS, CSS keyframes, `requestAnimationFrame` counter animation.

---

## File map

| File | Change |
|------|--------|
| `src/pages/admin/Health.jsx` | Add `activeTab` state + `counterKey` ref + full JSX rewrite from line 874 onward |

---

### Task 1: Add tab state and counter key ref

**Files:**
- Modify: `src/pages/admin/Health.jsx:300-375`

- [ ] **Step 1: Add `activeTab` state and `counterKeyRef` after the existing state declarations (after line 371, before `const loadData`)**

Find this block (around line 370-375):
```jsx
  const maintenanceToastTimer = useRef(null)

  // isAdmin is determined by the server response...
  const [isAdmin, setIsAdmin] = useState(true)
```

Add after `const maintenanceToastTimer = useRef(null)`:
```jsx
  const [activeTab, setActiveTab] = useState('overview')
  const counterKeyRef = useRef(0) // increments on each Overview tab enter to re-trigger counters
```

- [ ] **Step 2: Commit**
```bash
git add src/pages/admin/Health.jsx
git commit -m "feat(admin): add activeTab and counterKey state"
```

---

### Task 2: Replace the guard states and `<style>` block

**Files:**
- Modify: `src/pages/admin/Health.jsx:874-920`

- [ ] **Step 1: Replace the guard block and opening `<style>` tag**

Find (lines 874–920):
```jsx
  const shell = { minHeight: '100vh', background: BG, fontFamily: "'Poppins', sans-serif", color: WHITE }
  if (loading)             return <div className="admin-shell" style={shell}>Loading…</div>
  if (!isAdmin)            return <div className="admin-shell" style={{ ...shell, color: RED }}>Access denied.</div>
  if (initialLoading && !data) return <div className="admin-shell" style={shell}>Fetching dashboard data…</div>
  if (error && !data)      return <div className="admin-shell" style={{ ...shell, color: RED }}>Error: {error}</div>
  if (!data)               return null
```

Replace with:
```jsx
  const shell = { minHeight: '100vh', background: BG, fontFamily: "'Poppins', sans-serif", color: WHITE }
  if (loading) return (
    <div style={shell}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12 }}>
        <svg style={{ animation: 'adminSpin 0.8s linear infinite', flexShrink: 0 }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading…</span>
        <style>{`@keyframes adminSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
  if (!isAdmin) return (
    <div style={{ ...shell, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 48, color: RED, marginBottom: 12 }}>403</div>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 14, color: 'rgba(255,255,255,0.5)' }}>Access denied. Admin only.</div>
      </div>
    </div>
  )
  if (initialLoading && !data) return (
    <div style={shell}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12 }}>
        <svg style={{ animation: 'adminSpin 0.8s linear infinite', flexShrink: 0 }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round">
          <path d="M21 12a9 9 0 1 1-6.219-8.56" />
        </svg>
        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Fetching dashboard data…</span>
        <style>{`@keyframes adminSpin { to { transform: rotate(360deg); } }`}</style>
      </div>
    </div>
  )
  if (error && !data) return (
    <div style={{ ...shell, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', maxWidth: 400 }}>
        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, color: RED, marginBottom: 8 }}>Error loading dashboard</div>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.4)', marginBottom: 16 }}>{error}</div>
        <button onClick={handleRefresh} style={{ background: BLUE, color: WHITE, border: 'none', borderRadius: 8, padding: '8px 20px', fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>Retry</button>
      </div>
    </div>
  )
  if (!data) return null
```

- [ ] **Step 2: Commit**
```bash
git add src/pages/admin/Health.jsx
git commit -m "feat(admin): redesign guard/loading states"
```

---

### Task 3: Rewrite the return block — top bar, tabs, CSS

**Files:**
- Modify: `src/pages/admin/Health.jsx:901-1001` (the `return (` opening through the old header)

- [ ] **Step 1: Replace the entire `return (` block opening through the old header div (lines 901–1001) with the new shell + CSS + top bar + tabs**

Find this entire block (lines 901–1001):
```jsx
  return (
    <div className="admin-shell" style={{ minHeight: '100vh', background: BG, fontFamily: "'Poppins', sans-serif", color: WHITE }}>
      <style>{`
        @keyframes vitalPulse {
          ...
        }
        .admin-shell { padding: 40px 48px; }
        ...
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
        ...
        </div>
      </div>
```

Replace the entire return statement's opening (from `return (` to just before `{/* ── Test Alerts result panel */}`) with:

```jsx
  const TAB_ITEMS = [
    { id: 'overview',  label: 'Overview' },
    { id: 'users',     label: 'Users' },
    { id: 'payments',  label: 'Payments' },
    { id: 'vitals',    label: 'Vitals' },
    { id: 'logs',      label: 'Logs' },
  ]

  const degradedVitals = vitals
    ? (() => {
        const lastCallRecent = vitals.last_call_at
          ? (Date.now() - new Date(vitals.last_call_at).getTime()) < 30 * 60 * 1000
          : false
        return (!lastCallRecent ? 1 : 0) +
          (vitals.avg_response_ms !== null && vitals.avg_response_ms > 30000 ? 1 : 0)
      })()
    : 0

  const unreadLogs = (systemLogs?.length ?? 0) + (sentryIssues?.length ?? 0)

  function switchTab(id) {
    if (id === 'overview') counterKeyRef.current += 1
    setActiveTab(id)
  }

  const userInitials = (user?.email || 'AD').slice(0, 2).toUpperCase()

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Poppins', sans-serif", color: WHITE }}>
      <style>{`
        @keyframes vitalPulse {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%       { transform: scale(1.3); opacity: 0.6; }
        }
        @keyframes adminSpin   { to { transform: rotate(360deg); } }
        @keyframes mcSlideUp   { from { opacity:0; transform:translateY(16px); } to { opacity:1; transform:translateY(0); } }
        @keyframes mcSlideRight { from { opacity:0; transform:translateX(12px); } to { opacity:1; transform:translateX(0); } }
        @keyframes mcGrowUp    { from { transform:scaleY(0); opacity:0; } to { transform:scaleY(1); opacity:1; } }
        @keyframes mcFadeIn    { from { opacity:0; } to { opacity:1; } }
        .mc-card {
          background: rgba(15,34,53,0.7);
          border: 1px solid rgba(255,255,255,0.08);
          border-radius: 14px;
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
        }
        .mc-card-enter { animation: mcSlideUp 0.4s ease both; }
        .mc-tab-content { animation: mcFadeIn 0.2s ease both; }
        .mc-skeleton {
          background: rgba(255,255,255,0.06);
          border-radius: 8px;
          animation: mcSkeleton 1.4s ease-in-out infinite;
        }
        @keyframes mcSkeleton {
          0%,100% { opacity:0.5; }
          50%      { opacity:1; }
        }
        .mc-bar { transform-origin: bottom; animation: mcGrowUp 0.7s ease both; }
        .mc-feed-item { animation: mcSlideRight 0.35s ease both; }
        .mc-topbar { position: sticky; top: 0; z-index: 50; background: #0D1B2A; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .mc-tabs  { background: #060E18; border-bottom: 1px solid rgba(255,255,255,0.07); }
        .mc-main  { padding: 28px 28px 80px; max-width: 1400px; margin: 0 auto; }
        .mc-kpi-grid { display: grid; grid-template-columns: repeat(4,1fr); gap: 16px; }
        .mc-row2  { display: grid; grid-template-columns: 1fr 340px; gap: 16px; }
        .mc-vitals-grid { display: grid; grid-template-columns: repeat(3,1fr); gap: 12px; }
        .mc-charts-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        @media (max-width: 1100px) { .mc-row2 { grid-template-columns: 1fr; } }
        @media (max-width: 900px)  { .mc-kpi-grid { grid-template-columns: repeat(2,1fr); } .mc-charts-grid { grid-template-columns: 1fr; } }
        @media (max-width: 700px)  { .mc-vitals-grid { grid-template-columns: 1fr; } }
        @media (max-width: 600px)  {
          .mc-main { padding: 16px 16px 80px; }
          .mc-kpi-grid { grid-template-columns: 1fr; }
          .mc-topbar-date { display: none; }
          .mc-desktop-tabs { display: none !important; }
          .mc-mobile-tabs  { display: block !important; }
        }
        .mc-desktop-tabs { display: flex; }
        .mc-mobile-tabs  { display: none; padding: 12px 16px; }
        .mc-mobile-tab-select {
          width: 100%;
          background: rgba(13,27,42,0.9);
          border: 1px solid rgba(255,255,255,0.1);
          color: #fff;
          border-radius: 10px;
          padding: 10px 14px;
          font-size: 13px;
          font-family: 'Poppins', sans-serif;
        }
        .mc-action-btn {
          font-family: 'Poppins', sans-serif;
          font-size: 11px; font-weight: 600;
          border-radius: 6px; padding: 4px 10px;
          cursor: pointer; transition: all 0.15s;
          border: 1px solid rgba(255,255,255,0.15);
          background: transparent;
          color: rgba(255,255,255,0.55);
        }
        .mc-action-btn:hover { background: rgba(255,255,255,0.08); color: #fff; }
        .mc-action-btn:disabled { opacity: 0.4; cursor: not-allowed; }
        .mc-section-divider {
          font-size: 10px; font-weight: 700; color: rgba(255,255,255,0.2);
          letter-spacing: 1.5px; text-transform: uppercase;
          margin: 28px 0 14px;
          display: flex; align-items: center; gap: 8px;
        }
        .mc-section-divider::after { content: ''; flex: 1; height: 1px; background: rgba(255,255,255,0.06); }
        .mc-live-pulse {
          width: 7px; height: 7px; border-radius: 50%; background: #4ade80;
          animation: vitalPulse 1.4s ease-in-out infinite; flex-shrink: 0;
        }
        @media (max-width: 480px) { .mc-main { padding: 12px 12px 80px; } }
      `}</style>

      {/* ── Sticky top bar ──────────────────────────────── */}
      <div className="mc-topbar" style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 24px' }}>
        <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, fontWeight: 400, color: WHITE, letterSpacing: '-0.3px' }}>
          FYPro <span style={{ color: BLUE }}>Admin</span>
        </span>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.25)', borderRadius: 999, padding: '3px 10px' }}>
          <div className="mc-live-pulse" />
          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: '#4ade80', letterSpacing: '0.5px' }}>LIVE</span>
        </div>
        <span className="mc-topbar-date" style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.25)' }}>
          {secondsAgo !== null ? (secondsAgo === 0 ? 'just now' : `${secondsAgo}s ago`) : '—'}
        </span>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            style={{
              fontFamily: "'Poppins', sans-serif", fontSize: 12, fontWeight: 600,
              color: refreshing ? 'rgba(255,255,255,0.4)' : WHITE,
              background: refreshing ? 'rgba(255,255,255,0.05)' : BLUE,
              border: `1px solid ${refreshing ? BORDER : BLUE}`,
              borderRadius: 8, padding: '7px 14px',
              cursor: refreshing ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            {refreshing ? (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <svg style={{ animation: 'adminSpin 0.8s linear infinite' }} width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                Refreshing
              </span>
            ) : '↻ Refresh'}
          </button>
          <button
            onClick={handleTestAlerts}
            disabled={testAlertsBusy}
            style={{
              fontFamily: "'Poppins', sans-serif", fontSize: 12, fontWeight: 600,
              color: testAlertsBusy ? 'rgba(255,255,255,0.4)' : WHITE,
              background: testAlertsBusy ? 'rgba(255,255,255,0.05)'
                : testAlertsResult?.all_ok === true  ? GREEN
                : testAlertsResult?.all_ok === false ? RED
                : 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8, padding: '7px 14px',
              cursor: testAlertsBusy ? 'not-allowed' : 'pointer',
            }}
          >
            {testAlertsBusy ? '…' : testAlertsResult ? (testAlertsResult.all_ok ? `✓ ${testAlertsResult.sent}/10` : `⚠ ${testAlertsResult.failures} failed`) : '🔔 Test'}
          </button>
          <button
            onClick={() => import('@sentry/react').then(Sentry => Sentry.captureException(new Error('Manual Sentry test from admin')))}
            style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, fontWeight: 600, color: WHITE, background: '#7c3aed', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer' }}
          >
            Sentry
          </button>
          <div style={{ width: 30, height: 30, borderRadius: '50%', background: 'rgba(0,102,255,0.2)', border: '1px solid rgba(0,102,255,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 700, color: '#60A5FA' }}>
            {userInitials}
          </div>
        </div>
      </div>

      {/* ── Tab bar — desktop ───────────────────────────── */}
      <div className="mc-tabs">
        <div className="mc-desktop-tabs" style={{ alignItems: 'center', gap: 4, padding: '12px 24px 0', overflowX: 'auto' }}>
          {TAB_ITEMS.map(t => {
            const badge = t.id === 'vitals' && degradedVitals > 0 ? degradedVitals
              : t.id === 'logs' && unreadLogs > 0 ? unreadLogs
              : null
            return (
              <button
                key={t.id}
                onClick={() => switchTab(t.id)}
                style={{
                  fontFamily: "'Poppins', sans-serif", fontSize: 12, fontWeight: 600,
                  color: activeTab === t.id ? '#60A5FA' : 'rgba(255,255,255,0.4)',
                  background: activeTab === t.id ? '#0D1B2A' : 'transparent',
                  border: activeTab === t.id ? '1px solid rgba(255,255,255,0.08)' : '1px solid transparent',
                  borderBottom: activeTab === t.id ? '1px solid #0D1B2A' : '1px solid transparent',
                  borderRadius: '8px 8px 0 0',
                  padding: '8px 18px', cursor: 'pointer',
                  position: 'relative', bottom: -1,
                  transition: 'color 0.15s',
                  display: 'flex', alignItems: 'center', gap: 6,
                  whiteSpace: 'nowrap',
                }}
              >
                {t.label}
                {badge !== null && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(239,68,68,0.2)', color: '#f87171', borderRadius: 999, minWidth: 18, height: 16, padding: '0 5px', fontSize: 9, fontWeight: 700 }}>
                    {badge}
                  </span>
                )}
              </button>
            )
          })}
        </div>
        {/* Mobile select */}
        <div className="mc-mobile-tabs">
          <select
            className="mc-mobile-tab-select"
            value={activeTab}
            onChange={e => switchTab(e.target.value)}
          >
            {TAB_ITEMS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </div>
      </div>

      {/* ── Test alerts result panel (global) ──────────── */}
      {testAlertsResult && (
        <div style={{ margin: '0 24px', marginTop: 12, padding: '10px 14px', background: testAlertsResult.all_ok ? 'rgba(22,163,74,0.1)' : 'rgba(220,38,38,0.1)', border: `1px solid ${testAlertsResult.all_ok ? 'rgba(22,163,74,0.3)' : 'rgba(220,38,38,0.3)'}`, borderRadius: 10 }}>
          {testAlertsResult.error ? (
            <p style={{ margin: 0, fontSize: 12, color: RED, fontFamily: "'Poppins', sans-serif" }}>Network error: {testAlertsResult.error}</p>
          ) : (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
              {(testAlertsResult.results || []).map(r => (
                <span key={r.key} style={{ fontSize: 11, fontFamily: "'JetBrains Mono', monospace", color: r.ok ? '#4ade80' : RED }}>
                  {r.ok ? '✓' : '✗'} {r.key}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab content ─────────────────────────────────── */}
      <div className="mc-main">
```

(This replaces from line 901 through line 1031 of the original file.)

- [ ] **Step 2: Commit**
```bash
git add src/pages/admin/Health.jsx
git commit -m "feat(admin): add MC top bar, tab nav, CSS keyframes"
```

---

### Task 4: Build the Overview tab panel

**Files:**
- Modify: `src/pages/admin/Health.jsx` — insert Overview tab content after the main div opens

- [ ] **Step 1: After the `<div className="mc-main">` opening, insert the Overview tab panel**

This replaces the following old sections (which are now deleted):
- Old header (lines 922–1001)
- System Controls (lines 1032–1162)
- System Vitals widget at top (lines 1163–1203)
- Overview Cards section (lines 1205–1224)
- Unit Economics widget (lines 1226–1279)
- Cache Performance widget (lines 1281–1314)

Insert:
```jsx
        {/* ══ OVERVIEW TAB ══════════════════════════════════════════════ */}
        {activeTab === 'overview' && (
          <div className="mc-tab-content">

            {/* KPI grid */}
            <div className="mc-section-divider">Key metrics</div>
            <div className="mc-kpi-grid" style={{ marginBottom: 20 }}>
              {[
                { label: 'Total Users',    value: overview.total_users,         prefix: '',  suffix: '',   glow: '#60A5FA', shadow: 'rgba(0,102,255,0.55)',   delay: 0 },
                { label: 'Total Revenue',  value: overview.total_revenue_ngn,   prefix: '₦', suffix: '',   glow: '#4ade80', shadow: 'rgba(22,163,74,0.45)',    delay: 0.06 },
                { label: 'AI Spend Today', value: daily_spend?.spent_usd ?? 0,  prefix: '$', suffix: '', decimals: 2, glow: '#fbbf24', shadow: 'rgba(245,158,11,0.45)', delay: 0.12 },
                { label: 'Defenses Done',  value: overview.active_this_week,    prefix: '',  suffix: '',   glow: WHITE,     shadow: 'none',                    delay: 0.18 },
              ].map(({ label, value, prefix, suffix, decimals = 0, glow, shadow, delay }, i) => (
                <KpiCounterCard
                  key={label + counterKeyRef.current}
                  label={label}
                  target={value}
                  prefix={prefix}
                  suffix={suffix}
                  decimals={decimals}
                  glow={glow}
                  shadow={shadow}
                  delay={delay}
                  sub={i === 2 ? `cap $${(daily_spend?.cap_usd ?? 10).toFixed(2)} · $${(daily_spend?.remaining_usd ?? 10).toFixed(2)} left` : null}
                />
              ))}
            </div>

            {/* Signups chart + live feed */}
            <div className="mc-section-divider">Daily signups this week vs last week</div>
            <div className="mc-row2" style={{ marginBottom: 20 }}>
              {/* Signups comparison bar chart */}
              <div className="mc-card mc-card-enter" style={{ padding: '22px 24px', animationDelay: '0.24s' }}>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 18 }}>Daily Signups</div>
                <SignupsBarChart data={signups_chart} />
              </div>
              {/* Live activity feed */}
              <div className="mc-card mc-card-enter" style={{ padding: '22px 24px', animationDelay: '0.30s' }}>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 16 }}>Live Activity</div>
                <LiveFeed data={data} failures={failures} />
              </div>
            </div>

            {/* Revenue chart (30d) */}
            <div className="mc-section-divider">Revenue — last 30 days</div>
            <div className="mc-card mc-card-enter" style={{ padding: '22px 24px', marginBottom: 20, animationDelay: '0.35s' }}>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: 16 }}>Daily Revenue (₦)</div>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={revenue_chart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
                  <XAxis dataKey="date" tickFormatter={fmtChartDate} tick={{ fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' }} />
                  <Tooltip {...tooltipStyle} labelFormatter={v => fmtChartDate(v)} formatter={v => [`₦${v.toLocaleString()}`, 'Revenue']} />
                  <Line type="monotone" dataKey="amount" stroke={GREEN} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Unit economics + cache + more overview cards */}
            <div className="mc-section-divider">Economics & performance</div>
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 16 }}>
              <OverviewCard label="Active Today"     value={overview.active_today.toLocaleString()}      accent={GREEN} />
              <OverviewCard label="Active This Week" value={overview.active_this_week.toLocaleString()}  accent={GREEN} />
              <OverviewCard label="Paid Users"       value={overview.total_paid.toLocaleString()}         accent={AMBER} />
              <OverviewCard label="Conversion Rate"  value={`${overview.conversion_rate}%`} sub="paid ÷ total" accent={BLUE} />
              <OverviewCard label="Failed Payments"  value={String(failed_payments_today ?? 0)} sub="today" accent={(failed_payments_today ?? 0) > 0 ? RED : BLUE} />
              <SpendCard spend={daily_spend} />
              <SignupsCompareCard today={overview.signups_today ?? 0} yesterday={signups_yesterday ?? 0} />
            </div>

            {/* Unit economics inline */}
            <div className="mc-card mc-card-enter" style={{ padding: '20px 24px', marginBottom: 16, animationDelay: '0.38s' }}>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Unit Economics — Today</div>
              <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
                {(() => {
                  const spentUsd    = daily_spend?.spent_usd || 0
                  const activeToday = overview.active_today  || 0
                  const ngn         = ngn_per_usd            || 1600
                  const payingU     = paying_users_today      || 0
                  const revToday    = revenue_today_ngn       || 0
                  const costPerUser = activeToday > 0 ? (spentUsd * ngn) / activeToday : null
                  const cpuColor    = costPerUser === null ? MUTED : costPerUser < 200 ? GREEN : costPerUser <= 400 ? AMBER : RED
                  const revPerUser  = payingU > 0 ? revToday / payingU : null
                  const margin      = revPerUser && costPerUser !== null && revPerUser > 0
                    ? ((revPerUser - costPerUser) / revPerUser) * 100 : null
                  const marginColor = margin === null ? MUTED : margin > 60 ? GREEN : margin >= 30 ? AMBER : RED
                  return (
                    <>
                      <div><div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginBottom: 4 }}>Cost Per User</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: cpuColor }}>{costPerUser !== null ? `₦${costPerUser.toFixed(0)}` : '—'}</div></div>
                      <div><div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginBottom: 4 }}>Revenue Per User</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: WHITE }}>{revPerUser !== null ? `₦${revPerUser.toFixed(0)}` : '—'}</div></div>
                      <div><div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginBottom: 4 }}>Profit Margin</div><div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: marginColor }}>{margin !== null ? `${margin.toFixed(1)}%` : '—'}</div></div>
                    </>
                  )
                })()}
              </div>
            </div>

            {/* Cache */}
            <div className="mc-card mc-card-enter" style={{ padding: '20px 24px', marginBottom: 16, animationDelay: '0.42s' }}>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>Cache Performance</div>
              {(() => {
                const hitRate   = cache_hit_rate?.hit_rate_pct ?? 0
                const hitsTotal = cache_hit_rate?.hits_total   ?? 0
                const freshCalls = daily_spend?.request_count  ?? 0
                const spentUsd  = daily_spend?.spent_usd ?? 0
                const costPerFresh = freshCalls > 0 ? spentUsd / freshCalls : 0
                const savings   = hitsTotal * costPerFresh * (ngn_per_usd || 1600)
                const rateColor = hitRate > 25 ? GREEN : hitRate >= 10 ? AMBER : RED
                return (
                  <>
                    <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 700, color: rateColor, lineHeight: 1, marginBottom: 10 }}>{hitRate}%</div>
                    <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 8 }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: GREEN }}>{hitsTotal.toLocaleString()} cached today</span>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: AMBER }}>{freshCalls.toLocaleString()} fresh calls</span>
                    </div>
                    <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED }}>Est. savings: <span style={{ color: WHITE, fontFamily: "'JetBrains Mono', monospace" }}>₦{savings.toFixed(0)}</span></div>
                  </>
                )
              })()}
            </div>

            {/* Feature usage */}
            <div className="mc-section-divider">Feature usage</div>
            <div className="mc-card mc-card-enter" style={{ padding: '20px 24px', marginBottom: 16, animationDelay: '0.45s' }}>
              {feature_usage.map(({ feature, count }) => (
                <div key={feature} style={{ marginBottom: 14 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                    <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM }}>{FEATURE_LABELS[feature] || feature}</span>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: WHITE }}>{count.toLocaleString()}</span>
                  </div>
                  <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999 }}>
                    <div style={{ height: 6, background: `linear-gradient(90deg, ${BLUE}, rgba(0,102,255,0.4))`, borderRadius: 999, width: `${maxFeature > 0 ? (count / maxFeature * 100) : 0}%`, transition: 'width 0.5s ease' }} />
                  </div>
                </div>
              ))}
            </div>

            {/* Drop-off funnel */}
            <div className="mc-section-divider">Drop-off analysis</div>
            <div className="mc-card mc-card-enter" style={{ padding: '20px 24px', marginBottom: 16, animationDelay: '0.48s' }}>
              {funnel.map(({ step, count, dropoff_pct, pct_of_total }, i) => (
                <div key={step}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                    <div style={{ flex: '0 0 180px', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM }}>{FUNNEL_LABELS[step] || step}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ height: 36, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct_of_total}%`, minWidth: count > 0 ? 80 : 0, background: `linear-gradient(90deg, ${BLUE}cc, ${BLUE}55)`, borderRadius: 6, display: 'flex', alignItems: 'center', paddingLeft: 12, transition: 'width 0.6s ease' }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: WHITE, whiteSpace: 'nowrap' }}>{count.toLocaleString()} ({pct_of_total}%)</span>
                        </div>
                      </div>
                    </div>
                    <div style={{ flex: '0 0 110px', textAlign: 'right' }}>
                      {i < funnel.length - 1 && <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: parseFloat(dropoff_pct) > 50 ? RED : AMBER }}>−{dropoff_pct}% drop</span>}
                    </div>
                  </div>
                  {i < funnel.length - 1 && <div style={{ textAlign: 'left', paddingLeft: 195, color: MUTED, fontSize: 14, lineHeight: 1, margin: '2px 0' }}>↓</div>}
                </div>
              ))}
            </div>

            {/* System controls */}
            <div className="mc-section-divider">System controls</div>
            <div className="mc-card mc-card-enter" style={{ padding: '20px 24px', marginBottom: 16, animationDelay: '0.50s' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 18 }}>
                <div>
                  <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>Maintenance Mode</div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: maintenanceLoading ? MUTED : maintenanceMode ? AMBER : GREEN, animation: !maintenanceLoading && maintenanceMode ? 'vitalPulse 1.5s ease-in-out infinite' : 'none' }} />
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 14, fontWeight: 700, color: maintenanceLoading ? MUTED : maintenanceMode ? AMBER : GREEN }}>
                      {maintenanceLoading ? '…' : maintenanceMode ? 'MAINTENANCE' : 'LIVE'}
                    </span>
                    {maintenanceUpdatedAt && <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED }}>· Updated {timeAgo(maintenanceUpdatedAt)}</span>}
                  </div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM }}>Toggle</span>
                  <button onClick={handleToggleMaintenance} disabled={maintenanceBusy || maintenanceLoading} aria-label={maintenanceMode ? 'Disable maintenance mode' : 'Enable maintenance mode'}
                    style={{ width: 48, height: 26, borderRadius: 13, border: 'none', background: maintenanceMode ? AMBER : 'rgba(255,255,255,0.12)', cursor: maintenanceBusy || maintenanceLoading ? 'not-allowed' : 'pointer', position: 'relative', transition: 'background 0.2s ease', opacity: maintenanceBusy ? 0.6 : 1, flexShrink: 0 }}>
                    <div style={{ width: 20, height: 20, borderRadius: '50%', background: WHITE, position: 'absolute', top: 3, left: maintenanceMode ? 25 : 3, transition: 'left 0.2s ease', boxShadow: '0 1px 4px rgba(0,0,0,0.3)' }} />
                  </button>
                </div>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <input type="text" value={maintenanceMessage} onChange={e => setMaintenanceMessage(e.target.value)} placeholder="FYPro is currently undergoing scheduled maintenance…"
                  style={{ flex: 1, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: '8px 14px', color: WHITE, fontFamily: "'Poppins', sans-serif", fontSize: 13, outline: 'none', minWidth: 0 }} />
                <button onClick={handleSaveMaintenanceMessage} disabled={maintenanceBusy}
                  style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 600, color: WHITE, background: maintenanceBusy ? 'rgba(255,255,255,0.1)' : BLUE, border: 'none', borderRadius: 8, padding: '8px 18px', cursor: maintenanceBusy ? 'not-allowed' : 'pointer', flexShrink: 0 }}>Save</button>
              </div>
              {maintenanceToast && (
                <div style={{ marginTop: 10, padding: '8px 14px', background: maintenanceToast.type === 'error' ? 'rgba(220,38,38,0.1)' : 'rgba(22,163,74,0.1)', border: `1px solid ${maintenanceToast.type === 'error' ? 'rgba(220,38,38,0.3)' : 'rgba(22,163,74,0.3)'}`, borderRadius: 8, fontFamily: "'Poppins', sans-serif", fontSize: 12, color: maintenanceToast.type === 'error' ? '#F87171' : '#4ade80' }}>
                  {maintenanceToast.message}
                </div>
              )}
            </div>

          </div>
        )}
```

- [ ] **Step 2: Commit**
```bash
git add src/pages/admin/Health.jsx
git commit -m "feat(admin): build Overview tab panel"
```

---

### Task 5: Add KpiCounterCard, SignupsBarChart, LiveFeed helper components

**Files:**
- Modify: `src/pages/admin/Health.jsx` — add three new helper components before `export default function AdminHealth()`

- [ ] **Step 1: Insert the three helper components right before `export default function AdminHealth()` (around line 299)**

Find:
```jsx
const INTERVAL_OVERVIEW = 20 * 1000   // 20s
```

Insert before that line:
```jsx
// ── KPI counter card ─────────────────────────────────────────────────
function KpiCounterCard({ label, target, prefix = '', suffix = '', decimals = 0, glow, shadow, delay, sub }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const duration = 1400
    const start = performance.now()
    let raf
    function step(now) {
      const pct  = Math.min((now - start) / duration, 1)
      const ease = 1 - Math.pow(1 - pct, 3)
      setDisplay(target * ease)
      if (pct < 1) raf = requestAnimationFrame(step)
    }
    const tid = setTimeout(() => { raf = requestAnimationFrame(step) }, delay * 1000)
    return () => { clearTimeout(tid); cancelAnimationFrame(raf) }
  }, [target, delay])

  const formatted = decimals > 0
    ? display.toFixed(decimals)
    : Math.floor(display).toLocaleString()

  return (
    <div className="mc-card mc-card-enter" style={{ padding: '20px 22px', animationDelay: `${delay}s`, position: 'relative', overflow: 'hidden' }}>
      <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(135deg, rgba(0,102,255,0.04) 0%, transparent 60%)', pointerEvents: 'none' }} />
      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.35)', letterSpacing: '1px', textTransform: 'uppercase', marginBottom: 8 }}>{label}</div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 800, lineHeight: 1, color: glow, textShadow: shadow !== 'none' ? `0 0 24px ${shadow}` : 'none' }}>
        {prefix}{formatted}{suffix}
      </div>
      {sub && <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.35)', marginTop: 6 }}>{sub}</div>}
    </div>
  )
}

// ── Weekly signups bar chart ─────────────────────────────────────────
function SignupsBarChart({ data }) {
  if (!data || data.length === 0) return <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>No data yet</div>
  const recent = data.slice(-14)
  const maxVal = Math.max(...recent.map(d => d.count), 1)
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 120 }}>
      {recent.map((d, i) => (
        <div key={d.date} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
          <div
            className="mc-bar"
            style={{
              width: '100%',
              height: `${(d.count / maxVal) * 100}px`,
              borderRadius: '3px 3px 0 0',
              background: `linear-gradient(to top, #0066FF, rgba(0,102,255,0.2))`,
              animationDelay: `${0.35 + i * 0.04}s`,
            }}
          />
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
            {new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).slice(0,5)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Live activity feed ───────────────────────────────────────────────
function LiveFeed({ data, failures }) {
  const events = []
  if (data?.users) {
    const recent = [...data.users].sort((a, b) => new Date(b.signup_date) - new Date(a.signup_date)).slice(0, 2)
    recent.forEach(u => events.push({ color: '#4ade80', text: `New signup — ${u.email?.split('@')[0] || '…'}`, time: u.signup_date }))
  }
  if (failures?.rows) {
    failures.rows.filter(r => !r.resolved).slice(0, 2).forEach(r => {
      events.push({ color: '#fbbf24', text: `AI gen fail — ${r.feature || 'unknown'}`, time: r.created_at })
    })
  }
  events.sort((a, b) => new Date(b.time) - new Date(a.time))

  function timeAgoShort(iso) {
    if (!iso) return '—'
    const ms = Date.now() - new Date(iso).getTime()
    const m = Math.floor(ms / 60000)
    if (m < 1) return 'just now'
    if (m < 60) return `${m}m ago`
    return `${Math.floor(m / 60)}h ago`
  }

  if (events.length === 0) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: 100, color: 'rgba(255,255,255,0.2)', fontSize: 12, fontFamily: "'Poppins', sans-serif" }}>No recent activity</div>
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {events.slice(0, 6).map((e, i) => (
        <div key={i} className="mc-feed-item" style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '9px 12px', borderRadius: 8, background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.05)', animationDelay: `${0.5 + i * 0.06}s` }}>
          <div style={{ width: 7, height: 7, borderRadius: '50%', background: e.color, flexShrink: 0, marginTop: 4 }} />
          <div>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: 'rgba(255,255,255,0.75)' }}>{e.text}</div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: 'rgba(255,255,255,0.25)', marginTop: 2 }}>{timeAgoShort(e.time)}</div>
          </div>
        </div>
      ))}
    </div>
  )
}

```

- [ ] **Step 2: Add missing `import { useState } from 'react'` note** — `useState` is already imported at line 1, so nothing to do.

- [ ] **Step 3: Commit**
```bash
git add src/pages/admin/Health.jsx
git commit -m "feat(admin): add KpiCounterCard, SignupsBarChart, LiveFeed components"
```

---

### Task 6: Build Users, Payments, Vitals, Logs tab panels

**Files:**
- Modify: `src/pages/admin/Health.jsx` — insert remaining 4 tab panels after the Overview panel closes

- [ ] **Step 1: After the Overview tab panel's closing `)}`, insert the Users tab panel**

```jsx
        {/* ══ USERS TAB ══════════════════════════════════════════════════ */}
        {activeTab === 'users' && (
          <div className="mc-tab-content">
            <div className="mc-section-divider">User management</div>

            {userActionToast && (
              <div style={{ marginBottom: 12, padding: '8px 14px', background: userActionToast.type === 'error' ? 'rgba(220,38,38,0.1)' : 'rgba(22,163,74,0.1)', border: `1px solid ${userActionToast.type === 'error' ? 'rgba(220,38,38,0.3)' : 'rgba(22,163,74,0.3)'}`, borderRadius: 8, fontSize: 12, color: userActionToast.type === 'error' ? '#F87171' : '#4ade80', fontFamily: "'Poppins', sans-serif" }}>
                {userActionToast.message}
              </div>
            )}

            <div className="mc-card mc-card-enter" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '18px 22px', display: 'flex', alignItems: 'center', gap: 12, borderBottom: `1px solid ${BORDER}`, flexWrap: 'wrap' }}>
                <input type="text" placeholder="Search by email…" value={search} onChange={e => { setSearch(e.target.value); setPage(0) }}
                  style={{ flex: 1, minWidth: 200, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '7px 12px', color: WHITE, fontFamily: "'Poppins', sans-serif", fontSize: 12, outline: 'none' }} />
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: MUTED }}>{filteredUsers.length} users</span>
              </div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 920 }}>
                  <thead>
                    <tr>
                      {[['email','Email'],['signup_date','Signed Up'],['last_active','Last Active'],['plan','Plan'],['project_count','Projects'],['status','Status'],['paid_amount','Paid (₦)']].map(([key, label]) => (
                        <Th key={key} sortKey={key} active={sortKey === key} dir={sortDir} onSort={handleSort}>{label}</Th>
                      ))}
                      <th style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 12px', textAlign: 'left', background: SURFACE }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.length === 0 ? (
                      <tr><td colSpan={8} style={{ padding: '32px 12px', textAlign: 'center', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED }}>No users found.</td></tr>
                    ) : pageRows.map((u, i) => {
                      const aState = actionState[u.id]
                      const isPending = aState === 'pending'
                      return (
                        <tr key={u.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                          <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: WHITE, fontWeight: 500, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>{u.email || '—'}</td>
                          <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>{fmtDate(u.signup_date)}</td>
                          <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>{fmtDate(u.last_active)}</td>
                          <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}><PlanBadge plan={u.plan} /></td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: WHITE, padding: '10px 12px', borderTop: `1px solid ${BORDER}`, textAlign: 'center' }}>{u.project_count}</td>
                          <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}><StatusBadge status={u.status} /></td>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: WHITE, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>{u.paid_amount > 0 ? `₦${u.paid_amount.toLocaleString()}` : '—'}</td>
                          <td style={{ padding: '6px 12px', borderTop: `1px solid ${BORDER}`, minWidth: 220 }}>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                              <button className="mc-action-btn" disabled={isPending || aState === 'banned'} onClick={() => handleBanUser(u.id, u.email)} style={{ color: aState === 'banned' ? MUTED : AMBER, borderColor: aState === 'banned' ? BORDER : AMBER + '55' }}>{aState === 'banned' ? 'Banned' : isPending ? '…' : 'Ban'}</button>
                              <button className="mc-action-btn" disabled={isPending} onClick={() => handleDeleteUser(u.id, u.email)} style={{ color: RED, borderColor: RED + '55' }}>{aState === 'error' ? 'Retry' : isPending ? '…' : 'Delete'}</button>
                              <button className="mc-action-btn" disabled={isPending} onClick={() => handleResetRunCounts(u.id, u.email)}>Reset Runs</button>
                              <button className="mc-action-btn" disabled={isPending} onClick={() => handleGrantPlan(u.id, u.email, 'student')} style={{ color: '#60a5fa', borderColor: 'rgba(96,165,250,0.35)' }}>Grant Student</button>
                              <button className="mc-action-btn" disabled={isPending} onClick={() => handleGrantPlan(u.id, u.email, 'defense')} style={{ color: WHITE, background: `${BLUE}33`, borderColor: `${BLUE}66` }}>Grant Defense</button>
                              <button className="mc-action-btn" disabled={diagnoseBusy[u.id]} onClick={() => handleDiagnose(u.id, u.email)} style={{ color: AMBER, borderColor: AMBER + '55' }}>{diagnoseBusy[u.id] ? '…' : 'Diagnose'}</button>
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              {totalPages > 1 && (
                <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', padding: '16px 22px' }}>
                  <button disabled={page === 0} onClick={() => setPage(p => p - 1)} style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: page === 0 ? MUTED : WHITE, borderRadius: 6, padding: '6px 14px', cursor: page === 0 ? 'default' : 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: 13 }}>← Prev</button>
                  <span style={{ color: MUTED, fontSize: 13 }}>Page {page + 1} of {totalPages}</span>
                  <button disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)} style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: page >= totalPages - 1 ? MUTED : WHITE, borderRadius: 6, padding: '6px 14px', cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: 13 }}>Next →</button>
                </div>
              )}
            </div>

            {/* Most active today */}
            {top_active_users && top_active_users.length > 0 && (
              <>
                <div className="mc-section-divider" style={{ marginTop: 24 }}>Most active today</div>
                <div className="mc-card mc-card-enter" style={{ overflow: 'hidden', animationDelay: '0.1s' }}>
                  <div style={{ overflowX: 'auto' }}>
                    <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                      <thead><tr>{['Email','Total Runs','Top Feature'].map(h => <th key={h} style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 12px', textAlign: 'left', background: SURFACE }}>{h}</th>)}</tr></thead>
                      <tbody>
                        {top_active_users.map((u, i) => (
                          <tr key={u.email} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                            <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: WHITE, fontWeight: 500, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>{u.email}</td>
                            <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: WHITE, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>{u.total_runs.toLocaleString()}</td>
                            <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>{FEATURE_LABELS[u.top_feature] || u.top_feature || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {/* Never converted */}
            <div className="mc-section-divider" style={{ marginTop: 24 }}>Never converted — {never_converted.length} targets</div>
            <div className="mc-card mc-card-enter" style={{ overflow: 'hidden', animationDelay: '0.2s', marginBottom: 16 }}>
              <div style={{ padding: '14px 22px', borderBottom: `1px solid ${BORDER}`, fontFamily: "'Poppins', sans-serif", fontSize: 12, color: MUTED }}>Signed up 3+ days ago · Free plan · Has at least one project.</div>
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead><tr>{['Email','Signed Up','Last Active','Steps Used'].map(h => <th key={h} style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 12px', textAlign: 'left', background: SURFACE }}>{h}</th>)}</tr></thead>
                  <tbody>
                    {never_converted.length === 0 ? (
                      <tr><td colSpan={4} style={{ padding: '24px 12px', textAlign: 'center', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED }}>No users match this criteria yet.</td></tr>
                    ) : never_converted.map((u, i) => (
                      <tr key={u.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                        <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: WHITE, fontWeight: 500, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>{u.email}</td>
                        <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>{fmtDate(u.signup_date)}</td>
                        <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>{fmtDate(u.last_active)}</td>
                        <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: WHITE, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>{u.steps_completed} / 10</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}

        {/* ══ PAYMENTS TAB ══════════════════════════════════════════════ */}
        {activeTab === 'payments' && (
          <div className="mc-tab-content">
            <div className="mc-section-divider">Payment issues</div>
            {paymentIssuesLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0,1,2].map(i => <div key={i} className="mc-skeleton" style={{ height: 80 }} />)}</div>
            ) : paymentIssuesError ? (
              <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 10, padding: '14px 18px', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: '#F87171' }}>Failed to load: {paymentIssuesError}</div>
            ) : !paymentIssues || paymentIssues.length === 0 ? (
              <div className="mc-card" style={{ padding: '32px', textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>✓</div>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: '#4ade80', fontWeight: 600 }}>No unresolved payment issues</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {paymentIssues.map(issue => (
                  <div key={issue.id} className="mc-card" style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap', borderLeft: `3px solid ${AMBER}` }}>
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: WHITE, marginBottom: 2 }}>{issue.user_email}</div>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: AMBER, marginBottom: 4 }}>ref: {issue.transaction_ref}</div>
                      {issue.description && <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: MUTED }}>{issue.description.slice(0, 80)}{issue.description.length > 80 ? '…' : ''}</div>}
                    </div>
                    <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, flexShrink: 0 }}>{timeAgo(issue.created_at)}</div>
                    <button onClick={() => handleResolvePaymentIssue(issue.id)} disabled={resolvingIssueId === issue.id}
                      style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, fontWeight: 600, background: resolvingIssueId === issue.id ? 'rgba(22,163,74,0.2)' : GREEN, color: WHITE, border: 'none', borderRadius: 6, padding: '6px 14px', cursor: resolvingIssueId === issue.id ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                      {resolvingIssueId === issue.id ? 'Resolving…' : 'Mark Resolved'}
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* Feature feedback widget */}
            <div style={{ marginTop: 24 }}>
              <FeatureFeedbackWidget data={feedbackData} loading={feedbackLoading} error={feedbackError} />
            </div>
          </div>
        )}

        {/* ══ VITALS TAB ════════════════════════════════════════════════ */}
        {activeTab === 'vitals' && (
          <div className="mc-tab-content">
            <div className="mc-section-divider">System health</div>
            {vitalsLoading ? (
              <div className="mc-vitals-grid">{[0,1,2,3,4,5].map(i => <div key={i} className="mc-skeleton" style={{ height: 80 }} />)}</div>
            ) : vitalsError ? (
              <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 10, padding: '14px 18px', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: '#F87171' }}>Failed to load vitals: {vitalsError}</div>
            ) : (
              <div className="mc-vitals-grid">
                {(() => {
                  const lastCallRecent = vitals?.last_call_at
                    ? (Date.now() - new Date(vitals.last_call_at).getTime()) < 30 * 60 * 1000
                    : false
                  const engineColor = lastCallRecent ? GREEN : RED
                  const avgMs    = vitals?.avg_response_ms ?? null
                  const avgColor = avgMs === null ? RED : avgMs < 15000 ? GREEN : avgMs <= 30000 ? AMBER : RED
                  const avgValue = avgMs !== null ? `${(avgMs / 1000).toFixed(1)}s` : '—'
                  const failuresToday = vitals?.failures_today  || 0
                  const requestsToday = vitals?.requests_today  || 0
                  const errPct   = requestsToday > 0 ? (failuresToday / requestsToday) * 100 : 0
                  const errColor = requestsToday === 0 ? MUTED : errPct < 2 ? GREEN : errPct <= 5 ? AMBER : RED
                  const errValue = requestsToday > 0 ? `${errPct.toFixed(1)}%` : '—'
                  const items = [
                    { label: 'AI Engine',    value: lastCallRecent ? 'Operational' : 'Degraded', dotColor: engineColor, pulse: !lastCallRecent, detail: 'claude-sonnet-4-6' },
                    { label: 'Avg Response', value: avgValue, dotColor: avgColor, pulse: avgMs !== null && avgMs > 30000, detail: 'p95 response time' },
                    { label: 'Error Rate',   value: errValue, dotColor: errColor,  pulse: errPct > 5, detail: `${failuresToday} failures / ${requestsToday} req` },
                    { label: 'Active Now',   value: String(vitals?.active_sessions ?? 0), dotColor: BLUE, pulse: false, detail: 'concurrent sessions' },
                    { label: 'Supabase',     value: 'Operational', dotColor: GREEN, pulse: false, detail: 'DB + Auth' },
                    { label: 'Paystack',     value: 'Monitored',   dotColor: GREEN, pulse: false, detail: 'Webhook verified' },
                  ]
                  return items.map(({ label, value, dotColor, pulse, detail }, i) => (
                    <div key={label} className="mc-card mc-card-enter" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 12, animationDelay: `${i * 0.06}s` }}>
                      <div style={{ width: 36, height: 36, borderRadius: 10, background: `${dotColor}22`, border: `1px solid ${dotColor}44`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <div style={{ width: 10, height: 10, borderRadius: '50%', background: dotColor, animation: pulse ? 'vitalPulse 1.5s ease-in-out infinite' : 'none' }} />
                      </div>
                      <div>
                        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>{label}</div>
                        <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, fontWeight: 700, color: dotColor, marginTop: 2 }}>{value}</div>
                        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{detail}</div>
                      </div>
                    </div>
                  ))
                })()}
              </div>
            )}

            {/* Auth attempts */}
            <div className="mc-section-divider" style={{ marginTop: 24 }}>Auth attempts</div>
            {authAttemptsLoading ? (
              <div className="mc-skeleton" style={{ height: 60 }} />
            ) : authAttemptsError ? (
              <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 10, padding: '14px 18px', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: '#F87171' }}>Failed: {authAttemptsError}</div>
            ) : !authAttempts ? (
              <div className="mc-card" style={{ padding: '20px 22px', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED }}>No auth data yet.</div>
            ) : (
              <>
                <div style={{ display: 'flex', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
                  {[
                    { label: 'Total (24h)',    value: authAttempts.attempts?.length ?? 0,                                                       color: MUTED },
                    { label: 'Failed logins',  value: authAttempts.attempts?.filter(a => !a.success && a.action === 'login').length ?? 0,        color: '#F87171' },
                    { label: 'Signups',        value: authAttempts.attempts?.filter(a => a.action === 'signup').length ?? 0,                     color: '#60A5FA' },
                    { label: 'Suspicious IPs', value: authAttempts.suspicious?.length ?? 0, color: authAttempts.suspicious?.length > 0 ? '#F87171' : MUTED },
                  ].map(({ label, value, color }) => (
                    <div key={label} className="mc-card" style={{ padding: '12px 20px', flex: '1 1 110px' }}>
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color }}>{value}</div>
                      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginTop: 2 }}>{label}</div>
                    </div>
                  ))}
                </div>
                {authAttempts.suspicious?.length > 0 && (
                  <div style={{ marginBottom: 14 }}>
                    {authAttempts.suspicious.map(({ ip, failed_count }) => (
                      <div key={ip} style={{ background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.2)', borderLeft: '3px solid #DC2626', borderRadius: 8, padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#F87171' }}>{ip}</span>
                        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: '#F87171', fontWeight: 600 }}>{failed_count} failed</span>
                      </div>
                    ))}
                  </div>
                )}
                {authAttempts.attempts?.filter(a => !a.success && a.action === 'login').length === 0 ? (
                  <div className="mc-card" style={{ padding: '16px 22px', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED }}>No failed logins in the last 24 hours.</div>
                ) : (
                  <div className="mc-card" style={{ overflow: 'hidden' }}>
                    <div style={{ overflowX: 'auto' }}>
                      <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                        <thead><tr>{['When','Email','IP'].map(h => <th key={h} style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '8px 12px', textAlign: 'left', background: SURFACE }}>{h}</th>)}</tr></thead>
                        <tbody>
                          {authAttempts.attempts.filter(a => !a.success && a.action === 'login').slice(0, 20).map((a, i) => (
                            <tr key={a.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                              <td style={{ padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: MUTED, whiteSpace: 'nowrap', borderTop: `1px solid ${BORDER}` }}>{timeAgo(a.created_at)}</td>
                              <td style={{ padding: '8px 12px', fontFamily: "'Poppins', sans-serif", fontSize: 12, color: WHITE, borderTop: `1px solid ${BORDER}` }}>{a.email || '—'}</td>
                              <td style={{ padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: MUTED, borderTop: `1px solid ${BORDER}` }}>{a.ip || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* ══ LOGS TAB ═════════════════════════════════════════════════ */}
        {activeTab === 'logs' && (
          <div className="mc-tab-content">

            {/* System logs */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14 }} className="mc-section-divider">
              System logs
              {!systemLogsLoading && systemLogs !== null && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, background: systemLogs.length > 0 ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)', color: systemLogs.length > 0 ? RED : GREEN, border: `1px solid ${systemLogs.length > 0 ? 'rgba(220,38,38,0.3)' : 'rgba(22,163,74,0.3)'}`, borderRadius: 999, padding: '2px 10px' }}>
                  {systemLogs.length} unresolved
                </span>
              )}
            </div>
            {systemLogsLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0,1,2,3,4].map(i => <div key={i} className="mc-skeleton" style={{ height: 56 }} />)}</div>
            ) : systemLogsError ? (
              <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 10, padding: '14px 18px', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: '#F87171' }}>Failed: {systemLogsError}</div>
            ) : !systemLogs || systemLogs.length === 0 ? (
              <div className="mc-card" style={{ padding: '28px', textAlign: 'center' }}>
                <div style={{ fontSize: 24, marginBottom: 8 }}>✓</div>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: '#4ade80', fontWeight: 600 }}>No issues — system is healthy</div>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {systemLogs.map(log => {
                  const severityColor = log.severity === 'error' ? RED : log.severity === 'warning' ? AMBER : BLUE
                  const isExpanded    = expandedLogIds.has(log.id)
                  return (
                    <div key={log.id} className="mc-card" style={{ padding: '14px 18px', borderLeft: `3px solid ${severityColor}` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: WHITE, background: `${severityColor}33`, border: `1px solid ${severityColor}55`, borderRadius: 999, padding: '2px 8px', textTransform: 'uppercase' }}>{log.severity}</span>
                        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: WHITE, fontWeight: 500 }}>{log.feature}</span>
                        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginLeft: 'auto' }}>{timeAgo(log.created_at)}</span>
                        <button onClick={() => handleResolveLog(log.id)} disabled={resolvingLogId === log.id}
                          style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600, color: WHITE, background: resolvingLogId === log.id ? `${GREEN}55` : GREEN, border: 'none', borderRadius: 6, padding: '4px 12px', cursor: resolvingLogId === log.id ? 'not-allowed' : 'pointer', flexShrink: 0 }}>
                          {resolvingLogId === log.id ? 'Resolving…' : 'Resolve'}
                        </button>
                      </div>
                      <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM, margin: '0 0 8px 0' }}>{log.plain_message}</p>
                      {log.raw_detail && (
                        <>
                          <button onClick={() => toggleLogExpanded(log.id)} style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, background: 'transparent', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '3px 10px', cursor: 'pointer' }}>
                            {isExpanded ? 'Hide detail' : 'Show detail'}
                          </button>
                          {isExpanded && <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: DIM, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8, padding: 16, marginTop: 10, overflowX: 'auto', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>{JSON.stringify(log.raw_detail, null, 2)}</pre>}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Sentry issues */}
            {!systemLogsLoading && sentryIssues.length > 0 && (
              <>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24 }} className="mc-section-divider">
                  Sentry issues
                  <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, background: 'rgba(220,38,38,0.15)', color: RED, border: '1px solid rgba(220,38,38,0.3)', borderRadius: 999, padding: '2px 10px' }}>{sentryIssues.length}</span>
                  <button onClick={handleResolveAllSentryIssues} disabled={resolvingAllSentry}
                    style={{ marginLeft: 'auto', fontFamily: "'Poppins', sans-serif", fontSize: 12, fontWeight: 600, color: WHITE, background: resolvingAllSentry ? 'rgba(22,163,74,0.4)' : GREEN, border: 'none', borderRadius: 8, padding: '6px 16px', cursor: resolvingAllSentry ? 'not-allowed' : 'pointer' }}>
                    {resolvingAllSentry ? 'Resolving…' : 'Resolve All'}
                  </button>
                </div>
                {sentryResolveError && <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: RED, margin: '0 0 12px 0' }}>Failed: {sentryResolveError}</p>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {sentryIssues.map(issue => {
                    const levelColor = issue.level === 'error' ? RED : issue.level === 'warning' ? AMBER : BLUE
                    return (
                      <div key={issue.id} className="mc-card" style={{ padding: '14px 18px', borderLeft: `3px solid ${levelColor}` }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, color: WHITE, background: `${levelColor}33`, border: `1px solid ${levelColor}55`, borderRadius: 999, padding: '2px 8px', textTransform: 'uppercase' }}>{issue.level}</span>
                          <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 600, color: MUTED }}>×{issue.count}</span>
                          <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginLeft: 'auto' }}>{timeAgo(issue.last_seen)}</span>
                          <a href={issue.permalink} target="_blank" rel="noreferrer" style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600, color: WHITE, background: 'rgba(255,255,255,0.08)', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 12px', textDecoration: 'none' }}>View ↗</a>
                        </div>
                        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM, margin: 0 }}>{issue.title}</p>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {/* Failed generations */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 24 }} className="mc-section-divider">
              Failed generations
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, fontWeight: 700, background: (failures?.total_today ?? 0) > 0 ? 'rgba(220,38,38,0.15)' : 'rgba(22,163,74,0.15)', color: (failures?.total_today ?? 0) > 0 ? RED : GREEN, borderRadius: 999, padding: '2px 10px' }}>{failures?.total_today ?? 0} today</span>
            </div>
            {failuresLoading ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>{[0,1,2,3].map(i => <div key={i} className="mc-skeleton" style={{ height: 44 }} />)}</div>
            ) : failuresError ? (
              <div style={{ background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 10, padding: '14px 18px', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: '#F87171' }}>Failed: {failuresError}</div>
            ) : !failures?.rows?.length ? (
              <div className="mc-card" style={{ padding: '20px 22px', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED }}>No failures logged yet.</div>
            ) : (
              <div className="mc-card" style={{ overflow: 'hidden' }}>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700 }}>
                    <thead><tr>{['Time','Feature','Error','User','Input Preview','Action'].map(h => <th key={h} style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em', padding: '10px 12px', textAlign: 'left', background: SURFACE }}>{h}</th>)}</tr></thead>
                    <tbody>
                      {failures.rows.map(row => (
                        <tr key={row.id} style={{ borderLeft: row.resolved ? 'none' : `3px solid ${RED}`, opacity: row.resolved ? 0.4 : 1 }}>
                          <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: MUTED, padding: '10px 12px', borderTop: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>{timeAgo(row.created_at)}</td>
                          <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: WHITE, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>{row.feature || '—'}</td>
                          <td style={{ padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}><span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600, color: row.error_type === 'timeout' ? AMBER : RED, background: 'rgba(255,255,255,0.07)', borderRadius: 999, padding: '2px 8px' }}>{row.error_type || 'generic'}</span></td>
                          <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>{row.user_email ? row.user_email.substring(0, 20) : '—'}</td>
                          <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED, padding: '10px 12px', borderTop: `1px solid ${BORDER}`, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{row.input_preview ? row.input_preview.substring(0, 50) : '—'}</td>
                          <td style={{ padding: '6px 12px', borderTop: `1px solid ${BORDER}` }}>
                            <button disabled={row.resolved || resolvingId === row.id} onClick={() => handleResolveFailure(row.id)}
                              style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600, color: row.resolved ? MUTED : GREEN, background: 'transparent', border: `1px solid ${row.resolved ? BORDER : GREEN + '55'}`, borderRadius: 6, padding: '4px 10px', cursor: row.resolved || resolvingId === row.id ? 'not-allowed' : 'pointer', opacity: resolvingId === row.id ? 0.5 : 1 }}>
                              {row.resolved ? 'Resolved' : resolvingId === row.id ? '…' : 'Mark Resolved'}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

          </div>
        )}
```

- [ ] **Step 2: Close the main div and return statement**

After all 5 tab panels, close with:
```jsx
      </div>

      {/* ── Diagnose modal (global) ─────────────────── */}
      {diagnoseModal && (
        <div onClick={() => setDiagnoseModal(null)} style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div onClick={e => e.stopPropagation()} style={{ background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 14, padding: 28, width: 480, maxWidth: '94vw' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 18, color: WHITE }}>Diagnose User</span>
              <button onClick={() => setDiagnoseModal(null)} style={{ background: 'none', border: 'none', color: MUTED, fontSize: 20, cursor: 'pointer' }}>✕</button>
            </div>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: MUTED, marginBottom: 16 }}>{diagnoseModal.email}</div>
            {diagnoseModal.loading && <div style={{ color: MUTED, fontFamily: "'Poppins', sans-serif", fontSize: 13 }}>Checking…</div>}
            {diagnoseModal.error && <div style={{ color: '#F87171', fontFamily: "'Poppins', sans-serif", fontSize: 13 }}>Error: {diagnoseModal.error}</div>}
            {diagnoseModal.result && (() => {
              const r = diagnoseModal.result
              return (
                <>
                  <div style={{ padding: '10px 14px', borderRadius: 8, marginBottom: 16, background: r.is_blocked ? 'rgba(220,38,38,0.12)' : 'rgba(22,163,74,0.12)', border: `1px solid ${r.is_blocked ? 'rgba(220,38,38,0.3)' : 'rgba(22,163,74,0.3)'}`, fontFamily: "'Poppins', sans-serif", fontSize: 13, color: r.is_blocked ? '#F87171' : '#4ade80', fontWeight: 600 }}>
                    {r.is_blocked ? `🔴 Blocked — ${r.block_reasons.join(', ')}` : '🟢 Not currently blocked'}
                  </div>
                  {[
                    { label: 'User-day rate limit', ok: r.user_rl_keys.length === 0, detail: r.user_rl_keys.length > 0 ? `${r.user_rl_keys.length} active key(s)` : 'No keys' },
                    { label: `IP rate limit${r.last_ip ? ` (${r.last_ip})` : ''}`, ok: r.ip_rl_keys.length === 0, detail: r.ip_rl_keys.length > 0 ? `${r.ip_rl_keys.length} active key(s)` : 'No keys' },
                    { label: 'Global spend cap', ok: !r.cap_hit, detail: `$${r.spent_usd.toFixed(2)} / $${r.cap_usd.toFixed(2)} (${r.cap_pct}%)${r.cap_hit ? ' — raise DAILY_CAP_USD' : ''}` },
                  ].map(({ label, ok, detail }) => (
                    <div key={label} style={{ marginBottom: 10 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: ok ? GREEN : RED }}>{ok ? '✓' : '✗'}</span>
                        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: WHITE, fontWeight: 600 }}>{label}</span>
                      </div>
                      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginLeft: 22, marginTop: 2 }}>{detail}</div>
                    </div>
                  ))}
                  {(r.user_rl_keys.length > 0 || r.ip_rl_keys.length > 0) && (
                    <button onClick={async () => { await handleResetUsage(diagnoseModal.userId, diagnoseModal.email); setDiagnoseModal(null) }}
                      style={{ marginTop: 16, width: '100%', background: GREEN, color: WHITE, border: 'none', borderRadius: 8, padding: '10px 0', fontFamily: "'Poppins', sans-serif", fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>
                      Reset Rate Limits Now
                    </button>
                  )}
                  {r.cap_hit && <div style={{ marginTop: 12, fontFamily: "'Poppins', sans-serif", fontSize: 12, color: AMBER }}>⚠ Spend cap hit — raise DAILY_CAP_USD in Vercel env</div>}
                </>
              )
            })()}
          </div>
        </div>
      )}
    </div>
  )
```

- [ ] **Step 3: Commit**
```bash
git add src/pages/admin/Health.jsx
git commit -m "feat(admin): build Users, Payments, Vitals, Logs tab panels + close return"
```

---

### Task 7: Delete old JSX sections that are now replaced

**Files:**
- Modify: `src/pages/admin/Health.jsx`

After Tasks 3–6, the old JSX sections (lines ~1032–2349 of the original file) must be fully removed. They are replaced by the tab panels above.

- [ ] **Step 1: Verify the file compiles without error**
```bash
cd "C:/Users/FEYISAYO ATINUKE/Downloads/fypro-v2" && npm run build 2>&1 | tail -30
```
Expected: `✓ built in` with no errors. If there are errors, they will be JSX syntax issues from the surgery — fix them.

- [ ] **Step 2: Commit the clean build**
```bash
git add src/pages/admin/Health.jsx
git commit -m "feat(admin): Mission Control redesign complete — tab nav, glassmorphism, animations"
```

---

### Task 8: Smoke test in browser

- [ ] **Step 1: Start dev server**
```bash
cd "C:/Users/FEYISAYO ATINUKE/Downloads/fypro-v2" && npm run dev
```

- [ ] **Step 2: Open http://localhost:5173/admin/health and verify:**
  - Sticky top bar visible with LIVE pill and Refresh button
  - 5 tabs: Overview, Users, Payments, Vitals, Logs
  - Overview tab: KPI cards count up from 0 on load
  - Overview tab: bar chart bars grow up on load
  - Switching tabs shows fade animation
  - Users tab: table renders with action buttons
  - Vitals tab: vital cards show with colored dots
  - Logs tab: system logs or empty state
  - Mobile (<600px): tabs replaced by select dropdown
  - All cards have glassmorphism style (dark blur bg, thin border)

- [ ] **Step 3: If any section throws a React error, fix it and rebuild**

---

### Self-Review

**Spec coverage check:**
- ✅ Top nav tabs (5 tabs) — Task 3
- ✅ Glassmorphism cards — `.mc-card` class in Task 3 CSS
- ✅ Glowing KPI numbers — `KpiCounterCard` glow/shadow in Task 5
- ✅ Counter animations — `requestAnimationFrame` in `KpiCounterCard`, Task 5
- ✅ Bar chart draw-on — `mcGrowUp` keyframe + `.mc-bar` class, Task 3 CSS
- ✅ Card stagger entrance — `mcSlideUp` keyframe + `animationDelay` per card
- ✅ Activity feed slide-in — `mcSlideRight` + `mc-feed-item` class
- ✅ Vital pulse dots — `vitalPulse` keyframe (existing, reused)
- ✅ Tab switch fade — `mc-tab-content` class with `mcFadeIn`
- ✅ Skeleton loaders — `.mc-skeleton` class used in Vitals, Logs, Payments
- ✅ Empty states — all 4 data sections have explicit empty state UI
- ✅ Error states — all sections show red error box on failure
- ✅ Guard states redesigned — nice 403 / spinner / retry button
- ✅ Mobile: tabs → select, tables scroll horizontally, 1-col KPI grid
- ✅ All existing handlers preserved — no changes to lines 376–899
- ✅ Red badge on Vitals tab when degraded services > 0
- ✅ Red badge on Logs tab when unread logs > 0
- ✅ Live pulse pill in top bar
- ✅ Last-refresh timestamp in top bar
- ✅ Admin initials avatar in top bar

**Placeholder scan:** No TBD, no TODO, no "fill in later" — all code is complete.

**Type consistency:** `counterKeyRef.current` used in `KpiCounterCard` key prop — matches the ref added in Task 1. `switchTab` function defined in return block — called from tab button `onClick` and mobile `select onChange`. All consistent.
