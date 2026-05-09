import { useEffect, useState } from 'react'
import { readRefFromUrl, storeRef, getStoredRef } from '../../lib/referral'

export default function ReferralCapture() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    // Read ?ref= from the current URL and persist it
    const fromUrl = readRefFromUrl()
    if (fromUrl) {
      storeRef(fromUrl)
    }

    // Show banner if any ref code is stored (from URL or a previous visit)
    const stored = getStoredRef()
    if (stored) setShow(true)
  }, [])

  if (!show) return null

  return (
    <div
      role="status"
      style={{
        position: 'fixed',
        bottom: '24px',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        background: 'linear-gradient(135deg, #0D1B2A 0%, #0F2235 100%)',
        border: '1px solid rgba(0,102,255,0.35)',
        borderRadius: '999px',
        padding: '10px 20px',
        boxShadow: '0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(0,102,255,0.12)',
        maxWidth: '90vw',
        whiteSpace: 'nowrap',
        animation: 'rc-slide-up 0.35s cubic-bezier(0.22,1,0.36,1) forwards',
      }}
    >
      <span style={{ fontSize: '1rem' }} aria-hidden="true">🎁</span>
      <span style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize: '0.8125rem',
        color: 'rgba(255,255,255,0.9)',
      }}>
        Invited by a friend — sign up for{' '}
        <strong style={{ color: '#ffffff' }}>1 free Defense session</strong>
      </span>
      <a
        href="/signup"
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.75rem',
          fontWeight: 600,
          color: '#ffffff',
          background: '#0066FF',
          padding: '5px 14px',
          borderRadius: '999px',
          textDecoration: 'none',
          flexShrink: 0,
          transition: 'background 0.15s ease',
        }}
        onMouseOver={(e) => { e.currentTarget.style.background = '#0052CC' }}
        onMouseOut={(e) => { e.currentTarget.style.background = '#0066FF' }}
      >
        Sign up free
      </a>
      <button
        onClick={() => setShow(false)}
        aria-label="Dismiss"
        style={{
          background: 'none',
          border: 'none',
          color: 'rgba(255,255,255,0.4)',
          cursor: 'pointer',
          padding: '0 2px',
          fontSize: '1rem',
          lineHeight: 1,
          flexShrink: 0,
          transition: 'color 0.15s ease',
        }}
        onMouseOver={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)' }}
        onMouseOut={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.4)' }}
      >
        ✕
      </button>

      <style>{`
        @keyframes rc-slide-up {
          from { opacity: 0; transform: translateX(-50%) translateY(16px); }
          to   { opacity: 1; transform: translateX(-50%) translateY(0); }
        }
      `}</style>
    </div>
  )
}
