import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import { GLYPHS } from '../icons/glyphs'
import { clampTooltipCenterX } from '../../lib/tooltipPosition'

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

export default function DefenseReadyBadge({ awardedAt }) {
  const unlocked = Boolean(awardedAt)
  const { theme } = useTheme()
  const isLight = theme === 'light'

  const containerRef = useRef(null)
  const prevUnlockedRef = useRef(unlocked)
  const touchTimerRef = useRef(null)
  const wasTouchRef = useRef(false)
  const [justUnlocked, setJustUnlocked] = useState(false)
  const [pulsing, setPulsing] = useState(false)
  const [tooltipVisible, setTooltipVisible] = useState(false)
  const [tooltipCoords, setTooltipCoords] = useState({ top: 0, left: 0 })

  useEffect(() => {
    if (!prevUnlockedRef.current && unlocked) {
      setJustUnlocked(true)
      setPulsing(true)
      const t = setTimeout(() => setPulsing(false), 5000)
      return () => clearTimeout(t)
    }
    prevUnlockedRef.current = unlocked
  }, [unlocked])

  useEffect(() => () => clearTimeout(touchTimerRef.current), [])

  useEffect(() => {
    if (!tooltipVisible) return
    const hide = () => setTooltipVisible(false)
    document.addEventListener('scroll', hide, { passive: true, capture: true })
    return () => document.removeEventListener('scroll', hide, { capture: true })
  }, [tooltipVisible])

  function captureCoords() {
    if (!containerRef.current) return
    const r = containerRef.current.getBoundingClientRect()
    setTooltipCoords({ top: r.top, left: clampTooltipCenterX(r.left + r.width / 2, 220) })
  }

  function handleTouchStart() {
    wasTouchRef.current = true
    captureCoords()
    if (tooltipVisible) {
      setTooltipVisible(false)
      clearTimeout(touchTimerRef.current)
    } else {
      setTooltipVisible(true)
      clearTimeout(touchTimerRef.current)
      touchTimerRef.current = setTimeout(() => setTooltipVisible(false), 2500)
    }
  }

  return (
    <div
      ref={containerRef}
      className="relative flex flex-col items-center"
      onMouseEnter={() => { if (wasTouchRef.current) return; captureCoords(); setTooltipVisible(true) }}
      onMouseLeave={() => { if (wasTouchRef.current) { wasTouchRef.current = false; return } setTooltipVisible(false) }}
      onFocus={() => { captureCoords(); setTooltipVisible(true) }}
      onBlur={() => setTooltipVisible(false)}
      onTouchStart={handleTouchStart}
      role="img"
      aria-label={
        unlocked
          ? `Defense Ready — awarded ${formatDate(awardedAt)}`
          : 'Defense Ready — locked. Complete all steps and run one Defense Simulator session to unlock.'
      }
    >
      {/* Pulse rings — only for first 5s after unlock */}
      {pulsing && (
        <>
          <motion.div
            animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: '2px solid rgba(0,102,255,0.6)',
              pointerEvents: 'none',
            }}
          />
          <motion.div
            animate={{ scale: [1, 1.8], opacity: [0.5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity, ease: 'easeOut', delay: 0.5 }}
            style={{
              position: 'absolute',
              top: 0,
              left: '50%',
              transform: 'translateX(-50%)',
              width: 64,
              height: 64,
              borderRadius: '50%',
              border: '2px solid rgba(0,102,255,0.4)',
              pointerEvents: 'none',
            }}
          />
        </>
      )}

      {/* Main badge */}
      <motion.div
        animate={justUnlocked ? {
          scale: [1, 1.3, 1],
          rotate: [0, -8, 8, 0],
          transition: { duration: 0.7, ease: [0.34, 1.56, 0.64, 1] },
        } : {}}
        style={{
          width: 64,
          height: 64,
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          border: `2.5px solid ${unlocked ? '#0066FF' : isLight ? 'rgba(13,27,42,0.15)' : 'rgba(255,255,255,0.12)'}`,
          background: unlocked
            ? 'radial-gradient(circle at 35% 35%, rgba(0,102,255,0.2), rgba(0,102,255,0.06))'
            : isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
          filter: unlocked ? 'none' : 'grayscale(1)',
          opacity: unlocked ? 1 : 0.35,
          boxShadow: unlocked ? '0 0 24px rgba(0,102,255,0.35)' : 'none',
          transition: 'all 0.5s ease',
          position: 'relative',
          cursor: 'default',
        }}
      >
        {unlocked ? (
          <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"
            style={{ '--gl-stroke': '#0066FF', '--gl-fill': 'rgba(0,102,255,0.28)' }}>
            {GLYPHS.shield}
          </svg>
        ) : (
          <div style={{ position: 'relative', width: 30, height: 30 }}>
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"
              style={{
                '--gl-stroke': isLight ? 'rgba(13,27,42,0.25)' : 'rgba(255,255,255,0.25)',
                '--gl-fill': isLight ? 'rgba(13,27,42,0.06)' : 'rgba(255,255,255,0.05)',
              }}>
              {GLYPHS.shield}
            </svg>
            {/* Padlock overlay */}
            <div style={{ position: 'absolute', bottom: -2, right: -2, background: isLight ? '#E2E8F0' : '#0D1B2A', borderRadius: '50%', padding: 2 }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
                <path d="M7 11V7a5 5 0 0 1 10 0v4" />
              </svg>
            </div>
          </div>
        )}

        {/* Star burst on unlock */}
        {unlocked && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            style={{
              position: 'absolute',
              bottom: -6,
              right: -6,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #0066FF, #3B82F6)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 10px rgba(0,102,255,0.6)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
            </svg>
          </motion.div>
        )}
      </motion.div>

      {/* Label */}
      <span
        style={{
          marginTop: 8,
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.6rem',
          fontWeight: 600,
          textAlign: 'center',
          color: unlocked ? '#0066FF' : isLight ? 'rgba(13,27,42,0.3)' : 'rgba(255,255,255,0.2)',
          maxWidth: 70,
          lineHeight: 1.3,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          transition: 'color 0.5s ease',
        }}
      >
        {unlocked ? 'READY' : 'LOCKED'}
      </span>

      {/* Tooltip — portal to escape overflow-x:auto scroll-container clipping */}
      {createPortal(
        <AnimatePresence>
          {tooltipVisible && (
            <motion.div
              key="defense-ready-tip"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'fixed',
                top: tooltipCoords.top,
                left: tooltipCoords.left,
                transform: 'translateX(-50%) translateY(-100%) translateY(-8px)',
                background: isLight ? '#FFFFFF' : '#0D1B2A',
                border: isLight
                  ? `1px solid ${unlocked ? 'rgba(0,102,255,0.2)' : '#E2E8F0'}`
                  : `1px solid ${unlocked ? 'rgba(0,102,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 10,
                padding: '8px 12px',
                width: 220,
                zIndex: 9999,
                pointerEvents: 'none',
                textAlign: 'center',
                boxShadow: isLight ? '0 4px 16px rgba(0,0,0,0.1)' : '0 4px 24px rgba(0,0,0,0.5)',
              }}
            >
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', fontWeight: 600, color: unlocked ? '#3B82F6' : isLight ? '#0F172A' : 'rgba(255,255,255,0.7)', margin: 0 }}>
                {unlocked ? 'Defense Ready' : '🔒 Defense Ready'}
              </p>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.62rem', color: isLight ? 'rgba(13,27,42,0.5)' : 'rgba(255,255,255,0.45)', margin: '4px 0 0', lineHeight: 1.5 }}>
                {unlocked
                  ? `Awarded ${formatDate(awardedAt)} — all 6 steps completed + defense session run`
                  : 'Complete all 6 steps and run one Defense Simulator session to unlock.'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </div>
  )
}
