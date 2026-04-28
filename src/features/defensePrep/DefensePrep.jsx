import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import {
  detectRedFlags,
  panelFirstQuestion,
  panelFollowUp,
  panelSummary,
  handleApiError,
} from '../../services/api'
import {
  THREE_EXAMINER_FIRST_QUESTION_PROMPT,
  buildThreeExaminerFollowUpPrompt,
} from '../../services/prompts.js'
import { useApp } from '../../context/AppContext'

// ── helpers ───────────────────────────────────────────────────────────────────

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

function resolveExaminerVoice(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('subject')) return { rate: 1.0,  pitch: 1.1  }
  if (n.includes('devil'))   return { rate: 1.15, pitch: 0.95 }
  return                            { rate: 0.9,  pitch: 0.85 }
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

function ExaminerBubble({ examiner, text, onReady }) {
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
  }, []) // eslint-disable-line

  return (
    <div className="dp-examiner-wrap">
      <p className={`dp-examiner-label ${examinerNameToClass(examiner)}`}>{labelText}</p>
      <div className={`dp-examiner-bubble${bubbleVisible ? ' dp-examiner-bubble--visible' : ''}`}>
        <p className="dp-examiner-text">{text}</p>
      </div>
    </div>
  )
}

function ScoreBadges({ scores }) {
  const [visible, setVisible] = useState([])

  useEffect(() => {
    const timers = scores.map((_, i) =>
      setTimeout(() => setVisible(prev => [...prev, i]), 150 + i * 300)
    )
    return () => timers.forEach(clearTimeout)
  }, []) // eslint-disable-line

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
  }, []) // eslint-disable-line

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

function StudentBubble({ text, scores }) {
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
}

function FlagItem({ flag, visible }) {
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
}

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

function SummaryCard({ data, onClose }) {
  const panelLabel = (data.panel_score_label || '').toLowerCase()

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

          <button className="dp-summary-done-btn" onClick={onClose}>
            Close Defence Session
          </button>
        </div>
      </div>
    </>
  )
}

// ── main component ────────────────────────────────────────────────────────────

const MIC_SVG = (
  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" />
    <path d="M19 11h-2a5 5 0 0 1-10 0H5a7 7 0 0 0 6 6.93V21h2v-3.07A7 7 0 0 0 19 11z" />
  </svg>
)

export default function DefensePrep() {
  const { state, studentContext, navigateStep, completeStep, set } = useApp()

  const uploadedReview = state.uploadedProject?.reviewData

  // ── card state ────────────────────────────────────────────────────────────
  const [section, setSection]             = useState(state.redFlags ? 'flags' : 'input')
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
  const [summaryData, setSummaryData]         = useState(null)
  const [exitModalOpen, setExitModalOpen]     = useState(false)
  const [micActive, setMicActive]             = useState(false)

  // ── refs (survive async boundaries, never trigger re-renders) ─────────────
  const defenseMessagesRef    = useRef([])
  const panelSystemRef        = useRef(null)
  const questionCountRef      = useRef(0)
  const currentExaminerRef    = useRef('The Methodologist')
  const msgIdRef              = useRef(0)
  const justScannedRef        = useRef(false)
  const recognitionRef        = useRef(null)
  const currentAudioRef       = useRef(null)
  const elevenLabsInFlightRef = useRef(false)
  const micActiveRef          = useRef(false)
  const chatAreaRef           = useRef(null)
  const textareaRef           = useRef(null)
  const submitHandlerRef      = useRef(null)

  const voiceSupported = !!(window.SpeechRecognition || window.webkitSpeechRecognition)
  const ttsSupported   = !!window.speechSynthesis

  // ── effects ───────────────────────────────────────────────────────────────

  // Keep submit handler ref current so speech recognition can call latest version
  submitHandlerRef.current = handleStudentSubmit

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

  function speakAsExaminer(text, examinerName) {
    if (!text) return
    if (currentAudioRef.current) {
      currentAudioRef.current.pause()
      currentAudioRef.current.src = ''
      currentAudioRef.current = null
    }
    if (elevenLabsInFlightRef.current) return
    elevenLabsInFlightRef.current = true

    fetch('/api/speak', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, examiner: examinerName }),
    })
      .then(res => {
        if (!res.ok) throw new Error('speak-api-' + res.status)
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
      .catch(() => {
        elevenLabsInFlightRef.current = false
        fallbackSpeak(text, examinerName)
      })
  }

  function fallbackSpeak(text, examinerName) {
    if (!ttsSupported || !text) return
    const { rate, pitch } = resolveExaminerVoice(examinerName)
    window.speechSynthesis.cancel()
    const utt = new SpeechSynthesisUtterance(text)
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
        setInputValue(transcript)
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
    setIsScanning(true)
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
      setVisibleFlags([])
      justScannedRef.current = true
      setSection('flags')
      setIsScanning(false)
    } catch (err) {
      setIsScanning(false)
      setSection('input')
      handleApiError(err, msg => setScanError(msg))
    }
  }

  // ── enter defense mode ────────────────────────────────────────────────────

  function enterDefenseMode() {
    defenseMessagesRef.current = []
    panelSystemRef.current     = null
    questionCountRef.current   = 0
    currentExaminerRef.current = 'The Methodologist'
    msgIdRef.current           = 0

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
    setOverlayOpen(true)

    initRecognition()
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
    } catch {
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
    } catch {
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

      // Mark complete without advancing currentStep past the last step
      const newCompleted = [...state.stepsCompleted]
      newCompleted[5] = true
      set({ stepsCompleted: newCompleted, defenseSummary: data, currentStep: 5 })

      setVerdictLoading(false)
      setSummaryData(data)
      setOverlayPhase('summary')
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } catch {
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

  function closeDefenseOverlay() {
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
  }

  function handleGoBackAndRevise() {
    set({
      redFlags:              null,
      defenseApiMessages:    [],
      defenseDisplayHistory: [],
      defenseQuestionCount:  0,
      defenseStarted:        false,
    })
    setRedFlags(null)
    setVisibleFlags([])
    setButtonsVisible(false)
    setScanError(null)
    setSection('input')
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
            onReady={() => speakAsExaminer(msg.text, msg.examiner)}
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
        <span className="dp-watermark" aria-hidden="true">6</span>

        {/* Input section */}
        <div
          id="dp-input-section"
          className={`dp-input-section ${section === 'input' ? 'dp-section--visible' : 'dp-section--hidden'}`}
        >
          <button className="fy-back-btn" onClick={() => navigateStep(4)}>
            ← Back to Project Reviewer
          </button>
          <p className="dp-step-label">Step 6: Defence Prep</p>
          <p className="dp-description">
            FYPro will scan your full project context for the three most critical vulnerabilities
            your examiners are likely to exploit. Review them, then enter Defence Mode for a live
            mock examination.
          </p>
          {scanError && (
            <p id="dp-error-text" className="dp-error-text dp-section--visible">{scanError}</p>
          )}
          <button
            id="dp-start-scan"
            className="dp-btn-start-scan"
            disabled={isScanning}
            onClick={startRedFlagScan}
          >
            Scan for Red Flags
          </button>
        </div>

        {/* Loading section */}
        <div
          id="dp-loading-section"
          className={`dp-loading-section ${section === 'loading' ? 'dp-section--visible' : 'dp-section--hidden'}`}
        >
          <div className="skeleton-loader">
            <div className="skeleton-bar" style={{ width: '100%' }} />
            <div className="skeleton-bar" style={{ width: '75%' }} />
            <div className="skeleton-bar" style={{ width: '90%' }} />
            <div className="skeleton-bar" style={{ width: '60%' }} />
          </div>
          <p className="dp-step-label">Step 6: Defence Prep</p>
          <p className="dp-scan-subtext">Scanning your project for vulnerabilities…</p>
        </div>

        {/* Flags section */}
        <div
          id="dp-flags-section"
          className={`dp-flags-section ${section === 'flags' ? 'dp-section--visible' : 'dp-section--hidden'}`}
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
      </div>

      {/* ── Defence overlay (React portal over document.body) ─────────────── */}
      {overlayOpen && createPortal(
        <div className="dp-defense-overlay" id="dp-defense-overlay">

          {/* Header */}
          <div className="dp-defense-header">
            <span className="dp-defense-title">FYPro — Defence Simulator</span>
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
                className={`dp-input-area${inputLocked ? ' dp-input-area--loading' : ''}`}
                id="dp-input-area"
              >
                {verdictLoading ? (
                  <div className="dp-verdict-loading">
                    <div className="skeleton-loader skeleton-loader--dark">
                      <div className="skeleton-bar" style={{ width: '100%' }} />
                      <div className="skeleton-bar" style={{ width: '75%' }} />
                      <div className="skeleton-bar" style={{ width: '90%' }} />
                    </div>
                    <p className="dp-verdict-loading-text">Generating your verdict…</p>
                  </div>
                ) : (
                  <>
                    <textarea
                      ref={textareaRef}
                      className="dp-student-input"
                      id="dp-student-input"
                      placeholder="Type your answer here…"
                      value={inputValue}
                      onChange={e => setInputValue(e.target.value)}
                      disabled={inputLocked}
                      onKeyDown={handleKeyDown}
                    />
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
                              : '1.5px solid rgba(255,255,255,0.2)',
                            background: micActive ? 'rgba(220,38,38,0.2)' : 'transparent',
                            color: micActive ? '#F87171' : 'rgba(255,255,255,0.6)',
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
                        disabled={inputLocked}
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
              <SummaryCard data={summaryData} onClose={closeDefenseOverlay} />
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
