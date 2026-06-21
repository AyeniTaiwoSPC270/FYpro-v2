import { useState, useRef, useEffect, memo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import { usePaidFeatures } from '../../hooks/usePaidFeatures'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import { resetUser } from '../../lib/analytics'
import { showToast } from '../../components/Toast'
import { BellIcon, GearIcon, SunIcon, MoonIcon, PlusIcon } from './_shared'
import { useUser } from '../../hooks/useUser'
import { useNotifications } from '../../hooks/useNotifications'
import NotificationPanel from '../../components/NotificationPanel'
import ReportButton from '../../components/ReportButton'

export default memo(function DashTopBar({ STUDENT, onNewSession, onToggleSidebar }) {
  const navigate = useNavigate()
  const { theme, toggleTheme } = useTheme()
  const { clearState } = useApp()
  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening'
  const firstName = STUDENT.name ? STUDENT.name.split(' ')[0] : 'there'

  const { features } = usePaidFeatures()
  const planLabel = features.includes('defense_pack') ? 'Defense Plan' : features.includes('student_pack') ? 'Student Plan' : features.includes('express_defense') ? 'Express Defence' : 'Free Plan'

  const { user } = useUser()
  const { notifications, unreadCount, loading, error, refetch, markAllRead } = useNotifications(user?.id)
  const [panelOpen, setPanelOpen] = useState(false)
  const [avatarOpen, setAvatarOpen] = useState(false)
  const [avatarImgError, setAvatarImgError] = useState(false)
  const [reportOpen, setReportOpen] = useState(false)
  const avatarRef = useRef(null)

  async function handleLogout() {
    setAvatarOpen(false)
    await supabase.auth.signOut()
    resetUser()
    clearState()
    navigate('/')
  }

  useEffect(() => {
    function handleOutside(e) {
      if (avatarRef.current && !avatarRef.current.contains(e.target)) setAvatarOpen(false)
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <>
    <header
      className="h-[68px] flex items-center justify-between px-4 md:px-8 sticky top-0 z-20 flex-shrink-0 relative border-b border-slate-800/60"
      style={{ background: 'var(--bg-sidebar)' }}
    >
      {/* Mobile hamburger */}
      <button className="db-menu-toggle" onClick={onToggleSidebar} aria-label="Toggle sidebar">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <line x1="3" y1="6" x2="21" y2="6" />
          <line x1="3" y1="12" x2="21" y2="12" />
          <line x1="3" y1="18" x2="21" y2="18" />
        </svg>
      </button>

      {/* Greeting */}
      <div className="db-header-enter flex-1 min-w-0 mx-2 sm:mx-0 overflow-hidden">
        <div className="font-serif text-[1rem] sm:text-[1.18rem] text-white leading-[1.15] truncate">
          {greeting}, {firstName}
        </div>
        <div className="font-sans text-[0.72rem] text-slate-500 mt-0.5 truncate">
          {STUDENT.stepsCompleted === STUDENT.totalSteps
            ? 'All 6 steps complete — you\'re defense ready.'
            : STUDENT.stepsCompleted > 0
            ? `${STUDENT.stepsCompleted} step${STUDENT.stepsCompleted === 1 ? '' : 's'} done — Step ${STUDENT.currentStepId} is waiting.`
            : 'Your research journey is ready to begin.'}
        </div>
      </div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.08, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="flex items-center gap-1.5 sm:gap-2.5 flex-shrink-0"
      >
        <motion.button
          whileHover={{ y: -1, boxShadow: '0 0 22px rgba(59,130,246,0.4)' }}
          whileTap={{ scale: 0.96 }}
          aria-label="Start a new project"
          onClick={onNewSession}
          className="hidden sm:flex items-center gap-1.5 px-[18px] py-[9px] bg-blue-600 hover:bg-blue-500 border-0 rounded-xl font-sans text-[0.8rem] font-semibold cursor-pointer transition-all duration-200"
            style={{ color: '#fff' }}
        >
          <PlusIcon /> New Session
        </motion.button>

        <div style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ scale: 1.09 }}
            whileTap={{ scale: 0.94 }}
            aria-label="Notifications"
            onClick={() => {
              if (!panelOpen) refetch()
              setPanelOpen(v => !v)
            }}
            className="db-header__icon-btn relative w-[30px] h-[30px] sm:w-[38px] sm:h-[38px] flex items-center justify-center rounded-xl cursor-pointer text-slate-400 hover:text-white transition-all duration-200"
            style={{ background: 'var(--header-btn-bg)', border: '1px solid var(--header-btn-border)' }}
          >
            <BellIcon />
            {unreadCount > 0 && (
              <span
                aria-label={`${unreadCount} unread notifications`}
                className="absolute font-bold text-white rounded-full"
                style={{
                  width: '16px', height: '16px',
                  background: '#DC2626',
                  fontSize: '0.55rem',
                  fontFamily: "'JetBrains Mono', monospace",
                  top: '-4px', right: '-4px',
                  border: '2px solid var(--bg-sidebar)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </motion.button>

          <AnimatePresence>
            {panelOpen && (
              <NotificationPanel
                notifications={notifications}
                loading={loading}
                error={error}
                unreadCount={unreadCount}
                onMarkAllRead={markAllRead}
                onRetry={refetch}
                onClose={() => setPanelOpen(false)}
              />
            )}
          </AnimatePresence>
        </div>

        <motion.button
          whileHover={{ scale: 1.09 }}
          whileTap={{ scale: 0.94 }}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          onClick={toggleTheme}
          className="db-header__icon-btn w-[30px] h-[30px] sm:w-[38px] sm:h-[38px] flex items-center justify-center rounded-xl cursor-pointer text-slate-400 hover:text-white transition-all duration-200"
          style={{ background: 'var(--header-btn-bg)', border: '1px solid var(--header-btn-border)' }}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </motion.button>

        <motion.button
          whileHover={{ scale: 1.09 }}
          whileTap={{ scale: 0.94 }}
          aria-label="Settings"
          onClick={() => navigate('/settings')}
          className="db-header__icon-btn w-[30px] h-[30px] sm:w-[38px] sm:h-[38px] flex items-center justify-center rounded-xl cursor-pointer text-slate-400 hover:text-white transition-all duration-200"
          style={{ background: 'var(--header-btn-bg)', border: '1px solid var(--header-btn-border)' }}
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
            className="w-[38px] h-[38px] rounded-full flex items-center justify-center font-bold cursor-pointer overflow-hidden"
            style={{
              background: 'linear-gradient(135deg, #0066FF 0%, #3B82F6 100%)',
              border: '2px solid rgba(0,102,255,0.35)',
              color: '#fff',
              fontSize: '0.68rem',
              fontFamily: "'DM Serif Display', serif",
            }}
          >
            {STUDENT.avatarUrl && !avatarImgError
              ? <img src={STUDENT.avatarUrl} alt={STUDENT.name} className="w-full h-full object-cover" onError={() => setAvatarImgError(true)} />
              : STUDENT.initials}
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
                  <div className="font-mono text-[0.65rem] text-slate-500 mt-0.5">{planLabel}</div>
                </div>
                <div className="py-1.5">
                  <Link to="/profile" onClick={() => setAvatarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 no-underline hover:bg-white/5 transition-colors duration-150">
                    <span className="font-sans text-[0.82rem] text-slate-300">Profile</span>
                  </Link>
                  <Link to="/settings" onClick={() => setAvatarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 no-underline hover:bg-white/5 transition-colors duration-150">
                    <span className="font-sans text-[0.82rem] text-slate-300">Settings</span>
                  </Link>
                  <Link to="/account/referrals" onClick={() => setAvatarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 no-underline hover:bg-white/5 transition-colors duration-150">
                    <span className="font-sans text-[0.82rem] text-slate-300">My Referrals</span>
                  </Link>
                  <button
                    onClick={() => { setAvatarOpen(false); setReportOpen(true) }}
                    className="flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-white/5 transition-colors duration-150"
                  >
                    <span className="font-sans text-[0.82rem] text-slate-400">Report an issue</span>
                  </button>
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
        style={{ background: 'linear-gradient(to right, transparent 0%, rgba(0,102,255,0.18) 20%, rgba(0,102,255,0.45) 50%, rgba(0,102,255,0.18) 80%, transparent 100%)' }}
      />
    </header>

    {reportOpen && (
      <ReportButton
        type="general"
        context={{ url: window.location.pathname }}
        label=""
        initialOpen={true}
        onClose={() => setReportOpen(false)}
      />
    )}
    </>
  )
})
