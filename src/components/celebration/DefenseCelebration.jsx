import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function fireFullConfetti(canvas) {
  const ctx = canvas.getContext('2d')
  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: -20,
    r: Math.random() * 8 + 4,
    color: ['#0066FF', '#16A34A', '#F59E0B', '#8B5CF6', '#3B82F6', '#ffffff'][Math.floor(Math.random() * 6)],
    vx: (Math.random() - 0.5) * 5,
    vy: Math.random() * 4 + 2,
    rotation: Math.random() * 360,
    vr: (Math.random() - 0.5) * 8,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
  }))

  let frame
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    let alive = false
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy; p.rotation += p.vr; p.vy += 0.06
      if (p.y < canvas.height + 20) alive = true
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.fillStyle = p.color
      if (p.shape === 'circle') {
        ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx.fill()
      } else {
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r)
      }
      ctx.restore()
    }
    if (alive) frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  setTimeout(() => cancelAnimationFrame(frame), 4000)
}

/**
 * Props:
 *   open       — boolean
 *   score      — number (e.g. 8.5)
 *   onDownload — () => void
 *   onShare    — () => void
 *   onClose    — () => void
 */
export default function DefenseCelebration({ open, score, onDownload, onShare, onClose }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (open && canvasRef.current) {
      fireFullConfetti(canvasRef.current)
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9500,
            background: 'radial-gradient(ellipse at center top, rgba(0,102,255,0.3) 0%, #060E18 65%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', padding: '40px 20px', textAlign: 'center',
          }}
        >
          <canvas
            ref={canvasRef}
            width={window.innerWidth}
            height={window.innerHeight}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          />

          {/* Concentric ring pulses */}
          {[300, 480, 660].map((size, i) => (
            <motion.div
              key={size}
              animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.05, 0.15] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.8, ease: 'easeInOut' }}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: size, height: size, borderRadius: '50%',
                border: '1px solid rgba(0,102,255,0.4)',
                pointerEvents: 'none',
              }}
            />
          ))}

          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            style={{ position: 'relative', zIndex: 1, maxWidth: 420, width: '100%' }}
          >
            <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎓</div>

            <p style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.15em', color: '#3B82F6', marginBottom: 8,
            }}>
              Defense Certificate Unlocked
            </p>

            <h1 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '2.2rem', color: '#ffffff', margin: '0 0 10px', lineHeight: 1.15,
            }}>
              You passed.<br />Download your certificate.
            </h1>

            <p style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)', margin: '0 0 28px', lineHeight: 1.6,
            }}>
              You scored above the pass threshold in the FYPro Defense Simulator.
            </p>

            {/* Score display */}
            <div style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 4,
              background: 'rgba(0,102,255,0.12)', border: '1px solid rgba(0,102,255,0.3)',
              borderRadius: 12, padding: '12px 28px', marginBottom: 28,
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '2.8rem', fontWeight: 900, color: '#3B82F6' }}>
                {typeof score === 'number' ? score.toFixed(1) : score}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.3rem', color: 'rgba(255,255,255,0.3)' }}>
                /10
              </span>
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={onDownload}
                style={{
                  background: '#0066FF', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '13px 24px',
                  fontFamily: "'Poppins', sans-serif", fontSize: '0.88rem', fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Download Certificate
              </button>
              <button
                onClick={onShare}
                style={{
                  background: 'transparent', color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 10, padding: '13px 20px',
                  fontFamily: "'Poppins', sans-serif", fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Share on WhatsApp
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent', color: 'rgba(255,255,255,0.4)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, padding: '13px 20px',
                  fontFamily: "'Poppins', sans-serif", fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                View badges
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
