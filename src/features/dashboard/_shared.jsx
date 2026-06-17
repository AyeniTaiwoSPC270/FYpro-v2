// Shared constants, hooks, and icon components for the Dashboard feature.
import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValue, useTransform, animate } from 'framer-motion'

// ─── Step definitions ─────────────────────────────────────────────────────────

export const STEP_DEFS = [
  { id: 1, name: 'Topic Validator',    desc: 'Validated your research topic for feasibility, scope, and originality against your department and level.',              path: '/app' },
  { id: 2, name: 'Chapter Architect',  desc: 'Generated a complete five-chapter breakdown with section headings, key literature, and a visual literature map.',        path: '/app' },
  { id: 3, name: 'Methodology Advisor',desc: 'Selected research design, sampling strategy, and data approach — all justified for Chapter 3.',                          path: '/app' },
  { id: 4, name: 'Writing Planner',    desc: 'Get a week-by-week writing schedule calculated from your submission deadline with buffer weeks and word targets.',        path: '/app' },
  { id: 5, name: 'Project Reviewer',   desc: 'Upload your draft chapters for AI-powered feedback on structure, argument, and academic writing quality.',               path: '/app' },
  { id: 6, name: 'Defense Prep',       desc: 'Face three AI examiners in a full panel simulation. Receive a readiness score and know every question before the real thing.', path: '/app' },
]

export const STEP_NAME_TO_NUM = {
  topic_validator:     1,
  chapter_architect:   2,
  methodology_advisor: 3,
  writing_planner:     4,
  project_reviewer:    5,
  defense_prep:        6,
}

export function buildSteps(stepsCompleted, activeStepId) {
  return STEP_DEFS.map((def, i) => ({
    ...def,
    status: stepsCompleted[i] ? 'completed' : activeStepId === def.id ? 'active' : 'locked',
  }))
}

// ─── Express step definitions (3-step express app) ─────────────────────────────

export const EXPRESS_STEP_DEFS = [
  { id: 1, key: 'project_reviewer', name: 'Project Reviewer',  desc: 'Upload your draft for AI-powered feedback on structure, argument, and academic quality.', path: '/express/run' },
  { id: 2, key: 'defense_brief',    name: 'Defence Brief',     desc: 'Get your personalised opening statement, model answers for weak spots, and likely examiner Q&As.', path: '/express/run' },
  { id: 3, key: 'defense',          name: 'Defence Simulator', desc: 'Three AI examiners, voice-enabled, real hostile questions. Score 7/10+ to earn your certificate.', path: '/express/run' },
]

// Express progress model is { project_reviewer, defense_brief, defense } booleans.
// The active step is the first incomplete one.
export function expressBuildSteps(expressSteps = {}) {
  const firstIncomplete = EXPRESS_STEP_DEFS.findIndex(d => !expressSteps[d.key])
  return EXPRESS_STEP_DEFS.map((def, i) => ({
    ...def,
    status: expressSteps[def.key]
      ? 'completed'
      : i === firstIncomplete
      ? 'active'
      : 'locked',
  }))
}

// ─── Scroll reveal hook ───────────────────────────────────────────────────────

export function useReveal() {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const observer = new IntersectionObserver(
      ([entry]) => { setVisible(entry.isIntersecting) },
      { threshold: 0.12 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])
  return [ref, visible]
}

export const revealStyle = (visible) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'translateY(0)' : 'translateY(24px)',
  transition: 'opacity 0.5s ease, transform 0.5s ease',
})

export const slideLeftStyle = (visible, delayMs = 0) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'translateX(0)' : 'translateX(-28px)',
  transition: `opacity 0.5s ease ${delayMs}ms, transform 0.5s cubic-bezier(0.22,1,0.36,1) ${delayMs}ms`,
})

// ─── SVG path ─────────────────────────────────────────────────────────────────

export const SHIELD_D =
  'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

// ─── Icons ────────────────────────────────────────────────────────────────────

export const ShieldIcon = ({ size = 22, color = '#0066FF' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={size} height={size} fill={color} aria-hidden="true">
    <path d={SHIELD_D} />
  </svg>
)

export const BellIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

export const GearIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.07 4.93A10 10 0 0 1 21 12a10 10 0 0 1-1.93 5.07M4.93 4.93A10 10 0 0 0 3 12a10 10 0 0 0 1.93 5.07" />
  </svg>
)

export const CheckIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="20 6 9 17 4 12" />
  </svg>
)

export const LockIcon = ({ size = 11 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
)

export const ArrowRightIcon = ({ size = 13 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

export const PlusIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
)

export const TrashIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6" />
    <path d="M10 11v6M14 11v6" />
    <path d="M9 6V4a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2" />
  </svg>
)

export const DownloadIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
)

export const ZapIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />
  </svg>
)

export const PlayIcon = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polygon points="5 3 19 12 5 21 5 3" fill="currentColor" stroke="none" />
  </svg>
)

export const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

export const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

export const DotsHorizontalIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <circle cx="5" cy="12" r="1.5" fill="currentColor" />
    <circle cx="12" cy="12" r="1.5" fill="currentColor" />
    <circle cx="19" cy="12" r="1.5" fill="currentColor" />
  </svg>
)

// ─── Animated progress ring ───────────────────────────────────────────────────

export function ProgressRing({ completed, total }) {
  const radius = 54
  const circumference = 2 * Math.PI * radius
  const targetPct = completed / total

  const progressValue = useMotionValue(0)
  const strokeDashoffset = useTransform(progressValue, (v) => circumference - v * circumference)
  const countedValue = useTransform(progressValue, (v) => Math.round(v * total))
  const [displayCount, setDisplayCount] = useState(0)

  useEffect(() => {
    const anim = animate(progressValue, targetPct, {
      duration: 1.2,
      ease: [0.43, 0.13, 0.23, 0.96],
    })
    return () => anim.stop()
  }, [targetPct, progressValue])

  useEffect(() => {
    const unsubscribe = countedValue.on('change', setDisplayCount)
    return unsubscribe
  }, [countedValue])

  return (
    <div className="relative flex items-center justify-center flex-shrink-0" style={{ width: 136, height: 136 }}>
      <svg
        width="136" height="136" viewBox="0 0 136 136"
        style={{ transform: 'rotate(-90deg)' }}
        role="progressbar"
        aria-valuenow={completed}
        aria-valuemin={0}
        aria-valuemax={total}
        aria-label={`${completed} of ${total} steps completed`}
      >
        <circle cx="68" cy="68" r={radius} fill="transparent" stroke="rgba(0,102,255,0.12)" strokeWidth="10" strokeLinecap="round" />
        <motion.circle cx="68" cy="68" r={radius} fill="transparent" stroke="#0066FF" strokeWidth="10" strokeLinecap="round" strokeDasharray={circumference} style={{ strokeDashoffset }} />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <motion.span className="font-mono font-bold leading-none text-white" style={{ fontSize: '1.9rem' }}>
          {displayCount}
        </motion.span>
        <span className="font-mono text-slate-600 mt-[3px]" style={{ fontSize: '0.62rem' }}>
          of {total}
        </span>
      </div>
    </div>
  )
}
