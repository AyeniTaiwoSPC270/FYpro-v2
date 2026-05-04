import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

const CONFETTI_COLORS = [
  '#3B82F6', '#60A5FA', '#22C55E', '#4ADE80',
  '#FFFFFF', '#93C5FD', '#86EFAC', '#BFDBFE',
]

function generateConfetti(count = 32) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: 15 + Math.random() * 70,
    delay: Math.random() * 0.5,
    duration: 1.0 + Math.random() * 0.9,
    size: 5 + Math.random() * 6,
    xDist: -100 + Math.random() * 200,
    yDist: -(80 + Math.random() * 130),
    isCircle: i % 2 === 0,
  }))
}

const confettiPieces = generateConfetti()

function formatDate(date) {
  return date.toLocaleDateString('en-NG', {
    year: 'numeric', month: 'long', day: 'numeric',
  })
}

const cardVariants = {
  hidden: { opacity: 0, y: 32 },
  visible: {
    opacity: 1, y: 0,
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
}

const rowStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.3 } },
}

const rowVariant = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
}

export default function PaymentSuccess() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const reference = searchParams.get('reference') || 'Unknown'
  const [tier, setTier] = useState(null)
  const [showConfetti, setShowConfetti] = useState(true)
  const [verifying, setVerifying] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function verifyPayment() {
      try {
        const res = await fetch('/api/payments?action=verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ reference }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error('failed')
        if (!cancelled) {
          setTier(data.tier)
          // Invalidate entitlement cache so usePaidFeatures re-fetches on next mount.
          window.dispatchEvent(new Event('fypro_entitlements_updated'))
        }
      } catch {
        if (!cancelled) navigate('/pricing?error=payment_failed', { replace: true })
        return
      }
      if (!cancelled) setVerifying(false)
    }
    verifyPayment()
    return () => { cancelled = true }
  }, [reference, navigate])

  useEffect(() => {
    const t = setTimeout(() => setShowConfetti(false), 2600)
    return () => clearTimeout(t)
  }, [])

  const today = formatDate(new Date())

  if (verifying) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          width: 40, height: 40,
          border: '3px solid var(--border-color)',
          borderTopColor: '#3B82F6',
          borderRadius: '50%',
          animation: 'spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: "'Poppins', sans-serif",
        position: 'relative',
        overflow: 'hidden',
        padding: '24px 16px',
      }}
    >
      {/* Framer Motion confetti */}
      <AnimatePresence>
        {showConfetti && (
          <div style={{ position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 50 }}>
            {confettiPieces.map((p) => (
              <motion.div
                key={p.id}
                initial={{ opacity: 1, x: 0, y: 0, rotate: 0, scale: 1 }}
                animate={{ opacity: 0, x: p.xDist, y: p.yDist, rotate: 400, scale: 0.6 }}
                transition={{ duration: p.duration, delay: p.delay, ease: 'easeOut' }}
                style={{
                  position: 'absolute',
                  left: `${p.left}%`,
                  top: '50%',
                  width: p.size,
                  height: p.size,
                  borderRadius: p.isCircle ? '50%' : '2px',
                  backgroundColor: p.color,
                }}
              />
            ))}
          </div>
        )}
      </AnimatePresence>

      <div style={{ width: '100%', maxWidth: 448, margin: '0 auto' }}>
        <motion.div
          variants={cardVariants}
          initial="hidden"
          animate="visible"
          style={{
            backgroundColor: 'var(--bg-card)',
            borderRadius: 16,
            border: '1px solid var(--border-color)',
            padding: '40px 40px 36px',
            boxShadow: '0 8px 40px rgba(59,130,246,0.07)',
          }}
        >
          {/* Success icon — spring pop */}
          <motion.div
            style={{ display: 'flex', justifyContent: 'center' }}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 220, damping: 14 }}
          >
            <div
              style={{
                width: 80, height: 80, borderRadius: '50%',
                backgroundColor: 'rgba(34,197,94,0.1)',
                border: '2px solid rgba(34,197,94,0.3)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}
            >
              <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
                <motion.path
                  d="M8 20 L16 28 L32 12"
                  stroke="#4ADE80"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{ pathLength: 1, opacity: 1 }}
                  transition={{ delay: 0.55, duration: 0.45, ease: 'easeOut' }}
                />
              </svg>
            </div>
          </motion.div>

          {/* Staggered content */}
          <motion.div variants={rowStagger} initial="hidden" animate="visible">

            <motion.h1
              variants={rowVariant}
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: '1.875rem',
                color: '#FFFFFF',
                textAlign: 'center',
                marginTop: 24,
                marginBottom: 0,
                fontWeight: 400,
                lineHeight: 1.2,
              }}
            >
              Payment Successful
            </motion.h1>

            <motion.p
              variants={rowVariant}
              style={{
                color: '#94A3B8',
                fontSize: '0.875rem',
                textAlign: 'center',
                marginTop: 10,
                lineHeight: 1.6,
                maxWidth: 280,
                marginLeft: 'auto',
                marginRight: 'auto',
              }}
            >
              Your plan has been activated. You&apos;re ready to continue your FYP journey.
            </motion.p>

            {/* Order summary */}
            <motion.div
              variants={rowVariant}
              style={{
                backgroundColor: 'var(--bg-input)',
                borderRadius: 12,
                border: '1px solid var(--border-color)',
                padding: '20px',
                marginTop: 28,
              }}
            >
              {[
                { label: 'Plan',      value: tier === 'defense_pack' ? 'Defense Plan' : 'Student Plan', type: 'white' },
                { label: 'Amount',    value: tier === 'defense_pack' ? '₦3,500' : '₦2,000',           type: 'white' },
                { label: 'Reference', value: reference,           type: 'mono'  },
                { label: 'Date',      value: today,              type: 'slate' },
                { label: 'Status',    value: 'Confirmed',        type: 'badge', noBorder: true },
              ].map((row, i) => (
                <motion.div
                  key={row.label}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.6 + i * 0.07, duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    paddingBottom: row.noBorder ? 0 : 12,
                    marginBottom: row.noBorder ? 0 : 12,
                    borderBottom: row.noBorder ? 'none' : '1px solid var(--border-color)',
                  }}
                >
                  <span style={{ color: '#64748B', fontSize: '0.8125rem', fontFamily: "'Poppins', sans-serif" }}>
                    {row.label}
                  </span>
                  {row.type === 'badge' ? (
                    <span style={{
                      backgroundColor: 'rgba(34,197,94,0.15)',
                      color: '#4ADE80',
                      border: '1px solid rgba(34,197,94,0.3)',
                      borderRadius: 999,
                      padding: '4px 12px',
                      fontSize: '0.7rem',
                      fontWeight: 600,
                      fontFamily: "'JetBrains Mono', monospace",
                      letterSpacing: '0.04em',
                    }}>
                      {row.value}
                    </span>
                  ) : (
                    <span style={{
                      color: row.type === 'white' ? '#FFFFFF' : '#94A3B8',
                      fontSize: row.type === 'mono' ? '0.75rem' : '0.875rem',
                      fontWeight: row.type === 'white' ? 500 : 400,
                      fontFamily: row.type === 'mono' ? "'JetBrains Mono', monospace" : "'Poppins', sans-serif",
                      letterSpacing: row.type === 'mono' ? '0.02em' : 'normal',
                    }}>
                      {row.value}
                    </span>
                  )}
                </motion.div>
              ))}
            </motion.div>

            {/* Email notice */}
            <motion.div
              variants={rowVariant}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#475569',
                fontSize: '0.75rem',
                textAlign: 'center',
                marginTop: 16,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, flexShrink: 0 }}>
                <rect x="2" y="4" width="20" height="16" rx="2" />
                <path d="m2 7 10 7 10-7" />
              </svg>
              A receipt has been sent to your email address.
            </motion.div>

            {/* Primary button */}
            <motion.button
              variants={rowVariant}
              whileHover={{ y: -2, backgroundColor: '#3B82F6', boxShadow: '0 8px 24px rgba(59,130,246,0.45)' }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
              style={{
                display: 'block',
                width: '100%',
                backgroundColor: '#2563EB',
                color: '#FFFFFF',
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '0.9375rem',
                border: 'none',
                borderRadius: 12,
                padding: '16px 0',
                marginTop: 28,
                cursor: 'pointer',
                transition: 'background-color 0.2s ease',
              }}
              onClick={() => navigate('/dashboard')}
            >
              Continue to Dashboard
            </motion.button>

            {/* Secondary link */}
            <motion.a
              variants={rowVariant}
              whileHover={{ color: '#60A5FA' }}
              style={{
                display: 'block',
                textAlign: 'center',
                color: '#64748B',
                fontSize: '0.875rem',
                marginTop: 16,
                cursor: 'pointer',
                textDecoration: 'none',
                fontFamily: "'Poppins', sans-serif",
                transition: 'color 0.2s ease',
              }}
              onClick={() => navigate('/dashboard')}
              role="button"
            >
              View all projects
            </motion.a>

            {/* Bottom note */}
            <motion.p
              variants={rowVariant}
              style={{
                color: '#334155',
                fontSize: '0.75rem',
                textAlign: 'center',
                marginTop: 28,
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Need help? Contact us at&nbsp;
              <span style={{ color: '#475569' }}>support@fypro.app</span>
            </motion.p>
          </motion.div>
        </motion.div>
      </div>
    </div>
  )
}
