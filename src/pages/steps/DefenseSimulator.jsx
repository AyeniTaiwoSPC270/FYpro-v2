import { useState, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import StepLayout from '../../components/StepLayout'
import { useApp } from '../../context/AppContext'
import { detectRedFlags, panelFirstQuestion, panelFollowUp, panelSummary } from '../../services/api'
import { handleApiError } from '../../services/api'
import { showToast } from '../../components/Toast'

const EXAMINER_LABELS = ['Methodologist', 'Subject Expert', "Devil's Advocate"]
const EXAMINER_COLORS = ['#EF4444', '#F59E0B', '#8B5CF6']

const SCORE_STYLES = {
  Weak:        'bg-red-500/20 text-red-400 border border-red-500/30',
  Developing:  'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30',
  Strong:      'bg-green-500/20 text-green-400 border border-green-500/30',
}

const FLAG_SEVERITY = {
  Critical: 'bg-red-500/20 text-red-400 border border-red-500/30',
  Serious:  'bg-amber-500/20 text-amber-400 border border-amber-500/30',
  Minor:    'bg-slate-700/50 text-slate-400 border border-slate-700',
}

function LoadingDots({ label = 'FYPro is thinking...' }) {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <div className="flex gap-1.5" role="status">
        {[0, 0.15, 0.3].map((d) => (
          <motion.div key={d} className="w-2 h-2 rounded-full bg-blue-500"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: d, ease: 'easeInOut' }} />
        ))}
      </div>
      <p className="text-slate-400 text-sm font-sans">{label}</p>
    </div>
  )
}

// ── Red Flag card ─────────────────────────────────────────────────────────────

function RedFlagCard({ flags }) {
  return (
    <div className="flex flex-col gap-3">
      {flags.map((flag, i) => (
        <motion.div
          key={i}
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: i * 0.18, duration: 0.4 }}
          className={`rounded-xl p-4 border ${FLAG_SEVERITY[flag.severity] ?? FLAG_SEVERITY.Minor}`}
        >
          <div className="flex items-center gap-2 mb-1.5">
            <span className={`font-mono text-[0.58rem] uppercase tracking-widest px-2 py-0.5 rounded-full ${FLAG_SEVERITY[flag.severity] ?? FLAG_SEVERITY.Minor}`}>
              {flag.severity}
            </span>
          </div>
          <p className="font-sans text-sm font-semibold text-white mb-1">{flag.issue}</p>
          <p className="font-sans text-xs text-slate-400 leading-relaxed">{flag.suggestion}</p>
        </motion.div>
      ))}
    </div>
  )
}

// ── Defense Mode overlay ──────────────────────────────────────────────────────

function DefenseOverlay({ state: appState, set, completeStep, studentContext, onExit }) {
  const [apiMessages,    setApiMessages]    = useState(appState.defenseApiMessages || [])
  const [displayHistory, setDisplayHistory] = useState(appState.defenseDisplayHistory || [])
  const [loading,        setLoading]        = useState(false)
  const [answer,         setAnswer]         = useState('')
  const [summary,        setSummary]        = useState(appState.defenseSummary || null)
  const [questionCount,  setQuestionCount]  = useState(appState.defenseQuestionCount || 0)
  const [systemPrompt,   setSystemPrompt]   = useState(appState.defenseSystemPrompt || null)
  const [exitModal,      setExitModal]      = useState(false)
  const [error,          setError]          = useState(null)
  const [listening,      setListening]      = useState(false)
  const [currentQ,       setCurrentQ]       = useState(null)
  const MAX_QUESTIONS = 5
  const chatEndRef = useRef(null)
  const recognitionRef = useRef(null)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [displayHistory, summary, loading])

  // Auto-start if no history yet
  useEffect(() => {
    if (!systemPrompt && displayHistory.length === 0) {
      startDefense()
    }
  }, []) // eslint-disable-line

  async function startDefense() {
    setLoading(true)
    setError(null)
    try {
      const { parsed, rawText, system } = await panelFirstQuestion(
        studentContext,
        appState.validatedTopic,
        appState.chosenMethodology,
        appState.chapterStructure
      )
      const assistantMsg = { role: 'assistant', content: rawText }
      const newApiMessages = [assistantMsg]
      const newDisplay = [{ role: 'assistant', data: parsed }]
      setSystemPrompt(system)
      setApiMessages(newApiMessages)
      setDisplayHistory(newDisplay)
      setCurrentQ(parsed)
      set({ defenseSystemPrompt: system, defenseApiMessages: newApiMessages, defenseDisplayHistory: newDisplay, defenseStarted: true })
    } catch (err) {
      handleApiError(err, (msg) => { setError(msg); if (msg) showToast(msg, 'error') })
    } finally {
      setLoading(false)
    }
  }

  async function handleSubmitAnswer() {
    const trimmed = answer.trim()
    if (!trimmed || loading || !systemPrompt) return

    const userApiMsg  = { role: 'user', content: trimmed }
    const newApi      = [...apiMessages, userApiMsg]
    const newDisplay  = [...displayHistory, { role: 'user', text: trimmed }]
    setApiMessages(newApi)
    setDisplayHistory(newDisplay)
    setAnswer('')
    setLoading(true)
    setError(null)

    const newCount = questionCount + 1
    setQuestionCount(newCount)
    set({ defenseApiMessages: newApi, defenseDisplayHistory: newDisplay, defenseQuestionCount: newCount })

    // Last question → summary
    if (newCount >= MAX_QUESTIONS) {
      try {
        const data = await panelSummary(systemPrompt, newApi)
        const assistantMsg = { role: 'assistant', content: JSON.stringify(data) }
        const finalApi = [...newApi, assistantMsg]
        setApiMessages(finalApi)
        setSummary(data)
        set({ defenseSummary: data, defenseApiMessages: finalApi })
        completeStep(5)
      } catch (err) {
        handleApiError(err, (msg) => { setError(msg); if (msg) showToast(msg, 'error') })
      } finally {
        setLoading(false)
      }
      return
    }

    try {
      const { parsed, rawText } = await panelFollowUp(systemPrompt, newApi, trimmed)
      const assistantApiMsg = { role: 'assistant', content: rawText }
      const fullApi = [...newApi, assistantApiMsg]
      const fullDisplay = [...newDisplay, { role: 'assistant', data: parsed }]
      setApiMessages(fullApi)
      setDisplayHistory(fullDisplay)
      setCurrentQ(parsed)
      set({ defenseApiMessages: fullApi, defenseDisplayHistory: fullDisplay })
    } catch (err) {
      handleApiError(err, (msg) => { setError(msg); if (msg) showToast(msg, 'error') })
    } finally {
      setLoading(false)
    }
  }

  function handleMic() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) { showToast('Voice input not supported in this browser.', 'error'); return }

    if (listening) {
      recognitionRef.current?.stop()
      setListening(false)
      return
    }

    const recognition = new SpeechRecognition()
    recognition.continuous = false
    recognition.interimResults = false
    recognition.lang = 'en-NG'
    recognition.onresult = (e) => {
      setAnswer((prev) => prev + (prev ? ' ' : '') + e.results[0][0].transcript)
    }
    recognition.onend = () => setListening(false)
    recognition.onerror = () => setListening(false)
    recognitionRef.current = recognition
    recognition.start()
    setListening(true)
  }

  function handleExitAttempt() {
    if (questionCount < MAX_QUESTIONS && !summary) {
      setExitModal(true)
    } else {
      onExit()
    }
  }

  // Render summary
  if (summary) {
    const panelVerdict = summary.panel_verdict
    const verdictColor = panelVerdict?.score >= 70 ? '#10B981' : panelVerdict?.score >= 50 ? '#F59E0B' : '#EF4444'

    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="flex flex-col h-full overflow-y-auto"
        style={{ background: '#060A14' }}
      >
        <div className="max-w-2xl mx-auto w-full p-8 pb-16">
          <div className="font-mono text-xs tracking-widest uppercase text-red-400 mb-2">Defense Complete</div>
          <h2 className="font-serif text-3xl text-white mb-6">Panel Summary</h2>

          {/* Panel score */}
          {panelVerdict && (
            <div className="rounded-2xl border p-6 mb-6 text-center" style={{ background: 'var(--bg-card)', borderColor: `${verdictColor}40` }}>
              <div className="font-mono text-[0.6rem] tracking-widest uppercase mb-2" style={{ color: verdictColor }}>Panel Verdict</div>
              <div className="font-serif text-5xl text-white font-bold mb-1">{panelVerdict.score}<span className="text-2xl text-slate-500">/100</span></div>
              <div className="font-sans text-sm font-semibold mb-3" style={{ color: verdictColor }}>{panelVerdict.verdict}</div>
              <p className="text-slate-400 text-sm font-sans leading-relaxed">{panelVerdict.summary}</p>
            </div>
          )}

          {/* Examiner verdicts */}
          {summary.examiner_verdicts?.length > 0 && (
            <div className="flex flex-col gap-3 mb-6">
              {summary.examiner_verdicts.map((v, i) => (
                <div key={i} className="bg-[var(--bg-card)] rounded-xl border border-slate-800 p-5" style={{ borderLeft: `3px solid ${EXAMINER_COLORS[i]}` }}>
                  <div className="font-mono text-[0.6rem] tracking-widest uppercase mb-1" style={{ color: EXAMINER_COLORS[i] }}>{EXAMINER_LABELS[i]}</div>
                  <div className="font-sans text-sm font-semibold text-white mb-1">{v.verdict}</div>
                  <p className="text-slate-400 text-xs font-sans leading-relaxed">{v.feedback}</p>
                </div>
              ))}
            </div>
          )}

          {/* Strengths & Gaps */}
          <div className="grid grid-cols-2 gap-4 mb-6">
            {summary.strengths?.length > 0 && (
              <div className="bg-[var(--bg-card)] rounded-xl border border-green-500/20 p-5">
                <div className="font-mono text-[0.6rem] tracking-widest uppercase text-green-400 mb-3">Strengths</div>
                <ul className="space-y-2">
                  {summary.strengths.map((s, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-300 text-xs font-sans">
                      <span className="text-green-400 flex-shrink-0">✓</span> {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {summary.gaps?.length > 0 && (
              <div className="bg-[var(--bg-card)] rounded-xl border border-red-500/20 p-5">
                <div className="font-mono text-[0.6rem] tracking-widest uppercase text-red-400 mb-3">Gaps to Address</div>
                <ul className="space-y-2">
                  {summary.gaps.map((g, i) => (
                    <li key={i} className="flex items-start gap-2 text-slate-300 text-xs font-sans">
                      <span className="text-red-400 flex-shrink-0">!</span> {g}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>

          {summary.final_advice && (
            <div className="bg-blue-600/10 border border-blue-500/25 rounded-xl p-5 mb-6">
              <div className="font-mono text-[0.6rem] tracking-widest uppercase text-blue-400 mb-2">Final Advice</div>
              <p className="text-slate-300 text-sm font-sans leading-relaxed">{summary.final_advice}</p>
            </div>
          )}

          <div className="flex gap-3">
            <motion.button
              whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(22,163,74,0.4)' }}
              whileTap={{ scale: 0.98 }}
              onClick={onExit}
              className="flex-1 bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl py-4 transition-all duration-200 font-sans"
            >
              Complete Defense ✓
            </motion.button>
            <button
              onClick={() => window.location.reload()}
              className="px-5 py-4 text-slate-400 hover:text-white text-sm font-sans transition-colors border border-slate-700 hover:border-slate-500 rounded-xl"
            >
              Restart
            </button>
          </div>
        </div>
      </motion.div>
    )
  }

  return (
    <div className="flex flex-col h-full" style={{ background: '#060A14' }}>
      {/* Defense header */}
      <div className="flex-shrink-0 px-6 py-3 border-b border-red-900/30 flex items-center justify-between" style={{ background: '#08040E' }}>
        <div className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
          <span className="font-mono text-xs text-red-400 uppercase tracking-widest">Defense Mode Active</span>
        </div>
        <div className="flex items-center gap-4">
          {/* Question dots */}
          <div className="flex gap-1.5">
            {Array.from({ length: MAX_QUESTIONS }).map((_, i) => (
              <div key={i}
                className={`w-2 h-2 rounded-full transition-all duration-300 ${
                  i < questionCount ? 'bg-blue-500' : i === questionCount ? 'bg-blue-500 opacity-60' : 'bg-slate-700'
                }`}
              />
            ))}
          </div>
          <button onClick={handleExitAttempt} className="text-slate-500 hover:text-slate-300 font-mono text-[0.6rem] uppercase tracking-widest transition-colors">
            Exit
          </button>
        </div>
      </div>

      {/* Chat area */}
      <div className="flex-1 overflow-y-auto px-6 py-6">
        <div className="max-w-2xl mx-auto flex flex-col gap-5">
          {displayHistory.map((msg, i) => {
            if (msg.role === 'assistant' && msg.data) {
              const data = msg.data
              return (
                <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
                  {/* Examiner question card */}
                  <div
                    className="rounded-2xl p-6"
                    style={{
                      background: 'var(--bg-card)',
                      borderLeft: `4px solid ${EXAMINER_COLORS[0]}99`,
                      border: '1px solid rgba(239,68,68,0.2)',
                    }}
                  >
                    {data.examiner_label && (
                      <div className="font-mono text-xs uppercase tracking-widest text-red-400 mb-3">{data.examiner_label}</div>
                    )}
                    <p className="font-sans text-base text-white leading-relaxed mb-4 font-medium">{data.question}</p>
                    {data.scores && (
                      <div className="border-t border-slate-800 pt-3 flex flex-wrap gap-2">
                        {Object.entries(data.scores).map(([examiner, scoreData]) => (
                          <div key={examiner} className={`font-mono text-[0.6rem] px-2.5 py-1 rounded-full ${SCORE_STYLES[scoreData.score] ?? 'bg-slate-700 text-slate-400'}`}>
                            {examiner}: {scoreData.score}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </motion.div>
              )
            }
            if (msg.role === 'user') {
              return (
                <motion.div key={i} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} className="flex justify-end">
                  <div className="max-w-[80%] bg-blue-600/20 border border-blue-500/25 rounded-2xl px-5 py-3">
                    <p className="text-slate-200 text-sm font-sans leading-relaxed">{msg.text}</p>
                  </div>
                </motion.div>
              )
            }
            return null
          })}

          {loading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <div className="rounded-2xl p-4" style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <LoadingDots label="Panel is deliberating..." />
              </div>
            </motion.div>
          )}

          {error && (
            <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm font-sans">
              {error}
            </div>
          )}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Answer input */}
      {!summary && (
        <div className="flex-shrink-0 border-t border-slate-800/60 p-4" style={{ background: '#08040E' }}>
          <div className="max-w-2xl mx-auto">
            <div
              className="flex gap-2 rounded-2xl border border-slate-700 focus-within:border-blue-500 transition-colors"
              style={{ background: 'var(--bg-input)' }}
            >
              <textarea
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmitAnswer() }
                }}
                placeholder="Type your answer… (Enter to submit, Shift+Enter for new line)"
                rows={3}
                disabled={loading}
                className="flex-1 bg-transparent px-4 py-3 text-white placeholder-slate-600 text-sm resize-none focus:outline-none font-sans leading-relaxed disabled:opacity-50"
              />
              <div className="flex flex-col justify-end p-2 gap-1.5">
                <button
                  onClick={handleMic}
                  title="Voice input"
                  className={`w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
                    listening ? 'bg-red-500/30 text-red-400 animate-pulse' : 'text-slate-500 hover:text-blue-400 hover:bg-blue-600/15'
                  }`}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                    <line x1="12" y1="19" x2="12" y2="23" />
                    <line x1="8" y1="23" x2="16" y2="23" />
                  </svg>
                </button>
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.93 }}
                  onClick={handleSubmitAnswer}
                  disabled={!answer.trim() || loading}
                  className="w-9 h-9 bg-blue-600 hover:bg-blue-500 text-white rounded-xl flex items-center justify-center transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </motion.button>
              </div>
            </div>
            <p className="text-center font-mono text-[0.58rem] text-slate-700 mt-1.5">
              Question {questionCount + 1} of {MAX_QUESTIONS} · Enter to submit
            </p>
          </div>
        </div>
      )}

      {/* Exit warning modal */}
      <AnimatePresence>
        {exitModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4"
            style={{ background: 'rgba(6,10,20,0.88)', backdropFilter: 'blur(4px)' }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="rounded-2xl p-8 max-w-sm w-full"
              style={{ background: 'var(--bg-card)', border: '1px solid rgba(239,68,68,0.3)' }}
            >
              <div className="font-mono text-xs tracking-widest uppercase text-red-400 mb-2">Warning</div>
              <h3 className="font-serif text-xl text-white mb-3">Exit Defense Mode?</h3>
              <p className="text-slate-400 text-sm font-sans leading-relaxed mb-6">
                You've only answered {questionCount} of {MAX_QUESTIONS} questions. Your progress will be saved but the panel summary won't be generated.
              </p>
              <div className="flex gap-3">
                <button onClick={onExit} className="flex-1 py-3 rounded-xl border border-red-500/40 text-red-400 hover:bg-red-500/10 text-sm font-semibold font-sans transition-all">
                  Exit Anyway
                </button>
                <button onClick={() => setExitModal(false)} className="flex-1 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold font-sans transition-all">
                  Continue
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── Main DefenseSimulator page ────────────────────────────────────────────────

export default function DefenseSimulator() {
  const navigate = useNavigate()
  const { state, set, completeStep, studentContext } = useApp()

  const [loading,      setLoading]      = useState(false)
  const [redFlags,     setRedFlags]     = useState(state.redFlags || null)
  const [error,        setError]        = useState(null)
  const [defenseMode,  setDefenseMode]  = useState(false)

  async function handleScanFlags() {
    setError(null)
    setLoading(true)
    try {
      const data = await detectRedFlags(
        studentContext,
        state.validatedTopic,
        state.chosenMethodology,
        state.chapterStructure
      )
      setRedFlags(data)
      set({ redFlags: data })
    } catch (err) {
      handleApiError(err, (msg) => { setError(msg); if (msg) showToast(msg, 'error') })
    } finally {
      setLoading(false)
    }
  }

  function handleEnterDefense() {
    setDefenseMode(true)
    set({ defenseMode: true })
  }

  function handleExitDefense() {
    setDefenseMode(false)
    set({ defenseMode: false })
  }

  if (defenseMode) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col" style={{ background: '#060A14' }}>
        <DefenseOverlay
          state={state}
          set={set}
          completeStep={completeStep}
          studentContext={studentContext}
          onExit={handleExitDefense}
        />
      </div>
    )
  }

  return (
    <StepLayout currentStep={6} defenseMode={false}>

      <div className="mb-8">
        <div className="font-mono text-xs tracking-widest uppercase text-blue-400 mb-2">Step 6</div>
        <h1 className="font-serif text-3xl text-white mb-2">Defense Simulator</h1>
        <p className="font-sans text-base text-slate-400 leading-relaxed max-w-2xl">
          First, scan your project for red flags examiners might raise. Then enter a full three-examiner panel simulation before the real thing.
        </p>
      </div>

      {/* Red Flag Scanner */}
      <div
        className="rounded-2xl border-l-[3px] border-l-red-500 shadow-[0_8px_40px_rgba(59,130,246,0.06)] p-8 mb-6"
        style={{ background: 'var(--bg-card)', borderTop: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        <div className="font-mono text-xs tracking-widest uppercase text-red-400 mb-1">Pre-Defense Check</div>
        <h2 className="font-serif text-xl text-white mb-2">Red Flag Scanner</h2>
        <p className="font-sans text-sm text-slate-400 mb-5 leading-relaxed">
          FYPro will identify the three most likely weaknesses examiners will probe in your project.
        </p>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm font-sans mb-4">
            {error}
          </div>
        )}

        {loading && <LoadingDots label="Scanning for red flags..." />}

        {!loading && !redFlags && (
          <motion.button
            whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(239,68,68,0.3)' }}
            whileTap={{ scale: 0.98 }}
            onClick={handleScanFlags}
            className="font-sans font-semibold text-sm text-white bg-red-600 hover:bg-red-500 rounded-xl px-5 py-3 transition-all duration-200"
          >
            Scan for Red Flags
          </motion.button>
        )}

        {!loading && redFlags && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <RedFlagCard flags={redFlags.flags ?? redFlags} />
            <button
              onClick={handleScanFlags}
              className="mt-4 font-mono text-[0.62rem] uppercase tracking-widest text-slate-500 hover:text-red-400 transition-colors"
            >
              Re-scan →
            </button>
          </motion.div>
        )}
      </div>

      {/* Enter Defense */}
      <motion.div
        className="rounded-2xl border-l-[3px] border-l-red-500 p-8"
        style={{ background: 'var(--bg-card)', borderTop: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
        whileHover={{ boxShadow: '0 14px 40px rgba(239,68,68,0.12)' }}
        transition={{ duration: 0.2 }}
      >
        <div className="font-mono text-xs tracking-widest uppercase text-red-400 mb-1">Three-Examiner Panel</div>
        <h2 className="font-serif text-xl text-white mb-2">Defense Simulation</h2>
        <p className="font-sans text-sm text-slate-400 mb-2 leading-relaxed">
          Face three AI examiners — a Methodologist, Subject Expert, and Devil's Advocate — in a full panel simulation. You'll answer 5 questions and receive a readiness score with detailed feedback.
        </p>
        <div className="flex gap-2 mb-6 flex-wrap">
          {EXAMINER_LABELS.map((label, i) => (
            <span key={label} className="font-mono text-[0.6rem] px-2.5 py-1 rounded-full border" style={{ color: EXAMINER_COLORS[i], borderColor: `${EXAMINER_COLORS[i]}40`, background: `${EXAMINER_COLORS[i]}15` }}>
              {label}
            </span>
          ))}
        </div>

        {state.defenseSummary && (
          <div className="bg-green-500/10 border border-green-500/25 rounded-xl px-4 py-3 mb-4">
            <p className="text-green-400 text-sm font-sans">
              ✓ Defense completed — Score: <strong>{state.defenseSummary.panel_verdict?.score}/100</strong>. You can restart for another attempt.
            </p>
          </div>
        )}

        <motion.button
          whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(239,68,68,0.4)' }}
          whileTap={{ scale: 0.98 }}
          onClick={handleEnterDefense}
          className="font-sans font-semibold text-sm text-white bg-red-600 hover:bg-red-500 rounded-xl px-6 py-4 w-full transition-all duration-200"
        >
          {state.defenseSummary ? 'Restart Defense Simulation' : 'Enter Defense Mode →'}
        </motion.button>
      </motion.div>
    </StepLayout>
  )
}
