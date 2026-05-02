import { useState, useEffect } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

// ─── Icons ────────────────────────────────────────────────────────────────────

const SHIELD_D = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

function ShieldLogo() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={46} height={46} fill="#0066FF" aria-hidden="true" style={{ filter: 'drop-shadow(0 0 14px rgba(0,102,255,0.55))' }}>
      <path d={SHIELD_D} />
    </svg>
  )
}

function EyeIcon({ open }) {
  return open ? (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ) : (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

// ─── Animation variants ───────────────────────────────────────────────────────

const fieldVariant = {
  hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
}

const formStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.15 } },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ResetPassword() {
  const navigate = useNavigate()

  // loading | form | updating | success | invalid
  const [phase, setPhase] = useState('loading')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [fieldError, setFieldError] = useState('')

  // On mount: read token_hash + type=recovery from URL and verify OTP.
  // Supabase password reset emails use this PKCE-style token approach.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token_hash = params.get('token_hash')
    const type = params.get('type')

    if (token_hash && type === 'recovery') {
      supabase.auth.verifyOtp({ token_hash, type: 'recovery' })
        .then(({ error }) => {
          if (error) {
            setPhase('invalid')
          } else {
            // Strip the token from the URL so back/refresh doesn't re-use it
            window.history.replaceState({}, '', window.location.pathname)
            setPhase('form')
          }
        })
      return
    }

    // Fallback: Supabase may fire PASSWORD_RECOVERY via onAuthStateChange
    // when the page loads with a recovery fragment (#access_token=...).
    // Check for an active session from that flow.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        window.history.replaceState({}, '', window.location.pathname)
        setPhase('form')
      }
    })

    // If no token in URL and no PASSWORD_RECOVERY event arrives quickly,
    // treat the link as invalid.
    const timeout = setTimeout(() => {
      setPhase((prev) => (prev === 'loading' ? 'invalid' : prev))
    }, 2000)

    return () => {
      subscription.unsubscribe()
      clearTimeout(timeout)
    }
  }, [])

  function validate() {
    if (password.length < 8) return 'Password must be at least 8 characters.'
    if (password !== confirm) return 'Passwords do not match.'
    return ''
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const err = validate()
    if (err) { setFieldError(err); return }
    setFieldError('')
    setPhase('updating')

    const { error } = await supabase.auth.updateUser({ password })
    if (error) {
      setFieldError(error.message || 'Something went wrong. Please try again.')
      setPhase('form')
      return
    }

    // Sign out ALL sessions so any stolen session tokens are invalidated.
    await supabase.auth.signOut({ scope: 'global' })
    setPhase('success')
    setTimeout(() => navigate('/login'), 3500)
  }

  // ─── Render ──────────────────────────────────────────────────────────────────

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
        {/* Logo */}
        <motion.div
          className="flex justify-center mb-4"
          animate={{ y: [0, -7, 0] }}
          transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
        >
          <ShieldLogo />
        </motion.div>

        <AnimatePresence mode="wait">

          {/* LOADING — verifying recovery token */}
          {phase === 'loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="text-center"
            >
              <div className="flex justify-center mt-2 mb-4">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
              </div>
              <p className="text-slate-400 text-sm">Verifying your reset link…</p>
            </motion.div>
          )}

          {/* FORM — recovery session active, collect new password */}
          {(phase === 'form' || phase === 'updating') && (
            <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              <motion.h1
                initial={{ opacity: 0, y: 8, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                transition={{ delay: 0.08, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="text-2xl font-bold text-white text-center mt-1"
              >
                Set a new password
              </motion.h1>
              <motion.p
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="text-sm text-slate-400 text-center mt-1 mb-8"
              >
                Choose a strong password for your FYPro account.
              </motion.p>

              <motion.form
                variants={formStagger}
                initial="hidden"
                animate="visible"
                className="flex flex-col gap-4"
                onSubmit={handleSubmit}
                noValidate
              >
                {/* New password */}
                <motion.div variants={fieldVariant} className="flex flex-col gap-1">
                  <label htmlFor="rp-password" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    New Password
                  </label>
                  <div className="relative">
                    <input
                      id="rp-password"
                      type={showPassword ? 'text' : 'password'}
                      placeholder="At least 8 characters"
                      value={password}
                      onChange={(e) => { setPassword(e.target.value); setFieldError('') }}
                      className="bg-[var(--bg-input)] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 w-full text-sm pr-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                      autoComplete="new-password"
                      disabled={phase === 'updating'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      <EyeIcon open={showPassword} />
                    </button>
                  </div>
                </motion.div>

                {/* Confirm password */}
                <motion.div variants={fieldVariant} className="flex flex-col gap-1">
                  <label htmlFor="rp-confirm" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <input
                      id="rp-confirm"
                      type={showConfirm ? 'text' : 'password'}
                      placeholder="Repeat your new password"
                      value={confirm}
                      onChange={(e) => { setConfirm(e.target.value); setFieldError('') }}
                      className="bg-[var(--bg-input)] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 w-full text-sm pr-11 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                      autoComplete="new-password"
                      disabled={phase === 'updating'}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirm((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                      aria-label={showConfirm ? 'Hide password' : 'Show password'}
                      tabIndex={-1}
                    >
                      <EyeIcon open={showConfirm} />
                    </button>
                  </div>
                </motion.div>

                {/* Inline field error */}
                <AnimatePresence>
                  {fieldError && (
                    <motion.p
                      key="err"
                      initial={{ opacity: 0, y: -4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -4 }}
                      transition={{ duration: 0.2 }}
                      className="text-red-400 text-xs text-center -mt-1"
                      role="alert"
                    >
                      {fieldError}
                    </motion.p>
                  )}
                </AnimatePresence>

                <motion.button
                  variants={fieldVariant}
                  type="submit"
                  disabled={phase === 'updating'}
                  whileHover={phase !== 'updating' ? { y: -2, boxShadow: '0 8px 24px rgba(59,130,246,0.45)' } : {}}
                  whileTap={phase !== 'updating' ? { scale: 0.98 } : {}}
                  transition={{ duration: 0.15 }}
                  className={`w-full bg-blue-600 text-white font-semibold font-sans rounded-xl py-4 transition-colors duration-200 ${phase === 'updating' ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-500'}`}
                >
                  {phase === 'updating' ? 'Updating password…' : 'Set New Password'}
                </motion.button>
              </motion.form>
            </motion.div>
          )}

          {/* SUCCESS */}
          {phase === 'success' && (
            <motion.div
              key="success"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <div className="flex justify-center mb-4">
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 14 }}
                  className="w-14 h-14 rounded-full bg-green-900/40 border border-green-700/50 flex items-center justify-center"
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </motion.div>
              </div>
              <h1 className="text-2xl font-bold text-white mt-2">Password updated</h1>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-xs mx-auto">
                All sessions have been signed out. Redirecting you to login…
              </p>
              <div className="mt-5 flex justify-center">
                <div className="h-1 w-48 rounded-full bg-slate-800 overflow-hidden">
                  <motion.div
                    className="h-full bg-green-500 rounded-full"
                    initial={{ width: '0%' }}
                    animate={{ width: '100%' }}
                    transition={{ duration: 3.5, ease: 'linear' }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="mt-4 text-blue-400 hover:text-blue-300 text-sm underline transition-colors"
              >
                Go now
              </button>
            </motion.div>
          )}

          {/* INVALID — token expired or never existed */}
          {phase === 'invalid' && (
            <motion.div
              key="invalid"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="text-center"
            >
              <div className="flex justify-center mb-4">
                <div className="w-14 h-14 rounded-full bg-red-900/30 border border-red-700/40 flex items-center justify-center">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <circle cx="12" cy="12" r="10" />
                    <line x1="15" y1="9" x2="9" y2="15" />
                    <line x1="9" y1="9" x2="15" y2="15" />
                  </svg>
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white mt-2">Link expired</h1>
              <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-xs mx-auto">
                This password reset link is invalid or has expired. Reset links expire after 1 hour.
              </p>
              <Link
                to="/forgot-password"
                className="mt-6 inline-block w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-4 transition-colors duration-200 text-sm"
              >
                Request a new link
              </Link>
              <Link
                to="/login"
                className="block mt-4 text-slate-500 hover:text-slate-300 text-sm transition-colors"
              >
                Back to login
              </Link>
            </motion.div>
          )}

        </AnimatePresence>
      </motion.div>
    </div>
  )
}
