import { useState, useEffect, useRef } from 'react'
import { checkAndRecord, useRunLimit } from '../../hooks/useRunLimit'
import { usePaidFeatures } from '../../hooks/usePaidFeatures'
import { buildWritingPlan, handleApiError, logFailure } from '../../services/api'
import { useApp } from '../../context/AppContext'
import { showToast } from '../../components/Toast'
import ApiErrorBox from '../../components/ApiErrorBox'
import LoadingMessages from '../../components/LoadingMessages'
import Spinner from '../../components/Spinner'
import { useProjectState } from '../../hooks/useProjectState'
import FeedbackThumbs from '../../components/feedback/FeedbackThumbs'
import { markStepComplete } from '../../lib/progress'
import { trackEvent } from '../../lib/analytics'
import { useUser } from '../../hooks/useUser'
import { notifyStepCompleted } from '../../lib/notifications'
import { checkAchievements } from '../../lib/checkAchievements'
import { shouldShowCelebration } from '../../lib/celebrations'
import CelebrationModal from '../../components/celebration/CelebrationModal'

const LOADING_MESSAGES = [
  'Generating your analysis...',
  'Reviewing the details...',
  'Almost done...',
]

function computeUrgency(dateStr) {
  if (!dateStr) return null
  const today = new Date()
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const deadlineMs = new Date(dateStr + 'T00:00:00').getTime()
  if (deadlineMs <= todayMs) return null
  const weeks = Math.floor((deadlineMs - todayMs) / (7 * 24 * 60 * 60 * 1000))
  if (weeks > 8) return { tier: 'green', icon: '●', text: weeks + ' weeks remaining — you have good time' }
  if (weeks >= 4) return { tier: 'amber', icon: '●', text: weeks + ' weeks remaining — moderate urgency' }
  return { tier: 'red', icon: '!', text: weeks + ' week' + (weeks === 1 ? '' : 's') + ' remaining — tight deadline' }
}

export default function WritingPlanner() {
  const { state, studentContext, navigateStep, completeStep } = useApp()
  const { saveStep, projectId } = useProjectState()
  const { features } = usePaidFeatures()
  const { user } = useUser()
  const CELEBRATION_KEY = 'step_4_complete'
  const STEP_EMOJI = '📝'
  const STEP_BODY = 'Writing plan set. One step closer to your defense.'

  const [celebration, setCelebration] = useState(null)

  const isFree = !features.includes('student_pack') && !features.includes('defense_pack')
  const { isOverLimit } = useRunLimit(features)
  const overLimit = isOverLimit('writing_planner')

  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [section, setSection]       = useState(state.writingPlan ? 'result' : 'input')
  const [data, setData]             = useState(state.writingPlan || null)
  const [dateValue, setDateValue]   = useState(state.submissionDeadline || '')
  const [error, setError]           = useState(null)
  const [btnDisabled, setBtnDisabled] = useState(false)
  const [urgency, setUrgency]       = useState(() => computeUrgency(state.submissionDeadline || ''))

  // Restore autosaved deadline on mount if form is empty
  useEffect(() => {
    if (dateValue) return
    try {
      const saved = localStorage.getItem('fypro_autosave_writing_planner')
      if (saved) {
        const data = JSON.parse(saved)
        if (data.dateValue) {
          setDateValue(data.dateValue)
          setUrgency(computeUrgency(data.dateValue))
        }
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleDateChange(e) {
    const value = e.target.value
    setDateValue(value)
    setError(null)

    if (!value) {
      setUrgency(null)
      return
    }

    const today = new Date()
    const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const deadlineMs = new Date(value + 'T00:00:00').getTime()

    if (deadlineMs <= todayMs) {
      setError('Please select a future date — the deadline must be after today.')
      setUrgency(null)
      return
    }

    setUrgency(computeUrgency(value))

    if (section === 'result') {
      setData(null)
      setSection('input')
    }
  }

  async function handleGenerate() {
    if (inflightRef.current) return
    setError(null)
    if (!dateValue) return

    const today = new Date()
    const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const deadlineMs = new Date(dateValue + 'T00:00:00').getTime()

    if (deadlineMs <= todayMs) {
      setError('Please select a future date before generating a plan.')
      return
    }

    inflightRef.current = true
    setBtnDisabled(true)

    let allowed
    try {
      allowed = await checkAndRecord('writing_planner', features)
    } catch {
      inflightRef.current = false
      setBtnDisabled(false)
      return
    }
    if (!allowed) {
      inflightRef.current = false
      setBtnDisabled(false)
      return
    }

    trackEvent('workflow_step_started', { step: 'writing_planner' })
    localStorage.setItem('fypro_autosave_writing_planner', JSON.stringify({ dateValue }))
    setHasSubmitted(true)
    setSection('loading')

    const currentDate = new Date().toISOString().slice(0, 10)
    const previousSteps = {
      validatedTopic:    state.validatedTopic,
      chapterStructure:  state.chapterStructure,
      chosenMethodology: state.chosenMethodology,
      methodology:       state.methodology,
    }

    buildWritingPlan(studentContext, dateValue, currentDate, previousSteps, features)
      .then(result => {
        inflightRef.current = false
        setData(result)
        setSection('result')
        setBtnDisabled(false)
        saveStep('writing_planner', { ...result, submission_deadline: dateValue }, dateValue)
        setTimeout(() => {
          document.getElementById('wp-result-section')
            ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
        }, 80)
      })
      .catch(err => {
        inflightRef.current = false
        logFailure('Writing Planner', err, dateValue)
        setSection('input')
        if (!handleApiError(err, msg => {
          setError(msg)
          if (!msg) setBtnDisabled(false)
        })) {
          setBtnDisabled(false)
          setError('Something went wrong. Please check your connection and try again.')
        }
      })
  }

  function handleConfirm() {
    if (!data) return
    const isFirstWritingCompletion = !state.stepsCompleted[3]
    completeStep(3, { writingPlan: data, submissionDeadline: dateValue })
    saveStep('writing_planner', { ...data, submission_deadline: dateValue }, dateValue)
    markStepComplete('writing_planner')
    if (isFirstWritingCompletion) notifyStepCompleted(user?.id, 'writing_planner', 3).catch(() => {})
    showToast('Writing plan created ✓')

    // Check achievements after step completion
    if (isFirstWritingCompletion) {
      checkAchievements().then(newKeys => {
        if (newKeys.length > 0) {
          showToast(`Achievement unlocked 🏅`, 'success')
        }
        if (shouldShowCelebration(CELEBRATION_KEY)) {
          setCelebration({
            emoji: STEP_EMOJI,
            headline: 'Step Complete!',
            body: STEP_BODY,
          })
        }
      })
    }
  }

  const loadingTimerRef = useRef(null)
  const inflightRef     = useRef(false)

  // Safety timeout: force-stop loading after 30s
  useEffect(() => {
    if (section === 'loading') {
      loadingTimerRef.current = setTimeout(() => {
        setSection('input')
        setBtnDisabled(false)
        setError('Request timed out. Please check your connection and try again.')
      }, 30000)
    } else {
      clearTimeout(loadingTimerRef.current)
    }
    return () => clearTimeout(loadingTimerRef.current)
  }, [section])

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const generateEnabled = !btnDisabled && !!urgency && !overLimit

  return (
    <div className="wp-card" id="wp-card">

      {/* Input section */}
      <div
        id="wp-input-section"
        className={`wp-input-section ${section === 'input' ? 'tv-section--visible' : 'tv-section--hidden'}`}
      >
        <button className="fy-back-btn" onClick={() => navigateStep(2)}>
          ← Back to Methodology Advisor
        </button>
        <p className="wp-step-label">Step 4: Writing Planner</p>
        <p className="wp-description">
          FYPro will build a realistic week-by-week writing schedule from today to your submission
          deadline — weighted by chapter complexity and adjusted for Nigerian public holidays and
          exam periods.
        </p>
        <div className="wp-date-field">
          <label className="wp-date-label" htmlFor="wp-date-input">Submission Deadline</label>
          <input
            id="wp-date-input"
            className="wp-date-input"
            type="date"
            min={todayStr}
            value={dateValue}
            onChange={handleDateChange}
          />
        </div>
        <div
          id="wp-urgency"
          className={[
            'wp-urgency',
            urgency ? `tv-section--visible wp-urgency--${urgency.tier}` : 'tv-section--hidden',
          ].join(' ')}
        >
          <span id="wp-urgency-icon" className="wp-urgency__icon">{urgency?.icon}</span>
          <span id="wp-urgency-text" className="wp-urgency__text">{urgency?.text}</span>
        </div>
        <ApiErrorBox error={error} onRetry={handleGenerate} />
        <button
          id="btn-generate-plan"
          className="wp-btn-generate"
          onClick={handleGenerate}
          disabled={!generateEnabled}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...(overLimit ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
        >
          {btnDisabled ? <><Spinner /> Working…</> : 'Generate Writing Plan'}
        </button>
        {overLimit && (
          <p className="wp-error-text" style={{ marginTop: 8 }}>
            You've reached your limit for this feature. Start a new project or upgrade your plan.
          </p>
        )}

        {/* Empty state — shown before schedule is generated */}
        {!data && (
          <p style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
            marginTop: '20px',
            lineHeight: 1.6,
            textAlign: 'center',
          }}>
            Set your submission deadline above and generate your personalised writing schedule.
            FYPro builds a week-by-week plan that works backwards from your defense date.
          </p>
        )}
      </div>

      {/* Loading section */}
      {section === 'loading' && hasSubmitted && (
        <div id="wp-loading-section" className="wp-loading-section tv-section--visible">
          <div className="skeleton-loader">
            <div className="skeleton-bar" style={{ width: '100%' }} />
            <div className="skeleton-bar" style={{ width: '75%' }} />
            <div className="skeleton-bar" style={{ width: '90%' }} />
            <div className="skeleton-bar" style={{ width: '60%' }} />
          </div>
          <LoadingMessages messages={LOADING_MESSAGES} />
        </div>
      )}

      {/* Result section */}
      <div
        id="wp-result-section"
        className={`wp-result-section ${section === 'result' ? 'tv-section--visible' : 'tv-section--hidden'}`}
      >
        {data && (
          <>
            <div className="wp-summary-bar">
              <div className="wp-summary-stat">
                <span id="wp-stat-weeks" className="wp-summary-stat__value">{String(data.total_weeks || 0)}</span>
                <span className="wp-summary-stat__label">total weeks</span>
              </div>
              <div className="wp-summary-divider" />
              <div className="wp-summary-stat">
                <span id="wp-stat-avg" className="wp-summary-stat__value">{String(data.weekly_average || 0)}</span>
                <span className="wp-summary-stat__label">words / week avg</span>
              </div>
              <div className="wp-summary-divider" />
              <div className="wp-summary-stat">
                <span id="wp-stat-total" className="wp-summary-stat__value">{String(data.total_words || 0)}</span>
                <span className="wp-summary-stat__label">total words</span>
              </div>
            </div>

            <div id="wp-timeline" className="wp-timeline">
              {(isFree ? (data.weeks || []).slice(0, 4) : (data.weeks || [])).map((week, i) => (
                <WeekNode key={i} week={week} idx={i} />
              ))}
            </div>

            {isFree && (
              <p style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.8125rem',
                color: 'rgba(255,255,255,0.5)',
                background: 'rgba(245,158,11,0.06)',
                border: '1px solid rgba(245,158,11,0.2)',
                borderRadius: '8px',
                padding: '10px 14px',
                margin: '12px 0',
                lineHeight: 1.5,
              }}>
                Free plan shows 4 weeks. Upgrade to Student Pack for your full semester plan.
              </p>
            )}

            <button
              id="btn-confirm-plan"
              className="wp-btn-confirm"
              onClick={handleConfirm}
            >
              Confirm Plan — Continue
            </button>

            <FeedbackThumbs feature="writing_planner" contextId={projectId || undefined} />
          </>
        )}
      </div>

      <CelebrationModal
        open={celebration !== null}
        onClose={() => setCelebration(null)}
        emoji={celebration?.emoji ?? '🎉'}
        headline={celebration?.headline ?? ''}
        body={celebration?.body ?? ''}
        rankLabel={null}
        ctaLabel="Continue"
        onCta={() => setCelebration(null)}
      />

    </div>
  )
}

function WeekNode({ week, idx = 0 }) {
  const classes = [
    'wp-week-node',
    week.is_current_week ? 'wp-week-node--current'  : '',
    week.is_buffer_week  ? 'wp-week-node--buffer'   : '',
    week.is_holiday_week ? 'wp-week-node--holiday'  : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={classes} style={{ '--wp-week-delay': `${idx * 40}ms` }}>
      <div className="wp-week-dot" />
      <div className="wp-week-content">
        <div className="wp-week-header">
          <span className="wp-week-number">Week {week.week_number}</span>
          <span className="wp-week-dates">{week.dates || ''}</span>
          {week.is_current_week && (
            <span className="wp-you-are-here">You Are Here</span>
          )}
        </div>
        {week.focus && (
          <p className="wp-week-focus">{week.focus}</p>
        )}
        {week.is_buffer_week ? (
          <span className="wp-week-tag wp-week-tag--buffer">Buffer Week</span>
        ) : week.is_holiday_week ? (
          <>
            <span className="wp-week-tag wp-week-tag--holiday">Holiday Week</span>
            {week.holiday_note && (
              <p className="wp-week-holiday-note">{week.holiday_note}</p>
            )}
          </>
        ) : (
          <p className="wp-week-target">{String(week.word_target || 0)} words</p>
        )}
      </div>
    </div>
  )
}
