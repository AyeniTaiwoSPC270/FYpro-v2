import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useUser } from '../../hooks/useUser'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'

// ── Design tokens (dark admin theme) ────────────────────────────────
const BG      = '#060E18'
const SURFACE = '#0D1B2A'
const CARD    = '#0F2235'
const BORDER  = 'rgba(255,255,255,0.08)'
const BLUE    = '#0066FF'
const GREEN   = '#16A34A'
const AMBER   = '#F59E0B'
const RED     = '#DC2626'
const WHITE   = '#FFFFFF'
const DIM     = 'rgba(255,255,255,0.7)'
const MUTED   = 'rgba(255,255,255,0.4)'

const FEATURE_LABELS = {
  topic_validator:        'Topic Validator',
  chapter_architect:      'Chapter Architect',
  methodology_advisor:    'Methodology Advisor',
  writing_planner:        'Writing Planner',
  literature_map:         'Literature Map',
  abstract_generator:     'Abstract Generator',
  instrument_builder:     'Instrument Builder',
  project_reviewer:       'Project Reviewer',
  defense_simulator:      'Defense Simulator',
  supervisor_meeting_prep: 'Meeting Prep',
}

const FUNNEL_LABELS = {
  topic_validator:     'Topic Validator',
  chapter_architect:   'Chapter Architect',
  methodology_advisor: 'Methodology Advisor',
  writing_planner:     'Writing Planner',
  defense_simulator:   'Defense Simulator',
}

const PAGE_SIZE = 20

// ── Helpers ──────────────────────────────────────────────────────────
function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

function fmtChartDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' })
}

function timeAgo(iso) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const s  = Math.floor(ms / 1000)
  if (s < 60)  return `${s}s ago`
  const m  = Math.floor(s / 60)
  if (m < 60)  return `${m} min${m !== 1 ? 's' : ''} ago`
  const h  = Math.floor(m / 60)
  if (h < 24)  return `${h} hr${h !== 1 ? 's' : ''} ago`
  const d  = Math.floor(h / 24)
  return `${d} day${d !== 1 ? 's' : ''} ago`
}

function VitalCard({ label, value, dotColor, pulse }) {
  return (
    <div style={{
      background: 'rgba(13,27,42,0.8)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderRadius: 10,
      padding: 16,
      flex: '1 1 0',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: dotColor, flexShrink: 0,
          animation: pulse ? 'vitalPulse 1.5s ease-in-out infinite' : 'none',
        }} />
        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
          {label}
        </span>
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: WHITE }}>
        {value}
      </div>
    </div>
  )
}

// ── Small components ─────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    active:     { color: GREEN, label: 'Active' },
    inactive:   { color: AMBER, label: 'Inactive' },
    churned:    { color: RED,   label: 'Churned' },
    never_used: { color: null,  label: 'Never used' },
    banned:     { color: RED,   label: 'Banned' },
  }
  const { color, label } = map[status] || map.never_used
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11, fontWeight: 600,
      color:      color ? WHITE : MUTED,
      background: color ? `${color}22` : 'rgba(255,255,255,0.07)',
      border:     `1px solid ${color ? color + '55' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 999, padding: '2px 10px',
    }}>{label}</span>
  )
}

function PlanBadge({ plan }) {
  const colors = { Free: null, Student: BLUE, Defense: GREEN }
  const color  = colors[plan] ?? null
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11, fontWeight: 600,
      color:      color ? WHITE : MUTED,
      background: color ? `${color}33` : 'rgba(255,255,255,0.07)',
      border:     `1px solid ${color ? color + '66' : 'rgba(255,255,255,0.1)'}`,
      borderRadius: 999, padding: '2px 10px',
    }}>{plan}</span>
  )
}

function OverviewCard({ label, value, sub, accent = BLUE }) {
  return (
    <div style={{
      background: CARD,
      border: `1px solid ${BORDER}`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 12,
      padding: '20px 24px',
      flex: '1 1 160px',
      minWidth: 0,
    }}>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: WHITE, lineHeight: 1 }}>
        {value}
      </div>
      {sub && (
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginTop: 6 }}>
          {sub}
        </div>
      )}
    </div>
  )
}

function SpendCard({ spend }) {
  if (!spend) return null
  const pct      = spend.cap_usd > 0 ? (spend.spent_usd / spend.cap_usd) * 100 : 0
  const barColor = pct >= 80 ? RED : pct >= 50 ? AMBER : GREEN
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderTop: `3px solid ${barColor}`,
      borderRadius: 12, padding: '20px 24px', flex: '1 1 200px', minWidth: 0,
    }}>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        API Spend Today
      </div>
      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: WHITE, lineHeight: 1 }}>
        ${spend.spent_usd.toFixed(2)}
      </div>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginTop: 4, marginBottom: 10 }}>
        cap ${spend.cap_usd.toFixed(2)} · ${spend.remaining_usd.toFixed(2)} left
      </div>
      <div style={{ height: 5, background: 'rgba(255,255,255,0.08)', borderRadius: 999 }}>
        <div style={{
          height: 5, background: barColor, borderRadius: 999,
          width: `${Math.min(100, pct)}%`, transition: 'width 0.5s ease',
        }} />
      </div>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginTop: 5 }}>
        {pct.toFixed(1)}% · {spend.request_count.toLocaleString()} req
      </div>
    </div>
  )
}

function SignupsCompareCard({ today, yesterday }) {
  const diff       = (today ?? 0) - (yesterday ?? 0)
  const arrow      = diff > 0 ? '↑' : diff < 0 ? '↓' : '→'
  const arrowColor = diff > 0 ? GREEN : diff < 0 ? RED : MUTED
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`, borderTop: `3px solid ${BLUE}`,
      borderRadius: 12, padding: '20px 24px', flex: '1 1 160px', minWidth: 0,
    }}>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8 }}>
        Signups
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: WHITE, lineHeight: 1 }}>
          {today ?? 0}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: arrowColor }}>
          {arrow}
        </span>
      </div>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginTop: 6 }}>
        Today {today ?? 0} · Yesterday {yesterday ?? 0}
      </div>
    </div>
  )
}

function SectionHeading({ title }) {
  return (
    <h2 style={{
      fontFamily: "'DM Serif Display', serif",
      fontSize: 22, fontWeight: 400,
      color: WHITE,
      margin: '40px 0 16px',
      paddingBottom: 12,
      borderBottom: `1px solid ${BORDER}`,
    }}>{title}</h2>
  )
}

function ChartCard({ title, children }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
      <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: MUTED, marginBottom: 16, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {title}
      </div>
      {children}
    </div>
  )
}

const tooltipStyle = {
  contentStyle: {
    background: SURFACE,
    border: `1px solid ${BORDER}`,
    borderRadius: 8,
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12,
    color: WHITE,
  },
  labelStyle: { color: DIM },
}

// ── Sortable column header ────────────────────────────────────────────
function Th({ children, sortKey, active, dir, onSort }) {
  return (
    <th
      onClick={() => onSort(sortKey)}
      style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: 11, fontWeight: 600,
        color: active ? WHITE : MUTED,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        padding: '10px 12px',
        textAlign: 'left',
        whiteSpace: 'nowrap',
        cursor: 'pointer',
        userSelect: 'none',
        background: SURFACE,
      }}
    >
      {children}{active ? (dir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  )
}

const AUTO_REFRESH_MS = 5 * 60 * 1000  // 5 minutes

// ── Main component ────────────────────────────────────────────────────
export default function AdminHealth() {
  const { user, session, loading } = useUser()
  const [data, setData]           = useState(null)
  const [error, setError]         = useState(null)
  const [fetching, setFetching]   = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const timerRef = useRef(null)

  const [vitals, setVitals]               = useState(null)
  const [vitalsLoading, setVitalsLoading] = useState(true)
  const vitalsTimerRef                    = useRef(null)

  const [failures, setFailures]               = useState(null)
  const [failuresLoading, setFailuresLoading] = useState(true)
  const failuresTimerRef                      = useRef(null)
  const [resolvingId, setResolvingId]         = useState(null)

  const [paymentIssues, setPaymentIssues]               = useState(null)
  const [paymentIssuesLoading, setPaymentIssuesLoading] = useState(true)
  const [resolvingIssueId, setResolvingIssueId]         = useState(null)

  const [authAttempts, setAuthAttempts]       = useState(null)
  const [authAttemptsLoading, setAuthAttemptsLoading] = useState(true)

  // User table state
  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState('signup_date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage]       = useState(0)
  const [actionState, setActionState] = useState({}) // { userId: 'pending' | 'banned' | 'deleted' | 'error' }

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const isAdmin    = !!adminEmail && user?.email === adminEmail

  const loadData = useCallback(() => {
    if (!session?.access_token) return
    setFetching(true)
    setError(null)
    fetch('/api/admin?action=dashboard', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d); setLastUpdated(new Date()) })
      .catch(e => setError(e.message))
      .finally(() => setFetching(false))
  }, [session?.access_token])

  // Initial fetch + auto-refresh every 5 minutes while tab is open.
  useEffect(() => {
    if (!isAdmin || !session) return
    loadData()
    timerRef.current = setInterval(loadData, AUTO_REFRESH_MS)
    return () => clearInterval(timerRef.current)
  }, [isAdmin, session, loadData])

  // Vitals — 30s interval
  useEffect(() => {
    if (!isAdmin || !session) return
    function loadVitals() {
      fetch('/api/admin?action=vitals', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(d => { if (!d.error) setVitals(d) })
        .catch(() => {})
        .finally(() => setVitalsLoading(false))
    }
    loadVitals()
    vitalsTimerRef.current = setInterval(loadVitals, 30 * 1000)
    return () => clearInterval(vitalsTimerRef.current)
  }, [isAdmin, session])

  // Failures — 60s interval
  useEffect(() => {
    if (!isAdmin || !session) return
    function loadFailures() {
      fetch('/api/admin?action=failures', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
        .then(r => r.json())
        .then(d => { if (!d.error) setFailures(d) })
        .catch(() => {})
        .finally(() => setFailuresLoading(false))
    }
    loadFailures()
    failuresTimerRef.current = setInterval(loadFailures, 60 * 1000)
    return () => clearInterval(failuresTimerRef.current)
  }, [isAdmin, session])

  // Auth attempts — load once on mount
  useEffect(() => {
    if (!isAdmin || !session) return
    fetch('/api/admin?action=auth-attempts', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (!d.error) setAuthAttempts(d) })
      .catch(() => {})
      .finally(() => setAuthAttemptsLoading(false))
  }, [isAdmin, session])

  // Payment issues — load once on mount
  useEffect(() => {
    if (!isAdmin || !session) return
    fetch('/api/admin?action=payment-issues', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (!d.error) setPaymentIssues(d.issues) })
      .catch(() => {})
      .finally(() => setPaymentIssuesLoading(false))
  }, [isAdmin, session])

  // Filtered + sorted user rows
  const filteredUsers = useMemo(() => {
    if (!data?.users) return []
    let rows = data.users
    if (search.trim()) {
      const q = search.toLowerCase()
      rows = rows.filter(u => u.email.toLowerCase().includes(q))
    }
    return [...rows].sort((a, b) => {
      let av = a[sortKey] ?? '', bv = b[sortKey] ?? ''
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ?  1 : -1
      return 0
    })
  }, [data, search, sortKey, sortDir])

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE)
  const pageRows   = filteredUsers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(0)
  }

  async function handleDeleteUser(userId, email) {
    if (!window.confirm(`Permanently delete user ${email}? This cannot be undone.`)) return
    setActionState(s => ({ ...s, [userId]: 'pending' }))
    try {
      const res = await fetch('/api/admin?action=delete-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setData(prev => ({ ...prev, users: prev.users.filter(u => u.id !== userId) }))
      setActionState(s => { const n = { ...s }; delete n[userId]; return n })
    } catch (err) {
      setActionState(s => ({ ...s, [userId]: 'error' }))
      window.alert('Delete failed: ' + err.message)
    }
  }

  async function handleBanUser(userId, email) {
    if (!window.confirm(`Ban user ${email}? They will be denied access until 2099.`)) return
    setActionState(s => ({ ...s, [userId]: 'pending' }))
    try {
      const res = await fetch('/api/admin?action=ban-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setActionState(s => ({ ...s, [userId]: 'banned' }))
      // Update local user row so StatusBadge shows "Banned" immediately
      setData(prev => ({
        ...prev,
        users: prev.users.map(u => u.id === userId ? { ...u, status: 'banned' } : u),
      }))
    } catch (err) {
      setActionState(s => ({ ...s, [userId]: 'error' }))
      window.alert('Ban failed: ' + err.message)
    }
  }

  async function handleResolvePaymentIssue(id) {
    setResolvingIssueId(id)
    try {
      const res = await fetch('/api/admin?action=resolve-payment-issue', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setPaymentIssues(prev => (prev || []).filter(issue => issue.id !== id))
    } catch (err) {
      console.error('[admin] resolve payment issue failed:', err.message)
    } finally {
      setResolvingIssueId(null)
    }
  }

  async function handleResolveFailure(id) {
    setResolvingId(id)
    try {
      const res = await fetch('/api/admin?action=resolve-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setFailures(prev => ({
        ...prev,
        rows: prev.rows.map(r => r.id === id ? { ...r, resolved: true } : r),
      }))
    } catch (err) {
      window.alert('Resolve failed: ' + err.message)
    } finally {
      setResolvingId(null)
    }
  }

  // ── Guard states ────────────────────────────────────────────────
  const shell = { minHeight: '100vh', background: BG, padding: '40px 48px', fontFamily: "'Poppins', sans-serif", color: WHITE }
  if (loading)             return <div style={shell}>Loading…</div>
  if (!isAdmin)            return <div style={{ ...shell, color: RED }}>Access denied.</div>
  if (fetching && !data)   return <div style={shell}>Fetching dashboard data…</div>
  if (error && !data)      return <div style={{ ...shell, color: RED }}>Error: {error}</div>
  if (!data)               return null

  const { overview, revenue_chart, signups_chart, feature_usage, funnel, never_converted,
          daily_spend, cache_hit_rate, top_active_users, failed_payments_today, signups_yesterday,
          revenue_today_ngn, paying_users_today, ngn_per_usd } = data
  const maxFeature = feature_usage?.[0]?.count || 1

  // ── Shared inline styles ─────────────────────────────────────────
  const td = {
    fontFamily: "'Poppins', sans-serif",
    fontSize: 13, color: DIM,
    padding: '10px 12px',
    borderTop: `1px solid ${BORDER}`,
  }
  const tdMono = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12, color: WHITE,
    padding: '10px 12px',
    borderTop: `1px solid ${BORDER}`,
  }

  return (
    <div style={{ minHeight: '100vh', background: BG, padding: '40px 48px', fontFamily: "'Poppins', sans-serif", color: WHITE }}>
      <style>{`
        @keyframes vitalPulse {
          0%, 100% { transform: scale(1);   opacity: 1; }
          50%       { transform: scale(1.3); opacity: 0.6; }
        }
      `}</style>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, fontWeight: 400, margin: 0 }}>
            FYPro Admin — Analytics
          </h1>
          <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: MUTED, marginTop: 8, marginBottom: 0 }}>
            {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
            {lastUpdated && (
              <span style={{ marginLeft: 16, color: 'rgba(255,255,255,0.3)' }}>
                · Last updated {lastUpdated.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            )}
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <button
            onClick={loadData}
            disabled={fetching}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 13, fontWeight: 600,
              color: fetching ? MUTED : WHITE,
              background: fetching ? 'rgba(255,255,255,0.05)' : BLUE,
              border: `1px solid ${fetching ? BORDER : BLUE}`,
              borderRadius: 8, padding: '10px 20px',
              cursor: fetching ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s ease',
            }}
          >
            {fetching ? 'Refreshing…' : '↻ Refresh'}
          </button>
          <button
            onClick={() => {
              import('@sentry/react').then(Sentry => {
                Sentry.captureException(new Error('Manual Sentry test from admin'))
              })
            }}
            style={{
              padding: '6px 12px',
              backgroundColor: '#7c3aed',
              color: 'white',
              border: 'none',
              borderRadius: '6px',
              cursor: 'pointer',
              fontSize: '12px',
            }}
          >
            Test Sentry
          </button>
        </div>
      </div>

      {/* ── Widget 4: System Vitals ──────────────────────────────── */}
      <div style={{ marginBottom: 24 }}>
        {vitalsLoading ? (
          <div style={{ display: 'flex', gap: 16 }}>
            {[0,1,2,3].map(i => (
              <div key={i} style={{ flex: '1 1 0', height: 82, background: 'rgba(255,255,255,0.05)', borderRadius: 10 }} />
            ))}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 16 }}>
            {(() => {
              const lastCallRecent = vitals?.last_call_at
                ? (Date.now() - new Date(vitals.last_call_at).getTime()) < 5 * 60 * 1000
                : false
              const engineColor = lastCallRecent ? GREEN : RED
              const engineValue = lastCallRecent ? 'Operational' : 'Degraded'

              const avgMs    = vitals?.avg_response_ms ?? null
              const avgColor = avgMs === null ? RED : avgMs < 15000 ? GREEN : avgMs <= 30000 ? AMBER : RED
              const avgValue = avgMs !== null ? `${(avgMs / 1000).toFixed(1)}s` : '—'

              const failuresToday = vitals?.failures_today  || 0
              const requestsToday = vitals?.requests_today  || 0
              const errPct   = requestsToday > 0 ? (failuresToday / requestsToday) * 100 : 0
              const errColor = requestsToday === 0 ? MUTED : errPct < 2 ? GREEN : errPct <= 5 ? AMBER : RED
              const errValue = requestsToday > 0 ? `${errPct.toFixed(1)}%` : '—'

              return (
                <>
                  <VitalCard label="AI Engine"    value={engineValue} dotColor={engineColor} pulse={!lastCallRecent} />
                  <VitalCard label="Avg Response" value={avgValue}    dotColor={avgColor}    pulse={avgMs !== null && avgMs > 30000} />
                  <VitalCard label="Error Rate"   value={errValue}    dotColor={errColor}    pulse={errPct > 5} />
                  <VitalCard label="Active Now"   value={String(vitals?.active_sessions ?? 0)} dotColor={BLUE} pulse={false} />
                </>
              )
            })()}
          </div>
        )}
      </div>

      {/* ── SECTION 1: Overview Cards ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <OverviewCard label="Total Users"      value={overview.total_users.toLocaleString()}        accent={BLUE}  />
        <OverviewCard label="Active Today"     value={overview.active_today.toLocaleString()}        accent={GREEN} />
        <OverviewCard label="Active This Week" value={overview.active_this_week.toLocaleString()}    accent={GREEN} />
        <OverviewCard label="Paid Users"       value={overview.total_paid.toLocaleString()}          accent={AMBER} />
        <OverviewCard label="Total Revenue"    value={`₦${overview.total_revenue_ngn.toLocaleString()}`} accent={GREEN} />
        <OverviewCard label="Conversion Rate"  value={`${overview.conversion_rate}%`} sub="paid ÷ total" accent={BLUE}  />
        <SpendCard spend={daily_spend} />
        <OverviewCard
          label="Failed Payments"
          value={String(failed_payments_today ?? 0)}
          sub="today (non-success)"
          accent={(failed_payments_today ?? 0) > 0 ? RED : BLUE}
        />
        <SignupsCompareCard
          today={overview.signups_today ?? 0}
          yesterday={signups_yesterday ?? 0}
        />
      </div>

      {/* ── Widget 1: Unit Economics ─────────────────────────────── */}
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`,
        borderTop: `3px solid ${AMBER}`,
        borderRadius: 12, padding: '20px 24px', marginBottom: 8, marginTop: 8,
      }}>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          Unit Economics — Today
        </div>
        <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
          {(() => {
            const spentUsd    = daily_spend?.spent_usd || 0
            const activeToday = overview.active_today  || 0
            const ngn         = ngn_per_usd            || 1600
            const payingU     = paying_users_today      || 0
            const revToday    = revenue_today_ngn       || 0

            const costPerUser = activeToday > 0 ? (spentUsd * ngn) / activeToday : null
            const cpuColor    = costPerUser === null ? MUTED
              : costPerUser < 200 ? GREEN : costPerUser <= 400 ? AMBER : RED

            const revPerUser  = payingU > 0 ? revToday / payingU : null

            const margin      = revPerUser && costPerUser !== null && revPerUser > 0
              ? ((revPerUser - costPerUser) / revPerUser) * 100
              : null
            const marginColor = margin === null ? MUTED
              : margin > 60 ? GREEN : margin >= 30 ? AMBER : RED

            return (
              <>
                <div>
                  <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginBottom: 4 }}>Cost Per User</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: cpuColor }}>
                    {costPerUser !== null ? `₦${costPerUser.toFixed(0)}` : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginBottom: 4 }}>Revenue Per User</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: WHITE }}>
                    {revPerUser !== null ? `₦${revPerUser.toFixed(0)}` : '—'}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginBottom: 4 }}>Profit Margin Per User</div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 26, fontWeight: 700, color: marginColor }}>
                    {margin !== null ? `${margin.toFixed(1)}%` : '—'}
                  </div>
                </div>
              </>
            )
          })()}
        </div>
      </div>

      {/* ── Widget 3: Cache Performance ───────────────────────────── */}
      <div style={{
        background: CARD, border: `1px solid ${BORDER}`,
        borderTop: `3px solid ${BLUE}`,
        borderRadius: 12, padding: '20px 24px', marginBottom: 8,
      }}>
        <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 16 }}>
          Cache Performance
        </div>
        {(() => {
          const hitRate    = cache_hit_rate?.hit_rate_pct ?? 0
          const hitsTotal  = cache_hit_rate?.hits_total   ?? 0
          const reqCount   = daily_spend?.request_count   ?? 0
          const freshCalls = Math.max(0, reqCount - hitsTotal)
          const spentUsd   = daily_spend?.spent_usd ?? 0
          const costPerFresh = freshCalls > 0 ? spentUsd / freshCalls : 0
          const savings    = hitsTotal * costPerFresh * (ngn_per_usd || 1600)
          const rateColor  = hitRate > 25 ? GREEN : hitRate >= 10 ? AMBER : RED
          return (
            <>
              <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 700, color: rateColor, lineHeight: 1, marginBottom: 12 }}>
                {hitRate}%
              </div>
              <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', marginBottom: 10 }}>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: GREEN }}>{hitsTotal.toLocaleString()} cached today</span>
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: AMBER }}>{freshCalls.toLocaleString()} fresh calls today</span>
              </div>
              <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: MUTED }}>
                Est. savings today: <span style={{ color: WHITE, fontFamily: "'JetBrains Mono', monospace" }}>₦{savings.toFixed(0)}</span>
              </div>
            </>
          )
        })()}
      </div>

      {/* ── SECTION 2: User Table ──────────────────────────────────── */}
      <SectionHeading title={`Users (${filteredUsers.length})`} />
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
        <input
          type="text"
          placeholder="Search by email…"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(0) }}
          style={{
            background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 8,
            padding: '8px 14px', color: WHITE,
            fontFamily: "'Poppins', sans-serif", fontSize: 13,
            width: '100%', maxWidth: 320, marginBottom: 16, outline: 'none',
          }}
        />

        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 920 }}>
            <thead>
              <tr>
                {[
                  ['email',         'Email'],
                  ['signup_date',   'Signed Up'],
                  ['last_active',   'Last Active'],
                  ['plan',          'Plan'],
                  ['project_count', 'Projects'],
                  ['status',        'Status'],
                  ['paid_amount',   'Paid (₦)'],
                ].map(([key, label]) => (
                  <Th key={key} sortKey={key} active={sortKey === key} dir={sortDir} onSort={handleSort}>
                    {label}
                  </Th>
                ))}
                <th style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 11, fontWeight: 600,
                  color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em',
                  padding: '10px 12px', textAlign: 'left', background: SURFACE,
                }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ ...td, textAlign: 'center', color: MUTED }}>No users found.</td>
                </tr>
              ) : pageRows.map((u, i) => {
                const aState = actionState[u.id]
                const isPending = aState === 'pending'
                return (
                  <tr key={u.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ ...td, color: WHITE, fontWeight: 500 }}>{u.email || '—'}</td>
                    <td style={td}>{fmtDate(u.signup_date)}</td>
                    <td style={td}>{fmtDate(u.last_active)}</td>
                    <td style={td}><PlanBadge plan={u.plan} /></td>
                    <td style={{ ...tdMono, textAlign: 'center' }}>{u.project_count}</td>
                    <td style={td}><StatusBadge status={u.status} /></td>
                    <td style={tdMono}>{u.paid_amount > 0 ? `₦${u.paid_amount.toLocaleString()}` : '—'}</td>
                    <td style={{ ...td, padding: '6px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button
                          disabled={isPending || aState === 'banned'}
                          onClick={() => handleBanUser(u.id, u.email)}
                          style={{
                            fontFamily: "'Poppins', sans-serif",
                            fontSize: 11, fontWeight: 600,
                            color: aState === 'banned' ? MUTED : AMBER,
                            background: 'transparent',
                            border: `1px solid ${aState === 'banned' ? BORDER : AMBER + '55'}`,
                            borderRadius: 6, padding: '4px 10px',
                            cursor: isPending || aState === 'banned' ? 'not-allowed' : 'pointer',
                            opacity: isPending ? 0.5 : 1,
                          }}
                        >
                          {aState === 'banned' ? 'Banned' : 'Ban'}
                        </button>
                        <button
                          disabled={isPending}
                          onClick={() => handleDeleteUser(u.id, u.email)}
                          style={{
                            fontFamily: "'Poppins', sans-serif",
                            fontSize: 11, fontWeight: 600,
                            color: RED,
                            background: 'transparent',
                            border: `1px solid ${RED}55`,
                            borderRadius: 6, padding: '4px 10px',
                            cursor: isPending ? 'not-allowed' : 'pointer',
                            opacity: isPending ? 0.5 : 1,
                          }}
                        >
                          {aState === 'error' ? 'Retry' : 'Delete'}
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', alignItems: 'center', marginTop: 20 }}>
            <button
              disabled={page === 0}
              onClick={() => setPage(p => p - 1)}
              style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: page === 0 ? MUTED : WHITE, borderRadius: 6, padding: '6px 14px', cursor: page === 0 ? 'default' : 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: 13 }}
            >← Prev</button>
            <span style={{ color: MUTED, fontSize: 13 }}>Page {page + 1} of {totalPages}</span>
            <button
              disabled={page >= totalPages - 1}
              onClick={() => setPage(p => p + 1)}
              style={{ background: SURFACE, border: `1px solid ${BORDER}`, color: page >= totalPages - 1 ? MUTED : WHITE, borderRadius: 6, padding: '6px 14px', cursor: page >= totalPages - 1 ? 'default' : 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: 13 }}
            >Next →</button>
          </div>
        )}
      </div>

      {/* ── Most Active Today ─────────────────────────────────────── */}
      {top_active_users && top_active_users.length > 0 && (
        <>
          <SectionHeading title="Most Active Today" />
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, marginBottom: 8 }}>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED, marginTop: 0, marginBottom: 16 }}>
              Top 3 users by cumulative run count across all features.
            </p>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                <thead>
                  <tr>
                    {['Email', 'Total Runs', 'Top Feature'].map(h => (
                      <th key={h} style={{
                        fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600,
                        color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em',
                        padding: '10px 12px', textAlign: 'left', background: SURFACE,
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {top_active_users.map((u, i) => (
                    <tr key={u.email} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                      <td style={{ ...td, color: WHITE, fontWeight: 500 }}>{u.email}</td>
                      <td style={tdMono}>{u.total_runs.toLocaleString()}</td>
                      <td style={td}>{FEATURE_LABELS[u.top_feature] || u.top_feature || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── Widget 2: Failed Generation Log ──────────────────────── */}
      <div style={{ margin: '40px 0 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400, color: WHITE, margin: 0 }}>
          Failed Generations
        </h2>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 12, fontWeight: 700,
          color: WHITE,
          background: (failures?.total_today ?? 0) > 0 ? RED : GREEN,
          borderRadius: 999,
          padding: '2px 10px',
        }}>
          {failures?.total_today ?? 0} today
        </span>
      </div>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, marginBottom: 8 }}>
        {failuresLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{ height: 44, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
            ))}
          </div>
        ) : !failures?.rows?.length ? (
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED, margin: 0 }}>No failures logged yet.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 700 }}>
              <thead>
                <tr>
                  {['Time', 'Feature', 'Error', 'User', 'Input Preview', 'Action'].map(h => (
                    <th key={h} style={{
                      fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600,
                      color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em',
                      padding: '10px 12px', textAlign: 'left', background: SURFACE,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {failures.rows.map(row => (
                  <tr
                    key={row.id}
                    style={{
                      borderLeft: row.resolved ? 'none' : `3px solid ${RED}`,
                      opacity: row.resolved ? 0.4 : 1,
                    }}
                  >
                    <td style={{ ...td, color: MUTED, whiteSpace: 'nowrap' }}>{timeAgo(row.created_at)}</td>
                    <td style={{ ...td, color: WHITE }}>{row.feature || '—'}</td>
                    <td style={td}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: 11, fontWeight: 600,
                        color: row.error_type === 'timeout' ? AMBER : RED,
                        background: 'rgba(255,255,255,0.07)',
                        borderRadius: 999, padding: '2px 8px',
                      }}>{row.error_type || 'generic'}</span>
                    </td>
                    <td style={{ ...td, color: DIM }}>{row.user_email ? row.user_email.substring(0, 20) : '—'}</td>
                    <td style={{ ...td, color: MUTED, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {row.input_preview ? row.input_preview.substring(0, 50) : '—'}
                    </td>
                    <td style={{ ...td, padding: '6px 12px' }}>
                      <button
                        disabled={row.resolved || resolvingId === row.id}
                        onClick={() => handleResolveFailure(row.id)}
                        style={{
                          fontFamily: "'Poppins', sans-serif",
                          fontSize: 11, fontWeight: 600,
                          color: row.resolved ? MUTED : GREEN,
                          background: 'transparent',
                          border: `1px solid ${row.resolved ? BORDER : GREEN + '55'}`,
                          borderRadius: 6, padding: '4px 10px',
                          cursor: row.resolved || resolvingId === row.id ? 'not-allowed' : 'pointer',
                          opacity: resolvingId === row.id ? 0.5 : 1,
                        }}
                      >
                        {row.resolved ? 'Resolved' : resolvingId === row.id ? 'Resolving…' : 'Mark Resolved'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── SECTION 3 & 4: Charts ──────────────────────────────────── */}
      <SectionHeading title="Revenue & Signups — Last 30 Days" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, marginBottom: 8 }}>
        <ChartCard title="Daily Revenue (₦)">
          <ResponsiveContainer width="100%" height={200}>
            <LineChart data={revenue_chart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtChartDate}
                tick={{ fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' }} />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={v => fmtChartDate(v)}
                formatter={v => [`₦${v.toLocaleString()}`, 'Revenue']}
              />
              <Line type="monotone" dataKey="amount" stroke={GREEN} strokeWidth={2} dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </ChartCard>

        <ChartCard title="Daily Signups">
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={signups_chart} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={BORDER} />
              <XAxis
                dataKey="date"
                tickFormatter={fmtChartDate}
                tick={{ fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' }}
                interval="preserveStartEnd"
              />
              <YAxis tick={{ fontSize: 10, fill: MUTED, fontFamily: 'JetBrains Mono' }} allowDecimals={false} />
              <Tooltip
                {...tooltipStyle}
                labelFormatter={v => fmtChartDate(v)}
                formatter={v => [v, 'Signups']}
              />
              <Bar dataKey="count" fill={BLUE} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </ChartCard>
      </div>

      {/* ── SECTION 5: Feature Usage ───────────────────────────────── */}
      <SectionHeading title="Feature Usage" />
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, marginBottom: 8 }}>
        {feature_usage.map(({ feature, count }) => (
          <div key={feature} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
              <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM }}>
                {FEATURE_LABELS[feature] || feature}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: WHITE }}>
                {count.toLocaleString()}
              </span>
            </div>
            <div style={{ height: 6, background: 'rgba(255,255,255,0.06)', borderRadius: 999 }}>
              <div style={{
                height: 6,
                background: BLUE,
                borderRadius: 999,
                width: `${maxFeature > 0 ? (count / maxFeature * 100) : 0}%`,
                transition: 'width 0.5s ease',
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* ── SECTION 6: Drop-off Funnel ─────────────────────────────── */}
      <SectionHeading title="Drop-off Analysis" />
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, marginBottom: 8 }}>
        {funnel.map(({ step, count, dropoff_pct, pct_of_total }, i) => (
          <div key={step}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
              <div style={{ flex: '0 0 180px', fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM }}>
                {FUNNEL_LABELS[step] || step}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ height: 36, background: 'rgba(255,255,255,0.05)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${pct_of_total}%`,
                    minWidth: count > 0 ? 80 : 0,
                    background: `linear-gradient(90deg, ${BLUE}cc, ${BLUE}55)`,
                    borderRadius: 6,
                    display: 'flex',
                    alignItems: 'center',
                    paddingLeft: 12,
                    transition: 'width 0.6s ease',
                  }}>
                    <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: WHITE, whiteSpace: 'nowrap' }}>
                      {count.toLocaleString()} users ({pct_of_total}%)
                    </span>
                  </div>
                </div>
              </div>
              <div style={{ flex: '0 0 110px', textAlign: 'right' }}>
                {i < funnel.length - 1 && (
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 12,
                    color: parseFloat(dropoff_pct) > 50 ? RED : AMBER,
                  }}>
                    −{dropoff_pct}% drop
                  </span>
                )}
              </div>
            </div>
            {i < funnel.length - 1 && (
              <div style={{ textAlign: 'left', paddingLeft: 195, color: MUTED, fontSize: 14, lineHeight: 1, margin: '2px 0' }}>↓</div>
            )}
          </div>
        ))}
      </div>

      {/* ── Auth Attempts Widget ───────────────────────────────────── */}
      <div style={{ marginTop: 40, marginBottom: 40 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 16, paddingBottom: 12,
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400, color: WHITE, margin: 0 }}>
            Auth Attempts
          </h2>
          {!authAttemptsLoading && authAttempts && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600,
              background: authAttempts.suspicious?.length > 0 ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.07)',
              color: authAttempts.suspicious?.length > 0 ? '#F87171' : MUTED,
              border: `1px solid ${authAttempts.suspicious?.length > 0 ? 'rgba(220,38,38,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 999, padding: '2px 10px',
            }}>
              {authAttempts.suspicious?.length > 0
                ? `${authAttempts.suspicious.length} suspicious IP${authAttempts.suspicious.length > 1 ? 's' : ''}`
                : 'all clear'}
            </span>
          )}
        </div>

        {authAttemptsLoading ? (
          <div style={{ height: 60, background: 'rgba(255,255,255,0.05)', borderRadius: 10 }} />
        ) : !authAttempts ? (
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED }}>
            No data yet. Auth attempts are logged as users sign in.
          </p>
        ) : (
          <>
            {/* Summary row */}
            <div style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}>
              {[
                { label: 'Total (24h)', value: authAttempts.attempts?.length ?? 0, color: MUTED },
                { label: 'Failed logins', value: authAttempts.attempts?.filter(a => !a.success && a.action === 'login').length ?? 0, color: '#F87171' },
                { label: 'Signups', value: authAttempts.attempts?.filter(a => a.action === 'signup').length ?? 0, color: '#60A5FA' },
                { label: 'Suspicious IPs', value: authAttempts.suspicious?.length ?? 0, color: authAttempts.suspicious?.length > 0 ? '#F87171' : MUTED },
              ].map(({ label, value, color }) => (
                <div key={label} style={{
                  background: CARD, border: `1px solid ${BORDER}`,
                  borderRadius: 10, padding: '12px 20px', flex: '1 1 110px',
                }}>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginTop: 2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* Suspicious IPs */}
            {authAttempts.suspicious?.length > 0 && (
              <div style={{ marginBottom: 20 }}>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: '#F87171', marginBottom: 8, marginTop: 0 }}>
                  Suspicious IPs — 5+ failed logins in last 24h
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {authAttempts.suspicious.map(({ ip, failed_count }) => (
                    <div key={ip} style={{
                      background: 'rgba(220,38,38,0.07)',
                      border: '1px solid rgba(220,38,38,0.2)',
                      borderLeft: '3px solid #DC2626',
                      borderRadius: 8, padding: '10px 16px',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    }}>
                      <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: '#F87171' }}>{ip}</span>
                      <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: '#F87171', fontWeight: 600 }}>
                        {failed_count} failed attempts
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Recent failed logins */}
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: MUTED, marginBottom: 8, marginTop: 0 }}>
              Recent failed logins
            </p>
            {authAttempts.attempts?.filter(a => !a.success && a.action === 'login').length === 0 ? (
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED }}>None in the last 24 hours.</p>
            ) : (
              <div style={{ overflowX: 'auto' }}>
                <table style={{ borderCollapse: 'collapse', width: '100%' }}>
                  <thead>
                    <tr>
                      {['When', 'Email', 'IP'].map(h => (
                        <th key={h} style={{
                          fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600,
                          color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em',
                          padding: '8px 12px', textAlign: 'left', background: SURFACE,
                        }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {authAttempts.attempts
                      .filter(a => !a.success && a.action === 'login')
                      .slice(0, 20)
                      .map((a, i) => (
                        <tr key={a.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                          <td style={{ padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>
                            {timeAgo(a.created_at)}
                          </td>
                          <td style={{ padding: '8px 12px', fontFamily: "'Poppins', sans-serif", fontSize: 12, color: WHITE }}>
                            {a.email || '—'}
                          </td>
                          <td style={{ padding: '8px 12px', fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: MUTED }}>
                            {a.ip || '—'}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Payment Issues Widget ──────────────────────────────────── */}
      <div style={{ marginTop: 40, marginBottom: 40 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 16, paddingBottom: 12,
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400, color: WHITE, margin: 0 }}>
            Payment Issues
          </h2>
          {!paymentIssuesLoading && paymentIssues !== null && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600,
              background: paymentIssues.length > 0 ? 'rgba(245,158,11,0.15)' : 'rgba(255,255,255,0.07)',
              color: paymentIssues.length > 0 ? AMBER : MUTED,
              border: `1px solid ${paymentIssues.length > 0 ? 'rgba(245,158,11,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 999, padding: '2px 10px',
            }}>
              {paymentIssues.length} unresolved
            </span>
          )}
        </div>

        {paymentIssuesLoading ? (
          <div style={{ height: 60, background: 'rgba(255,255,255,0.05)', borderRadius: 10 }} />
        ) : !paymentIssues || paymentIssues.length === 0 ? (
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED }}>
            No unresolved payment issues.
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {paymentIssues.map(issue => (
              <div key={issue.id} style={{
                background: CARD, border: `1px solid ${BORDER}`,
                borderLeft: `3px solid ${AMBER}`,
                borderRadius: 10, padding: '14px 18px',
                display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap',
              }}>
                <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                  <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: WHITE, marginBottom: 2 }}>
                    {issue.user_email}
                  </div>
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: AMBER, marginBottom: 4 }}>
                    ref: {issue.transaction_ref}
                  </div>
                  {issue.description && (
                    <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: MUTED }}>
                      {issue.description.slice(0, 80)}{issue.description.length > 80 ? '…' : ''}
                    </div>
                  )}
                </div>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, flexShrink: 0 }}>
                  {timeAgo(issue.created_at)}
                </div>
                <button
                  onClick={() => handleResolvePaymentIssue(issue.id)}
                  disabled={resolvingIssueId === issue.id}
                  style={{
                    fontFamily: "'Poppins', sans-serif", fontSize: 12, fontWeight: 600,
                    background: resolvingIssueId === issue.id ? 'rgba(22,163,74,0.2)' : GREEN,
                    color: WHITE, border: 'none', borderRadius: 6,
                    padding: '6px 14px', cursor: resolvingIssueId === issue.id ? 'not-allowed' : 'pointer',
                    flexShrink: 0, transition: 'background 0.15s ease',
                  }}
                >
                  {resolvingIssueId === issue.id ? 'Resolving…' : 'Mark Resolved'}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── SECTION 7: Never Converted ─────────────────────────────── */}
      <SectionHeading title={`Never Converted — Conversion Targets (${never_converted.length})`} />
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, marginBottom: 64 }}>
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED, marginBottom: 20, marginTop: 0 }}>
          Signed up 3+ days ago · Free plan · Has at least one project.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ borderCollapse: 'collapse', width: '100%' }}>
            <thead>
              <tr>
                {['Email', 'Signed Up', 'Last Active', 'Steps Used'].map(h => (
                  <th key={h} style={{
                    fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600,
                    color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em',
                    padding: '10px 12px', textAlign: 'left', background: SURFACE,
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {never_converted.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ ...td, textAlign: 'center', color: MUTED }}>
                    No users match this criteria yet.
                  </td>
                </tr>
              ) : never_converted.map((u, i) => (
                <tr key={u.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={{ ...td, color: WHITE, fontWeight: 500 }}>{u.email}</td>
                  <td style={td}>{fmtDate(u.signup_date)}</td>
                  <td style={td}>{fmtDate(u.last_active)}</td>
                  <td style={tdMono}>{u.steps_completed} / 10</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  )
}
