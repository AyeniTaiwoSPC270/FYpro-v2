import { useState, useRef, useEffect } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'

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

function ProfileNavbar({ initials, name }) {
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
        background: '#070C18',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}
    >
      {/* Logo */}
      <Link to="/dashboard" className="flex items-center gap-2.5 no-underline">
        <ShieldIcon size={26} />
        <span className="font-serif text-[1.35rem] text-white leading-none">
          FY<span style={{ color: '#0066FF' }}>Pro</span>
        </span>
      </Link>

      {/* Right controls */}
      <div className="flex items-center gap-2.5">
        {/* Bell */}
        <motion.button
          whileHover={{ scale: 1.09 }}
          whileTap={{ scale: 0.94 }}
          aria-label="Notifications"
          className="relative w-[38px] h-[38px] flex items-center justify-center rounded-xl cursor-pointer text-slate-400 hover:text-white transition-all duration-200"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
          <BellIcon />
          <span
            aria-hidden="true"
            className="absolute top-[9px] right-[9px] w-[7px] h-[7px] rounded-full"
            style={{ background: '#0066FF', border: '1.5px solid #070C18' }}
          />
        </motion.button>

        {/* Avatar + dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Open user menu"
            aria-expanded={open}
            className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-xl cursor-pointer transition-all duration-200"
            style={{
              background: open ? 'rgba(255,255,255,0.07)' : 'transparent',
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
                  background: '#0D1425',
                  border: '1px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 16px 40px rgba(0,0,0,0.5)',
                  top: '100%',
                }}
              >
                <div className="px-4 py-3 border-b border-slate-800/80">
                  <div className="font-sans text-[0.8rem] font-semibold text-white truncate">{name}</div>
                  <div className="font-mono text-[0.65rem] text-slate-500 mt-0.5">Free Plan</div>
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
                    onClick={() => { clearState(); navigate('/') }}
                    className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
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
      style={{ color: danger ? '#F87171' : 'rgba(148,163,184,0.8)' }}
    >
      {children}
    </div>
  )
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
  'w-full bg-[#111827] border border-[#1E293B] rounded-xl px-4 py-3 text-white font-sans text-[0.875rem] outline-none transition-all duration-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 placeholder:text-slate-600'

// ─── Profile Page ─────────────────────────────────────────────────────────────

export default function Profile() {
  const { state, clearState } = useApp()
  const navigate = useNavigate()

  const completedCount = state.stepsCompleted.filter(Boolean).length

  const [form, setForm] = useState({
    name:       'Taiwo Ayeni',
    email:      'taiwo@example.com',
    university: state.university  || 'University of Lagos',
    faculty:    state.faculty     || 'Faculty of Engineering',
    department: state.department  || 'Metallurgical & Materials Engineering',
    level:      state.level       || '200',
  })

  const initials = form.name
    .split(' ')
    .map((w) => w[0] ?? '')
    .join('')
    .slice(0, 2)
    .toUpperCase()

  function handleChange(e) {
    const { name, value } = e.target
    setForm((prev) => ({ ...prev, [name]: value }))
  }

  const cardStyle = {
    background: '#0D1425',
    borderRadius: '1rem',
    border: '1px solid #1E293B',
  }

  return (
    <div
      className="min-h-screen"
      style={{
        background: '#0A0F1C',
        backgroundImage: 'radial-gradient(circle, rgba(0,102,255,0.045) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      }}
    >
      <ProfileNavbar initials={initials} name={form.name} />

      <div className="max-w-3xl mx-auto px-6 py-12">

        {/* Page header */}
        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="font-serif text-3xl text-white leading-none">Your Profile</h1>
          <p className="font-sans text-sm text-slate-400 mt-1">
            Manage your personal information and account details.
          </p>
        </motion.div>

        {/* ── Section 1: Avatar + Name ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="mt-8 p-8 flex flex-col sm:flex-row gap-6 items-start"
          style={cardStyle}
        >
          {/* Avatar */}
          <div className="flex flex-col items-center flex-shrink-0">
            <div
              className="w-20 h-20 rounded-full flex items-center justify-center"
              style={{
                background: 'rgba(59,130,246,0.2)',
                border: '2px solid #3B82F6',
              }}
            >
              <span className="font-serif text-2xl text-blue-400 leading-none">{initials}</span>
            </div>
            <button
              className="mt-2 font-sans text-xs text-blue-400 hover:text-blue-300 cursor-pointer transition-colors duration-150 bg-transparent border-0 p-0"
            >
              Change Photo
            </button>
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="font-sans text-xl font-semibold text-white leading-tight">{form.name}</div>
            <div className="font-sans text-sm text-slate-400 mt-1">{form.email}</div>
            <div className="font-mono text-xs text-slate-500 mt-2">Member since April 2026</div>
            <div className="flex items-center flex-wrap gap-3 mt-3">
              <span
                className="font-mono text-xs font-semibold px-3 py-1 rounded-full inline-block"
                style={{
                  background: 'rgba(59,130,246,0.2)',
                  color: '#60A5FA',
                  border: '1px solid rgba(59,130,246,0.3)',
                }}
              >
                Free Plan
              </span>
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
          className="mt-6 p-8"
          style={cardStyle}
        >
          <SectionLabel>Personal Information</SectionLabel>

          <div className="flex flex-col gap-5">
            <FormField label="Full Name">
              <input
                className={inputCls}
                type="text"
                name="name"
                value={form.name}
                onChange={handleChange}
                autoComplete="name"
              />
            </FormField>

            <FormField label="Email Address" hint="Email changes require verification">
              <input
                className={inputCls}
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                autoComplete="email"
              />
            </FormField>

            <FormField label="University">
              <input
                className={inputCls}
                type="text"
                name="university"
                value={form.university}
                onChange={handleChange}
              />
            </FormField>

            <FormField label="Faculty">
              <input
                className={inputCls}
                type="text"
                name="faculty"
                value={form.faculty}
                onChange={handleChange}
              />
            </FormField>

            <FormField label="Department">
              <input
                className={inputCls}
                type="text"
                name="department"
                value={form.department}
                onChange={handleChange}
              />
            </FormField>

            <FormField label="Level">
              <select
                className={inputCls}
                name="level"
                value={form.level}
                onChange={handleChange}
                style={{ appearance: 'none', cursor: 'pointer' }}
              >
                {['100', '200', '300', '400', '500'].map((l) => (
                  <option key={l} value={l}>{l} Level</option>
                ))}
              </select>
            </FormField>

            <motion.button
              whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(59,130,246,0.4)' }}
              whileTap={{ scale: 0.97 }}
              className="font-sans font-semibold text-white rounded-xl px-6 py-3 cursor-pointer transition-all duration-200 self-start mt-2"
              style={{ background: '#2563EB', border: 'none' }}
            >
              Save Changes
            </motion.button>
          </div>
        </motion.div>

        {/* ── Section 3: Academic Information ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.24, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 p-8"
          style={cardStyle}
        >
          <SectionLabel>Academic Information</SectionLabel>

          <div className="flex gap-4">
            {[
              { label: 'Projects Started', value: '1' },
              { label: 'Steps Completed', value: `${completedCount} of 6` },
              { label: 'Last Active',      value: 'Today' },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex-1 rounded-xl p-4"
                style={{ background: '#111827' }}
              >
                <div className="font-sans text-2xl font-bold text-white leading-none">{value}</div>
                <div className="font-mono text-xs text-slate-500 uppercase tracking-wider mt-1.5">{label}</div>
              </div>
            ))}
          </div>
        </motion.div>

        {/* ── Section 4: Danger Zone ── */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.32, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
          className="mt-6 p-8"
          style={{ ...cardStyle, borderColor: 'rgba(239,68,68,0.2)' }}
        >
          <SectionLabel danger>Danger Zone</SectionLabel>

          {[
            {
              title: 'Delete all projects',
              desc:  'Permanently delete all your FYP projects and results. This cannot be undone.',
              label: 'Delete Projects',
            },
            {
              title: 'Delete account',
              desc:  'Permanently delete your FYPro account and all associated data.',
              label: 'Delete Account',
            },
          ].map((item, i) => (
            <div
              key={item.title}
              className={`flex items-center justify-between gap-4 ${
                i < 1 ? 'border-b border-[#1E293B] pb-4 mb-4' : ''
              }`}
            >
              <div className="flex-1 min-w-0">
                <div className="font-sans text-sm font-medium text-white">{item.title}</div>
                <div className="font-sans text-xs text-slate-500 mt-1 leading-relaxed">{item.desc}</div>
              </div>
              <motion.button
                whileHover={{ background: 'rgba(239,68,68,0.1)' }}
                whileTap={{ scale: 0.97 }}
                className="flex-shrink-0 font-sans text-sm text-red-400 rounded-xl px-4 py-2 cursor-pointer transition-all duration-200"
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(239,68,68,0.4)',
                }}
              >
                {item.label}
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
