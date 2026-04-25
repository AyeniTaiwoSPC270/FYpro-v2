import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import SupervisorEmail from './SupervisorEmail'

const SHIELD_D =
  'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

const STEP_DEFS = [
  { id: 1, name: 'Topic Validator',    short: 'Topic',       path: '/workflow/topic-validator' },
  { id: 2, name: 'Chapter Architect',  short: 'Chapters',    path: '/workflow/chapter-architect' },
  { id: 3, name: 'Methodology',        short: 'Method',      path: '/workflow/methodology-advisor' },
  { id: 4, name: 'Instrument Builder', short: 'Instruments', path: '/workflow/instrument-builder' },
  { id: 5, name: 'Writing Planner',    short: 'Writing',     path: '/workflow/writing-planner' },
  { id: 6, name: 'Defense Simulator',  short: 'Defense',     path: '/workflow/defense-simulator' },
]

function CheckIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <polyline points="20 6 9 17 4 12" />
    </svg>
  )
}

function LockIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  )
}

function BackArrowIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="19" y1="12" x2="5" y2="12" />
      <polyline points="12 19 5 12 12 5" />
    </svg>
  )
}

function MailIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

export default function StepLayout({ currentStep, children, defenseMode = false }) {
  const { state } = useApp()
  const navigate = useNavigate()
  const [showEmail, setShowEmail] = useState(false)
  const { stepsCompleted, university, department, level, validatedTopic } = state

  const completedIds = STEP_DEFS.filter((_, i) => stepsCompleted[i]).map((s) => s.id)
  const allDone = stepsCompleted.slice(0, 4).every(Boolean)
  const pageBg = defenseMode ? '#060A14' : '#0A0F1C'

  function handleStepClick(step) {
    const done   = completedIds.includes(step.id)
    const active = step.id === currentStep
    if (done || active) navigate(step.path)
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden" style={{ background: pageBg }}>

      {/* ── Top Step Navigator ── */}
      <nav
        className="flex-shrink-0 z-30 border-b border-slate-800"
        style={{ background: '#070C18' }}
        aria-label="Research step progress"
      >
        <div className="flex items-start justify-center gap-0 px-6 py-4 max-w-5xl mx-auto">
          {STEP_DEFS.map((step, i) => {
            const done   = completedIds.includes(step.id)
            const active = step.id === currentStep
            const isLast = i === STEP_DEFS.length - 1

            return (
              <div key={step.id} className="flex items-start">
                <div className="flex flex-col items-center gap-1.5" style={{ minWidth: 52 }}>
                  <button
                    onClick={() => handleStepClick(step)}
                    disabled={!done && !active}
                    aria-current={active ? 'step' : undefined}
                    className={`w-8 h-8 rounded-full flex items-center justify-center font-bold font-mono text-xs transition-all duration-200 ${
                      done
                        ? 'bg-blue-600 text-white cursor-pointer hover:bg-blue-500'
                        : active
                        ? 'bg-blue-600 text-white ring-2 ring-blue-500 ring-offset-2 ring-offset-[#070C18] shadow-[0_0_16px_rgba(59,130,246,0.5)]'
                        : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                    }`}
                  >
                    {done ? <CheckIcon /> : step.id}
                  </button>
                  <span
                    className={`text-[10px] font-sans whitespace-nowrap transition-colors duration-200 ${
                      active ? 'text-blue-400 font-semibold' : done ? 'text-blue-400' : 'text-slate-500'
                    }`}
                  >
                    {step.short}
                  </span>
                </div>

                {!isLast && (
                  <div className="flex items-center" style={{ marginTop: 15, paddingLeft: 4, paddingRight: 4 }}>
                    <div
                      className="h-0.5 transition-all duration-300"
                      style={{ width: 52, background: done ? '#2563EB' : '#1e293b' }}
                    />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </nav>

      {/* ── Body: Sidebar + Content ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── Sidebar ── */}
        <aside
          className="flex flex-col flex-shrink-0 border-r border-slate-800"
          style={{ width: 244, background: '#070C18' }}
          aria-label="Navigation sidebar"
        >
          {/* Logo */}
          <div className="flex items-center gap-2.5 border-b border-slate-800/60 px-5 py-[18px]">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={24} height={24} fill="#0066FF" style={{ filter: 'drop-shadow(0 0 8px rgba(0,102,255,0.5))' }} aria-hidden="true">
              <path d={SHIELD_D} />
            </svg>
            <span className="font-serif text-[1.22rem] text-white leading-none">
              FY<span style={{ color: '#0066FF' }}>Pro</span>
            </span>
          </div>

          {/* Student context card */}
          {university && (
            <div
              className="mx-3 mt-4 rounded-xl p-4"
              style={{
                background: '#0D1425',
                border: '1px solid rgba(255,255,255,0.07)',
                borderLeft: '3px solid rgba(0,102,255,0.5)',
              }}
            >
              <div className="font-mono text-[0.53rem] tracking-widest uppercase text-blue-400 mb-1.5">Active Project</div>
              <div className="text-white font-semibold text-xs leading-tight">{university}</div>
              <div className="text-slate-400 text-[0.68rem] mt-0.5">{department}{level ? ` · ${level}` : ''}</div>
              {validatedTopic && (
                <p className="text-slate-300 text-[0.63rem] italic mt-2 leading-relaxed line-clamp-3 font-sans">
                  {validatedTopic}
                </p>
              )}
            </div>
          )}

          {/* Nav label */}
          <div className="px-5 pt-5 pb-2 font-mono text-[0.54rem] tracking-widest uppercase text-slate-600">
            Research Steps
          </div>

          {/* Step list */}
          <nav className="flex-1 overflow-y-auto pb-3" aria-label="Step navigation">
            {STEP_DEFS.map((step) => {
              const done   = completedIds.includes(step.id)
              const active = step.id === currentStep
              const locked = !done && !active

              return (
                <div
                  key={step.id}
                  role="button"
                  tabIndex={locked ? -1 : 0}
                  aria-disabled={locked}
                  onClick={() => handleStepClick(step)}
                  onKeyDown={(e) => e.key === 'Enter' && handleStepClick(step)}
                  className={`flex items-center gap-2.5 pr-4 py-2.5 mb-0.5 outline-none transition-all duration-200 ${
                    active
                      ? 'bg-blue-600/20 border-l-4 border-blue-500 rounded-r-xl pl-3'
                      : 'border-l-4 border-transparent pl-3'
                  } ${locked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                >
                  <div
                    className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[0.6rem] font-bold ${
                      done ? 'bg-blue-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-800 text-slate-500'
                    }`}
                  >
                    {done ? <CheckIcon /> : locked ? <LockIcon /> : step.id}
                  </div>
                  <span
                    className={`text-[0.74rem] flex-1 leading-tight font-sans ${
                      active ? 'text-white font-semibold'
                      : done ? 'text-blue-400'
                      : 'text-slate-500 hover:text-slate-300'
                    }`}
                  >
                    {step.name}
                  </span>
                  {active && (
                    <motion.span
                      animate={{ opacity: [1, 0.3, 1] }}
                      transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ background: '#0066FF' }}
                    />
                  )}
                </div>
              )
            })}
          </nav>

          {/* Bonus: Supervisor Email */}
          {allDone && (
            <div className="px-3 pb-2">
              <button
                onClick={() => setShowEmail(true)}
                className="w-full flex items-center gap-2 justify-center px-3 py-2.5 rounded-xl text-blue-400 border border-blue-500/30 hover:bg-blue-600/10 hover:border-blue-500/60 transition-all duration-200 font-sans text-xs font-semibold"
              >
                <MailIcon /> Draft Supervisor Email
              </button>
            </div>
          )}

          {/* Back to dashboard */}
          <div className="p-4 border-t border-slate-800">
            <Link
              to="/dashboard"
              className="flex items-center gap-1.5 text-slate-500 hover:text-slate-300 text-xs transition-colors duration-200 font-sans"
            >
              <BackArrowIcon /> Dashboard
            </Link>
          </div>
        </aside>

        {/* ── Main Content ── */}
        <main
          className="flex-1 overflow-y-auto"
          style={{
            backgroundColor: pageBg,
            backgroundImage: 'radial-gradient(circle, rgba(0,102,255,0.045) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        >
          <div className="max-w-3xl mx-auto p-10">
            {children}
          </div>
        </main>
      </div>

      <AnimatePresence>
        {showEmail && <SupervisorEmail onClose={() => setShowEmail(false)} />}
      </AnimatePresence>
    </div>
  )
}
