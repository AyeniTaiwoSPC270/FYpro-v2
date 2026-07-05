import { useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchShareCardBlob, shareToWhatsApp } from '../../lib/shareCard'
import { supabase } from '../../lib/supabase'
import Sentry from '../../lib/sentry'
import { useTheme } from '../../context/ThemeContext'

const STYLES = [
  {
    id:    'dark',
    label: 'Dark Premium',
    desc:  'Navy, blue glow',
    preview: (
      <div style={{ background: 'linear-gradient(160deg,#060E18,#0D1B2A)', borderRadius: 4, overflow: 'hidden', height: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: 6 }}>
        <div style={{ fontSize: 6, color: '#fff', fontFamily: 'Georgia,serif', letterSpacing: 1 }}>FYPro</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#16A34A', fontFamily: 'monospace' }}>8<span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>/10</span></div>
        <div style={{ width: 28, height: 1.5, background: '#0066FF', borderRadius: 1, opacity: 0.8 }} />
      </div>
    ),
  },
  {
    id:    'scoreboard',
    label: 'Scoreboard',
    desc:  'Bold color, huge score',
    preview: (
      <div style={{ background: '#16A34A', borderRadius: 4, overflow: 'hidden', height: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: 6 }}>
        <div style={{ fontSize: 6, color: '#fff', fontFamily: 'Georgia,serif', letterSpacing: 1 }}>FYPro</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>8<span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>/10</span></div>
        <div style={{ fontSize: 5, fontWeight: 700, color: '#16A34A', background: '#fff', borderRadius: 999, padding: '1px 6px' }}>READY</div>
      </div>
    ),
  },
  {
    id:    'prestige',
    label: 'Academic Prestige',
    desc:  'Ivory, gold shield',
    preview: (
      <div style={{ background: '#FFFDF5', border: '1.5px solid #C9A84C', borderRadius: 4, height: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative', padding: 6 }}>
        <div style={{ position: 'absolute', top: 3, left: 3, width: 8, height: 8, borderTop: '1.5px solid #C9A84C', borderLeft: '1.5px solid #C9A84C' }} />
        <div style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderTop: '1.5px solid #C9A84C', borderRight: '1.5px solid #C9A84C' }} />
        <div style={{ position: 'absolute', bottom: 3, left: 3, width: 8, height: 8, borderBottom: '1.5px solid #C9A84C', borderLeft: '1.5px solid #C9A84C' }} />
        <div style={{ position: 'absolute', bottom: 3, right: 3, width: 8, height: 8, borderBottom: '1.5px solid #C9A84C', borderRight: '1.5px solid #C9A84C' }} />
        <svg width="14" height="14" viewBox="0 0 256 256" fill="#C9A84C" aria-hidden="true">
          <path d="M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z" />
        </svg>
        <div style={{ width: 22, height: 1, background: 'rgba(201,168,76,0.5)', borderRadius: 1 }} />
      </div>
    ),
  },
]

export default function ShareCardStyleModal({ isOpen, onClose, projectId, score, scoreLabel, topic, initialStyle = 'dark', onStyleChange }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [style,   setStyle]   = useState(initialStyle)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  if (!isOpen) return null

  async function handleShare() {
    if (!projectId) { setError('Project ID not available — please try again.'); return }
    setError(null)
    setLoading(true)
    localStorage.setItem('share_card_style', style)
    try {
      const blob = await fetchShareCardBlob(projectId, style)
      await shareToWhatsApp(blob, score ?? null, topic || '')
      onStyleChange?.(style)
      onClose()
    } catch (err) {
      const sentryErr = err instanceof Error ? err : new Error(String(err))
      supabase.auth.getUser()
        .then(({ data }) => {
          Sentry.withScope(scope => {
            scope.setTag('feature', 'share_card_generation')
            scope.setExtra('project_id', projectId)
            scope.setExtra('style', style)
            if (data?.user?.id) scope.setUser({ id: data.user.id })
            Sentry.captureException(sentryErr)
          })
        })
        .catch(() => Sentry.captureException(sentryErr))
      setError(err.message || 'Failed to generate share card.')
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

  return createPortal(
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
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.1rem', color: text1, margin: 0, marginBottom: 4 }}>
              Share Result Card
            </p>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', color: text2, margin: 0 }}>
              Choose your style
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

        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: label, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>
          Style
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 22 }}>
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

        {error && (
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: '#DC2626', marginBottom: 10 }}>
            Failed to generate the card. Please try again or{' '}
            <a href="https://wa.me/2348029061967" target="_blank" rel="noopener noreferrer" style={{ color: '#4ADE80', textDecoration: 'underline' }}>contact us on WhatsApp</a>.
          </p>
        )}

        <button
          onClick={handleShare}
          disabled={loading}
          style={{
            width: '100%', padding: '13px', borderRadius: 10,
            background: loading ? 'rgba(37,211,102,0.5)' : '#25D366',
            color: '#FFFFFF', border: 'none',
            fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.875rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease', marginBottom: 10,
          }}
        >
          {loading ? 'Generating your card…' : '⬇ Share to WhatsApp'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: text2 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
