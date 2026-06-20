// src/components/rating/RatingModal.jsx
import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const STAR_LABELS = {
  1: '1 out of 5 — Poor',
  2: '2 out of 5 — Fair',
  3: '3 out of 5 — Good',
  4: '4 out of 5 — Very good',
  5: '5 out of 5 — Excellent',
}

const TITLES = {
  defense_simulator: 'How was your Defense Simulator experience?',
  steps_milestone:   "How's FYPro working for you so far?",
}

const LS_KEY = 'fypro_rating_done'

export default function RatingModal({ prompt, onClose }) {
  const { show, triggerType, feature } = prompt

  const [section, setSection]             = useState('rating')
  const [hoveredStar, setHoveredStar]     = useState(0)
  const [selectedStars, setSelectedStars] = useState(null)
  const [suggFeature, setSuggFeature]     = useState('')
  const [suggUi, setSuggUi]               = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [error, setError]                 = useState('')

  if (!show) return null

  function handleSkipRating() {
    localStorage.setItem(LS_KEY, '1')
    onClose()
  }

  async function submitRating(suggestionFeature, suggestionUi) {
    setSubmitting(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const res = await fetch('/api/admin?action=submit-rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          stars:              selectedStars,
          trigger_type:       triggerType,
          feature,
          suggestion_feature: suggestionFeature || null,
          suggestion_ui:      suggestionUi || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to submit')
      }
      localStorage.setItem(LS_KEY, '1')
      setSection('thankyou')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const fillCount = hoveredStar || selectedStars || 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rate your FYPro experience"
      style={{
        position:   'fixed', inset: 0,
        background: 'rgba(6,14,24,0.72)',
        display:    'flex', alignItems: 'center', justifyContent: 'center',
        zIndex:     9999, padding: '24px 16px',
      }}
    >
      <div style={{
        background:   'var(--bg-card)',
        borderRadius: 'var(--radius-lg)',
        width:        '100%', maxWidth: 420,
        boxShadow:    'var(--shadow-card-hover)',
        overflow:     'hidden',
        fontFamily:   "'Poppins', sans-serif",
      }}>

        {/* ── STEP 1: RATING ──────────────────────────────────── */}
        {section === 'rating' && (
          <>
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{
                fontFamily:    "'JetBrains Mono', monospace",
                fontSize:      '0.65rem', fontWeight: 600,
                color:         'var(--color-blue-primary)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom:  6,
              }}>
                Quick Feedback
              </div>
              <h2 style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize:   '1.125rem', fontWeight: 400,
                color:      'var(--color-text-primary)',
                margin:     0, lineHeight: 1.35,
              }}>
                {TITLES[triggerType] || 'How are you finding FYPro?'}
              </h2>

              {/* Step dots */}
              <div style={{ display: 'flex', gap: 5, margin: '14px 0 0', justifyContent: 'center' }}>
                <div style={{ width: 18, height: 6, borderRadius: 3, background: 'var(--color-blue-primary)' }} />
                <div style={{ width: 6,  height: 6, borderRadius: '50%', background: 'var(--border-subtle)' }} />
              </div>

              {/* Stars */}
              <div
                style={{ display: 'flex', gap: 6, margin: '16px 0 6px', justifyContent: 'center' }}
                onMouseLeave={() => setHoveredStar(0)}
                aria-label="Star rating"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    aria-label={`${n} star${n !== 1 ? 's' : ''}`}
                    onClick={() => setSelectedStars(n)}
                    onMouseEnter={() => setHoveredStar(n)}
                    style={{
                      background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                      fontSize: '2rem', lineHeight: 1,
                      color: n <= fillCount ? 'var(--color-amber)' : 'var(--border-subtle)',
                      transition: 'color var(--transition-fast)',
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
              <p style={{
                textAlign: 'center', fontSize: '0.75rem',
                color:     'var(--color-text-muted)', marginBottom: 20,
                minHeight: '1.2em',
              }}>
                {selectedStars ? STAR_LABELS[selectedStars] : 'Tap a star to rate'}
              </p>
            </div>

            <div style={{
              display:       'flex', alignItems: 'center', justifyContent: 'space-between',
              padding:       '14px 24px',
              borderTop:     '1px solid var(--border-color)',
              background:    'var(--bg-input)',
            }}>
              <button onClick={handleSkipRating} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.8125rem', color: 'var(--color-text-muted)',
                fontFamily: "'Poppins', sans-serif",
              }}>
                Skip
              </button>
              <button
                onClick={() => setSection('suggestion')}
                disabled={!selectedStars}
                style={{
                  background:    selectedStars ? 'var(--color-blue-primary)' : 'var(--color-border)',
                  color:         selectedStars ? '#fff' : 'var(--color-text-muted)',
                  border:        'none', borderRadius: 'var(--radius-sm)',
                  padding:       '9px 20px',
                  fontFamily:    "'Poppins', sans-serif",
                  fontSize:      '0.8125rem', fontWeight: 600,
                  cursor:        selectedStars ? 'pointer' : 'not-allowed',
                  transition:    'background var(--transition-fast)',
                }}
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: SUGGESTION ──────────────────────────────── */}
        {section === 'suggestion' && (
          <>
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{
                fontFamily:    "'JetBrains Mono', monospace",
                fontSize:      '0.65rem', fontWeight: 600,
                color:         'var(--color-blue-primary)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom:  6,
              }}>
                Quick Feedback · Step 2
              </div>
              <h2 style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize:   '1.125rem', fontWeight: 400,
                color:      'var(--color-text-primary)',
                margin:     0,
              }}>
                Any suggestions? <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', fontFamily: "'Poppins',sans-serif" }}>(Optional)</span>
              </h2>

              {/* Step dots */}
              <div style={{ display: 'flex', gap: 5, margin: '14px 0 16px', justifyContent: 'center' }}>
                <div style={{ width: 6,  height: 6, borderRadius: '50%', background: 'var(--border-subtle)' }} />
                <div style={{ width: 18, height: 6, borderRadius: 3,     background: 'var(--color-blue-primary)' }} />
              </div>

              {/* Field 1 */}
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={{
                  fontSize:      '0.6875rem', fontWeight: 600,
                  color:         'var(--color-text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom:  5,
                }}>
                  What feature would make FYPro more useful for your final year project?
                </div>
                <textarea
                  value={suggFeature}
                  onChange={e => setSuggFeature(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. A way to export my chapter outline to PDF…"
                  rows={3}
                  style={{
                    width: '100%', resize: 'none', boxSizing: 'border-box',
                    background: 'var(--bg-input)',
                    border: '1.5px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '9px 12px',
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: '0.8125rem', color: 'var(--text-primary)',
                    lineHeight: 1.5,
                  }}
                />
              </label>

              {/* Field 2 */}
              <label style={{ display: 'block', marginBottom: 4 }}>
                <div style={{
                  fontSize:      '0.6875rem', fontWeight: 600,
                  color:         'var(--color-text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom:  5,
                }}>
                  Anything about the interface you'd like us to improve?
                </div>
                <textarea
                  value={suggUi}
                  onChange={e => setSuggUi(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. The sidebar feels cramped on my laptop…"
                  rows={3}
                  style={{
                    width: '100%', resize: 'none', boxSizing: 'border-box',
                    background: 'var(--bg-input)',
                    border: '1.5px solid var(--border-color)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '9px 12px',
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: '0.8125rem', color: 'var(--text-primary)',
                    lineHeight: 1.5,
                  }}
                />
              </label>

              {error && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-red)', margin: '8px 0 0' }}>{error}</p>
              )}
            </div>

            <div style={{
              display:       'flex', alignItems: 'center', justifyContent: 'space-between',
              padding:       '14px 24px',
              borderTop:     '1px solid var(--border-color)',
              background:    'var(--bg-input)',
              marginTop:     16,
            }}>
              <button
                onClick={() => submitRating(null, null)}
                disabled={submitting}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.8125rem', color: 'var(--color-text-muted)',
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                Skip
              </button>
              <button
                onClick={() => submitRating(suggFeature.trim() || null, suggUi.trim() || null)}
                disabled={submitting}
                style={{
                  background:  submitting ? 'rgba(22,163,74,0.6)' : 'var(--color-green)',
                  color:       '#fff', border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding:     '9px 20px',
                  fontFamily:  "'Poppins', sans-serif",
                  fontSize:    '0.8125rem', fontWeight: 600,
                  cursor:      submitting ? 'not-allowed' : 'pointer',
                  transition:  'background var(--transition-fast)',
                }}
              >
                {submitting ? 'Submitting…' : 'Submit feedback'}
              </button>
            </div>
          </>
        )}

        {/* ── THANK YOU STATE ──────────────────────────────────── */}
        {section === 'thankyou' && (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 10 }} role="img" aria-label="Graduation cap">🎓</div>
            <h2 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize:   '1.375rem', fontWeight: 400,
              color:      'var(--color-text-primary)', margin: '0 0 8px',
            }}>
              Thank you!
            </h2>
            <p style={{
              fontSize:    '0.875rem', color: 'var(--color-text-secondary)',
              lineHeight:  1.6, margin: '0 0 24px',
            }}>
              Your feedback helps us make FYPro better for every Nigerian student.
              Now back to crushing your defense.
            </p>
            <button
              onClick={onClose}
              style={{
                background:   'var(--color-blue-primary)',
                color:        '#fff', border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding:      '11px 28px', width: '100%',
                fontFamily:   "'Poppins', sans-serif",
                fontSize:     '0.9375rem', fontWeight: 600,
                cursor:       'pointer',
              }}
            >
              Resume my work →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
