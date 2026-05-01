import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { useTheme } from '../context/ThemeContext'
import { showToast } from '../components/Toast'

// ─── Icons ────────────────────────────────────────────────────────────────────

const SHIELD_D =
  'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

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

const BellIcon = () => (
  <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
    <path d="M13.73 21a2 2 0 0 1-3.46 0" />
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

const GearIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="3" />
    <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
  </svg>
)

const LogOutIcon = ({ size = 15 }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    <polyline points="16 17 21 12 16 7" />
    <line x1="21" y1="12" x2="9" y2="12" />
  </svg>
)

const EyeIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

const EyeOffIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
)

const GoogleIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" aria-label="Google" role="img">
    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
  </svg>
)

const SunIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
)

const MoonIcon = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
)

// ─── Navbar ───────────────────────────────────────────────────────────────────

function SettingsNavbar({ initials, name }) {
  const navigate = useNavigate()
  const { clearState } = useApp()
  const [open, setOpen] = useState(false)
  const dropdownRef = useRef(null)

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
      className="h-[68px] flex items-center justify-between px-8 sticky top-0 z-30 flex-shrink-0 relative"
      style={{
        background: 'var(--bg-sidebar)',
        borderBottom: '1px solid var(--border-subtle)',
      }}
    >
      <Link to="/dashboard" className="flex items-center gap-2.5 no-underline">
        <ShieldIcon size={26} />
        <span className="font-serif text-[1.35rem] leading-none" style={{ color: 'var(--text-primary)' }}>
          FY<span style={{ color: '#0066FF' }}>Pro</span>
        </span>
      </Link>

      <div className="flex items-center gap-2.5">
        <motion.button
          whileHover={{ scale: 1.09 }}
          whileTap={{ scale: 0.94 }}
          aria-label="Notifications"
          onClick={() => showToast('No new notifications')}
          className="relative w-[38px] h-[38px] flex items-center justify-center rounded-xl cursor-pointer text-slate-400 hover:text-white transition-all duration-200"
          style={{ background: 'var(--header-btn-bg)', border: '1px solid var(--header-btn-border)' }}
        >
          <BellIcon />
          <span
            aria-hidden="true"
            className="absolute top-[9px] right-[9px] w-[7px] h-[7px] rounded-full"
            style={{ background: '#0066FF', border: '1.5px solid var(--bg-sidebar)' }}
          />
        </motion.button>

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
              className="w-[34px] h-[34px] rounded-full flex items-center justify-center font-mono text-[0.65rem] font-bold text-white flex-shrink-0"
              style={{
                background: 'linear-gradient(135deg, #0066FF 0%, #3B82F6 100%)',
                border: '2px solid rgba(0,102,255,0.35)',
              }}
            >
              {initials}
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
                  <div className="font-mono text-[0.65rem] mt-0.5" style={{ color: 'var(--text-muted)' }}>Free Plan</div>
                </div>

                <div className="py-1.5">
                  <Link
                    to="/profile"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 no-underline hover:bg-white/5 transition-colors duration-150"
                  >
                    <span className="text-slate-400"><UserIcon /></span>
                    <span className="font-sans text-[0.82rem] text-slate-300">Profile</span>
                  </Link>
                  <Link
                    to="/dashboard"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 no-underline hover:bg-white/5 transition-colors duration-150"
                  >
                    <span className="text-slate-400"><GridIcon /></span>
                    <span className="font-sans text-[0.82rem] text-slate-300">Dashboard</span>
                  </Link>
                  <Link
                    to="/settings"
                    onClick={() => setOpen(false)}
                    className="flex items-center gap-3 px-4 py-2.5 no-underline transition-colors duration-150"
                    style={{ background: 'rgba(0,102,255,0.1)' }}
                  >
                    <span className="text-blue-400"><GearIcon /></span>
                    <span className="font-sans text-[0.82rem] text-blue-400 font-medium">Settings</span>
                  </Link>
                </div>

                <div className="py-1.5 border-t border-slate-800/80">
                  <button
                    onClick={() => { clearState(); navigate('/') }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/10 transition-colors duration-150 cursor-pointer bg-transparent border-0"
                  >
                    <span className="text-red-400"><LogOutIcon /></span>
                    <span className="font-sans text-[0.82rem] text-red-400">Sign Out</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

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

// ─── SectionLabel ─────────────────────────────────────────────────────────────

function SectionLabel({ children }) {
  return (
    <div className="font-mono text-xs font-semibold uppercase tracking-wider mb-6" style={{ color: 'var(--text-muted)' }}>
      {children}
    </div>
  )
}

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange, ariaLabel }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 cursor-pointer border-0 p-0 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
        checked ? 'bg-blue-600' : 'bg-slate-700'
      }`}
    >
      <span
        className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  )
}

// ─── ToggleRow ────────────────────────────────────────────────────────────────

function ToggleRow({ title, desc, checked, onChange }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div className="flex-1 min-w-0">
        <div className="font-sans text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{title}</div>
        <div className="font-sans text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>{desc}</div>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} ariaLabel={title} />
    </div>
  )
}

// ─── Password strength ────────────────────────────────────────────────────────

function getStrength(pw) {
  if (!pw) return null
  const hasNum = /\d/.test(pw)
  const hasSym = /[^a-zA-Z0-9]/.test(pw)
  if (pw.length >= 8 && hasNum && hasSym) return 'strong'
  if (pw.length >= 8) return 'fair'
  return 'weak'
}

const STRENGTH_CONFIG = {
  weak:   { label: 'Weak',   color: '#EF4444', barClass: 'w-1/4' },
  fair:   { label: 'Fair',   color: '#EAB308', barClass: 'w-2/4' },
  strong: { label: 'Strong', color: '#22C55E', barClass: 'w-full' },
}

function PasswordStrengthBar({ value }) {
  const strength = getStrength(value)
  const cfg = strength ? STRENGTH_CONFIG[strength] : null

  return (
    <div className="mt-2">
      <div className="w-full h-1 rounded-full overflow-hidden" style={{ background: 'var(--border-color)' }}>
        {cfg && (
          <div
            className={`h-full rounded-full transition-all duration-300 ${cfg.barClass}`}
            style={{ background: cfg.color }}
          />
        )}
      </div>
      {cfg && (
        <div className="mt-1 font-mono text-xs" style={{ color: cfg.color }}>
          {cfg.label}
        </div>
      )}
    </div>
  )
}

// ─── Password Input ───────────────────────────────────────────────────────────

function PasswordInput({ label, name, value, onChange, showStrength = false }) {
  const [show, setShow] = useState(false)
  const inputId = `pw-${name}`

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block font-mono text-[0.65rem] font-semibold uppercase tracking-[0.12em] text-slate-400 mb-1.5"
      >
        {label}
      </label>
      <div className="relative">
        <input
          id={inputId}
          name={name}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={onChange}
          autoComplete={name === 'current' ? 'current-password' : 'new-password'}
          placeholder="••••••••"
          className="w-full rounded-xl px-4 py-3 pr-11 font-sans text-[0.875rem] outline-none transition-all duration-200 placeholder:text-slate-600"
          style={{ color: 'var(--text-primary)' }}
          style={{
            background: 'var(--bg-input)',
            border: '1px solid var(--border-color)',
          }}
          onFocus={(e) => { e.target.style.borderColor = '#3B82F6'; e.target.style.boxShadow = '0 0 0 2px rgba(59,130,246,0.2)' }}
          onBlur={(e)  => { e.target.style.borderColor = 'var(--border-color)'; e.target.style.boxShadow = 'none' }}
        />
        <button
          type="button"
          onClick={() => setShow((v) => !v)}
          aria-label={show ? 'Hide password' : 'Show password'}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors duration-150 cursor-pointer bg-transparent border-0 p-0.5"
        >
          {show ? <EyeOffIcon /> : <EyeIcon />}
        </button>
      </div>
      {showStrength && <PasswordStrengthBar value={value} />}
    </div>
  )
}

// ─── Shared card style ────────────────────────────────────────────────────────

const cardStyle = {
  background: 'var(--bg-card)',
  borderRadius: '1rem',
  border: '1px solid var(--border-color)',
  boxShadow: 'var(--card-shadow)',
}

// ─── Settings Page ────────────────────────────────────────────────────────────

export default function Settings() {
  const { state, clearState } = useApp()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const name     = 'Taiwo Ayeni'
  const initials = 'TA'

  const [passwords, setPasswords] = useState({ current: '', newPass: '', confirm: '' })
  function handlePasswordChange(e) {
    const { name: field, value } = e.target
    setPasswords((prev) => ({ ...prev, [field]: value }))
  }

  const [notifs, setNotifs] = useState({ email: true, updates: true, defense: true })
  const [googleConnected, setGoogleConnected] = useState(false)

  function handleUpdatePassword() {
    if (!passwords.current || !passwords.newPass || !passwords.confirm) {
      showToast('Please fill in all password fields', 'error')
      return
    }
    if (passwords.newPass.length < 8) {
      showToast('New password must be at least 8 characters', 'error')
      return
    }
    if (passwords.newPass !== passwords.confirm) {
      showToast("New passwords don't match", 'error')
      return
    }
    console.log('[TODO] Update password — requires auth backend')
    showToast('Password updated successfully')
    setPasswords({ current: '', newPass: '', confirm: '' })
  }

  function handleSignOutEverywhere() {
    console.log('[TODO] Sign out everywhere — single device in this demo')
    clearState()
    navigate('/')
  }

  const motionDelay = (i) => ({ delay: i * 0.08 + 0.06, duration: 0.42, ease: [0.22, 1, 0.36, 1] })

  return (
    <div
      className="min-h-screen"
      style={{
        background: 'var(--bg-base)',
        backgroundImage: 'var(--dot-bg-image)',
        backgroundSize: '28px 28px',
      }}
    >
      <SettingsNavbar initials={initials} name={name} />

      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="font-serif text-3xl leading-none" style={{ color: 'var(--text-primary)' }}>Settings</h1>
          <p className="font-sans text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Manage your account preferences and security.
          </p>
        </motion.div>

        {/* ── Section 1: Change Password ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionDelay(1)}
          className="mt-8 p-8"
          style={cardStyle}
        >
          <SectionLabel>Change Password</SectionLabel>

          <div className="flex flex-col gap-5">
            <PasswordInput
              label="Current Password"
              name="current"
              value={passwords.current}
              onChange={handlePasswordChange}
            />
            <PasswordInput
              label="New Password"
              name="newPass"
              value={passwords.newPass}
              onChange={handlePasswordChange}
              showStrength
            />
            <PasswordInput
              label="Confirm New Password"
              name="confirm"
              value={passwords.confirm}
              onChange={handlePasswordChange}
            />

            <motion.button
              whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(59,130,246,0.4)' }}
              whileTap={{ scale: 0.97 }}
              onClick={handleUpdatePassword}
              className="font-sans font-semibold text-white rounded-xl px-6 py-3 cursor-pointer transition-all duration-200 self-start mt-1 border-0"
              style={{ background: '#2563EB' }}
            >
              Update Password
            </motion.button>
          </div>
        </motion.div>

        {/* ── Section 2: Notification Preferences ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionDelay(2)}
          className="mt-6 p-8"
          style={cardStyle}
        >
          <SectionLabel>Notifications</SectionLabel>

          <div className="flex flex-col gap-5">
            <ToggleRow
              title="Email reminders"
              desc="Get weekly reminders to keep your FYP on track"
              checked={notifs.email}
              onChange={() => setNotifs((p) => ({ ...p, email: !p.email }))}
            />
            <div className="border-t" style={{ borderColor: 'var(--border-color)' }} />
            <ToggleRow
              title="Product updates"
              desc="Hear about new FYPro features and improvements"
              checked={notifs.updates}
              onChange={() => setNotifs((p) => ({ ...p, updates: !p.updates }))}
            />
            <div className="border-t" style={{ borderColor: 'var(--border-color)' }} />
            <ToggleRow
              title="Defense tips"
              desc="Receive exam preparation tips before your defense date"
              checked={notifs.defense}
              onChange={() => setNotifs((p) => ({ ...p, defense: !p.defense }))}
            />
          </div>
        </motion.div>

        {/* ── Section 3: Appearance ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionDelay(3)}
          className="mt-6 p-8"
          style={cardStyle}
        >
          <SectionLabel>Appearance</SectionLabel>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div>
              <div className="font-sans text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Theme</div>
              <div className="font-sans text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                {theme === 'dark' ? 'Dark mode is active' : 'Light mode is active'}
              </div>
            </div>
            <div
              className="flex items-center gap-1 p-1 rounded-xl"
              style={{ background: 'var(--bg-input)', border: '1px solid var(--border-color)' }}
            >
              <button
                onClick={() => theme !== 'dark' && toggleTheme()}
                className="flex items-center gap-2 font-sans text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer border-0"
                style={{
                  background: theme === 'dark' ? '#2563EB' : 'transparent',
                  color: theme === 'dark' ? '#fff' : 'var(--text-muted)',
                }}
              >
                <MoonIcon /> Dark
              </button>
              <button
                onClick={() => theme !== 'light' && toggleTheme()}
                className="flex items-center gap-2 font-sans text-sm font-semibold px-4 py-2 rounded-lg transition-all duration-200 cursor-pointer border-0"
                style={{
                  background: theme === 'light' ? '#2563EB' : 'transparent',
                  color: theme === 'light' ? '#fff' : 'var(--text-muted)',
                }}
              >
                <SunIcon /> Light
              </button>
            </div>
          </div>
        </motion.div>

        {/* ── Section 4: Connected Accounts ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionDelay(4)}
          className="mt-6 p-8"
          style={cardStyle}
        >
          <SectionLabel>Connected Accounts</SectionLabel>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <GoogleIcon />
              <span className="font-sans text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Google</span>
            </div>

            {googleConnected ? (
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-green-400">Connected</span>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setGoogleConnected(false)}
                  className="font-sans text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 border-0"
                  style={{
                    background: 'rgba(239,68,68,0.15)',
                    color: '#F87171',
                    border: '1px solid rgba(239,68,68,0.3)',
                  }}
                >
                  Disconnect
                </motion.button>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <span className="font-mono text-xs text-slate-500">Not connected</span>
                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={() => setGoogleConnected(true)}
                  className="font-sans text-xs px-3 py-1.5 rounded-lg cursor-pointer transition-all duration-200 border-0"
                  style={{
                    background: 'transparent',
                    color: '#60A5FA',
                    border: '1px solid rgba(59,130,246,0.4)',
                  }}
                >
                  Connect Google
                </motion.button>
              </div>
            )}
          </div>
        </motion.div>

        {/* ── Section 5: Session ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={motionDelay(5)}
          className="mt-6 p-8"
          style={cardStyle}
        >
          <SectionLabel>Session</SectionLabel>

          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-0">
              <div className="font-sans text-sm font-medium" style={{ color: 'var(--text-primary)' }}>Sign out of all devices</div>
              <div className="font-sans text-xs mt-1 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
                This will sign you out of FYPro on every device you're logged in to.
              </div>
            </div>
            <motion.button
              whileHover={{ borderColor: 'rgba(239,68,68,0.4)', color: '#F87171' }}
              whileTap={{ scale: 0.97 }}
              onClick={handleSignOutEverywhere}
              className="flex-shrink-0 font-sans text-sm px-4 py-2 rounded-xl cursor-pointer transition-all duration-200 border-0"
              style={{
                background: 'transparent',
                border: '1px solid var(--border-color)',
                color: 'var(--text-secondary)',
              }}
            >
              Sign Out Everywhere
            </motion.button>
          </div>
        </motion.div>

        <div className="h-12" />
      </div>
    </div>
  )
}
