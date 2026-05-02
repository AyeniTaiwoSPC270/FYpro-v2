import { useEffect, useState, useRef } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { useTheme } from '../context/ThemeContext'
import { showToast } from '../components/Toast'
import { downloadProgressReport } from '../utils/generateReport'
import { supabase } from '../lib/supabase'

const STEP_DEFS = [
  { id: 1, name: 'Topic Validator',    desc: 'Validated your research topic for feasibility, scope, and originality against your department and level.',              path: '/app' },
  { id: 2, name: 'Chapter Architect',  desc: 'Generated a complete five-chapter breakdown with section headings, key literature, and a visual literature map.',        path: '/app' },
  { id: 3, name: 'Methodology Advisor',desc: 'Selected research design, sampling strategy, and data approach — all justified for Chapter 3.',                          path: '/app' },
  { id: 4, name: 'Writing Planner',    desc: 'Get a week-by-week writing schedule calculated from your submission deadline with buffer weeks and word targets.',        path: '/app' },
  { id: 5, name: 'Project Reviewer',   desc: 'Upload your draft chapters for AI-powered feedback on structure, argument, and academic writing quality.',               path: '/app' },
  { id: 6, name: 'Defense Prep',       desc: 'Face three AI examiners in a full panel simulation. Receive a readiness score and know every question before the real thing.', path: '/app' },
]

function buildSteps(stepsCompleted, activeStepId) {
  return STEP_DEFS.map((def, i) => ({
    ...def,
    status: stepsCompleted[i] ? 'completed' : activeStepId === def.id ? 'active' : 'locked',
  }))
}

// ─── useReveal hook (FIX 6) ───────────────────────────────────────────────────

function useReveal() {
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

const revealStyle = (visible) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'translateY(0)' : 'translateY(24px)',
  transition: 'opacity 0.5s ease, transform 0.5s ease',
})

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

const SunIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
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

// ─── New Session Modal (FIX 5) ────────────────────────────────────────────────

function NewSessionModal({ onClose, onConfirm }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center">
      <div
        className="mt-[20vh] w-full max-w-md mx-4 rounded-2xl p-8"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)' }}
      >
        <h2 className="text-white font-semibold text-lg">Start a new project?</h2>
        <p className="text-slate-400 text-sm mt-2">
          Starting a new session will require a project payment. Your current project progress will be saved.
        </p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl px-6 py-2 font-sans text-sm font-medium text-slate-400 hover:border-slate-500 transition-colors duration-150"
            style={{ border: '1px solid var(--border-color)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 py-2 font-sans text-sm font-semibold transition-colors duration-150"
          >
            Continue to Payment
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Sidebar ──────────────────────────────────────────────────────────────────

function DashSidebar({ STUDENT, STEPS, onNewSession, isOpen }) {
  return (
    <aside
      className={`flex flex-col flex-shrink-0 border-r border-slate-800/60 db-sidebar${isOpen ? ' db-sidebar--open' : ''}`}
      style={{
        width: 260,
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--bg-sidebar) 0%, var(--sidebar-gradient-end) 100%)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-slate-800/60 px-[22px] py-[26px]">
        <img src="/fypro-logo.png" alt="FYPro" className="h-9 w-auto" />
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
                    ? { background: 'var(--badge-inactive-bg)', border: '1.5px solid var(--badge-inactive-border)' }
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
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
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
          style={{ background: 'var(--badge-inactive-bg)' }}
        >
          {STUDENT.level}
        </div>
      </div>
    </aside>
  )
}

// ─── Top Bar ──────────────────────────────────────────────────────────────────

function DashTopBar({ STUDENT, onNewSession, onToggleSidebar }) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = STUDENT.name.split(' ')[0]

  const [avatarOpen, setAvatarOpen] = useState(false)
  const avatarRef = useRef(null)

  async function handleLogout() {
    setAvatarOpen(false)
    await supabase.auth.signOut()
    localStorage.clear()
    sessionStorage.clear()
    navigate('/')
  }

  // FIX 3 — notifications state: dot only shows when there are unread notifications
  const [notifications, setNotifications] = useState([]) // eslint-disable-line no-unused-vars

  // FIX 6 — scroll reveal for welcome header
  const [headerRef, headerVisible] = useReveal()

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
      className="h-[68px] flex items-center justify-between px-4 md:px-8 sticky top-0 z-20 flex-shrink-0 relative border-b border-slate-800/60"
      style={{ background: 'var(--bg-sidebar)' }}
    >
      {/* Mobile hamburger — hidden on desktop via CSS */}
      <button
        className="db-menu-toggle"
        onClick={onToggleSidebar}
        aria-label="Toggle sidebar"
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* FIX 1 — Greeting: shows actual first name and correct subtitle */}
      <div ref={headerRef} style={revealStyle(headerVisible)}>
        <div className="font-serif text-[1.18rem] text-white leading-[1.15]">
          {greeting}, {firstName}
        </div>
        <div className="font-sans text-[0.72rem] text-slate-500 mt-0.5">
          {STUDENT.stepsCompleted} steps done — Step {STUDENT.currentStepId} is waiting.
        </div>
      </div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-2.5"
      >
        {/* FIX 5 — New Session opens modal instead of clearing session immediately */}
        <motion.button
          whileHover={{ y: -1, boxShadow: '0 0 22px rgba(59,130,246,0.4)' }}
          whileTap={{ scale: 0.96 }}
          aria-label="Start a new project"
          onClick={onNewSession}
          className="flex items-center gap-1.5 px-[18px] py-[9px] bg-blue-600 hover:bg-blue-500 text-white border-0 rounded-xl font-sans text-[0.8rem] font-semibold cursor-pointer transition-all duration-200"
        >
          <PlusIcon /> New Session
        </motion.button>

        {/* FIX 3 — Bell: dot only renders when notifications.length > 0 */}
        <motion.button
          whileHover={{ scale: 1.09 }}
          whileTap={{ scale: 0.94 }}
          aria-label="Notifications"
          onClick={() => showToast(notifications.length > 0 ? `You have ${notifications.length} notification${notifications.length > 1 ? 's' : ''}` : 'No new notifications')}
          className="db-header__icon-btn relative w-[38px] h-[38px] flex items-center justify-center rounded-xl cursor-pointer text-slate-400 hover:text-white transition-all duration-200"
          style={{
            background: 'var(--header-btn-bg)',
            border: '1px solid var(--header-btn-border)',
          }}
        >
          <BellIcon />
          {notifications.length > 0 && (
            <span
              aria-label={`${notifications.length} unread notifications`}
              className="absolute top-0 right-0 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center font-mono font-bold"
              style={{ fontSize: '0.55rem' }}
            >
              {notifications.length}
            </span>
          )}
        </motion.button>

        {/* Theme toggle */}
        <motion.button
          whileHover={{ scale: 1.09 }}
          whileTap={{ scale: 0.94 }}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
          className="db-header__icon-btn w-[38px] h-[38px] flex items-center justify-center rounded-xl cursor-pointer text-slate-400 hover:text-white transition-all duration-200"
          style={{
            background: 'var(--header-btn-bg)',
            border: '1px solid var(--header-btn-border)',
          }}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </motion.button>

        {/* Settings */}
        <motion.button
          whileHover={{ scale: 1.09 }}
          whileTap={{ scale: 0.94 }}
          aria-label="Settings"
          onClick={() => navigate('/settings')}
          className="db-header__icon-btn w-[38px] h-[38px] flex items-center justify-center rounded-xl cursor-pointer text-slate-400 hover:text-white transition-all duration-200"
          style={{
            background: 'var(--header-btn-bg)',
            border: '1px solid var(--header-btn-border)',
          }}
        >
          <GearIcon />
        </motion.button>

        {/* FIX 2 — Avatar: shows actual initials from full name */}
        <div className="relative" ref={avatarRef}>
          <motion.button
            whileHover={{ scale: 1.07, boxShadow: '0 0 18px rgba(0,102,255,0.3)' }}
            aria-label={`Profile: ${STUDENT.name}`}
            aria-expanded={avatarOpen}
            onClick={() => setAvatarOpen((v) => !v)}
            className="w-[38px] h-[38px] rounded-full flex items-center justify-center font-bold text-white cursor-pointer"
            style={{
              background: 'linear-gradient(135deg, #0066FF 0%, #3B82F6 100%)',
              border: '2px solid rgba(0,102,255,0.35)',
              fontSize: '0.68rem',
              fontFamily: "'DM Serif Display', serif",
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
                  background: 'var(--bg-card)',
                  border: '1px solid var(--dropdown-border)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
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
                  <div className="mx-3 my-1 h-px" style={{ background: 'var(--border-color)' }} />
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-white/5 transition-colors duration-150"
                  >
                    <span className="font-sans text-[0.82rem] text-red-400">Sign out</span>
                  </button>
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

  // FIX 6 — scroll reveal for stats row
  const [rowRef, rowVisible] = useReveal()

  return (
    <div ref={rowRef} style={revealStyle(rowVisible)} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 mb-7">

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
          background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-input) 100%)',
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
          background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-green-mid) 60%, var(--bg-input) 100%)',
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
          background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-input) 100%)',
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

function DashProgressJourney({ STEPS, STUDENT }) {
  const navigate = useNavigate()
  const { navigateStep } = useApp()

  // FIX 6 — scroll reveal: section + each step card individually
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
          style={{ background: 'var(--badge-inactive-bg)' }}
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
          const [stepRef, stepVisible] = stepReveals[i] || [null, true]

          return (
            <div
              key={step.id}
              ref={stepRef}
              style={revealStyle(stepVisible)}
              className="flex gap-5"
            >
              {/* Timeline column */}
              <div className="flex flex-col items-center w-11 flex-shrink-0">
                {/* FIX 7 — Badge: locked steps use bg-slate-800 border-slate-700 */}
                <motion.div
                  whileHover={!isLocked ? { scale: 1.14 } : {}}
                  transition={{ duration: 0.2 }}
                  className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0 relative z-10 font-mono text-[0.75rem] font-bold transition-all duration-300"
                  style={{
                    background: isCompleted
                      ? '#16A34A'
                      : isActive
                      ? '#0066FF'
                      : 'var(--border-color)',
                    boxShadow: isActive
                      ? '0 0 22px rgba(0,102,255,0.32)'
                      : isCompleted
                      ? '0 0 22px rgba(22,163,74,0.45)'
                      : 'none',
                    border: isActive
                      ? '2px solid rgba(0,102,255,0.35)'
                      : isLocked
                      ? '1px solid var(--border-color)'
                      : 'none',
                    color:
                      isCompleted || isActive
                        ? '#fff'
                        : 'var(--badge-locked-text)',
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
                        : 'var(--border-subtle)',
                      transformOrigin: 'top',
                    }}
                  />
                )}
              </div>

              {/* Content */}
              <div className={`flex-1 ${isLast ? 'pb-0' : 'pb-[26px]'}`}>
                {/* FIX 7 — Name + lock icon next to name for locked steps */}
                <div className="flex items-center flex-wrap gap-2.5 mb-[7px] pt-2">
                  <span
                    className={`font-sans text-[0.92rem] font-semibold ${
                      isLocked ? 'text-slate-600' : 'text-white'
                    }`}
                  >
                    {step.name}
                  </span>

                  {/* FIX 7 — Lock icon visible next to step name when locked */}
                  {isLocked && (
                    <span className="text-slate-700">
                      <LockIcon size={13} />
                    </span>
                  )}

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
                    <span
                      className="font-mono text-[0.58rem] font-medium tracking-[0.08em] uppercase px-2.5 py-[3px] rounded-full text-green-400"
                      style={{ background: 'rgba(22,163,74,0.12)' }}
                    >
                      Completed
                    </span>
                  ) : null}
                </div>

                {/* FIX 7 — Description: text-slate-700 for locked, text-slate-500 otherwise */}
                <p
                  className={`font-sans text-[0.77rem] leading-[1.62] max-w-[58ch] ${
                    isLocked ? 'text-slate-700 mb-0' : 'text-slate-500 mb-[14px]'
                  }`}
                >
                  {step.desc}
                </p>

                {/* Action button — only for non-locked steps */}
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
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Quick Actions ────────────────────────────────────────────────────────────

const QUICK_ACTIONS_BASE = [
  {
    label: 'Continue where you left off',
    sub: 'Active Step',
    pathKey: 'active',
    lockable: false,
    iconBg: 'rgba(22,163,74,0.15)',
    iconColor: '#16A34A',
    cardBg: 'var(--bg-input)',
    border: 'rgba(22,163,74,0.28)',
    hoverGlow: '0 8px 36px rgba(0,0,0,0.5), 0 0 28px rgba(22,163,74,0.22)',
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
    lockable: true,
    iconBg: 'rgba(0,102,255,0.15)',
    iconColor: '#0066FF',
    cardBg: 'var(--bg-input)',
    border: 'rgba(0,102,255,0.24)',
    hoverGlow: '0 8px 36px rgba(0,0,0,0.5), 0 0 28px rgba(0,102,255,0.22)',
    ctaLabel: 'Preview',
    ctaBg: 'transparent',
    ctaColor: '#60A5FA',
    ctaBorder: '1.5px solid rgba(0,102,255,0.38)',
    Icon: ZapIcon,
    breathe: false,
    path: '/workflow/defense-simulator',
  },
  {
    label: 'Download Progress Report',
    sub: 'Export your research summary as PDF',
    lockable: false,
    onClickKey: 'download',
    iconBg: 'rgba(245,158,11,0.15)',
    iconColor: '#F59E0B',
    cardBg: 'var(--bg-input)',
    border: 'rgba(245,158,11,0.24)',
    hoverGlow: '0 8px 36px rgba(0,0,0,0.5), 0 0 24px rgba(245,158,11,0.2)',
    ctaLabel: 'Export PDF',
    ctaBg: 'transparent',
    ctaColor: '#FCD34D',
    ctaBorder: '1.5px solid rgba(245,158,11,0.38)',
    Icon: DownloadIcon,
    breathe: false,
  },
]

function DashQuickActions({ STEPS, allComplete, showToastMessage, onDownloadReport }) {
  const navigate = useNavigate()
  const activeStep = STEPS.find((s) => s.status === 'active') ?? STEPS[0]
  const QUICK_ACTIONS = QUICK_ACTIONS_BASE.map((a) =>
    a.pathKey === 'active'
      ? { ...a, path: '/app', sub: `Step ${activeStep?.id} — ${activeStep?.name}` }
      : a
  )

  // FIX 6 — scroll reveal: section heading + each card individually
  const [sectionRef, sectionVisible] = useReveal()
  const [r0, v0] = useReveal()
  const [r1, v1] = useReveal()
  const [r2, v2] = useReveal()
  const cardReveals = [[r0, v0], [r1, v1], [r2, v2]]

  return (
    <section ref={sectionRef} style={revealStyle(sectionVisible)} aria-labelledby="quick-actions-heading">
      <h2
        id="quick-actions-heading"
        className="font-serif text-[1.45rem] text-white mb-4 leading-[1.2]"
      >
        Quick Actions
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {QUICK_ACTIONS.map((action, i) => {
          // FIX 4 — lockable cards are disabled until all 6 steps complete
          const isLockedAction = action.lockable && !allComplete
          const [cardRef, cardVisible] = cardReveals[i] || [null, true]

          return (
            <div key={action.label} ref={cardRef} style={revealStyle(cardVisible)}>
              <motion.button
                whileHover={!isLockedAction ? { y: -4, boxShadow: action.hoverGlow } : {}}
                whileTap={!isLockedAction ? { scale: 0.97 } : {}}
                aria-label={action.label}
                aria-disabled={isLockedAction}
                onClick={
                  isLockedAction
                    ? () => showToastMessage('Complete all 6 steps to unlock this feature')
                    : action.onClickKey === 'download'
                    ? onDownloadReport
                    : action.path
                    ? () => navigate(action.path)
                    : undefined
                }
                className={`relative flex flex-col items-start gap-4 p-6 rounded-2xl text-left transition-all duration-200 w-full ${
                  isLockedAction ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
                style={{
                  background: action.cardBg,
                  border: `1px solid ${isLockedAction ? 'var(--border-color)' : action.border}`,
                  opacity: isLockedAction ? 0.6 : 1,
                }}
              >
                {/* FIX 4 — Lock overlay icon for locked actions */}
                {isLockedAction && (
                  <div className="absolute top-4 right-4 text-slate-600">
                    <LockIcon size={15} />
                  </div>
                )}

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

                {/* FIX 4 — CTA chip: opacity-50 cursor-not-allowed when locked */}
                {action.breathe ? (
                  <motion.span
                    animate={!isLockedAction ? { scale: [1, 1.03, 1] } : {}}
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
                      opacity: isLockedAction ? 0.5 : 1,
                      cursor: isLockedAction ? 'not-allowed' : 'default',
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
                      opacity: isLockedAction ? 0.5 : 1,
                      cursor: isLockedAction ? 'not-allowed' : 'default',
                    }}
                  >
                    {action.ctaLabel} <ArrowRightIcon size={11} />
                  </span>
                )}
              </motion.button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

// ─── Dashboard Page ───────────────────────────────────────────────────────────

export default function Dashboard() {
  const navigate = useNavigate()
  const { state, clearState, isOnboarded } = useApp()

  useEffect(() => {
    if (!isOnboarded) navigate('/start', { replace: true })
  }, [isOnboarded, navigate])

  // Mobile sidebar state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Close sidebar when viewport expands to desktop
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const close = (e) => { if (e.matches) setSidebarOpen(false) }
    mq.addEventListener('change', close)
    return () => mq.removeEventListener('change', close)
  }, [])

  // FIX 5 — new session modal state
  const [showNewSessionModal, setShowNewSessionModal] = useState(false)

  // Toast state (used by FIX 4)
  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef(null)

  function showToastMessage(msg) {
    setToastMsg(msg)
    setToastVisible(true)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastVisible(false), 3000)
  }

  const completedCount = state.stepsCompleted.filter(Boolean).length
  // FIX 1 — activeStepId: state.currentStep is 0-indexed count; step IDs are 1-indexed
  const activeStepId = Math.min(6, (state.currentStep ?? 0) + 1)
  const STEPS = buildSteps(state.stepsCompleted, activeStepId)

  // FIX 4 — allComplete: all 6 steps must be done to unlock Defense/Report cards
  const allComplete = state.stepsCompleted.every(Boolean)

  // FIX 1 + FIX 2 — derive name and initials from state.name
  const fullName = state.name || ''
  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'ST'

  const STUDENT = {
    name:           fullName || 'Student',
    initials,
    university:     state.university  || 'University',
    department:     state.department  || 'Department',
    level:          state.level       || '',
    stepsCompleted: completedCount,
    totalSteps:     6,
    currentStepId:  activeStepId,
  }

  function handleNewSession() {
    setShowNewSessionModal(true)
  }

  function handleModalClose() {
    setShowNewSessionModal(false)
  }

  function handleModalConfirm() {
    setShowNewSessionModal(false)
    navigate('/payment')
  }

  return (
    <div
      className="flex h-screen overflow-hidden"
      style={{ background: 'var(--bg-base)' }}
    >
      {/* Mobile sidebar backdrop */}
      <div
        className={`db-sidebar-backdrop${sidebarOpen ? ' db-sidebar-backdrop--visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <DashSidebar STUDENT={STUDENT} STEPS={STEPS} onNewSession={handleNewSession} isOpen={sidebarOpen} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <DashTopBar STUDENT={STUDENT} onNewSession={handleNewSession} onToggleSidebar={() => setSidebarOpen(o => !o)} />

        <main
          className="flex-1 overflow-y-auto p-4 pb-12 sm:px-6 sm:py-7 lg:px-10 lg:pt-9 lg:pb-14"
          style={{
            backgroundColor: 'var(--bg-base)',
            backgroundImage: 'var(--dot-bg-image)',
            backgroundSize: '28px 28px',
          }}
        >
          <DashStatCards STUDENT={STUDENT} STEPS={STEPS} />
          <DashProgressJourney STEPS={STEPS} STUDENT={STUDENT} />
          <DashQuickActions
            STEPS={STEPS}
            allComplete={allComplete}
            showToastMessage={showToastMessage}
            onDownloadReport={() => downloadProgressReport(state)}
          />
        </main>
      </div>

      {/* FIX 5 — New Session confirmation modal */}
      <AnimatePresence>
        {showNewSessionModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <NewSessionModal onClose={handleModalClose} onConfirm={handleModalConfirm} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* FIX 4 — Toast notification */}
      <AnimatePresence>
        {toastVisible && (
          <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.22 }}
              className="pointer-events-auto font-sans text-sm text-white px-5 py-3 rounded-xl border border-slate-700"
              style={{
                background: 'var(--bg-card)',
                boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
              }}
            >
              {toastMsg}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  )
}
