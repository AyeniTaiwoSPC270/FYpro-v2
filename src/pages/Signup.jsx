import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { showToast } from '../components/Toast'
import { supabase } from '../lib/supabase'

// ─── Shared primitives ────────────────────────────────────────────────────────

const SHIELD_D = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

function ShieldLogo() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 256 256"
      width={46}
      height={46}
      fill="#0066FF"
      aria-hidden="true"
      style={{ filter: 'drop-shadow(0 0 14px rgba(0,102,255,0.55))' }}
    >
      <path d={SHIELD_D} />
    </svg>
  )
}

function EyeOpen() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeClosed() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
    </svg>
  )
}

function PasswordInput({ label, id, placeholder, value, onChange }) {
  const [show, setShow] = useState(false)
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          placeholder={placeholder}
          value={value}
          onChange={onChange}
          className="bg-[var(--bg-input)] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 w-full text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all pr-11"
        />
        <button
          type="button"
          onClick={() => setShow(s => !s)}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
          aria-label={show ? 'Hide password' : 'Show password'}
        >
          {show ? <EyeOpen /> : <EyeClosed />}
        </button>
      </div>
    </div>
  )
}

function TextInput({ label, id, type = 'text', placeholder, value, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
        {label}
      </label>
      <input
        id={id}
        type={type}
        placeholder={placeholder}
        value={value}
        onChange={onChange}
        className="bg-[var(--bg-input)] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 w-full text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
      />
    </div>
  )
}

function ConsentCheckbox({ agreed, onChange }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="flex items-start gap-3 cursor-pointer" htmlFor="consent">
        <div className="relative flex-shrink-0 mt-0.5">
          <input
            type="checkbox"
            id="consent"
            checked={agreed}
            onChange={onChange}
            className="sr-only"
          />
          <motion.div
            animate={{ backgroundColor: agreed ? '#2563EB' : 'var(--bg-input)', borderColor: agreed ? '#2563EB' : 'rgb(51,65,85)' }}
            transition={{ duration: 0.2 }}
            className="w-4 h-4 rounded flex items-center justify-center border"
          >
            {agreed && (
              <motion.svg
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ duration: 0.2, type: 'spring', stiffness: 260, damping: 18 }}
                width="10" height="8" viewBox="0 0 10 8" fill="none" aria-hidden="true"
              >
                <path d="M1 4L3.5 6.5L9 1" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </motion.svg>
            )}
          </motion.div>
        </div>
        <span className="text-sm text-slate-400 leading-snug">
          I agree to FYPro&apos;s{' '}
          <Link to="/terms" className="text-blue-400 hover:text-blue-300 transition-colors">
            Terms of Service
          </Link>
          {' '}and{' '}
          <Link to="/privacy" className="text-blue-400 hover:text-blue-300 transition-colors">
            Privacy Policy
          </Link>
        </span>
      </label>
    </div>
  )
}

function OrDivider() {
  return (
    <div className="flex items-center gap-3 my-2">
      <div className="flex-1 h-px bg-slate-700/70" />
      <span className="text-slate-500 text-xs font-mono">or continue with</span>
      <div className="flex-1 h-px bg-slate-700/70" />
    </div>
  )
}

// ─── Animation variants ───────────────────────────────────────────────────────

const formStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.28 } },
}

const fieldVariant = {
  hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function mapSupabaseError(error) {
  const msg = error?.message ?? ''
  if (msg.includes('Password should be at least') || msg.toLowerCase().includes('weak password')) {
    return 'Password must be at least 8 characters'
  }
  if (
    msg.toLowerCase().includes('user already registered') ||
    msg.toLowerCase().includes('already exists') ||
    msg.toLowerCase().includes('email address is already')
  ) {
    return 'An account with this email already exists'
  }
  if (
    msg.toLowerCase().includes('network') ||
    msg.toLowerCase().includes('fetch') ||
    msg.toLowerCase().includes('failed to fetch')
  ) {
    return 'Connection failed. Check your internet and try again.'
  }
  return msg || 'Something went wrong. Please try again.'
}

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', email: '', university: '', password: '', confirm: '' })
  const [agreed, setAgreed] = useState(false)
  const [consentError, setConsentError] = useState(false)
  const [authError, setAuthError] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const set = (field) => (e) => setForm(f => ({ ...f, [field]: e.target.value }))

  async function handleSubmit(e) {
    e.preventDefault()
    setAuthError('')

    if (!agreed) { setConsentError(true); return }

    if (form.password.length < 8) {
      setAuthError('Password must be at least 8 characters')
      return
    }

    if (form.password !== form.confirm) {
      setAuthError('Passwords do not match')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signUp({
        email: form.email,
        password: form.password,
        options: {
          data: {
            full_name: form.name,
            university: form.university,
          },
        },
      })

      if (error) {
        setAuthError(mapSupabaseError(error))
      } else {
        setSuccess(true)
      }
    } catch (err) {
      setAuthError('Connection failed. Check your internet and try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-2xl border border-slate-800 p-10"
        style={{
          backgroundColor: 'var(--bg-card)',
          boxShadow: '0 8px 40px rgba(59,130,246,0.08)',
        }}
      >
        {/* Floating logo */}
        <motion.div
          className="flex justify-center mb-4"
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ShieldLogo />
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.18, duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
          className="text-2xl font-bold text-white text-center mt-1"
        >
          Create your account
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-sm text-slate-400 text-center mt-1 mb-8"
        >
          Your FYP journey starts here.
        </motion.p>

        {success ? (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="rounded-xl border border-green-700/50 bg-green-900/20 px-5 py-4 text-center"
          >
            <p className="text-green-400 font-semibold text-sm">Check your email to verify your account</p>
            <p className="text-slate-400 text-xs mt-1">We sent a link to <span className="text-white">{form.email}</span></p>
          </motion.div>
        ) : (

        <>
        {/* Form */}
        <motion.form
          className="flex flex-col gap-4"
          onSubmit={handleSubmit}
          noValidate
          variants={formStagger}
          initial="hidden"
          animate="visible"
        >
          <motion.div variants={fieldVariant}>
            <TextInput
              label="Full Name"
              id="signup-name"
              placeholder="e.g. Adaeze Okonkwo"
              value={form.name}
              onChange={set('name')}
            />
          </motion.div>

          <motion.div variants={fieldVariant}>
            <TextInput
              label="Email Address"
              id="signup-email"
              type="email"
              placeholder="you@university.edu.ng"
              value={form.email}
              onChange={set('email')}
            />
          </motion.div>

          <motion.div variants={fieldVariant}>
            <TextInput
              label="University"
              id="signup-university"
              placeholder="e.g. University of Lagos"
              value={form.university}
              onChange={set('university')}
            />
          </motion.div>

          <motion.div variants={fieldVariant}>
            <PasswordInput
              label="Password"
              id="signup-password"
              placeholder="••••••••"
              value={form.password}
              onChange={set('password')}
            />
          </motion.div>

          <motion.div variants={fieldVariant}>
            <PasswordInput
              label="Confirm Password"
              id="signup-confirm"
              placeholder="••••••••"
              value={form.confirm}
              onChange={set('confirm')}
            />
          </motion.div>

          <motion.div variants={fieldVariant}>
            <ConsentCheckbox
              agreed={agreed}
              onChange={(e) => { setAgreed(e.target.checked); if (e.target.checked) setConsentError(false) }}
            />
            {consentError && (
              <motion.p
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-red-400 text-xs mt-1"
              >
                Please agree to the Terms of Service and Privacy Policy to continue.
              </motion.p>
            )}
          </motion.div>

          {authError && (
            <motion.p
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-red-400 text-xs text-center"
            >
              {authError}
            </motion.p>
          )}

          <motion.button
            variants={fieldVariant}
            type="submit"
            disabled={!agreed || loading}
            whileHover={agreed && !loading ? { y: -2, boxShadow: '0 8px 24px rgba(59,130,246,0.45)' } : {}}
            whileTap={agreed && !loading ? { scale: 0.98 } : {}}
            transition={{ duration: 0.15 }}
            className={`mt-2 w-full bg-blue-600 text-white font-semibold font-sans rounded-xl py-4 transition-colors duration-200 ${
              agreed && !loading ? 'hover:bg-blue-500' : 'opacity-50 cursor-not-allowed'
            }`}
          >
            {loading ? 'Creating account…' : 'Create Account'}
          </motion.button>
        </motion.form>
        </>
        )}

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.85, duration: 0.4 }}
        >
          <OrDivider />

          <motion.button
            type="button"
            whileHover={{ borderColor: 'rgba(100,116,139,0.65)', y: -1 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => {
              console.log('[TODO] Google OAuth — requires auth provider (Firebase/Supabase)')
              showToast('Google sign-in coming soon')
            }}
            className="bg-[var(--bg-input)] border border-slate-700 rounded-xl py-3 w-full flex items-center justify-center gap-3 text-white text-sm font-sans transition-all"
          >
            <GoogleIcon />
            Continue with Google
          </motion.button>

          <p className="text-slate-400 text-sm text-center mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-blue-400 hover:text-blue-300 transition-colors">
              Log in
            </Link>
          </p>
        </motion.div>
      </motion.div>
    </div>
  )
}
