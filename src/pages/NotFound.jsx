import { useNavigate } from 'react-router-dom'
import { useEffect, useRef } from 'react'

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

export default function NotFound() {
  const navigate = useNavigate()
  const contentRef = useRef(null)

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    requestAnimationFrame(() => {
      el.style.opacity = '1'
      el.style.transform = 'translateY(0)'
    })
  }, [])

  return (
    <div
      style={{ backgroundColor: 'var(--bg-base)', minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
    >
      {/* Minimal navbar */}
      <nav
        style={{
          padding: '20px 32px',
          borderBottom: '1px solid var(--border-subtle)',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <button
          onClick={() => navigate('/')}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: 0,
          }}
          aria-label="FYPro home"
        >
          <img src="/fypro-logo.png" alt="FYPro" height="36" style={{ objectFit: 'contain' }} />
        </button>
      </nav>

      {/* Centered content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '48px 24px',
        }}
      >
        <div
          ref={contentRef}
          style={{
            maxWidth: '512px',
            width: '100%',
            textAlign: 'center',
            opacity: 0,
            transform: 'translateY(16px)',
            transition: 'opacity 500ms ease, transform 500ms ease',
          }}
        >
          {/* 404 display */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '4px',
              position: 'relative',
            }}
          >
            {/* Glow blob behind */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'radial-gradient(ellipse at center, rgba(37,99,235,0.3) 0%, transparent 70%)',
                filter: 'blur(32px)',
                pointerEvents: 'none',
              }}
            />

            <span
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
            </span>

            {/* Shield replaces the middle 0 */}
            <div
              style={{
                width: '7.5rem',
                height: '8rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                position: 'relative',
                animation: 'shield-pulse 3s ease-in-out infinite',
              }}
            >
              <ShieldIcon
                style={{
                  width: '100%',
                  height: '100%',
                  filter: 'drop-shadow(0 0 16px rgba(59,130,246,0.5))',
                }}
              />
            </div>

            <span
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
            </span>
          </div>

          {/* Heading */}
          <h1
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
          </h1>

          {/* Subheading */}
          <p
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.875rem',
              color: '#94a3b8',
              marginTop: '12px',
              lineHeight: '1.7',
            }}
          >
            The page you are looking for does not exist or has been moved.
          </p>

          {/* Helpful links */}
          <p
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
          </p>

          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '12px',
              justifyContent: 'center',
            }}
          >
            {PILL_LINKS.map(({ label, to }) => (
              <button
                key={to}
                onClick={() => navigate(to)}
                style={{
                  backgroundColor: 'var(--bg-card)',
                  border: '1px solid var(--border-color)',
                  borderRadius: '999px',
                  padding: '8px 24px',
                  fontSize: '0.875rem',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  fontFamily: "'Poppins', sans-serif",
                  transition: 'border-color 200ms ease, color 200ms ease',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.borderColor = '#3b82f6'
                  e.currentTarget.style.color = '#60a5fa'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.borderColor = 'var(--border-color)'
                  e.currentTarget.style.color = '#94a3b8'
                }}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Primary CTA */}
          <button
            onClick={() => navigate('/')}
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
              transition: 'background-color 200ms ease, transform 200ms ease, box-shadow 200ms ease',
              display: 'inline-block',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.backgroundColor = '#3b82f6'
              e.currentTarget.style.transform = 'translateY(-2px)'
              e.currentTarget.style.boxShadow = '0 8px 20px rgba(59,130,246,0.4)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.backgroundColor = '#2563eb'
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'none'
            }}
          >
            ← Back to safety
          </button>

          {/* Bottom note */}
          <p
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.75rem',
              color: 'var(--text-muted)',
              marginTop: '48px',
            }}
          >
            If you think this is a mistake, please contact us at{' '}
            <span style={{ color: '#475569' }}>support@fypro.app</span>
          </p>
        </div>
      </div>

      {/* Shield pulse keyframes injected via a style tag */}
      <style>{`
        @keyframes shield-pulse {
          0%, 100% { transform: scale(1); }
          50%       { transform: scale(1.05); }
        }
      `}</style>
    </div>
  )
}
