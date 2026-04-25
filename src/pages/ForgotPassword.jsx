import { useState } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'

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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ backgroundColor: '#0A0F1C' }}
    >
      <motion.div
        initial={{ opacity: 0, y: 18 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-md rounded-2xl border border-slate-800 p-10"
        style={{
          backgroundColor: '#0D1425',
          boxShadow: '0 8px 40px rgba(59,130,246,0.08)',
        }}
      >
        {/* Logo + heading */}
        <div className="flex justify-center mb-4">
          <ShieldLogo />
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
                className="bg-[#111827] border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-600 w-full text-sm focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all"
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
