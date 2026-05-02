import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
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
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.3 } },
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setLoading(true)
    try {
      // Fire reset email — swallow all errors so we never reveal if email is registered
      await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/reset-password`,
      })
    } catch {
      // intentionally swallowed
    } finally {
      setLoading(false)
      setSent(true)
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
          Reset your password
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          className="text-sm text-slate-400 text-center mt-1 mb-8"
        >
          Enter your email and we&apos;ll send you a reset link.
        </motion.p>

        <AnimatePresence mode="wait">
          {sent ? (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.94, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
              className="rounded-xl border border-green-900/60 bg-green-950/40 px-5 py-4 text-center mb-6"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: 'spring', stiffness: 220, damping: 14 }}
                className="flex justify-center mb-2"
              >
                <div className="w-10 h-10 rounded-full bg-green-900/40 border border-green-700/50 flex items-center justify-center">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                </div>
              </motion.div>
              <p className="text-green-400 text-sm font-semibold mb-1">Check your inbox</p>
              <p className="text-slate-400 text-xs">
                If an account exists for {email}, a reset link is on its way.
              </p>
            </motion.div>
          ) : (
            <motion.form
              key="form"
              className="flex flex-col gap-4"
              onSubmit={handleSubmit}
              noValidate
              variants={formStagger}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0, y: -8 }}
            >
              <motion.div variants={fieldVariant} className="flex flex-col gap-1">
                <label htmlFor="reset-email" className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                  Email Address
                </label>
                <input
                  id="reset-email"
                  type="email"
                  placeholder="you@university.edu.ng"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="bg-[var(--bg-input)] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 w-full text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
                />
              </motion.div>

              <motion.button
                variants={fieldVariant}
                type="submit"
                disabled={loading}
                whileHover={!loading ? { y: -2, boxShadow: '0 8px 24px rgba(59,130,246,0.45)' } : {}}
                whileTap={!loading ? { scale: 0.98 } : {}}
                transition={{ duration: 0.15 }}
                className={`w-full bg-blue-600 text-white font-semibold font-sans rounded-xl py-4 transition-colors duration-200 ${loading ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-500'}`}
              >
                {loading ? 'Sending…' : 'Send Reset Link'}
              </motion.button>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Back link */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.55, duration: 0.4 }}
          className="text-center mt-6"
        >
          <Link
            to="/login"
            className="text-slate-400 hover:text-blue-400 text-sm transition-colors"
          >
            ← Back to login
          </Link>
        </motion.div>
      </motion.div>
    </div>
  )
}
