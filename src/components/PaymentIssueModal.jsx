import { useState } from 'react'
import { useUser } from '../hooks/useUser'
import { useTheme } from '../context/ThemeContext'
import ApiErrorBox from './ApiErrorBox'

// Paystack references: alphanumeric + hyphens/underscores, 8-100 chars, no spaces
const REF_PATTERN = /^[A-Za-z0-9_-]{8,100}$/

export default function PaymentIssueModal({ isOpen, onClose }) {
  const { session } = useUser()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [transactionRef, setTransactionRef] = useState('')
  const [description, setDescription]       = useState('')
  const [isSubmitting, setIsSubmitting]     = useState(false)
  const [error, setError]                   = useState(null)
  const [submitted, setSubmitted]           = useState(false)

  if (!isOpen) return null

  function handleClose() {
    if (isSubmitting) return
    setTransactionRef('')
    setDescription('')
    setError(null)
    setSubmitted(false)
    onClose()
  }

  async function handleSubmit() {
    const ref = transactionRef.trim()
    if (!ref) {
      setError('Please enter your transaction reference.')
      return
    }
    if (!REF_PATTERN.test(ref)) {
      setError('Transaction reference looks invalid. It should be at least 8 alphanumeric characters with no spaces (e.g. T680234567890).')
      return
    }
    setError(null)
    setIsSubmitting(true)
    try {
      const res = await fetch('/api/admin?action=report-payment-issue', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ transactionRef: ref, description }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error || 'Something went wrong. Please try again.')
      setSubmitted(true)
    } catch (err) {
      setError(err.message)
    } finally {
      setIsSubmitting(false)
    }
  }

  // ── Theme tokens ──────────────────────────────────────────────────────────
  const overlay    = isDark ? 'rgba(6,14,24,0.8)'              : 'rgba(0,0,0,0.45)'
  const bg         = isDark ? '#0D1B2A'                         : '#ffffff'
  const border     = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(13,27,42,0.12)'
  const headingClr = isDark ? '#ffffff'                         : '#0D1B2A'
  const bodyClr    = isDark ? 'rgba(255,255,255,0.82)'          : 'rgba(13,27,42,0.7)'
  const labelClr   = isDark ? 'rgba(255,255,255,0.82)'          : 'rgba(13,27,42,0.75)'
  const optClr     = isDark ? 'rgba(255,255,255,0.3)'           : 'rgba(13,27,42,0.35)'
  const inputBg    = isDark ? 'rgba(255,255,255,0.06)'          : '#F8FAFC'
  const inputBdr   = isDark ? '1px solid rgba(255,255,255,0.12)': '1px solid rgba(13,27,42,0.15)'
  const inputClr   = isDark ? '#ffffff'                         : '#0D1B2A'
  const closeClr   = isDark ? 'rgba(255,255,255,0.65)'          : 'rgba(13,27,42,0.45)'
  const counterClr = isDark ? 'rgba(255,255,255,0.3)'           : 'rgba(13,27,42,0.35)'

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: bg,
          border,
          borderRadius: 16,
          padding: '32px',
          width: '100%',
          maxWidth: 'min(460px, calc(100vw - 32px))',
          position: 'relative',
          boxShadow: isDark
            ? '0 20px 60px rgba(0,0,0,0.5)'
            : '0 20px 60px rgba(0,0,0,0.12)',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          disabled={isSubmitting}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none',
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
            color: closeClr, fontSize: 20, lineHeight: 1,
            fontFamily: "'Poppins', sans-serif",
          }}
          aria-label="Close"
        >
          ×
        </button>

        {submitted ? (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 36, marginBottom: 16 }}>✅</div>
            <h2 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 22, color: headingClr, marginBottom: 12,
            }}>Report sent</h2>
            <p style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 14, color: bodyClr,
              lineHeight: 1.6, marginBottom: 24,
            }}>
              We'll manually verify and unlock your access within 2 hours.
              Check your email for confirmation.
            </p>
            <button
              onClick={handleClose}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontWeight: 600, fontSize: 14,
                background: '#0066FF', color: '#fff',
                border: 'none', borderRadius: 8,
                padding: '10px 28px', cursor: 'pointer',
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <>
            <h2 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: 22, color: headingClr,
              marginBottom: 8, marginTop: 0,
            }}>Payment Issue</h2>
            <p style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 13, color: bodyClr,
              marginBottom: 24, lineHeight: 1.5,
            }}>
              If you completed a payment but your plan wasn't unlocked, we'll fix this within 2 hours.
            </p>

            <label style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: labelClr, display: 'block', marginBottom: 6 }}>
              Transaction Reference <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              type="text"
              value={transactionRef}
              onChange={e => setTransactionRef(e.target.value)}
              placeholder="e.g. T680234567890"
              style={{
                width: '100%', boxSizing: 'border-box',
                fontFamily: "'Poppins', sans-serif", fontSize: 14,
                background: inputBg, border: inputBdr,
                borderRadius: 8, color: inputClr,
                padding: '10px 14px', marginBottom: 16, outline: 'none',
              }}
            />

            <label style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: labelClr, display: 'block', marginBottom: 6 }}>
              Brief description <span style={{ color: optClr }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value.slice(0, 200))}
              placeholder="What happened? What plan did you pay for?"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                fontFamily: "'Poppins', sans-serif", fontSize: 14,
                background: inputBg, border: inputBdr,
                borderRadius: 8, color: inputClr,
                padding: '10px 14px', marginBottom: 4,
                outline: 'none', resize: 'vertical',
              }}
            />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: counterClr, textAlign: 'right', marginBottom: 16 }}>
              {description.length} / 200
            </div>

            <ApiErrorBox error={error} />

            <button
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                width: '100%', fontFamily: "'Poppins', sans-serif",
                fontWeight: 600, fontSize: 14,
                background: isSubmitting ? 'rgba(0,102,255,0.5)' : '#0066FF',
                color: '#fff', border: 'none', borderRadius: 8,
                padding: '12px', cursor: isSubmitting ? 'not-allowed' : 'pointer',
                marginTop: 4, transition: 'background 0.15s ease',
              }}
            >
              {isSubmitting ? 'Sending…' : 'Send Report'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
