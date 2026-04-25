import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext'
import { detectRedFlags, panelFirstQuestion, panelFollowUp, panelSummary } from '../../services/api'
import { buildThreeExaminerFollowUpPrompt, THREE_EXAMINER_FIRST_QUESTION_PROMPT } from '../../services/prompts'
import { handleApiError } from '../../services/api'
import { showToast } from '../../components/Toast'

function examinerNameToClass(name) {
  if (!name) return ''
  const n = name.toLowerCase()
  if (n.includes('methodologist')) return 'dp-examiner-label--methodologist'
  if (n.includes('subject'))       return 'dp-examiner-label--subject-expert'
  if (n.includes('devil'))         return 'dp-examiner-label--devils-advocate'
  return ''
}

function examinerNameToSlug(name) {
  if (!name) return ''
  const n = name.toLowerCase()
  if (n.includes('methodologist')) return 'methodologist'
  if (n.includes('subject'))       return 'subject-expert'
  if (n.includes('devil'))         return 'devils-advocate'
  return ''
}

// ── Defense Overlay (full-screen) ──────────────────────────────────────────

function DefenseOverlay({ studentContext, validatedTopic, methodology, chapterStructure, onComplete }) {
  const [messages, setMessages] = useState([])   // { type: 'examiner'|'student'|'intro'|'typing'|'scores', ...data }
  const [inputText, setInputText] = useState('')
  const [inputLocked, setInputLocked] = useState(true)
  const [questionCount, setQuestionCount] = useState(0)
  const [currentExaminer, setCurrentExaminer] = useState('The Methodologist')
  const [phase, setPhase] = useState('chat')     // 'chat' | 'summary-loading' | 'summary'
  const [summaryData, setSummaryData] = useState(null)
  const [showExitModal, setShowExitModal] = useState(false)
  const [apiMessages, setApiMessages] = useState([])

  const chatRef = useRef(null)
  const systemRef = useRef(null)

  function scrollToBottom() {
    setTimeout(() => chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight, behavior: 'smooth' }), 50)
  }

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    loadFirstQuestion()
    return () => { document.body.style.overflow = '' }
  }, []) // eslint-disable-line

  async function loadFirstQuestion() {
    setMessages([{ type: 'typing', id: 'init' }])
    try {
      const { parsed, rawText, system } = await panelFirstQuestion(studentContext, validatedTopic, methodology, chapterStructure)
      systemRef.current = system

      const examiner = parsed.opening_examiner || 'The Methodologist'
      setCurrentExaminer(examiner)

      const initApiMsgs = [
        { role: 'user', content: THREE_EXAMINER_FIRST_QUESTION_PROMPT },
        { role: 'assistant', content: rawText },
      ]
      setApiMessages(initApiMsgs)

      const newMsgs = []
      if (parsed.panel_intro) newMsgs.push({ type: 'intro', text: parsed.panel_intro })
      newMsgs.push({ type: 'examiner', text: parsed.question, examiner })
      setMessages(newMsgs)
      setInputLocked(false)
      scrollToBottom()
    } catch {
      setMessages([{ type: 'examiner', text: 'There was a connection issue. Please end the session and try again.', examiner: 'The Methodologist' }])
    }
  }

  async function handleSubmit() {
    const answer = inputText.trim()
    if (answer.length < 10) return

    setInputText('')
    setInputLocked(true)

    const newQCount = questionCount + 1
    setQuestionCount(newQCount)

    const studentMsgId = Date.now()
    setMessages((prev) => [...prev, { type: 'student', text: answer, id: studentMsgId }, { type: 'typing', id: 'typing-' + studentMsgId }])
    scrollToBottom()

    try {
      const { parsed: data, rawText } = await panelFollowUp(systemRef.current, apiMessages, answer)
      const updatedApiMsgs = [
        ...apiMessages,
        { role: 'user', content: buildThreeExaminerFollowUpPrompt(answer) },
        { role: 'assistant', content: rawText },
      ]
      setApiMessages(updatedApiMsgs)

      const nextExaminer = data.next_examiner || currentExaminer
      setCurrentExaminer(nextExaminer)

      const nextText = [data.next_examiner_reaction, data.next_question].filter(Boolean).join(' ')

      setMessages((prev) => {
        const withoutTyping = prev.filter((m) => m.type !== 'typing')
        return [
          ...withoutTyping,
          { type: 'scores', scores: data.scores || [], parentId: studentMsgId },
          { type: 'examiner', text: nextText, examiner: nextExaminer },
        ]
      })
      setInputLocked(false)
      scrollToBottom()
    } catch {
      setMessages((prev) => [
        ...prev.filter((m) => m.type !== 'typing'),
        { type: 'examiner', text: 'There was a connection issue. Please try submitting your answer again.', examiner: currentExaminer },
      ])
      setInputLocked(false)
    }
  }

  function handleEndSession() {
    if (questionCount < 3) return
    if (questionCount >= 5) { doEndSession(); return }
    setShowExitModal(true)
  }

  async function doEndSession() {
    setShowExitModal(false)
    setPhase('summary-loading')
    try {
      const data = await panelSummary(systemRef.current, apiMessages)
      setSummaryData(data)
      setPhase('summary')
      onComplete()
      showToast('Analysis complete', 'success')
    } catch {
      setPhase('chat')
      showToast('Something went wrong. Try again.', 'error')
    }
  }

  const canEnd = questionCount >= 3

  return createPortal(
    <div className="dp-defense-overlay" id="dp-defense-overlay">

      {/* Header */}
      <div className="dp-defense-header">
        <span className="dp-defense-title">FYPro — Defence Simulator</span>
        <button
          className="dp-defense-end-btn"
          id="dp-end-btn"
          data-disabled={!canEnd ? 'true' : undefined}
          title={!canEnd ? 'Complete at least 3 questions to end session' : undefined}
          onClick={handleEndSession}
        >
          End Defence Session
        </button>
      </div>

      {/* Question counter */}
      {phase === 'chat' && (
        <div className="dp-counter-section" id="dp-counter-section">
          <p className="dp-counter-text" id="dp-counter-text">
            Question {Math.min(questionCount + 1, 5)} of 5
          </p>
          <div className="dp-counter-dots" id="dp-counter-dots">
            {[0,1,2,3,4].map((i) => (
              <span
                key={i}
                className={[
                  'dp-counter-dot',
                  i < questionCount  ? 'dp-counter-dot--done'   : '',
                  i === questionCount ? 'dp-counter-dot--active' : '',
                ].join(' ').trim()}
              />
            ))}
          </div>
        </div>
      )}

      {/* Chat area */}
      {phase === 'chat' && (
        <div className="dp-chat-area" id="dp-chat-area" ref={chatRef}>
          {messages.map((msg, i) => {
            if (msg.type === 'intro') return (
              <div key={i} className="dp-panel-intro-card">
                <p className="dp-panel-intro">{msg.text}</p>
              </div>
            )
            if (msg.type === 'typing') return (
              <div key={msg.id} className="dp-typing-wrap">
                <p className="dp-typing-label">EXAMINER:</p>
                <div className="dp-typing-indicator">
                  <span className="dp-typing-dot" /><span className="dp-typing-dot" /><span className="dp-typing-dot" />
                </div>
              </div>
            )
            if (msg.type === 'examiner') return (
              <div key={i} className="dp-examiner-wrap">
                <p className={`dp-examiner-label ${examinerNameToClass(msg.examiner)}`}>
                  {(msg.examiner || 'EXAMINER').toUpperCase()}:
                </p>
                <div className="dp-examiner-bubble dp-examiner-bubble--visible">
                  <p className="dp-examiner-text">{msg.text}</p>
                </div>
              </div>
            )
            if (msg.type === 'student') return (
              <div key={i} className="dp-student-wrap">
                <div className="dp-student-bubble">
                  <p className="dp-student-text">{msg.text}</p>
                </div>
              </div>
            )
            if (msg.type === 'scores') return (
              <div key={i} style={{ paddingLeft: 8, paddingRight: 8 }}>
                {(msg.scores || []).map((s, j) => (
                  <div key={j}>
                    <span className={`dp-score-badge dp-score-badge--${(s.score_label||'').toLowerCase()} dp-score-badge--examiner-${examinerNameToSlug(s.examiner)} dp-score--visible`}>
                      {s.examiner?.replace(/^the\s+/i, '').toUpperCase()} · {(s.score_label||'').toUpperCase()} · {s.score||'?'}/10
                    </span>
                    {s.score_reasoning && (
                      <p className="dp-score-reasoning dp-score-reasoning--visible">{s.score_reasoning}</p>
                    )}
                  </div>
                ))}
              </div>
            )
            return null
          })}
        </div>
      )}

      {/* Summary loading */}
      {phase === 'summary-loading' && (
        <div className="dp-verdict-loading" style={{ padding: '40px 24px' }}>
          <div className="skeleton-loader skeleton-loader--dark">
            <div className="skeleton-bar" style={{ width: '100%' }} />
            <div className="skeleton-bar" style={{ width: '75%' }} />
            <div className="skeleton-bar" style={{ width: '90%' }} />
          </div>
          <p className="dp-verdict-loading-text">Generating your verdict…</p>
        </div>
      )}

      {/* Summary */}
      {phase === 'summary' && summaryData && (
        <div className="dp-summary-wrap">
          <div className={`dp-results-bar dp-results-bar--${(summaryData.panel_score_label||'').toLowerCase()}`}>
            <span className="dp-results-bar__text">Defence Complete</span>
            <span className="dp-results-bar__divider">·</span>
            <span className="dp-results-bar__score">{summaryData.panel_score || '?'}/10</span>
            <span className="dp-results-bar__divider">·</span>
            <span className="dp-results-bar__label">{(summaryData.panel_score_label||'').toUpperCase()}</span>
          </div>
          <div className="dp-summary-card">
            {(summaryData.verdicts || []).length > 0 && (
              <div className="dp-summary-verdicts">
                <p className="dp-summary-section-label">Individual Examiner Verdicts</p>
                {summaryData.verdicts.map((v, i) => (
                  <div key={i} className="dp-summary-verdict-row">
                    <span className={`dp-summary-examiner-name ${examinerNameToClass(v.examiner)}`}>{v.examiner}</span>
                    <span className={`dp-summary-score-badge dp-summary-score--${(v.overall_score_label||'').toLowerCase()}`}>
                      {(v.overall_score_label||'').toUpperCase()} · {v.overall_score||'?'}/10
                    </span>
                    {v.verdict && <p className="dp-summary-verdict-text">{v.verdict}</p>}
                  </div>
                ))}
              </div>
            )}
            {summaryData.strengths?.length > 0 && (
              <div className="dp-summary-section">
                <p className="dp-summary-section-label">Strengths Demonstrated</p>
                <ul className="dp-summary-list dp-summary-list--strengths">
                  {summaryData.strengths.map((s, i) => <li key={i}>{s}</li>)}
                </ul>
              </div>
            )}
            {summaryData.gaps?.length > 0 && (
              <div className="dp-summary-section">
                <p className="dp-summary-section-label">Gaps to Address</p>
                <ul className="dp-summary-list dp-summary-list--gaps">
                  {summaryData.gaps.map((g, i) => <li key={i}>{g}</li>)}
                </ul>
              </div>
            )}
            {summaryData.preparation_advice && (
              <div className="dp-summary-section">
                <p className="dp-summary-section-label">Preparation Advice</p>
                <p className="dp-summary-advice">{summaryData.preparation_advice}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Input area */}
      {phase === 'chat' && (
        <div className="dp-input-area" id="dp-input-area">
          <textarea
            className="dp-student-input"
            id="dp-student-input"
            placeholder="Type your answer here…"
            disabled={inputLocked}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault()
                if (!inputLocked) handleSubmit()
              }
            }}
          />
          <p className="dp-answer-error" id="dp-answer-error" />
          <div className="dp-input-row">
            <button
              className="dp-send-btn"
              id="dp-send-btn"
              disabled={inputLocked || inputText.trim().length < 10}
              onClick={handleSubmit}
            >
              Send Answer
            </button>
          </div>
        </div>
      )}

      {/* Exit warning modal */}
      {showExitModal && (
        <div className="dp-exit-modal-overlay dp-exit-modal-overlay--visible" id="dp-exit-modal">
          <div className="dp-exit-modal-box">
            <div className="dp-exit-modal-icon">⚠️</div>
            <h2 className="dp-exit-modal-heading">Leave Defence Early?</h2>
            <p className="dp-exit-modal-body">
              You have only completed {questionCount} of 5 questions. Leaving now means your readiness score will be based on incomplete responses.
            </p>
            <div className="dp-exit-modal-buttons">
              <button className="dp-exit-modal-continue" onClick={() => setShowExitModal(false)}>
                Continue Defence
              </button>
              <button className="dp-exit-modal-leave" onClick={doEndSession}>
                Leave Anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>,
    document.body
  )
}

// ── Main DefensePrep component ──────────────────────────────────────────────

export default function DefensePrep() {
  const { state, set, completeStep, navigateStep, studentContext } = useApp()

  const [section, setSection] = useState('input')
  const [redFlags, setRedFlags] = useState(state.redFlags || null)
  const [error, setError] = useState('')
  const [flagsRevealed, setFlagsRevealed] = useState(Boolean(state.redFlags))
  const [defenseOpen, setDefenseOpen] = useState(false)

  useEffect(() => {
    if (state.redFlags) {
      setRedFlags(state.redFlags)
      setFlagsRevealed(true)
      setSection('flags')
    }
  }, []) // eslint-disable-line

  async function handleStartScan() {
    setError('')
    setSection('loading')
    try {
      const data = await detectRedFlags(studentContext, state.validatedTopic, state.chosenMethodology || '', state.chapterStructure || {})
      set({ redFlags: data.flags })
      setRedFlags(data.flags)
      setFlagsRevealed(true)
      setSection('flags')
      showToast('Analysis complete', 'success')
    } catch (err) {
      setSection('input')
      handleApiError(err, (msg) => {
        setError(msg || 'Scan failed. Please check your connection and try again.')
        showToast('Something went wrong. Try again.', 'error')
      })
    }
  }

  function handleGoBackAndRevise() {
    set({
      redFlags: null,
      defenseApiMessages: [],
      defenseDisplayHistory: [],
      defenseQuestionCount: 0,
      defenseStarted: false,
      stepsCompleted: state.stepsCompleted.map((v, i) => i === 5 ? false : v),
    })
    navigateStep(4)
  }

  function handleDefenseComplete() {
    completeStep(5)
  }

  const severityDotClass = (sev) => {
    const s = (sev || '').toLowerCase()
    if (s === 'critical') return 'dp-flag-dot--critical'
    if (s === 'serious')  return 'dp-flag-dot--serious'
    return 'dp-flag-dot--minor'
  }

  return (
    <>
      <div className="dp-card" id="dp-card">

        {/* ── Input Section ── */}
        <div
          id="dp-input-section"
          className={`dp-input-section${section === 'input' ? ' dp-section--visible' : ' dp-section--hidden'}`}
        >
          <p className="dp-step-label">Step 6: Defence Prep</p>
          <p className="dp-description">
            FYPro will scan your full project context for the three most critical vulnerabilities your examiners are likely to exploit. Review them, then enter Defence Mode for a live mock examination.
          </p>
          <button id="dp-start-scan" className="dp-btn-start-scan" onClick={handleStartScan}>
            Scan for Red Flags
          </button>
          <button className="fy-back-btn" onClick={() => navigateStep(4)}>
            ← Back to Project Reviewer
          </button>
        </div>

        {/* ── Loading Section ── */}
        <div
          id="dp-loading-section"
          className={`dp-loading-section${section === 'loading' ? ' dp-section--visible' : ' dp-section--hidden'}`}
        >
          <div className="skeleton-loader">
            <div className="skeleton-bar" style={{ width: '100%' }} />
            <div className="skeleton-bar" style={{ width: '75%' }} />
            <div className="skeleton-bar" style={{ width: '90%' }} />
            <div className="skeleton-bar" style={{ width: '60%' }} />
          </div>
          <p className="dp-step-label">Step 6: Defence Prep</p>
          <p className="dp-scan-subtext">Scanning your project for vulnerabilities…</p>
          {error && (
            <p id="dp-error-text" className="dp-error-text dp-section--visible">{error}</p>
          )}
        </div>

        {/* ── Flags Section ── */}
        {redFlags && (
          <>
            <div
              id="dp-flags-section"
              className={`dp-flags-section${section === 'flags' ? ' dp-section--visible' : ' dp-section--hidden'}`}
            >
              <p className="dp-flags-header">Project Vulnerabilities Detected</p>
              <div id="dp-flags-list">
                {(redFlags || []).map((flag, i) => (
                  <div key={i} className="dp-flag-item dp-flag-item--visible">
                    <div className="dp-flag-header">
                      <span className={`dp-flag-dot ${severityDotClass(flag.severity)}`} />
                      <span className="dp-flag-title">{flag.title}</span>
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
                ))}
              </div>
            </div>

            <div
              id="dp-buttons-section"
              className={`dp-buttons-section${section === 'flags' ? ' dp-section--visible' : ' dp-section--hidden'}`}
            >
              <button
                id="dp-btn-enter-defense"
                className="dp-btn-enter-defense"
                onClick={() => setDefenseOpen(true)}
              >
                Enter Defence Mode
              </button>
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
          </>
        )}
      </div>

      {defenseOpen && (
        <DefenseOverlay
          studentContext={studentContext}
          validatedTopic={state.validatedTopic}
          methodology={state.chosenMethodology}
          chapterStructure={state.chapterStructure}
          onComplete={handleDefenseComplete}
        />
      )}
    </>
  )
}
