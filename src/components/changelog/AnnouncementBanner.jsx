import { useState, useEffect } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { Link } from 'react-router-dom'
import { changelog } from '../../data/changelog'

const LS_KEY = 'fypro_dismissed_changelog'

function getDismissed() {
  try {
    return JSON.parse(localStorage.getItem(LS_KEY) || '[]')
  } catch {
    return []
  }
}

export default function AnnouncementBanner() {
  const prefersReducedMotion = useReducedMotion()
  const entry = changelog[0]
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (!entry) return
    const dismissed = getDismissed()
    if (!dismissed.includes(entry.id)) {
      setVisible(true)
    }
  }, [entry?.id])

  function handleDismiss() {
    const dismissed = getDismissed()
    if (!dismissed.includes(entry.id)) {
      dismissed.push(entry.id)
    }
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(dismissed))
    } catch {
      // Storage full — dismiss silently for this session
    }
    setVisible(false)
  }

  if (!entry) return null

  const motionProps = prefersReducedMotion
    ? { initial: { opacity: 0 }, animate: { opacity: 1 }, exit: { opacity: 0 }, transition: { duration: 0.15 } }
    : { initial: { opacity: 0, y: -8 }, animate: { opacity: 1, y: 0 }, exit: { opacity: 0, y: -8 }, transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] } }

  return (
    <AnimatePresence>
      {visible && (
        <motion.section
          role="status"
          aria-live="polite"
          aria-label="Product announcement"
          {...motionProps}
          style={{
            background: 'linear-gradient(90deg, rgba(0,102,255,0.09) 0%, rgba(0,102,255,0.03) 100%)',
            borderBottom: '1px solid rgba(0,102,255,0.18)',
            borderLeft: '3px solid #0066FF',
            padding: '10px 20px 10px 20px',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            flexShrink: 0,
            position: 'relative',
            zIndex: 'var(--z-sticky, 20)',
          }}
        >
          {/* Emoji marker */}
          <span
            style={{ fontSize: '1rem', lineHeight: 1, flexShrink: 0 }}
            aria-hidden="true"
          >
            {entry.emoji}
          </span>

          {/* Text content */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'baseline', gap: 8, flexWrap: 'wrap' }}>
            <span
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '0.8rem',
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.title}
            </span>
            <span
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.77rem',
                color: 'rgba(255,255,255,0.48)',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.body}
            </span>
          </div>

          {/* Actions */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 14,
              flexShrink: 0,
            }}
          >
            <Link
              to="/changelog"
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.76rem',
                fontWeight: 600,
                color: '#60A5FA',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#93C5FD' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#60A5FA' }}
            >
              View all updates
            </Link>

            <button
              onClick={handleDismiss}
              aria-label="Dismiss announcement"
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'rgba(255,255,255,0.35)',
                padding: '4px 2px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 4,
                lineHeight: 1,
                transition: 'color 0.15s ease',
                minWidth: 28,
                minHeight: 28,
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
              onFocus={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.75)' }}
              onBlur={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.35)' }}
            >
              <svg
                width="13"
                height="13"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
        </motion.section>
      )}
    </AnimatePresence>
  )
}
