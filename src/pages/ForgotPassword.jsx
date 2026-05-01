import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

// ─── Shared primitives ────────────────────────────────────────────────────────


// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: 'var(--bg-base)' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-2xl border border-slate-800 p-10"
        style={{
          backgroundColor: 'var(--bg-card)',
          boxShadow: '0 8px 40px rgba(59,130,246,0.08)',
        }}
      >
        {/* Logo + heading */}
        <div className="flex justify-center mb-4">
          <img src="/fypro-logo.png" alt="FYPro" height="40" style={{ objectFit: 'contain' }} />
        </div>
        <h1 className="text-2xl font-bold text-white text-center mt-1">Reset your password</h1>
        <p className="text-sm text-slate-400 text-center mt-1 mb-8">
          Enter your email and we&apos;ll send you a reset link.
        </p>

        {sent ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.3 }}
            className="rounded-xl border border-green-900/60 bg-green-950/40 px-5 py-4 text-center mb-6"
          >
            <p className="text-green-400 text-sm font-semibold mb-1">Check your inbox</p>
            <p className="text-slate-400 text-xs">If an account exists for {email}, a reset link is on its way.</p>
          </motion.div>
        ) : (
          <form
            className="flex flex-col gap-4"
            onSubmit={(e) => { e.preventDefault(); setSent(true) }}
            noValidate
          >
            <div className="flex flex-col gap-1">
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
            </div>

            <motion.button
              type="submit"
              whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(59,130,246,0.4)' }}
              whileTap={{ scale: 0.98 }}
              transition={{ duration: 0.15 }}
              className="w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold font-sans rounded-xl py-4 transition-colors duration-200"
            >
              Send Reset Link
            </motion.button>
          </form>
        )}

        {/* Back link */}
        <div className="text-center mt-6">
          <Link
            to="/login"
            className="text-slate-400 hover:text-blue-400 text-sm transition-colors"
          >
            ← Back to login
          </Link>
        </div>
      </motion.div>
    </div>
  )
}
