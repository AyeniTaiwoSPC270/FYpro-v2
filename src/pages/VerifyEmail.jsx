import { useState } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'

function EnvelopeIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#60a5fa"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  )
}

const contentStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.09, delayChildren: 0.35 } },
}

const blurUp = {
  hidden: { opacity: 0, y: 10, filter: 'blur(4px)' },
  visible: {
    opacity: 1, y: 0, filter: 'blur(0px)',
    transition: { duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  },
}

export default function VerifyEmail() {
  const navigate = useNavigate()
  const location = useLocation()
  const email = location.state?.email || 'you@example.com'

  const [resendState, setResendState] = useState('idle') // idle | sent | cooldown

  function handleOpenEmail() {
    window.location.href = 'mailto:'
  }

  function handleResend() {
    if (resendState !== 'idle') return
    setResendState('sent')
    setTimeout(() => setResendState('cooldown'), 2000)
    setTimeout(() => setResendState('idle'), 32000)
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
        {/* Envelope icon — float + spring pop */}
        <div className="flex justify-center">
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1, y: [0, -7, 0] }}
            transition={{
              scale: { delay: 0.1, duration: 0.5, type: 'spring', stiffness: 200, damping: 14 },
              opacity: { delay: 0.1, duration: 0.4 },
              y: { delay: 0.6, duration: 2.8, repeat: Infinity, ease: 'easeInOut' },
            }}
            className="rounded-full bg-blue-500/10 p-4"
          >
            <EnvelopeIcon />
          </motion.div>
        </div>

        <motion.div
          variants={contentStagger}
          initial="hidden"
          animate="visible"
        >
          <motion.h1
            variants={blurUp}
            className="text-2xl font-bold text-white text-center mt-6"
          >
            Check your email
          </motion.h1>

          <motion.p variants={blurUp} className="text-sm text-slate-400 text-center mt-2">
            We&apos;ve sent a verification link to
          </motion.p>

          <motion.div variants={blurUp} className="flex justify-center mt-1">
            <span className="text-sm text-white font-semibold bg-[var(--bg-input)] rounded-lg px-4 py-2 inline-block">
              {email}
            </span>
          </motion.div>

          <motion.p
            variants={blurUp}
            className="text-sm text-slate-500 text-center mt-4 leading-relaxed max-w-xs mx-auto"
          >
            Click the link in the email to activate your account. The link expires in 24 hours.
          </motion.p>

          {/* Primary CTA */}
          <motion.button
            variants={blurUp}
            type="button"
            onClick={handleOpenEmail}
            whileHover={{ y: -2, boxShadow: '0 8px 24px rgba(59,130,246,0.45)' }}
            whileTap={{ scale: 0.98 }}
            transition={{ duration: 0.15 }}
            className="mt-8 w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-4 transition-all duration-200"
          >
            Open Email App
          </motion.button>

          {/* Secondary actions */}
          <motion.div variants={blurUp} className="flex flex-col gap-3 mt-4 text-center">
            <AnimatePresence mode="wait">
              {resendState === 'idle' && (
                <motion.button
                  key="idle"
                  type="button"
                  onClick={handleResend}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  whileHover={{ color: '#60a5fa' }}
                  className="text-slate-400 hover:text-blue-400 text-sm transition-colors cursor-pointer underline-offset-2 hover:underline"
                >
                  Resend verification email
                </motion.button>
              )}
              {resendState === 'sent' && (
                <motion.span
                  key="sent"
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="text-green-400 text-sm font-medium"
                >
                  Email sent — check your inbox
                </motion.span>
              )}
              {resendState === 'cooldown' && (
                <motion.span
                  key="cooldown"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.15 }}
                  className="text-slate-600 text-sm cursor-default"
                >
                  Resend verification email
                </motion.span>
              )}
            </AnimatePresence>

            <Link
              to="/signup"
              className="text-slate-500 hover:text-slate-300 text-sm transition-colors"
            >
              Wrong email? Go back
            </Link>
          </motion.div>

          <motion.p
            variants={blurUp}
            className="text-xs text-slate-600 text-center mt-6"
          >
            Can&apos;t find the email? Check your spam folder.
          </motion.p>
        </motion.div>
      </motion.div>
    </div>
  )
}
