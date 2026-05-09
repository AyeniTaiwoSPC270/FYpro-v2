import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { downloadCertificate } from '../../lib/certificate'
import { fetchShareCardBlob, shareToWhatsApp } from '../../lib/shareCard'

const SCORE_THRESHOLD = 7

export default function CertificateUnlock({ score, defenseSessionId, projectId, topic }) {
  const navigate = useNavigate()
  const [certLoading,  setCertLoading]  = useState(false)
  const [certError,    setCertError]    = useState(null)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError,   setShareError]   = useState(null)

  const qualifies = score != null && score >= SCORE_THRESHOLD

  async function handleDownload() {
    if (!defenseSessionId) {
      setCertError('Session ID unavailable — please try again in a moment.')
      return
    }
    setCertError(null)
    setCertLoading(true)
    try {
      await downloadCertificate(defenseSessionId)
    } catch (err) {
      if (err.message === 'NAME_REQUIRED') {
        setCertError('NAME_REQUIRED')
      } else {
        setCertError(err.message || 'Failed to generate certificate. Please try again.')
      }
    } finally {
      setCertLoading(false)
    }
  }

  async function handleShare() {
    if (!projectId) { setShareError('Project ID not available.'); return }
    setShareError(null)
    setShareLoading(true)
    try {
      const blob = await fetchShareCardBlob(projectId)
      await shareToWhatsApp(blob, score, topic || '')
    } catch (err) {
      setShareError(err.message || 'Failed to generate share card.')
    } finally {
      setShareLoading(false)
    }
  }

  // ── Encouragement — score too low ─────────────────────────────────────────
  if (!qualifies) {
    return (
      <div style={{
        display:      'flex',
        alignItems:   'flex-start',
        gap:          14,
        padding:      '18px 22px',
        borderRadius: 12,
        background:   'rgba(245, 158, 11, 0.08)',
        border:       '1px solid rgba(245, 158, 11, 0.3)',
        margin:       '24px 0',
        animation:    'card-enter 0.4s ease forwards',
      }}>
        <span style={{ fontSize: 26, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>📚</span>
        <div>
          <p style={{
            fontFamily: "'DM Serif Display', Georgia, serif",
            fontSize:   '0.95rem',
            color:      '#FFFFFF',
            marginBottom: 6,
            lineHeight:   1.3,
          }}>
            Keep practicing
          </p>
          <p style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize:   '0.8rem',
            color:      'rgba(255,255,255,0.6)',
            lineHeight: 1.6,
            margin:     0,
          }}>
            You need a score of {SCORE_THRESHOLD}/10 or above to earn a certificate.
            Try the Subject Expert next and focus on the gaps identified above.
          </p>
        </div>
      </div>
    )
  }

  // ── Celebration — score qualifies ─────────────────────────────────────────
  return (
    <div style={{
      display:      'flex',
      alignItems:   'flex-start',
      gap:          14,
      padding:      '18px 22px',
      borderRadius: 12,
      background:   'rgba(22, 163, 74, 0.08)',
      border:       '1px solid rgba(22, 163, 74, 0.3)',
      margin:       '24px 0',
      animation:    'card-enter 0.4s ease forwards',
    }}>
      <span style={{ fontSize: 28, lineHeight: 1, flexShrink: 0, marginTop: 2 }}>🎓</span>
      <div style={{ flex: 1 }}>
        <p style={{
          fontFamily:   "'DM Serif Display', Georgia, serif",
          fontSize:     '1rem',
          color:        '#FFFFFF',
          marginBottom: 6,
          lineHeight:   1.3,
        }}>
          You've earned a Defense Readiness certificate
        </p>
        <p style={{
          fontFamily:   "'Poppins', sans-serif",
          fontSize:     '0.8rem',
          color:        'rgba(255,255,255,0.6)',
          lineHeight:   1.6,
          marginBottom: 14,
        }}>
          Your score of {score}/10 qualifies you for an official FYPro Defense Readiness certificate.
        </p>

        {certError === 'NAME_REQUIRED' && (
          <p style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize:   '0.75rem',
            color:      '#F87171',
            marginBottom: 10,
            lineHeight: 1.5,
          }}>
            Please set your full name in your profile before downloading.{' '}
            <button
              onClick={() => navigate('/profile')}
              style={{
                background:     'none',
                border:         'none',
                color:          '#60A5FA',
                fontFamily:     "'Poppins', sans-serif",
                fontSize:       '0.75rem',
                cursor:         'pointer',
                textDecoration: 'underline',
                padding:        0,
              }}
            >
              Go to profile →
            </button>
          </p>
        )}
        {certError && certError !== 'NAME_REQUIRED' && (
          <p style={{
            fontFamily:   "'Poppins', sans-serif",
            fontSize:     '0.75rem',
            color:        '#F87171',
            marginBottom: 10,
            lineHeight:   1.5,
          }}>
            {certError}
          </p>
        )}
        {shareError && (
          <p style={{
            fontFamily:   "'Poppins', sans-serif",
            fontSize:     '0.75rem',
            color:        '#F87171',
            marginBottom: 10,
          }}>
            {shareError}
          </p>
        )}

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <button
            onClick={handleDownload}
            disabled={certLoading}
            aria-label="Download PDF certificate"
            style={{
              padding:        '10px 18px',
              borderRadius:   10,
              fontFamily:     "'Poppins', sans-serif",
              fontWeight:     600,
              fontSize:       '0.8125rem',
              cursor:         certLoading ? 'not-allowed' : 'pointer',
              transition:     'all 0.2s ease',
              border:         'none',
              whiteSpace:     'nowrap',
              opacity:        certLoading ? 0.6 : 1,
              background:     '#16A34A',
              color:          '#FFFFFF',
            }}
          >
            {certLoading ? 'Generating…' : '⬇ Download certificate'}
          </button>
          <button
            onClick={handleShare}
            disabled={shareLoading}
            aria-label="Share result to WhatsApp"
            style={{
              padding:    '10px 18px',
              borderRadius: 10,
              fontFamily: "'Poppins', sans-serif",
              fontWeight: 600,
              fontSize:   '0.8125rem',
              cursor:     shareLoading ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              border:     'none',
              whiteSpace: 'nowrap',
              opacity:    shareLoading ? 0.6 : 1,
              background: '#25D366',
              color:      '#FFFFFF',
              display:    'flex',
              alignItems: 'center',
              gap:        7,
            }}
          >
            {/* WhatsApp icon */}
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
            </svg>
            {shareLoading ? 'Generating…' : 'Share on WhatsApp'}
          </button>
        </div>
      </div>
    </div>
  )
}
