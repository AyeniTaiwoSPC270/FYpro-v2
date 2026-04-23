import { useEffect } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

// ─── Mock Data ────────────────────────────────────────────────────────────────

const STUDENT = {
  name: 'Adaeze Okonkwo',
  initials: 'AO',
  university: 'University of Lagos',
  department: 'Computer Science',
  level: '400 Level',
  stepsCompleted: 3,
  totalSteps: 6,
  currentStepId: 4,
}

const STEPS = [
  {
    id: 1,
    name: 'Topic Validator',
    desc: 'Validated your research topic for feasibility, scope, and originality against your department and level.',
    status: 'completed',
  },
  {
    id: 2,
    name: 'Chapter Architect',
    desc: 'Generated a complete five-chapter breakdown with section headings, key literature, and a visual literature map.',
    status: 'completed',
  },
  {
    id: 3,
    name: 'Methodology Advisor',
    desc: 'Selected research design, sampling strategy, and data approach — all justified for Chapter 3.',
    status: 'completed',
  },
  {
    id: 4,
    name: 'Instrument Builder',
    desc: 'Build your data collection tools — questionnaire, interview guide, or observation checklist — ready for field work.',
    status: 'active',
  },
  {
    id: 5,
    name: 'Writing Planner',
    desc: 'Get a week-by-week writing schedule calculated from your submission deadline with buffer weeks and word targets.',
    status: 'locked',
  },
  {
    id: 6,
    name: 'Defense Simulator',
    desc: 'Face three AI examiners in a full panel simulation. Receive a readiness score and know every question before the real thing.',
    status: 'locked',
  },
]

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
      className="relative flex items-center justify-center"
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
        {/* Track ring */}
        <circle
          cx="68"
          cy="68"
          r={radius}
          fill="transparent"
          stroke="rgba(0,102,255,0.1)"
          strokeWidth="10"
          strokeLinecap="round"
        />
        {/* Animated progress */}
        <motion.circle
          cx="68"
          cy="68"
          r={radius}
          fill="transparent"
          stroke="#0066FF"
          strokeWidth="10"
          strokeLinecap="round"
          strokeDasharray={circumference}
          style={{ strokeDashoffset }}
        />
      </svg>
      {/* Center label */}
      <div className="absolute flex flex-col items-center justify-center">
        <span
          className="font-mono font-bold leading-none"
          style={{ fontSize: '1.9rem', color: '#0D1B2A' }}
        >
          {completed}
        </span>
        <span
          className="font-mono"
          style={{ fontSize: '0.62rem', color: 'rgba(13,27,42,0.38)', marginTop: 3 }}
        >
          of {total}
        </span>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function Sidebar() {
  return (
    <aside
      style={{
        width: 260,
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0D1B2A 0%, #091420 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        display: 'flex',
        flexDirection: 'column',
        flexShrink: 0,
      }}
    >
      {/* Logo */}
      <div
        style={{
          padding: '26px 22px 20px',
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex',
          alignItems: 'center',
          gap: 10,
        }}
      >
        <ShieldIcon size={28} />
        <span
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: '1.45rem',
            color: '#fff',
            lineHeight: 1,
          }}
        >
          FY<span style={{ color: '#0066FF' }}>Pro</span>
        </span>
      </div>

      {/* Navigation label */}
      <div
        style={{
          padding: '20px 20px 10px',
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.58rem',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color: 'rgba(255,255,255,0.26)',
        }}
      >
        Research Steps
      </div>

      {/* Step list */}
      <nav style={{ flex: 1, paddingBottom: 16 }}>
        {STEPS.map((step, i) => {
          const isCompleted = step.status === 'completed'
          const isActive = step.status === 'active'
          const isLocked = step.status === 'locked'

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
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 11,
                padding: '10px 16px',
                marginBottom: 2,
                borderLeft: isActive
                  ? '3px solid #0066FF'
                  : '3px solid transparent',
                background: isActive
                  ? 'rgba(0,102,255,0.08)'
                  : 'transparent',
                cursor: isLocked ? 'not-allowed' : 'pointer',
                opacity: isLocked ? 0.38 : 1,
                transition: 'all 0.2s ease',
                outline: 'none',
              }}
            >
              {/* Step badge */}
              <div
                style={{
                  width: 27,
                  height: 27,
                  borderRadius: '50%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                  background: isCompleted
                    ? '#16A34A'
                    : isActive
                    ? '#0066FF'
                    : 'rgba(255,255,255,0.07)',
                  border: isLocked
                    ? '1.5px solid rgba(255,255,255,0.12)'
                    : 'none',
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: '0.62rem',
                  fontWeight: 700,
                  color:
                    isCompleted || isActive
                      ? '#fff'
                      : 'rgba(255,255,255,0.35)',
                }}
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
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '0.78rem',
                  fontWeight: isActive ? 600 : 500,
                  color: isCompleted
                    ? 'rgba(255,255,255,0.72)'
                    : isActive
                    ? '#fff'
                    : 'rgba(255,255,255,0.35)',
                  lineHeight: 1.3,
                  flex: 1,
                }}
              >
                {step.name}
              </span>

              {/* Active pulse dot — blue glow animation */}
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
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#0066FF',
                    flexShrink: 0,
                  }}
                />
              )}
            </motion.div>
          )
        })}
      </nav>

      {/* University info card */}
      <div
        style={{
          margin: '0 14px 24px',
          padding: '14px 16px',
          borderRadius: 12,
          background: 'rgba(0,102,255,0.07)',
          borderLeft: '3px solid rgba(0,102,255,0.45)',
        }}
      >
        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.56rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: 'rgba(0,102,255,0.85)',
            marginBottom: 8,
          }}
        >
          Active Project
        </div>
        <div
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.74rem',
            fontWeight: 600,
            color: '#fff',
            marginBottom: 3,
            lineHeight: 1.3,
          }}
        >
          {STUDENT.university}
        </div>
        <div
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.68rem',
            color: 'rgba(255,255,255,0.48)',
            marginBottom: 5,
          }}
        >
          {STUDENT.department}
        </div>
        <div
          style={{
            display: 'inline-block',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.58rem',
            color: 'rgba(255,255,255,0.28)',
            background: 'rgba(255,255,255,0.06)',
            padding: '2px 8px',
            borderRadius: 999,
          }}
        >
          {STUDENT.level}
        </div>
      </div>
    </aside>
  )
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function TopBar() {
  const hour = new Date().getHours()
  const greeting =
    hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = STUDENT.name.split(' ')[0]

  return (
    <header
      style={{
        height: 68,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 32px',
        background: '#fff',
        borderBottom: 'none',
        position: 'sticky',
        top: 0,
        zIndex: 20,
        flexShrink: 0,
      }}
    >
      {/* Greeting */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: '1.18rem',
            color: '#0D1B2A',
            lineHeight: 1.15,
          }}
        >
          {greeting}, {firstName}
        </div>
        <div
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.72rem',
            color: 'rgba(13,27,42,0.42)',
            marginTop: 2,
          }}
        >
          {STUDENT.stepsCompleted} steps done — Step {STUDENT.currentStepId} is waiting.
        </div>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        style={{ display: 'flex', alignItems: 'center', gap: 10 }}
      >
        {/* New Project */}
        <motion.button
          whileHover={{ y: -1, boxShadow: '0 0 22px rgba(0,102,255,0.38)' }}
          whileTap={{ scale: 0.96 }}
          aria-label="Start a new project"
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '9px 18px',
            background: '#0066FF',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          <PlusIcon /> New Project
        </motion.button>

        {/* Bell */}
        <motion.button
          whileHover={{ scale: 1.09 }}
          whileTap={{ scale: 0.94 }}
          aria-label="Notifications"
          style={{
            position: 'relative',
            width: 38,
            height: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(13,27,42,0.04)',
            border: '1px solid rgba(13,27,42,0.09)',
            borderRadius: 10,
            cursor: 'pointer',
            color: 'rgba(13,27,42,0.55)',
          }}
        >
          <BellIcon />
          <span
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: 9,
              right: 9,
              width: 7,
              height: 7,
              borderRadius: '50%',
              background: '#0066FF',
              border: '1.5px solid #fff',
            }}
          />
        </motion.button>

        {/* Settings */}
        <motion.button
          whileHover={{ scale: 1.09 }}
          whileTap={{ scale: 0.94 }}
          aria-label="Settings"
          style={{
            width: 38,
            height: 38,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(13,27,42,0.04)',
            border: '1px solid rgba(13,27,42,0.09)',
            borderRadius: 10,
            cursor: 'pointer',
            color: 'rgba(13,27,42,0.55)',
          }}
        >
          <GearIcon />
        </motion.button>

        {/* Avatar */}
        <motion.button
          whileHover={{ scale: 1.07, boxShadow: '0 0 18px rgba(0,102,255,0.3)' }}
          aria-label={`Profile: ${STUDENT.name}`}
          style={{
            width: 38,
            height: 38,
            borderRadius: '50%',
            background: 'linear-gradient(135deg, #0066FF 0%, #3B82F6 100%)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.68rem',
            fontWeight: 700,
            color: '#fff',
            cursor: 'pointer',
            border: '2px solid rgba(0,102,255,0.35)',
          }}
        >
          {STUDENT.initials}
        </motion.button>
      </motion.div>

      {/* Gradient border bottom */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          height: 1,
          background:
            'linear-gradient(to right, transparent 0%, rgba(0,102,255,0.18) 20%, rgba(0,102,255,0.45) 50%, rgba(0,102,255,0.18) 80%, transparent 100%)',
          pointerEvents: 'none',
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

function StatCards() {
  const activeStep = STEPS.find((s) => s.status === 'active')

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 20,
        marginBottom: 28,
      }}
    >
      {/* ── Card 1: Circular Progress ── */}
      <motion.div
        custom={0}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        whileHover={{
          y: -5,
          boxShadow: '0 14px 40px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
        }}
        style={{
          background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: 16,
          border: '1px solid rgba(13,27,42,0.08)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          padding: '28px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          gap: 22,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        {/* Watermark */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: -12,
            top: -18,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 130,
            fontWeight: 700,
            color: 'rgba(0,102,255,0.04)',
            lineHeight: 1,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          ✦
        </span>

        <ProgressRing
          completed={STUDENT.stepsCompleted}
          total={STUDENT.totalSteps}
        />

        <div>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.6rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#0066FF',
              marginBottom: 8,
            }}
          >
            Overall Progress
          </div>
          <div
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '1.35rem',
              color: '#0D1B2A',
              lineHeight: 1.2,
              marginBottom: 7,
            }}
          >
            {STUDENT.stepsCompleted} Steps
            <br />
            Completed
          </div>
          <div
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.73rem',
              color: 'rgba(13,27,42,0.45)',
              lineHeight: 1.5,
            }}
          >
            {STUDENT.totalSteps - STUDENT.stepsCompleted} steps remaining
          </div>
        </div>
      </motion.div>

      {/* ── Card 2: Current Step — shimmer gradient ── */}
      <motion.div
        custom={1}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        whileHover={{
          y: -5,
          boxShadow: '0 14px 40px rgba(0,0,0,0.1), 0 0 32px rgba(22,163,74,0.1)',
        }}
        style={{
          background: 'linear-gradient(145deg, #ffffff 0%, #f0fff4 60%, #f8fafc 100%)',
          borderRadius: 16,
          border: '1px solid rgba(13,27,42,0.08)',
          borderLeft: '4px solid #16A34A',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          padding: '28px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          gap: 18,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        {/* Step watermark digit */}
        <span
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: -8,
            bottom: -20,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 110,
            fontWeight: 700,
            color: 'rgba(22,163,74,0.05)',
            lineHeight: 1,
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        >
          {activeStep?.id}
        </span>

        {/* Shimmer sweep */}
        <motion.div
          animate={{ x: ['-100%', '200%'] }}
          transition={{ duration: 2.5, repeat: Infinity, repeatDelay: 4, ease: 'easeInOut' }}
          aria-hidden="true"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            width: '60%',
            background:
              'linear-gradient(90deg, transparent 0%, rgba(22,163,74,0.07) 50%, transparent 100%)',
            pointerEvents: 'none',
            zIndex: 0,
          }}
        />

        <div style={{ position: 'relative', zIndex: 1 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.6rem',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              color: '#16A34A',
              marginBottom: 8,
            }}
          >
            Current Step
          </div>
          <div
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '1.22rem',
              color: '#0D1B2A',
              lineHeight: 1.25,
              marginBottom: 9,
            }}
          >
            {activeStep?.name}
          </div>
          <p
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.73rem',
              color: 'rgba(13,27,42,0.48)',
              lineHeight: 1.58,
              maxWidth: '38ch',
            }}
          >
            {activeStep?.desc}
          </p>
        </div>

        <motion.button
          whileHover={{
            y: -1,
            boxShadow: '0 0 20px rgba(22,163,74,0.38)',
          }}
          whileTap={{ scale: 0.96 }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            padding: '11px 22px',
            background: '#16A34A',
            color: '#fff',
            border: 'none',
            borderRadius: 10,
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.82rem',
            fontWeight: 600,
            cursor: 'pointer',
            alignSelf: 'flex-start',
            transition: 'all 0.2s ease',
            position: 'relative',
            zIndex: 1,
          }}
        >
          Continue <ArrowRightIcon />
        </motion.button>
      </motion.div>

      {/* ── Card 3: Project Info — shield watermark ── */}
      <motion.div
        custom={2}
        variants={cardEnter}
        initial="hidden"
        animate="visible"
        whileHover={{
          y: -5,
          boxShadow: '0 14px 40px rgba(0,0,0,0.1), 0 2px 8px rgba(0,0,0,0.06)',
        }}
        style={{
          background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
          borderRadius: 16,
          border: '1px solid rgba(13,27,42,0.08)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
          padding: '28px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          transition: 'box-shadow 0.2s ease',
        }}
      >
        {/* FYPro shield watermark at 4% opacity */}
        <div
          aria-hidden="true"
          style={{
            position: 'absolute',
            right: -20,
            bottom: -20,
            opacity: 0.04,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          <ShieldIcon size={180} color="#0066FF" />
        </div>

        <div
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.6rem',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            color: '#0066FF',
          }}
        >
          Project Details
        </div>

        {[
          { label: 'University', value: STUDENT.university },
          { label: 'Department', value: STUDENT.department },
          { label: 'Academic Level', value: STUDENT.level },
        ].map(({ label, value }) => (
          <div key={label}>
            <div
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.62rem',
                fontWeight: 500,
                textTransform: 'uppercase',
                letterSpacing: '0.07em',
                color: 'rgba(13,27,42,0.36)',
                marginBottom: 3,
              }}
            >
              {label}
            </div>
            <div
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.83rem',
                fontWeight: 600,
                color: '#0D1B2A',
                lineHeight: 1.3,
              }}
            >
              {value}
            </div>
          </div>
        ))}
      </motion.div>
    </div>
  )
}

// ─── Progress Journey ─────────────────────────────────────────────────────────

function ProgressJourney() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.38, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="journey-heading"
      style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: 16,
        border: '1px solid rgba(13,27,42,0.08)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
        padding: '32px',
        marginBottom: 28,
      }}
    >
      {/* Section header */}
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          marginBottom: 28,
        }}
      >
        <div>
          <h2
            id="journey-heading"
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '1.45rem',
              color: '#0D1B2A',
              lineHeight: 1.2,
              marginBottom: 4,
            }}
          >
            Your Research Journey
          </h2>
          <div
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.73rem',
              color: 'rgba(13,27,42,0.42)',
            }}
          >
            Six steps from idea to defense-ready.
          </div>
        </div>
        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.65rem',
            color: 'rgba(13,27,42,0.3)',
            background: 'rgba(13,27,42,0.05)',
            padding: '4px 12px',
            borderRadius: 999,
          }}
        >
          {STUDENT.stepsCompleted} / {STUDENT.totalSteps}
        </span>
      </div>

      {/* Step items */}
      <div style={{ display: 'flex', flexDirection: 'column' }}>
        {STEPS.map((step, i) => {
          const isCompleted = step.status === 'completed'
          const isActive = step.status === 'active'
          const isLocked = step.status === 'locked'
          const isLast = i === STEPS.length - 1

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
              style={{ display: 'flex', gap: 20 }}
            >
              {/* Timeline column */}
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  width: 44,
                  flexShrink: 0,
                }}
              >
                {/* Badge */}
                <motion.div
                  whileHover={!isLocked ? { scale: 1.14 } : {}}
                  transition={{ duration: 0.2 }}
                  style={{
                    width: 44,
                    height: 44,
                    borderRadius: '50%',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                    position: 'relative',
                    zIndex: 1,
                    background: isCompleted
                      ? '#16A34A'
                      : isActive
                      ? '#0066FF'
                      : 'rgba(13,27,42,0.06)',
                    boxShadow: isActive
                      ? '0 0 22px rgba(0,102,255,0.32)'
                      : isCompleted
                      ? '0 0 22px rgba(22,163,74,0.45)'
                      : 'none',
                    border: isActive
                      ? '2px solid rgba(0,102,255,0.35)'
                      : 'none',
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.75rem',
                    fontWeight: 700,
                    color:
                      isCompleted || isActive
                        ? '#fff'
                        : 'rgba(13,27,42,0.28)',
                    transition: 'all 0.25s ease',
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

                {/* Connector — draws itself downward on load */}
                {!isLast && (
                  <motion.div
                    initial={{ scaleY: 0 }}
                    animate={{ scaleY: 1 }}
                    transition={{
                      delay: 0.55 + i * 0.12,
                      duration: 0.45,
                      ease: [0.22, 1, 0.36, 1],
                    }}
                    style={{
                      width: 2,
                      flex: 1,
                      minHeight: 24,
                      marginTop: 4,
                      marginBottom: 4,
                      background: isCompleted
                        ? 'linear-gradient(to bottom, #16A34A, rgba(22,163,74,0.25))'
                        : 'rgba(13,27,42,0.08)',
                      borderRadius: 1,
                      transformOrigin: 'top',
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div
                style={{
                  flex: 1,
                  paddingBottom: isLast ? 0 : 26,
                  opacity: isLocked ? 0.42 : 1,
                  transition: 'opacity 0.2s ease',
                }}
              >
                {/* Name + badge */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: 10,
                    marginBottom: 7,
                    paddingTop: 8,
                  }}
                >
                  <span
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: '0.92rem',
                      fontWeight: 600,
                      color: isLocked ? 'rgba(13,27,42,0.38)' : '#0D1B2A',
                    }}
                  >
                    {step.name}
                  </span>

                  {/* Status badge — IN PROGRESS pulses */}
                  {isActive ? (
                    <motion.span
                      animate={{ opacity: [1, 0.55, 1] }}
                      transition={{ duration: 1.8, repeat: Infinity, ease: 'easeInOut' }}
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.58rem',
                        fontWeight: 500,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '3px 10px',
                        borderRadius: 999,
                        background: 'rgba(0,102,255,0.1)',
                        color: '#0066FF',
                      }}
                    >
                      In Progress
                    </motion.span>
                  ) : (
                    <span
                      style={{
                        fontFamily: "'JetBrains Mono', monospace",
                        fontSize: '0.58rem',
                        fontWeight: 500,
                        letterSpacing: '0.08em',
                        textTransform: 'uppercase',
                        padding: '3px 10px',
                        borderRadius: 999,
                        background: isCompleted
                          ? 'rgba(22,163,74,0.1)'
                          : 'rgba(13,27,42,0.06)',
                        color: isCompleted
                          ? '#16A34A'
                          : 'rgba(13,27,42,0.32)',
                      }}
                    >
                      {isCompleted ? 'Completed' : 'Locked'}
                    </span>
                  )}
                </div>

                {/* Description */}
                <p
                  style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: '0.77rem',
                    color: 'rgba(13,27,42,0.48)',
                    lineHeight: 1.62,
                    marginBottom: isLocked ? 0 : 14,
                    maxWidth: '58ch',
                  }}
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
                        : '0 4px 14px rgba(0,0,0,0.08)',
                    }}
                    whileTap={{ scale: 0.96 }}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 7,
                      padding: '8px 18px',
                      background: isActive ? '#16A34A' : 'transparent',
                      color: isActive ? '#fff' : '#0D1B2A',
                      border: isActive
                        ? 'none'
                        : '1.5px solid rgba(13,27,42,0.16)',
                      borderRadius: 8,
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: '0.76rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      transition: 'all 0.2s ease',
                    }}
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

const QUICK_ACTIONS = [
  {
    label: 'Continue where you left off',
    sub: 'Step 4 — Instrument Builder',
    iconBg: 'rgba(22,163,74,0.14)',
    iconColor: '#16A34A',
    cardBg:
      'linear-gradient(140deg, rgba(22,163,74,0.07) 0%, rgba(22,163,74,0.02) 100%)',
    border: 'rgba(22,163,74,0.22)',
    hoverGlow:
      '0 8px 36px rgba(0,0,0,0.1), 0 0 28px rgba(22,163,74,0.22), 0 4px 20px rgba(0,102,255,0.12)',
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
    iconBg: 'rgba(0,102,255,0.12)',
    iconColor: '#0066FF',
    cardBg:
      'linear-gradient(140deg, rgba(0,102,255,0.07) 0%, rgba(0,102,255,0.02) 100%)',
    border: 'rgba(0,102,255,0.18)',
    hoverGlow:
      '0 8px 36px rgba(0,0,0,0.08), 0 0 28px rgba(0,102,255,0.22)',
    ctaLabel: 'Preview',
    ctaBg: 'transparent',
    ctaColor: '#0066FF',
    ctaBorder: '1.5px solid rgba(0,102,255,0.32)',
    Icon: ZapIcon,
    breathe: false,
  },
  {
    label: 'Download Progress Report',
    sub: 'Export your research summary as PDF',
    iconBg: 'rgba(245,158,11,0.12)',
    iconColor: '#F59E0B',
    cardBg:
      'linear-gradient(140deg, rgba(245,158,11,0.07) 0%, rgba(245,158,11,0.02) 100%)',
    border: 'rgba(245,158,11,0.18)',
    hoverGlow:
      '0 8px 36px rgba(0,0,0,0.08), 0 0 24px rgba(245,158,11,0.18), 0 4px 20px rgba(0,102,255,0.1)',
    ctaLabel: 'Export PDF',
    ctaBg: 'transparent',
    ctaColor: '#F59E0B',
    ctaBorder: '1.5px solid rgba(245,158,11,0.32)',
    Icon: DownloadIcon,
    breathe: false,
  },
]

function QuickActions() {
  return (
    <motion.section
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.52, duration: 0.52, ease: [0.22, 1, 0.36, 1] }}
      aria-labelledby="quick-actions-heading"
    >
      <h2
        id="quick-actions-heading"
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: '1.45rem',
          color: '#0D1B2A',
          marginBottom: 16,
          lineHeight: 1.2,
        }}
      >
        Quick Actions
      </h2>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 16,
        }}
      >
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
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'flex-start',
              gap: 16,
              padding: '24px',
              background: action.cardBg,
              border: `1px solid ${action.border}`,
              borderRadius: 16,
              cursor: 'pointer',
              textAlign: 'left',
              transition: 'all 0.22s ease',
            }}
          >
            {/* Icon */}
            <div
              style={{
                width: 48,
                height: 48,
                borderRadius: 12,
                background: action.iconBg,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: action.iconColor,
              }}
            >
              <action.Icon />
            </div>

            {/* Text */}
            <div style={{ flex: 1 }}>
              <div
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '0.88rem',
                  fontWeight: 600,
                  color: '#0D1B2A',
                  marginBottom: 5,
                  lineHeight: 1.3,
                }}
              >
                {action.label}
              </div>
              <div
                style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '0.72rem',
                  color: 'rgba(13,27,42,0.46)',
                  lineHeight: 1.45,
                }}
              >
                {action.sub}
              </div>
            </div>

            {/* CTA chip — breathes on the Continue button */}
            {action.breathe ? (
              <motion.span
                animate={{ scale: [1, 1.03, 1] }}
                transition={{
                  duration: 0.6,
                  repeat: Infinity,
                  repeatDelay: 2.4,
                  ease: 'easeInOut',
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  background: action.ctaBg,
                  color: action.ctaColor,
                  border: action.ctaBorder,
                  borderRadius: 8,
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '0.76rem',
                  fontWeight: 600,
                }}
              >
                {action.ctaLabel} <ArrowRightIcon size={11} />
              </motion.span>
            ) : (
              <span
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 16px',
                  background: action.ctaBg,
                  color: action.ctaColor,
                  border: action.ctaBorder,
                  borderRadius: 8,
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '0.76rem',
                  fontWeight: 600,
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
  return (
    <div
      style={{
        display: 'flex',
        height: '100vh',
        overflow: 'hidden',
        background: '#F0F4F8',
      }}
    >
      <Sidebar />

      {/* Right panel: top bar + scrollable content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minWidth: 0,
        }}
      >
        <TopBar />

        {/* Scrollable workspace */}
        <main
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '32px 36px 48px',
            backgroundColor: '#F0F4F8',
            backgroundImage:
              'radial-gradient(circle, rgba(0,102,255,0.055) 1px, transparent 1px)',
            backgroundSize: '28px 28px',
          }}
        >
          <StatCards />
          <ProgressJourney />
          <QuickActions />
        </main>
      </div>
    </div>
  )
}
