import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'
import FyproLogo from '../components/FyproLogo'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

export default function VerifyCertificate() {
  const { certNumber } = useParams()
  const { isDark } = useTheme()
  const [state, setState] = useState('loading') // 'loading' | 'valid' | 'invalid' | 'error'
  const [cert, setCert] = useState(null)

  useEffect(() => {
    if (!certNumber) { setState('invalid'); return }
    fetch(`/api/certificate?action=verify&cert=${encodeURIComponent(certNumber)}`)
      .then(async r => {
        const data = await r.json()
        if (r.status === 404 || (r.ok && !data.valid)) { setState('invalid'); return }
        if (!r.ok) { setState('error'); return }
        setCert(data.certificate)
        setState('valid')
      })
      .catch(() => setState('error'))
  }, [certNumber])

  const bg   = isDark ? '#060E18' : '#F0F4F8'
  const card = isDark
    ? 'linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.025) 100%)'
    : 'linear-gradient(145deg, #ffffff 0%, #f8faff 100%)'
  const border = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(13,27,42,0.1)'
  const text   = isDark ? '#FFFFFF' : '#0D1B2A'
  const muted  = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(13,27,42,0.5)'

  return (
    <div style={{
      minHeight: '100vh',
      background: bg,
      backgroundImage: 'radial-gradient(circle, rgba(0,102,255,0.06) 1px, transparent 1px)',
      backgroundSize: '28px 28px',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '32px 16px',
      fontFamily: "'Poppins', sans-serif",
    }}>
      {/* Logo */}
      <Link to="/" style={{ textDecoration: 'none', marginBottom: 40 }}>
        <FyproLogo height={36} />
      </Link>

      <div style={{
        width: '100%',
        maxWidth: 520,
        background: card,
        border: `1px solid ${border}`,
        borderRadius: 16,
        padding: '40px 36px',
        boxShadow: isDark
          ? '0 8px 40px rgba(0,0,0,0.5)'
          : '0 8px 40px rgba(0,0,0,0.08)',
        textAlign: 'center',
        animation: 'card-enter 0.4s ease forwards',
      }}>

        {state === 'loading' && (
          <div style={{ color: muted, fontSize: '0.9rem' }}>Verifying certificate...</div>
        )}

        {state === 'valid' && cert && (
          <>
            {/* Badge */}
            <div style={{
              width: 64, height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #16A34A 0%, #15803D 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 24px rgba(22,163,74,0.4)',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M9 12l2 2 4-4" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                <circle cx="12" cy="12" r="9" stroke="#fff" strokeWidth="2"/>
              </svg>
            </div>

            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.7rem',
              fontWeight: 700,
              background: '#16A34A',
              color: '#fff',
              padding: '4px 14px',
              borderRadius: 999,
              display: 'inline-block',
              letterSpacing: '0.5px',
              marginBottom: 20,
            }}>VERIFIED</div>

            <h1 style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: '1.5rem',
              color: text,
              margin: '0 0 6px',
            }}>Certificate of Defense Readiness</h1>

            <p style={{ color: muted, fontSize: '0.85rem', margin: '0 0 28px' }}>
              This certificate has been verified as authentic.
            </p>

            <div style={{
              background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,102,255,0.04)',
              border: `1px solid ${isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,102,255,0.12)'}`,
              borderRadius: 12,
              padding: '20px 24px',
              textAlign: 'left',
              marginBottom: 24,
            }}>
              {[
                ['Recipient',   cert.recipient_name],
                ['Topic',       cert.topic_title],
                ['Department',  [cert.department, cert.faculty].filter(Boolean).join(', ') || '—'],
                ['Score',       `${cert.score}/10`],
                ['Issued',      formatDate(cert.issued_at)],
                ['Certificate', cert.certificate_number],
              ].map(([label, value]) => (
                <div key={label} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  gap: 12,
                  padding: '8px 0',
                  borderBottom: `1px solid ${border}`,
                  fontSize: '0.85rem',
                }}>
                  <span style={{ color: muted, whiteSpace: 'nowrap' }}>{label}</span>
                  <span style={{
                    color: label === 'Score' ? '#16A34A' : text,
                    fontWeight: label === 'Score' || label === 'Certificate' ? 700 : 500,
                    fontFamily: label === 'Certificate' || label === 'Score'
                      ? "'JetBrains Mono', monospace" : 'inherit',
                    fontSize: label === 'Certificate' ? '0.75rem' : '0.85rem',
                    textAlign: 'right',
                  }}>{value || '—'}</span>
                </div>
              ))}
            </div>

            <p style={{ color: muted, fontSize: '0.75rem', margin: 0 }}>
              Issued by FYPro · fypro.com.ng
            </p>
          </>
        )}

        {state === 'invalid' && (
          <>
            <div style={{
              width: 64, height: 64,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #DC2626 0%, #B91C1C 100%)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 20px',
              boxShadow: '0 0 24px rgba(220,38,38,0.35)',
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                <path d="M6 6l12 12M6 18L18 6" stroke="#fff" strokeWidth="2.5" strokeLinecap="round"/>
              </svg>
            </div>
            <div style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.7rem',
              fontWeight: 700,
              background: '#DC2626',
              color: '#fff',
              padding: '4px 14px',
              borderRadius: 999,
              display: 'inline-block',
              letterSpacing: '0.5px',
              marginBottom: 20,
            }}>NOT FOUND</div>
            <h1 style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: '1.4rem',
              color: text,
              margin: '0 0 10px',
            }}>Certificate Not Found</h1>
            <p style={{ color: muted, fontSize: '0.85rem', margin: '0 0 24px' }}>
              No certificate matching <code style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.8rem',
                background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)',
                padding: '2px 8px',
                borderRadius: 6,
              }}>{certNumber}</code> was found. It may be invalid or not yet issued.
            </p>
            <p style={{ color: muted, fontSize: '0.75rem', margin: 0 }}>
              If you believe this is an error, contact{' '}
              <a href="mailto:hello@fypro.com.ng" style={{ color: '#0066FF' }}>hello@fypro.com.ng</a>
            </p>
          </>
        )}

        {state === 'error' && (
          <>
            <div style={{ fontSize: '2.5rem', marginBottom: 16 }}>⚠️</div>
            <h1 style={{
              fontFamily: "'DM Serif Display', Georgia, serif",
              fontSize: '1.4rem',
              color: text,
              margin: '0 0 10px',
            }}>Verification Unavailable</h1>
            <p style={{ color: muted, fontSize: '0.85rem', margin: 0 }}>
              Could not reach the verification service. Please try again in a moment.
            </p>
          </>
        )}
      </div>

      <style>{`
        @keyframes card-enter {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}
