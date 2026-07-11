import { Fragment, memo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import { useReveal, revealStyle, CheckIcon, LockIcon, ArrowRightIcon } from './_shared'

function StepRow({ step, isCompleted, isActive, isLocked, isLast, navTarget, onOpen, extra }) {
  return (
    <div className={`flex gap-5${isActive ? ' db-step-active-row' : ''}${isCompleted ? ' db-step-completed-row' : ''}`}>
      <div className="flex flex-col items-center w-11 flex-shrink-0">
        <div
          className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 font-mono text-[0.75rem] font-bold"
          style={{
            background: isCompleted ? '#16A34A' : isActive ? '#0066FF' : 'var(--border-color)',
            border: isActive ? '2px solid rgba(0,102,255,0.35)' : isLocked ? '1px solid var(--border-color)' : 'none',
            color: isCompleted || isActive ? '#fff' : 'var(--badge-locked-text)',
          }}
        >
          {isCompleted ? <CheckIcon size={15} /> : isLocked ? <LockIcon size={12} /> : step.id}
        </div>
        {!isLast && (
          <div
            className="w-0.5 flex-1 min-h-6 mt-1 mb-1 rounded-[1px]"
            style={{ background: isCompleted ? 'linear-gradient(to bottom, #16A34A, rgba(22,163,74,0.25))' : 'var(--border-subtle)' }}
          />
        )}
      </div>

      <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-[26px]'}`}>
        <div className="flex items-center flex-wrap gap-2.5 mb-[7px] pt-2">
          <span className={`font-sans text-[0.92rem] font-semibold ${isLocked ? 'text-slate-600' : 'text-white'}`}>
            {step.name}
          </span>
          {isLocked && <span className="text-slate-700"><LockIcon size={13} /></span>}
          {isActive ? (
            <span className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full text-blue-400" style={{ background: 'rgba(0,102,255,0.12)' }}>
              In Progress
            </span>
          ) : !isLocked ? (
            <span className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full text-green-400" style={{ background: 'rgba(22,163,74,0.12)' }}>
              Completed
            </span>
          ) : null}
        </div>

        {!isLocked && (
          <p className="font-sans text-[0.77rem] leading-[1.62] max-w-[58ch] text-slate-500 mb-[10px]">
            {step.desc}
          </p>
        )}

        {extra}

        {!isLocked && (
          <motion.button
            whileHover={{ y: -1 }}
            whileTap={{ scale: 0.96 }}
            onClick={() => onOpen(step, navTarget)}
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
  )
}

function CompanionRow({ title, badgeLabel, desc, isLast, onOpen }) {
  return (
    <div className="flex gap-5">
      <div className="flex flex-col items-center w-11 flex-shrink-0">
        <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[0.8rem] font-bold" style={{ background: 'rgba(8,145,178,0.1)', border: '1.5px solid rgba(8,145,178,0.3)', color: '#0891B2' }}>⬦</div>
        {!isLast && <div className="w-0.5 flex-1 min-h-6 mt-1 mb-1 rounded-[1px]" style={{ background: 'rgba(8,145,178,0.15)' }} />}
      </div>
      <div className="flex-1 pb-[26px]">
        <div className="flex items-center flex-wrap gap-2.5 mb-[7px] pt-2">
          <span className="font-sans text-[0.92rem] font-semibold text-white">{title}</span>
          <span className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full" style={{ background: 'rgba(8,145,178,0.12)', color: '#0891B2' }}>{badgeLabel}</span>
          <span className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full text-green-400" style={{ background: 'rgba(22,163,74,0.12)' }}>Completed</span>
        </div>
        <p className="font-sans text-[0.77rem] leading-[1.62] text-slate-500 mb-[14px] max-w-[58ch]">{desc}</p>
        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={onOpen}
          className="inline-flex items-center gap-[7px] px-[18px] py-2 rounded-lg font-sans text-[0.76rem] font-semibold cursor-pointer transition-all duration-200 bg-transparent border"
          style={{ color: '#0891B2', borderColor: 'rgba(8,145,178,0.35)' }}
        >
          Review <ArrowRightIcon size={12} />
        </motion.button>
      </div>
    </div>
  )
}

export default memo(function DashProgressJourney({ STEPS, STUDENT, navTarget = '/app' }) {
  const navigate = useNavigate()
  const { navigateStep, state } = useApp()
  const [sectionRef, sectionVisible] = useReveal()
  const [expanded, setExpanded] = useState(false)

  const activeStep = STEPS.find((s) => s.status === 'active')
  const lockedSteps = STEPS.filter((s) => s.status === 'locked')

  function openStep(step) {
    sessionStorage.setItem('intentional_app_entry', 'true')
    navigateStep(step.id - 1)
    navigate(navTarget)
  }
  function openCompanion() {
    sessionStorage.setItem('intentional_app_entry', 'true')
    navigate('/app')
  }

  // Completed steps + their companion/bonus cards, collapsed into one summary line by default.
  const chips = []
  STEPS.forEach((step, i) => {
    if (step.status !== 'completed') return
    chips.push(step.name)
    if (i === 1) {
      if (state.literatureMap) chips.push('Literature Map')
      if (state.abstractData) chips.push('Abstract Generator')
    }
    if (i === 2 && state.instrumentBuilder) chips.push('Instrument Builder')
    if (i === 3) chips.push('Supervisor Meeting Prep')
    if (i === 4 && state.uploadedProject?.reviewData?.grade) chips.push(`Project Reviewer (Grade: ${state.uploadedProject.reviewData.grade})`)
  })

  return (
    <section
      ref={sectionRef}
      aria-labelledby="journey-heading"
      className="rounded-2xl border border-slate-800/80 p-4 sm:p-6 md:p-8 mb-5 md:mb-7"
      style={{ ...revealStyle(sectionVisible), background: 'var(--bg-card)' }}
    >
      <div className="flex items-start justify-between flex-wrap gap-2 mb-4 md:mb-7">
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

      {!expanded ? (
        <>
          {chips.length > 0 && (
            <div
              className="flex items-center gap-2.5 flex-wrap px-4 py-3 rounded-lg mb-5 text-[0.8rem]"
              style={{ background: 'rgba(22,163,74,0.06)', border: '1px solid rgba(22,163,74,0.2)' }}
            >
              <span className="font-sans font-semibold text-green-400">{chips.length} step{chips.length === 1 ? '' : 's'} completed.</span>
              {chips.map((label) => (
                <span key={label} className="font-mono text-[0.6rem] text-slate-400 px-2 py-[3px] rounded-full" style={{ background: 'rgba(255,255,255,0.05)' }}>{label}</span>
              ))}
              <button
                onClick={() => setExpanded(true)}
                className="ml-auto font-sans text-[0.76rem] font-semibold text-blue-400 bg-transparent border-0 cursor-pointer"
              >
                Show details ↓
              </button>
            </div>
          )}

          <div className="flex flex-col">
            {activeStep && (
              <StepRow step={activeStep} isCompleted={false} isActive={true} isLocked={false} isLast={lockedSteps.length === 0} navTarget={navTarget} onOpen={openStep} />
            )}
            {lockedSteps.map((step, i) => (
              <div key={step.id} className="flex gap-5">
                <div className="flex flex-col items-center w-11 flex-shrink-0">
                  <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[0.75rem] font-bold" style={{ background: 'var(--border-color)', border: '1px solid var(--border-color)', color: 'var(--badge-locked-text)' }}>
                    <LockIcon size={12} />
                  </div>
                  {i < lockedSteps.length - 1 && <div className="w-0.5 flex-1 min-h-6 mt-1 mb-1 rounded-[1px]" style={{ background: 'var(--border-subtle)' }} />}
                </div>
                <div className={`flex-1 flex items-center ${i === lockedSteps.length - 1 ? 'pb-0' : 'pb-[26px]'}`}>
                  <span className="font-sans text-[0.88rem] font-medium text-slate-600 flex items-center gap-2">
                    {step.name} <LockIcon size={12} />
                  </span>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          <button
            onClick={() => setExpanded(false)}
            className="mb-4 font-sans text-[0.76rem] font-semibold text-blue-400 bg-transparent border-0 cursor-pointer"
          >
            Hide details ↑
          </button>
          <div className="flex flex-col">
            {STEPS.map((step, i) => {
              const isCompleted = step.status === 'completed'
              const isActive = step.status === 'active'
              const isLocked = step.status === 'locked'
              const isLast = i === STEPS.length - 1

              return (
                <Fragment key={step.id}>
                  <StepRow
                    step={step} isCompleted={isCompleted} isActive={isActive} isLocked={isLocked} isLast={isLast}
                    navTarget={navTarget} onOpen={openStep}
                    extra={i === 4 && isCompleted && state.uploadedProject?.reviewData?.grade ? (
                      <div className="flex items-center gap-2 mb-[14px]">
                        <span
                          className="font-mono text-[0.62rem] font-bold tracking-[0.08em] uppercase px-3 py-[4px] rounded-full"
                          style={{ background: 'rgba(22,163,74,0.12)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.25)' }}
                        >
                          Grade: {state.uploadedProject.reviewData.grade}
                        </span>
                      </div>
                    ) : null}
                  />

                  {i === 1 && state.stepsCompleted[1] && state.literatureMap && (
                    <CompanionRow title="Literature Map" badgeLabel="Companion Card" desc="Clustered your relevant literature into research themes with real academic papers." onOpen={openCompanion} />
                  )}
                  {i === 1 && state.stepsCompleted[1] && state.abstractData && (
                    <CompanionRow title="Abstract Generator" badgeLabel="Companion Card" desc="Generated a five-section abstract scaffold calibrated to your topic and chapter structure." onOpen={openCompanion} />
                  )}
                  {i === 2 && state.stepsCompleted[2] && state.instrumentBuilder && (
                    <CompanionRow title="Instrument Builder" badgeLabel="Companion Card" desc="Built a tailored data collection instrument aligned to your methodology and research questions." onOpen={openCompanion} />
                  )}
                  {i === 3 && state.stepsCompleted[3] && (
                    <div className="flex gap-5">
                      <div className="flex flex-col items-center w-11 flex-shrink-0">
                        <div className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[0.8rem] font-bold" style={{ background: 'rgba(245,158,11,0.1)', border: '1.5px solid rgba(245,158,11,0.3)', color: '#F59E0B' }}>+</div>
                        <div className="w-0.5 flex-1 min-h-6 mt-1 mb-1 rounded-[1px]" style={{ background: 'rgba(245,158,11,0.15)' }} />
                      </div>
                      <div className="flex-1 pb-[26px]">
                        <div className="flex items-center flex-wrap gap-2.5 mb-[7px] pt-2">
                          <span className="font-sans text-[0.92rem] font-semibold text-white">Supervisor Meeting Prep</span>
                          <span className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full" style={{ background: 'rgba(245,158,11,0.12)', color: '#F59E0B' }}>Bonus Tool</span>
                        </div>
                        <p className="font-sans text-[0.77rem] leading-[1.62] text-slate-500 mb-[14px] max-w-[58ch]">
                          Generate 8 specific questions to ask your supervisor at your next meeting — tailored to your project stage and blockers.
                        </p>
                        <motion.button
                          whileHover={{ y: -1 }}
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
        </>
      )}
    </section>
  )
})
