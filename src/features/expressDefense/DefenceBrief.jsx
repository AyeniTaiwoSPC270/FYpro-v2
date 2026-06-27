import { useState, useEffect, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { useProjectState } from '../../hooks/useProjectState'
import { usePaidFeatures } from '../../hooks/usePaidFeatures'
import { recordStepRun, useRunLimit } from '../../hooks/useRunLimit'
import { generateDefenceBrief, coachDefenceBriefAnswer, handleApiError } from '../../services/api'
import { generateDefenceBrief as buildPDF } from '../../lib/generateDefenceBrief'
import ApiErrorBox from '../../components/ApiErrorBox'
import LoadingMessages from '../../components/LoadingMessages'
import Spinner from '../../components/Spinner'
import { showToast } from '../../components/Toast'

const LOADING_MESSAGES = [
  'Reading your Project Review...',
  'Building your opening statement...',
  'Preparing model answers...',
  'Almost ready...',
]

export default function DefenceBrief() {
  const { state, set, studentContext } = useApp()
  // Defence Brief lifetime cap for express-only users (server-enforced). getRemainingRuns
  // returns null for Defense Pack holders (exempt), so the counter/gate self-disable.
  const { features, loading: featuresLoading } = usePaidFeatures()
  const { isOverLimit, getRemainingRuns } = useRunLimit(features, featuresLoading)
  const briefOverLimit = isOverLimit('express_defence_brief')
  const remainingBriefs = getRemainingRuns('express_defence_brief')
  const { saveStep } = useProjectState()

  const reviewData = state.uploadedProject?.reviewData ?? null
  const isLocked   = !state.expressSteps?.project_reviewer
  const savedBrief = state.defenseBrief

  const [section, setSection]         = useState(savedBrief ? 'result' : 'input')
  const [brief, setBrief]             = useState(savedBrief || null)
  const [error, setError]             = useState(null)
  const [isGenerating, setGenerating] = useState(false)

  const [coaching, setCoaching]     = useState(null)
  const [coachInput, setCoachInput] = useState('')
  const [isCoaching, setIsCoaching] = useState(false)
  const [coachError, setCoachError] = useState(null)

  const [visibleSpots, setVisibleSpots] = useState([])
  const [visibleQas, setVisibleQas]     = useState([])

  const loadingTimerRef = useRef(null)
  const timedOutRef     = useRef(false)
  const chatEndRef      = useRef(null)

  // Hydration race guard: ExpressProjectStateProvider loads asynchronously.
  // If this component mounted before hydration completed, state.defenseBrief was
  // null at init time so useState set section='input' and brief=null. This effect
  // fires when hydration arrives and restores the brief without requiring a remount.
  useEffect(() => {
    const restored = state.defenseBrief
    if (restored && !brief && !isGenerating) {
      setBrief(restored)
      setSection('result')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.defenseBrief])

  useEffect(() => {
    if (section === 'loading') {
      timedOutRef.current = false
      loadingTimerRef.current = setTimeout(() => {
        timedOutRef.current = true
        setSection('input')
        setGenerating(false)
        setError('Request timed out. Please check your connection and try again.')
      }, 58000)
    } else {
      clearTimeout(loadingTimerRef.current)
    }
    return () => clearTimeout(loadingTimerRef.current)
  }, [section])

  useEffect(() => {
    if (section !== 'result' || !brief) return
    setVisibleSpots([])
    setVisibleQas([])
    const timers = []
    ;(brief.weakSpots || []).forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleSpots(p => [...p, i]), i * 80))
    })
    ;(brief.examinerQas || []).forEach((_, i) => {
      timers.push(setTimeout(() => setVisibleQas(p => [...p, i]), i * 100))
    })
    return () => timers.forEach(clearTimeout)
  }, [section, brief])

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [coaching?.history])

  async function handleGenerate() {
    if (isGenerating || !reviewData) return
    setError(null)
    setGenerating(true)
    setSection('loading')

    try {
      const data = await generateDefenceBrief(
        studentContext,
        reviewData.weaknesses || [],
        reviewData.examiner_questions || []
      )

      if (timedOutRef.current) return
      if (!data || !data.opening_statement || !data.weak_spots || !data.examiner_qas) {
        setSection('input')
        setGenerating(false)
        setError('The brief returned an unexpected format. Please try again.')
        return
      }

      const normalized = {
        openingStatement: data.opening_statement,
        weakSpots:        data.weak_spots,
        examinerQas:      data.examiner_qas,
      }

      setBrief(normalized)
      set({
        defenseBrief: normalized,
        expressSteps: { ...(state.expressSteps || {}), defense_brief: true },
      })
      setSection('result')
      setGenerating(false)
      // Decrement the lifetime counter for display only — the server already reserved
      // the slot. Fired after success so a failed generation never burns a count.
      recordStepRun('express_defence_brief')
      // Auto-save so the brief survives navigation away and back within the same
      // session. handleConfirm re-saves later to capture any coaching updates.
      saveStep('defense_brief', {
        openingStatement: normalized.openingStatement,
        weakSpots:        normalized.weakSpots,
        examinerQas:      normalized.examinerQas,
      })
    } catch (err) {
      if (timedOutRef.current) return
      setGenerating(false)
      setSection('input')
      handleApiError(err, msg => setError(msg || 'Something went wrong. Please try again.'))
    }
  }

  async function handleConfirm() {
    if (!brief) return
    // Re-save to capture any coaching updates (student answers added after generation)
    await saveStep('defense_brief', {
      openingStatement: brief.openingStatement,
      weakSpots:        brief.weakSpots,
      examinerQas:      brief.examinerQas,
    })
    showToast('Defence Brief saved ✓')
    document.dispatchEvent(new CustomEvent('express:navigate', { detail: { step: 'defense' } }))
  }

  function handleSkip() {
    set({ expressSteps: { ...(state.expressSteps || {}), defense_brief: true } })
    saveStep('defense_brief', { skipped: true })
  }

  function handleDownload() {
    if (!brief) return
    try {
      const doc = buildPDF(brief, studentContext.validatedTopic)
      doc.save('defence-brief.pdf')
    } catch {
      showToast('PDF download failed — copying brief to clipboard', 'error')
      const text = [
        'DEFENCE BRIEF',
        '',
        'OPENING STATEMENT',
        brief.openingStatement,
        '',
        'WEAK SPOTS',
        ...(brief.weakSpots || []).map(ws =>
          `[${ws.severity}] ${ws.title}\nQ: ${ws.examiner_question}\nA: ${ws.studentAnswer || ws.model_answer}`
        ),
        '',
        'EXAMINER Q&As',
        ...(brief.examinerQas || []).map(qa => `Q${qa.number}: ${qa.question}\n${qa.answer}`),
      ].join('\n')
      navigator.clipboard.writeText(text).catch(() => {})
    }
  }

  function openCoaching(weakSpot) {
    setCoaching({
      weakSpot,
      history: [
        {
          role: 'assistant',
          content: `The examiner will ask: "${weakSpot.examiner_question}"\n\nTry answering in your own words — don't look at the model answer. Type what you'd actually say in the room.`,
        },
      ],
    })
    setCoachInput('')
    setCoachError(null)
  }

  async function handleCoachSend() {
    if (!coachInput.trim() || isCoaching || !coaching) return
    const userTurn       = { role: 'user', content: coachInput.trim() }
    const updatedHistory = [...coaching.history, userTurn]
    setCoaching(prev => ({ ...prev, history: updatedHistory }))
    setCoachInput('')
    setIsCoaching(true)
    setCoachError(null)

    try {
      const result   = await coachDefenceBriefAnswer(coaching.weakSpot, updatedHistory)
      const passed   = result?.passed === true
      const feedback = result?.feedback || ''
      const hint     = result?.hint || ''

      const assistantContent = passed
        ? `✓ ${feedback}`
        : `${feedback}${hint ? `\n\n${hint}` : ''}`

      const assistantTurn = { role: 'assistant', content: assistantContent, passed }
      setCoaching(prev => ({ ...prev, history: [...prev.history, assistantTurn] }))

      if (passed) {
        setBrief(prev => {
          const weakSpots = (prev.weakSpots || []).map(ws =>
            ws.title === coaching.weakSpot.title
              ? { ...ws, studentAnswer: userTurn.content }
              : ws
          )
          const updated = { ...prev, weakSpots }
          set({ defenseBrief: updated })
          return updated
        })
      }
    } catch {
      setCoachError("Couldn't get a response — please try again.")
    } finally {
      setIsCoaching(false)
    }
  }

  function handleCoachKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleCoachSend()
    }
  }

  if (isLocked) {
    return (
      <div className="db-card">
        <p className="db-step-label">Step 2: Defence Brief</p>
        <div className="db-locked">
          <div className="db-locked__icon">🔒</div>
          <p className="db-locked__text">Complete the Project Reviewer first to unlock your Defence Brief.</p>
        </div>
      </div>
    )
  }

  if (coaching) {
    const lastTurn  = coaching.history[coaching.history.length - 1]
    const lastPassed = lastTurn?.passed === true

    return (
      <div className="db-card">
        <div className="db-coaching-header">
          <button className="db-back-btn" onClick={() => setCoaching(null)}>← Back to Brief</button>
          <div className="db-coaching-meta">
            <p className="db-coaching-topic">Coaching: {coaching.weakSpot.title}</p>
            <p className="db-coaching-sub">Build your answer until you can say it confidently</p>
          </div>
        </div>

        <div className="db-chat">
          {coaching.history.map((turn, i) => {
            if (turn.role === 'assistant') {
              const bubbleClass = turn.passed === true
                ? 'db-chat-bubble--success'
                : 'db-chat-bubble--feedback'
              return (
                <div key={i} className={`db-chat-bubble ${turn.passed === undefined ? 'db-chat-bubble--ai' : bubbleClass}`}>
                  {turn.content}
                </div>
              )
            }
            return (
              <div key={i} className="db-chat-bubble db-chat-bubble--user">
                {turn.content}
              </div>
            )
          })}
          {coachError && (
            <div className="db-chat-bubble db-chat-bubble--error">{coachError}</div>
          )}
          <div ref={chatEndRef} />
        </div>

        {!lastPassed && (
          <div className="db-chat-input-row">
            <input
              type="text"
              placeholder="Type your answer attempt..."
              value={coachInput}
              onChange={e => setCoachInput(e.target.value)}
              onKeyDown={handleCoachKeyDown}
              disabled={isCoaching}
            />
            <button
              className="db-chat-send"
              onClick={handleCoachSend}
              disabled={!coachInput.trim() || isCoaching}
            >
              {isCoaching ? <Spinner /> : 'Send'}
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="db-card">

      {section === 'input' && (
        <>
          <p className="db-step-label">Step 2: Defence Brief</p>
          <p className="db-description">
            Generate your personalised preparation brief — your opening statement, model answers for your
            weak spots, and prepared responses for every likely examiner question. Study it before entering
            the Defence Simulator.
          </p>
          <div className="db-pills">
            <span className="db-pill">Opening statement</span>
            <span className="db-pill db-pill--amber">3 weak spots + answers</span>
            <span className="db-pill db-pill--green">5 examiner Q&amp;As</span>
            <span className="db-pill db-pill--green">Downloadable PDF</span>
          </div>
          <ApiErrorBox error={error} onRetry={handleGenerate} />
          <button className="db-btn-generate" onClick={handleGenerate} disabled={isGenerating || briefOverLimit}>
            {isGenerating ? <><Spinner /> Generating…</> : '⚡ Generate My Brief'}
          </button>
          {briefOverLimit ? (
            <p className="db-note" style={{ color: 'var(--color-red)' }}>
              You've used all your Express Defence Brief generations.
            </p>
          ) : remainingBriefs !== null ? (
            <p className="db-note">
              Reads your Project Review results — no extra input needed · {remainingBriefs} {remainingBriefs === 1 ? 'generation' : 'generations'} left
            </p>
          ) : (
            <p className="db-note">Reads your Project Review results — no extra input needed</p>
          )}
        </>
      )}

      {section === 'loading' && (
        <div className="db-loading-section">
          <div className="skeleton-loader">
            <div className="skeleton-bar" style={{ width: '100%' }} />
            <div className="skeleton-bar" style={{ width: '80%' }} />
            <div className="skeleton-bar" style={{ width: '90%' }} />
            <div className="skeleton-bar" style={{ width: '65%' }} />
          </div>
          <LoadingMessages messages={LOADING_MESSAGES} />
        </div>
      )}

      {section === 'result' && brief && (
        <div className="db-result">

          <div className="db-result__header">
            <div>
              <p className="db-result__title">Your Defence Brief</p>
              <p className="db-result__meta">
                Generated from your Project Review · {(brief.weakSpots?.length || 0) + (brief.examinerQas?.length || 0)} items ready
              </p>
            </div>
            <button className="db-btn-download" onClick={handleDownload}>⬇ Download PDF</button>
          </div>

          <div className="db-feedback-block">
            <p className="db-feedback-heading db-feedback-heading--opening">Opening Statement</p>
            <div className="db-opening">
              <p className="db-opening__text">{brief.openingStatement}</p>
            </div>
          </div>

          <div className="db-feedback-block">
            <p className="db-feedback-heading db-feedback-heading--weakness">Weak Spots &amp; Model Answers</p>
            {(brief.weakSpots || []).map((ws, i) => (
              <div
                key={i}
                className="db-weakness-item"
                style={{ opacity: visibleSpots.includes(i) ? 1 : 0 }}
              >
                <div className="db-weakness__header">
                  <span className={`db-severity db-severity--${(ws.severity || '').toLowerCase()}`}>
                    {ws.severity}
                  </span>
                  <span className="db-weakness__title">{ws.title}</span>
                </div>
                <p className="db-weakness__question">"{ws.examiner_question}"</p>
                <p className="db-answer-label">{ws.studentAnswer ? 'YOUR ANSWER' : 'MODEL ANSWER'}</p>
                <p className="db-weakness__answer">{ws.studentAnswer || ws.model_answer}</p>
                <button className="db-coach-btn" onClick={() => openCoaching(ws)}>
                  💬 Coach me on this
                </button>
              </div>
            ))}
          </div>

          <div className="db-feedback-block">
            <p className="db-feedback-heading db-feedback-heading--questions">Likely Examiner Questions</p>
            <div className="db-questions-list">
              {(brief.examinerQas || []).map((qa, i) => (
                <div
                  key={i}
                  className="db-question-item"
                  style={{ opacity: visibleQas.includes(i) ? 1 : 0 }}
                >
                  <div className="db-question-num">Q{qa.number}</div>
                  <div className="db-question-body">
                    <p className="db-question-text">"{qa.question}"</p>
                    <p className="db-question-answer">{qa.answer}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <button className="db-btn-confirm" onClick={handleConfirm}>
            Save Brief &amp; Continue to Defence Simulator →
          </button>
          <button className="db-btn-skip" onClick={handleSkip}>
            Skip — Go to Defence Simulator without saving
          </button>
        </div>
      )}

    </div>
  )
}
