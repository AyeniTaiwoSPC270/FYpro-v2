// src/pages/admin/widgets/RatingsWidget.jsx

const BG     = '#060E18'
const CARD   = '#0F2235'
const BORDER = 'rgba(255,255,255,0.08)'
const WHITE  = '#FFFFFF'
const DIM    = 'rgba(255,255,255,0.7)'
const MUTED  = 'rgba(255,255,255,0.4)'
const BLUE   = '#0066FF'
const GREEN  = '#16A34A'
const AMBER  = '#F59E0B'
const RED    = '#DC2626'

function timeAgo(iso) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(ms / 60000)
  if (m < 60)  return `${m}m ago`
  const h  = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function starStr(n) {
  const v = Math.round(n || 0)
  return '★'.repeat(v) + '☆'.repeat(5 - v)
}

function barColor(star) {
  if (star >= 4) return GREEN
  if (star >= 3) return AMBER
  return RED
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`,
      borderRadius: 12, padding: 16, flex: '1 1 0', minWidth: 0,
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9, fontWeight: 600,
        color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 26, fontWeight: 600, color: WHITE, lineHeight: 1, marginBottom: 4,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: MUTED }}>{sub}</div>}
    </div>
  )
}

export default function RatingsWidget({ stats, recent, loading, error }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ height: 48, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)',
        borderRadius: 10, padding: '12px 16px', marginTop: 24,
        fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#F87171',
      }}>
        Ratings — {error}
      </div>
    )
  }

  if (!stats) return null

  const dist = stats.distribution || {}
  const maxDist = Math.max(...Object.values(dist), 1)

  const ds = stats.by_trigger?.defense_simulator
  const sm = stats.by_trigger?.steps_milestone

  return (
    <div style={{ marginTop: 24 }}>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatCard
          label="Avg Rating"
          value={stats.avg_stars?.toFixed(1) || '—'}
          sub={stats.avg_stars ? `${starStr(stats.avg_stars)} out of 5` : 'No ratings yet'}
        />
        <StatCard label="Total Ratings"   value={stats.total || 0}             sub="all time" />
        <StatCard
          label="With Suggestions"
          value={stats.with_suggestions || 0}
          sub={stats.total ? `${Math.round(((stats.with_suggestions||0)/stats.total)*100)}% response rate` : ''}
        />
        <StatCard label="This Week"       value={stats.this_week || 0}         sub="last 7 days" />
      </div>

      {/* Breakdown row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>

        {/* Star distribution */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: MUTED,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12,
          }}>Star Distribution</div>
          {[5,4,3,2,1].map(star => (
            <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, color: MUTED, width: 14, textAlign: 'right',
              }}>{star}</span>
              <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 999 }}>
                <div style={{
                  height: 5, borderRadius: 999,
                  width: `${((dist[String(star)] || 0) / maxDist) * 100}%`,
                  background: barColor(star),
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, color: MUTED, width: 20,
              }}>{dist[String(star)] || 0}</span>
            </div>
          ))}
        </div>

        {/* By trigger */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: MUTED,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12,
          }}>By Trigger</div>
          {[
            { emoji: '🎓', label: 'Defense Simulator', data: ds },
            { emoji: '📋', label: 'Steps Milestone',   data: sm },
          ].map(({ emoji, label, data }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: '10px 12px', marginBottom: 8,
            }}>
              <span>{emoji}</span>
              <span style={{ fontSize: 12, color: DIM, flex: 1 }}>{label}</span>
              {data ? (
                <>
                  <span style={{ color: AMBER, fontSize: 11 }}>★ {data.avg}</span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10, color: MUTED, marginLeft: 6,
                  }}>{data.count}</span>
                </>
              ) : (
                <span style={{ fontSize: 11, color: MUTED }}>—</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent submissions */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: `1px solid ${BORDER}`,
        }}>
          <span style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 15, color: WHITE,
          }}>Recent Submissions</span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: MUTED,
            background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.08)`,
            borderRadius: 999, padding: '2px 10px',
          }}>last 20</span>
        </div>

        {(!recent || recent.length === 0) ? (
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED, padding: '16px 18px', margin: 0 }}>
            No ratings yet.
          </p>
        ) : recent.map((row, i) => {
          const initials = (row.user_email || '—').slice(0, 2).toUpperCase()
          return (
            <div key={row.id || i} style={{ padding: '14px 18px', borderBottom: i < recent.length - 1 ? `1px solid rgba(255,255,255,0.04)` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0066FF 0%, #3B82F6 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: WHITE, flexShrink: 0,
                }}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: WHITE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.user_email || '—'}
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: BLUE,
                      background: 'rgba(0,102,255,0.1)', border: '1px solid rgba(0,102,255,0.2)',
                      borderRadius: 4, padding: '2px 6px', marginLeft: 8,
                    }}>{row.trigger_type}</span>
                  </div>
                  <div style={{ fontSize: 10, color: MUTED }}>{timeAgo(row.created_at)}</div>
                </div>
                <div style={{ color: AMBER, fontSize: 13, flexShrink: 0 }}>
                  {'★'.repeat(row.stars)}{'☆'.repeat(5 - row.stars)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  { label: 'Feature request', text: row.suggestion_feature },
                  { label: 'UI feedback',     text: row.suggestion_ui },
                ].map(({ label, text }) => (
                  <div key={label} style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: 7,
                    padding: '8px 10px', borderLeft: `2px solid rgba(255,255,255,0.08)`,
                  }}>
                    <div style={{
                      fontSize: 9, fontWeight: 600, color: MUTED,
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3,
                    }}>{label}</div>
                    {text ? (
                      <div style={{ fontSize: 11, color: DIM, lineHeight: 1.4 }}>"{text}"</div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>No response</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
