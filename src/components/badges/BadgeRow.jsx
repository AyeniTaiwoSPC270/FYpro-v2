import { motion } from 'framer-motion'
import StepBadge from './StepBadge'
import DefenseReadyBadge from './DefenseReadyBadge'
import { useUserProgress } from '../../hooks/useUserProgress'
import { useTheme } from '../../context/ThemeContext'

const STEP_KEYS = [
  'topic_validator_completed_at',
  'chapter_architect_completed_at',
  'methodology_advisor_completed_at',
  'writing_planner_completed_at',
  'project_reviewer_completed_at',
  'defense_prep_completed_at',
]

export default function BadgeRow() {
  const { progress, loading } = useUserProgress()
  const { theme } = useTheme()
  const isLight = theme === 'light'

  if (loading) return null

  const anyEarned = STEP_KEYS.some(k => progress[k]) || progress.defense_ready_awarded_at

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'flex-start',
        gap: 12,
        padding: '18px 24px',
        borderRadius: 16,
        background: isLight
          ? 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
        border: isLight ? '1px solid #E2E8F0' : '1px solid rgba(255,255,255,0.07)',
        marginBottom: 20,
        overflow: 'visible',
      }}
      role="region"
      aria-label="Achievement badges"
    >
      {/* Label */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 64, paddingTop: 2 }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.58rem',
          fontWeight: 600,
          color: isLight ? 'rgba(13,27,42,0.45)' : 'rgba(255,255,255,0.3)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
          lineHeight: 1.4,
        }}>
          {anyEarned ? 'Your Badges' : 'Badges'}
        </span>
        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.6rem',
          color: isLight ? 'rgba(13,27,42,0.35)' : 'rgba(255,255,255,0.18)',
          marginTop: 3,
          lineHeight: 1.4,
        }}>
          Complete steps to unlock
        </span>
      </div>

      {/* Divider */}
      <div style={{ width: 1, alignSelf: 'stretch', background: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.07)', margin: '0 4px', flexShrink: 0 }} aria-hidden="true" />

      {/* 6 step badges */}
      {STEP_KEYS.map((key, i) => (
        <StepBadge
          key={key}
          index={i}
          completedAt={progress[key]}
        />
      ))}

      {/* Separator before special badge */}
      <div style={{ width: 1, alignSelf: 'stretch', background: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.07)', margin: '0 4px', flexShrink: 0 }} aria-hidden="true" />

      {/* Defense Ready badge */}
      <DefenseReadyBadge awardedAt={progress.defense_ready_awarded_at} />
    </motion.div>
  )
}
