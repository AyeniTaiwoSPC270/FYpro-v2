import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

const TYPE_ICONS = {
  welcome:               '👋',
  step_completed:        '✅',
  payment_confirmed:     '💳',
  certificate_unlocked:  '🏆',
  referral_join:         '🔗',
  referral_credit:       '👥',
}

const TYPE_ICON_BG = {
  welcome:               'rgba(59,130,246,0.15)',
  step_completed:        'rgba(6,182,212,0.15)',
  payment_confirmed:     'rgba(22,163,74,0.15)',
  certificate_unlocked:  'rgba(245,158,11,0.15)',
  referral_join:         'rgba(139,92,246,0.15)',
  referral_credit:       'rgba(139,92,246,0.15)',
}

function relativeTime(dateStr) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  } catch { return '' }
}

export default function NotificationPanel({
  notifications,
  loading,
  error,
  unreadCount,
  onMarkAllRead,
  onRetry,
  onClose,
}) {
  const panelRef = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [onClose])

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: '320px',
        background: 'var(--bg-card)',
        border: '1px solid var(--dropdown-border)',
        borderRadius: '14px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.18)',
        overflow: 'hidden',
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid var(--border-subtle)',
        background: 'rgba(0,102,255,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: '0.9rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <span style={{
              background: 'var(--color-blue-primary)',
              color: '#fff',
              padding: '1px 7px',
              borderRadius: '999px',
              fontSize: '0.6rem',
              fontWeight: 800,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '0.7rem',
              fontWeight: 500,
              color: 'var(--color-blue-light)',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: '24px 16px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                display: 'flex', gap: '12px', alignItems: 'flex-start',
                marginBottom: i < 3 ? '16px' : 0,
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'var(--skeleton-base)', flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    height: '12px', borderRadius: '4px', marginBottom: '6px',
                    background: 'var(--skeleton-base)', width: '70%',
                  }} />
                  <div style={{
                    height: '10px', borderRadius: '4px',
                    background: 'var(--skeleton-shimmer)', width: '90%',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '12px', fontFamily: "'Poppins', sans-serif" }}>
              Couldn't load notifications
            </div>
            <button
              onClick={onRetry}
              style={{
                background: 'var(--color-blue-glow)',
                border: '1px solid var(--color-border-blue)',
                borderRadius: '8px',
                padding: '6px 16px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: 'var(--color-blue-light)',
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && notifications.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🔔</div>
            <div style={{
              fontSize: '0.82rem', fontWeight: 600,
              color: 'var(--text-secondary)',
              fontFamily: "'Poppins', sans-serif",
            }}>
              You're all caught up
            </div>
            <div style={{
              fontSize: '0.7rem',
              color: 'var(--text-muted)',
              marginTop: '4px',
              fontFamily: "'Poppins', sans-serif",
            }}>
              New activity will show up here
            </div>
          </div>
        )}

        {!loading && !error && notifications.map(n => (
          <div
            key={n.id}
            style={{
              padding: '12px 16px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              borderBottom: '1px solid var(--border-subtle)',
              background: n.read ? 'transparent' : 'rgba(0,102,255,0.04)',
            }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: TYPE_ICON_BG[n.type] ?? 'var(--bg-input)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              flexShrink: 0,
            }}>
              {TYPE_ICONS[n.type] ?? '🔔'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.3,
                marginBottom: '2px',
                fontFamily: "'Poppins', sans-serif",
              }}>
                {n.title}
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
                fontFamily: "'Poppins', sans-serif",
              }}>
                {n.message}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                {!n.read && (
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: 'var(--color-blue-primary)', flexShrink: 0,
                  }} />
                )}
                <span style={{
                  fontSize: '0.62rem',
                  color: 'var(--text-muted)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {relativeTime(n.created_at)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {!loading && !error && notifications.length > 0 && (
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid var(--border-subtle)',
          textAlign: 'center',
          background: 'var(--bg-input)',
        }}>
          <span style={{
            fontSize: '0.65rem',
            color: 'var(--text-muted)',
            fontFamily: "'Poppins', sans-serif",
          }}>
            Showing last 50 notifications
          </span>
        </div>
      )}
    </motion.div>
  )
}
