import { useEffect, useState } from 'react'
import FyproLogo from '../components/FyproLogo'

const WA_URL = 'https://wa.me/2348029061967?text=Hi%2C%20FYPro%20seems%20to%20be%20in%20maintenance%20and%20I%20need%20urgent%20help.'

const DEFAULT_MESSAGE =
  'FYPro is currently undergoing scheduled maintenance. We’re working to improve your experience.'

export default function MaintenancePage() {
  const [message, setMessage] = useState('')

  useEffect(() => {
    fetch('/api/admin?action=maintenance-info')
      .then(r => r.json())
      .then(d => { if (d.maintenance_message) setMessage(d.maintenance_message) })
      .catch(() => {})
  }, [])

  return (
    <div style={{
      minHeight:       '100vh',
      background:      'var(--color-bg-deep)',
      display:         'flex',
      flexDirection:   'column',
      alignItems:      'center',
      justifyContent:  'center',
      padding:         '40px 24px',
      fontFamily:      "'Poppins', sans-serif",
      textAlign:       'center',
      position:        'relative',
      overflow:        'hidden',
    }}>
      <style>{`
        @keyframes statusPulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.4; transform: scale(1.15); }
        }
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @media (prefers-reduced-motion: reduce) {
          .mp-status-dot { animation: none !important; }
          .mp-card       { animation: none !important; }
        }
      `}</style>

      {/* Subtle background glow */}
      <div style={{
        position:  'absolute',
        top:       '30%',
        left:      '50%',
        transform: 'translate(-50%, -50%)',
        width:     '600px',
        height:    '600px',
        borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(245,158,11,0.06) 0%, transparent 70%)',
        pointerEvents: 'none',
      }} />

      <div
        className="mp-card"
        style={{
          position:     'relative',
          zIndex:       1,
          maxWidth:     '480px',
          width:        '100%',
          animation:    'fadeUp 0.5s ease forwards',
        }}
      >
        {/* Logo */}
        <div style={{ marginBottom: '32px' }}>
          <FyproLogo style={{ height: '40px', opacity: 0.9 }} />
        </div>

        {/* Status indicator */}
        <div style={{
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            '10px',
          marginBottom:   '24px',
        }}>
          <div
            className="mp-status-dot"
            style={{
              width:       '10px',
              height:      '10px',
              borderRadius: '50%',
              background:   'var(--color-amber)',
              animation:    'statusPulse 2s ease-in-out infinite',
              flexShrink:   0,
            }}
          />
          <span style={{
            fontFamily:    "'JetBrains Mono', monospace",
            fontSize:      '0.75rem',
            fontWeight:    700,
            color:         'var(--color-amber)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}>
            Under Maintenance
          </span>
        </div>

        {/* Heading */}
        <h1 style={{
          fontFamily:   "'DM Serif Display', serif",
          fontSize:     'clamp(2rem, 8vw, 2.75rem)',
          fontWeight:   400,
          color:        'var(--color-text-white)',
          lineHeight:   1.2,
          margin:       '0 0 20px',
        }}>
          We&rsquo;ll be right back
        </h1>

        {/* Body message */}
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize:   'clamp(0.875rem, 3vw, 1rem)',
          color:      'var(--color-text-white-dim)',
          lineHeight: 1.7,
          margin:     '0 0 40px',
          maxWidth:   '400px',
          marginLeft: 'auto',
          marginRight: 'auto',
        }}>
          {message || DEFAULT_MESSAGE}
        </p>

        {/* Divider */}
        <div style={{
          width:        '48px',
          height:       '1px',
          background:   'rgba(255,255,255,0.12)',
          margin:       '0 auto 32px',
        }} />

        {/* WhatsApp support link */}
        <a
          href={WA_URL}
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            gap:            '8px',
            fontFamily:     "'Poppins', sans-serif",
            fontSize:       '0.875rem',
            fontWeight:     500,
            color:          'rgba(255,255,255,0.5)',
            textDecoration: 'none',
            transition:     'color 0.15s ease',
          }}
          onMouseEnter={e => { e.currentTarget.style.color = '#25D366' }}
          onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.5)' }}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            width="16"
            height="16"
            fill="currentColor"
            aria-hidden="true"
          >
            <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
          </svg>
          Need urgent help? Chat with us
        </a>
      </div>
    </div>
  )
}
