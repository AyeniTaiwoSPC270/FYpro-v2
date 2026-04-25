import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import StepLayout from '../../components/StepLayout'
import { useApp } from '../../context/AppContext'
import { buildInstrument } from '../../services/api'
import { handleApiError } from '../../services/api'
import { showToast } from '../../components/Toast'

function LoadingDots() {
  return (
    <div className="flex flex-col items-center gap-4 py-12">
      <div className="flex gap-1.5" role="status">
        {[0, 0.15, 0.3].map((d) => (
          <motion.div key={d} className="w-2 h-2 rounded-full bg-blue-500"
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 0.6, repeat: Infinity, delay: d, ease: 'easeInOut' }} />
        ))}
      </div>
      <p className="text-slate-400 text-sm font-sans">FYPro is thinking...</p>
    </div>
  )
}

const INSTR_TYPES = [
  { key: 'questionnaire',  label: 'Questionnaire',    desc: 'Structured questions for survey respondents' },
  { key: 'interview',      label: 'Interview Guide',   desc: 'Semi-structured questions for in-depth interviews' },
  { key: 'observation',    label: 'Observation Checklist', desc: 'Systematic observation criteria and indicators' },
]

export default function InstrumentBuilder() {
  const navigate = useNavigate()
  const { state, set, completeStep, studentContext } = useApp()

  const [instrType, setInstrType] = useState('questionnaire')
  const [loading,   setLoading]   = useState(false)
  const [result,    setResult]    = useState(state.instrumentData || null)
  const [error,     setError]     = useState(null)
  const [copied,    setCopied]    = useState(false)
  const resultRef = useRef(null)

  async function handleBuild(e) {
    e?.preventDefault()
    setError(null)
    setResult(null)
    setLoading(true)
    try {
      const data = await buildInstrument(
        studentContext,
        state.validatedTopic,
        state.chosenMethodology || instrType,
        state.chapterStructure
      )
      setResult(data)
      set({ instrumentData: data })
      setTimeout(() => resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      handleApiError(err, (msg) => { setError(msg); if (msg) showToast(msg, 'error') })
    } finally {
      setLoading(false)
    }
  }

  async function handleCopy() {
    if (!result) return
    const text = result.sections
      ?.map((s) => `${s.title}\n${s.items?.map((item, i) => `${i + 1}. ${item}`).join('\n')}`)
      .join('\n\n') ?? ''
    await navigator.clipboard.writeText(text)
    setCopied(true)
    showToast('Instrument copied!', 'success')
    setTimeout(() => setCopied(false), 2500)
  }

  function handleConfirm() {
    completeStep(3)
    showToast('Instrument built! Proceeding to Writing Planner.', 'success')
    navigate('/workflow/writing-planner')
  }

  return (
    <StepLayout currentStep={4}>

      <div className="mb-8">
        <div className="font-mono text-xs tracking-widest uppercase text-blue-400 mb-2">Step 4</div>
        <h1 className="font-serif text-3xl text-white mb-2">Instrument Builder</h1>
        <p className="font-sans text-base text-slate-400 leading-relaxed max-w-2xl">
          Build your data collection tool — questionnaire, interview guide, or observation checklist — tailored to your research topic and methodology.
        </p>
      </div>

      {/* Config card */}
      <form
        onSubmit={handleBuild}
        className="rounded-2xl border-l-[3px] border-l-blue-600 shadow-[0_8px_40px_rgba(59,130,246,0.06)] p-8 mb-6"
        style={{ background: '#0D1425', borderTop: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
      >
        {state.chosenMethodology && (
          <div className="mb-4 flex items-center gap-2">
            <span className="font-mono text-[0.6rem] uppercase tracking-widest text-slate-500">Methodology:</span>
            <span className="font-mono text-[0.65rem] text-blue-400 capitalize px-2 py-0.5 bg-blue-600/10 rounded-full border border-blue-500/20">
              {state.chosenMethodology}
            </span>
          </div>
        )}

        <div className="mb-6">
          <div className="font-mono text-xs tracking-widest uppercase text-blue-400 mb-3">Instrument Type</div>
          <div className="flex flex-col gap-3">
            {INSTR_TYPES.map((opt) => (
              <motion.button
                key={opt.key}
                type="button"
                whileHover={{ x: 3 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setInstrType(opt.key)}
                className={`flex items-center gap-4 p-4 rounded-xl border text-left transition-all duration-200 ${
                  instrType === opt.key
                    ? 'border-blue-500/60 bg-blue-600/10'
                    : 'border-slate-800 bg-[#111827] hover:border-slate-600'
                }`}
              >
                <div className={`w-4 h-4 rounded-full flex-shrink-0 border-2 flex items-center justify-center transition-all ${instrType === opt.key ? 'border-blue-500' : 'border-slate-600'}`}>
                  {instrType === opt.key && <div className="w-2 h-2 rounded-full bg-blue-500" />}
                </div>
                <div>
                  <div className="font-sans text-sm font-semibold text-white">{opt.label}</div>
                  <div className="text-slate-500 text-xs font-sans mt-0.5">{opt.desc}</div>
                </div>
              </motion.button>
            ))}
          </div>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-400 text-sm font-sans mb-4">
            {error}
          </div>
        )}

        <motion.button
          type="submit"
          whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(59,130,246,0.4)' }}
          whileTap={{ scale: 0.98 }}
          disabled={loading}
          className="bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl px-6 py-4 w-full transition-all duration-200 font-sans disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {result ? 'Regenerate Instrument' : 'Build Instrument'}
        </motion.button>
      </form>

      {loading && (
        <div className="rounded-2xl border border-slate-800 p-8" style={{ background: '#0D1425' }}>
          <LoadingDots />
        </div>
      )}

      <AnimatePresence>
        {result && !loading && (
          <motion.div
            ref={resultRef}
            key="result"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="rounded-2xl border-l-[3px] border-l-blue-600 p-8"
            style={{ background: '#0D1425', borderTop: '1px solid rgba(255,255,255,0.05)', borderRight: '1px solid rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.05)' }}
          >
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="font-mono text-xs tracking-widest uppercase text-blue-400 mb-1">Generated Instrument</div>
                <h2 className="font-serif text-xl text-white">{result.title ?? 'Research Instrument'}</h2>
              </div>
              <button
                onClick={handleCopy}
                className="font-mono text-[0.62rem] uppercase tracking-widest text-slate-500 hover:text-blue-400 transition-colors"
              >
                {copied ? '✓ Copied' : 'Copy All'}
              </button>
            </div>

            {result.instructions && (
              <div className="bg-blue-600/8 rounded-xl border border-blue-500/20 p-4 mb-5">
                <div className="font-mono text-[0.6rem] tracking-widest uppercase text-blue-400 mb-1.5">Instructions to Respondents</div>
                <p className="text-slate-300 text-sm font-sans leading-relaxed">{result.instructions}</p>
              </div>
            )}

            <div className="flex flex-col gap-4 mb-7">
              {result.sections?.map((section, i) => (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.08 }}
                  className="bg-[#111827] rounded-xl border border-slate-800 hover:border-blue-500/25 transition-colors p-5"
                >
                  <div className="font-sans text-sm font-semibold text-white mb-3">{section.title}</div>
                  <ol className="space-y-2">
                    {section.items?.map((item, j) => (
                      <li key={j} className="flex items-start gap-3 text-slate-300 text-sm font-sans">
                        <span className="font-mono text-[0.6rem] text-slate-500 flex-shrink-0 mt-0.5 w-5">{j + 1}.</span>
                        <span className="leading-relaxed">{item}</span>
                      </li>
                    ))}
                  </ol>
                </motion.div>
              ))}
            </div>

            {result.scoring_guide && (
              <div className="bg-[#111827] rounded-xl border border-slate-800 p-5 mb-6">
                <div className="font-mono text-[0.6rem] tracking-widest uppercase text-slate-500 mb-2">Scoring Guide</div>
                <p className="text-slate-300 text-sm font-sans leading-relaxed">{result.scoring_guide}</p>
              </div>
            )}

            <motion.button
              whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(22,163,74,0.4)' }}
              whileTap={{ scale: 0.98 }}
              onClick={handleConfirm}
              className="bg-green-600 hover:bg-green-500 text-white font-semibold rounded-xl px-6 py-4 w-full transition-all duration-200 font-sans"
            >
              Confirm Instrument → Writing Planner
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </StepLayout>
  )
}
