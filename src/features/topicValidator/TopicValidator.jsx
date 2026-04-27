import { useState, useEffect, useRef } from 'react'
import { validateTopic, handleApiError } from '../../services/api'
import { useApp } from '../../context/AppContext'

export default function TopicValidator() {
  const { state, studentContext, completeStep, set } = useApp()

  // If already completed, restore straight to result section
  const restored = Boolean(state.stepsCompleted[0] && state.topicValidation)

  const [section, setSection]           = useState(restored ? 'result' : 'input')
  const [topic, setTopic]               = useState(state.roughTopic || '')
  const [error, setError]               = useState(null)
  const [btnDisabled, setBtnDisabled]   = useState(false)
  const [shaking, setShaking]           = useState(false)
  const [data, setData]                 = useState(restored ? state.topicValidation : null)
  const [isEditing, setIsEditing]       = useState(false)
  const [editedTopic, setEditedTopic]   = useState('')
  const [displayText, setDisplayText]   = useState(
    restored ? (state.topicValidation?.refined_topic || '') : ''
  )
  const [typewriterActive, setTypewriterActive] = useState(false)

  const twIntervalRef = useRef(null)
  const animateRef    = useRef(false)  // true only after a fresh API response

  // ── Typewriter effect ─────────────────────────────────────────────────────
  // Skipped on restore — full text shown immediately.
  useEffect(() => {
    if (!data?.refined_topic) return
    if (!animateRef.current) return
    animateRef.current = false

    if (twIntervalRef.current) clearInterval(twIntervalRef.current)

    const fullText = data.refined_topic
    let index = 0
    setDisplayText('')
    setTypewriterActive(true)

    twIntervalRef.current = setInterval(() => {
      index++
      setDisplayText(fullText.slice(0, index))
      if (index >= fullText.length) {
        clearInterval(twIntervalRef.current)
        twIntervalRef.current = null
        setTypewriterActive(false)
      }
    }, 28)

    return () => {
      if (twIntervalRef.current) {
        clearInterval(twIntervalRef.current)
        twIntervalRef.current = null
      }
    }
  }, [data])

  // ── Validate ──────────────────────────────────────────────────────────────
  function handleValidate() {
    const trimmed = topic.trim()
    if (!trimmed || trimmed.length < 5) {
      setShaking(true)
      setError('Please enter your research topic before validating.')
      return
    }

    setError(null)
    set({ roughTopic: trimmed })
    setBtnDisabled(true)
    setSection('loading')

    validateTopic(studentContext, trimmed)
      .then(result => {
        set({ topicValidation: result })
        animateRef.current = true
        setData(result)
        setSection('result')
        setBtnDisabled(false)
      })
      .catch(err => {
        setSection('input')
        if (!handleApiError(err, msg => {
          setError(msg)
          // Re-enable button after rate-limit countdown clears the message
          if (!msg) setBtnDisabled(false)
        })) {
          setBtnDisabled(false)
          setError('Something went wrong. Please check your connection and try again.')
        }
      })
  }

  // ── Edit / Save ───────────────────────────────────────────────────────────
  function handleEdit() {
    if (twIntervalRef.current) {
      clearInterval(twIntervalRef.current)
      twIntervalRef.current = null
      setTypewriterActive(false)
      setDisplayText(data.refined_topic)
    }
    setEditedTopic(data.refined_topic || displayText)
    setIsEditing(true)
  }

  function handleSave() {
    setIsEditing(false)
  }

  // ── Use This Topic ────────────────────────────────────────────────────────
  function handleUseThisTopic() {
    const finalTopic = isEditing
      ? editedTopic.trim()
      : (data.refined_topic || '').trim()

    if (!finalTopic) return

    // completeStep saves to localStorage via context, advances currentStep to 1
    completeStep(0, { validatedTopic: finalTopic })
  }

  // ── Select alternative ────────────────────────────────────────────────────
  function handleSelectAlternative(altTopic) {
    setTopic(altTopic)
    set({ roughTopic: altTopic })
    setError(null)
    setSection('input')
  }

  // ── Derived classes ───────────────────────────────────────────────────────
  const verdictCardClass = data ? ({
    'Researchable':     'tv-card--green',
    'Needs Refinement': 'tv-card--yellow',
    'Not Suitable':     'tv-card--red',
  }[data.verdict] || '') : ''

  const verdictLabelClass = data ? ({
    'Researchable':     'tv-verdict-label--green',
    'Needs Refinement': 'tv-verdict-label--yellow',
    'Not Suitable':     'tv-verdict-label--red',
  }[data.verdict] || '') : ''

  const diffKeyFor = d => {
    const key = (d || 'moderate').toLowerCase()
    return ['easy', 'moderate', 'challenging'].includes(key) ? key : 'moderate'
  }

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className={`tv-card ${verdictCardClass}`} id="tv-card">

      {/* ── Input section ──────────────────────────────────────────────────── */}
      {section === 'input' && (
        <div id="tv-input-section" className="tv-input-section tv-section--visible">
          <p className="tv-step-label">Step 1: Topic Validator</p>
          <p className="tv-description">
            Edit your topic if needed, then validate it. FYPro will check scope, originality,
            faculty fit, and data-collection feasibility.
          </p>
          <textarea
            id="tv-textarea"
            className={`tv-textarea${shaking ? ' tv-textarea--shake' : ''}`}
            rows={4}
            placeholder="e.g. Impact of social media on academic performance among undergraduates"
            value={topic}
            onChange={e => setTopic(e.target.value)}
            onAnimationEnd={() => setShaking(false)}
          />
          {error && <p id="tv-error-text" className="tv-error-text">{error}</p>}
          <button
            id="btn-validate"
            className="tv-btn-validate"
            onClick={handleValidate}
            disabled={btnDisabled}
          >
            Validate Topic
          </button>
        </div>
      )}

      {/* ── Loading section ─────────────────────────────────────────────────── */}
      {section === 'loading' && (
        <div id="tv-loading-section" className="tv-loading-section tv-section--visible">
          <div className="skeleton-loader">
            <div className="skeleton-bar" style={{ width: '100%' }} />
            <div className="skeleton-bar" style={{ width: '75%' }} />
            <div className="skeleton-bar" style={{ width: '90%' }} />
            <div className="skeleton-bar" style={{ width: '60%' }} />
          </div>
          <p className="tv-loading-text">Analysing your topic…</p>
        </div>
      )}

      {/* ── Result section ──────────────────────────────────────────────────── */}
      {section === 'result' && data && (
        <div id="tv-result-section" className="tv-result-section tv-section--visible">

          <div className="tv-verdict-block">
            <p className={`tv-verdict-label ${verdictLabelClass}`}>{data.verdict}</p>
            <p className="tv-verdict-reason">{data.verdict_reason}</p>
          </div>

          <hr className="tv-divider" />

          <div className="tv-refined-block">
            <p className="tv-refined-label">Refined Topic</p>

            {isEditing ? (
              <textarea
                id="tv-refined-edit-area"
                className="tv-refined-edit-area"
                rows={3}
                value={editedTopic}
                onChange={e => setEditedTopic(e.target.value)}
                autoFocus
              />
            ) : (
              <p
                id="tv-refined-text"
                className={`tv-refined-text${typewriterActive ? ' tv-typewriter--active' : ''}`}
              >
                {displayText}
              </p>
            )}

            <p className="tv-refined-explanation">{data.refined_explanation}</p>

            <div className="tv-refined-actions">
              {isEditing
                ? <button id="btn-save" className="tv-btn-save" onClick={handleSave}>Save</button>
                : <button id="btn-edit" className="tv-btn-edit" onClick={handleEdit}>Edit</button>
              }
            </div>
          </div>

          <button id="btn-use" className="tv-btn-use" onClick={handleUseThisTopic}>
            Use This Topic
          </button>

          {/* Alternatives — only when Not Suitable */}
          {data.verdict === 'Not Suitable' && data.alternatives?.length > 0 && (
            <div id="tv-alternatives" className="tv-alternatives tv-section--visible">
              <p className="tv-alternatives-heading">Alternative topics for your department</p>
              <div id="tv-alternatives-list">
                {data.alternatives.map((alt, i) => (
                  <div key={i} className="tv-alt-card">
                    <p className="tv-alt-topic">{alt.topic}</p>
                    <p className="tv-alt-explanation">{alt.explanation}</p>
                    <div className="tv-alt-footer">
                      <span className={`tv-difficulty-badge tv-difficulty--${diffKeyFor(alt.difficulty)}`}>
                        {alt.difficulty}
                      </span>
                      <button
                        className="tv-btn-use-alt"
                        onClick={() => handleSelectAlternative(alt.topic)}
                      >
                        Use This Instead
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      )}

    </div>
  )
}
