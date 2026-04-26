import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

const CONFETTI_COLORS = [
  '#3B82F6', '#60A5FA', '#22C55E', '#4ADE80',
  '#FFFFFF', '#93C5FD', '#86EFAC', '#BFDBFE',
]

function generateConfetti(count = 28) {
  return Array.from({ length: count }, (_, i) => ({
    id: i,
    color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
    left: 30 + Math.random() * 40,
    delay: Math.random() * 0.6,
    duration: 1.2 + Math.random() * 0.8,
    size: 5 + Math.random() * 5,
    angle: -60 + Math.random() * 120,
    distance: 80 + Math.random() * 120,
  }))
}

const confettiPieces = generateConfetti()

function formatDate(date) {
  return date.toLocaleDateString('en-NG', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

export default function PaymentSuccess() {
  const navigate = useNavigate()
  const [iconVisible, setIconVisible] = useState(false)
  const [checkVisible, setCheckVisible] = useState(false)
  const [confettiActive, setConfettiActive] = useState(true)

  useEffect(() => {
    const t1 = setTimeout(() => setIconVisible(true), 80)
    const t2 = setTimeout(() => setCheckVisible(true), 480)
    const t3 = setTimeout(() => setConfettiActive(false), 2200)
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3) }
  }, [])

  const today = formatDate(new Date())

  return (
    <div style={styles.page}>
      {/* Confetti */}
      {confettiActive && (
        <div style={styles.confettiContainer}>
          {confettiPieces.map((p) => (
            <div
              key={p.id}
              style={{
                position: 'absolute',
                left: `${p.left}%`,
                top: '50%',
                width: p.size,
                height: p.size,
                borderRadius: Math.random() > 0.5 ? '50%' : '2px',
                backgroundColor: p.color,
                opacity: 0,
                animation: `confetti-fly ${p.duration}s ease-out ${p.delay}s forwards`,
                '--angle': `${p.angle}deg`,
                '--distance': `${p.distance}px`,
              }}
            />
          ))}
        </div>
      )}

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=Poppins:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap');

        @keyframes icon-pop {
          0%   { transform: scale(0); opacity: 0; }
          70%  { transform: scale(1.1); opacity: 1; }
          100% { transform: scale(1); opacity: 1; }
        }

        @keyframes check-draw {
          from { stroke-dashoffset: 50; opacity: 0; }
          to   { stroke-dashoffset: 0;  opacity: 1; }
        }

        @keyframes confetti-fly {
          0%   { opacity: 1; transform: translate(0, 0) rotate(0deg); }
          100% { opacity: 0; transform: translate(calc(sin(var(--angle)) * var(--distance)), calc(-1 * var(--distance))) rotate(360deg); }
        }

        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        .ps-card { animation: fade-up 0.45s ease forwards; }

        .ps-btn-primary:hover {
          background-color: #3B82F6 !important;
          transform: translateY(-2px);
          box-shadow: 0 8px 20px rgba(59,130,246,0.4) !important;
        }

        .ps-btn-primary { transition: background-color 0.2s ease, transform 0.2s ease, box-shadow 0.2s ease; }

        .ps-link:hover { color: #60A5FA !important; }
        .ps-link { transition: color 0.2s ease; }
      `}</style>

      <div style={styles.center}>
        <div className="ps-card" style={styles.card}>

          {/* Success icon */}
          <div style={styles.iconWrap}>
            <div
              style={{
                ...styles.iconCircle,
                transform: iconVisible ? 'scale(1)' : 'scale(0)',
                opacity: iconVisible ? 1 : 0,
                transition: 'transform 0.4s cubic-bezier(0.34,1.56,0.64,1), opacity 0.3s ease',
              }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 40 40"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                <polyline
                  points="8,20 16,28 32,12"
                  stroke="#4ADE80"
                  strokeWidth="3.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  strokeDasharray="50"
                  style={{
                    strokeDashoffset: checkVisible ? 0 : 50,
                    opacity: checkVisible ? 1 : 0,
                    transition: 'stroke-dashoffset 0.35s ease 0.05s, opacity 0.2s ease',
                  }}
                />
              </svg>
            </div>
          </div>

          {/* Heading */}
          <h1 style={styles.heading}>Payment Successful</h1>

          {/* Subheading */}
          <p style={styles.subheading}>
            Your plan has been activated. You're ready to continue your FYP journey.
          </p>

          {/* Order summary */}
          <div style={styles.summaryCard}>
            <Row label="Plan" value="Student Plan" valueStyle={styles.valueWhite} />
            <Row label="Amount" value="₦2,000" valueStyle={styles.valueWhite} />
            <Row
              label="Reference"
              value="FYP-2026-XXXXXX"
              valueStyle={styles.valueMono}
            />
            <Row label="Date" value={today} valueStyle={styles.valueSlate} />
            <Row
              label="Status"
              value={<StatusBadge />}
              noBorder
            />
          </div>

          {/* Email notice */}
          <div style={styles.emailNotice}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#475569" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ marginRight: 6, flexShrink: 0 }}>
              <rect x="2" y="4" width="20" height="16" rx="2" />
              <path d="m2 7 10 7 10-7" />
            </svg>
            A receipt has been sent to your email address.
          </div>

          {/* Primary button */}
          <button
            className="ps-btn-primary"
            style={styles.btnPrimary}
            onClick={() => navigate('/dashboard')}
          >
            Continue to Dashboard
          </button>

          {/* Secondary link */}
          <a
            className="ps-link"
            style={styles.secondaryLink}
            onClick={() => navigate('/dashboard')}
            role="button"
          >
            View all projects
          </a>

          {/* Bottom note */}
          <p style={styles.bottomNote}>
            Need help? Contact us at&nbsp;
            <span style={{ color: '#475569' }}>support@fypro.app</span>
          </p>
        </div>
      </div>
    </div>
  )
}

function Row({ label, value, valueStyle, noBorder }) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingBottom: noBorder ? 0 : 12,
        marginBottom: noBorder ? 0 : 12,
        borderBottom: noBorder ? 'none' : '1px solid var(--border-color)',
      }}
    >
      <span style={styles.rowLabel}>{label}</span>
      {typeof value === 'string' ? (
        <span style={valueStyle}>{value}</span>
      ) : (
        value
      )}
    </div>
  )
}

function StatusBadge() {
  return (
    <span style={styles.badge}>Confirmed</span>
  )
}

const styles = {
  page: {
    minHeight: '100vh',
    backgroundColor: 'var(--bg-base)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Poppins', sans-serif",
    position: 'relative',
    overflow: 'hidden',
    padding: '24px 16px',
  },
  confettiContainer: {
    position: 'fixed',
    inset: 0,
    pointerEvents: 'none',
    zIndex: 50,
  },
  center: {
    width: '100%',
    maxWidth: 448,
    margin: '0 auto',
  },
  card: {
    backgroundColor: 'var(--bg-card)',
    borderRadius: 16,
    border: '1px solid var(--border-color)',
    padding: '40px 40px 36px',
    width: '100%',
    boxShadow: '0 8px 40px rgba(59,130,246,0.06)',
  },
  iconWrap: {
    display: 'flex',
    justifyContent: 'center',
  },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: '50%',
    backgroundColor: 'rgba(34,197,94,0.1)',
    border: '2px solid rgba(34,197,94,0.3)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  heading: {
    fontFamily: "'DM Serif Display', serif",
    fontSize: '1.875rem',
    color: '#FFFFFF',
    textAlign: 'center',
    marginTop: 24,
    marginBottom: 0,
    fontWeight: 400,
    lineHeight: 1.2,
  },
  subheading: {
    fontFamily: "'Poppins', sans-serif",
    color: '#94A3B8',
    fontSize: '0.875rem',
    textAlign: 'center',
    marginTop: 10,
    lineHeight: 1.6,
    maxWidth: 280,
    marginLeft: 'auto',
    marginRight: 'auto',
  },
  summaryCard: {
    backgroundColor: 'var(--bg-input)',
    borderRadius: 12,
    border: '1px solid var(--border-color)',
    padding: '20px 20px 20px',
    marginTop: 28,
    width: '100%',
  },
  rowLabel: {
    color: '#64748B',
    fontSize: '0.8125rem',
    fontFamily: "'Poppins', sans-serif",
  },
  valueWhite: {
    color: '#FFFFFF',
    fontSize: '0.875rem',
    fontWeight: 500,
    fontFamily: "'Poppins', sans-serif",
  },
  valueMono: {
    color: '#94A3B8',
    fontSize: '0.75rem',
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.02em',
  },
  valueSlate: {
    color: '#94A3B8',
    fontSize: '0.875rem',
    fontFamily: "'Poppins', sans-serif",
  },
  badge: {
    backgroundColor: 'rgba(34,197,94,0.15)',
    color: '#4ADE80',
    border: '1px solid rgba(34,197,94,0.3)',
    borderRadius: 999,
    padding: '4px 12px',
    fontSize: '0.7rem',
    fontWeight: 600,
    fontFamily: "'JetBrains Mono', monospace",
    letterSpacing: '0.04em',
    display: 'inline-block',
  },
  emailNotice: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: '#475569',
    fontSize: '0.75rem',
    textAlign: 'center',
    marginTop: 16,
    fontFamily: "'Poppins', sans-serif",
  },
  btnPrimary: {
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
    letterSpacing: '0.01em',
  },
  secondaryLink: {
    display: 'block',
    textAlign: 'center',
    color: '#64748B',
    fontSize: '0.875rem',
    marginTop: 16,
    cursor: 'pointer',
    textDecoration: 'none',
    fontFamily: "'Poppins', sans-serif",
  },
  bottomNote: {
    color: '#334155',
    fontSize: '0.75rem',
    textAlign: 'center',
    marginTop: 28,
    fontFamily: "'Poppins', sans-serif",
  },
}
