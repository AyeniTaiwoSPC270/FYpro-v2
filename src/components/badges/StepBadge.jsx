import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'

const STEP_META = [
  {
    label: 'Topic Validator',
    abbr: 'TV',
    color: '#3B82F6',
    glow: 'rgba(59,130,246,0.4)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M9 11l3 3L22 4" />
        <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
      </svg>
    ),
  },
  {
    label: 'Chapter Architect',
    abbr: 'CA',
    color: '#8B5CF6',
    glow: 'rgba(139,92,246,0.4)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" />
        <path d="M3 9h18M9 21V9" />
      </svg>
    ),
  },
  {
    label: 'Methodology Advisor',
    abbr: 'MA',
    color: '#06B6D4',
    glow: 'rgba(6,182,212,0.4)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M10 2v7.31" /><path d="M14 9.3V1.99" />
        <path d="M8.5 2h7" /><path d="M14 9.3a6.5 6.5 0 1 1-4 0" />
      </svg>
    ),
  },
  {
    label: 'Writing Planner',
    abbr: 'WP',
    color: '#F59E0B',
    glow: 'rgba(245,158,11,0.4)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
      </svg>
    ),
  },
  {
    label: 'Project Reviewer',
    abbr: 'PR',
    color: '#10B981',
    glow: 'rgba(16,185,129,0.4)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" />
        <polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
  {
    label: 'Defense Prep',
    abbr: 'DP',
    color: '#0066FF',
    glow: 'rgba(0,102,255,0.4)',
    icon: (
      <svg width="18" height="18" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
        <path d="M224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z" />
      </svg>
    ),
  },
]

function formatDate(iso) {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString('en-NG', {
      day: 'numeric', month: 'short', year: 'numeric',
    })
  } catch {
    return ''
  }
}

export default function StepBadge({ index, completedAt, tooltipAlign = 'center' }) {
  const meta = STEP_META[index] ?? STEP_META[0]
  const completed = Boolean(completedAt)
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const prevCompletedRef = useRef(completed)
  const touchTimerRef = useRef(null)
  const wasTouchRef = useRef(false)
  const [justCompleted, setJustCompleted] = useState(false)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  useEffect(() => {
    if (!prevCompletedRef.current && completed) {
      setJustCompleted(true)
      const t = setTimeout(() => setJustCompleted(false), 1200)
      return () => clearTimeout(t)
    }
    prevCompletedRef.current = completed
  }, [completed])

  useEffect(() => () => clearTimeout(touchTimerRef.current), [])

  const tooltipPositionStyle =
    tooltipAlign === 'start' ? { left: 0 }
    : tooltipAlign === 'end' ? { right: 0, left: 'auto' }
    : { left: '50%', transform: 'translateX(-50%)' }

  function handleTouchStart() {
    if (!completed) return
    wasTouchRef.current = true
    if (tooltipVisible) {
      setTooltipVisible(false)
      clearTimeout(touchTimerRef.current)
    } else {
      setTooltipVisible(true)
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = setTimeout(() => setTooltipVisible(false), 2000)
    }
  }

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => { if (wasTouchRef.current) return; completed && setTooltipVisible(true) }}
      onMouseLeave={() => { if (wasTouchRef.current) { wasTouchRef.current = false; return } setTooltipVisible(false) }}
      onFocus={() => completed && setTooltipVisible(true)}
      onBlur={() => setTooltipVisible(false)}
      onTouchStart={handleTouchStart}
      role="img"
      aria-label={`${meta.label}: ${completed ? `completed ${formatDate(completedAt)}` : 'not yet completed'}`}
    >
      <motion.div
        animate={justCompleted ? {
          scale: [1, 1.25, 1],
          transition: { duration: 0.6, ease: [0.34, 1.56, 0.64, 1] },
        } : {}}
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `2px solid ${completed ? meta.color : isLight ? 'rgba(13,27,42,0.15)' : 'rgba(255,255,255,0.12)'}`,
          background: completed
            ? `radial-gradient(circle at 35% 35%, ${meta.color}22, ${meta.color}08)`
            : isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
          color: completed ? meta.color : isLight ? 'rgba(13,27,42,0.25)' : 'rgba(255,255,255,0.25)',
          filter: completed ? 'none' : 'grayscale(1)',
          opacity: completed ? 1 : 0.4,
          boxShadow: completed && justCompleted ? `0 0 18px ${meta.glow}` : 'none',
          transition: 'border-color 0.4s ease, background 0.4s ease, color 0.4s ease, opacity 0.4s ease, box-shadow 0.4s ease',
          cursor: completed ? 'default' : 'default',
          position: 'relative',
        }}
      >
        {meta.icon}

        {/* Completion tick overlay */}
        {completed && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.1, duration: 0.3, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              position: 'absolute',
              bottom: -4,
              right: -4,
              width: 16,
              height: 16,
              borderRadius: '50%',
              background: meta.color,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 8px ${meta.glow}`,
            }}
          >
            <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </motion.div>
        )}
      </motion.div>

      {/* Step label */}
      <span
        style={{
          marginTop: 6,
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.58rem',
          fontWeight: 500,
          textAlign: 'center',
          color: completed
            ? isLight ? 'rgba(13,27,42,0.6)' : 'rgba(255,255,255,0.7)'
            : isLight ? 'rgba(13,27,42,0.3)' : 'rgba(255,255,255,0.25)',
          maxWidth: 60,
          lineHeight: 1.3,
          transition: 'color 0.4s ease',
        }}
      >
        {meta.abbr}
      </span>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltipVisible && completedAt && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              bottom: '110%',
              ...tooltipPositionStyle,
              background: isLight ? '#FFFFFF' : '#0D1B2A',
              border: isLight ? '1px solid #E2E8F0' : '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '6px 10px',
              whiteSpace: 'nowrap',
              zIndex: 9999,
              pointerEvents: 'none',
              boxShadow: isLight ? '0 4px 16px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.68rem', color: isLight ? '#0F172A' : 'rgba(255,255,255,0.9)', margin: 0, fontWeight: 500 }}>
              {meta.label}
            </p>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: isLight ? 'rgba(13,27,42,0.45)' : 'rgba(255,255,255,0.45)', margin: '2px 0 0' }}>
              Completed {formatDate(completedAt)}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
