import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { showToast } from '../components/Toast'
import { usePaidFeatures } from '../hooks/usePaidFeatures'
import { useProjectState } from '../hooks/useProjectState'
import { useUser } from '../hooks/useUser'
import { supabase } from '../lib/supabase'
import { updateUserProfile } from '../lib/db'
import { resetUser } from '../lib/analytics'
import Spinner from '../components/Spinner'
import { useNotifications } from '../hooks/useNotifications'
import NotificationPanel from '../components/NotificationPanel'
import FyproLogo from '../components/FyproLogo'

// ─── Icons ────────────────────────────────────────────────────────────────────

const SHIELD_D =
  'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

const GoogleIcon = () => (
  <svg width="12" height="12" viewBox="0 0 24 24" aria-hidden="true" style={{ flexShrink: 0 }}>
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

const ShieldIcon = ({ size = 22, color = '#0066FF' }) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={size} height={size} fill={color} aria-hidden="true">
    <path d={SHIELD_D} />
  </svg>
)

const ChevronDownIcon = ({ size = 14 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <polyline points="6 9 12 15 18 9" />
  </svg>
)

const UserIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
)

const GridIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
)

const LogOutIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const BellIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
  </svg>
)

// ─── Navbar ───────────────────────────────────────────────────────────────────

function ProfileNavbar({ initials, name, avatarUrl }) {
  const navigate = useNavigate()
  const { clearState } = useApp()
  const { features } = usePaidFeatures()
  const planLabel = features.includes('defense_pack') ? 'Defense Plan' : features.includes('student_pack') ? 'Student Plan' : 'Free Plan'
  const [open, setOpen] = useState(false)
  const [panelOpen, setPanelOpen] = useState(false)
  const [avatarImgError, setAvatarImgError] = useState(false)
  const [signingOut, setSigningOut] = useState(false)
  const dropdownRef = useRef(null)
  const { user: navUser } = useUser()
  const { notifications, unreadCount, loading, error, refetch, markAllRead } = useNotifications(navUser?.id)

  useEffect(() => {
    function handleOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  return (
    <header
      className="h-[68px] flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30 flex-shrink-0 relative"
      style={{
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      {/* Logo */}
      <Link to="/dashboard" className="flex items-center gap-2.5 no-underline">
        <FyproLogo className="h-9 w-auto" />
      </Link>

      {/* Right controls */}
      <div className="flex items-center gap-2.5">
        {/* Bell */}
        <div style={{ position: 'relative' }}>
          <motion.button
            whileHover={{ scale: 1.09 }}
            whileTap={{ scale: 0.94 }}
            aria-label="Notifications"
            onClick={() => { if (!panelOpen) refetch(); setPanelOpen(v => !v) }}
            className="relative w-[38px] h-[38px] flex items-center justify-center rounded-xl cursor-pointer text-slate-400 hover:text-white transition-all duration-200"
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

        {/* Avatar + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Open user menu"
            aria-expanded={open}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl cursor-pointer transition-all duration-200"
            style={{
              background: open ? 'var(--border-subtle)' : 'transparent',
              border: '1px solid transparent',
            }}
          >
            <div
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-mono text-[0.65rem] font-bold text-white flex-shrink-0 overflow-hidden"
              style={{
                background: 'linear-gradient(135deg, #0066FF 0%, #3B82F6 100%)',
                border: '2px solid rgba(0,102,255,0.35)',
              }}
            >
              {avatarUrl && !avatarImgError
                ? <img src={avatarUrl} alt={name} className="w-full h-full object-cover" onError={() => setAvatarImgError(true)} />
                : initials}
            </div>
            <span className="font-sans text-[0.8rem] font-medium text-slate-300 max-w-[120px] truncate hidden sm:block">
              {name}
            </span>
            <span className="text-slate-500">
              <ChevronDownIcon />
            </span>
          </button>

          <AnimatePresence>
            {open && (
              <motion.div
                initial={{ opacity: 0, y: -6, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -6, scale: 0.97 }}
                transition={{ duration: 0.15, ease: 'easeOut' }}
                className="absolute right-0 mt-2 w-52 rounded-xl overflow-hidden"
                style={{
                  background: 'var(--bg-card)',
                  border: '1px solid var(--dropdown-border)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.25)',
                  top: '100%',
                }}
              >
                <div className="px-4 py-3 border-b border-slate-800/80">
                  <div className="font-sans text-[0.8rem] font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{name}</div>
                  <div className="font-mono text-[0.65rem] mt-0.5" style={{ color: 'var(--text-muted)' }}>{planLabel}</div>
                </div>

                <div className="py-1.5">
                  <Link
                    to="/profile"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 no-underline transition-colors duration-150"
                    style={{ background: 'rgba(0,102,255,0.1)' }}
                  >
                    <span className="text-blue-400"><UserIcon /></span>
                    <span className="font-sans text-[0.82rem] text-blue-400 font-medium">Profile</span>
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 no-underline hover:bg-white/5 transition-colors duration-150"
                  >
                    <span className="text-slate-400"><GridIcon /></span>
                    <span className="font-sans text-[0.82rem] text-slate-300">Dashboard</span>
                  </Link>
                </div>

                <div className="py-1.5 border-t border-slate-800/80">
                  <button
                    onClick={async () => {
                      if (signingOut) return
                      setSigningOut(true)
                      try {
                        await supabase.auth.signOut()
                        resetUser()
                        clearState()
                        navigate('/')
                      } finally {
                        setSigningOut(false)
                      }
                    }}
                    disabled={signingOut}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/10 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
                  >
                    {signingOut ? (
                      <>
                        <span className="text-red-400"><Spinner size={14} /></span>
                        <span className="font-sans text-[0.82rem] text-red-400">Signing out…</span>
                      </>
                    ) : (
                      <>
                        <span className="text-red-400"><LogOutIcon /></span>
                        <span className="font-sans text-[0.82rem] text-red-400">Sign Out</span>
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Gradient border */}
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

// ─── Section Heading ──────────────────────────────────────────────────────────

function SectionLabel({ children, danger = false }) {
  return (
    <div
      className="font-mono text-[0.68rem] font-semibold uppercase tracking-[0.14em] mb-6"
      style={{ color: danger ? '#F87171' : 'var(--text-muted)' }}
    >
      {children}
    </div>
  )
}

// ─── Keyframes ────────────────────────────────────────────────────────────────

const PROFILE_KEYFRAMES = `
  @keyframes shimmer-sweep {
    from { transform: translateX(-100%); }
    to   { transform: translateX(100%); }
  }
  .btn-shimmer::before {
    content: '';
    position: absolute;
    inset: 0;
    background: linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.15) 50%, transparent 80%);
    transform: translateX(-100%);
  }
  .btn-shimmer:hover::before {
    animation: shimmer-sweep 0.55s ease forwards;
  }
`

// ─── Animated Input / Select ──────────────────────────────────────────────────

function AnimatedInput({ className, style, ...props }) {
  return (
    <input
      className={className}
      style={{ borderLeftColor: 'rgba(0,102,255,0.2)', ...style }}
      onFocus={(e) => {
        e.target.style.borderLeftColor = 'rgba(0,102,255,0.8)'
        e.target.style.boxShadow = '0 0 0 3px rgba(0,102,255,0.12)'
      }}
      onBlur={(e) => {
        e.target.style.borderLeftColor = 'rgba(0,102,255,0.2)'
        e.target.style.boxShadow = 'none'
      }}
      {...props}
    />
  )
}

function AnimatedSelect({ className, style, children, ...props }) {
  return (
    <select
      className={className}
      style={{ appearance: 'none', cursor: 'pointer', borderLeftColor: 'rgba(0,102,255,0.2)', ...style }}
      onFocus={(e) => {
        e.target.style.borderLeftColor = 'rgba(0,102,255,0.8)'
        e.target.style.boxShadow = '0 0 0 3px rgba(0,102,255,0.12)'
      }}
      onBlur={(e) => {
        e.target.style.borderLeftColor = 'rgba(0,102,255,0.2)'
        e.target.style.boxShadow = 'none'
      }}
      {...props}
    >
      {children}
    </select>
  )
}

// ─── Count Up ─────────────────────────────────────────────────────────────────

function CountUp({ target }) {
  const [count, setCount] = useState(0)
  const ref = useRef(null)
  const started = useRef(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !started.current) {
          started.current = true
          const duration = 900
          const start = Date.now()
          const tick = () => {
            const elapsed = Date.now() - start
            const progress = Math.min(elapsed / duration, 1)
            const eased = 1 - Math.pow(1 - progress, 3)
            setCount(Math.round(eased * target))
            if (progress < 1) requestAnimationFrame(tick)
          }
          requestAnimationFrame(tick)
        }
      },
      { threshold: 0.5 }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [target])

  return <span ref={ref}>{count}</span>
}

// ─── Form Input ───────────────────────────────────────────────────────────────

function FormField({ label, hint, children }) {
  return (
    <div>
      <label className="block font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1.5">
        {label}
      </label>
      {children}
      {hint && (
        <p className="font-sans text-[0.7rem] text-slate-500 mt-1.5">{hint}</p>
      )}
    </div>
  )
}

const inputCls =
  'w-full bg-[var(--bg-input)] border border-[var(--border-color)] rounded-xl px-4 py-3 font-sans text-[0.875rem] outline-none transition-all duration-200 placeholder:text-slate-600'

// ─── Profile Page ─────────────────────────────────────────────────────────────

export default function Profile() {
  const { state, set, clearState } = useApp()
  const navigate = useNavigate()
  const { features } = usePaidFeatures()
  const { resetProject } = useProjectState()
  const { user } = useUser()
  const planLabel = features.includes('defense_pack') ? 'Defense Plan' : features.includes('student_pack') ? 'Student Plan' : 'Free Plan'
  const isGoogleUser = user?.identities?.some(i => i.provider === 'google') ?? false

  const completedCount = state.stepsCompleted.filter(Boolean).length

  const [form, setForm] = useState({
    name:       '',
    email:      '',
    university: state.university  || '',
    faculty:    state.faculty     || '',
    department: state.department  || '',
    level:      state.level       || '',
  })
  const [avatarUrl, setAvatarUrl] = useState(null)
  const [saving, setSaving] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [deletingProjects, setDeletingProjects] = useState(false)
  const [deletingAccount, setDeletingAccount] = useState(false)

  // Hydrate name + email from Supabase auth user when it resolves
  useEffect(() => {
    if (!user) return
    setForm(prev => ({
      ...prev,
      name:  user.user_metadata?.full_name || '',
      email: user.email || '',
    }))
    setAvatarUrl(user.user_metadata?.avatar_url || null)
  }, [user])

  // Re-sync profile fields from AppContext when useProjectState finishes loading them
  // from Supabase (async — form may have initialized before the DB data arrived)
  useEffect(() => {
    setForm(prev => ({
      ...prev,
      university: state.university || prev.university,
      faculty:    state.faculty    || prev.faculty,
      department: state.department || prev.department,
      level:      state.level      || prev.level,
    }))
  }, [state.university, state.faculty, state.department, state.level])

  const initials = form.name
    ? form.name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
    : form.email ? form.email[0].toUpperCase() : '?'

  const memberSince = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : ''

  const photoInputRef = useRef(null)

  const SpinnerIcon = () => (
    <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )

  function handleChangePhoto() {
    photoInputRef.current?.click()
  }

  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file || !user) return
    setUploading(true)
    try {
      const ext  = file.name.split('.').pop()
      const path = `${user.id}.${ext}`
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (uploadError) { showToast('Photo upload failed'); return }
      const { data: { publicUrl } } = supabase.storage.from('avatars').getPublicUrl(path)
      await Promise.all([
        supabase.auth.updateUser({ data: { avatar_url: publicUrl } }),
        updateUserProfile({ avatar_url: publicUrl }),
      ])
      setAvatarUrl(publicUrl)
      showToast('Photo updated')
    } finally {
      setUploading(false)
    }
  }

  async function handleSaveChanges() {
    const previous = {
      university: state.university,
      faculty:    state.faculty,
      department: state.department,
      level:      state.level,
    }
    set({ university: form.university, faculty: form.faculty, department: form.department, level: form.level })
    setSaving(true)
    try {
      const profileUpdates = {
        university: form.university,
        faculty:    form.faculty,
        department: form.department,
        level:      form.level,
      }
      if (form.name) {
        profileUpdates.full_name = form.name
        await supabase.auth.updateUser({ data: { full_name: form.name } })
      }
      await updateUserProfile(profileUpdates)
      showToast('Changes saved')
    } catch (err) {
      console.error('[Profile] handleSaveChanges failed:', err.message)
      set(previous)
      showToast('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDeleteProjects() {
    if (!window.confirm('Delete all project data? This cannot be undone.')) return
    setDeletingProjects(true)
    try {
      clearState()
      try {
        await resetProject()
      } catch (err) {
        console.error('[Profile] Supabase delete failed', err)
      }
      showToast('All projects deleted')
      navigate('/dashboard')
    } finally {
      setDeletingProjects(false)
    }
  }

  async function handleDeleteAccount() {
    if (!window.confirm('Permanently delete your FYPro account? This cannot be undone.')) return

    const { data: { session } } = await supabase.auth.getSession()
    if (!session?.access_token) {
      showToast('You must be signed in to delete your account', 'error')
      return
    }

    setDeletingAccount(true)
    try {
      const res = await fetch('/api/admin?action=self-delete', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        showToast(body.error || 'Account deletion failed. Please try again.', 'error')
        // Fall through — still sign out and wipe local data so stale state
        // never bleeds into a re-signup with the same email.
      }
    } catch {
      showToast('Account deletion failed. Please check your connection.', 'error')
      setDeletingAccount(false)
      return
      // Fall through — same reason as above.
    }

    // Always sign out and clear ALL local storage after a deletion attempt,
    // regardless of whether the server call succeeded or failed.
    await supabase.auth.signOut()
    resetUser()
    clearState()
    navigate('/')
  }

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const cardStyle = {
    background: 'var(--bg-card)',
    borderRadius: '1rem',
    border: '1px solid var(--border-color)',
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--bg-base)',
        backgroundImage: 'var(--dot-bg-image)',
        backgroundSize: '28px 28px',
      }}
    >
      <style>{PROFILE_KEYFRAMES}</style>
      <ProfileNavbar initials={initials} name={form.name} avatarUrl={avatarUrl} />

      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="flex flex-col items-center text-center"
        >
          <h1 className="font-serif text-3xl leading-none" style={{ color: 'var(--text-primary)' }}>Your Profile</h1>
          <p className="font-sans text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage your personal information and account details.
          </p>
        </motion.div>

        {/* ── Section 1: Avatar + Name ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 p-5 sm:p-8 flex flex-col sm:flex-row gap-6 items-start"
          style={cardStyle}
        >
          {/* Avatar */}
          <div className="flex flex-col items-center flex-shrink-0">
            <motion.div
              animate={{ scale: [1, 1.03, 1] }}
              transition={{ duration: 0.7, delay: 0.4, ease: 'easeInOut', times: [0, 0.5, 1] }}
              whileHover={{ boxShadow: '0 0 0 3px rgba(0,102,255,0.3)', transition: { duration: 0.2 } }}
              className="w-20 h-20 rounded-full flex items-center justify-center overflow-hidden"
              style={{
                background: 'rgba(59,130,246,0.2)',
                border: '2px solid #3B82F6',
              }}
            >
              {avatarUrl
                ? <img src={avatarUrl} alt="Profile" className="w-full h-full object-cover" />
                : <span className="font-serif text-2xl text-blue-400 leading-none">{initials}</span>
              }
            </motion.div>
            <button
              onClick={!uploading ? handleChangePhoto : undefined}
              disabled={uploading}
              className={`mt-2 font-sans text-xs text-blue-400 hover:text-blue-300 cursor-pointer transition-colors duration-150 bg-transparent border-0 p-0 flex items-center gap-1.5 ${uploading ? 'opacity-60 cursor-not-allowed' : ''}`}
            >
              {uploading ? (
                <>
                  <SpinnerIcon />
                  <span>Uploading…</span>
                </>
              ) : 'Change Photo'}
            </button>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileUpload}
            />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            {!user ? (
              <>
                <div className="animate-pulse bg-slate-700/50 rounded-lg h-5 w-36 mb-2" />
                <div className="animate-pulse bg-slate-700/30 rounded h-4 w-48 mt-1" />
              </>
            ) : (
              <>
                <div className="font-sans text-xl font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{form.name}</div>
                <div className="font-sans text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>{form.email}</div>
              </>
            )}
            {memberSince && (
              <div className="font-mono text-xs mt-2" style={{ color: 'var(--text-muted)' }}>Member since {memberSince}</div>
            )}
            <div className="flex items-center flex-wrap gap-3 mt-3">
              <span
                className="font-mono text-xs font-semibold px-3 py-1 rounded-full inline-block"
                style={{
                  background: 'rgba(59,130,246,0.2)',
                  color: '#60A5FA',
                  border: '1px solid rgba(59,130,246,0.3)',
                }}
              >
                {planLabel}
              </span>
              {isGoogleUser && (
                <span
                  className="font-mono text-xs font-semibold px-3 py-1 rounded-full inline-flex items-center gap-1.5"
                  style={{
                    background: 'rgba(66,133,244,0.08)',
                    color: '#93C5FD',
                    border: '1px solid rgba(66,133,244,0.22)',
                  }}
                >
                  <GoogleIcon />
                  Connected via Google
                </span>
              )}
              <Link
                to="/pricing"
                className="font-sans text-xs text-blue-400 hover:text-blue-300 no-underline transition-colors duration-150"
              >
                Upgrade Plan
              </Link>
            </div>
          </div>
        </motion.div>

        {/* ── Section 2: Personal Information ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 p-5 sm:p-8"
          style={cardStyle}
        >
          <SectionLabel>Personal Information</SectionLabel>

          {!user ? (
            <div className="flex flex-col gap-5">
              {[{ w: 'w-24' }, { w: 'w-28' }, { w: 'w-20' }, { w: 'w-16' }, { w: 'w-24' }, { w: 'w-14' }].map((_, i) => (
                <div key={i}>
                  <div className="animate-pulse bg-slate-700/40 rounded h-3 w-20 mb-1.5" />
                  <div className="animate-pulse bg-slate-700/30 rounded-xl h-[46px] w-full" />
                </div>
              ))}
              <div className="animate-pulse bg-slate-700/40 rounded-xl h-[46px] w-32 mt-2" />
            </div>
          ) : (
            <div className="flex flex-col gap-5">
              <FormField label="Full Name">
                <AnimatedInput
                  className={inputCls}
                  type="text"
                  name="name"
                  value={form.name}
                  onChange={handleChange}
                  autoComplete="name"
                />
              </FormField>

              <FormField label="Email Address" hint="Email changes require verification">
                <AnimatedInput
                  className={inputCls}
                  type="email"
                  name="email"
                  value={form.email}
                  onChange={handleChange}
                  autoComplete="email"
                />
              </FormField>

              <FormField label="University">
                <AnimatedInput
                  className={inputCls}
                  type="text"
                  name="university"
                  value={form.university}
                  onChange={handleChange}
                />
              </FormField>

              <FormField label="Faculty">
                <AnimatedInput
                  className={inputCls}
                  type="text"
                  name="faculty"
                  value={form.faculty}
                  onChange={handleChange}
                />
              </FormField>

              <FormField label="Department">
                <AnimatedInput
                  className={inputCls}
                  type="text"
                  name="department"
                  value={form.department}
                  onChange={handleChange}
                />
              </FormField>

              <FormField label="Level">
                <AnimatedSelect
                  className={inputCls}
                  name="level"
                  value={form.level}
                  onChange={handleChange}
                >
                  {['100', '200', '300', '400', '500'].map((l) => (
                    <option key={l} value={l}>{l} Level</option>
                  ))}
                </AnimatedSelect>
              </FormField>

              <motion.button
                whileHover={!saving ? { y: -2 } : {}}
                whileTap={!saving ? { scale: 0.97 } : {}}
                onClick={!saving ? handleSaveChanges : undefined}
                disabled={saving}
                className={`relative overflow-hidden btn-shimmer font-sans font-semibold text-white rounded-xl px-6 py-3 cursor-pointer transition-all duration-200 self-start mt-2 flex items-center gap-2 ${saving ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={{ background: '#2563EB', border: 'none' }}
                onMouseEnter={!saving ? e => { e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.5)' } : undefined}
                onMouseLeave={!saving ? e => { e.currentTarget.style.boxShadow = 'none' } : undefined}
              >
                {saving ? (
                  <><SpinnerIcon />Saving…</>
                ) : 'Save Changes'}
              </motion.button>
            </div>
          )}
        </motion.div>

        {/* ── Section 3: Academic Information ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 p-5 sm:p-8"
          style={cardStyle}
        >
          <SectionLabel>Academic Information</SectionLabel>

          <div className="flex gap-4">
            {[
              { label: 'Projects Started', display: <CountUp target={1} /> },
              { label: 'Steps Completed',  display: <><CountUp target={completedCount} /><span className="text-base font-normal"> of 6</span></> },
              { label: 'Last Active',       display: 'Today' },
            ].map(({ label, display }) => (
              <div
                key={label}
                className="flex-1 rounded-xl p-4"
                style={{ background: 'var(--bg-input)' }}
              >
                <div className="font-sans text-2xl font-bold leading-none" style={{ color: 'var(--text-primary)' }}>{display}</div>
                <div className="font-mono text-xs uppercase tracking-wider mt-1.5" style={{ color: 'var(--text-muted)' }}>{label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Section 4: Danger Zone ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 p-5 sm:p-8"
          style={{ ...cardStyle, borderColor: 'rgba(239,68,68,0.2)' }}
        >
          <SectionLabel danger>Danger Zone</SectionLabel>

          {[
            {
              title:   'Delete all projects',
              desc:    'Permanently delete all your FYP projects and results. This cannot be undone.',
              label:   'Delete Projects',
              handler: handleDeleteProjects,
              loading: deletingProjects,
            },
            {
              title:   'Delete account',
              desc:    'Permanently delete your FYPro account and all associated data.',
              label:   'Delete Account',
              handler: handleDeleteAccount,
              loading: deletingAccount,
            },
          ].map((item, i) => (
            <div
              key={item.title}
              className={`flex items-center justify-between gap-4 ${
                i < 1 ? 'border-b border-[var(--border-color)] pb-4 mb-4' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-sans text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{item.title}</div>
                <div className="font-sans text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{item.desc}</div>
              </div>
              <motion.button
                whileHover={!item.loading ? { background: 'rgba(239,68,68,0.1)', boxShadow: '0 0 12px rgba(239,68,68,0.25)' } : {}}
                whileTap={!item.loading ? { scale: 0.97 } : {}}
                onClick={!item.loading ? item.handler : undefined}
                disabled={item.loading}
                className={`flex-shrink-0 font-sans text-sm text-red-400 rounded-xl px-4 py-2 cursor-pointer transition-all duration-200 flex items-center gap-2 ${item.loading ? 'opacity-60 cursor-not-allowed' : ''}`}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(239,68,68,0.4)',
                }}
              >
                {item.loading ? <><SpinnerIcon />Deleting…</> : item.label}
              </motion.button>
            </div>
          ))}
        </motion.div>

        {/* Bottom spacing */}
        <div className="h-12" />
      </div>
    </div>
  )
}
