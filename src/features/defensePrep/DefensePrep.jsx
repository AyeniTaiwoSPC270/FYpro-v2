import { useState, useRef, useEffect, useCallback, memo } from 'react'
import { createPortal } from 'react-dom'
import {
  detectRedFlags,
  panelFirstQuestion,
  panelFollowUp,
  panelSummary,
  handleApiError,
  logFailure,
} from '../../services/api'
import LoadingMessages from '../../components/LoadingMessages'
import Spinner from '../../components/Spinner'

const GENERIC_LOADING_MESSAGES = [
  'Generating your analysis...',
  'Reviewing the details...',
  'Almost done...',
]
import {
  THREE_EXAMINER_FIRST_QUESTION_PROMPT,
  buildThreeExaminerFollowUpPrompt,
} from '../../services/prompts.js'
import { checkAndRecord, useRunLimit } from '../../hooks/useRunLimit'
import { usePaidFeatures } from '../../hooks/usePaidFeatures'
import { useApp } from '../../context/AppContext'
import { useTheme } from '../../context/ThemeContext'
import { showToast } from '../../components/Toast'
import { useProjectState } from '../../hooks/useProjectState'
import { useUser } from '../../hooks/useUser'
import FeedbackThumbs from '../../components/feedback/FeedbackThumbs'
import { markStepComplete, markDefenseSimulatorRun, tryAwardDefenseReady } from '../../lib/progress'
import { notifyStepCompleted } from '../../lib/notifications'
import { fetchShareCardBlob, shareToWhatsApp } from '../../lib/shareCard'
import DefenseShareCard from '../../components/share/DefenseShareCard'
import CertificateUnlock from '../../components/defense/CertificateUnlock'
import { supabase } from '../../lib/supabase'
import { trackEvent } from '../../lib/analytics'
import Sentry from '../../lib/sentry'

// ── helpers ───────────────────────────────────────────────────────────────────

function examinerNameToClass(name) {
  if (!name) return ''
  const n = name.toLowerCase()
  if (n.includes('methodologist')) return 'dp-examiner-label--methodologist'
  if (n.includes('subject'))       return 'dp-examiner-label--subject-expert'
  if (n.includes('external'))      return 'dp-examiner-label--external-examiner'
  return ''
}

function examinerNameToSlug(name) {
  if (!name) return ''
  const n = name.toLowerCase()
  if (n.includes('methodologist')) return 'methodologist'
  if (n.includes('subject'))       return 'subject-expert'
  if (n.includes('external'))      return 'external-examiner'
  return ''
}

function resolveExaminerVoice(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('subject')) return { rate: 1.0,  pitch: 1.1  }
  if (n.includes('external')) return { rate: 1.15, pitch: 0.95 }
  return                            { rate: 0.9,  pitch: 0.85 }
}

function logElevenLabsFailure(err, examinerName, errorType, userId) {
  const sentryErr = err instanceof Error ? err : new Error(String(err))
  Sentry.withScope(scope => {
    scope.setTag('feature', 'tts_elevenlabs')
    scope.setTag('error_type', errorType)
    scope.setTag('examiner_persona', examinerName || 'unknown')
    scope.setExtra('timestamp', new Date().toISOString())
    if (err?.elevenlabsDetail) scope.setExtra('elevenlabs_detail', err.elevenlabsDetail)
    if (userId) scope.setUser({ id: userId })
    Sentry.captureException(sentryErr)
  })
}

// ── sub-components ────────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="dp-typing-wrap">
      <p className="dp-typing-label">EXAMINER:</p>
      <div className="dp-typing-indicator">
        <span className="dp-typing-dot" />
        <span className="dp-typing-dot" />
        <span className="dp-typing-dot" />
      </div>
    </div>
  )
}

const ExaminerBubble = memo(function ExaminerBubble({ examiner, text, onReady, voicePaused, onRetry }) {
  const [labelText, setLabelText]       = useState('')
  const [bubbleVisible, setBubbleVisible] = useState(false)

  useEffect(() => {
    const full = ((examiner || 'EXAMINER').toUpperCase()) + ':'
    let i = 0
    const id = setInterval(() => {
      i++
      setLabelText(full.slice(0, i))
      if (i >= full.length) {
        clearInterval(id)
        setBubbleVisible(true)
        onReady?.()
      }
    }, 45)
    return () => clearInterval(id)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- animation runs once on mount; examiner and onReady are props that don't change after initial render
  }, [])

  return (
    <div className="dp-examiner-wrap">
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 4 }}>
        <p className={`dp-examiner-label ${examinerNameToClass(examiner)}`} style={{ margin: 0 }}>{labelText}</p>
        {voicePaused && (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: "'JetBrains Mono', monospace", fontSize: '0.6rem', color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
            🔇 Voice paused
            <button
              onClick={onRetry}
              aria-label="Retry audio"
              title="Retry audio"
              style={{ background: 'none', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 4, cursor: 'pointer', padding: '1px 6px', color: 'rgba(255,255,255,0.45)', fontSize: '0.7rem', lineHeight: 1.4, transition: 'border-color 0.15s ease' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.35)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)' }}
            >
              ↻ Retry
            </button>
          </span>
        )}
      </div>
      <div className={['dp-examiner-bubble', examinerNameToSlug(examiner) ? `dp-examiner-bubble--${examinerNameToSlug(examiner)}` : '', bubbleVisible ? 'dp-examiner-bubble--visible' : ''].filter(Boolean).join(' ')}>
        <p className="dp-examiner-text">{text}</p>
      </div>
    </div>
  )
})

function ScoreBadges({ scores }) {
  const [visible, setVisible] = useState([])

  useEffect(() => {
    const timers = scores.map((_, i) =>
      setTimeout(() => setVisible(prev => [...prev, i]), 150 + i * 300)
    )
    return () => timers.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- stagger animation runs once on mount; scores identity doesn't change after the component is rendered
  }, [])

  return (
    <>
      {scores.map((s, i) => {
        const label = (s.score_label || '').toLowerCase()
        const slug  = examinerNameToSlug(s.examiner)
        const abbr  = (s.examiner || '').replace(/^the\s+/i, '').toUpperCase()
        return (
          <span
            key={i}
            className={[
              'dp-score-badge',
              `dp-score-badge--${label}`,
              `dp-score-badge--examiner-${slug}`,
              visible.includes(i) ? 'dp-score--visible' : '',
            ].filter(Boolean).join(' ')}
          >
            {abbr} · {(s.score_label || '').toUpperCase()} · {s.score ?? '?'}/10
          </span>
        )
      })}
    </>
  )
}

function ScoreReasonings({ scores }) {
  const [visible, setVisible] = useState([])

  useEffect(() => {
    const timers = scores.map((_, i) =>
      setTimeout(() => setVisible(prev => [...prev, i]), 350 + i * 300)
    )
    return () => timers.forEach(clearTimeout)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- stagger animation runs once on mount; scores identity doesn't change after the component is rendered
  }, [])

  return (
    <>
      {scores.map((s, i) => (
        s.score_reasoning ? (
          <p
            key={i}
            className={`dp-score-reasoning${visible.includes(i) ? ' dp-score-reasoning--visible' : ''}`}
          >
            {s.score_reasoning}
          </p>
        ) : null
      ))}
    </>
  )
}

const StudentBubble = memo(function StudentBubble({ text, scores }) {
  return (
    <div className="dp-student-wrap">
      <div className="dp-student-bubble">
        <p className="dp-student-text">{text}</p>
      </div>
      {scores && scores.length > 0 && (
        <>
          <ScoreBadges scores={scores} />
          <ScoreReasonings scores={scores} />
        </>
      )}
    </div>
  )
})

const FlagItem = memo(function FlagItem({ flag, visible }) {
  const dotClass =
    flag.severity === 'Critical' ? 'dp-flag-dot--critical' :
    flag.severity === 'Serious'  ? 'dp-flag-dot--serious'  :
    'dp-flag-dot--minor'

  return (
    <div className={`dp-flag-item${visible ? ' dp-flag-item--visible' : ' dp-flag-item--hidden'}`}>
      <div className="dp-flag-header">
        <span className={`dp-flag-dot ${dotClass}`} />
        <span className="dp-flag-title">{flag.title || ''}</span>
      </div>
      {flag.description && (
        <p className="dp-flag-description">{flag.description}</p>
      )}
      {flag.likely_question && (
        <div className="dp-flag-meta-row">
          <span className="dp-flag-meta-label">Likely Question</span>
          <p className="dp-flag-meta-text">{flag.likely_question}</p>
        </div>
      )}
      {flag.advice && (
        <div className="dp-flag-meta-row">
          <span className="dp-flag-meta-label">Prepare</span>
          <p className="dp-flag-meta-text">{flag.advice}</p>
        </div>
      )}
    </div>
  )
})

function ExitModal({ questionCount, onContinue, onLeave }) {
  return (
    <div className="dp-exit-modal-overlay dp-exit-modal-overlay--visible">
      <div className="dp-exit-modal-box">
        <div className="dp-exit-modal-icon">⚠️</div>
        <h2 className="dp-exit-modal-heading">Leave Defence Early?</h2>
        <p className="dp-exit-modal-body">
          You have only completed {questionCount} of 5 questions. Leaving now means your readiness
          score will be based on incomplete responses — your grade may not reflect your full ability.
        </p>
        <div className="dp-exit-modal-buttons">
          <button className="dp-exit-modal-continue" onClick={onContinue}>
            Continue Defence
          </button>
          <button className="dp-exit-modal-leave" onClick={onLeave}>
            Leave Anyway
          </button>
        </div>
      </div>
    </div>
  )
}

const SummaryCard = memo(function SummaryCard({ data, onClose, projectId, topic, defenseSessionId }) {
  const panelLabel = (data.panel_score_label || '').toLowerCase()
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError]     = useState(null)
  const { theme } = useTheme()
  const isLight = theme === 'light'

  async function handleShare() {
    if (!projectId) { setShareError('Project ID not available — please try again.'); return }
    setShareError(null)
    setShareLoading(true)
    try {
      const blob = await fetchShareCardBlob(projectId)
      await shareToWhatsApp(blob, data.panel_score ?? null, topic || '')
    } catch (err) {
      setShareError(err.message || 'Failed to generate share card.')
    } finally {
      setShareLoading(false)
    }
  }

  return (
    <>
      <div className={`dp-results-bar dp-results-bar--${panelLabel}`}>
        <span className="dp-results-bar__text">Defence Complete</span>
        <span className="dp-results-bar__divider">·</span>
        <span className="dp-results-bar__score">{data.panel_score ?? '?'}/10</span>
        <span className="dp-results-bar__divider">·</span>
        <span className="dp-results-bar__label">
          {(data.panel_score_label || '').toUpperCase()}
        </span>
      </div>

      <div className="dp-summary-wrap">
        <div className="dp-summary-card">

          <div className="dp-summary-verdicts">
            <p className="dp-summary-section-label">Individual Examiner Verdicts</p>
            {(data.verdicts || []).map((v, i) => (
              <div key={i} className="dp-summary-verdict-row">
                <span className={`dp-summary-examiner-name ${examinerNameToClass(v.examiner)}`}>
                  {v.examiner || ''}
                </span>
                <span className={`dp-summary-score-badge dp-summary-score--${(v.overall_score_label || '').toLowerCase()}`}>
                  {(v.overall_score_label || '').toUpperCase()} · {v.overall_score ?? '?'}/10
                </span>
                <p className="dp-summary-verdict-text">{v.verdict || ''}</p>
              </div>
            ))}
          </div>

          <p className="dp-summary-verdict">{data.panel_verdict || ''}</p>

          <span className={`dp-summary-score-badge dp-summary-score--${panelLabel}`}>
            PANEL · {(data.panel_score_label || '').toUpperCase()} · {data.panel_score ?? '?'}/10
          </span>

          <div className="dp-summary-section">
            <p className="dp-summary-section-label">Strengths</p>
            <ul className="dp-summary-list dp-summary-list--strengths">
              {(data.strengths || []).map((s, i) => <li key={i}>{s}</li>)}
            </ul>
          </div>

          <div className="dp-summary-section">
            <p className="dp-summary-section-label">Areas to Strengthen</p>
            <ul className="dp-summary-list dp-summary-list--gaps">
              {(data.gaps || []).map((g, i) => <li key={i}>{g}</li>)}
            </ul>
          </div>

          {data.final_advice && (
            <p className="dp-summary-advice">{data.final_advice}</p>
          )}

          {/* ── Certificate unlock / encouragement ─────────────────────────── */}
          <CertificateUnlock
            score={data.panel_score ?? null}
            defenseSessionId={defenseSessionId}
            projectId={projectId}
            topic={topic}
          />

          {/* ── Celebratory share prompt ────────────────────────────────────── */}
          <div className="dp-share-section">
            <div style={{ marginBottom: 16 }}>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.95rem', fontWeight: 600, color: isLight ? '#0D1B2A' : 'rgba(255,255,255,0.92)', margin: '0 0 6px' }}>
                You just survived a practice defense 💪
              </p>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.78rem', color: isLight ? 'rgba(13,27,42,0.55)' : 'rgba(255,255,255,0.5)', margin: 0, lineHeight: 1.6 }}>
                Share this with your coursemates who still need to prepare:
              </p>
            </div>

            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 24 }}>
              <a
                href={`https://wa.me/?text=${encodeURIComponent("I just practiced my FYP defense with FYPro and it was intense. If you're a final year student, try it before your real defense: fypro.com.ng")}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: '#25D366', color: '#fff',
                  textDecoration: 'none', borderRadius: 10,
                  padding: '10px 18px',
                  fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.82rem',
                  transition: 'opacity 0.2s ease', flex: 1, justifyContent: 'center',
                }}
                onMouseEnter={e => e.currentTarget.style.opacity = '0.88'}
                onMouseLeave={e => e.currentTarget.style.opacity = '1'}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                </svg>
                Share on WhatsApp
              </a>
              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent("Just finished a practice defense session with FYPro. Nigerian final year students — this is the prep tool you've been missing. fypro.com.ng")}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 8,
                  background: isLight ? 'rgba(13,27,42,0.05)' : 'rgba(255,255,255,0.07)',
                  color: isLight ? '#0D1B2A' : 'rgba(255,255,255,0.85)',
                  border: isLight ? '1px solid rgba(13,27,42,0.15)' : '1px solid rgba(255,255,255,0.14)',
                  textDecoration: 'none', borderRadius: 10,
                  padding: '10px 18px',
                  fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.82rem',
                  transition: 'background 0.2s ease, border-color 0.2s ease', flex: 1, justifyContent: 'center',
                }}
                onMouseEnter={e => {
                  e.currentTarget.style.background = isLight ? 'rgba(13,27,42,0.09)' : 'rgba(255,255,255,0.11)'
                  e.currentTarget.style.borderColor = isLight ? 'rgba(13,27,42,0.25)' : 'rgba(255,255,255,0.26)'
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.background = isLight ? 'rgba(13,27,42,0.05)' : 'rgba(255,255,255,0.07)'
                  e.currentTarget.style.borderColor = isLight ? 'rgba(13,27,42,0.15)' : 'rgba(255,255,255,0.14)'
                }}
              >
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.748l7.73-8.835L1.254 2.25H8.08l4.261 5.631 5.903-5.631zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                </svg>
                Share on X
              </a>
            </div>

            <p className="dp-summary-section-label" style={{ marginBottom: 16 }}>Download Result Card</p>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap' }}>
              <DefenseShareCard
                score={data.panel_score ?? null}
                scoreLabel={data.panel_score_label || null}
                topic={topic || ''}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 180 }}>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.78rem', color: isLight ? 'rgba(13,27,42,0.55)' : 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>
                  Download your result card and share it on WhatsApp.
                </p>
                {shareError && (
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', color: '#DC2626', margin: 0 }}>
                    {shareError}
                  </p>
                )}
                <button
                  className="dp-share-whatsapp-btn"
                  onClick={handleShare}
                  disabled={shareLoading}
                  aria-label="Share result to WhatsApp"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: shareLoading ? 'rgba(37,211,102,0.5)' : '#25D366',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '12px 20px',
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: shareLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    justifyContent: 'center',
                  }}
                >
                  {shareLoading ? <Spinner size={18} /> : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  )}
                  {shareLoading ? 'Generating card…' : 'Share to WhatsApp'}
                </button>
              </div>
            </div>
          </div>

          <button className="dp-summary-done-btn" onClick={onClose}>
            Close Defence Session
          </button>
        </div>
      </div>
    </>
  )
})

// ── main component ────────────────────────────────────────────────────────────

const MIC_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
    <path d="M19 11h-2a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11z" />
  </svg>
)

function countWords(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

export default function DefensePrep() {
  const { state, studentContext, navigateStep, completeStep, set } = useApp()
  const { saveStep, projectId, ensureProject } = useProjectState()
  const { user: authUser, session: authSession } = useUser()
  const { features } = usePaidFeatures()
  const { isOverLimit } = useRunLimit(features)
  const rfOverLimit = isOverLimit('red_flag_detector')
  const dsOverLimit = isOverLimit('defense_simulator')

  const uploadedReview = state.uploadedProject?.reviewData

  // ── card state ────────────────────────────────────────────────────────────
  const [hasSubmitted, setHasSubmitted]   = useState(false)
  const [section, setSection]             = useState(state.defenseSummary ? 'summary' : (state.redFlags ? 'flags' : 'input'))
  const [redFlags, setRedFlags]           = useState(state.redFlags || null)
  const [visibleFlags, setVisibleFlags]   = useState(state.redFlags ? state.redFlags.map((_, i) => i) : [])
  const [buttonsVisible, setButtonsVisible] = useState(!!state.redFlags)
  const [scanError, setScanError]         = useState(null)
  const [isScanning, setIsScanning]       = useState(false)

  // ── overlay state ─────────────────────────────────────────────────────────
  const [overlayOpen, setOverlayOpen]         = useState(false)
  const [chatMessages, setChatMessages]       = useState([])
  const [inputValue, setInputValue]           = useState('')
  const [inputLocked, setInputLocked]         = useState(true)
  const [answerError, setAnswerError]         = useState('')
  const [typingVisible, setTypingVisible]     = useState(false)
  const [verdictLoading, setVerdictLoading]   = useState(false)
  const [displayQuestionCount, setDisplayQuestionCount] = useState(0)
  const [endEnabled, setEndEnabled]           = useState(false)
  const [overlayPhase, setOverlayPhase]       = useState('chat') // 'chat' | 'summary'
  const [summaryData, setSummaryData]         = useState(state.defenseSummary || null)
  const [exitModalOpen, setExitModalOpen]     = useState(false)
  const [micActive, setMicActive]             = useState(false)
  const [voicePausedMsgIds, setVoicePausedMsgIds] = useState(() => new Set())

  // ── circuit breaker state ─────────────────────────────────────────────────
  const [briefAnswerWarning, setBriefAnswerWarning] = useState(false)
  const [lowScoreCount, setLowScoreCount]           = useState(0)
  const [sessionWarned, setSessionWarned]           = useState(false)
  const [sessionTerminated, setSessionTerminated]   = useState(false)
  const [turnCount, setTurnCount]                   = useState(0)
  const [sessionComplete, setSessionComplete]       = useState(false)
  const [downloadingTranscript, setDownloadingTranscript] = useState(false)
  const dpWordCount = countWords(inputValue)

  // ── refs (survive async boundaries, never trigger re-renders) ─────────────
  const defenseMessagesRef    = useRef([])
  const panelSystemRef        = useRef(null)
  const questionCountRef      = useRef(0)
  const currentExaminerRef    = useRef('The Methodologist')
  const msgIdRef              = useRef(0)
  const justScannedRef        = useRef(false)
  const recognitionRef        = useRef(null)
  const currentAudioRef       = useRef(null)
  const elevenLabsInFlightRef   = useRef(false)
  const hasWarnedSpeakFallback  = useRef(false)
  const micActiveRef          = useRef(false)
  const chatAreaRef           = useRef(null)
  const textareaRef           = useRef(null)
  const submitHandlerRef      = useRef(null)
  const lowScoreCountRef      = useRef(0)
  const sessionWarnedRef      = useRef(false)
  const turnCountRef          = useRef(0)

  const [defenseSessionId, setDefenseSessionId] = useState(null)
  const defenseSessionIdRef = useRef(null)
  const authUserRef    = useRef(authUser)
  const authSessionRef = useRef(authSession)
  useEffect(() => { authUserRef.current = authUser }, [authUser])
  useEffect(() => { authSessionRef.current = authSession }, [authSession])

  const voiceSupported    = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  const loadingTimerRef   = useRef(null)

  // When the persisted summary screen is shown (remount after page reload),
  // look up the most recent completed defense session so CertificateUnlock has an ID
  useEffect(() => {
    if (section !== 'summary' || !projectId) return
    if (defenseSessionIdRef.current) {
      setDefenseSessionId(defenseSessionIdRef.current)
      return
    }
    supabase
      .from('defense_sessions')
      .select('id')
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .order('completed_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.id) {
          defenseSessionIdRef.current = data.id
          setDefenseSessionId(data.id)
        }
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- supabase is a module-level singleton; only section and projectId are true dependencies
  }, [section, projectId])

  // Safety timeout: force-stop red-flag scan loading after 30s
  useEffect(() => {
    if (section === 'loading') {
      loadingTimerRef.current = setTimeout(() => {
        setSection('input')
        setIsScanning(false)
        setScanError('Request timed out. Please check your connection and try again.')
      }, 30000)
    } else {
      clearTimeout(loadingTimerRef.current)
    }
    return () => clearTimeout(loadingTimerRef.current)
  }, [section])
  const ttsSupported   = !!window.speechSynthesis

  // ── effects ───────────────────────────────────────────────────────────────

  // Keep submit handler ref current so speech recognition can call latest version
  submitHandlerRef.current = handleStudentSubmit

  // Preload browser voices — Chrome loads them async; calling getVoices() and
  // listening for voiceschanged ensures they are available when fallbackSpeak fires
  useEffect(() => {
    if (!ttsSupported) return
    window.speechSynthesis.getVoices()
    const onReady = () => window.speechSynthesis.getVoices()
    window.speechSynthesis.addEventListener('voiceschanged', onReady)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', onReady)
  }, [ttsSupported])

  useEffect(() => {
    if (overlayOpen) document.body.style.overflow = 'hidden'
    else             document.body.style.overflow = ''
    return () => { document.body.style.overflow = '' }
  }, [overlayOpen])

  useEffect(() => {
    if (chatAreaRef.current) {
      chatAreaRef.current.scrollTop = chatAreaRef.current.scrollHeight
    }
  }, [chatMessages, typingVisible])

  // Flag stagger — only runs after a live scan, not on state restore
  useEffect(() => {
    if (!redFlags || section !== 'flags' || !justScannedRef.current) return
    justScannedRef.current = false

    const timers = []
    redFlags.forEach((_, idx) => {
      timers.push(
        setTimeout(() => setVisibleFlags(prev => [...prev, idx]), 500 * (idx + 1))
      )
    })
    timers.push(
      setTimeout(() => setButtonsVisible(true), 500 * redFlags.length + 400)
    )
    return () => timers.forEach(clearTimeout)
  }, [redFlags, section])

  // ── voice — TTS ───────────────────────────────────────────────────────────

  const speakAsExaminer = useCallback(function speakAsExaminer(text, examinerName, msgId) {
    if (!text) return
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.src = ''
      currentAudioRef.current = null
    }
    if (elevenLabsInFlightRef.current) return
    elevenLabsInFlightRef.current = true

    // Clear paused indicator for this message (covers retry clicks)
    if (msgId != null) {
      setVoicePausedMsgIds(prev => {
        if (!prev.has(msgId)) return prev
        const next = new Set(prev)
        next.delete(msgId)
        return next
      })
    }

    const controller = new AbortController()
    const timeoutId  = setTimeout(() => controller.abort(), 10000)

    supabase.auth.getSession().then(({ data: { session } }) => {
      const token = session?.access_token ?? null
      const headers = { 'Content-Type': 'application/json' }
      if (token) headers['Authorization'] = `Bearer ${token}`
      return fetch('/api/speak', {
        method:  'POST',
        headers,
        body:    JSON.stringify({ text, examiner: examinerName }),
        signal:  controller.signal,
      })
    })
      .then(async res => {
        clearTimeout(timeoutId)
        // Treat any non-2xx status (401 bad key, 403 forbidden, 429 quota,
        // 500 server error) as a fallback trigger — same as a network failure.
        if (!res.ok) {
          const err = new Error('speak-api-' + res.status)
          try {
            const body = await res.json()
            err.elevenlabsDetail = body
          } catch { /* non-JSON body — detail stays undefined */ }
          throw err
        }
        return res.blob()
      })
      .then(blob => {
        elevenLabsInFlightRef.current = false
        const url   = URL.createObjectURL(blob)
        const audio = new Audio(url)
        currentAudioRef.current = audio
        audio.addEventListener('canplaythrough', () => URL.revokeObjectURL(url), { once: true })
        audio.addEventListener('error', () => { currentAudioRef.current = null }, { once: true })
        audio.play().catch(() => { currentAudioRef.current = null })
      })
      .catch(err => {
        elevenLabsInFlightRef.current = false
        clearTimeout(timeoutId)
        const isTimeout  = err?.name === 'AbortError'
        const errorType  = isTimeout
          ? 'timeout'
          : err?.message?.startsWith('speak-api-') ? 'api_error' : 'network_error'
        try {
          logElevenLabsFailure(err, examinerName, errorType, authUserRef.current?.id)
        } catch { /* sentry logging must never crash the simulator */ }
        // All failure paths (401/403/429/500/network/timeout) silently fall back
        // to text-only mode — show 🔇 beside the examiner name, no error message.
        if (!hasWarnedSpeakFallback.current) {
          hasWarnedSpeakFallback.current = true
          console.warn('[speak] Voice unavailable, using text fallback')
        }
        if (msgId != null) {
          setVoicePausedMsgIds(prev => new Set([...prev, msgId]))
        }
        fallbackSpeak(text, examinerName)
      })
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only refs and stable setters captured
  }, [])

  function fallbackSpeak(text, examinerName) {
    if (!ttsSupported || !text) return
    const { rate, pitch } = resolveExaminerVoice(examinerName)
    const n = (examinerName || '').toLowerCase()

    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)

    // Select distinct system voices per examiner when the browser has enough loaded
    const enVoices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith('en'))
    if (enVoices.length >= 3) {
      if (n.includes('subject'))    utt.voice = enVoices[1]
      else if (n.includes('external')) utt.voice = enVoices[enVoices.length - 1]
      else                          utt.voice = enVoices[0]
    } else if (enVoices.length === 2) {
      if (n.includes('subject') || n.includes('external')) utt.voice = enVoices[1]
      else                                               utt.voice = enVoices[0]
    }

    utt.rate  = rate
    utt.pitch = pitch
    utt.lang  = 'en-NG'
    window.speechSynthesis.speak(utt)
  }

  function stopAudio() {
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.src = ''
      currentAudioRef.current = null
    }
    elevenLabsInFlightRef.current = false
    if (ttsSupported) window.speechSynthesis.cancel()
  }

  // ── voice — STT ───────────────────────────────────────────────────────────

  function initRecognition() {
    if (!voiceSupported) return
    const SR  = window.SpeechRecognition || window.webkitSpeechRecognition
    const rec = new SR()
    rec.lang            = 'en-NG'
    rec.continuous      = false
    rec.interimResults  = false
    rec.maxAlternatives = 1

    rec.onresult = e => {
      const transcript = e.results[0][0].transcript.trim()
      if (transcript) {
        const tWords = transcript.split(/\s+/)
        setInputValue(tWords.length > 300 ? tWords.slice(0, 300).join(' ') : transcript)
        // Use ref so we always call the current (non-stale) submit handler
        setTimeout(() => submitHandlerRef.current?.(), 80)
      }
      setMicActive(false)
      micActiveRef.current = false
    }
    rec.onerror = () => { setMicActive(false); micActiveRef.current = false }
    rec.onend   = () => {
      if (micActiveRef.current) { setMicActive(false); micActiveRef.current = false }
    }
    recognitionRef.current = rec
  }

  function toggleMic() {
    if (!voiceSupported || !recognitionRef.current) return
    if (micActiveRef.current) {
      recognitionRef.current.abort()
      setMicActive(false)
      micActiveRef.current = false
    } else {
      try {
        recognitionRef.current.start()
        setMicActive(true)
        micActiveRef.current = true
      } catch {
        setMicActive(false)
        micActiveRef.current = false
      }
    }
  }

  // ── chat helpers ──────────────────────────────────────────────────────────

  function addMsg(msg) {
    setChatMessages(prev => [...prev, { id: msgIdRef.current++, ...msg }])
  }

  function patchMsg(targetId, patch) {
    setChatMessages(prev => prev.map(m => m.id === targetId ? { ...m, ...patch } : m))
  }

  // ── scan ──────────────────────────────────────────────────────────────────

  async function startRedFlagScan() {
    setScanError(null)
    let allowed
    try {
      allowed = await checkAndRecord('red_flag_detector', features)
    } catch {
      return
    }
    if (!allowed) return
    setIsScanning(true)
    setHasSubmitted(true)
    setSection('loading')

    const chapters    = state.chapterStructure?.chapters || []
    const methodology = state.methodology?.defense_answer_template || ''

    try {
      const data = await detectRedFlags(
        studentContext,
        state.validatedTopic || '',
        methodology,
        chapters
      )
      set({ redFlags: data.flags })
      setRedFlags(data.flags)
      saveStep('red_flag_detector', { flags: data.flags })
      setVisibleFlags([])
      justScannedRef.current = true
      setSection('flags')
      setIsScanning(false)
    } catch (err) {
      logFailure('Defense Simulator', err, state.validatedTopic || '')
      setIsScanning(false)
      setSection('input')
      handleApiError(err, msg => setScanError(msg))
    }
  }

  // ── defense session DB record ─────────────────────────────────────────────
  // Creates a defense_sessions row so the certificate endpoint can verify the score.
  // Fire-and-forget: failure is silently swallowed — it must not block the simulator.

  async function createDefenseSessionRecord() {
    try {
      const currentUser = authUserRef.current
      if (!currentUser) return null
      // projectId may still be loading; ensureProject() creates or fetches it
      const pid = projectId || await ensureProject()
      if (!pid) return null
      const { data } = await supabase
        .from('defense_sessions')
        .insert({
          project_id:       pid,
          user_id:          currentUser.id,
          examiner_persona: 'external_examiner',  // three-examiner panel
          status:           'in_progress',
          turns_count:      0,
        })
        .select('id')
        .single()
      return data?.id ?? null
    } catch {
      return null
    }
  }

  // ── enter defense mode ────────────────────────────────────────────────────

  async function enterDefenseMode() {
    let allowed
    try {
      allowed = await checkAndRecord('defense_simulator', features)
    } catch {
      return
    }
    if (!allowed) return
    trackEvent('workflow_step_started', { step: 'defense_prep' })
    trackEvent('defense_simulator_started')
    defenseMessagesRef.current = []
    panelSystemRef.current     = null
    questionCountRef.current   = 0
    currentExaminerRef.current = 'The Methodologist'
    msgIdRef.current           = 0
    lowScoreCountRef.current   = 0
    sessionWarnedRef.current   = false
    turnCountRef.current       = 0

    setChatMessages([])
    setInputValue('')
    setDisplayQuestionCount(0)
    setEndEnabled(false)
    setOverlayPhase('chat')
    setSummaryData(null)
    setTypingVisible(false)
    setVerdictLoading(false)
    setInputLocked(true)
    setAnswerError('')
    setBriefAnswerWarning(false)
    setLowScoreCount(0)
    setSessionWarned(false)
    setSessionTerminated(false)
    setTurnCount(0)
    setSessionComplete(false)
    setDefenseSessionId(null)
    setVoicePausedMsgIds(new Set())
    defenseSessionIdRef.current = null
    setOverlayOpen(true)

    initRecognition()

    // Create the defense_sessions row so the certificate endpoint can verify the score.
    // Non-blocking failure: if this fails, the fallback in doEndSession creates it as completed.
    const sessionId = await createDefenseSessionRecord()
    if (sessionId) {
      defenseSessionIdRef.current = sessionId
      setDefenseSessionId(sessionId)
    } else {
      console.warn('[defense] session row not created at start — fallback runs at session end')
    }

    getFirstQuestion()
  }

  async function getFirstQuestion() {
    setTypingVisible(true)
    try {
      const result = await panelFirstQuestion(studentContext, redFlags || [], uploadedReview)
      panelSystemRef.current = result.system
      defenseMessagesRef.current = [
        { role: 'user',      content: THREE_EXAMINER_FIRST_QUESTION_PROMPT },
        { role: 'assistant', content: result.rawText },
      ]
      set({ defenseStarted: true, defenseApiMessages: defenseMessagesRef.current })

      const { parsed } = result
      currentExaminerRef.current = parsed.opening_examiner || 'The Methodologist'

      setTypingVisible(false)
      if (parsed.panel_intro) addMsg({ type: 'panel-intro', text: parsed.panel_intro })

      addMsg({
        type:     'examiner',
        examiner: currentExaminerRef.current,
        text:     parsed.question || '',
      })
      setInputLocked(false)
    } catch (err) {
      logFailure('Defense Simulator', err, state.validatedTopic || '')
      setTypingVisible(false)
      addMsg({
        type:     'examiner',
        examiner: 'The Methodologist',
        text:     'There was a connection issue. Please end the session and try again.',
      })
    }
  }

  // ── student submit ────────────────────────────────────────────────────────

  async function handleStudentSubmit() {
    // Read from DOM ref — avoids stale closure on inputValue state
    const answer = (textareaRef.current?.value ?? inputValue).trim()

    // Layer 1 — client-side word count guard (no API call, no turn consumed)
    const wordCount = answer.split(/\s+/).filter(w => w.length > 0).length
    if (wordCount < 15) {
      setBriefAnswerWarning(true)
      return
    }
    setBriefAnswerWarning(false)

    if (wordCount > 300) {
      setAnswerError('Answer is too long. Please keep your response under 300 words.')
      return
    }

    if (answer.length < 10) {
      setAnswerError('Please provide an answer before submitting.')
      return
    }
    setAnswerError('')
    setInputValue('')
    setInputLocked(true)

    if (micActiveRef.current && recognitionRef.current) {
      recognitionRef.current.abort()
      setMicActive(false)
      micActiveRef.current = false
    }

    // Append student bubble — capture its id to inject scores later
    const studentMsgId = msgIdRef.current
    setChatMessages(prev => [...prev, { id: msgIdRef.current++, type: 'student', text: answer, scores: null }])

    questionCountRef.current++
    const qCount = questionCountRef.current
    setDisplayQuestionCount(qCount)
    if (qCount >= 3) setEndEnabled(true)

    // Snapshot current history before async gap
    const historySnapshot = [...defenseMessagesRef.current]
    const system          = panelSystemRef.current
    const followUpContent = buildThreeExaminerFollowUpPrompt(answer)

    set({ defenseQuestionCount: qCount, defenseApiMessages: historySnapshot })
    setTypingVisible(true)

    try {
      const result = await panelFollowUp(system, historySnapshot, answer)
      const data   = result.parsed

      defenseMessagesRef.current = [
        ...historySnapshot,
        { role: 'user',      content: followUpContent },
        { role: 'assistant', content: result.rawText },
      ]
      set({ defenseApiMessages: defenseMessagesRef.current })

      // Inject scores into the student bubble we just rendered
      if (data.scores?.length) {
        patchMsg(studentMsgId, { scores: data.scores })
      }

      // Layer 2 — low score tracking
      if (data.scores?.length) {
        const avg = data.scores.reduce((s, e) => s + (e.score ?? 0), 0) / data.scores.length
        if (avg <= 3) {
          lowScoreCountRef.current += 1
          setLowScoreCount(lowScoreCountRef.current)
          if (lowScoreCountRef.current === 2 && !sessionWarnedRef.current) {
            sessionWarnedRef.current = true
            setSessionWarned(true)
          }
          if (lowScoreCountRef.current >= 3) {
            setTypingVisible(false)
            setSessionTerminated(true)
            setInputLocked(true)
            return
          }
        }
      }

      // Layer 3 — turn limit
      turnCountRef.current += 1
      setTurnCount(turnCountRef.current)
      if (turnCountRef.current >= 20) {
        setTypingVisible(false)
        setSessionComplete(true)
        setInputLocked(true)
        return
      }

      currentExaminerRef.current = data.next_examiner || 'The Methodologist'

      setTimeout(() => {
        setTypingVisible(false)
        const nextText =
          (data.next_examiner_reaction ? data.next_examiner_reaction + ' ' : '') +
          (data.next_question || '')
        addMsg({ type: 'examiner', examiner: currentExaminerRef.current, text: nextText })
        setInputLocked(false)
        textareaRef.current?.focus()
      }, 700)
    } catch (err) {
      logFailure('Defense Simulator', err, state.validatedTopic || '')
      setTypingVisible(false)
      addMsg({
        type:     'examiner',
        examiner: currentExaminerRef.current,
        text:     'There was a connection issue. Please try submitting your answer again.',
      })
      setInputLocked(false)
    }
  }

  // ── end session ───────────────────────────────────────────────────────────

  function handleEndSession() {
    const qc = questionCountRef.current
    if (qc < 3) return
    if (qc >= 5) { doEndSession(); return }
    setExitModalOpen(true)
  }

  async function doEndSession() {
    setExitModalOpen(false)
    setInputLocked(true)
    setEndEnabled(false)
    setVerdictLoading(true)
    setTypingVisible(false)

    try {
      const data = await panelSummary(panelSystemRef.current, defenseMessagesRef.current)
      const panelScore = Number.isFinite(Number(data.panel_score)) ? Math.round(Number(data.panel_score)) : 0
      data.panel_score = panelScore

      trackEvent('defense_simulator_completed', {
        score:    panelScore,
        examiner: 'three_examiner_panel',
        passed:   panelScore >= 7,
      })

      // Mark complete without advancing currentStep past the last step
      const isFirstDefenseCompletion = !state.stepsCompleted[5]
      const newCompleted = [...state.stepsCompleted]
      newCompleted[5] = true
      set({ stepsCompleted: newCompleted, defenseSummary: data, currentStep: 5 })
      saveStep('defense_prep', data)

      // Fire-and-forget admin notification
      const notifySession = authSessionRef.current
      if (notifySession?.access_token) {
        fetch('/api/notify', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${notifySession.access_token}` },
          body:    JSON.stringify({ action: 'defense_completed', payload: { score: panelScore } }),
        }).catch(err => console.error('[notify] defense_completed failed:', err))
      }

      // Fire-and-forget progress tracking; await in sequence so tryAwardDefenseReady
      // sees the updated defense_prep + defense_simulator rows before checking.
      markStepComplete('defense_prep')
        .then(() => markDefenseSimulatorRun())
        .then(() => tryAwardDefenseReady())
      if (isFirstDefenseCompletion) notifyStepCompleted(authUser?.id, 'defense_prep', 5).catch(() => {})

      // Update defense_sessions row with the final score and completion time.
      // Awaited so the certificate endpoint always finds a complete row.
      let sessionWriteOk = false
      if (defenseSessionIdRef.current) {
        const { error: updateErr } = await supabase
          .from('defense_sessions')
          .update({
            status:       'completed',
            total_score:  panelScore,
            turns_count:  questionCountRef.current,
            completed_at: new Date().toISOString(),
          })
          .eq('id', defenseSessionIdRef.current)
        if (updateErr) {
          console.warn('[defense] session update failed, running fallback:', updateErr.message)
          defenseSessionIdRef.current = null  // clear so fallback insert runs below
        } else {
          sessionWriteOk = true
        }
      }

      if (!sessionWriteOk) {
        // Fallback: session row was never created, or the update failed above.
        // Create it directly as completed so the certificate endpoint can verify the score.
        const pid = projectId || await ensureProject()
        if (pid) {
          const fallbackUser = authUserRef.current
          if (fallbackUser) {
            const { data: row, error: rowErr } = await supabase
              .from('defense_sessions')
              .insert({
                project_id:       pid,
                user_id:          fallbackUser.id,
                examiner_persona: 'external_examiner',
                status:           'completed',
                total_score:      Math.round(data.panel_score ?? 0),
                turns_count:      questionCountRef.current,
                completed_at:     new Date().toISOString(),
              })
              .select('id')
              .single()
            if (rowErr) {
              console.warn('[defense] fallback session insert failed:', rowErr.message)
            } else if (row?.id) {
              defenseSessionIdRef.current = row.id
              setDefenseSessionId(row.id)
            }
          }
        }
      }

      showToast('Defence session complete ✓')

      setVerdictLoading(false)
      setSummaryData(data)
      setOverlayPhase('summary')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch (err) {
      logFailure('Defense Simulator', err, state.validatedTopic || '')
      setVerdictLoading(false)
      setEndEnabled(true)
      addMsg({
        type:     'examiner',
        examiner: currentExaminerRef.current,
        text:     'Something went wrong generating your verdict. Tap "End Defence Session" to try again.',
      })
    }
  }

  // ── close & revise ────────────────────────────────────────────────────────

  const closeDefenseOverlay = useCallback(function closeDefenseOverlay() {
    const closingFromSummary = overlayPhase === 'summary'
    stopAudio()
    if (micActiveRef.current && recognitionRef.current) {
      recognitionRef.current.abort()
      micActiveRef.current = false
    }
    setOverlayOpen(false)
    setOverlayPhase('chat')
    setChatMessages([])
    setDisplayQuestionCount(0)
    setEndEnabled(false)
    setInputValue('')
    setMicActive(false)
    setVerdictLoading(false)
    if (closingFromSummary) setSection('summary')
  }, [overlayPhase])

  function handleGoBackAndRevise() {
    set({
      redFlags:              null,
      defenseApiMessages:    [],
      defenseDisplayHistory: [],
      defenseQuestionCount:  0,
      defenseStarted:        false,
      defenseSummary:        null,
    })
    setRedFlags(null)
    setVisibleFlags([])
    setButtonsVisible(false)
    setScanError(null)
    setSummaryData(null)
    setSection('input')
  }

  const handleCloseSummary = useCallback(function handleCloseSummary() {
    setSection(redFlags ? 'flags' : 'input')
  }, [redFlags])

  // ── circuit breaker actions ───────────────────────────────────────────────

  function handleRestartSimulator() {
    stopAudio()
    if (micActiveRef.current && recognitionRef.current) {
      recognitionRef.current.abort()
      micActiveRef.current = false
      setMicActive(false)
    }
    enterDefenseMode()
  }

  async function downloadDefenseTranscript() {
    if (downloadingTranscript) return
    setDownloadingTranscript(true)
    function esc(str) {
      if (str == null) return ''
      return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
    }

    const dateStr = new Date().toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric',
    })

    const rowsHTML = chatMessages.map(msg => {
      if (msg.type === 'panel-intro') {
        return `<div style="background:#F0F4F8;border-radius:8px;padding:12px 16px;margin:8px 0;font-family:'Poppins',sans-serif;font-size:13px;color:#374151;font-style:italic;">${esc(msg.text)}</div>`
      }
      if (msg.type === 'examiner') {
        return `<div style="margin:16px 0;">
          <div style="font-family:'JetBrains Mono','Courier New',monospace;font-size:10px;font-weight:700;color:#7ab8ff;letter-spacing:0.8px;margin-bottom:6px;text-transform:uppercase;">${esc(msg.examiner || 'Examiner')}</div>
          <div style="background:#EFF6FF;border-left:3px solid #0066FF;border-radius:0 8px 8px 0;padding:12px 16px;font-family:'Poppins',sans-serif;font-size:13px;color:#1E40AF;line-height:1.6;">${esc(msg.text)}</div>
        </div>`
      }
      if (msg.type === 'student') {
        const scoresHTML = (msg.scores || []).map(s => {
          const c = (s.score ?? 0) >= 7 ? '#16A34A' : (s.score ?? 0) >= 5 ? '#0066FF' : '#DC2626'
          return `<span style="display:inline-block;background:${c};color:#fff;font-family:'JetBrains Mono',monospace;font-size:9px;font-weight:700;padding:3px 8px;border-radius:999px;margin:6px 4px 0 0;letter-spacing:0.5px;">${esc((s.examiner || '').replace(/^The\s+/i, '').toUpperCase())} · ${s.score ?? '?'}/10</span>`
        }).join('')
        return `<div style="margin:16px 0;">
          <div style="font-family:'JetBrains Mono','Courier New',monospace;font-size:10px;font-weight:700;color:#374151;letter-spacing:0.8px;margin-bottom:6px;text-transform:uppercase;">Your Answer</div>
          <div style="background:#F8FAFC;border-left:3px solid #374151;border-radius:0 8px 8px 0;padding:12px 16px;font-family:'Poppins',sans-serif;font-size:13px;color:#0D1B2A;line-height:1.6;">${esc(msg.text)}</div>
          ${scoresHTML}
        </div>`
      }
      return ''
    }).join('')

    const htmlContent = `<div style="width:794px;max-width:794px;box-sizing:border-box;background:#FFFFFF;font-family:'Poppins','Helvetica Neue',sans-serif;">
      <div style="background:#060E18;padding:24px 32px;box-sizing:border-box;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-family:'DM Serif Display',Georgia,serif;font-size:22px;font-weight:400;color:#FFFFFF;">FYPro</span>
        <div style="text-align:right;">
          <div style="font-family:'DM Serif Display',Georgia,serif;font-size:15px;color:#FFFFFF;margin-bottom:4px;">Defence Session Transcript</div>
          <div style="font-family:'JetBrains Mono','Courier New',monospace;font-size:11px;color:rgba(0,102,255,0.7);">${dateStr}</div>
        </div>
      </div>
      <div style="height:3px;background:linear-gradient(90deg,#0066FF,#3B82F6,transparent);"></div>
      <div style="padding:40px 32px;background:#FFFFFF;">
        <h2 style="font-family:'DM Serif Display',Georgia,serif;font-size:22px;font-weight:400;color:#0D1B2A;border-left:4px solid #0066FF;padding-left:16px;margin:0 0 24px 0;">Session Transcript</h2>
        ${rowsHTML || '<p style="font-family:Poppins,sans-serif;font-size:13px;color:#6B7280;">No messages recorded.</p>'}
      </div>
      <div style="background:#060E18;padding:12px 32px;display:flex;justify-content:space-between;align-items:center;">
        <span style="font-family:'Poppins',sans-serif;font-size:10px;color:rgba(255,255,255,0.5);">Generated by FYPro · fypro.com.ng</span>
        <span style="font-family:'JetBrains Mono','Courier New',monospace;font-size:10px;color:rgba(0,102,255,0.6);">${dateStr}</span>
      </div>
    </div>`

    const container = document.createElement('div')
    container.innerHTML = htmlContent
    container.style.cssText = 'position:fixed;left:-9999px;top:0;z-index:-1;'
    document.body.appendChild(container)

    try {
      const { default: html2pdf } = await import('html2pdf.js')
      await html2pdf()
        .set({
          margin: [10, 10, 10, 10],
          filename: 'FYPro-Defence-Session-Transcript.pdf',
          image: { type: 'jpeg', quality: 0.98 },
          html2canvas: { scale: 2, useCORS: true, logging: false, width: 794, windowWidth: 794 },
          jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
          pagebreak: { mode: ['css'] },
        })
        .from(container.firstElementChild)
        .save()
    } finally {
      document.body.removeChild(container)
      setDownloadingTranscript(false)
    }
  }

  // ── keyboard shortcut ─────────────────────────────────────────────────────

  function handleKeyDown(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      handleStudentSubmit()
    }
  }

  // ── chat message renderer ─────────────────────────────────────────────────

  function renderChatMessage(msg) {
    switch (msg.type) {
      case 'panel-intro':
        return (
          <div key={msg.id} className="dp-panel-intro-card">
            <p className="dp-panel-intro">{msg.text}</p>
          </div>
        )
      case 'examiner':
        return (
          <ExaminerBubble
            key={msg.id}
            examiner={msg.examiner}
            text={msg.text}
            onReady={() => speakAsExaminer(msg.text, msg.examiner, msg.id)}
            voicePaused={voicePausedMsgIds.has(msg.id)}
            onRetry={() => speakAsExaminer(msg.text, msg.examiner, msg.id)}
          />
        )
      case 'student':
        return (
          <StudentBubble
            key={msg.id}
            text={msg.text}
            scores={msg.scores}
          />
        )
      default:
        return null
    }
  }

  // ── render ────────────────────────────────────────────────────────────────

  return (
    <>
      {/* ── Card ─────────────────────────────────────────────────────────── */}
      <div className="dp-card" id="dp-card">

        {/* Input section */}
        <div
          id="dp-input-section"
          className={`dp-input-section ${section === 'input' ? 'dp-section--visible' : 'dp-section--hidden'}`}
        >
          <button className="fy-back-btn" onClick={() => navigateStep(4)}>
            ← Back to Project Reviewer
          </button>

          {/* Pre-session empty state */}
          <div
            style={{
              background: 'var(--color-bg-deep)',
              minHeight: '400px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '48px 32px',
              textAlign: 'center',
              borderRadius: '16px',
              marginTop: '16px',
            }}
          >
            {/* Shield icon */}
            <div style={{ marginBottom: '24px', opacity: 0.9 }}>
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={52} height={52} fill="#0066FF" aria-hidden="true" style={{ filter: 'drop-shadow(0 0 16px rgba(0,102,255,0.5))' }}>
                <path d="M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z" />
              </svg>
            </div>

            <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.75rem', color: 'var(--color-text-white)', marginBottom: '12px', lineHeight: 1.2 }}>
              Defense Simulator
            </h2>
            <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.9rem', color: 'var(--color-text-white-dim)', maxWidth: '420px', lineHeight: 1.7, marginBottom: '32px' }}>
              Face a three-examiner panel before the real thing. Each session adapts to your answers — exposing gaps before they cost you marks.
            </p>

            {/* Three examiner personas */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '36px', flexWrap: 'wrap', justifyContent: 'center' }}>
              {[
                { name: 'The Methodologist', desc: 'Challenges your research design' },
                { name: 'The Subject Expert', desc: 'Tests your domain knowledge' },
                { name: 'The External Examiner', desc: 'Questions originality & contribution' },
              ].map((examiner) => (
                <div
                  key={examiner.name}
                  style={{
                    background: 'rgba(0,102,255,0.08)',
                    border: '1px solid rgba(0,102,255,0.2)',
                    borderRadius: '10px',
                    padding: '12px 16px',
                    textAlign: 'left',
                    minWidth: '160px',
                  }}
                >
                  <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: '#3B82F6', fontWeight: 600, marginBottom: '4px' }}>
                    {examiner.name}
                  </div>
                  <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                    {examiner.desc}
                  </div>
                </div>
              ))}
            </div>

            {/* Start button — scans for red flags then enters defense flow */}
            {scanError && (
              <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.8rem', color: '#F87171', marginBottom: '16px', maxWidth: '380px', lineHeight: 1.5 }}>
                {scanError}
              </p>
            )}
            <button
              onClick={startRedFlagScan}
              disabled={isScanning || rfOverLimit}
              style={{
                background: rfOverLimit ? 'rgba(0,102,255,0.35)' : 'var(--color-blue-primary)',
                color: 'var(--color-text-white)',
                fontFamily: 'Poppins, sans-serif',
                fontWeight: 600,
                fontSize: '0.9rem',
                border: 'none',
                borderRadius: '12px',
                padding: '14px 32px',
                cursor: (isScanning || rfOverLimit) ? 'not-allowed' : 'pointer',
                opacity: (isScanning || rfOverLimit) ? 0.6 : 1,
                boxShadow: '0 0 24px rgba(0,102,255,0.35)',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={e => {
                if (!isScanning && !rfOverLimit) {
                  e.currentTarget.style.boxShadow = '0 0 32px rgba(0,102,255,0.55)'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                }
              }}
              onMouseLeave={e => {
                e.currentTarget.style.boxShadow = '0 0 24px rgba(0,102,255,0.35)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              {isScanning ? 'Scanning for vulnerabilities…' : 'Start Simulation'}
            </button>
            {rfOverLimit && (
              <p style={{ fontFamily: 'Poppins, sans-serif', color: '#F87171', fontSize: '0.78rem', marginTop: '12px' }}>
                You've reached your limit for this feature. Start a new project or upgrade your plan.
              </p>
            )}
          </div>
        </div>

        {/* Loading section */}
        {section === 'loading' && hasSubmitted && (
          <div id="dp-loading-section" className="dp-loading-section dp-section--visible">
            <div className="skeleton-loader">
              <div className="skeleton-bar" style={{ width: '100%' }} />
              <div className="skeleton-bar" style={{ width: '75%' }} />
              <div className="skeleton-bar" style={{ width: '90%' }} />
              <div className="skeleton-bar" style={{ width: '60%' }} />
            </div>
            <p className="dp-step-label">Step 6: Defence Prep</p>
            <LoadingMessages messages={GENERIC_LOADING_MESSAGES} />
          </div>
        )}

        {/* Flags section — visible while reviewing flags OR as context above the summary */}
        <div
          id="dp-flags-section"
          className={`dp-flags-section ${(section === 'flags' || (section === 'summary' && redFlags && redFlags.length > 0)) ? 'dp-section--visible' : 'dp-section--hidden'}`}
        >
          <p className="dp-flags-header">Project Vulnerabilities Detected</p>
          <div id="dp-flags-list">
            {(redFlags || []).map((flag, idx) => (
              <FlagItem key={idx} flag={flag} visible={visibleFlags.includes(idx)} />
            ))}
          </div>
        </div>

        {/* Buttons section */}
        <div
          id="dp-buttons-section"
          className={`dp-buttons-section ${(section === 'flags' && buttonsVisible) ? 'dp-section--visible' : 'dp-section--hidden'}`}
        >
          <button
            id="dp-btn-enter-defense"
            className="dp-btn-enter-defense"
            onClick={enterDefenseMode}
            disabled={dsOverLimit}
            style={dsOverLimit ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            Enter Defence Mode
          </button>
          {dsOverLimit && (
            <p style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: 8 }}>
              You've reached your limit for this feature. Start a new project or upgrade your plan.
            </p>
          )}
          <button
            id="dp-btn-go-back"
            className="dp-btn-go-back"
            onClick={handleGoBackAndRevise}
          >
            Go Back and Revise
          </button>
          <button className="fy-back-btn" onClick={() => navigateStep(4)}>
            ← Back to Project Reviewer
          </button>
        </div>

        {/* Persisted summary section — shown on remount if defenseSummary exists */}
        <div
          id="dp-persisted-summary-section"
          className={section === 'summary' ? 'dp-section--visible' : 'dp-section--hidden'}
        >
          {summaryData && (
            <SummaryCard
              data={summaryData}
              onClose={handleCloseSummary}
              projectId={projectId}
              topic={state.validatedTopic || ''}
              defenseSessionId={defenseSessionId}
            />
          )}
        </div>
      </div>

      {/* ── Defence overlay (React portal over document.body) ─────────────── */}
      {overlayOpen && createPortal(
        <div className="dp-defense-overlay" id="dp-defense-overlay">

          {/* Header */}
          <div className="dp-defense-header">
            <svg width="28" height="28" viewBox="0 0 256 256" fill="none" aria-label="FYPro" style={{ flexShrink: 0 }}>
              <path d="M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z" fill="#0066FF" />
            </svg>
            <span className="dp-defense-panel-label">DEFENCE EXAMINATION PANEL</span>
            <button
              className="dp-defense-end-btn"
              id="dp-end-btn"
              data-disabled={!endEnabled ? 'true' : undefined}
              title={endEnabled ? '' : 'Complete at least 3 questions to end session'}
              onClick={handleEndSession}
            >
              End Defence Session
            </button>
          </div>

          {overlayPhase === 'chat' ? (
            <>
              {/* Question counter */}
              <div className="dp-counter-section" id="dp-counter-section">
                <p className="dp-counter-text" id="dp-counter-text">
                  Question {Math.min(displayQuestionCount + 1, 5)} of 5
                </p>
                <div className="dp-counter-dots" id="dp-counter-dots">
                  {[0, 1, 2, 3, 4].map(i => (
                    <span
                      key={i}
                      className={[
                        'dp-counter-dot',
                        i < displayQuestionCount  ? 'dp-counter-dot--done'   : '',
                        i === displayQuestionCount ? 'dp-counter-dot--active' : '',
                      ].filter(Boolean).join(' ')}
                    />
                  ))}
                </div>
              </div>

              {/* Chat area */}
              <div className="dp-chat-area" id="dp-chat-area" ref={chatAreaRef}>
                {chatMessages.map(renderChatMessage)}
                {typingVisible && !verdictLoading && <TypingIndicator />}
              </div>

              {/* Input area */}
              <div
                className={`dp-input-area${(inputLocked && !sessionTerminated && !sessionComplete) ? ' dp-input-area--loading' : ''}`}
                id="dp-input-area"
              >
                {sessionComplete ? (
                  /* Layer 3 — Turn limit reached */
                  <div className="dp-circuit-complete">
                    <h3 className="dp-circuit-complete__heading">Defense Session Complete</h3>
                    <p className="dp-circuit-complete__body">
                      You have completed a full defense simulation.
                      Review the examiner feedback above and focus
                      on the areas flagged for improvement.
                    </p>
                    <div className="dp-circuit-complete__buttons">
                      <button className="dp-circuit-complete__btn-restart" onClick={handleRestartSimulator}>
                        Restart Simulator
                      </button>
                      <button
                        className="dp-circuit-complete__btn-download"
                        onClick={downloadDefenseTranscript}
                        disabled={downloadingTranscript}
                        style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...(downloadingTranscript ? { opacity: 0.65, cursor: 'not-allowed' } : {}) }}
                      >
                        {downloadingTranscript ? (
                          <><Spinner /> Generating PDF…</>
                        ) : 'Download Session Report'}
                      </button>
                    </div>
                    <FeedbackThumbs feature="defense_simulator" contextId={projectId || undefined} />
                  </div>
                ) : sessionTerminated ? (
                  /* Layer 2 — 3 low scores: session terminated */
                  <div className="dp-circuit-terminated">
                    <h3 className="dp-circuit-terminated__heading">Defense Session Terminated</h3>
                    <p className="dp-circuit-terminated__body">
                      The panel has concluded this session due to
                      repeated inadequate responses. Review your
                      project thoroughly and restart the simulator
                      when you are better prepared.
                    </p>
                    <button className="dp-circuit-restart-btn" onClick={handleRestartSimulator}>
                      Restart Simulator
                    </button>
                    <FeedbackThumbs feature="defense_simulator" contextId={projectId || undefined} />
                  </div>
                ) : verdictLoading ? (
                  <div className="dp-verdict-loading">
                    <div className="skeleton-loader skeleton-loader--dark">
                      <div className="skeleton-bar" style={{ width: '100%' }} />
                      <div className="skeleton-bar" style={{ width: '75%' }} />
                      <div className="skeleton-bar" style={{ width: '90%' }} />
                    </div>
                    <LoadingMessages messages={GENERIC_LOADING_MESSAGES} />
                  </div>
                ) : (
                  <>
                    {/* Layer 2 — 2 low scores: panel warning */}
                    {sessionWarned && (
                      <div className="dp-circuit-warning">
                        <svg className="dp-circuit-warning__icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                        <div>
                          <p className="dp-circuit-warning__heading">Panel Warning Issued</p>
                          <p className="dp-circuit-warning__body">
                            The panel has noted a pattern of inadequate responses.
                            One more unsatisfactory answer will result in
                            session termination.
                          </p>
                        </div>
                      </div>
                    )}
                    <p className="dp-student-response-label">YOUR RESPONSE</p>
                    <textarea
                      ref={textareaRef}
                      className="dp-student-input"
                      id="dp-student-input"
                      placeholder="Type your answer here…"
                      value={inputValue}
                      inputMode="text"
                      enterKeyHint="send"
                      onChange={e => {
                        const val = e.target.value
                        const words = val.trim() === '' ? [] : val.trim().split(/\s+/)
                        setInputValue(words.length > 300 ? words.slice(0, 300).join(' ') : val)
                      }}
                      disabled={inputLocked}
                      onKeyDown={handleKeyDown}
                    />
                    <p style={{ color: dpWordCount >= 300 ? '#DC2626' : dpWordCount >= 240 ? '#F59E0B' : 'rgba(255,255,255,0.35)', fontSize: '0.7rem', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', marginTop: '4px' }}>
                      {dpWordCount} / 300 words
                    </p>
                    {/* Layer 1 — word count warning */}
                    {briefAnswerWarning && (
                      <div className="dp-circuit-brief-warning">
                        Your answer is too brief. Examiners expect
                        substantive responses of at least 2–3 sentences.
                        Elaborate on your answer before submitting.
                      </div>
                    )}
                    {answerError && (
                      <p className="dp-answer-error dp-answer-error--visible">{answerError}</p>
                    )}
                    <div className="dp-input-row">
                      {voiceSupported && (
                        <button
                          className="dp-mic-btn"
                          id="dp-mic-btn"
                          type="button"
                          disabled={inputLocked}
                          aria-label={micActive ? 'Stop recording' : 'Speak your answer'}
                          title={micActive ? 'Stop recording' : 'Speak your answer'}
                          onClick={toggleMic}
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            width: '44px',
                            height: '44px',
                            borderRadius: '12px',
                            border: micActive
                              ? '1.5px solid rgba(220,38,38,0.6)'
                              : '1.5px solid var(--border-subtle)',
                            background: micActive ? 'rgba(220,38,38,0.2)' : 'var(--header-btn-bg)',
                            color: micActive ? '#F87171' : 'var(--text-secondary)',
                            cursor: 'pointer',
                            flexShrink: 0,
                            transition: 'all 0.2s ease',
                            marginRight: '8px',
                          }}
                        >
                          {MIC_SVG}
                        </button>
                      )}
                      <button
                        className="dp-send-btn"
                        id="dp-send-btn"
                        disabled={inputLocked || dpWordCount > 300}
                        onClick={handleStudentSubmit}
                      >
                        Send Answer
                      </button>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : (
            summaryData && (
              <SummaryCard
                data={summaryData}
                onClose={closeDefenseOverlay}
                projectId={projectId}
                topic={state.validatedTopic || ''}
                defenseSessionId={defenseSessionId}
              />
            )
          )}

          {exitModalOpen && (
            <ExitModal
              questionCount={questionCountRef.current}
              onContinue={() => setExitModalOpen(false)}
              onLeave={() => { setExitModalOpen(false); doEndSession() }}
            />
          )}
        </div>,
        document.body
      )}
    </>
  )
}
