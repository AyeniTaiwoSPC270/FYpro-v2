import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'

const ShieldIcon = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 64 64"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    aria-hidden="true"
  >
    <path
      d="M32 4L8 14v18c0 13.2 10.3 25.6 24 28.6C45.7 57.6 56 45.2 56 32V14L32 4z"
      fill="#2563EB"
      fillOpacity="0.15"
      stroke="#3B82F6"
      strokeWidth="2"
      strokeLinejoin="round"
    />
    <path
      d="M32 12L14 20v14c0 9.9 7.7 19.2 18 21.5C42.3 53.2 50 43.9 50 34V20L32 12z"
      fill="#3B82F6"
      fillOpacity="0.25"
    />
    <path
      d="M24 32l5 5 11-11"
      stroke="#60A5FA"
      strokeWidth="2.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
)

const PILL_LINKS = [
  { label: 'Go Home', to: '/' },
  { label: 'Dashboard', to: '/dashboard' },
  { label: 'Contact Support', to: '/contact' },
]

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.1, delayChildren: 0.15 } },
}

const blurFade = {
  hidden: { opacity: 0, y: 14, filter: 'blur(6px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.55, ease: [0.22, 1, 0.36, 1] },
  },
}

export default function NotFound() {
  const navigate = useNavigate()

  return (
    <div
      style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* Minimal navbar */}
      <motion.nav
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        style={{
          padding: '20px 32px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{ background: 'none', border: 'none', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px', padding: 0 }}
          aria-label="FYPro home"
        >
          <img src="/fypro-logo.png" alt="FYPro" className="h-9 w-auto" />
        </button>
      </motion.nav>

      {/* Centered content */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '48px 24px' }}>
        <motion.div
          variants={stagger}
          initial="hidden"
          animate="visible"
          style={{ maxWidth: '512px', width: '100%', textAlign: 'center' }}
        >
          {/* 404 display */}
          <motion.div
            variants={blurFade}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              position: 'relative',
            }}
          >
            {/* Glow blob */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.3) 0%, transparent 70%)',
                filter: 'blur(32px)',
                pointerEvents: 'none',
              }}
            />

            <motion.span
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: '8rem',
                lineHeight: 1,
                color: '#ffffff',
                letterSpacing: '-0.05em',
                position: 'relative',
              }}
            >
              4
            </motion.span>

            {/* Floating shield replacing middle 0 */}
            <motion.div
              initial={{ opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1, y: [0, -8, 0] }}
              transition={{
                opacity: { delay: 0.3, duration: 0.5 },
                scale: { delay: 0.3, duration: 0.5, type: 'spring', stiffness: 180, damping: 14 },
                y: { delay: 0.8, duration: 3, repeat: Infinity, ease: 'easeInOut' },
              }}
              style={{
                width: '7.5rem',
                height: '8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
              }}
            >
              <ShieldIcon
                style={{
                  width: '100%',
                  height: '100%',
                  filter: 'drop-shadow(0 0 16px rgba(59,130,246,0.5))',
                }}
              />
            </motion.div>

            <motion.span
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: '8rem',
                lineHeight: 1,
                color: '#ffffff',
                letterSpacing: '-0.05em',
                position: 'relative',
              }}
            >
              4
            </motion.span>
          </motion.div>

          {/* Heading */}
          <motion.h1
            variants={blurFade}
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '2rem',
              color: '#ffffff',
              marginTop: '32px',
              marginBottom: 0,
              letterSpacing: '-0.02em',
            }}
          >
            Page not found.
          </motion.h1>

          {/* Subheading */}
          <motion.p
            variants={blurFade}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.875rem',
              color: '#94a3b8',
              marginTop: '12px',
              lineHeight: '1.7',
            }}
          >
            The page you are looking for does not exist or has been moved.
          </motion.p>

          {/* Pill links label */}
          <motion.p
            variants={blurFade}
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.65rem',
              textTransform: 'uppercase',
              letterSpacing: '0.12em',
              color: '#475569',
              marginTop: '40px',
              marginBottom: '16px',
            }}
          >
            Where would you like to go?
          </motion.p>

          {/* Pill links */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', justifyContent: 'center' }}>
            {PILL_LINKS.map(({ label, to }, i) => (
              <motion.button
                key={to}
                onClick={() => navigate(to)}
                initial={{ opacity: 0, scale: 0.88, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ delay: 0.55 + i * 0.09, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -3, borderColor: '#3b82f6', color: '#60a5fa', boxShadow: '0 4px 16px rgba(59,130,246,0.2)' }}
                whileTap={{ scale: 0.96 }}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '999px',
                  padding: '8px 24px',
                  fontSize: '0.875rem',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  transition: 'border-color 200ms ease, color 200ms ease, box-shadow 200ms ease',
                }}
              >
                {label}
              </motion.button>
            ))}
          </div>

          {/* Primary CTA */}
          <motion.div variants={blurFade}>
            <motion.button
              onClick={() => navigate('/')}
              whileHover={{ y: -3, backgroundColor: '#3b82f6', boxShadow: '0 8px 24px rgba(59,130,246,0.45)' }}
              whileTap={{ scale: 0.97 }}
              transition={{ duration: 0.15 }}
              style={{
                marginTop: '32px',
                backgroundColor: '#2563eb',
                color: '#ffffff',
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600,
                fontSize: '0.9375rem',
                borderRadius: '12px',
                padding: '12px 32px',
                border: 'none',
                cursor: 'pointer',
                display: 'inline-block',
                transition: 'background-color 200ms ease',
              }}
            >
              ← Back to safety
            </motion.button>
          </motion.div>

          {/* Bottom note */}
          <motion.p
            variants={blurFade}
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginTop: '48px',
            }}
          >
            If you think this is a mistake, please contact us at{' '}
            <span style={{ color: '#475569' }}>support@fypro.app</span>
          </motion.p>
        </motion.div>
      </div>
    </div>
  )
}
