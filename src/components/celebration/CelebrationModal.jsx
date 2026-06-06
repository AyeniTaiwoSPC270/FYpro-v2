import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'

// Lightweight canvas confetti — no external library
function fireConfetti(canvas) {
  const ctx = canvas.getContext('2d')
  const pieces = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    y: -10,
    r: Math.random() * 6 + 3,
    color: ['#0066FF', '#16A34A', '#F59E0B', '#8B5CF6', '#3B82F6'][Math.floor(Math.random() * 5)],
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 3 + 2,
    rotation: Math.random() * 360,
    vr: (Math.random() - 0.5) * 6,
  }))

  let frame
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    let alive = false
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy; p.rotation += p.vr; p.vy += 0.05
      if (p.y < canvas.height + 10) alive = true
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r)
      ctx.restore()
    }
    if (alive) frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  setTimeout(() => cancelAnimationFrame(frame), 2500)
}

/**
 * Props:
 *   open       — boolean, controls visibility
 *   onClose    — () => void
 *   emoji      — string, e.g. '📐'
 *   headline   — string, e.g. 'Step Complete!'
 *   body       — string, secondary description
 *   rankLabel  — string | null, if rank changed show it
 *   ctaLabel   — string, button label
 *   onCta      — () => void
 */
export default function CelebrationModal({ open, onClose, emoji, headline, body, rankLabel, ctaLabel = 'Continue', onCta }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const canvasRef = useRef(null)

  useEffect(() => {
    if (open && canvasRef.current) {
      fireConfetti(canvasRef.current)
    }
  }, [open])

  function handleCta() {
    onCta?.()
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          }}
          onClick={onClose}
        >
          <canvas
            ref={canvasRef}
            width={window.innerWidth}
            height={window.innerHeight}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          />
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: isDark
                ? 'linear-gradient(145deg, #0D1B2A 0%, #0F2235 100%)'
                : '#ffffff',
              border: isDark ? '1px solid rgba(0,102,255,0.25)' : '1px solid rgba(13,27,42,0.1)',
              borderRadius: 20,
              padding: '36px 32px',
              textAlign: 'center',
              maxWidth: 360,
              width: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>{emoji}</div>
            <h2 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '1.5rem', color: isDark ? '#fff' : '#0D1B2A',
              margin: '0 0 8px',
            }}>
              {headline}
            </h2>
            <p style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.85rem', color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(13,27,42,0.6)',
              margin: '0 0 20px', lineHeight: 1.6,
            }}>
              {body}
            </p>
            {rankLabel && (
              <div style={{
                background: 'rgba(0,102,255,0.08)', border: '1px solid rgba(0,102,255,0.2)',
                borderRadius: 10, padding: '10px 16px', marginBottom: 20,
              }}>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  New rank
                </p>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.9rem', fontWeight: 700, color: '#3B82F6', margin: 0 }}>
                  {rankLabel}
                </p>
              </div>
            )}
            <button
              onClick={handleCta}
              style={{
                width: '100%', background: '#0066FF', color: '#fff',
                border: 'none', borderRadius: 10, padding: '13px',
                fontFamily: "'Poppins', sans-serif", fontSize: '0.9rem', fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {ctaLabel}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
