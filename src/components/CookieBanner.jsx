import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import posthog from 'posthog-js'
import { useTheme } from '../context/ThemeContext'

export default function CookieBanner() {
  const [visible, setVisible] = useState(false)
  const { theme } = useTheme()
  const isLight = theme === 'light'

  useEffect(() => {
    if (!localStorage.getItem('cookie_consent')) setVisible(true)
  }, [])

  function handleAccept() {
    localStorage.setItem('cookie_consent', 'accepted')
    posthog.opt_in_capturing()
    setVisible(false)
  }

  function handleDecline() {
    localStorage.setItem('cookie_consent', 'declined')
    posthog.opt_out_capturing()
    setVisible(false)
  }

  if (!visible) return null

  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        background: isLight ? '#FFFFFF' : '#060E18',
        borderTop: isLight ? '1px solid rgba(13,27,42,0.12)' : '1px solid rgba(255,255,255,0.1)',
        padding: '14px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '12px',
        boxShadow: isLight ? '0 -4px 24px rgba(0,0,0,0.08)' : '0 -4px 24px rgba(0,0,0,0.5)',
      }}
    >
      <p
        style={{
          color: isLight ? 'rgba(13,27,42,0.7)' : 'rgba(255,255,255,0.75)',
          fontSize: '0.8125rem',
          fontFamily: 'Poppins, sans-serif',
          margin: 0,
          flex: 1,
          minWidth: 240,
          lineHeight: 1.5,
        }}
      >
        We use cookies to improve your experience and analyse usage. By continuing, you accept our use of cookies.{' '}
        <Link
          to="/cookie-policy"
          style={{ color: '#3B82F6', textDecoration: 'underline', whiteSpace: 'nowrap' }}
        >
          Cookie Policy
        </Link>
      </p>

      <div style={{ display: 'flex', gap: '10px', flexShrink: 0 }}>
        <button
          onClick={handleDecline}
          style={{
            padding: '7px 18px',
            background: 'transparent',
            color: isLight ? 'rgba(13,27,42,0.55)' : 'rgba(255,255,255,0.65)',
            border: isLight ? '1px solid rgba(13,27,42,0.2)' : '1px solid rgba(255,255,255,0.22)',
            borderRadius: '10px',
            fontSize: '0.8125rem',
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Decline
        </button>
        <button
          onClick={handleAccept}
          style={{
            padding: '7px 18px',
            background: '#0066FF',
            color: '#ffffff',
            border: 'none',
            borderRadius: '10px',
            fontSize: '0.8125rem',
            fontFamily: 'Poppins, sans-serif',
            fontWeight: 600,
            cursor: 'pointer',
            whiteSpace: 'nowrap',
          }}
        >
          Accept
        </button>
      </div>
    </div>
  )
}
