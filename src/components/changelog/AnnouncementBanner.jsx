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
            background: 'linear-gradient(135deg, #0F2235 0%, #0D1B2A 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderLeft: '3px solid #0066FF',
            borderRadius: 12,
            boxShadow: '0 4px 20px rgba(0,0,0,0.4), 0 1px 6px rgba(0,0,0,0.2)',
            padding: '10px 20px',
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
                fontFamily: "'DM Serif Display', Georgia, serif",
                fontWeight: 400,
                fontSize: '0.9rem',
                color: '#FFFFFF',
                whiteSpace: 'nowrap',
              }}
            >
              {entry.title}
            </span>
            <span
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.875rem',
                color: 'rgba(255,255,255,0.7)',
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
                color: '#3B82F6',
                textDecoration: 'none',
                whiteSpace: 'nowrap',
                transition: 'color 0.15s ease',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = '#60A5FA' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#3B82F6' }}
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
