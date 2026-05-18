import { Fragment, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import { useReveal, revealStyle, slideLeftStyle, CheckIcon, LockIcon, ArrowRightIcon } from './_shared'

export default memo(function DashProgressJourney({ STEPS, STUDENT }) {
  const navigate = useNavigate()
  const { navigateStep, state } = useApp()

  const [sectionRef, sectionVisible] = useReveal()
  const [r0, v0] = useReveal()
  const [r1, v1] = useReveal()
  const [r2, v2] = useReveal()
  const [r3, v3] = useReveal()
  const [r4, v4] = useReveal()
  const [r5, v5] = useReveal()
  const stepReveals = [[r0, v0], [r1, v1], [r2, v2], [r3, v3], [r4, v4], [r5, v5]]

  return (
    <section
      ref={sectionRef}
      aria-labelledby="journey-heading"
      className="rounded-2xl border border-slate-800/80 p-8 mb-7"
      style={{
        ...revealStyle(sectionVisible),
        background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-input) 100%)',
        boxShadow: '0 8px 40px rgba(59,130,246,0.06)',
      }}
    >
      <div className="flex items-baseline justify-between mb-7">
        <div>
          <h2 id="journey-heading" className="font-serif text-[1.45rem] text-white leading-[1.2] mb-1">
            Your Research Journey
          </h2>
          <div className="font-sans text-[0.73rem] text-slate-500">Six steps from idea to defense-ready.</div>
        </div>
        <span
          className="font-mono text-[0.65rem] text-slate-600 px-3 py-1 rounded-full border border-slate-800"
          style={{ background: 'var(--badge-inactive-bg)' }}
        >
          {STUDENT.stepsCompleted} / {STUDENT.totalSteps}
        </span>
      </div>

      <div className="flex flex-col">
        {STEPS.map((step, i) => {
          const isCompleted = step.status === 'completed'
          const isActive    = step.status === 'active'
          const isLocked    = step.status === 'locked'
          const isLast      = i === STEPS.length - 1
          const [stepRef, stepVisible] = stepReveals[i] || [null, true]

          return (
            <Fragment key={step.id}>
              <div
                ref={stepRef}
                style={slideLeftStyle(stepVisible, i * 60)}
                className={`flex gap-5${isActive ? ' db-step-active-row' : ''}${isCompleted ? ' db-step-completed-row' : ''}`}
              >
                {/* Timeline column */}
                <div className="flex flex-col items-center w-11 flex-shrink-0">
                  <motion.div
                    whileHover={!isLocked ? { scale: 1.14 } : {}}
                    transition={{ duration: 0.2 }}
                    className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 font-mono text-[0.75rem] font-bold transition-all duration-300"
                    style={{
                      background: isCompleted ? '#16A34A' : isActive ? '#0066FF' : 'var(--border-color)',
                      boxShadow: isActive ? '0 0 22px rgba(0,102,255,0.32)' : isCompleted ? '0 0 22px rgba(22,163,74,0.45)' : 'none',
                      border: isActive ? '2px solid rgba(0,102,255,0.35)' : isLocked ? '1px solid var(--border-color)' : 'none',
                      color: isCompleted || isActive ? '#fff' : 'var(--badge-locked-text)',
                    }}
                  >
                    {isCompleted ? <CheckIcon size={15} /> : isLocked ? <LockIcon size={12} /> : step.id}
                  </motion.div>

                  {!isLast && (
                    <motion.div
                      initial={{ scaleY: 0 }}
                      animate={{ scaleY: 1 }}
                      transition={{ delay: 0.55 + i * 0.12, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
                      className="w-0.5 flex-1 min-h-6 mt-1 mb-1 rounded-[1px]"
                      style={{
                        background: isCompleted ? 'linear-gradient(to bottom, #16A34A, rgba(22,163,74,0.25))' : 'var(--border-subtle)',
                        transformOrigin: 'top',
                      }}
                    />
                  )}
                </div>

                {/* Content */}
                <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-[26px]'}`}>
                  <div className="flex items-center flex-wrap gap-2.5 mb-[7px] pt-2">
                    <span className={`font-sans text-[0.92rem] font-semibold ${isLocked ? 'text-slate-600' : 'text-white'}`}>
                      {step.name}
                    </span>
                    {isLocked && <span className="text-slate-700"><LockIcon size={13} /></span>}
                    {isActive ? (
                      <motion.span
                        animate={{ opacity: [1, 0.55, 1] }}
                        transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                        className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full text-blue-400"
                        style={{ background: 'rgba(0,102,255,0.12)' }}
                      >
                        In Progress
                      </motion.span>
                    ) : !isLocked ? (
                      <span className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full text-green-400" style={{ background: 'rgba(22,163,74,0.12)' }}>
                        Completed
                      </span>
                    ) : null}
                  </div>

                  <p className={`font-sans text-[0.77rem] leading-[1.62] max-w-[58ch] ${isLocked ? 'text-slate-700 mb-0' : 'text-slate-500 mb-[10px]'}`}>
                    {step.desc}
                  </p>

                  {/* Project Reviewer grade badge */}
                  {i === 4 && isCompleted && state.uploadedProject?.reviewData?.grade && (
                    <div className="flex items-center gap-2 mb-[14px]">
                      <span
                        className="font-mono text-[0.62rem] font-bold tracking-[0.08em] uppercase px-3 py-[4px] rounded-full"
                        style={{ background: 'rgba(22,163,74,0.12)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.25)' }}
                      >
                        Grade: {state.uploadedProject.reviewData.grade}
                      </span>
                    </div>
                  )}

                  {!isLocked && (
                    <motion.button
                      whileHover={{ y: -1, boxShadow: isActive ? '0 0 18px rgba(22,163,74,0.32)' : '0 4px 14px rgba(0,0,0,0.35)' }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => { sessionStorage.setItem('intentional_app_entry', 'true'); navigateStep(step.id - 1); navigate('/app') }}
                      className={`inline-flex items-center gap-[7px] px-[18px] py-2 rounded-lg font-sans text-[0.76rem] font-semibold cursor-pointer transition-all duration-200 ${
                        isActive
                          ? 'bg-green-600 hover:bg-green-500 text-white border-0'
                          : 'bg-transparent text-slate-400 hover:text-blue-400 border border-slate-700 hover:border-blue-500/60'
                      }`}
                    >
                      {isActive ? 'Continue' : 'Review'}
                      <ArrowRightIcon size={12} />
                    </motion.button>
                  )}
                </div>
              </div>

              {/* Companion card: Literature Map (after Chapter Architect) */}
              {i === 1 && state.stepsCompleted[1] && state.literatureMap && (
                <div className="flex gap-5">
                  <div className="flex flex-col items-center w-11 flex-shrink-0">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[0.8rem] font-bold" style={{ background: 'rgba(8,145,178,0.1)', border: '1.5px solid rgba(8,145,178,0.3)', color: '#0891B2' }}>⬦</div>
                    <div className="w-0.5 flex-1 min-h-6 mt-1 mb-1 rounded-[1px]" style={{ background: 'rgba(8,145,178,0.15)' }} />
                  </div>
                  <div className="flex-1 pb-[26px]">
                    <div className="flex items-center flex-wrap gap-2.5 mb-[7px] pt-2">
                      <span className="font-sans text-[0.92rem] font-semibold text-white">Literature Map</span>
                      <span className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full" style={{ background: 'rgba(8,145,178,0.12)', color: '#0891B2' }}>Companion Card</span>
                      <span className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full text-green-400" style={{ background: 'rgba(22,163,74,0.12)' }}>Completed</span>
                    </div>
                    <p className="font-sans text-[0.77rem] leading-[1.62] text-slate-500 mb-[14px] max-w-[58ch]">
                      Clustered your relevant literature into research themes with real academic papers.
                    </p>
                    <motion.button
                      whileHover={{ y: -1, boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => { sessionStorage.setItem('intentional_app_entry', 'true'); navigate('/app') }}
                      className="inline-flex items-center gap-[7px] px-[18px] py-2 rounded-lg font-sans text-[0.76rem] font-semibold cursor-pointer transition-all duration-200 bg-transparent border"
                      style={{ color: '#0891B2', borderColor: 'rgba(8,145,178,0.35)' }}
                    >
                      Review <ArrowRightIcon size={12} />
                    </motion.button>
                  </div>
                </div>
              )}

              {/* Companion card: Abstract Generator (after Chapter Architect) */}
              {i === 1 && state.stepsCompleted[1] && state.abstractData && (
                <div className="flex gap-5">
                  <div className="flex flex-col items-center w-11 flex-shrink-0">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[0.8rem] font-bold" style={{ background: 'rgba(8,145,178,0.1)', border: '1.5px solid rgba(8,145,178,0.3)', color: '#0891B2' }}>⬦</div>
                    <div className="w-0.5 flex-1 min-h-6 mt-1 mb-1 rounded-[1px]" style={{ background: 'rgba(8,145,178,0.15)' }} />
                  </div>
                  <div className="flex-1 pb-[26px]">
                    <div className="flex items-center flex-wrap gap-2.5 mb-[7px] pt-2">
                      <span className="font-sans text-[0.92rem] font-semibold text-white">Abstract Generator</span>
                      <span className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full" style={{ background: 'rgba(8,145,178,0.12)', color: '#0891B2' }}>Companion Card</span>
                      <span className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full text-green-400" style={{ background: 'rgba(22,163,74,0.12)' }}>Completed</span>
                    </div>
                    <p className="font-sans text-[0.77rem] leading-[1.62] text-slate-500 mb-[14px] max-w-[58ch]">
                      Generated a five-section abstract scaffold calibrated to your topic and chapter structure.
                    </p>
                    <motion.button
                      whileHover={{ y: -1, boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => { sessionStorage.setItem('intentional_app_entry', 'true'); navigate('/app') }}
                      className="inline-flex items-center gap-[7px] px-[18px] py-2 rounded-lg font-sans text-[0.76rem] font-semibold cursor-pointer transition-all duration-200 bg-transparent border"
                      style={{ color: '#0891B2', borderColor: 'rgba(8,145,178,0.35)' }}
                    >
                      Review <ArrowRightIcon size={12} />
                    </motion.button>
                  </div>
                </div>
              )}

              {/* Companion card: Instrument Builder (after Methodology Advisor) */}
              {i === 2 && state.stepsCompleted[2] && state.instrumentBuilder && (
                <div className="flex gap-5">
                  <div className="flex flex-col items-center w-11 flex-shrink-0">
                    <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[0.8rem] font-bold" style={{ background: 'rgba(8,145,178,0.1)', border: '1.5px solid rgba(8,145,178,0.3)', color: '#0891B2' }}>⬦</div>
                    <div className="w-0.5 flex-1 min-h-6 mt-1 mb-1 rounded-[1px]" style={{ background: 'rgba(8,145,178,0.15)' }} />
                  </div>
                  <div className="flex-1 pb-[26px]">
                    <div className="flex items-center flex-wrap gap-2.5 mb-[7px] pt-2">
                      <span className="font-sans text-[0.92rem] font-semibold text-white">Instrument Builder</span>
                      <span className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full" style={{ background: 'rgba(8,145,178,0.12)', color: '#0891B2' }}>Companion Card</span>
                      <span className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full text-green-400" style={{ background: 'rgba(22,163,74,0.12)' }}>Completed</span>
                    </div>
                    <p className="font-sans text-[0.77rem] leading-[1.62] text-slate-500 mb-[14px] max-w-[58ch]">
                      Built a tailored data collection instrument aligned to your methodology and research questions.
                    </p>
                    <motion.button
                      whileHover={{ y: -1, boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => { sessionStorage.setItem('intentional_app_entry', 'true'); navigate('/app') }}
                      className="inline-flex items-center gap-[7px] px-[18px] py-2 rounded-lg font-sans text-[0.76rem] font-semibold cursor-pointer transition-all duration-200 bg-transparent border"
                      style={{ color: '#0891B2', borderColor: 'rgba(8,145,178,0.35)' }}
                    >
                      Review <ArrowRightIcon size={12} />
                    </motion.button>
                  </div>
                </div>
              )}

              {/* Bonus card: Supervisor Meeting Prep (after Writing Planner) */}
              {i === 3 && state.stepsCompleted[3] && (
                <div className="flex gap-5">
                  <div className="flex flex-col items-center w-11 flex-shrink-0">
                    <div
                      className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[0.8rem] font-bold"
                      style={{ background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}
                    >
                      +
                    </div>
                    <div className="w-0.5 flex-1 min-h-6 mt-1 mb-1 rounded-[1px]" style={{ background: 'rgba(245,158,11,0.15)' }} />
                  </div>
                  <div className="flex-1 pb-[26px]">
                    <div className="flex items-center flex-wrap gap-2.5 mb-[7px] pt-2">
                      <span className="font-sans text-[0.92rem] font-semibold text-white">Supervisor Meeting Prep</span>
                      <span className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>
                        Bonus Tool
                      </span>
                    </div>
                    <p className="font-sans text-[0.77rem] leading-[1.62] text-slate-500 mb-[14px] max-w-[58ch]">
                      Generate 8 specific questions to ask your supervisor at your next meeting — tailored to your project stage and blockers.
                    </p>
                    <motion.button
                      whileHover={{ y: -1, boxShadow: '0 4px 14px rgba(0,0,0,0.35)' }}
                      whileTap={{ scale: 0.96 }}
                      onClick={() => navigate('/supervisor-prep')}
                      className="inline-flex items-center gap-[7px] px-[18px] py-2 rounded-lg font-sans text-[0.76rem] font-semibold cursor-pointer transition-all duration-200 bg-transparent border"
                      style={{ color: '#F59E0B', borderColor: 'rgba(245,158,11,0.35)' }}
                    >
                      Prep for Meeting <ArrowRightIcon size={12} />
                    </motion.button>
                  </div>
                </div>
              )}
            </Fragment>
          )
        })}
      </div>
    </section>
  )
})
