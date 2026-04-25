import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { buildWritingPlan } from '../../services/api'
import { handleApiError } from '../../services/api'
import { showToast } from '../../components/Toast'

function WeekNode({ week }) {
  const cls = [
    'wp-week-node',
    week.is_current_week ? 'wp-week-node--current'  : '',
    week.is_buffer_week  ? 'wp-week-node--buffer'   : '',
    week.is_holiday_week ? 'wp-week-node--holiday'  : '',
  ].join(' ').trim()

  return (
    <div className={cls}>
      <div className="wp-week-dot" />
      <div className="wp-week-content">
        <div className="wp-week-header">
          <span className="wp-week-number">Week {week.week_number}</span>
          <span className="wp-week-dates">{week.dates}</span>
          {week.is_current_week && (
            <span className="wp-you-are-here">You Are Here</span>
          )}
        </div>
        {week.focus && <p className="wp-week-focus">{week.focus}</p>}
        {week.is_buffer_week && (
          <span className="wp-week-tag wp-week-tag--buffer">Buffer Week</span>
        )}
        {week.is_holiday_week && (
          <>
            <span className="wp-week-tag wp-week-tag--holiday">Holiday Week</span>
            {week.holiday_note && (
              <p className="wp-week-holiday-note">{week.holiday_note}</p>
            )}
          </>
        )}
        {!week.is_buffer_week && !week.is_holiday_week && (
          <p className="wp-week-target">{week.word_target || 0} words</p>
        )}
      </div>
    </div>
  )
}

function computeUrgency(dateStr) {
  const today = new Date()
  const todayMs = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const deadlineMs = new Date(dateStr + 'T00:00:00').getTime()
  if (deadlineMs <= todayMs) return null
  const weeks = Math.floor((deadlineMs - todayMs) / (7 * 24 * 60 * 60 * 1000))
  if (weeks > 8) return { tier: 'green', icon: '●', text: `${weeks} weeks remaining — you have good time` }
  if (weeks >= 4) return { tier: 'amber', icon: '●', text: `${weeks} weeks remaining — moderate urgency` }
  return { tier: 'red', icon: '!', text: `${weeks} week${weeks === 1 ? '' : 's'} remaining — tight deadline` }
}

export default function WritingPlanner() {
  const { state, set, completeStep, navigateStep, studentContext } = useApp()

  const [section, setSection] = useState(
    state.stepsCompleted[3] ? 'result' : 'input'
  )
  const [deadline, setDeadline] = useState(state.submissionDeadline || '')
  const [urgency, setUrgency] = useState(null)
  const [planData, setPlanData] = useState(state.writingPlan || null)
  const [error, setError] = useState('')

  const today = new Date().toISOString().slice(0, 10)

  useEffect(() => {
    if (state.writingPlan && state.stepsCompleted[3]) {
      setPlanData(state.writingPlan)
      setSection('result')
    }
  }, []) // eslint-disable-line

  function handleDateChange(e) {
    const val = e.target.value
    setDeadline(val)
    setError('')
    if (!val) { setUrgency(null); return }
    const u = computeUrgency(val)
    if (!u) {
      setError('Please select a future date — the deadline must be after today.')
      setUrgency(null)
    } else {
      setUrgency(u)
      // If we already had a result, reset to input when date changes
      if (planData && section === 'result') {
        setPlanData(null)
        setSection('input')
      }
    }
  }

  async function handleGenerate() {
    if (!deadline) return
    const u = computeUrgency(deadline)
    if (!u) {
      setError('Please select a future date before generating a plan.')
      return
    }
    setError('')
    setSection('loading')
    try {
      const data = await buildWritingPlan(studentContext, state.validatedTopic, state.chapterStructure, deadline, state.chosenMethodology)
      setPlanData(data)
      set({ writingPlan: data, submissionDeadline: deadline })
      setSection('result')
      showToast('Analysis complete', 'success')
    } catch (err) {
      setSection('input')
      handleApiError(err, (msg) => {
        setError(msg || 'Something went wrong. Please check your connection and try again.')
        showToast('Something went wrong. Try again.', 'error')
      })
    }
  }

  function handleConfirm() {
    if (!planData) return
    completeStep(3)
    showToast('Step 5 unlocked', 'unlock')
  }

  const canGenerate = Boolean(deadline) && Boolean(urgency) && section !== 'loading'

  return (
    <div className="wp-card" id="wp-card">

      {/* ── Input Section ── */}
      <div
        id="wp-input-section"
        className={`wp-input-section${section === 'input' ? ' tv-section--visible' : ' tv-section--hidden'}`}
      >
        <button className="fy-back-btn" onClick={() => navigateStep(2)}>
          ← Back to Methodology Advisor
        </button>
        <p className="wp-step-label">Step 4: Writing Planner</p>
        <p className="wp-description">
          FYPro will build a realistic week-by-week writing schedule from today to your submission deadline — weighted by chapter complexity and adjusted for Nigerian public holidays and exam periods.
        </p>

        <div className="wp-date-field">
          <label className="wp-date-label" htmlFor="wp-date-input">Submission Deadline</label>
          <input
            id="wp-date-input"
            className="wp-date-input"
            type="date"
            min={today}
            value={deadline}
            onChange={handleDateChange}
          />
        </div>

        {urgency && (
          <div
            id="wp-urgency"
            className={`wp-urgency tv-section--visible wp-urgency--${urgency.tier}`}
          >
            <span id="wp-urgency-icon" className="wp-urgency__icon">{urgency.icon}</span>
            <span id="wp-urgency-text" className="wp-urgency__text">{urgency.text}</span>
          </div>
        )}

        {error && (
          <p id="wp-error-text" className="wp-error-text tv-section--visible">{error}</p>
        )}

        <button
          id="btn-generate-plan"
          className="wp-btn-generate"
          disabled={!canGenerate}
          onClick={handleGenerate}
        >
          Generate Writing Plan
        </button>
      </div>

      {/* ── Loading Section ── */}
      <div
        id="wp-loading-section"
        className={`wp-loading-section${section === 'loading' ? ' tv-section--visible' : ' tv-section--hidden'}`}
      >
        <div className="skeleton-loader">
          <div className="skeleton-bar" style={{ width: '100%' }} />
          <div className="skeleton-bar" style={{ width: '75%' }} />
          <div className="skeleton-bar" style={{ width: '90%' }} />
          <div className="skeleton-bar" style={{ width: '60%' }} />
        </div>
        <p className="tv-loading-text">Building your writing plan…</p>
      </div>

      {/* ── Result Section ── */}
      {planData && (
        <div
          id="wp-result-section"
          className={`wp-result-section${section === 'result' ? ' tv-section--visible' : ' tv-section--hidden'}`}
        >
          <div className="wp-summary-bar">
            <div className="wp-summary-stat">
              <span id="wp-stat-weeks" className="wp-summary-stat__value">{planData.total_weeks || 0}</span>
              <span className="wp-summary-stat__label">total weeks</span>
            </div>
            <div className="wp-summary-divider" />
            <div className="wp-summary-stat">
              <span id="wp-stat-avg" className="wp-summary-stat__value">{planData.weekly_average || 0}</span>
              <span className="wp-summary-stat__label">words / week avg</span>
            </div>
            <div className="wp-summary-divider" />
            <div className="wp-summary-stat">
              <span id="wp-stat-total" className="wp-summary-stat__value">{planData.total_words || 0}</span>
              <span className="wp-summary-stat__label">total words</span>
            </div>
          </div>

          <div id="wp-timeline" className="wp-timeline">
            {(planData.weeks || []).map((week, i) => (
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
        </div>
      )}
    </div>
  )
}
