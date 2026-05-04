import { useState, useEffect, useMemo } from 'react'
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

// ── Small components ─────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    active:     { color: GREEN, label: 'Active' },
    inactive:   { color: AMBER, label: 'Inactive' },
    churned:    { color: RED,   label: 'Churned' },
    never_used: { color: null,  label: 'Never used' },
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

// ── Main component ────────────────────────────────────────────────────
export default function AdminHealth() {
  const { user, session, loading } = useUser()
  const [data, setData]         = useState(null)
  const [error, setError]       = useState(null)
  const [fetching, setFetching] = useState(false)

  // User table state
  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState('signup_date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage]       = useState(0)

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
  const isAdmin    = !!adminEmail && user?.email === adminEmail

  useEffect(() => {
    if (!isAdmin || !session) return
    setFetching(true)
    fetch('/api/admin?action=dashboard', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setData(d) })
      .catch(e => setError(e.message))
      .finally(() => setFetching(false))
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

  // ── Guard states ────────────────────────────────────────────────
  const shell = { minHeight: '100vh', background: BG, padding: '40px 48px', fontFamily: "'Poppins', sans-serif", color: WHITE }
  if (loading)  return <div style={shell}>Loading…</div>
  if (!isAdmin) return <div style={{ ...shell, color: RED }}>Access denied.</div>
  if (fetching) return <div style={shell}>Fetching dashboard data…</div>
  if (error)    return <div style={{ ...shell, color: RED }}>Error: {error}</div>
  if (!data)    return null

  const { overview, revenue_chart, signups_chart, feature_usage, funnel, never_converted } = data
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

      {/* Header */}
      <div style={{ marginBottom: 36 }}>
        <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 32, fontWeight: 400, margin: 0 }}>
          FYPro Admin — Analytics
        </h1>
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 13, color: MUTED, marginTop: 8 }}>
          {new Date().toLocaleDateString('en-GB', { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── SECTION 1: Overview Cards ─────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginBottom: 8 }}>
        <OverviewCard label="Total Users"      value={overview.total_users.toLocaleString()}        accent={BLUE}  />
        <OverviewCard label="Active Today"     value={overview.active_today.toLocaleString()}        accent={GREEN} />
        <OverviewCard label="Active This Week" value={overview.active_this_week.toLocaleString()}    accent={GREEN} />
        <OverviewCard label="Paid Users"       value={overview.total_paid.toLocaleString()}          accent={AMBER} />
        <OverviewCard label="Total Revenue"    value={`₦${overview.total_revenue_ngn.toLocaleString()}`} accent={GREEN} />
        <OverviewCard label="Conversion Rate"  value={`${overview.conversion_rate}%`} sub="paid ÷ total" accent={BLUE}  />
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
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 780 }}>
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
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ ...td, textAlign: 'center', color: MUTED }}>No users found.</td>
                </tr>
              ) : pageRows.map((u, i) => (
                <tr key={u.id} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                  <td style={{ ...td, color: WHITE, fontWeight: 500 }}>{u.email || '—'}</td>
                  <td style={td}>{fmtDate(u.signup_date)}</td>
                  <td style={td}>{fmtDate(u.last_active)}</td>
                  <td style={td}><PlanBadge plan={u.plan} /></td>
                  <td style={{ ...tdMono, textAlign: 'center' }}>{u.project_count}</td>
                  <td style={td}><StatusBadge status={u.status} /></td>
                  <td style={tdMono}>{u.paid_amount > 0 ? `₦${u.paid_amount.toLocaleString()}` : '—'}</td>
                </tr>
              ))}
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
