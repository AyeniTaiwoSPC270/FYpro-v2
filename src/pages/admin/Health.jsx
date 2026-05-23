import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useUser } from '../../hooks/useUser'
import {
  LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import FeatureFeedbackWidget from './widgets/FeatureFeedbackWidget'
import { supabase } from '../../lib/supabase'

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
  topic_validator:     'Topic Validator',
  chapter_architect:   'Chapter Architect',
  methodology_advisor: 'Methodology Advisor',
  writing_planner:     'Writing Planner',
  literature_map:      'Literature Map',
  abstract_generator:  'Abstract Generator',
  instrument_builder:  'Instrument Builder',
  project_reviewer:    'Project Reviewer',
  defense_simulator:   'Defense Simulator',
  red_flag_detector:   'Red Flag Scanner',
  meeting_prep:        'Meeting Prep',
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

function FailedBadge({ label, error }) {
  return (
    <div style={{
      background: 'rgba(220,38,38,0.1)',
      border: '1px solid rgba(220,38,38,0.25)',
      borderRadius: 10,
      padding: '12px 16px',
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 12,
      color: '#F87171',
    }}>
      {label} — {error}
    </div>
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

// ── KPI counter card ─────────────────────────────────────────────────
function KpiCounterCard({ label, target, prefix = '', suffix = '', decimals = 0, glow, shadow, delay, sub }) {
  const [display, setDisplay] = useState(0)
  useEffect(() => {
    const duration = 1400
    let raf
    let start
    function step(ts) {
      if (start === undefined) start = ts
      const pct  = Math.min((ts - start) / duration, 1)
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
  if (!data || data.length === 0) return (
    <div style={{ height: 120, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>No data yet</div>
  )
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
              height: `${Math.max((d.count / maxVal) * 100, d.count > 0 ? 6 : 0)}px`,
              borderRadius: '3px 3px 0 0',
              background: 'linear-gradient(to top, #0066FF, rgba(0,102,255,0.2))',
              animationDelay: `${0.35 + i * 0.04}s`,
            }}
          />
          <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
            {new Date(d.date).toLocaleDateString('en-GB', { day: '2-digit', month: 'short' }).slice(0, 5)}
          </div>
        </div>
      ))}
    </div>
  )
}

// ── Live activity feed ───────────────────────────────────────────────
const FEED_COLORS = {
  signup:  '#4ade80',
  payment: '#fbbf24',
  feature: '#60a5fa',
  failure: '#f87171',
}
const FEED_TAGS = {
  signup:  'SIGNUP',
  payment: 'PAY',
  feature: 'STEP',
  failure: 'AI FAIL',
}

function LiveFeed({ events }) {
  const [newKeys,   setNewKeys]   = useState(new Set())
  const prevKeysRef = useRef(new Set())

  useEffect(() => {
    if (!events?.length) return
    const incoming = new Set(events.map(e => `${e.type}:${e.user_prefix}:${e.time}`))
    const fresh    = [...incoming].filter(k => !prevKeysRef.current.has(k))
    prevKeysRef.current = incoming
    if (fresh.length > 0) {
      setNewKeys(new Set(fresh))
      const t = setTimeout(() => setNewKeys(new Set()), 1800)
      return () => clearTimeout(t)
    }
  }, [events])

  function timeAgoShort(iso) {
    if (!iso) return '—'
    const ms = Date.now() - new Date(iso).getTime()
    const m  = Math.floor(ms / 60000)
    if (m < 1)  return 'just now'
    if (m < 60) return `${m}m ago`
    return `${Math.floor(m / 60)}h ago`
  }

  if (!events || events.length === 0) {
    return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:100, color:'rgba(255,255,255,0.2)', fontSize:12, fontFamily:"'Poppins',sans-serif" }}>No recent activity</div>
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      {events.slice(0, 20).map((e, i) => {
        const color = FEED_COLORS[e.type] || '#60a5fa'
        const tag   = FEED_TAGS[e.type]   || e.type.toUpperCase()
        const key   = `${e.type}:${e.user_prefix}:${e.time}`
        const isNew = newKeys.has(key)
        return (
          <div
            key={key}
            className="mc-feed-item"
            style={{
              display:'flex', alignItems:'center', gap:10,
              padding:'7px 12px', borderRadius:8,
              background: isNew ? `${color}10` : 'rgba(255,255,255,0.03)',
              border: `1px solid ${isNew ? color + '30' : 'rgba(255,255,255,0.05)'}`,
              animationDelay:`${0.5 + i * 0.04}s`,
              transition:'background 1s ease, border-color 1s ease',
            }}
          >
            <div style={{ width:7, height:7, borderRadius:'50%', background:color, flexShrink:0 }} />
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, fontWeight:700, color, background:`${color}18`, border:`1px solid ${color}33`, borderRadius:999, padding:'1px 7px', flexShrink:0 }}>{tag}</span>
            <span style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, color:'rgba(255,255,255,0.7)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{e.user_prefix} — {e.label}</span>
            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:'rgba(255,255,255,0.25)', flexShrink:0 }}>{timeAgoShort(e.time)}</span>
          </div>
        )
      })}
    </div>
  )
}

// ── DiagnoseResult — structured display for diagnose-user response ──────
const RL_FEATURE_LABELS = {
  claude: 'Claude API', defense: 'Defense Sim', supervisor: 'Supervisor',
  'supervisor-prep': 'Supervisor', reviewer: 'Project Reviewer',
  research: 'Research', auth: 'Auth', admin: 'Admin',
}

function parseRlKey(key) {
  const parts = key.split(':')
  const featureRaw = parts[2] || 'unknown'
  const featureLabel = RL_FEATURE_LABELS[featureRaw] || featureRaw
  const dateMatch = key.match(/(\d{4}-\d{2}-\d{2})/)
  return { feature: featureLabel, expiry: dateMatch ? dateMatch[1] : 'today' }
}

function DiagnoseResult({ result }) {
  const { user_rl_keys = [], ip_rl_keys = [], last_ip, cap_hit, cap_pct, spent_usd, cap_usd, is_blocked, block_reasons = [] } = result
  const allRlKeys = [...user_rl_keys, ...ip_rl_keys]

  const sectionTitle = {
    fontFamily: "'JetBrains Mono',monospace", fontSize: 10, fontWeight: 700,
    color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.12em',
    marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid rgba(255,255,255,0.06)',
  }
  const row = {
    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
    padding: '7px 0', borderBottom: '1px solid rgba(255,255,255,0.04)',
  }
  const lbl = { fontFamily: "'Poppins',sans-serif", fontSize: 12, color: MUTED }
  const val = { fontFamily: "'JetBrains Mono',monospace", fontSize: 12, color: WHITE }

  function KeyRow({ keyStr }) {
    const { feature, expiry } = parseRlKey(keyStr)
    return (
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'5px 0 5px 8px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:AMBER }}>{feature}</span>
        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:MUTED }}>{expiry}</span>
      </div>
    )
  }

  return (
    <div>
      {/* Rate Limit Keys */}
      <div style={{ marginBottom:20 }}>
        <div style={sectionTitle}>Rate Limit Keys</div>
        {allRlKeys.length === 0 ? (
          <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, color:MUTED, paddingLeft:8 }}>No active rate limit keys</div>
        ) : allRlKeys.map((k, i) => <KeyRow key={i} keyStr={k} />)}
      </div>

      {/* User Status */}
      <div style={{ marginBottom:20 }}>
        <div style={sectionTitle}>User Status</div>
        <div style={row}>
          <span style={lbl}>Is Blocked</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, fontWeight:700, color:is_blocked?RED:GREEN, background:is_blocked?'rgba(220,38,38,0.12)':'rgba(22,163,74,0.12)', border:`1px solid ${is_blocked?'rgba(220,38,38,0.3)':'rgba(22,163,74,0.3)'}`, borderRadius:999, padding:'2px 10px' }}>
            {is_blocked ? 'YES' : 'NO'}
          </span>
        </div>
        {block_reasons.length > 0 && (
          <div style={{ padding:'8px 0 8px 8px', borderBottom:'1px solid rgba(255,255,255,0.04)' }}>
            <div style={{ ...lbl, marginBottom:6 }}>Block Reasons</div>
            {block_reasons.map((r, i) => (
              <div key={i} style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, color:'#F87171', padding:'2px 0' }}>· {r}</div>
            ))}
          </div>
        )}
        <div style={row}>
          <span style={lbl}>Cap Hit</span>
          <span style={{ ...val, color: cap_hit ? RED : GREEN }}>{cap_hit ? 'YES' : 'NO'}</span>
        </div>
        <div style={row}>
          <span style={lbl}>Cap Percentage</span>
          <span style={{ ...val, color: (cap_pct||0) >= 80 ? RED : (cap_pct||0) >= 50 ? AMBER : WHITE }}>{cap_pct ?? 0}%</span>
        </div>
        <div style={row}>
          <span style={lbl}>Spent USD</span>
          <span style={val}>${(spent_usd || 0).toFixed(2)}</span>
        </div>
        <div style={row}>
          <span style={lbl}>Cap USD</span>
          <span style={val}>${(cap_usd || 0).toFixed(2)}</span>
        </div>
      </div>

      {/* IP Info */}
      <div style={{ marginBottom:8 }}>
        <div style={sectionTitle}>IP Info</div>
        <div style={row}>
          <span style={lbl}>Last IP</span>
          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color: last_ip ? WHITE : MUTED }}>{last_ip || 'None'}</span>
        </div>
        <div style={{ padding:'8px 0 0' }}>
          <div style={{ ...lbl, marginBottom:6 }}>IP RL Keys</div>
          {ip_rl_keys.length === 0 ? (
            <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, color:MUTED, paddingLeft:8 }}>None</div>
          ) : ip_rl_keys.map((k, i) => <KeyRow key={i} keyStr={k} />)}
        </div>
      </div>
    </div>
  )
}

const POLL_OVERVIEW = 30 * 1000   // overview / users tab
const POLL_VITALS   = 15 * 1000   // vitals tab
const POLL_FEED     = 10 * 1000   // live activity feed (failures) when overview active
const POLL_PAYMENTS = 60 * 1000   // payments tab
const POLL_LOGS     = 30 * 1000   // logs tab
const POLL_BG       = 60 * 1000   // any non-active or hidden tab

// ── Main component ────────────────────────────────────────────────────
function AdminHealth() {
  const { user, session, loading } = useUser()
  const [data, setData]           = useState(null)
  const [error, setError]         = useState(null)
  const [fetching, setFetching]   = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [lastUpdated, setLastUpdated] = useState(null)
  const [secondsAgo, setSecondsAgo]   = useState(null)
  const timerRef        = useRef(null)
  const secondsTimerRef = useRef(null)
  const authTimerRef    = useRef(null)
  const paymentTimerRef = useRef(null)
  const isFetchingRef   = useRef(false)

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

  const [systemLogs, setSystemLogs]               = useState(null)
  const [systemLogsLoading, setSystemLogsLoading] = useState(true)
  const [resolvingLogId, setResolvingLogId]       = useState(null)
  const [expandedLogIds, setExpandedLogIds]       = useState(new Set())
  const systemLogsTimerRef                        = useRef(null)
  const [sentryIssues, setSentryIssues]           = useState([])
  const [resolvingAllSentry, setResolvingAllSentry] = useState(false)
  const [sentryResolveError, setSentryResolveError] = useState(null)

  const [feedbackData, setFeedbackData]             = useState(null)
  const [feedbackLoading, setFeedbackLoading]       = useState(true)
  const [feedbackError, setFeedbackError]           = useState(null)
  const feedbackTimerRef                            = useRef(null)

  const [authAttempts, setAuthAttempts]       = useState(null)
  const [authAttemptsLoading, setAuthAttemptsLoading] = useState(true)

  const [vitalsError, setVitalsError]               = useState(null)
  const [failuresError, setFailuresError]           = useState(null)
  const [authAttemptsError, setAuthAttemptsError]   = useState(null)
  const [paymentIssuesError, setPaymentIssuesError] = useState(null)
  const [systemLogsError, setSystemLogsError]       = useState(null)
  const [initialLoading, setInitialLoading]         = useState(true)

  // Direct Supabase real-time metrics (bypass /api/admin for live fields)
  const [rtMetrics, setRtMetrics]               = useState(null)
  const [rtMetricsLoading, setRtMetricsLoading] = useState(true)
  const [rtMetricsError, setRtMetricsError]     = useState(null)
  const isFetchingRtRef                         = useRef(false)

  // User table state
  const [search, setSearch]   = useState('')
  const [sortKey, setSortKey] = useState('signup_date')
  const [sortDir, setSortDir] = useState('desc')
  const [page, setPage]       = useState(0)
  const [actionState, setActionState] = useState({}) // { userId: 'pending' | 'banned' | 'deleted' | 'error' }
  const [userActionToast,  setUserActionToast]  = useState(null)  // { type: 'success'|'error', message }
  const userActionToastTimer                    = useRef(null)
  const [diagnoseModal,    setDiagnoseModal]    = useState(null)  // { email, loading, result, error }
  const [diagnoseBusy,     setDiagnoseBusy]     = useState({})

  const [testAlertsBusy,   setTestAlertsBusy]   = useState(false)
  const [testAlertsResult, setTestAlertsResult] = useState(null)

  const [maintenanceMode,      setMaintenanceMode]      = useState(false)
  const [maintenanceLoading,   setMaintenanceLoading]   = useState(true)
  const [maintenanceBusy,      setMaintenanceBusy]      = useState(false)
  const [maintenanceMessage,   setMaintenanceMessage]   = useState('')
  const [maintenanceUpdatedAt, setMaintenanceUpdatedAt] = useState(null)
  const [maintenanceToast,     setMaintenanceToast]     = useState(null)
  const maintenanceToastTimer                           = useRef(null)

  const [confirmModal, setConfirmModal] = useState(null) // { title, body, onConfirm, danger }

  const [activeTab, setActiveTab] = useState('overview')
  const counterKeyRef = useRef(0)

  // isAdmin is determined by the server response (403 = not admin), not by comparing
  // against a client-side email value that would be visible in the JS bundle.
  const [isAdmin, setIsAdmin] = useState(null) // null = loading; server response sets true/false

  const loadData = useCallback(() => {
    if (!session?.access_token) return Promise.resolve()
    if (isFetchingRef.current) return Promise.resolve()
    isFetchingRef.current = true
    setFetching(true)
    setError(null)
    return fetch('/api/admin?action=dashboard', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => {
        if (r.status === 403) { setIsAdmin(false); throw new Error('Forbidden') }
        setIsAdmin(true)
        return r.json()
      })
      .then(d => { if (d.error) throw new Error(d.error); setData(d); setLastUpdated(new Date()) })
      .catch(e => setError(e.message))
      .finally(() => { isFetchingRef.current = false; setFetching(false) })
  }, [session?.access_token])

  const loadVitals = useCallback(() => {
    if (!session?.access_token) return Promise.resolve()
    return fetch('/api/admin?action=vitals', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setVitals(d); setVitalsError(null); setLastUpdated(new Date()) })
      .catch(e => setVitalsError(e.message || 'Failed to load'))
      .finally(() => setVitalsLoading(false))
  }, [session?.access_token])

  const loadFailures = useCallback(() => {
    if (!session?.access_token) return Promise.resolve()
    return fetch('/api/admin?action=failures', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setFailures(d); setFailuresError(null); setLastUpdated(new Date()) })
      .catch(e => setFailuresError(e.message || 'Failed to load'))
      .finally(() => setFailuresLoading(false))
  }, [session?.access_token])

  const loadAuthAttempts = useCallback(() => {
    if (!session?.access_token) return Promise.resolve()
    return fetch('/api/admin?action=auth-attempts', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setAuthAttempts(d); setAuthAttemptsError(null); setLastUpdated(new Date()) })
      .catch(e => setAuthAttemptsError(e.message || 'Failed to load'))
      .finally(() => setAuthAttemptsLoading(false))
  }, [session?.access_token])

  const loadPaymentIssues = useCallback(() => {
    if (!session?.access_token) return Promise.resolve()
    return fetch('/api/admin?action=payment-issues', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setPaymentIssues(d.issues); setPaymentIssuesError(null); setLastUpdated(new Date()) })
      .catch(e => setPaymentIssuesError(e.message || 'Failed to load'))
      .finally(() => setPaymentIssuesLoading(false))
  }, [session?.access_token])

  const loadSystemLogs = useCallback(() => {
    if (!session?.access_token) return Promise.resolve()
    return fetch('/api/admin?action=system_logs', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setSystemLogs(d.logs); setSentryIssues(d.sentry_issues || []); setSystemLogsError(null); setLastUpdated(new Date()) })
      .catch(e => setSystemLogsError(e.message || 'Failed to load'))
      .finally(() => setSystemLogsLoading(false))
  }, [session?.access_token])

  const loadFeedbackSummary = useCallback(() => {
    if (!session?.access_token) return Promise.resolve()
    return fetch('/api/admin?action=feedback-summary', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (d.error) throw new Error(d.error); setFeedbackData(d.rows); setFeedbackError(null); setLastUpdated(new Date()) })
      .catch(e => setFeedbackError(e.message || 'Failed to load'))
      .finally(() => setFeedbackLoading(false))
  }, [session?.access_token])

  const loadMaintenanceMode = useCallback(() => {
    if (!session?.access_token) return Promise.resolve()
    return fetch('/api/admin?action=get-maintenance-mode', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => {
        if (d.error) throw new Error(d.error)
        setMaintenanceMode(d.maintenance_mode)
        setMaintenanceMessage(d.maintenance_message || '')
        setMaintenanceUpdatedAt(d.updated_at)
      })
      .catch(() => {})
      .finally(() => setMaintenanceLoading(false))
  }, [session?.access_token])

  // fetchRtMetrics — 9 parallel direct Supabase queries for the 7 live metrics.
  // Preferred over /api/admin for these fields; falls back gracefully if RLS blocks
  // access (migration 0018 must be applied and admin seeded into admin_users).
  const fetchRtMetrics = useCallback(async () => {
    if (!isAdmin) return
    if (isFetchingRtRef.current) return
    isFetchingRtRef.current = true
    try {
      const todayUTC      = new Date().toISOString().split('T')[0]   // 'YYYY-MM-DD'
      const todayStart    = `${todayUTC}T00:00:00Z`
      const thirtyMinsAgo = new Date(Date.now() - 30 * 60 * 1000).toISOString()

      const [
        usageRes, activeRes, latencyRes, failCountRes, lastCallRes,
        revenueRes, signupsRes, payFeedRes, failFeedRes,
      ] = await Promise.allSettled([
        // Requests today — daily_usage.request_count for today's date
        supabase.from('daily_usage').select('request_count').eq('date', todayUTC).maybeSingle(),
        // Active sessions — rows in response_times in last 30 min
        supabase.from('response_times').select('id', { count: 'exact', head: true }).gt('created_at', thirtyMinsAgo),
        // API latency — avg of last 10 duration_ms values
        supabase.from('response_times').select('duration_ms').order('created_at', { ascending: false }).limit(10),
        // Failures today — count from generation_failures since midnight UTC
        supabase.from('generation_failures').select('id', { count: 'exact', head: true }).gte('created_at', todayStart),
        // Last API call — most recent created_at from response_times
        supabase.from('response_times').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
        // Revenue today — sum of successful payment amounts since midnight UTC
        supabase.from('payments').select('amount_kobo').eq('status', 'success').gte('created_at', todayStart),
        // Live feed: recent signups
        supabase.from('users').select('id, email, created_at').order('created_at', { ascending: false }).limit(7),
        // Live feed: recent successful payments
        supabase.from('payments').select('user_id, created_at, amount_kobo, tier').eq('status', 'success').order('created_at', { ascending: false }).limit(7),
        // Live feed: recent generation failures
        supabase.from('generation_failures').select('created_at, feature, error_message').order('created_at', { ascending: false }).limit(7),
      ])

      const requestsToday = (usageRes.status === 'fulfilled' && !usageRes.value.error)
        ? (usageRes.value.data?.request_count ?? 0) : null

      const activeSessions = (activeRes.status === 'fulfilled' && !activeRes.value.error)
        ? (activeRes.value.count ?? 0) : null

      let avgLatencyMs = null
      if (latencyRes.status === 'fulfilled' && !latencyRes.value.error && latencyRes.value.data?.length) {
        const rows = latencyRes.value.data
        avgLatencyMs = rows.reduce((s, r) => s + (r.duration_ms || 0), 0) / rows.length
      }

      const failuresToday = (failCountRes.status === 'fulfilled' && !failCountRes.value.error)
        ? (failCountRes.value.count ?? 0) : null

      const lastCallAt = (lastCallRes.status === 'fulfilled' && !lastCallRes.value.error)
        ? (lastCallRes.value.data?.created_at ?? null) : null

      let revenueTodayNgn = null
      if (revenueRes.status === 'fulfilled' && !revenueRes.value.error && revenueRes.value.data) {
        revenueTodayNgn = revenueRes.value.data.reduce((s, p) => s + (p.amount_kobo || 0), 0) / 100
      }

      // Batch-fetch emails for payment user_ids so the feed shows email prefixes
      let paymentEmailMap = {}
      if (payFeedRes.status === 'fulfilled' && !payFeedRes.value.error && payFeedRes.value.data?.length) {
        const uids = [...new Set(payFeedRes.value.data.map(p => p.user_id).filter(Boolean))]
        if (uids.length > 0) {
          try {
            const { data: userRows } = await supabase.from('users').select('id, email').in('id', uids)
            if (userRows) userRows.forEach(u => { paymentEmailMap[u.id] = u.email })
          } catch (_) {}
        }
      }

      const feedEvents = []
      if (signupsRes.status === 'fulfilled' && !signupsRes.value.error && signupsRes.value.data) {
        signupsRes.value.data.forEach(u => feedEvents.push({
          type: 'signup', label: 'New signup',
          user_prefix: u.email ? u.email.split('@')[0] : u.id.slice(0, 8),
          time: u.created_at,
        }))
      }
      if (payFeedRes.status === 'fulfilled' && !payFeedRes.value.error && payFeedRes.value.data) {
        payFeedRes.value.data.forEach(p => {
          const email = paymentEmailMap[p.user_id]
          feedEvents.push({
            type: 'payment',
            label: `${p.tier || 'payment'} — ₦${Math.round((p.amount_kobo || 0) / 100).toLocaleString()}`,
            user_prefix: email ? email.split('@')[0] : (p.user_id || '—').slice(0, 8),
            time: p.created_at,
          })
        })
      }
      if (failFeedRes.status === 'fulfilled' && !failFeedRes.value.error && failFeedRes.value.data) {
        failFeedRes.value.data.forEach(f => feedEvents.push({
          type: 'failure',
          label: (f.feature || 'unknown').replace(/_/g, ' '),
          user_prefix: '—', time: f.created_at,
        }))
      }
      feedEvents.sort((a, b) => new Date(b.time) - new Date(a.time))

      setRtMetrics({
        requests_today:    requestsToday,
        active_sessions:   activeSessions,
        avg_latency_ms:    avgLatencyMs,
        failures_today:    failuresToday,
        last_call_at:      lastCallAt,
        revenue_today_ngn: revenueTodayNgn,
        live_feed:         feedEvents.slice(0, 20),
      })
      setRtMetricsError(null)
    } catch (err) {
      setRtMetricsError(err.message || 'Real-time metrics unavailable')
    } finally {
      isFetchingRtRef.current = false
      setRtMetricsLoading(false)
    }
  }, [isAdmin])

  // Fire all 8 loaders simultaneously; owns the refreshing flag and lastUpdated stamp.
  const handleRefresh = useCallback(async () => {
    setRefreshing(true)
    await Promise.allSettled([
      loadData(),
      loadVitals(),
      loadFailures(),
      loadAuthAttempts(),
      loadPaymentIssues(),
      loadSystemLogs(),
      loadFeedbackSummary(),
      loadMaintenanceMode(),
      fetchRtMetrics(),
    ])
    setLastUpdated(new Date())
    setRefreshing(false)
  }, [loadData, loadVitals, loadFailures, loadAuthAttempts, loadPaymentIssues, loadSystemLogs, loadFeedbackSummary, loadMaintenanceMode, fetchRtMetrics])

  // Initial parallel fetch — all 8 widgets at once; one failure never blocks the rest
  // Guard uses === false (not !isAdmin) so the null loading state still triggers the fetch
  // that establishes isAdmin. Once isAdmin is true, polling effects take over.
  useEffect(() => {
    if (isAdmin === false || !session) return
    setInitialLoading(true)
    Promise.allSettled([
      loadData(),
      loadVitals(),
      loadFailures(),
      loadAuthAttempts(),
      loadPaymentIssues(),
      loadSystemLogs(),
      loadFeedbackSummary(),
      loadMaintenanceMode(),
      fetchRtMetrics(),
    ]).finally(() => setInitialLoading(false))
  }, [isAdmin, session, loadData, loadVitals, loadFailures, loadAuthAttempts, loadPaymentIssues, loadSystemLogs, loadFeedbackSummary, loadMaintenanceMode, fetchRtMetrics])

  // Polling — each loader uses a tab-specific rate.
  // Callbacks are no-ops when document is hidden; the visibilitychange handler
  // (below) fires an immediate refresh when the tab becomes visible again.
  useEffect(() => {
    if (!isAdmin || !session) return
    const ms = (activeTab === 'overview' || activeTab === 'users') ? POLL_OVERVIEW : POLL_BG
    timerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadData()
    }, ms)
    return () => clearInterval(timerRef.current)
  }, [isAdmin, session, loadData, activeTab])

  useEffect(() => {
    if (!isAdmin || !session) return
    const ms = activeTab === 'vitals' ? POLL_VITALS : POLL_BG
    vitalsTimerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadVitals()
    }, ms)
    return () => clearInterval(vitalsTimerRef.current)
  }, [isAdmin, session, loadVitals, activeTab])

  // Live feed runs at POLL_FEED (10s) when overview is active so new events appear quickly
  useEffect(() => {
    if (!isAdmin || !session) return
    const ms = activeTab === 'overview' ? POLL_FEED : activeTab === 'logs' ? POLL_LOGS : POLL_BG
    failuresTimerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadFailures()
    }, ms)
    return () => clearInterval(failuresTimerRef.current)
  }, [isAdmin, session, loadFailures, activeTab])

  useEffect(() => {
    if (!isAdmin || !session) return
    const ms = activeTab === 'vitals' ? POLL_VITALS : POLL_BG
    authTimerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadAuthAttempts()
    }, ms)
    return () => clearInterval(authTimerRef.current)
  }, [isAdmin, session, loadAuthAttempts, activeTab])

  useEffect(() => {
    if (!isAdmin || !session) return
    const ms = activeTab === 'payments' ? POLL_PAYMENTS : POLL_BG
    paymentTimerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadPaymentIssues()
    }, ms)
    return () => clearInterval(paymentTimerRef.current)
  }, [isAdmin, session, loadPaymentIssues, activeTab])

  useEffect(() => {
    if (!isAdmin || !session) return
    const ms = activeTab === 'logs' ? POLL_LOGS : POLL_BG
    systemLogsTimerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadSystemLogs()
    }, ms)
    return () => clearInterval(systemLogsTimerRef.current)
  }, [isAdmin, session, loadSystemLogs, activeTab])

  useEffect(() => {
    if (!isAdmin || !session) return
    feedbackTimerRef.current = setInterval(() => {
      if (document.visibilityState !== 'visible') return
      loadFeedbackSummary()
    }, POLL_PAYMENTS)
    return () => clearInterval(feedbackTimerRef.current)
  }, [isAdmin, session, loadFeedbackSummary])

  // Log once on actual mount (not on every re-render)
  useEffect(() => { console.log('Health component mounted') }, [])

  // Stable refs so the Realtime subscription never needs to tear down when
  // these callbacks are recreated (e.g. when session object reference changes).
  const loadVitalsRef   = useRef(loadVitals)
  const loadFailuresRef = useRef(loadFailures)
  const loadDataRef     = useRef(loadData)
  const fetchRtRef      = useRef(fetchRtMetrics)
  // useLayoutEffect (no deps) runs synchronously after every render — refs are
  // always current before any pending useEffect fires.
  useLayoutEffect(() => {
    loadVitalsRef.current   = loadVitals
    loadFailuresRef.current = loadFailures
    loadDataRef.current     = loadData
    fetchRtRef.current      = fetchRtMetrics
  })

  // Realtime subscriptions — each table change triggers both the API loader (for complex
  // aggregates) and fetchRtMetrics (for the 7 direct-query live metrics).
  // Deps: isAdmin (subscription only makes sense once admin is confirmed) and
  // session?.access_token (a stable string — rotates only when the JWT expires,
  // not on every session object re-creation from onAuthStateChange).
  useEffect(() => {
    console.log('useEffect running', { isAdmin })
    if (!isAdmin || !session?.access_token) {
      console.log('[admin-realtime] skipped — isAdmin:', isAdmin, 'session:', !!session)
      return
    }
    // Inject the current JWT so Realtime authenticates as the admin user, not anon.
    // Required because supabase.auth.stopAutoRefresh() prevents the automatic token push.
    supabase.realtime.setAuth(session.access_token)
    console.log('Realtime subscribing...')
    const channel = supabase
      .channel('admin-realtime-v1')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'response_times' }, () => {
        if (document.visibilityState === 'visible') { loadVitalsRef.current(); fetchRtRef.current() }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'daily_usage' }, () => {
        if (document.visibilityState === 'visible') { loadVitalsRef.current(); fetchRtRef.current() }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'generation_failures' }, () => {
        if (document.visibilityState === 'visible') { loadFailuresRef.current(); loadVitalsRef.current(); fetchRtRef.current() }
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'payments' }, () => {
        if (document.visibilityState === 'visible') { loadDataRef.current(); fetchRtRef.current() }
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'users' }, () => {
        if (document.visibilityState === 'visible') fetchRtRef.current()
      })
      .subscribe((status) => {
        console.log('Realtime status:', status)
      })
    return () => { supabase.removeChannel(channel) }
  }, [isAdmin, session?.access_token])

  // "X seconds ago" counter
  useEffect(() => {
    if (!lastUpdated) return
    setSecondsAgo(0)
    clearInterval(secondsTimerRef.current)
    secondsTimerRef.current = setInterval(() => {
      setSecondsAgo(Math.floor((Date.now() - lastUpdated.getTime()) / 1000))
    }, 1000)
    return () => clearInterval(secondsTimerRef.current)
  }, [lastUpdated])

  // Refresh immediately on OS focus AND when browser tab becomes visible
  useEffect(() => {
    const onFocus = () => handleRefresh()
    const onVisible = () => { if (document.visibilityState === 'visible') handleRefresh() }
    window.addEventListener('focus', onFocus)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      window.removeEventListener('focus', onFocus)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [handleRefresh])

  // Live activity events — prefers direct Supabase data; falls back to API events
  const liveEvents = useMemo(() => {
    if (rtMetrics?.live_feed?.length > 0) return rtMetrics.live_feed
    const evts = []
    if (data?.recent_events) evts.push(...data.recent_events)
    if (failures?.rows) {
      failures.rows
        .filter(r => !r.resolved)
        .slice(0, 5)
        .forEach(r => evts.push({
          type: 'failure',
          label: (r.feature || 'unknown').replace(/_/g, ' '),
          user_prefix: '—',
          time: r.created_at,
        }))
    }
    return evts.sort((a, b) => new Date(b.time) - new Date(a.time)).slice(0, 20)
  }, [rtMetrics, data, failures])

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

  // Merged vitals: direct Supabase data preferred, API response as fallback.
  // Enables the Vitals tab to display as soon as either source resolves.
  const displayVitals = useMemo(() => {
    if (!vitals && !rtMetrics) return null
    return {
      avg_response_ms: rtMetrics?.avg_latency_ms  ?? vitals?.avg_response_ms  ?? null,
      last_call_at:    rtMetrics?.last_call_at     ?? vitals?.last_call_at     ?? null,
      failures_today:  rtMetrics?.failures_today   ?? vitals?.failures_today   ?? 0,
      requests_today:  rtMetrics?.requests_today   ?? vitals?.requests_today   ?? 0,
      active_sessions: rtMetrics?.active_sessions  ?? vitals?.active_sessions  ?? 0,
    }
  }, [vitals, rtMetrics])

  const totalPages = Math.ceil(filteredUsers.length / PAGE_SIZE)
  const pageRows   = filteredUsers.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function handleSort(key) {
    if (sortKey === key) setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    else { setSortKey(key); setSortDir('desc') }
    setPage(0)
  }

  async function handleTestAlerts() {
    if (testAlertsBusy || !session?.access_token) return
    setTestAlertsBusy(true)
    setTestAlertsResult(null)
    try {
      const res  = await fetch('/api/admin?action=test-all-alerts', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      setTestAlertsResult(data)
    } catch (err) {
      setTestAlertsResult({ all_ok: false, error: err.message, results: [] })
    } finally {
      setTestAlertsBusy(false)
    }
  }

  async function handleDeleteUser(userId, email) {
    askConfirm(
      'Delete User',
      `Permanently delete ${email}? This cannot be undone.`,
      async () => {
        setActionState(s => ({ ...s, [userId]: 'pending' }))
        try {
          const res = await fetch('/api/admin?action=delete-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ userId }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error)
          setData(prev => prev ? { ...prev, users: prev.users.filter(u => u.id !== userId) } : prev)
          setActionState(s => { const n = { ...s }; delete n[userId]; return n })
          showUserToast('success', `${email} deleted`)
        } catch (err) {
          setActionState(s => ({ ...s, [userId]: 'error' }))
          showUserToast('error', 'Delete failed: ' + err.message)
        }
      },
      true
    )
  }

  async function handleBanUser(userId, email) {
    askConfirm(
      'Ban User',
      `Ban ${email}? They will be denied access until 2099.`,
      async () => {
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
          setData(prev => ({
            ...prev,
            users: prev.users.map(u => u.id === userId ? { ...u, status: 'banned' } : u),
          }))
          showUserToast('success', `${email} banned`)
        } catch (err) {
          setActionState(s => ({ ...s, [userId]: 'error' }))
          showUserToast('error', 'Ban failed: ' + err.message)
        }
      },
      true
    )
  }

  async function handleUnbanUser(userId, email) {
    askConfirm(
      'Unban User',
      `Unban ${email}? They will regain access immediately.`,
      async () => {
        setActionState(s => ({ ...s, [userId]: 'pending' }))
        try {
          const res = await fetch('/api/admin?action=unban-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ userId }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error)
          setActionState(s => { const n = { ...s }; delete n[userId]; return n })
          setData(prev => prev ? { ...prev, users: prev.users.map(u => u.id === userId ? { ...u, status: u.project_count > 0 ? 'inactive' : 'never_used' } : u) } : prev)
          showUserToast('success', `${email} unbanned`)
          loadData()
        } catch (err) {
          setActionState(s => { const n = { ...s }; delete n[userId]; return n })
          showUserToast('error', 'Unban failed: ' + err.message)
        }
      }
    )
  }

  function showUserToast(type, message) {
    clearTimeout(userActionToastTimer.current)
    setUserActionToast({ type, message })
    userActionToastTimer.current = setTimeout(() => setUserActionToast(null), 4000)
  }

  function askConfirm(title, body, onConfirm, danger = false) {
    setConfirmModal({ title, body, onConfirm, danger })
  }

  async function handleResetRunCounts(userId, email) {
    askConfirm(
      'Reset Run Counts',
      `Reset all feature usage counts for ${email}? They will start from zero.`,
      async () => {
        setActionState(s => ({ ...s, [userId]: 'pending' }))
        try {
          const res  = await fetch('/api/admin?action=reset-run-counts', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ userId }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error)
          setActionState(s => { const n = { ...s }; delete n[userId]; return n })
          showUserToast('success', `Run counts reset for ${email}`)
        } catch (err) {
          setActionState(s => { const n = { ...s }; delete n[userId]; return n })
          showUserToast('error', 'Reset failed: ' + err.message)
        }
      }
    )
  }

  async function handleResetUsage(userId, email) {
    askConfirm(
      'Reset Usage Limits',
      `Reset usage limits for ${email}? They will be able to use rate-limited features again.`,
      async () => {
        setActionState(s => ({ ...s, [userId]: 'pending' }))
        try {
          const res  = await fetch('/api/admin?action=reset-usage', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ userId }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error)
          setActionState(s => { const n = { ...s }; delete n[userId]; return n })
          showUserToast('success', `Usage limits reset for ${email}`)
        } catch (err) {
          setActionState(s => { const n = { ...s }; delete n[userId]; return n })
          showUserToast('error', 'Reset failed: ' + err.message)
        }
      }
    )
  }

  async function handleGrantPlan(userId, email, plan) {
    const label = plan === 'student' ? 'Student Plan' : 'Defense Plan'
    askConfirm(
      `Grant ${label}`,
      `Grant ${label} to ${email}? This gives them paid access at no charge.`,
      async () => {
        setActionState(s => ({ ...s, [userId]: 'pending' }))
        try {
          const res  = await fetch('/api/admin?action=grant-entitlement', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
            body: JSON.stringify({ userId, plan }),
          })
          const json = await res.json()
          if (!res.ok) throw new Error(json.error)
          setActionState(s => { const n = { ...s }; delete n[userId]; return n })
          setData(prev => prev ? { ...prev, users: prev.users.map(u => u.id === userId ? { ...u, plan: plan === 'defense' ? 'Defense' : 'Student' } : u) } : prev)
          showUserToast('success', `${label} granted to ${email}`)
          loadData()
        } catch (err) {
          setActionState(s => { const n = { ...s }; delete n[userId]; return n })
          showUserToast('error', `Grant failed: ${err.message}`)
        }
      }
    )
  }

  async function handleDiagnose(userId, email) {
    setDiagnoseBusy(s => ({ ...s, [userId]: true }))
    setDiagnoseModal({ email, userId, loading: true, result: null, error: null })
    try {
      const res  = await fetch('/api/admin?action=diagnose-user', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ userId }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
      setDiagnoseModal({ email, userId, loading: false, result: json, error: null })
    } catch (err) {
      setDiagnoseModal({ email, userId, loading: false, result: null, error: err.message })
    } finally {
      setDiagnoseBusy(s => ({ ...s, [userId]: false }))
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

  async function handleResolveLog(id) {
    setResolvingLogId(id)
    setSystemLogs(prev => (prev || []).filter(log => log.id !== id))
    try {
      const res = await fetch('/api/admin?action=resolve_log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error)
    } catch (err) {
      console.error('[admin] resolve log failed:', err.message)
      loadSystemLogs()
    } finally {
      setResolvingLogId(null)
    }
  }

  async function handleResolveAllSentryIssues() {
    if (sentryIssues.length === 0) return
    setResolvingAllSentry(true)
    setSentryResolveError(null)
    const ids = sentryIssues.map(i => i.id)
    setSentryIssues([])
    try {
      const res = await fetch('/api/admin?action=resolve-sentry-issues', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ ids }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || `Sentry API returned ${res.status}`)
    } catch (err) {
      console.error('[admin] resolve sentry issues failed:', err.message)
      setSentryResolveError(err.message)
      loadSystemLogs()
    } finally {
      setResolvingAllSentry(false)
    }
  }

  function toggleLogExpanded(id) {
    setExpandedLogIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
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
      showUserToast('error', 'Resolve failed: ' + err.message)
    } finally {
      setResolvingId(null)
    }
  }

  // ── Maintenance mode handlers ───────────────────────────────────
  async function handleToggleMaintenance() {
    const next = !maintenanceMode
    if (maintenanceBusy) return
    if (next) {
      askConfirm(
        'Enable Maintenance Mode',
        'This will lock out all users immediately. Only do this for planned downtime.',
        () => _doToggleMaintenance(next),
        true
      )
      return
    }
    _doToggleMaintenance(next)
  }

  async function _doToggleMaintenance(next) {
    setMaintenanceBusy(true)
    clearTimeout(maintenanceToastTimer.current)
    try {
      const res  = await fetch('/api/admin?action=set-maintenance-mode', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ enabled: next, message: maintenanceMessage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMaintenanceMode(next)
      setMaintenanceUpdatedAt(new Date().toISOString())
      setMaintenanceToast({ type: 'success', message: `Maintenance mode ${next ? 'enabled' : 'disabled'} ✓` })
    } catch (err) {
      setMaintenanceToast({ type: 'error', message: err.message })
    } finally {
      setMaintenanceBusy(false)
      maintenanceToastTimer.current = setTimeout(() => setMaintenanceToast(null), 4000)
    }
  }

  async function handleSaveMaintenanceMessage() {
    if (maintenanceBusy) return
    setMaintenanceBusy(true)
    clearTimeout(maintenanceToastTimer.current)
    try {
      const res  = await fetch('/api/admin?action=set-maintenance-mode', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body:    JSON.stringify({ enabled: maintenanceMode, message: maintenanceMessage }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMaintenanceUpdatedAt(new Date().toISOString())
      setMaintenanceToast({ type: 'success', message: 'Message saved ✓' })
    } catch (err) {
      setMaintenanceToast({ type: 'error', message: err.message })
    } finally {
      setMaintenanceBusy(false)
      maintenanceToastTimer.current = setTimeout(() => setMaintenanceToast(null), 4000)
    }
  }

  // ── Guard states ────────────────────────────────────────────────
  const shell = { minHeight: '100vh', background: BG, fontFamily: "'Poppins', sans-serif", color: WHITE }
  const spinnerSvg = (color) => (
    <svg style={{ animation: 'adminSpin 0.8s linear infinite', flexShrink: 0 }} width="24" height="24" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.5" strokeLinecap="round">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      <style>{`@keyframes adminSpin { to { transform: rotate(360deg); } }`}</style>
    </svg>
  )
  if (loading) return (
    <div style={shell}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 12 }}>
        {spinnerSvg('rgba(255,255,255,0.4)')}
        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.4)' }}>Loading…</span>
      </div>
    </div>
  )
  if (isAdmin === null) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#060E18' }}>
      <div style={{ color: '#fff', fontFamily: 'Poppins, sans-serif', fontSize: '1rem', opacity: 0.6 }}>
        Verifying access…
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
        {spinnerSvg(BLUE)}
        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: 'rgba(255,255,255,0.5)' }}>Fetching dashboard data…</span>
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

  const { overview, revenue_chart, signups_chart, feature_usage, funnel, never_converted,
          daily_spend, cache_hit_rate, top_active_users, failed_payments_today, signups_yesterday,
          revenue_today_ngn, paying_users_today, ngn_per_usd } = data
  // Direct Supabase revenue preferred; falls back to API aggregate
  const displayRevenueTodayNgn = rtMetrics?.revenue_today_ngn ?? revenue_today_ngn
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

  const TAB_ITEMS = [
    { id: 'overview',  label: 'Overview' },
    { id: 'users',     label: 'Users' },
    { id: 'payments',  label: 'Payments' },
    { id: 'vitals',    label: 'Vitals' },
    { id: 'logs',      label: 'Logs' },
  ]

  // Status thresholds (match vitals tab rendering below):
  //   HEALTHY  — latency < 3000ms, 0 failures
  //   DEGRADED — latency 3000–8000ms OR 1–5 failures  → badge shows 1
  //   DOWN     — latency > 8000ms OR 6+ failures       → badge shows 2
  const degradedVitals = displayVitals
    ? (() => {
        const avgMs             = displayVitals.avg_response_ms
        const failures          = displayVitals.failures_today ?? 0
        const hasRecentActivity = displayVitals.last_call_at
          ? (Date.now() - new Date(displayVitals.last_call_at).getTime()) < 30 * 60 * 1000
          : false
        if (!hasRecentActivity) return 0
        if ((avgMs !== null && avgMs > 8000) || failures >= 6) return 2
        if ((avgMs !== null && avgMs > 3000) || failures >= 1) return 1
        return 0
      })()
    : 0

  const unreadLogs = (systemLogs?.length ?? 0) + (sentryIssues?.length ?? 0)

  function switchTab(id) {
    if (id === 'overview') counterKeyRef.current += 1
    setActiveTab(id)
    // Immediately fetch the newly-active tab's data instead of waiting for next poll tick
    if (id === 'overview' || id === 'users') loadData()
    else if (id === 'vitals') { loadVitals(); loadAuthAttempts() }
    else if (id === 'payments') { loadPaymentIssues(); loadFeedbackSummary() }
    else if (id === 'logs') { loadSystemLogs(); loadFailures() }
  }

  const userInitials = (user?.email || 'AD').slice(0, 2).toUpperCase()

  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Poppins', sans-serif", color: WHITE }}>
      <style>{`
        @keyframes vitalPulse  { 0%,100%{transform:scale(1);opacity:1} 50%{transform:scale(1.3);opacity:0.6} }
        @keyframes adminSpin   { to{transform:rotate(360deg)} }
        @keyframes mcSlideUp   { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        @keyframes mcSlideRight{ from{opacity:0;transform:translateX(12px)} to{opacity:1;transform:translateX(0)} }
        @keyframes mcGrowUp    { from{transform:scaleY(0);opacity:0} to{transform:scaleY(1);opacity:1} }
        @keyframes mcFadeIn    { from{opacity:0} to{opacity:1} }
        @keyframes mcSkeleton  { 0%,100%{opacity:0.5} 50%{opacity:1} }
        .mc-card { background:rgba(15,34,53,0.7); border:1px solid rgba(255,255,255,0.08); border-radius:14px; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }
        .mc-card-enter   { animation:mcSlideUp 0.4s ease both; }
        .mc-tab-content  { animation:mcFadeIn 0.2s ease both; }
        .mc-skeleton     { background:rgba(255,255,255,0.06); border-radius:8px; animation:mcSkeleton 1.4s ease-in-out infinite; }
        .mc-bar          { transform-origin:bottom; animation:mcGrowUp 0.7s ease both; }
        .mc-feed-item    { animation:mcSlideRight 0.35s ease both; }
        .mc-topbar       { position:sticky; top:0; z-index:50; background:#0D1B2A; border-bottom:1px solid rgba(255,255,255,0.07); }
        .mc-tabs         { background:#060E18; border-bottom:1px solid rgba(255,255,255,0.07); }
        .mc-main         { padding:28px 28px 80px; max-width:1400px; margin:0 auto; }
        .mc-kpi-grid     { display:grid; grid-template-columns:repeat(4,1fr); gap:16px; }
        .mc-row2         { display:grid; grid-template-columns:1fr 340px; gap:16px; }
        .mc-vitals-grid  { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
        .mc-live-pulse   { width:7px; height:7px; border-radius:50%; background:#4ade80; animation:vitalPulse 1.4s ease-in-out infinite; flex-shrink:0; }
        .mc-section-divider { font-size:10px; font-weight:700; color:rgba(255,255,255,0.2); letter-spacing:1.5px; text-transform:uppercase; margin:24px 0 12px; display:flex; align-items:center; gap:8px; }
        .mc-section-divider::after { content:''; flex:1; height:1px; background:rgba(255,255,255,0.06); }
        .mc-action-btn   { font-family:'Poppins',sans-serif; font-size:11px; font-weight:600; border-radius:6px; padding:4px 10px; cursor:pointer; transition:all 0.15s; border:1px solid rgba(255,255,255,0.15); background:transparent; color:rgba(255,255,255,0.55); }
        .mc-action-btn:hover    { background:rgba(255,255,255,0.08); color:#fff; }
        .mc-action-btn:disabled { opacity:0.4; cursor:not-allowed; }
        .mc-desktop-tabs { display:flex; }
        .mc-mobile-tabs  { display:none; padding:12px 16px; }
        .mc-mobile-tab-select { width:100%; background:rgba(13,27,42,0.9); border:1px solid rgba(255,255,255,0.1); color:#fff; border-radius:10px; padding:10px 14px; font-size:13px; font-family:'Poppins',sans-serif; }
        @media(max-width:1100px){.mc-row2{grid-template-columns:1fr}}
        @media(max-width:900px) {.mc-kpi-grid{grid-template-columns:repeat(2,1fr)}.mc-vitals-grid{grid-template-columns:repeat(2,1fr)}}
        @media(max-width:700px) {.mc-vitals-grid{grid-template-columns:1fr}}
        @media(max-width:600px) {
          .mc-main{padding:16px 16px 80px}
          .mc-kpi-grid{grid-template-columns:1fr}
          .mc-topbar-date{display:none}
          .mc-topbar-center{display:none!important}
          .mc-topbar-utility{display:none!important}
          .mc-desktop-tabs{display:none!important}
          .mc-mobile-tabs{display:block!important}
        }
        @media(max-width:480px){
          .mc-main{padding:12px 12px 80px}
          .mc-topbar-inner{padding:0 12px!important}
        }
      `}</style>

      {/* ── Sticky top bar ── */}
      <div className="mc-topbar">
        <div className="mc-topbar-inner" style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0 24px', height:56, maxWidth:1400, margin:'0 auto' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10 }}>
            <div style={{ width:28, height:28, borderRadius:8, background:'linear-gradient(135deg,#0066FF,#3B82F6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700, color:'#fff' }}>F</span>
            </div>
            <span style={{ fontFamily:"'DM Serif Display',serif", fontSize:18, fontWeight:400, color:WHITE }}>FYPro</span>
            <span style={{ fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'1.5px', textTransform:'uppercase', marginLeft:2 }}>Admin</span>
          </div>
          <div className="mc-topbar-center" style={{ display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ display:'flex', alignItems:'center', gap:6, background:'rgba(22,163,74,0.12)', border:'1px solid rgba(22,163,74,0.25)', borderRadius:999, padding:'4px 10px' }}>
              <div className="mc-live-pulse" />
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700, color:'#4ade80', letterSpacing:'1.5px' }}>LIVE</span>
            </div>
            {secondsAgo !== null && (
              <span className="mc-topbar-date" style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'rgba(255,255,255,0.25)' }}>
                {secondsAgo === 0 ? 'just now' : secondsAgo < 60 ? `${secondsAgo}s ago` : `${Math.floor(secondsAgo / 60)}m ago`}
              </span>
            )}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <button onClick={handleRefresh} disabled={refreshing} style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, fontWeight:600, color:refreshing?MUTED:WHITE, background:refreshing?'rgba(255,255,255,0.05)':BLUE, border:'none', borderRadius:8, padding:'7px 16px', cursor:refreshing?'not-allowed':'pointer', transition:'background 0.15s' }}>
              {refreshing ? '…' : '↻ Refresh'}
            </button>
            <button className="mc-topbar-utility" onClick={handleTestAlerts} disabled={testAlertsBusy} style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, fontWeight:600, color:testAlertsBusy?MUTED:WHITE, background:testAlertsBusy?'rgba(255,255,255,0.05)':testAlertsResult?.all_ok===true?GREEN:testAlertsResult?.all_ok===false?RED:'rgba(255,255,255,0.08)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'7px 14px', cursor:testAlertsBusy?'not-allowed':'pointer' }}>
              {testAlertsBusy ? 'Sending…' : testAlertsResult ? testAlertsResult.all_ok ? `✓ ${testAlertsResult.sent}/10` : `⚠ ${testAlertsResult.failures} failed` : '🔔 Alerts'}
            </button>
            <button className="mc-topbar-utility" onClick={() => { import('@sentry/react').then(Sentry => { Sentry.captureException(new Error('Manual Sentry test from admin')) }).catch(() => {}) }} style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, fontWeight:600, color:WHITE, background:'rgba(124,58,237,0.2)', border:'1px solid rgba(124,58,237,0.3)', borderRadius:8, padding:'7px 12px', cursor:'pointer' }}>
              Sentry
            </button>
            <div style={{ width:32, height:32, borderRadius:'50%', background:'linear-gradient(135deg,#0066FF,#3B82F6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, fontWeight:700, color:WHITE }}>{userInitials}</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab nav ── */}
      <div className="mc-tabs">
        <div className="mc-desktop-tabs" style={{ maxWidth:1400, margin:'0 auto', padding:'0 24px' }}>
          {TAB_ITEMS.map(t => (
            <button key={t.id} onClick={() => switchTab(t.id)} style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, fontWeight:activeTab===t.id?600:400, color:activeTab===t.id?WHITE:'rgba(255,255,255,0.45)', background:'none', border:'none', padding:'14px 18px', cursor:'pointer', borderBottom:activeTab===t.id?`2px solid ${BLUE}`:'2px solid transparent', transition:'all 0.15s', display:'flex', alignItems:'center', gap:6 }}>
              {t.label}
              {t.id==='vitals' && degradedVitals>0 && (
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, fontWeight:700, color:WHITE, background:RED, borderRadius:999, padding:'1px 6px', lineHeight:'16px' }}>{degradedVitals}</span>
              )}
              {t.id==='logs' && unreadLogs>0 && (
                <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, fontWeight:700, color:WHITE, background:AMBER, borderRadius:999, padding:'1px 6px', lineHeight:'16px' }}>{unreadLogs}</span>
              )}
            </button>
          ))}
        </div>
        <div className="mc-mobile-tabs">
          <select className="mc-mobile-tab-select" value={activeTab} onChange={e => switchTab(e.target.value)}>
            {TAB_ITEMS.map(t => (
              <option key={t.id} value={t.id}>{t.label}{t.id==='vitals'&&degradedVitals>0?` (${degradedVitals})`:''}{t.id==='logs'&&unreadLogs>0?` (${unreadLogs})`:''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Test alerts result panel ── */}
      {testAlertsResult && (
        <div style={{ maxWidth:1400, margin:'12px auto 0', padding:'0 28px' }}>
          <div style={{ padding:'12px 16px', background:testAlertsResult.all_ok?'rgba(22,163,74,0.1)':'rgba(220,38,38,0.1)', border:`1px solid ${testAlertsResult.all_ok?'rgba(22,163,74,0.3)':'rgba(220,38,38,0.3)'}`, borderRadius:10 }}>
            {testAlertsResult.error ? (
              <p style={{ margin:0, fontSize:13, color:RED, fontFamily:"'Poppins',sans-serif" }}>Network error: {testAlertsResult.error}</p>
            ) : (
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px 16px' }}>
                {(testAlertsResult.results||[]).map(r => (
                  <span key={r.key} style={{ fontSize:12, fontFamily:"'JetBrains Mono',monospace", color:r.ok?'#4ade80':RED }}>{r.ok?'✓':'✗'} {r.key}</span>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Main tab content ── */}
      <div className="mc-main mc-tab-content" key={activeTab}>

        {/* ═══════════ OVERVIEW TAB ═══════════ */}
        {activeTab === 'overview' && (
          <>
            {/* KPI cards */}
            <div className="mc-kpi-grid" style={{ marginBottom:16 }}>
              <KpiCounterCard key={counterKeyRef.current + '-u'} label="Total Users" target={overview?.total_users||0} glow="#60A5FA" shadow="rgba(0,102,255,0.6)" delay={0} sub={`+${overview?.signups_today||0} today`} />
              <KpiCounterCard key={counterKeyRef.current + '-r'} label="Revenue (NGN)" target={overview?.total_revenue_ngn||0} prefix="₦" glow="#4ade80" shadow="rgba(22,163,74,0.5)" delay={0.05} sub={`${overview?.total_paid||0} paying users`} />
              <KpiCounterCard key={counterKeyRef.current + '-s'} label="AI Spend Today" target={daily_spend?.spent_usd||0} prefix="$" decimals={2} glow="#fbbf24" shadow="rgba(245,158,11,0.5)" delay={0.1} sub={`cap $${daily_spend?.cap_usd?.toFixed(2)||'10.00'}`} />
              <KpiCounterCard key={counterKeyRef.current + '-d'} label="Defense Simulator" target={funnel?.find(f=>f.step==='defense_simulator')?.count||0} glow={WHITE} shadow="none" delay={0.15} sub={`${overview?.conversion_rate||0}% converted`} />
            </div>

            {/* Signups chart + live feed */}
            <div className="mc-row2" style={{ marginBottom:16 }}>
              <div className="mc-card mc-card-enter" style={{ padding:'20px 22px', animationDelay:'0.2s' }}>
                <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:12 }}>Signups — Last 14 Days</div>
                <SignupsBarChart data={signups_chart} />
              </div>
              <div className="mc-card mc-card-enter" style={{ padding:'20px 22px', animationDelay:'0.25s' }}>
                <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:12 }}>Live Activity</div>
                <LiveFeed events={liveEvents} />
              </div>
            </div>

            {/* Revenue chart */}
            <div className="mc-section-divider">Revenue — 30 Day</div>
            <div className="mc-card mc-card-enter" style={{ padding:'20px 22px', animationDelay:'0.28s', marginBottom:16 }}>
              {!revenue_chart || revenue_chart.length === 0 ? (
                <div style={{ height:180, display:'flex', alignItems:'center', justifyContent:'center', color:MUTED, fontSize:12, fontFamily:"'Poppins',sans-serif" }}>No revenue data yet</div>
              ) : (
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={revenue_chart.map(d => ({ ...d, date: fmtChartDate(d.date) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fill:MUTED }} />
                    <YAxis tick={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fill:MUTED }} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
                    <Tooltip {...tooltipStyle} formatter={v => [`₦${Number(v).toLocaleString()}`, 'Revenue']} />
                    <Line type="monotone" dataKey="amount" stroke={GREEN} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Today's snapshot cards */}
            <div className="mc-section-divider">Today's Snapshot</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:16 }}>
              <SignupsCompareCard today={overview?.signups_today} yesterday={signups_yesterday} />
              <OverviewCard label="Revenue Today" value={displayRevenueTodayNgn != null ? `₦${Number(displayRevenueTodayNgn).toLocaleString()}` : '—'} sub={`${paying_users_today??0} payments today`} accent={GREEN} />
              <OverviewCard label="Failed Payments" value={failed_payments_today??0} sub="today" accent={failed_payments_today>0?RED:MUTED} />
              <SpendCard spend={daily_spend} />
            </div>

            {/* Unit economics */}
            <div className="mc-section-divider">Unit Economics</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:16 }}>
              <OverviewCard label="Avg Rev / User" value={overview?.total_users>0&&overview?.total_revenue_ngn>0?`₦${Math.round(overview.total_revenue_ngn/overview.total_users).toLocaleString()}`:'—'} sub="total lifetime" accent={BLUE} />
              <OverviewCard label="Conversion Rate" value={overview?.conversion_rate!=null?`${Number(overview.conversion_rate).toFixed(1)}%`:'—'} sub="free → paid" accent={GREEN} />
              <OverviewCard label="Cache Hit Rate" value={cache_hit_rate?.hit_rate_pct!=null?`${Number(cache_hit_rate.hit_rate_pct).toFixed(1)}%`:'—'} sub={`${cache_hit_rate?.hits_total||0} hits`} accent={AMBER} />
              {ngn_per_usd && <OverviewCard label="₦ / USD Rate" value={`₦${ngn_per_usd?.toLocaleString()}`} sub="configured rate" accent={MUTED} />}
            </div>

            {/* Feature usage */}
            {feature_usage && feature_usage.length > 0 && (
              <>
                <div className="mc-section-divider">Feature Usage</div>
                <div className="mc-card mc-card-enter" style={{ padding:'20px 22px', animationDelay:'0.35s', marginBottom:16 }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                    {feature_usage.slice(0,8).map(f => (
                      <div key={f.feature} style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, color:DIM, width:160, flexShrink:0 }}>{FEATURE_LABELS[f.feature]||f.feature}</div>
                        <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.06)', borderRadius:999 }}>
                          <div style={{ height:6, background:BLUE, borderRadius:999, width:`${Math.round((f.count/maxFeature)*100)}%`, transition:'width 0.5s ease' }} />
                        </div>
                        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:WHITE, width:40, textAlign:'right' }}>{f.count}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}

            {/* Funnel */}
            {funnel && funnel.length > 0 && (
              <>
                <div className="mc-section-divider">Completion Funnel</div>
                <div className="mc-card mc-card-enter" style={{ padding:'20px 22px', animationDelay:'0.4s', marginBottom:16 }}>
                  <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                    {funnel.map((f, fi) => {
                      const pct      = funnel[0]?.count>0 ? Math.round((f.count/funnel[0].count)*100) : 0
                      const prevCount = fi > 0 ? funnel[fi-1].count : null
                      const dropPct  = prevCount > 0 ? Math.round(((prevCount - f.count) / prevCount) * 100) : null
                      return (
                        <div key={f.step}>
                          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:4 }}>
                            <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, color:DIM, width:180, flexShrink:0 }}>{FUNNEL_LABELS[f.step]||f.step}</div>
                            <div style={{ flex:1, height:6, background:'rgba(255,255,255,0.06)', borderRadius:999 }}>
                              <div style={{ height:6, background:`linear-gradient(90deg,${BLUE},${GREEN})`, borderRadius:999, width:`${pct}%`, transition:'width 0.5s ease' }} />
                            </div>
                            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:WHITE, width:50, textAlign:'right' }}>{f.count}</div>
                            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:MUTED, width:38, textAlign:'right' }}>{pct}%</div>
                          </div>
                          {dropPct !== null && dropPct > 0 && (
                            <div style={{ paddingLeft:190, fontFamily:"'JetBrains Mono',monospace", fontSize:9, color:dropPct>50?RED:dropPct>25?AMBER:MUTED }}>
                              ↓ {dropPct}% drop from previous
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              </>
            )}

            {/* System controls */}
            <div className="mc-section-divider">System Controls</div>
            <div className="mc-card mc-card-enter" style={{ padding:'20px 24px', animationDelay:'0.45s', marginBottom:16 }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:12, marginBottom:18 }}>
                <div>
                  <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, color:MUTED, textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:6 }}>Maintenance Mode</div>
                  <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                    <div style={{ width:10, height:10, borderRadius:'50%', flexShrink:0, background:maintenanceLoading?MUTED:maintenanceMode?AMBER:GREEN, animation:!maintenanceLoading&&maintenanceMode?'vitalPulse 1.5s ease-in-out infinite':'none' }} />
                    <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:14, fontWeight:700, color:maintenanceLoading?MUTED:maintenanceMode?AMBER:GREEN }}>
                      {maintenanceLoading?'…':maintenanceMode?'MAINTENANCE':'LIVE'}
                    </span>
                    {maintenanceUpdatedAt && <span style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, color:MUTED }}>· Updated {timeAgo(maintenanceUpdatedAt)}</span>}
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:DIM }}>Toggle</span>
                  <button onClick={handleToggleMaintenance} disabled={maintenanceBusy||maintenanceLoading} aria-label={maintenanceMode?'Disable maintenance mode':'Enable maintenance mode'} style={{ width:48, height:26, borderRadius:13, border:'none', background:maintenanceMode?AMBER:'rgba(255,255,255,0.12)', cursor:maintenanceBusy||maintenanceLoading?'not-allowed':'pointer', position:'relative', transition:'background 0.2s ease', opacity:maintenanceBusy?0.6:1, flexShrink:0 }}>
                    <div style={{ width:20, height:20, borderRadius:'50%', background:WHITE, position:'absolute', top:3, left:maintenanceMode?25:3, transition:'left 0.2s ease', boxShadow:'0 1px 4px rgba(0,0,0,0.3)' }} />
                  </button>
                </div>
              </div>
              <div style={{ display:'flex', gap:8 }}>
                <input value={maintenanceMessage} onChange={e => setMaintenanceMessage(e.target.value)} placeholder="Maintenance message shown to users…" style={{ flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'8px 12px', color:WHITE, fontFamily:"'Poppins',sans-serif", fontSize:13 }} />
                <button onClick={handleSaveMaintenanceMessage} disabled={maintenanceBusy} style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, fontWeight:600, color:WHITE, background:BLUE, border:'none', borderRadius:8, padding:'8px 16px', cursor:maintenanceBusy?'not-allowed':'pointer', flexShrink:0 }}>Save</button>
              </div>
              {maintenanceToast && (
                <div style={{ marginTop:10, fontFamily:"'Poppins',sans-serif", fontSize:12, color:maintenanceToast.type==='success'?'#4ade80':RED }}>{maintenanceToast.message}</div>
              )}
            </div>
          </>
        )}

        {/* ═══════════ USERS TAB ═══════════ */}
        {activeTab === 'users' && (
          <>
            {userActionToast && (
              <div style={{ marginBottom:16, padding:'10px 16px', background:userActionToast.type==='success'?'rgba(22,163,74,0.1)':'rgba(220,38,38,0.1)', border:`1px solid ${userActionToast.type==='success'?'rgba(22,163,74,0.3)':'rgba(220,38,38,0.3)'}`, borderRadius:10, fontFamily:"'Poppins',sans-serif", fontSize:13, color:userActionToast.type==='success'?'#4ade80':RED }}>
                {userActionToast.message}
              </div>
            )}

            <div style={{ marginBottom:16 }}>
              <input value={search} onChange={e => { setSearch(e.target.value); setPage(0) }} placeholder="Search users by email…" style={{ width:'100%', maxWidth:400, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'10px 14px', color:WHITE, fontFamily:"'Poppins',sans-serif", fontSize:13, boxSizing:'border-box' }} />
            </div>

            <div className="mc-card mc-card-enter" style={{ padding:0, marginBottom:20, overflow:'hidden', animationDelay:'0.05s' }}>
              {!data ? (
                <div style={{ padding:24, display:'flex', flexDirection:'column', gap:10 }}>
                  {[...Array(5)].map((_,i) => <div key={i} className="mc-skeleton" style={{ height:40, animationDelay:`${i*0.1}s` }} />)}
                </div>
              ) : data.users.length === 0 ? (
                <div style={{ padding:48, textAlign:'center', color:MUTED, fontFamily:"'Poppins',sans-serif", fontSize:14 }}>No users yet</div>
              ) : (
                <div style={{ overflowX:'auto' }}>
                  <table style={{ borderCollapse:'collapse', width:'100%' }}>
                    <thead>
                      <tr>
                        <Th sortKey="email"       active={sortKey==='email'}       dir={sortDir} onSort={handleSort}>Email</Th>
                        <Th sortKey="plan"        active={sortKey==='plan'}        dir={sortDir} onSort={handleSort}>Plan</Th>
                        <Th sortKey="status"      active={sortKey==='status'}      dir={sortDir} onSort={handleSort}>Status</Th>
                        <Th sortKey="signup_date" active={sortKey==='signup_date'} dir={sortDir} onSort={handleSort}>Signed Up</Th>
                        <Th sortKey="last_active" active={sortKey==='last_active'} dir={sortDir} onSort={handleSort}>Last Active</Th>
                        <th style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, fontWeight:600, color:MUTED, textTransform:'uppercase', letterSpacing:'0.06em', padding:'10px 12px', textAlign:'left', background:SURFACE, whiteSpace:'nowrap' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((u, i) => {
                        const busy = actionState[u.id] === 'pending'
                        return (
                          <tr key={u.id} style={{ background:i%2===0?'transparent':'rgba(255,255,255,0.015)' }}>
                            <td style={{ ...td, color:WHITE, fontWeight:500, maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{u.email}</td>
                            <td style={td}><PlanBadge plan={u.plan} /></td>
                            <td style={td}><StatusBadge status={u.status} /></td>
                            <td style={td}>{fmtDate(u.signup_date)}</td>
                            <td style={td}>{fmtDate(u.last_active)}</td>
                            <td style={{ ...td, whiteSpace:'nowrap' }}>
                              <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
                                {u.status === 'banned'
                                  ? <button className="mc-action-btn" disabled={busy} onClick={() => handleUnbanUser(u.id, u.email)} style={{ color:'rgba(251,191,36,0.8)', borderColor:'rgba(245,158,11,0.3)' }}>{busy?'…':'Unban'}</button>
                                  : <button className="mc-action-btn" disabled={busy} onClick={() => handleBanUser(u.id, u.email)}>{busy?'…':'Ban'}</button>
                                }
                                <button className="mc-action-btn" disabled={busy} onClick={() => handleDeleteUser(u.id, u.email)} style={{ color:'rgba(248,113,113,0.7)', borderColor:'rgba(220,38,38,0.2)' }}>{busy?'…':'Del'}</button>
                                <button className="mc-action-btn" disabled={busy} onClick={() => handleGrantPlan(u.id, u.email, 'student')}>+Stu</button>
                                <button className="mc-action-btn" disabled={busy} onClick={() => handleGrantPlan(u.id, u.email, 'defense')}>+Def</button>
                                <button className="mc-action-btn" disabled={busy} onClick={() => handleResetUsage(u.id, u.email)}>Reset</button>
                                <button className="mc-action-btn" disabled={busy} onClick={() => handleResetRunCounts(u.id, u.email)}>Runs</button>
                                <button className="mc-action-btn" disabled={diagnoseBusy[u.id]} onClick={() => handleDiagnose(u.id, u.email)}>{diagnoseBusy[u.id]?'…':'Diag'}</button>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:24 }}>
              {totalPages > 1 && (
                <button className="mc-action-btn" disabled={page===0} onClick={() => setPage(p => p-1)}>← Prev</button>
              )}
              <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:MUTED, flex:1 }}>
                {filteredUsers.length === 0
                  ? 'No users match'
                  : `Showing ${page * PAGE_SIZE + 1}–${Math.min((page+1)*PAGE_SIZE, filteredUsers.length)} of ${filteredUsers.length} user${filteredUsers.length !== 1 ? 's' : ''}`}
              </span>
              {totalPages > 1 && (
                <button className="mc-action-btn" disabled={page>=totalPages-1} onClick={() => setPage(p => p+1)}>Next →</button>
              )}
            </div>

            {top_active_users && top_active_users.length > 0 && (
              <>
                <div className="mc-section-divider">Most Active Users</div>
                <div className="mc-card mc-card-enter" style={{ padding:0, marginBottom:20, overflow:'hidden', animationDelay:'0.15s' }}>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ borderCollapse:'collapse', width:'100%' }}>
                      <thead>
                        <tr>
                          {['Email','Total Runs','Top Feature'].map(h => (
                            <th key={h} style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, fontWeight:600, color:MUTED, textTransform:'uppercase', letterSpacing:'0.06em', padding:'10px 12px', textAlign:'left', background:SURFACE }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {top_active_users.map((u,i) => (
                          <tr key={u.email||i} style={{ background:i%2===0?'transparent':'rgba(255,255,255,0.015)' }}>
                            <td style={{ ...td, color:WHITE, fontWeight:500 }}>{u.email}</td>
                            <td style={tdMono}>{u.total_runs}</td>
                            <td style={td}>{u.top_feature || '—'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}

            {never_converted && (
              <>
                <div className="mc-section-divider">Never Converted ({never_converted.length})</div>
                <div className="mc-card mc-card-enter" style={{ padding:0, overflow:'hidden', animationDelay:'0.2s' }}>
                  <div style={{ padding:'12px 20px', fontFamily:"'Poppins',sans-serif", fontSize:12, color:MUTED }}>Signed up 3+ days ago · Free plan · Has at least one project.</div>
                  <div style={{ overflowX:'auto' }}>
                    <table style={{ borderCollapse:'collapse', width:'100%' }}>
                      <thead>
                        <tr>
                          {['Email','Signed Up','Last Active','Steps Used'].map(h => (
                            <th key={h} style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, fontWeight:600, color:MUTED, textTransform:'uppercase', letterSpacing:'0.06em', padding:'10px 12px', textAlign:'left', background:SURFACE }}>{h}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {never_converted.length===0 ? (
                          <tr><td colSpan={4} style={{ ...td, textAlign:'center', color:MUTED }}>No users match this criteria yet.</td></tr>
                        ) : never_converted.map((u,i) => (
                          <tr key={u.id} style={{ background:i%2===0?'transparent':'rgba(255,255,255,0.015)' }}>
                            <td style={{ ...td, color:WHITE, fontWeight:500 }}>{u.email}</td>
                            <td style={td}>{fmtDate(u.signup_date)}</td>
                            <td style={td}>{fmtDate(u.last_active)}</td>
                            <td style={tdMono}>{u.steps_completed} / 11</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </>
        )}

        {/* ═══════════ PAYMENTS TAB ═══════════ */}
        {activeTab === 'payments' && (
          <>
            {/* Revenue snapshot */}
            <div className="mc-section-divider">Revenue Overview</div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:12, marginBottom:16 }}>
              <OverviewCard label="Total Revenue" value={`₦${Number(overview?.total_revenue_ngn||0).toLocaleString()}`} sub={`${overview?.total_paid||0} paying users`} accent={GREEN} />
              <OverviewCard label="Revenue Today" value={displayRevenueTodayNgn != null ? `₦${Number(displayRevenueTodayNgn).toLocaleString()}` : '₦0'} sub={`${paying_users_today??0} payments`} accent={GREEN} />
              <OverviewCard label="Failed Payments" value={failed_payments_today??0} sub="today" accent={(failed_payments_today??0)>0?RED:MUTED} />
              <SpendCard spend={daily_spend} />
            </div>
            {revenue_chart && revenue_chart.length > 0 && (
              <div className="mc-card mc-card-enter" style={{ padding:'20px 22px', animationDelay:'0.1s', marginBottom:20 }}>
                <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:10, fontWeight:700, color:'rgba(255,255,255,0.35)', letterSpacing:'1px', textTransform:'uppercase', marginBottom:12 }}>Revenue — Last 30 Days</div>
                <ResponsiveContainer width="100%" height={160}>
                  <LineChart data={revenue_chart.map(d => ({ ...d, date: fmtChartDate(d.date) }))}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                    <XAxis dataKey="date" tick={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fill:MUTED }} />
                    <YAxis tick={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fill:MUTED }} tickFormatter={v => `₦${(v/1000).toFixed(0)}k`} />
                    <Tooltip {...tooltipStyle} formatter={v => [`₦${Number(v).toLocaleString()}`, 'Revenue']} />
                    <Line type="monotone" dataKey="amount" stroke={GREEN} strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}

            <div className="mc-section-divider">Payment Issues</div>
            {paymentIssuesLoading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
                {[...Array(3)].map((_,i) => <div key={i} className="mc-skeleton" style={{ height:60, animationDelay:`${i*0.1}s` }} />)}
              </div>
            ) : paymentIssuesError ? (
              <div className="mc-card" style={{ padding:'16px 20px', borderLeft:`3px solid ${RED}`, marginBottom:20 }}>
                <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:RED, marginBottom:8 }}>{paymentIssuesError}</div>
                <button className="mc-action-btn" onClick={loadPaymentIssues}>Retry</button>
              </div>
            ) : !paymentIssues || paymentIssues.length === 0 ? (
              <div className="mc-card mc-card-enter" style={{ padding:'32px 24px', textAlign:'center', marginBottom:20, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                <div style={{ fontSize:28 }}>✓</div>
                <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:14, color:MUTED }}>No payment issues reported</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
                {paymentIssues.map(issue => (
                  <div key={issue.id} className="mc-card mc-card-enter" style={{ padding:'16px 20px', borderLeft:`3px solid ${AMBER}` }}>
                    <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                      <div>
                        <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:WHITE, fontWeight:500, marginBottom:4 }}>{issue.user_email}</div>
                        <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, color:MUTED }}>{issue.description || issue.transaction_ref}</div>
                        <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:'rgba(255,255,255,0.2)', marginTop:4 }}>{timeAgo(issue.created_at)}</div>
                      </div>
                      <button className="mc-action-btn" disabled={resolvingIssueId===issue.id} onClick={() => handleResolvePaymentIssue(issue.id)} style={{ color:'#4ade80', borderColor:'rgba(22,163,74,0.3)', flexShrink:0 }}>
                        {resolvingIssueId===issue.id?'…':'Resolve'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mc-section-divider">Feature Feedback</div>
            <FeatureFeedbackWidget data={feedbackData} loading={feedbackLoading} error={feedbackError} />
          </>
        )}

        {/* ═══════════ VITALS TAB ═══════════ */}
        {activeTab === 'vitals' && (
          <>
            <div className="mc-section-divider">System Health</div>
            {(vitalsLoading && rtMetricsLoading) ? (
              <div className="mc-vitals-grid" style={{ marginBottom:20 }}>
                {[...Array(6)].map((_,i) => <div key={i} className="mc-skeleton" style={{ height:80, animationDelay:`${i*0.08}s` }} />)}
              </div>
            ) : vitalsError && !displayVitals ? (
              <div className="mc-card" style={{ padding:'16px 20px', borderLeft:`3px solid ${RED}`, marginBottom:20 }}>
                <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:RED, marginBottom:8 }}>{vitalsError}</div>
                <button className="mc-action-btn" onClick={loadVitals}>Retry</button>
              </div>
            ) : displayVitals ? (
              <div className="mc-vitals-grid mc-card-enter" style={{ animationDelay:'0.05s', marginBottom:20 }}>
                {(() => {
                  const avgMs             = displayVitals.avg_response_ms
                  const hasActivity       = (displayVitals.requests_today ?? 0) > 0
                  const failures          = displayVitals.failures_today ?? 0
                  const hasRecentActivity = displayVitals.last_call_at
                    ? (Date.now() - new Date(displayVitals.last_call_at).getTime()) < 30 * 60 * 1000
                    : false
                  const lastCallRecent = displayVitals.last_call_at
                    ? (Date.now() - new Date(displayVitals.last_call_at).getTime()) < 5 * 60 * 1000
                    : false

                  // Latency color: only meaningful if there are recent calls
                  const latColor = avgMs === null
                    ? MUTED
                    : avgMs <= 3000 ? GREEN : avgMs <= 8000 ? AMBER : RED

                  // Status rules:
                  //   HEALTHY           — latency < 3000ms, 0 failures
                  //   DEGRADED          — latency 3000–8000ms OR 1–5 failures
                  //   DOWN              — latency > 8000ms OR 6+ failures
                  //   No Recent Activity— no call in last 30 minutes (but has historical data)
                  //   No Data           — never had any calls today
                  const statusResult = (() => {
                    if (!hasActivity && !hasRecentActivity) return { label: 'No Data', color: MUTED, pulse: false }
                    if (!hasRecentActivity) return { label: 'No Recent Activity', color: MUTED, pulse: false }
                    if ((avgMs !== null && avgMs > 8000) || failures >= 6) return { label: 'Down', color: RED, pulse: false }
                    if ((avgMs !== null && avgMs > 3000) || failures >= 1) return { label: 'Degraded', color: AMBER, pulse: false }
                    return { label: 'Healthy', color: GREEN, pulse: true }
                  })()

                  return (
                    <>
                      <VitalCard
                        label="API Latency"
                        value={avgMs !== null ? `${Math.round(avgMs).toLocaleString()} ms` : '—'}
                        dotColor={latColor}
                        pulse={avgMs !== null && avgMs <= 3000}
                      />
                      <VitalCard
                        label="Last API Call"
                        value={displayVitals.last_call_at ? timeAgo(displayVitals.last_call_at) : 'No calls today'}
                        dotColor={!hasActivity ? MUTED : lastCallRecent ? GREEN : AMBER}
                        pulse={lastCallRecent}
                      />
                      <VitalCard
                        label="Failures Today"
                        value={failures}
                        dotColor={failures === 0 ? GREEN : failures < 6 ? AMBER : RED}
                        pulse={failures === 0}
                      />
                      <VitalCard
                        label="Requests Today"
                        value={(displayVitals.requests_today ?? 0).toLocaleString()}
                        dotColor={BLUE}
                        pulse={false}
                      />
                      <VitalCard
                        label="Active Sessions"
                        value={displayVitals.active_sessions ?? 0}
                        dotColor={(displayVitals.active_sessions ?? 0) > 0 ? GREEN : MUTED}
                        pulse={(displayVitals.active_sessions ?? 0) > 0}
                      />
                      <VitalCard
                        label="Overall Status"
                        value={statusResult.label}
                        dotColor={statusResult.color}
                        pulse={statusResult.pulse}
                      />
                    </>
                  )
                })()}
              </div>
            ) : null}

            <div className="mc-section-divider">Auth Attempts</div>
            {authAttemptsLoading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                {[...Array(3)].map((_,i) => <div key={i} className="mc-skeleton" style={{ height:48, animationDelay:`${i*0.1}s` }} />)}
              </div>
            ) : authAttemptsError ? (
              <div className="mc-card" style={{ padding:'16px 20px', borderLeft:`3px solid ${RED}` }}>
                <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:RED, marginBottom:8 }}>{authAttemptsError}</div>
                <button className="mc-action-btn" onClick={loadAuthAttempts}>Retry</button>
              </div>
            ) : !authAttempts || !authAttempts.attempts?.length ? (
              <div className="mc-card" style={{ padding:'20px 24px' }}>
                <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:MUTED }}>No recent auth attempts</div>
              </div>
            ) : (
              <div className="mc-card mc-card-enter" style={{ padding:0, overflow:'hidden', animationDelay:'0.1s' }}>
                <div style={{ overflowX:'auto' }}>
                  <table style={{ borderCollapse:'collapse', width:'100%' }}>
                    <thead>
                      <tr>
                        {['Email','Type','Status','IP','Time'].map(h => (
                          <th key={h} style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, fontWeight:600, color:MUTED, textTransform:'uppercase', letterSpacing:'0.06em', padding:'10px 12px', textAlign:'left', background:SURFACE }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(authAttempts.attempts || []).slice(0,50).map((a,i) => (
                        <tr key={a.id||i} style={{ background:i%2===0?'transparent':'rgba(255,255,255,0.015)' }}>
                          <td style={{ ...td, color:WHITE }}>{a.email}</td>
                          <td style={tdMono}>{a.action}</td>
                          <td style={td}>
                            <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700, color:a.success?'#4ade80':RED, background:a.success?'rgba(22,163,74,0.12)':'rgba(220,38,38,0.12)', border:`1px solid ${a.success?'rgba(22,163,74,0.3)':'rgba(220,38,38,0.3)'}`, borderRadius:999, padding:'2px 8px' }}>
                              {a.success?'OK':'FAIL'}
                            </span>
                          </td>
                          <td style={tdMono}>{a.ip||'—'}</td>
                          <td style={td}>{timeAgo(a.created_at)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}

        {/* ═══════════ LOGS TAB ═══════════ */}
        {activeTab === 'logs' && (
          <>
            <div className="mc-section-divider">System Logs</div>
            {systemLogsLoading ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
                {[...Array(4)].map((_,i) => <div key={i} className="mc-skeleton" style={{ height:56, animationDelay:`${i*0.1}s` }} />)}
              </div>
            ) : systemLogsError ? (
              <div className="mc-card" style={{ padding:'16px 20px', borderLeft:`3px solid ${RED}`, marginBottom:20 }}>
                <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:RED, marginBottom:8 }}>{systemLogsError}</div>
                <button className="mc-action-btn" onClick={loadSystemLogs}>Retry</button>
              </div>
            ) : !systemLogs || systemLogs.length === 0 ? (
              <div className="mc-card mc-card-enter" style={{ padding:'32px 24px', textAlign:'center', marginBottom:20 }}>
                <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:14, color:MUTED }}>No system logs</div>
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
                {systemLogs.map((log, i) => {
                  const isExpanded = expandedLogIds.has(log.id)
                  const sev = log.severity || 'info'
                  const levelColor = sev==='error'?RED:sev==='warning'?AMBER:BLUE
                  return (
                    <div key={log.id} className="mc-card mc-card-enter" style={{ padding:'14px 18px', borderLeft:`3px solid ${levelColor}`, animationDelay:`${i*0.04}s` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:4 }}>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700, color:WHITE, background:`${levelColor}33`, border:`1px solid ${levelColor}55`, borderRadius:999, padding:'2px 8px', textTransform:'uppercase' }}>{sev}</span>
                        <span style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, color:DIM, flex:1 }}>{log.plain_message}</span>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:MUTED }}>{timeAgo(log.created_at)}</span>
                        <button className="mc-action-btn" disabled={resolvingLogId===log.id} onClick={() => handleResolveLog(log.id)} style={{ color:'#4ade80', borderColor:'rgba(22,163,74,0.3)' }}>
                          {resolvingLogId===log.id?'…':'Resolve'}
                        </button>
                        {log.raw_detail && (
                          <button className="mc-action-btn" onClick={() => toggleLogExpanded(log.id)}>{isExpanded?'Hide':'Detail'}</button>
                        )}
                      </div>
                      {isExpanded && log.raw_detail && (
                        <pre style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:11, color:DIM, background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:8, padding:16, marginTop:10, overflowX:'auto', whiteSpace:'pre-wrap', wordBreak:'break-all' }}>
                          {JSON.stringify(log.raw_detail, null, 2)}
                        </pre>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {!systemLogsLoading && sentryIssues.length > 0 && (
              <>
                <div className="mc-section-divider" style={{ marginTop:8 }}>
                  Sentry Issues
                  <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:9, fontWeight:700, color:WHITE, background:RED, borderRadius:999, padding:'1px 7px' }}>{sentryIssues.length}</span>
                  <button onClick={handleResolveAllSentryIssues} disabled={resolvingAllSentry} style={{ marginLeft:'auto', fontFamily:"'Poppins',sans-serif", fontSize:11, fontWeight:600, color:WHITE, background:resolvingAllSentry?'rgba(22,163,74,0.4)':GREEN, border:'none', borderRadius:8, padding:'4px 14px', cursor:resolvingAllSentry?'not-allowed':'pointer' }}>
                    {resolvingAllSentry?'Resolving…':'Resolve All'}
                  </button>
                </div>
                {sentryResolveError && <p style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, color:RED, margin:'0 0 12px 0' }}>Failed: {sentryResolveError}</p>}
                <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:20 }}>
                  {sentryIssues.map(issue => {
                    const lc = issue.level==='error'?RED:issue.level==='warning'?AMBER:BLUE
                    return (
                      <div key={issue.id} className="mc-card mc-card-enter" style={{ padding:'14px 18px', borderLeft:`3px solid ${lc}` }}>
                        <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap', marginBottom:6 }}>
                          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700, color:WHITE, background:`${lc}33`, border:`1px solid ${lc}55`, borderRadius:999, padding:'2px 8px', textTransform:'uppercase' }}>{issue.level}</span>
                          <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:600, color:MUTED }}>×{issue.count}</span>
                          <span style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, color:MUTED, marginLeft:'auto' }}>{timeAgo(issue.last_seen)}</span>
                          <a href={issue.permalink} target="_blank" rel="noreferrer" style={{ fontFamily:"'Poppins',sans-serif", fontSize:11, fontWeight:600, color:WHITE, background:'rgba(255,255,255,0.08)', border:`1px solid ${BORDER}`, borderRadius:6, padding:'4px 12px', textDecoration:'none', flexShrink:0 }}>View ↗</a>
                        </div>
                        <p style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:DIM, margin:0 }}>{issue.title}</p>
                      </div>
                    )
                  })}
                </div>
              </>
            )}

            {!failuresLoading && failures?.rows && failures.rows.some(r => !r.resolved) && (
              <>
                <div className="mc-section-divider">Failed Generations</div>
                <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                  {failures.rows.filter(r => !r.resolved).map((r, i) => (
                    <div key={r.id} className="mc-card mc-card-enter" style={{ padding:'14px 18px', borderLeft:`3px solid ${RED}`, animationDelay:`${i*0.04}s` }}>
                      <div style={{ display:'flex', alignItems:'center', gap:10, flexWrap:'wrap' }}>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, fontWeight:700, color:RED }}>{r.feature}</span>
                        <span style={{ fontFamily:"'Poppins',sans-serif", fontSize:12, color:DIM, flex:1 }}>{r.error_message||'Unknown error'}</span>
                        <span style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:10, color:MUTED }}>{timeAgo(r.created_at)}</span>
                        <button className="mc-action-btn" disabled={resolvingId===r.id} onClick={() => handleResolveFailure(r.id)} style={{ color:'#4ade80', borderColor:'rgba(22,163,74,0.3)' }}>
                          {resolvingId===r.id?'…':'Resolve'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

      </div>

      {/* ── Confirm modal ── */}
      {confirmModal && (
        <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.82)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={() => setConfirmModal(null)}>
          <div style={{ background:SURFACE, border:`1px solid ${confirmModal.danger?'rgba(220,38,38,0.4)':BORDER}`, borderRadius:16, padding:28, maxWidth:400, width:'100%' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, fontWeight:400, color:WHITE, marginBottom:10 }}>{confirmModal.title}</div>
            <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:DIM, marginBottom:24, lineHeight:1.6 }}>{confirmModal.body}</div>
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button className="mc-action-btn" onClick={() => setConfirmModal(null)} style={{ padding:'8px 20px', fontSize:13 }}>Cancel</button>
              <button
                onClick={() => { confirmModal.onConfirm(); setConfirmModal(null) }}
                style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, fontWeight:600, color:WHITE, background:confirmModal.danger?RED:BLUE, border:'none', borderRadius:8, padding:'8px 22px', cursor:'pointer' }}
              >
                {confirmModal.danger ? 'Yes, proceed' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Diagnose modal ── */}
      {diagnoseModal && (
        <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.75)', display:'flex', alignItems:'center', justifyContent:'center', padding:24 }} onClick={() => setDiagnoseModal(null)}>
          <div style={{ background:SURFACE, border:`1px solid ${BORDER}`, borderRadius:16, padding:28, maxWidth:480, width:'100%', maxHeight:'80vh', overflowY:'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontFamily:"'DM Serif Display',serif", fontSize:20, fontWeight:400, color:WHITE, marginBottom:8 }}>User Diagnosis</div>
            <div style={{ fontFamily:"'JetBrains Mono',monospace", fontSize:12, color:MUTED, marginBottom:20 }}>{diagnoseModal.email}</div>
            {diagnoseModal.loading ? (
              <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                <svg style={{ animation:'adminSpin 0.8s linear infinite' }} width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2.5" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                <span style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:MUTED }}>Diagnosing…</span>
              </div>
            ) : diagnoseModal.error ? (
              <div style={{ fontFamily:"'Poppins',sans-serif", fontSize:13, color:RED }}>{diagnoseModal.error}</div>
            ) : diagnoseModal.result ? (
              <DiagnoseResult result={diagnoseModal.result} />
            ) : null}
            <button onClick={() => setDiagnoseModal(null)} className="mc-action-btn" style={{ marginTop:20 }}>Close</button>
          </div>
        </div>
      )}

    </div>
  )
}

export default memo(AdminHealth)
