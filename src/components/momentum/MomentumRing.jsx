import { useMomentum } from '../../hooks/useMomentum'
import { useTheme } from '../../context/ThemeContext'

const RADIUS = 48
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function formatTimeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

const TYPE_COLOR = {
  step:     '#16A34A',
  defense:  '#3B82F6',
  referral: '#8B5CF6',
}

export default function MomentumRing() {
  const { pct, state, label, color, actions, loading } = useMomentum()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const dashArray = `${(pct / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`

  const cardBg     = isDark
    ? 'linear-gradient(145deg, #0D1B2A 0%, #0F2235 100%)'
    : 'linear-gradient(145deg, #ffffff 0%, #f4f8ff 100%)'
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(13,27,42,0.08)'
  const textPrimary   = isDark ? '#ffffff' : '#0D1B2A'
  const textSecondary = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(13,27,42,0.5)'
  const trackColor    = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(13,27,42,0.08)'
  const dividerColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(13,27,42,0.06)'

  if (loading) return (
    <div style={{
      background: cardBg, border: cardBorder, borderRadius: 16, padding: 24, marginBottom: 20,
      height: 140,
    }} />
  )

  // Fill up to 4 slots with actions, rest are empty placeholders
  const slots = [...actions]
  while (slots.length < 4) slots.push(null)

  return (
    <div style={{
      background: cardBg,
      border: cardBorder,
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 20,
      boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.85rem', fontWeight: 700, color: textPrimary, margin: 0 }}>
            Research Momentum
          </p>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', color: textSecondary, margin: '2px 0 0' }}>
            Last 7 days
          </p>
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          padding: '3px 10px', borderRadius: 999,
          background: `${color}18`, color, border: `1px solid ${color}40`,
        }}>
          {state === 'cold' ? 'Cold' : state === 'warming' ? 'Warming Up' : state === 'on_track' ? 'On Track' : 'Peak Focus 🔥'}
        </span>
      </div>

      {/* Ring + Activity feed */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>

        {/* SVG Ring */}
        <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
          <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="55" cy="55" r={RADIUS} fill="none" stroke={trackColor} strokeWidth="9" />
            {pct > 0 && (
              <circle
                cx="55" cy="55" r={RADIUS}
                fill="none"
                stroke={color}
                strokeWidth="9"
                strokeDasharray={dashArray}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1), stroke 0.4s ease' }}
              />
            )}
          </svg>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            textAlign: 'center',
          }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.3rem', fontWeight: 800, color: pct > 0 ? color : textSecondary, margin: 0, lineHeight: 1 }}>
              {pct}%
            </p>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.52rem', color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '3px 0 0' }}>
              momentum
            </p>
          </div>
        </div>

        {/* Activity feed */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {slots.map((action, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
              borderBottom: i < 3 ? `1px solid ${dividerColor}` : 'none',
              opacity: action ? 1 : 0.3,
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                background: action ? TYPE_COLOR[action.type] : textSecondary,
              }} />
              <span style={{
                fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem',
                color: action ? textPrimary : textSecondary, flex: 1,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {action ? action.label : 'Complete a step to add momentum'}
              </span>
              {action && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', color: textSecondary, flexShrink: 0 }}>
                  {formatTimeAgo(action.timestamp)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom label */}
      <p style={{
        fontFamily: "'Poppins', sans-serif", fontSize: '0.7rem', color: textSecondary,
        margin: '12px 0 0', textAlign: 'center',
      }}>
        {label}
      </p>
    </div>
  )
}
