import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { validateTopic } from '../../services/api'
import { handleApiError } from '../../services/api'
import { showToast } from '../../components/Toast'

// Typewriter helper — returns the interval id
function startTypewriter(element, fullText, onDone) {
  let i = 0
  element.textContent = ''
  element.dataset.fullText = fullText
  element.classList.add('tv-typewriter--active')
  const id = setInterval(() => {
    if (i < fullText.length) {
      element.textContent += fullText[i]
      i++
    } else {
      clearInterval(id)
      element.classList.remove('tv-typewriter--active')
      if (onDone) onDone()
    }
  }, 28)
  return id
}

export default function TopicValidator() {
  const { state, set, completeStep, navigateStep, studentContext } = useApp()

  // Section: 'input' | 'loading' | 'result'
  const [section, setSection] = useState('input')
  const [topic, setTopic] = useState(state.roughTopic || '')
  const [error, setError] = useState('')
  const [resultData, setResultData] = useState(state.topicValidation || null)
  const [editing, setEditing] = useState(false)
  const [editVal, setEditVal] = useState('')

  const textareaRef = useRef(null)
  const refinedRef = useRef(null)
  const twId = useRef(null)

  // Restore from saved state
  useEffect(() => {
    if (state.topicValidation && state.stepsCompleted[0]) {
      setResultData(state.topicValidation)
      setSection('result')
    }
  }, []) // eslint-disable-line

  // Run typewriter when result first appears
  useEffect(() => {
    if (section === 'result' && resultData && refinedRef.current && !state.stepsCompleted[0]) {
      if (twId.current) clearInterval(twId.current)
      twId.current = startTypewriter(refinedRef.current, resultData.refined_topic || '')
    }
    return () => {
      if (twId.current) clearInterval(twId.current)
    }
  }, [section, resultData]) // eslint-disable-line

  function showSection(s) { setSection(s) }
  function showError(msg) { setError(msg) }
  function hideError() { setError('') }

  async function handleValidate() {
    const t = topic.trim()
    if (!t || t.length < 5) {
      if (textareaRef.current) {
        textareaRef.current.classList.add('tv-textarea--shake')
        textareaRef.current.addEventListener('animationend', () => {
          textareaRef.current?.classList.remove('tv-textarea--shake')
        }, { once: true })
      }
      showError('Please enter your research topic before validating.')
      return
    }
    hideError()
    set({ roughTopic: t })
    showSection('loading')
    try {
      const data = await validateTopic(studentContext, t)
      setResultData(data)
      set({ topicValidation: data, roughTopic: t })
      showSection('result')
      showToast('Analysis complete', 'success')
    } catch (err) {
      showSection('input')
      handleApiError(err, (msg) => {
        showError(msg || 'Something went wrong. Please check your connection and try again.')
        if (msg) showToast(msg, 'error')
      })
    }
  }

  function handleUseThisTopic(topicStr) {
    if (!topicStr) return
    set({ validatedTopic: topicStr })
    completeStep(0)
    showToast('Step 2 unlocked', 'unlock')
  }

  function handleStartEdit() {
    if (twId.current) {
      clearInterval(twId.current)
      twId.current = null
      if (refinedRef.current) {
        refinedRef.current.textContent = refinedRef.current.dataset.fullText || resultData?.refined_topic || ''
        refinedRef.current.classList.remove('tv-typewriter--active')
      }
    }
    setEditVal(resultData?.refined_topic || (refinedRef.current?.textContent ?? ''))
    setEditing(true)
  }

  function handleSaveEdit() {
    const newText = editVal.trim() || editVal
    setResultData((r) => ({ ...r, refined_topic: newText }))
    set({ topicValidation: { ...resultData, refined_topic: newText } })
    setEditing(false)
  }

  function handleSelectAlternative(altTopic) {
    setTopic(altTopic)
    set({ roughTopic: altTopic })
    setError('')
    showSection('input')
    setTimeout(() => textareaRef.current?.focus(), 50)
  }

  const verdictClass = {
    'Researchable':     'tv-card--green',
    'Needs Refinement': 'tv-card--yellow',
    'Not Suitable':     'tv-card--red',
  }[resultData?.verdict] || ''

  const verdictLabelClass = {
    'Researchable':     'tv-verdict-label--green',
    'Needs Refinement': 'tv-verdict-label--yellow',
    'Not Suitable':     'tv-verdict-label--red',
  }[resultData?.verdict] || 'tv-verdict-label--yellow'

  const diffKey = (d) => {
    const k = (d || 'moderate').toLowerCase()
    return ['easy', 'moderate', 'challenging'].includes(k) ? k : 'moderate'
  }

  return (
    <div className={`tv-card${verdictClass ? ` ${verdictClass}` : ''}`} id="tv-card">

      {/* ── Input Section ── */}
      <div
        id="tv-input-section"
        className={`tv-input-section${section === 'input' ? ' tv-section--visible' : ' tv-section--hidden'}`}
      >
        <p className="tv-step-label">Step 1: Topic Validator</p>
        <p className="tv-description">
          Edit your topic if needed, then validate it. FYPro will check scope, originality, faculty fit, and data-collection feasibility.
        </p>
        <textarea
          id="tv-textarea"
          ref={textareaRef}
          className="tv-textarea"
          rows={4}
          placeholder="e.g. Impact of social media on academic performance among undergraduates"
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
        />
        {error && (
          <p id="tv-error-text" className="tv-error-text tv-section--visible">{error}</p>
        )}
        <button
          id="btn-validate"
          className="tv-btn-validate"
          onClick={handleValidate}
        >
          Validate Topic
        </button>
      </div>

      {/* ── Loading Section ── */}
      <div
        id="tv-loading-section"
        className={`tv-loading-section${section === 'loading' ? ' tv-section--visible' : ' tv-section--hidden'}`}
      >
        <div className="skeleton-loader">
          <div className="skeleton-bar" style={{ width: '100%' }} />
          <div className="skeleton-bar" style={{ width: '75%' }} />
          <div className="skeleton-bar" style={{ width: '90%' }} />
          <div className="skeleton-bar" style={{ width: '60%' }} />
        </div>
        <p className="tv-loading-text">Analysing your topic…</p>
      </div>

      {/* ── Result Section ── */}
      {resultData && (
        <div
          id="tv-result-section"
          className={`tv-result-section${section === 'result' ? ' tv-section--visible' : ' tv-section--hidden'}`}
        >
          {/* Verdict block */}
          <div className="tv-verdict-block">
            <p id="tv-verdict-label" className={`tv-verdict-label ${verdictLabelClass}`}>
              {resultData.verdict}
            </p>
            <p id="tv-verdict-reason" className="tv-verdict-reason">
              {resultData.verdict_reason}
            </p>
          </div>

          <hr className="tv-divider" />

          {/* Refined topic */}
          <div className="tv-refined-block">
            <p className="tv-refined-label">Refined Topic</p>
            {editing ? (
              <textarea
                id="tv-refined-edit-area"
                className="tv-refined-edit-area"
                rows={3}
                value={editVal}
                onChange={(e) => setEditVal(e.target.value)}
              />
            ) : (
              <p
                id="tv-refined-text"
                ref={refinedRef}
                className="tv-refined-text"
                data-full-text={resultData.refined_topic}
              >
                {state.stepsCompleted[0] ? resultData.refined_topic : ''}
              </p>
            )}
            <p id="tv-refined-explanation" className="tv-refined-explanation">
              {resultData.refined_explanation}
            </p>
            <div className="tv-refined-actions">
              {editing ? (
                <button id="btn-save" className="tv-btn-save" onClick={handleSaveEdit}>Save</button>
              ) : (
                <button id="btn-edit" className="tv-btn-edit" onClick={handleStartEdit}>Edit</button>
              )}
            </div>
          </div>

          <button
            id="btn-use"
            className="tv-btn-use"
            onClick={() => handleUseThisTopic(
              editing ? editVal : (refinedRef.current?.dataset.fullText || refinedRef.current?.textContent || resultData.refined_topic)
            )}
          >
            Use This Topic
          </button>

          {/* Alternatives */}
          {resultData.verdict === 'Not Suitable' && resultData.alternatives?.length > 0 && (
            <div id="tv-alternatives" className="tv-alternatives tv-section--visible">
              <p className="tv-alternatives-heading">Alternative topics for your department</p>
              <div id="tv-alternatives-list">
                {resultData.alternatives.map((alt, i) => (
                  <div key={i} className="tv-alt-card">
                    <p className="tv-alt-topic">{alt.topic}</p>
                    <p className="tv-alt-explanation">{alt.explanation}</p>
                    <div className="tv-alt-footer">
                      <span className={`tv-difficulty-badge tv-difficulty--${diffKey(alt.difficulty)}`}>
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
