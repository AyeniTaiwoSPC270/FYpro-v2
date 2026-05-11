import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { prepareSupervisorMeeting, handleApiError, logFailure } from '../../services/api'
import { checkAndRecord } from '../../hooks/useRunLimit'
import { usePaidFeatures } from '../../hooks/usePaidFeatures'
import { useProjectState } from '../../hooks/useProjectState'
import ApiErrorBox from '../../components/ApiErrorBox'
import LoadingMessages from '../../components/LoadingMessages'

const LOADING_MESSAGES = [
  'Generating your analysis...',
  'Reviewing the details...',
  'Almost done...',
]

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

function countWords(text) {
  return text.trim() === '' ? 0 : text.trim().split(/\s+/).length
}

export default function SupervisorPrep() {
  const navigate = useNavigate()
  const { features } = usePaidFeatures()
  const { saveStep } = useProjectState()

  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [section,      setSection]      = useState('input')
  const [stage,        setStage]        = useState('')
  const [lastFeedback, setLastFeedback] = useState('')
  const [stuckOn,      setStuckOn]      = useState('')
  const [questions,    setQuestions]    = useState([])
  const [error,        setError]        = useState(null)
  const [btnDisabled,  setBtnDisabled]  = useState(false)
  const feedbackWordCount = countWords(lastFeedback)
  const stuckWordCount    = countWords(stuckOn)

  const loadingTimerRef = useRef(null)

  // Restore autosaved inputs on mount if form is empty
  useEffect(() => {
    if (stage || lastFeedback || stuckOn) return
    try {
      const saved = localStorage.getItem('fypro_autosave_supervisor_prep')
      if (saved) {
        const data = JSON.parse(saved)
        if (data.stage) setStage(data.stage)
        if (data.lastFeedback) setLastFeedback(data.lastFeedback)
        if (data.stuckOn) setStuckOn(data.stuckOn)
      }
    } catch {}
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

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

  async function handleSubmit() {
    if (!stage) {
      setError('Please select where you are in your project.')
      return
    }
    const allowed = await checkAndRecord('meeting_prep', features)
    if (!allowed) return
    setError(null)
    localStorage.setItem('fypro_autosave_supervisor_prep', JSON.stringify({ stage, lastFeedback, stuckOn }))
    setBtnDisabled(true)
    setHasSubmitted(true)
    setSection('loading')

    prepareSupervisorMeeting(stage, lastFeedback.trim(), stuckOn.trim())
      .then(data => {
        const questions = data.questions || []
        setQuestions(questions)
        setSection('result')
        setBtnDisabled(false)
        saveStep('meeting_prep', { questions, stage })
      })
      .catch(err => {
        logFailure('Meeting Prep', err, `${stage} | ${stuckOn.trim()}`)
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
                onChange={e => {
                  const val = e.target.value
                  const words = val.trim() === '' ? [] : val.trim().split(/\s+/)
                  setLastFeedback(words.length > 500 ? words.slice(0, 500).join(' ') : val)
                }}
              />
              <p style={{ color: feedbackWordCount >= 500 ? '#DC2626' : feedbackWordCount >= 400 ? '#F59E0B' : 'rgba(13,27,42,0.4)', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', marginTop: '4px' }}>
                {feedbackWordCount} / 500 words
              </p>
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
                onChange={e => {
                  const val = e.target.value
                  const words = val.trim() === '' ? [] : val.trim().split(/\s+/)
                  setStuckOn(words.length > 500 ? words.slice(0, 500).join(' ') : val)
                }}
              />
              <p style={{ color: stuckWordCount >= 500 ? '#DC2626' : stuckWordCount >= 400 ? '#F59E0B' : 'rgba(13,27,42,0.4)', fontSize: '0.75rem', fontFamily: "'JetBrains Mono', monospace", textAlign: 'right', marginTop: '4px' }}>
                {stuckWordCount} / 500 words
              </p>
            </div>

            <ApiErrorBox error={error} onRetry={handleSubmit} />

            <button
              id="btn-prepare-me"
              className="sp-btn-submit"
              onClick={handleSubmit}
              disabled={btnDisabled || !stage || feedbackWordCount > 500 || stuckWordCount > 500}
            >
              {btnDisabled ? 'Working…' : 'Prepare Me'}
            </button>
          </>
        )}

        {section === 'loading' && hasSubmitted && (
          <div className="sp-loading-section">
            <div className="skeleton-loader">
              <div className="skeleton-bar" style={{ width: '100%' }} />
              <div className="skeleton-bar" style={{ width: '82%' }} />
              <div className="skeleton-bar" style={{ width: '93%' }} />
              <div className="skeleton-bar" style={{ width: '67%' }} />
              <div className="skeleton-bar" style={{ width: '88%' }} />
            </div>
            <LoadingMessages messages={LOADING_MESSAGES} />
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
