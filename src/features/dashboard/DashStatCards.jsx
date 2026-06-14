import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useReveal, revealStyle, ShieldIcon, ArrowRightIcon, ProgressRing } from './_shared'

const cardEnter = {
  hidden: { opacity: 0, y: 18 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.12, duration: 0.5, ease: [0.22, 1, 0.36, 1] },
  }),
}

export default memo(function DashStatCards({ STUDENT, STEPS, navTarget = '/app' }) {
  const navigate = useNavigate()
  const activeStep = STEPS.find((s) => s.status === 'active')
  const [rowRef, rowVisible] = useReveal()

  return (
    <div ref={rowRef} style={revealStyle(rowVisible)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-5 mb-5 md:mb-7">

      {/* Card 1: Circular Progress */}
      <motion.div
        custom={0}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        whileHover={{ y: -5, boxShadow: '0 14px 40px rgba(0,0,0,0.45), 0 0 40px rgba(59,130,246,0.12)' }}
        className="rounded-2xl border border-slate-800/80 p-4 md:p-7 relative overflow-hidden flex flex-col sm:flex-row items-center gap-4 sm:gap-[22px] transition-shadow duration-200"
        style={{
          background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-input) 100%)',
          borderLeft: '4px solid #3B82F6',
          boxShadow: '0 8px 40px rgba(59,130,246,0.08)',
        }}
      >
        <span aria-hidden="true" className="absolute right-[-12px] top-[-18px] font-mono text-[130px] font-bold leading-none select-none pointer-events-none" style={{ color: 'rgba(59,130,246,0.04)' }}>
          ✦
        </span>
        <div className="db-progress-ring-wrapper">
          <ProgressRing completed={STUDENT.stepsCompleted} total={STUDENT.totalSteps} />
        </div>
        <div className="text-center sm:text-left">
          <div className="font-mono text-[0.6rem] tracking-[0.12em] uppercase text-blue-400 mb-2">Overall Progress</div>
          <div className="font-serif text-[1.25rem] md:text-[1.35rem] text-white leading-[1.2] mb-[7px]">
            {STUDENT.stepsCompleted} Steps<br />Completed
          </div>
          <div className="font-sans text-[0.73rem] text-slate-500 leading-[1.5]">
            {STUDENT.totalSteps - STUDENT.stepsCompleted} {STUDENT.totalSteps - STUDENT.stepsCompleted === 1 ? 'step' : 'steps'} remaining
          </div>
        </div>
      </motion.div>

      {/* Card 2: Current Step */}
      <motion.div
        custom={1}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        whileHover={{ y: -5, boxShadow: '0 14px 40px rgba(0,0,0,0.45), 0 0 32px rgba(22,163,74,0.14)' }}
        className="rounded-2xl border border-slate-800/80 p-4 md:p-7 relative overflow-hidden flex flex-col justify-between gap-3 md:gap-[18px] transition-shadow duration-200"
        style={{
          background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-green-mid) 60%, var(--bg-input) 100%)',
          borderLeft: '4px solid #16A34A',
          boxShadow: '0 8px 40px rgba(59,130,246,0.08)',
        }}
      >
        <span aria-hidden="true" className="absolute right-[-8px] bottom-[-20px] font-mono text-[110px] font-bold leading-none select-none pointer-events-none" style={{ color: 'rgba(22,163,74,0.05)' }}>
          {activeStep?.id}
        </span>
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
          aria-hidden="true"
          className="absolute top-0 bottom-0 w-[60%] pointer-events-none z-0"
          style={{ background: 'linear-gradient(90deg, transparent 0%, rgba(22,163,74,0.07) 50%, transparent 100%)' }}
        />
        <div className="relative z-10">
          <div className="font-mono text-[0.6rem] tracking-[0.12em] uppercase text-green-400 mb-2">
            {activeStep ? 'Current Step' : 'Status'}
          </div>
          <div className="font-serif text-[1.22rem] text-white leading-[1.25] mb-[9px]">
            {activeStep?.name ?? 'All Steps Complete'}
          </div>
          <p className="font-sans text-[0.73rem] text-slate-400 leading-[1.58] max-w-[38ch]">
            {activeStep?.desc ?? 'Review your results or run the Defense Simulator again.'}
          </p>
        </div>
        <motion.button
          whileHover={{ y: -1, boxShadow: '0 0 20px rgba(22,163,74,0.38)' }}
          whileTap={{ scale: 0.96 }}
          onClick={() => { sessionStorage.setItem('intentional_app_entry', 'true'); navigate(navTarget) }}
          className="inline-flex items-center gap-2 px-[22px] py-[11px] bg-green-600 hover:bg-green-500 text-white border-0 rounded-xl font-sans text-[0.82rem] font-semibold cursor-pointer self-start transition-all duration-200 relative z-10"
        >
          Continue <ArrowRightIcon />
        </motion.button>
      </motion.div>

      {/* Card 3: Project Info */}
      <motion.div
        custom={2}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        whileHover={{ y: -5, boxShadow: '0 14px 40px rgba(0,0,0,0.45), 0 0 40px rgba(59,130,246,0.1)' }}
        className="rounded-2xl border border-slate-800/80 p-4 md:p-7 relative overflow-hidden flex flex-col gap-3 md:gap-[14px] transition-shadow duration-200"
        style={{
          background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-input) 100%)',
          borderLeft: '4px solid #3B82F6',
          boxShadow: '0 8px 40px rgba(59,130,246,0.08)',
        }}
      >
        <div aria-hidden="true" className="absolute right-[-20px] bottom-[-20px] pointer-events-none select-none" style={{ opacity: 0.04 }}>
          <ShieldIcon size={180} color="#0066FF" />
        </div>
        <div className="font-mono text-[0.6rem] tracking-[0.12em] uppercase text-blue-400">Project Details</div>
        {[
          { label: 'University', value: STUDENT.university || '—' },
          { label: 'Department', value: STUDENT.department || '—' },
          { label: 'Academic Level', value: STUDENT.level || '—' },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="font-sans text-[0.62rem] font-medium uppercase tracking-[0.07em] text-slate-600 mb-[3px]">{label}</div>
            <div className="font-sans text-[0.83rem] font-semibold text-white leading-[1.3]">{value}</div>
          </div>
        ))}
      </motion.div>
    </div>
  )
})
