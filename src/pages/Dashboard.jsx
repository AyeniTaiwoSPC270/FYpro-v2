import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { useApp } from '../context/AppContext'

const STEP_DEFS = [
  { id: 1, name: 'Topic Validator',    desc: 'Validated your research topic for feasibility, scope, and originality against your department and level.',              path: '/workflow/topic-validator' },
  { id: 2, name: 'Chapter Architect',  desc: 'Generated a complete five-chapter breakdown with section headings, key literature, and a visual literature map.',        path: '/workflow/chapter-architect' },
  { id: 3, name: 'Methodology Advisor',desc: 'Selected research design, sampling strategy, and data approach — all justified for Chapter 3.',                          path: '/workflow/methodology-advisor' },
  { id: 4, name: 'Instrument Builder', desc: 'Build your data collection tools — questionnaire, interview guide, or observation checklist — ready for field work.',    path: '/workflow/instrument-builder' },
  { id: 5, name: 'Writing Planner',    desc: 'Get a week-by-week writing schedule calculated from your submission deadline with buffer weeks and word targets.',        path: '/workflow/writing-planner' },
  { id: 6, name: 'Defense Simulator',  desc: 'Face three AI examiners in a full panel simulation. Receive a readiness score and know every question before the real thing.', path: '/workflow/defense-simulator' },
]

function buildSteps(stepsCompleted, currentStep) {
  return STEP_DEFS.map((def, i) => ({
    ...def,
    status: stepsCompleted[i] ? 'completed' : currentStep === def.id ? 'active' : 'locked',
  }))
}

// ─── Inline SVG Icons ─────────────────────────────────────────────────────────

const SHIELD_D =
  'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

const ShieldIcon = ({ size = 22, color = '#0066FF' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={size} height={size} fill={color} aria-hidden="true">
    <path d={SHIELD_D} />
  </svg>
)

const BellIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

const GearIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.07 4.93A10 10 0 0 1 21 12a10 10 0 0 1-1.93 5.07M4.93 4.93A10 10 0 0 0 3 12a10 10 0 0 0 1.93 5.07" />
  </svg>
)

const CheckIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

const LockIcon = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

const ArrowRightIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

const ZapIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
  </svg>
)

// ─── Animated Progress Ring ───────────────────────────────────────────────────

function ProgressRing({ completed, total }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const targetPct = completed / total

  const progressValue = useMotionValue(0)
  const strokeDashoffset = useTransform(
    progressValue,
    (v) => circumference - v * circumference
  )

  useEffect(() => {
    const anim = animate(progressValue, targetPct, {
      duration: 1.2,
      ease: [0.43, 0.13, 0.23, 0.96],
    })
    return () => anim.stop()
  }, [targetPct, progressValue])

  return (
    <div
      className="relative flex items-center justify-center flex-shrink-0"
      style={{ width: 136, height: 136 }}
    >
      <svg
        width="136"
        height="136"
        viewBox="0 0 136 136"
        style={{ transform: 'rotate(-90deg)' }}
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${completed} of ${total} steps completed`}
      >
        <circle
          cx="68" cy="68" r={radius}
          fill="transparent"
          stroke="rgba(0,102,255,0.12)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        <motion.circle
          cx="68" cy="68" r={radius}
          fill="transparent"
          stroke="#0066FF"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span
          className="font-mono font-bold leading-none text-white"
          style={{ fontSize: '1.9rem' }}
        >
          {completed}
        </span>
        <span
          className="font-mono text-slate-600 mt-[3px]"
          style={{ fontSize: '0.62rem' }}
        >
          of {total}
        </span>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function DashSidebar({ STUDENT, STEPS, onNewSession }) {
  return (
    <aside
      className="flex flex-col flex-shrink-0 border-r border-slate-800/60"
      style={{
        width: 260,
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #070C18 0%, #050A13 100%)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-slate-800/60 px-[22px] py-[26px]">
        <ShieldIcon size={28} />
        <span className="font-serif text-[1.45rem] text-white leading-none">
          FY<span style={{ color: '#0066FF' }}>Pro</span>
        </span>
      </div>

      {/* Navigation label */}
      <div className="px-5 pt-5 pb-2.5 font-mono text-[0.58rem] tracking-[0.14em] uppercase text-slate-600">
        Research Steps
      </div>

      {/* Step list */}
      <nav className="flex-1 pb-4">
        {STEPS.map((step, i) => {
          const isCompleted = step.status === 'completed'
          const isActive    = step.status === 'active'
          const isLocked    = step.status === 'locked'

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: i * 0.06 + 0.08,
                duration: 0.38,
                ease: [0.22, 1, 0.36, 1],
              }}
              role="button"
              tabIndex={isLocked ? -1 : 0}
              aria-disabled={isLocked}
              className={`flex items-center gap-[11px] pr-4 py-[10px] mb-0.5 outline-none transition-all duration-200 ${
                isActive
                  ? 'bg-blue-600/20 border-l-4 border-l-blue-500 pl-3'
                  : 'border-l-4 border-l-transparent pl-3'
              } ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Step badge */}
              <div
                className={`w-[27px] h-[27px] rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[0.62rem] font-bold ${
                  isCompleted
                    ? 'bg-green-600 text-white'
                    : isActive
                    ? 'text-white'
                    : 'text-slate-500'
                }`}
                style={
                  isActive
                    ? { background: '#0066FF' }
                    : !isCompleted
                    ? { background: 'rgba(255,255,255,0.07)', border: '1.5px solid rgba(255,255,255,0.12)' }
                    : {}
                }
              >
                {isCompleted ? (
                  <motion.span
                    initial={{ scale: 0, rotate: -15 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{
                      type: 'spring',
                      stiffness: 420,
                      delay: i * 0.06 + 0.25,
                    }}
                  >
                    <CheckIcon size={12} />
                  </motion.span>
                ) : isLocked ? (
                  <LockIcon size={10} />
                ) : (
                  step.id
                )}
              </div>

              {/* Step name */}
              <span
                className={`font-sans text-[0.78rem] flex-1 leading-[1.3] ${
                  isCompleted
                    ? 'text-blue-400 font-medium'
                    : isActive
                    ? 'text-white font-semibold'
                    : 'text-slate-500 font-medium'
                }`}
              >
                {step.name}
              </span>

              {/* Active pulse dot */}
              {isActive && (
                <motion.span
                  animate={{
                    opacity: [1, 0.35, 1],
                    boxShadow: [
                      '0 0 8px rgba(0,102,255,0.9)',
                      '0 0 2px rgba(0,102,255,0.15)',
                      '0 0 8px rgba(0,102,255,0.9)',
                    ],
                  }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: '#0066FF' }}
                />
              )}
            </motion.div>
          )
        })}
      </nav>

      {/* Student context card */}
      <div
        className="mx-3.5 mb-6 p-4 rounded-xl"
        style={{
          background: '#0D1425',
          border: '1px solid rgba(255,255,255,0.07)',
          borderLeft: '3px solid rgba(0,102,255,0.5)',
        }}
      >
        <div className="font-mono text-[0.56rem] tracking-[0.12em] uppercase text-blue-400 mb-2">
          Active Project
        </div>
        <div className="font-sans text-[0.74rem] font-semibold text-white mb-[3px] leading-[1.3]">
          {STUDENT.university}
        </div>
        <div className="font-sans text-[0.68rem] text-slate-500 mb-1.5">
          {STUDENT.department}
        </div>
        <div
          className="inline-block font-mono text-[0.58rem] text-slate-600 px-2 py-[2px] rounded-full"
          style={{ background: 'rgba(255,255,255,0.06)' }}
        >
          {STUDENT.level}
        </div>
      </div>
    </aside>
  )
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function DashTopBar({ STUDENT, onNewSession }) {
  const navigate = useNavigate()
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = STUDENT.name.split(' ')[0]

  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarRef = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) {
        setAvatarOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <header
      className="h-[68px] flex items-center justify-between px-8 sticky top-0 z-20 flex-shrink-0 relative border-b border-slate-800/60"
      style={{ background: '#070C18' }}
    >
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div className="font-serif text-[1.18rem] text-white leading-[1.15]">
          {greeting}, {firstName}
        </div>
        <div className="font-sans text-[0.72rem] text-slate-500 mt-0.5">
          {STUDENT.stepsCompleted} steps done — Step {STUDENT.currentStepId} is waiting.
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-2.5"
      >
        {/* New Project */}
        <motion.button
          whileHover={{ y: -1, boxShadow: '0 0 22px rgba(59,130,246,0.4)' }}
          whileTap={{ scale: 0.96 }}
          aria-label="Start a new project"
          onClick={onNewSession}
          className="flex items-center gap-1.5 px-[18px] py-[9px] bg-blue-600 hover:bg-blue-500 text-white border-0 rounded-xl font-sans text-[0.8rem] font-semibold cursor-pointer transition-all duration-200"
        >
          <PlusIcon /> New Session
        </motion.button>

        {/* Bell */}
        <motion.button
          whileHover={{ scale: 1.09 }}
          whileTap={{ scale: 0.94 }}
          aria-label="Notifications"
          className="relative w-[38px] h-[38px] flex items-center justify-center rounded-xl cursor-pointer text-slate-400 hover:text-white transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <BellIcon />
          <span
            aria-hidden="true"
            className="absolute top-[9px] right-[9px] w-[7px] h-[7px] rounded-full"
            style={{ background: '#0066FF', border: '1.5px solid #070C18' }}
          />
        </motion.button>

        {/* Settings */}
        <motion.button
          whileHover={{ scale: 1.09 }}
          whileTap={{ scale: 0.94 }}
          aria-label="Settings"
          onClick={() => navigate('/settings')}
          className="w-[38px] h-[38px] flex items-center justify-center rounded-xl cursor-pointer text-slate-400 hover:text-white transition-all duration-200"
          style={{
            background: 'rgba(255,255,255,0.04)',
            border: '1px solid rgba(255,255,255,0.1)',
          }}
        >
          <GearIcon />
        </motion.button>

        {/* Avatar + dropdown */}
        <div className="relative" ref={avatarRef}>
          <motion.button
            whileHover={{ scale: 1.07, boxShadow: '0 0 18px rgba(0,102,255,0.3)' }}
            aria-label={`Profile: ${STUDENT.name}`}
            aria-expanded={avatarOpen}
            onClick={() => setAvatarOpen((v) => !v)}
            className="w-[38px] h-[38px] rounded-full flex items-center justify-center font-mono text-[0.68rem] font-bold text-white cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #0066FF 0%, #3B82F6 100%)',
              border: '2px solid rgba(0,102,255,0.35)',
            }}
          >
            {STUDENT.initials}
          </motion.button>

          <AnimatePresence>
            {avatarOpen && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute right-0 mt-2 w-48 rounded-xl overflow-hidden"
                style={{
                  top: '100%',
                  background: '#0D1425',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                }}
              >
                <div className="px-4 py-3 border-b border-slate-800/80">
                  <div className="font-sans text-[0.8rem] font-semibold text-white truncate">{STUDENT.name}</div>
                  <div className="font-mono text-[0.65rem] text-slate-500 mt-0.5">Free Plan</div>
                </div>
                <div className="py-1.5">
                  <Link
                    to="/profile"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 no-underline hover:bg-white/5 transition-colors duration-150"
                  >
                    <span className="font-sans text-[0.82rem] text-slate-300">Profile</span>
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setAvatarOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 no-underline hover:bg-white/5 transition-colors duration-150"
                  >
                    <span className="font-sans text-[0.82rem] text-slate-300">Settings</span>
                  </Link>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>

      {/* Gradient border bottom */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 h-px pointer-events-none"
        style={{
          background:
            'linear-gradient(to right, transparent 0%, rgba(0,102,255,0.18) 20%, rgba(0,102,255,0.45) 50%, rgba(0,102,255,0.18) 80%, transparent 100%)',
        }}
      />
    </header>
  )
}

// ─── Stat Cards Row ───────────────────────────────────────────────────────────

const cardEnter = {
  hidden: { opacity: 0, y: 18 },
  visible: (i) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.12,
      duration: 0.5,
      ease: [0.22, 1, 0.36, 1],
    },
  }),
}

function DashStatCards({ STUDENT, STEPS }) {
  const navigate  = useNavigate()
  const activeStep = STEPS.find((s) => s.status === 'active')

  return (
    <div className="grid grid-cols-3 gap-5 mb-7">

      {/* ── Card 1: Circular Progress ── */}
      <motion.div
        custom={0}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        whileHover={{
          y: -5,
          boxShadow: '0 14px 40px rgba(0,0,0,0.45), 0 0 40px rgba(59,130,246,0.12)',
        }}
        className="rounded-2xl border border-slate-800/80 p-7 relative overflow-hidden flex items-center gap-[22px] transition-shadow duration-200"
        style={{
          background: 'linear-gradient(145deg, #0D1425 0%, #111827 100%)',
          borderLeft: '4px solid #3B82F6',
          boxShadow: '0 8px 40px rgba(59,130,246,0.08)',
        }}
      >
        {/* Watermark */}
        <span
          aria-hidden="true"
          className="absolute right-[-12px] top-[-18px] font-mono text-[130px] font-bold leading-none select-none pointer-events-none"
          style={{ color: 'rgba(59,130,246,0.04)' }}
        >
          ✦
        </span>

        <ProgressRing
          completed={STUDENT.stepsCompleted}
          total={STUDENT.totalSteps}
        />

        <div>
          <div className="font-mono text-[0.6rem] tracking-[0.12em] uppercase text-blue-400 mb-2">
            Overall Progress
          </div>
          <div className="font-serif text-[1.35rem] text-white leading-[1.2] mb-[7px]">
            {STUDENT.stepsCompleted} Steps
            <br />
            Completed
          </div>
          <div className="font-sans text-[0.73rem] text-slate-500 leading-[1.5]">
            {STUDENT.totalSteps - STUDENT.stepsCompleted} steps remaining
          </div>
        </div>
      </motion.div>

      {/* ── Card 2: Current Step ── */}
      <motion.div
        custom={1}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        whileHover={{
          y: -5,
          boxShadow: '0 14px 40px rgba(0,0,0,0.45), 0 0 32px rgba(22,163,74,0.14)',
        }}
        className="rounded-2xl border border-slate-800/80 p-7 relative overflow-hidden flex flex-col justify-between gap-[18px] transition-shadow duration-200"
        style={{
          background: 'linear-gradient(145deg, #0D1425 0%, #0B1E10 60%, #111827 100%)',
          borderLeft: '4px solid #16A34A',
          boxShadow: '0 8px 40px rgba(59,130,246,0.08)',
        }}
      >
        {/* Step watermark digit */}
        <span
          aria-hidden="true"
          className="absolute right-[-8px] bottom-[-20px] font-mono text-[110px] font-bold leading-none select-none pointer-events-none"
          style={{ color: 'rgba(22,163,74,0.05)' }}
        >
          {activeStep?.id}
        </span>

        {/* Shimmer sweep */}
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
          aria-hidden="true"
          className="absolute top-0 bottom-0 w-[60%] pointer-events-none z-0"
          style={{
            background:
              'linear-gradient(90deg, transparent 0%, rgba(22,163,74,0.07) 50%, transparent 100%)',
          }}
        />

        <div className="relative z-10">
          <div className="font-mono text-[0.6rem] tracking-[0.12em] uppercase text-green-400 mb-2">
            Current Step
          </div>
          <div className="font-serif text-[1.22rem] text-white leading-[1.25] mb-[9px]">
            {activeStep?.name}
          </div>
          <p className="font-sans text-[0.73rem] text-slate-400 leading-[1.58] max-w-[38ch]">
            {activeStep?.desc}
          </p>
        </div>

        <motion.button
          whileHover={{ y: -1, boxShadow: '0 0 20px rgba(22,163,74,0.38)' }}
          whileTap={{ scale: 0.96 }}
          onClick={() => navigate('/app')}
          className="inline-flex items-center gap-2 px-[22px] py-[11px] bg-green-600 hover:bg-green-500 text-white border-0 rounded-xl font-sans text-[0.82rem] font-semibold cursor-pointer self-start transition-all duration-200 relative z-10"
        >
          Continue <ArrowRightIcon />
        </motion.button>
      </motion.div>

      {/* ── Card 3: Project Info ── */}
      <motion.div
        custom={2}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        whileHover={{
          y: -5,
          boxShadow: '0 14px 40px rgba(0,0,0,0.45), 0 0 40px rgba(59,130,246,0.1)',
        }}
        className="rounded-2xl border border-slate-800/80 p-7 relative overflow-hidden flex flex-col gap-[14px] transition-shadow duration-200"
        style={{
          background: 'linear-gradient(145deg, #0D1425 0%, #111827 100%)',
          borderLeft: '4px solid #3B82F6',
          boxShadow: '0 8px 40px rgba(59,130,246,0.08)',
        }}
      >
        {/* FYPro shield watermark */}
        <div
          aria-hidden="true"
          className="absolute right-[-20px] bottom-[-20px] pointer-events-none select-none"
          style={{ opacity: 0.04 }}
        >
          <ShieldIcon size={180} color="#0066FF" />
        </div>

        <div className="font-mono text-[0.6rem] tracking-[0.12em] uppercase text-blue-400">
          Project Details
        </div>

        {[
          { label: 'University', value: STUDENT.university },
          { label: 'Department', value: STUDENT.department },
          { label: 'Academic Level', value: STUDENT.level },
        ].map(({ label, value }) => (
          <div key={label}>
            <div className="font-sans text-[0.62rem] font-medium uppercase tracking-[0.07em] text-slate-600 mb-[3px]">
              {label}
            </div>
            <div className="font-sans text-[0.83rem] font-semibold text-white leading-[1.3]">
              {value}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

// ─── Progress Journey ─────────────────────────────────────────────────────────

const STEP_PATHS = {
  1: '/workflow/topic-validator',
  2: '/workflow/chapter-architect',
  3: '/workflow/methodology-advisor',
  4: '/workflow/instrument-builder',
  5: '/workflow/writing-planner',
  6: '/workflow/defense-simulator',
}

function DashProgressJourney({ STEPS, STUDENT }) {
  const navigate = useNavigate()
  const { navigateStep } = useApp()
  return (
    <motion.section
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.38, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="journey-heading"
      className="rounded-2xl border border-slate-800/80 p-8 mb-7"
      style={{
        background: 'linear-gradient(145deg, #0D1425 0%, #111827 100%)',
        boxShadow: '0 8px 40px rgba(59,130,246,0.06)',
      }}
    >
      {/* Section header */}
      <div className="flex items-baseline justify-between mb-7">
        <div>
          <h2
            id="journey-heading"
            className="font-serif text-[1.45rem] text-white leading-[1.2] mb-1"
          >
            Your Research Journey
          </h2>
          <div className="font-sans text-[0.73rem] text-slate-500">
            Six steps from idea to defense-ready.
          </div>
        </div>
        <span
          className="font-mono text-[0.65rem] text-slate-600 px-3 py-1 rounded-full border border-slate-800"
          style={{ background: 'rgba(255,255,255,0.03)' }}
        >
          {STUDENT.stepsCompleted} / {STUDENT.totalSteps}
        </span>
      </div>

      {/* Step items */}
      <div className="flex flex-col">
        {STEPS.map((step, i) => {
          const isCompleted = step.status === 'completed'
          const isActive    = step.status === 'active'
          const isLocked    = step.status === 'locked'
          const isLast      = i === STEPS.length - 1

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{
                delay: 0.45 + i * 0.07,
                duration: 0.42,
                ease: [0.22, 1, 0.36, 1],
              }}
              className="flex gap-5"
            >
              {/* Timeline column */}
              <div className="flex flex-col items-center w-11 flex-shrink-0">
                {/* Badge */}
                <motion.div
                  whileHover={!isLocked ? { scale: 1.14 } : {}}
                  transition={{ duration: 0.2 }}
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 font-mono text-[0.75rem] font-bold transition-all duration-300"
                  style={{
                    background: isCompleted
                      ? '#16A34A'
                      : isActive
                      ? '#0066FF'
                      : 'rgba(255,255,255,0.05)',
                    boxShadow: isActive
                      ? '0 0 22px rgba(0,102,255,0.32)'
                      : isCompleted
                      ? '0 0 22px rgba(22,163,74,0.45)'
                      : 'none',
                    border: isActive
                      ? '2px solid rgba(0,102,255,0.35)'
                      : isLocked
                      ? '1.5px solid rgba(255,255,255,0.1)'
                      : 'none',
                    color:
                      isCompleted || isActive
                        ? '#fff'
                        : 'rgba(255,255,255,0.25)',
                  }}
                >
                  {isCompleted ? (
                    <CheckIcon size={15} />
                  ) : isLocked ? (
                    <LockIcon size={12} />
                  ) : (
                    step.id
                  )}
                </motion.div>

                {/* Connector */}
                {!isLast && (
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      delay: 0.55 + i * 0.12,
                      duration: 0.45,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    className="w-0.5 flex-1 min-h-6 mt-1 mb-1 rounded-[1px]"
                    style={{
                      background: isCompleted
                        ? 'linear-gradient(to bottom, #16A34A, rgba(22,163,74,0.25))'
                        : 'rgba(255,255,255,0.07)',
                      transformOrigin: 'top',
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div
                className={`flex-1 transition-opacity duration-200 ${isLast ? 'pb-0' : 'pb-[26px]'}`}
                style={{ opacity: isLocked ? 0.42 : 1 }}
              >
                {/* Name + status badge */}
                <div className="flex items-center flex-wrap gap-2.5 mb-[7px] pt-2">
                  <span
                    className={`font-sans text-[0.92rem] font-semibold ${
                      isLocked ? 'text-slate-600' : 'text-white'
                    }`}
                  >
                    {step.name}
                  </span>

                  {isActive ? (
                    <motion.span
                      animate={{ opacity: [1, 0.55, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full text-blue-400"
                      style={{ background: 'rgba(0,102,255,0.12)' }}
                    >
                      In Progress
                    </motion.span>
                  ) : (
                    <span
                      className={`font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full ${
                        isCompleted ? 'text-green-400' : 'text-slate-600'
                      }`}
                      style={{
                        background: isCompleted
                          ? 'rgba(22,163,74,0.12)'
                          : 'rgba(255,255,255,0.05)',
                      }}
                    >
                      {isCompleted ? 'Completed' : 'Locked'}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p
                  className={`font-sans text-[0.77rem] text-slate-500 leading-[1.62] max-w-[58ch] ${
                    isLocked ? 'mb-0' : 'mb-[14px]'
                  }`}
                >
                  {step.desc}
                </p>

                {/* Action button */}
                {!isLocked && (
                  <motion.button
                    whileHover={{
                      y: -1,
                      boxShadow: isActive
                        ? '0 0 18px rgba(22,163,74,0.32)'
                        : '0 4px 14px rgba(0,0,0,0.35)',
                    }}
                    whileTap={{ scale: 0.96 }}
                    onClick={() => { navigateStep(step.id - 1); navigate('/app') }}
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
            </motion.div>
          )
        })}
      </div>
    </motion.section>
  )
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS_BASE = [
  {
    label: 'Continue where you left off',
    sub: 'Active Step',
    pathKey: 'active',

    iconBg: 'rgba(22,163,74,0.15)',
    iconColor: '#16A34A',
    cardBg: '#111827',
    border: 'rgba(22,163,74,0.28)',
    hoverGlow:
      '0 8px 36px rgba(0,0,0,0.5), 0 0 28px rgba(22,163,74,0.22)',
    ctaLabel: 'Continue',
    ctaBg: '#16A34A',
    ctaColor: '#fff',
    ctaBorder: 'none',
    Icon: PlayIcon,
    breathe: true,
  },
  {
    label: 'Jump to Defense Simulator',
    sub: 'Preview the three-examiner panel',
    iconBg: 'rgba(0,102,255,0.15)',
    iconColor: '#0066FF',
    cardBg: '#111827',
    border: 'rgba(0,102,255,0.24)',
    hoverGlow:
      '0 8px 36px rgba(0,0,0,0.5), 0 0 28px rgba(0,102,255,0.22)',
    ctaLabel: 'Preview',
    ctaBg: 'transparent',
    ctaColor: '#60A5FA',
    ctaBorder: '1.5px solid rgba(0,102,255,0.38)',
    Icon: ZapIcon,
    breathe: false,
  },
  {
    label: 'Download Progress Report',
    sub: 'Export your research summary as PDF',
    iconBg: 'rgba(245,158,11,0.15)',
    iconColor: '#F59E0B',
    cardBg: '#111827',
    border: 'rgba(245,158,11,0.24)',
    hoverGlow:
      '0 8px 36px rgba(0,0,0,0.5), 0 0 24px rgba(245,158,11,0.2)',
    ctaLabel: 'Export PDF',
    ctaBg: 'transparent',
    ctaColor: '#FCD34D',
    ctaBorder: '1.5px solid rgba(245,158,11,0.38)',
    Icon: DownloadIcon,
    breathe: false,
  },
]

function DashQuickActions({ STEPS }) {
  const navigate = useNavigate()
  const activeStep = STEPS.find((s) => s.status === 'active') ?? STEPS[0]
  const QUICK_ACTIONS = QUICK_ACTIONS_BASE.map((a) =>
    a.pathKey === 'active'
      ? { ...a, path: '/app', sub: `Step ${activeStep?.id} — ${activeStep?.name}` }
      : a
  )
  return (
    <motion.section
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.52, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="quick-actions-heading"
    >
      <h2
        id="quick-actions-heading"
        className="font-serif text-[1.45rem] text-white mb-4 leading-[1.2]"
      >
        Quick Actions
      </h2>

      <div className="grid grid-cols-3 gap-4">
        {QUICK_ACTIONS.map((action, i) => (
          <motion.button
            key={action.label}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              delay: 0.58 + i * 0.1,
              duration: 0.45,
              ease: [0.22, 1, 0.36, 1],
            }}
            whileHover={{ y: -4, boxShadow: action.hoverGlow }}
            whileTap={{ scale: 0.97 }}
            aria-label={action.label}
            onClick={action.path ? () => navigate(action.path) : undefined}
            className="flex flex-col items-start gap-4 p-6 rounded-2xl cursor-pointer text-left transition-all duration-200"
            style={{
              background: action.cardBg,
              border: `1px solid ${action.border}`,
            }}
          >
            {/* Icon */}
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center"
              style={{ background: action.iconBg, color: action.iconColor }}
            >
              <action.Icon />
            </div>

            {/* Text */}
            <div className="flex-1">
              <div className="font-sans text-[0.88rem] font-semibold text-white mb-[5px] leading-[1.3]">
                {action.label}
              </div>
              <div className="font-sans text-[0.72rem] text-slate-500 leading-[1.45]">
                {action.sub}
              </div>
            </div>

            {/* CTA chip */}
            {action.breathe ? (
              <motion.span
                animate={{ scale: [1, 1.03, 1] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  repeatDelay: 2.4,
                  ease: 'easeInOut',
                }}
                className="inline-flex items-center gap-1.5 px-4 py-[7px] rounded-lg font-sans text-[0.76rem] font-semibold"
                style={{
                  background: action.ctaBg,
                  color: action.ctaColor,
                  border: action.ctaBorder,
                }}
              >
                {action.ctaLabel} <ArrowRightIcon size={11} />
              </motion.span>
            ) : (
              <span
                className="inline-flex items-center gap-1.5 px-4 py-[7px] rounded-lg font-sans text-[0.76rem] font-semibold"
                style={{
                  background: action.ctaBg,
                  color: action.ctaColor,
                  border: action.ctaBorder,
                }}
              >
                {action.ctaLabel} <ArrowRightIcon size={11} />
              </span>
            )}
          </motion.button>
        ))}
      </div>
    </motion.section>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { state, clearSession, isOnboarded } = useApp()

  useEffect(() => {
    if (!isOnboarded) navigate('/start', { replace: true })
  }, [isOnboarded, navigate])

  const completedCount = state.stepsCompleted.filter(Boolean).length
  const activeStepId   = state.currentStep ?? 1
  const STEPS          = buildSteps(state.stepsCompleted, activeStepId)

  const STUDENT = {
    name:           state.university ? state.department?.split(' ')[0] + ' Student' : 'Student',
    initials:       (state.department || 'ST').slice(0, 2).toUpperCase(),
    university:     state.university  || 'University',
    department:     state.department  || 'Department',
    level:          state.level       || '',
    stepsCompleted: completedCount,
    totalSteps:     6,
    currentStepId:  activeStepId,
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: '#0A0F1C' }}
    >
      <DashSidebar STUDENT={STUDENT} STEPS={STEPS} onNewSession={() => { clearSession(); navigate('/start') }} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <DashTopBar STUDENT={STUDENT} onNewSession={() => { clearSession(); navigate('/start') }} />

        <main
          className="flex-1 overflow-y-auto"
          style={{
            padding: '36px 40px 56px',
            backgroundColor: '#0A0F1C',
            backgroundImage: 'radial-gradient(circle, rgba(0,102,255,0.045) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        >
          <DashStatCards STUDENT={STUDENT} STEPS={STEPS} />
          <DashProgressJourney STEPS={STEPS} STUDENT={STUDENT} />
          <DashQuickActions STEPS={STEPS} />
        </main>
      </div>
    </div>
  )
}
