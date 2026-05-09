import { useState } from 'react'
import { useUser } from '../hooks/useUser'
import ApiErrorBox from './ApiErrorBox'

export default function PaymentIssueModal({ isOpen, onClose }) {
  const { session } = useUser()

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
    if (!transactionRef.trim()) {
      setError('Please enter your transaction reference.')
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
        body: JSON.stringify({ transactionRef, description }),
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

  return (
    <div
      onClick={handleClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        background: 'rgba(6,14,24,0.8)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px',
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: '#0D1B2A',
          border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 16,
          padding: '32px',
          width: '100%',
          maxWidth: 460,
          position: 'relative',
        }}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          disabled={isSubmitting}
          style={{
            position: 'absolute', top: 16, right: 16,
            background: 'none', border: 'none', cursor: isSubmitting ? 'not-allowed' : 'pointer',
            color: 'rgba(255,255,255,0.65)', fontSize: 20, lineHeight: 1,
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
              fontSize: 22, color: '#fff', marginBottom: 12,
            }}>Report sent</h2>
            <p style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 14, color: 'rgba(255,255,255,0.82)',
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
              fontSize: 22, color: '#fff',
              marginBottom: 8, marginTop: 0,
            }}>Payment Issue</h2>
            <p style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: 13, color: 'rgba(255,255,255,0.82)',
              marginBottom: 24, lineHeight: 1.5,
            }}>
              If you completed a payment but your plan wasn't unlocked, we'll fix this within 2 hours.
            </p>

            <label style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.82)', display: 'block', marginBottom: 6 }}>
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
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, color: '#fff',
                padding: '10px 14px', marginBottom: 16, outline: 'none',
              }}
            />

            <label style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: 'rgba(255,255,255,0.82)', display: 'block', marginBottom: 6 }}>
              Brief description <span style={{ color: 'rgba(255,255,255,0.3)' }}>(optional)</span>
            </label>
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value.slice(0, 200))}
              placeholder="What happened? What plan did you pay for?"
              rows={3}
              style={{
                width: '100%', boxSizing: 'border-box',
                fontFamily: "'Poppins', sans-serif", fontSize: 14,
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 8, color: '#fff',
                padding: '10px 14px', marginBottom: 4,
                outline: 'none', resize: 'vertical',
              }}
            />
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: 'rgba(255,255,255,0.3)', textAlign: 'right', marginBottom: 16 }}>
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
