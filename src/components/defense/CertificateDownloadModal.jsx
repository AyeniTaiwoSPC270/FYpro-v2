import { useState } from 'react'
import { downloadCertificate } from '../../lib/certificate'
import { supabase } from '../../lib/supabase'
import Sentry from '../../lib/sentry'
import { useTheme } from '../../context/ThemeContext'
import { checkAchievements } from '../../lib/checkAchievements'
import { showToast } from '../Toast'

const STYLES = [
  {
    id:    'modern',
    label: 'Modern Bold',
    desc:  'Clean white, blue bars',
    preview: (
      <div style={{ background: '#fff', borderRadius: 4, overflow: 'hidden', height: 52, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#0066FF', height: 5 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '4px 6px' }}>
          <div style={{ background: '#F0FFF4', borderLeft: '2px solid #16A34A', width: '100%', padding: '2px 4px' }}>
            <div style={{ fontSize: 5, color: '#16A34A', fontWeight: 700, letterSpacing: 1 }}>CERTIFIED</div>
          </div>
          <div style={{ width: 28, height: 2, background: '#0066FF', borderRadius: 2 }} />
          <div style={{ width: 22, height: 1.5, background: '#E5E7EB', borderRadius: 1 }} />
        </div>
        <div style={{ background: '#0066FF', height: 5 }} />
      </div>
    ),
  },
  {
    id:    'prestige',
    label: 'Academic Prestige',
    desc:  'Ivory, gold border',
    preview: (
      <div style={{ background: '#FFFDF5', border: '1.5px solid #C9A84C', borderRadius: 4, height: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative', padding: 6 }}>
        <div style={{ position: 'absolute', top: 3, left: 3, width: 8, height: 8, borderTop: '1.5px solid #C9A84C', borderLeft: '1.5px solid #C9A84C' }} />
        <div style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderTop: '1.5px solid #C9A84C', borderRight: '1.5px solid #C9A84C' }} />
        <div style={{ position: 'absolute', bottom: 3, left: 3, width: 8, height: 8, borderBottom: '1.5px solid #C9A84C', borderLeft: '1.5px solid #C9A84C' }} />
        <div style={{ position: 'absolute', bottom: 3, right: 3, width: 8, height: 8, borderBottom: '1.5px solid #C9A84C', borderRight: '1.5px solid #C9A84C' }} />
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 6, color: '#fff', fontWeight: 700 }}>FY</span>
        </div>
        <div style={{ width: 28, height: 1.5, background: '#C9A84C', borderRadius: 1 }} />
        <div style={{ width: 22, height: 1, background: 'rgba(201,168,76,0.4)', borderRadius: 1 }} />
      </div>
    ),
  },
  {
    id:    'dark',
    label: 'Dark Premium',
    desc:  'Navy, blue glow',
    preview: (
      <div style={{ background: 'linear-gradient(145deg,#0D1B2A,#060E18)', border: '1px solid rgba(0,102,255,0.3)', borderRadius: 4, height: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: 6, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: '#0066FF' }} />
        <div style={{ fontSize: 7, color: '#fff', letterSpacing: 2, fontFamily: 'Georgia,serif' }}>FYPro</div>
        <div style={{ width: 22, height: 1.5, background: 'rgba(0,102,255,0.8)' }} />
        <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,0.3)', borderRadius: 1 }} />
        <div style={{ width: 22, height: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 1 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, background: '#0066FF' }} />
      </div>
    ),
  },
]

const ORIENTATIONS = [
  { id: 'portrait',  label: 'Portrait',  sub: '210 × 297 mm' },
  { id: 'landscape', label: 'Landscape', sub: '297 × 210 mm' },
]

export default function CertificateDownloadModal({ isOpen, onClose, defenseSessionId, topic, isExpress = false, projectId = null }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [style,       setStyle]       = useState(() => localStorage.getItem('cert_style')       || 'modern')
  const [orientation, setOrientation] = useState(() => localStorage.getItem('cert_orientation') || 'portrait')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  if (!isOpen) return null

  async function handleDownload() {
    setError(null)
    setLoading(true)
    localStorage.setItem('cert_style',       style)
    localStorage.setItem('cert_orientation', orientation)
    try {
      await downloadCertificate(defenseSessionId, style, orientation)
      checkAchievements({ projectId: isExpress ? projectId : null })
        .then(newKeys => { if (newKeys.length > 0) showToast('Achievement unlocked 🏅', 'success') })
        .catch(() => {})
      onClose()
    } catch (err) {
      if (err.message === 'NAME_REQUIRED') {
        setError('NAME_REQUIRED')
      } else {
        const sentryErr = err instanceof Error ? err : new Error(String(err))
        supabase.auth.getUser()
          .then(({ data }) => {
            Sentry.withScope(scope => {
              scope.setTag('feature', 'certificate_generation')
              scope.setExtra('defense_session_id', defenseSessionId)
              scope.setExtra('style', style)
              scope.setExtra('orientation', orientation)
              if (data?.user?.id) scope.setUser({ id: data.user.id })
              Sentry.captureException(sentryErr)
            })
          })
          .catch(() => Sentry.captureException(sentryErr))
        setError(err.message || 'certificate_failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const bg      = isDark ? '#0D1B2A' : '#FFFFFF'
  const overlay = 'rgba(0,0,0,0.6)'
  const border  = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(13,27,42,0.12)'
  const text1   = isDark ? '#FFFFFF'               : '#0D1B2A'
  const text2   = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(13,27,42,0.55)'
  const label   = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(13,27,42,0.4)'

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div style={{
        background: bg, borderRadius: 16, border: `1px solid ${border}`,
        padding: '28px 24px', width: '100%', maxWidth: 400,
        boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 24px 64px rgba(0,0,0,0.15)',
        animation: 'card-enter 0.2s ease forwards',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.1rem', color: text1, margin: 0, marginBottom: 4 }}>
              Download Certificate
            </p>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', color: text2, margin: 0 }}>
              Choose your style and format
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(13,27,42,0.06)',
              border: 'none', color: text2, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Style picker */}
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: label, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>
          Style
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
          {STYLES.map(s => {
            const active = style === s.id
            return (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                style={{
                  border:       active ? '2px solid #0066FF' : `1.5px solid ${border}`,
                  borderRadius: 10, padding: '10px 6px', textAlign: 'center',
                  background:   active ? (isDark ? 'rgba(0,102,255,0.1)' : '#EFF6FF') : 'transparent',
                  cursor: 'pointer', position: 'relative', transition: 'all 0.15s ease',
                }}
              >
                {active && (
                  <div style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 14, height: 14, background: '#0066FF', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, color: '#fff',
                  }}>✓</div>
                )}
                <div style={{ marginBottom: 6 }}>{s.preview}</div>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.6rem', color: active ? '#0066FF' : text2, margin: 0, lineHeight: 1.3, fontWeight: active ? 600 : 400 }}>
                  {s.label}
                </p>
              </button>
            )
          })}
        </div>

        {/* Orientation toggle */}
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: label, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>
          Orientation
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
          {ORIENTATIONS.map(o => {
            const active   = orientation === o.id
            const isPortrait = o.id === 'portrait'
            return (
              <button
                key={o.id}
                onClick={() => setOrientation(o.id)}
                style={{
                  border:       active ? '2px solid #0066FF' : `1.5px solid ${border}`,
                  borderRadius: 10, padding: '12px', cursor: 'pointer',
                  background:   active ? (isDark ? 'rgba(0,102,255,0.1)' : '#EFF6FF') : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Page icon */}
                <div style={{
                  width:        isPortrait ? 16 : 22,
                  height:       isPortrait ? 22 : 16,
                  background:   active ? 'rgba(0,102,255,0.15)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(13,27,42,0.06)'),
                  border:       active ? '1.5px solid rgba(0,102,255,0.5)' : `1.5px solid ${border}`,
                  borderRadius: 2, flexShrink: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 2,
                }}>
                  <div style={{ width: '80%', height: 1.5, background: active ? '#0066FF' : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(13,27,42,0.3)'), borderRadius: 1 }} />
                  <div style={{ width: '70%', height: 1, background: active ? 'rgba(0,102,255,0.5)' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(13,27,42,0.2)'), borderRadius: 1 }} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: active ? '#0066FF' : text1, margin: 0, fontWeight: active ? 600 : 400 }}>
                    {o.label}
                  </p>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.62rem', color: text2, margin: 0 }}>
                    {o.sub}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Errors */}
        {error === 'NAME_REQUIRED' && (
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: '#DC2626', marginBottom: 10 }}>
            Please set your full name in your{' '}
            <a href="/profile" style={{ color: '#60A5FA', textDecoration: 'underline' }}>profile</a>{' '}
            before downloading.
          </p>
        )}
        {error && error !== 'NAME_REQUIRED' && (
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: '#DC2626', marginBottom: 10 }}>
            Download failed. Please try again or{' '}
            <a href="https://wa.me/2348029061967" target="_blank" rel="noopener noreferrer" style={{ color: '#4ADE80', textDecoration: 'underline' }}>contact us on WhatsApp</a>.
          </p>
        )}

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={loading}
          style={{
            width: '100%', padding: '13px', borderRadius: 10,
            background: loading ? 'rgba(22,163,74,0.5)' : '#16A34A',
            color: '#FFFFFF', border: 'none',
            fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.875rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease', marginBottom: 10,
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 0 20px rgba(22,163,74,0.35)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
        >
          {loading ? 'Generating your certificate…' : '⬇ Download PDF'}
        </button>

        {/* Cancel */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: text2 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
