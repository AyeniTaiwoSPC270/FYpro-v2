import { useState } from 'react'
import { supabase } from '../lib/supabase'

const ghostBtn = {
  background: 'none',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 20px',
  fontFamily: "'Poppins', sans-serif",
  fontSize: 'var(--text-base)',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  transition: 'var(--transition-base)',
}

export default function ReportButton({
  type = 'general',
  context = {},
  label = 'Report this issue',
  initialOpen = false,
  onClose,
}) {
  const [open, setOpen]               = useState(initialOpen ?? false)
  const [description, setDescription] = useState('')
  const [status, setStatus]           = useState('idle') // idle | submitting | success | error
  const [errorMsg, setErrorMsg]       = useState('')

  async function handleSubmit() {
    if (!description.trim()) return
    setStatus('submitting')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not signed in')

      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'submit-report',
          type,
          description: description.trim(),
          context: { url: window.location.pathname, ...context },
        }),
      })

      if (res.status === 429) throw new Error("You've submitted too many reports today. Please try again tomorrow.")
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit report')
      }

      setStatus('success')
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  function handleClose() {
    setOpen(false)
    onClose?.()
    setTimeout(() => {
      setDescription('')
      setStatus('idle')
      setErrorMsg('')
    }, 300)
  }

  return (
    <>
      {label && (
        <button
          onClick={() => setOpen(true)}
          style={{
            background: 'none',
            border: 'none',
            padding: 0,
            color: 'var(--color-text-secondary)',
            fontSize: 'var(--text-sm)',
            fontFamily: "'Poppins', sans-serif",
            cursor: 'pointer',
            textDecoration: 'underline',
            textUnderlineOffset: '2px',
          }}
        >
          {label}
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            padding: '16px',
          }}
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div style={{
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-card)',
            padding: '32px',
            width: '100%',
            maxWidth: '480px',
          }}>
            {status === 'success' ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
                <h2 style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: 'var(--text-xl)',
                  color: 'var(--color-text-primary)',
                  margin: '0 0 8px',
                }}>
                  Report received
                </h2>
                <p style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 'var(--text-base)',
                  color: 'var(--color-text-secondary)',
                  margin: '0 0 24px',
                }}>
                  We'll look into it and fix it.
                </p>
                <button onClick={handleClose} style={ghostBtn}>Close</button>
              </div>
            ) : (
              <>
                <h2
                  id="report-modal-title"
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: 'var(--text-xl)',
                    color: 'var(--color-text-primary)',
                    margin: '0 0 6px',
                  }}
                >
                  Report an issue
                </h2>
                <p style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-secondary)',
                  margin: '0 0 20px',
                }}>
                  Tell us what happened and we'll investigate.
                </p>

                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value.slice(0, 1000))}
                  placeholder="Tell us what happened…"
                  rows={5}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 'var(--text-base)',
                    color: 'var(--color-text-primary)',
                    resize: 'vertical',
                    outline: 'none',
                    marginBottom: '4px',
                  }}
                />
                <div style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)',
                  textAlign: 'right',
                  marginBottom: '16px',
                }}>
                  {description.length}/1000
                </div>

                {status === 'error' && (
                  <p style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-red)',
                    margin: '0 0 14px',
                  }}>
                    {errorMsg}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleClose}
                    disabled={status === 'submitting'}
                    style={ghostBtn}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!description.trim() || status === 'submitting'}
                    style={{
                      background: description.trim() && status !== 'submitting'
                        ? 'var(--color-blue-primary)'
                        : 'var(--color-text-muted)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 20px',
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: 'var(--text-base)',
                      fontWeight: 600,
                      cursor: description.trim() && status !== 'submitting' ? 'pointer' : 'not-allowed',
                      transition: 'var(--transition-base)',
                    }}
                  >
                    {status === 'submitting' ? 'Sending…' : 'Submit Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
