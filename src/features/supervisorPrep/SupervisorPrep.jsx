import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { prepareSupervisorMeeting, handleApiError } from '../../services/api'

const STAGES = [
  'Just starting',
  'Topic selected',
  'Proposal submitted',
  'Chapter 1 done',
  'Data collection',
  'Analysis stage',
  'Writing up',
  'Waiting for corrections',
]

export default function SupervisorPrep() {
  const navigate = useNavigate()

  const [section,      setSection]      = useState('input')
  const [stage,        setStage]        = useState('')
  const [lastFeedback, setLastFeedback] = useState('')
  const [stuckOn,      setStuckOn]      = useState('')
  const [questions,    setQuestions]    = useState([])
  const [error,        setError]        = useState(null)
  const [btnDisabled,  setBtnDisabled]  = useState(false)

  function handleSubmit() {
    if (!stage) {
      setError('Please select where you are in your project.')
      return
    }
    setError(null)
    setBtnDisabled(true)
    setSection('loading')

    prepareSupervisorMeeting(stage, lastFeedback.trim(), stuckOn.trim())
      .then(data => {
        setQuestions(data.questions || [])
        setSection('result')
        setBtnDisabled(false)
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

  function handleReset() {
    setQuestions([])
    setSection('input')
    setError(null)
    setBtnDisabled(false)
  }

  return (
    <div className="sp-page">

      <div className="sp-topbar">
        <button className="sp-back-btn" onClick={() => navigate('/dashboard')}>
          ← Back to Dashboard
        </button>
      </div>

      <div className="sp-card">

        {section === 'input' && (
          <>
            <p className="sp-step-label">Bonus Tool</p>
            <h1 className="sp-title">Supervisor Meeting Prep</h1>
            <p className="sp-description">
              Tell FYPro where you are in your project and what is on your mind.
              We will generate 8 specific questions to ask your supervisor — concrete
              and actionable, not generic.
            </p>

            <div className="sp-field">
              <label className="sp-label" htmlFor="sp-stage-select">
                Where are you in your project?
              </label>
              <select
                id="sp-stage-select"
                className="sp-select"
                value={stage}
                onChange={e => { setStage(e.target.value); setError(null) }}
              >
                <option value="" disabled>Select your current stage…</option>
                {STAGES.map(s => (
                  <option key={s} value={s}>{s}</option>
                ))}
              </select>
            </div>

            <div className="sp-field">
              <label className="sp-label" htmlFor="sp-feedback-textarea">
                What did your supervisor say last time?
                <span className="sp-label-optional"> (optional)</span>
              </label>
              <textarea
                id="sp-feedback-textarea"
                className="sp-textarea"
                placeholder="e.g. narrow your scope, fix your literature review…"
                value={lastFeedback}
                onChange={e => setLastFeedback(e.target.value)}
                maxLength={600}
              />
            </div>

            <div className="sp-field">
              <label className="sp-label" htmlFor="sp-stuck-textarea">
                What are you stuck on?
                <span className="sp-label-optional"> (optional)</span>
              </label>
              <textarea
                id="sp-stuck-textarea"
                className="sp-textarea"
                placeholder="e.g. not sure how to structure methodology…"
                value={stuckOn}
                onChange={e => setStuckOn(e.target.value)}
                maxLength={400}
              />
            </div>

            {error && <p className="sp-error-text">{error}</p>}

            <button
              id="btn-prepare-me"
              className="sp-btn-submit"
              onClick={handleSubmit}
              disabled={btnDisabled || !stage}
            >
              Prepare Me
            </button>
          </>
        )}

        {section === 'loading' && (
          <div className="sp-loading-section">
            <div className="skeleton-loader">
              <div className="skeleton-bar" style={{ width: '100%' }} />
              <div className="skeleton-bar" style={{ width: '82%' }} />
              <div className="skeleton-bar" style={{ width: '93%' }} />
              <div className="skeleton-bar" style={{ width: '67%' }} />
              <div className="skeleton-bar" style={{ width: '88%' }} />
            </div>
            <p className="sp-loading-text">Generating your meeting questions…</p>
          </div>
        )}

        {section === 'result' && questions.length > 0 && (
          <>
            <div className="sp-result-header">
              <h2 className="sp-result-title">Your 8 Questions</h2>
              <span className="sp-result-badge">Ready to ask</span>
            </div>

            <ol className="sp-questions-list">
              {questions.map((q, i) => (
                <li key={i} className="sp-question-item">
                  <span className="sp-question-num">{i + 1}</span>
                  <p className="sp-question-text">{q}</p>
                </li>
              ))}
            </ol>

            <button className="sp-btn-reset" onClick={handleReset}>
              Generate new questions
            </button>
          </>
        )}

      </div>
    </div>
  )
}
