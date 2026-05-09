import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

const SHIELD_PATH =
  'M224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

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

  const prevUnlockedRef = useRef(unlocked)
  const [justUnlocked, setJustUnlocked] = useState(false)
  const [pulsing, setPulsing] = useState(false)
  const [tooltipVisible, setTooltipVisible] = useState(false)

  useEffect(() => {
    if (!prevUnlockedRef.current && unlocked) {
      setJustUnlocked(true)
      setPulsing(true)
      const t = setTimeout(() => setPulsing(false), 5000)
      return () => clearTimeout(t)
    }
    prevUnlockedRef.current = unlocked
  }, [unlocked])

  return (
    <div
      className="relative flex flex-col items-center"
      onMouseEnter={() => setTooltipVisible(true)}
      onMouseLeave={() => setTooltipVisible(false)}
      onFocus={() => setTooltipVisible(true)}
      onBlur={() => setTooltipVisible(false)}
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
          border: `2.5px solid ${unlocked ? '#0066FF' : 'rgba(255,255,255,0.12)'}`,
          background: unlocked
            ? 'radial-gradient(circle at 35% 35%, rgba(0,102,255,0.2), rgba(0,102,255,0.06))'
            : 'rgba(255,255,255,0.04)',
          filter: unlocked ? 'none' : 'grayscale(1)',
          opacity: unlocked ? 1 : 0.35,
          boxShadow: unlocked ? '0 0 24px rgba(0,102,255,0.35)' : 'none',
          transition: 'all 0.5s ease',
          position: 'relative',
          cursor: 'default',
        }}
      >
        {unlocked ? (
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="30" height="30" fill="#0066FF" aria-hidden="true">
            <path d={SHIELD_PATH} />
          </svg>
        ) : (
          <div style={{ position: 'relative', width: 30, height: 30 }}>
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="30" height="30" fill="rgba(255,255,255,0.2)" aria-hidden="true">
              <path d={SHIELD_PATH} />
            </svg>
            {/* Padlock overlay */}
            <div style={{ position: 'absolute', bottom: -2, right: -2, background: '#0D1B2A', borderRadius: '50%', padding: 2 }}>
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
          color: unlocked ? '#0066FF' : 'rgba(255,255,255,0.2)',
          maxWidth: 70,
          lineHeight: 1.3,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          transition: 'color 0.5s ease',
        }}
      >
        {unlocked ? 'READY' : 'LOCKED'}
      </span>

      {/* Tooltip */}
      <AnimatePresence>
        {tooltipVisible && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 4 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              bottom: '110%',
              left: '50%',
              transform: 'translateX(-50%)',
              background: '#0D1B2A',
              border: `1px solid ${unlocked ? 'rgba(0,102,255,0.3)' : 'rgba(255,255,255,0.1)'}`,
              borderRadius: 10,
              padding: '8px 12px',
              width: 220,
              zIndex: 9999,
              pointerEvents: 'none',
              textAlign: 'center',
            }}
          >
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', fontWeight: 600, color: unlocked ? '#3B82F6' : 'rgba(255,255,255,0.7)', margin: 0 }}>
              {unlocked ? 'Defense Ready' : '🔒 Defense Ready'}
            </p>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.62rem', color: 'rgba(255,255,255,0.45)', margin: '4px 0 0', lineHeight: 1.5 }}>
              {unlocked
                ? `Awarded ${formatDate(awardedAt)} — all 6 steps completed + defense session run`
                : 'Complete all 6 steps and run one Defense Simulator session to unlock.'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
