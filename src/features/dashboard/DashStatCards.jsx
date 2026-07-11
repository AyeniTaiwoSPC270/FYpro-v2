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
      style={{
        ...revealStyle(rowVisible),
        background: 'linear-gradient(160deg, #0066FF 0%, #0047B3 100%)',
        boxShadow: '0 16px 36px rgba(0,71,179,0.28)',
      }}
      className="rounded-2xl p-5 md:p-8 mb-5 md:mb-7 flex flex-col sm:flex-row items-center gap-5 sm:gap-7 text-white"
    >
      <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 66, height: 66 }}>
        <svg
          width="66" height="66" viewBox="0 0 66 66" style={{ transform: 'rotate(-90deg)' }}
          role="progressbar" aria-valuenow={completed} aria-valuemin={0} aria-valuemax={total}
          aria-label={`${completed} of ${total} steps completed`}
        >
          <circle cx="33" cy="33" r={RADIUS} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="7" />
          <circle cx="33" cy="33" r={RADIUS} fill="none" stroke="#fff" strokeWidth="7" strokeLinecap="round" strokeDasharray={CIRCUMFERENCE} strokeDashoffset={dashoffset} />
        </svg>
        <div className="absolute font-mono font-bold" style={{ fontSize: '0.88rem' }}>{completed}/{total}</div>
      </div>

      <div className="flex-1 text-center sm:text-left">
        <div className="font-mono text-[0.64rem] tracking-[0.1em] uppercase mb-1.5" style={{ color: 'rgba(255,255,255,0.72)' }}>
          {activeStep ? 'Current Step' : 'Status'}
        </div>
        <div className="font-serif text-[1.2rem] md:text-[1.3rem] leading-[1.25] mb-1.5">
          {activeStep?.name ?? 'All Steps Complete'}
        </div>
        <p className="font-sans text-[0.8rem] leading-[1.55] max-w-[48ch] mx-auto sm:mx-0" style={{ color: 'rgba(255,255,255,0.8)' }}>
          {activeStep?.desc ?? 'Review your results or run the Defense Simulator again.'}
        </p>
      </div>

      <motion.button
        whileHover={{ y: -1 }}
        whileTap={{ scale: 0.96 }}
        onClick={() => { sessionStorage.setItem('intentional_app_entry', 'true'); navigate(navTarget) }}
        className="inline-flex items-center gap-2 px-6 py-3 bg-white text-[#0066FF] border-0 rounded-xl font-sans text-[0.82rem] font-semibold cursor-pointer flex-shrink-0"
      >
        Continue <ArrowRightIcon />
      </motion.button>
    </div>
  )
})
