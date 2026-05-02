import { useState } from 'react'
import { buildWritingPlan, handleApiError } from '../../services/api'
import { useApp } from '../../context/AppContext'
import { showToast } from '../../components/Toast'
import { useProjectState } from '../../hooks/useProjectState'

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
  const { saveStep } = useProjectState()

  const [section, setSection]       = useState(state.writingPlan ? 'result' : 'input')
  const [data, setData]             = useState(state.writingPlan || null)
  const [dateValue, setDateValue]   = useState(state.submissionDeadline || '')
  const [error, setError]           = useState(null)
  const [btnDisabled, setBtnDisabled] = useState(false)
  const [urgency, setUrgency]       = useState(() => computeUrgency(state.submissionDeadline || ''))

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

  function handleGenerate() {
    setError(null)
    if (!dateValue) return

    const today = new Date()
    const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
    const deadlineMs = new Date(dateValue + 'T00:00:00').getTime()

    if (deadlineMs <= todayMs) {
      setError('Please select a future date before generating a plan.')
      return
    }

    setBtnDisabled(true)
    setSection('loading')

    const currentDate = new Date().toISOString().slice(0, 10)

    buildWritingPlan(studentContext, dateValue, currentDate)
      .then(result => {
        setData(result)
        setSection('result')
        setBtnDisabled(false)
        saveStep('writing_planner', { ...result, submission_deadline: dateValue }, dateValue)
      })
      .catch(err => {
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
    completeStep(3, { writingPlan: data, submissionDeadline: dateValue })
    saveStep('writing_planner', { ...data, submission_deadline: dateValue }, dateValue)
    showToast('Writing plan created ✓')
  }

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  const generateEnabled = !btnDisabled && !!urgency

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
        {error && <p id="wp-error-text" className="wp-error-text">{error}</p>}
        <button
          id="btn-generate-plan"
          className="wp-btn-generate"
          onClick={handleGenerate}
          disabled={!generateEnabled}
        >
          Generate Writing Plan
        </button>
      </div>

      {/* Loading section */}
      <div
        id="wp-loading-section"
        className={`wp-loading-section ${section === 'loading' ? 'tv-section--visible' : 'tv-section--hidden'}`}
      >
        <div className="skeleton-loader">
          <div className="skeleton-bar" style={{ width: '100%' }} />
          <div className="skeleton-bar" style={{ width: '75%' }} />
          <div className="skeleton-bar" style={{ width: '90%' }} />
          <div className="skeleton-bar" style={{ width: '60%' }} />
        </div>
        <p className="tv-loading-text">Building your writing plan…</p>
      </div>

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
              {(data.weeks || []).map((week, i) => (
                <WeekNode key={i} week={week} />
              ))}
            </div>

            <button
              id="btn-confirm-plan"
              className="wp-btn-confirm"
              onClick={handleConfirm}
            >
              Confirm Plan — Continue
            </button>
          </>
        )}
      </div>

    </div>
  )
}

function WeekNode({ week }) {
  const classes = [
    'wp-week-node',
    week.is_current_week ? 'wp-week-node--current'  : '',
    week.is_buffer_week  ? 'wp-week-node--buffer'   : '',
    week.is_holiday_week ? 'wp-week-node--holiday'  : '',
  ].filter(Boolean).join(' ')

  return (
    <div className={classes}>
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
