// src/components/badges/AchievementsRow.jsx
// Compact row of earned achievement chips shown on the dashboard.
// Locked achievements show as faint outlines. Hidden ones show as '?' until earned.
import { useRef, useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAchievements } from '../../hooks/useAchievements'
import { useTheme } from '../../context/ThemeContext'
import { Link } from 'react-router-dom'

// All 19 achievements in display order
const ALL_ACHIEVEMENTS = [
  { key: 'first_step',    label: 'First Step',    emoji: '🌱', hidden: false },
  { key: 'halfway',       label: 'Halfway There', emoji: '⚡', hidden: false },
  { key: 'defense_ready', label: 'Defense Ready', emoji: '🛡️', hidden: false },
  { key: 'certified',     label: 'Certified',     emoji: '🎓', hidden: false },
  { key: 'fast_starter',  label: 'Fast Starter',  emoji: '🚀', hidden: false },
  { key: 'sprint',        label: 'Sprint',         emoji: '🏃', hidden: false },
  { key: 'speed_run',     label: 'Speed Run',      emoji: '💨', hidden: false },
  { key: 'sharp_mind',    label: 'Sharp Mind',     emoji: '🎯', hidden: false },
  { key: 'excellence',    label: 'Excellence',     emoji: '⭐', hidden: false },
  { key: 'perfectionist', label: 'Perfectionist',  emoji: '💎', hidden: false },
  { key: 'persistent',    label: 'Persistent',     emoji: '🔄', hidden: false },
  { key: 'never_give_up', label: 'Never Give Up',  emoji: '💪', hidden: false },
  { key: 'ambassador',    label: 'Ambassador',     emoji: '📣', hidden: false },
  { key: 'connector',     label: 'Connector',      emoji: '🌐', hidden: false },
  { key: 'earned_it',     label: 'Earned It',      emoji: '🏆', hidden: false },
  { key: 'shared',        label: 'Shared',         emoji: '📤', hidden: false },
  { key: 'night_owl',     label: 'Night Owl',      emoji: '🦉', hidden: true  },
  { key: 'early_bird',    label: 'Early Bird',     emoji: '🌅', hidden: true  },
  { key: 'dedicated',     label: 'Dedicated',      emoji: '🔥', hidden: true  },
]

function AchievementChip({ def, earned, isLight }) {
  const ref = useRef(null)
  const timerRef = useRef(null)
  const wasTouchRef = useRef(false)
  const [visible, setVisible] = useState(false)
  const [coords, setCoords] = useState({ top: 0, left: 0 })

  useEffect(() => () => clearTimeout(timerRef.current), [])

  useEffect(() => {
    if (!visible) return
    const hide = () => setVisible(false)
    document.addEventListener('scroll', hide, { passive: true, capture: true })
    return () => document.removeEventListener('scroll', hide, { capture: true })
  }, [visible])

  function capture() {
    if (!ref.current) return
    const r = ref.current.getBoundingClientRect()
    setCoords({ top: r.top, left: r.left + r.width / 2 })
  }

  function handleTouchStart() {
    wasTouchRef.current = true
    capture()
    if (visible) {
      setVisible(false)
      clearTimeout(timerRef.current)
    } else {
      setVisible(true)
      clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => setVisible(false), 2000)
    }
  }

  const label = earned ? def.label : def.hidden ? '???' : def.label

  return (
    <>
      <motion.div
        ref={ref}
        onMouseEnter={() => { if (wasTouchRef.current) return; capture(); setVisible(true) }}
        onMouseLeave={() => { if (wasTouchRef.current) { wasTouchRef.current = false; return } setVisible(false) }}
        onTouchStart={handleTouchStart}
        animate={earned ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.5 }}
        style={{
          width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '1.1rem',
          background: earned
            ? isLight ? 'rgba(0,102,255,0.08)' : 'rgba(0,102,255,0.12)'
            : isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
          border: earned
            ? '1.5px solid rgba(0,102,255,0.3)'
            : isLight ? '1.5px solid rgba(13,27,42,0.1)' : '1.5px solid rgba(255,255,255,0.08)',
          opacity: earned ? 1 : 0.35,
          filter: earned ? 'none' : 'grayscale(1)',
          cursor: 'default',
        }}
      >
        {def.hidden && !earned ? '?' : def.emoji}
      </motion.div>

      {createPortal(
        <AnimatePresence>
          {visible && (
            <motion.div
              key={`ach-tip-${def.key}`}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.12 }}
              style={{
                position: 'fixed',
                top: coords.top,
                left: coords.left,
                transform: 'translateX(-50%) translateY(-100%) translateY(-8px)',
                background: isLight ? '#FFFFFF' : '#0D1B2A',
                border: isLight ? '1px solid #E2E8F0' : '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6,
                padding: '4px 8px',
                zIndex: 9999,
                pointerEvents: 'none',
                whiteSpace: 'nowrap',
                boxShadow: isLight ? '0 4px 16px rgba(0,0,0,0.1)' : '0 4px 24px rgba(0,0,0,0.5)',
              }}
            >
              <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.65rem', color: isLight ? '#0F172A' : 'rgba(255,255,255,0.9)', fontWeight: 500 }}>
                {label}
              </span>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}

export default function AchievementsRow({ projectId = null, catalog = null, viewAllHref = '/account/achievements' }) {
  const { earnedKeys, loading } = useAchievements(projectId)
  const { theme } = useTheme()
  const isLight = theme === 'light'

  if (loading) return null

  // Express passes its own 8-item catalog ({ key, name, emoji, desc }); the
  // default dashboard uses ALL_ACHIEVEMENTS ({ key, label, emoji, hidden }).
  // Normalize both shapes here.
  const defs = (catalog ?? ALL_ACHIEVEMENTS).map(a => ({
    key: a.key,
    label: a.label ?? a.name,
    emoji: a.emoji,
    hidden: a.hidden ?? false,
  }))

  const earnedCount = defs.filter(a => earnedKeys.has(a.key)).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '14px 20px',
        borderRadius: 16,
        background: isLight
          ? 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
        border: isLight ? '1px solid #E2E8F0' : '1px solid rgba(255,255,255,0.07)',
        marginBottom: 20,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
      role="region"
      aria-label="Achievement badges"
    >
      {/* Label */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 72, flexShrink: 0 }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', fontWeight: 600,
          color: isLight ? 'rgba(13,27,42,0.45)' : 'rgba(255,255,255,0.3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Achievements
        </span>
        <span style={{
          fontFamily: "'Poppins', sans-serif", fontSize: '0.6rem',
          color: isLight ? 'rgba(13,27,42,0.35)' : 'rgba(255,255,255,0.18)', marginTop: 3,
        }}>
          {earnedCount}/{defs.length} earned
        </span>
        <Link
          to={viewAllHref}
          style={{
            fontFamily: "'Poppins', sans-serif", fontSize: '0.58rem',
            color: '#0066FF', textDecoration: 'none', marginTop: 4,
          }}
        >
          View all →
        </Link>
      </div>

      {/* Divider */}
      <div style={{ width: 1, alignSelf: 'stretch', background: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.07)', margin: '0 4px', flexShrink: 0 }} />

      {/* Achievement chips — show first 12, rest accessible via /account/achievements */}
      {defs.slice(0, 12).map(a => (
        <AchievementChip
          key={a.key}
          def={a}
          earned={earnedKeys.has(a.key)}
          isLight={isLight}
        />
      ))}
    </motion.div>
  )
}
