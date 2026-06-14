// src/components/badges/AchievementsRow.jsx
// Compact row of earned achievement chips shown on the dashboard.
// Locked achievements show as faint outlines. Hidden ones show as '?' until earned.
import { motion } from 'framer-motion'
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

export default function AchievementsRow({ projectId = null, catalog = null }) {
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
          to="/account/achievements"
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
      {defs.slice(0, 12).map(a => {
        const earned = earnedKeys.has(a.key)
        const showHidden = a.hidden && !earned
        return (
          <motion.div
            key={a.key}
            title={earned ? a.label : a.hidden ? '???' : a.label}
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
            {showHidden ? '?' : a.emoji}
          </motion.div>
        )
      })}
    </motion.div>
  )
}
