import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useReveal, revealStyle, ArrowRightIcon } from './_shared'

const RADIUS = 26
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export default memo(function DashStatCards({ STUDENT, STEPS, navTarget = '/app' }) {
  const navigate = useNavigate()
  const activeStep = STEPS.find((s) => s.status === 'active')
  const [rowRef, rowVisible] = useReveal()

  const total = STUDENT.totalSteps
  const completed = STUDENT.stepsCompleted
  const pct = total > 0 ? completed / total : 0
  const dashoffset = CIRCUMFERENCE - pct * CIRCUMFERENCE

  return (
    <div
      ref={rowRef}
      style={revealStyle(rowVisible)}
      className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4 mb-5 md:mb-7 items-stretch"
    >
      <div
        style={{ background: 'var(--bg-card)' }}
        className="rounded-2xl border border-slate-800/80 p-5 md:p-8 flex flex-col sm:flex-row items-center gap-5 sm:gap-7"
      >
        <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 66, height: 66 }}>
          <svg
            width="66" height="66" viewBox="0 0 66 66" style={{ transform: 'rotate(-90deg)' }}
            role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={total}
            aria-label={`${completed} of ${total} steps completed`}
          >
            <circle cx="33" cy="33" r={RADIUS} fill="none" stroke="var(--border-color)" strokeWidth="7" />
            <circle cx="33" cy="33" r={RADIUS} fill="none" stroke="#0066FF" strokeWidth="7" strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={dashoffset} />
          </svg>
          <div className="absolute font-mono font-bold text-white" style={{ fontSize: '0.88rem' }}>{completed}/{total}</div>
        </div>

        <div className="flex-1 text-center sm:text-left">
          <div className="font-mono text-[0.64rem] tracking-[0.1em] uppercase mb-1.5 text-blue-400">
            {activeStep ? 'Current Step' : 'Status'}
          </div>
          <div className="font-serif text-[1.2rem] md:text-[1.3rem] leading-[1.25] mb-1.5 text-white">
            {activeStep?.name ?? 'All Steps Complete'}
          </div>
          <p className="font-sans text-[0.8rem] leading-[1.55] max-w-[48ch] mx-auto sm:mx-0 text-slate-500">
            {activeStep?.desc ?? 'Review your results or run the Defense Simulator again.'}
          </p>
        </div>

        <motion.button
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          onClick={() => { sessionStorage.setItem('intentional_app_entry', 'true'); navigate(navTarget) }}
          className="inline-flex items-center gap-2 px-6 py-3 bg-green-600 hover:bg-green-500 text-white border-0 rounded-xl font-sans text-[0.82rem] font-semibold cursor-pointer flex-shrink-0"
        >
          Continue <ArrowRightIcon />
        </motion.button>
      </div>

      <div
        style={{ background: 'var(--bg-card)' }}
        className="rounded-2xl border border-slate-800/80 p-5 md:p-7 flex flex-col gap-3"
      >
        <div className="font-mono text-[0.6rem] tracking-[0.1em] uppercase text-slate-600 mb-1">Project Details</div>
        {[
          { label: 'University', value: STUDENT.university || '—' },
          { label: 'Department', value: STUDENT.department || '—' },
          { label: 'Level', value: STUDENT.level || '—' },
        ].map(({ label, value }, i) => (
          <div key={label} className={`flex items-baseline justify-between gap-3 pt-3 ${i === 0 ? 'border-t-0 pt-0' : ''}`} style={i > 0 ? { borderTop: '1px solid var(--border-subtle)' } : undefined}>
            <span className="font-mono text-[0.6rem] tracking-[0.06em] uppercase text-slate-600 flex-shrink-0">{label}</span>
            <span className="font-sans text-[0.85rem] font-semibold text-white text-right">{value}</span>
          </div>
        ))}
      </div>
    </div>
  )
})
