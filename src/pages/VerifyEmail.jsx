import { useState, useEffect } from 'react'
import { useNavigate, useLocation, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'

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

function CheckCircleIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#4ade80" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
      <polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  )
}

function XCircleIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#f87171" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

function SpinnerIcon() {
  return (
    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#60a5fa" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true" style={{ animation: 'spin 1s linear infinite' }}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
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
  const email = location.state?.email || ''

  // waiting | verifying | success | error
  const [phase, setPhase] = useState('waiting')
  // idle | sending | sent | cooldown
  const [resendState, setResendState] = useState('idle')

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const token_hash = params.get('token_hash')
    const type = params.get('type')

    if (token_hash && type) {
      setPhase('verifying')
      supabase.auth.verifyOtp({ token_hash, type })
        .then(({ error }) => {
          if (error) {
            setPhase('error')
          } else {
            setPhase('success')
            setTimeout(() => navigate('/dashboard'), 3000)
          }
        })
    }
  }, [navigate])

  async function handleResend() {
    if (resendState !== 'idle' || !email) return
    setResendState('sending')
    try {
      await supabase.auth.resend({ type: 'signup', email })
    } catch {
      // swallow — never reveal if email is registered
    }
    setResendState('sent')
    setTimeout(() => setResendState('cooldown'), 2000)
    setTimeout(() => setResendState('idle'), 30000)
  }

  function handleOpenEmail() {
    window.location.href = 'mailto:'
  }

  const iconForPhase = {
    waiting: <EnvelopeIcon />,
    verifying: <SpinnerIcon />,
    success: <CheckCircleIcon />,
    error: <XCircleIcon />,
  }

  const iconBg = {
    waiting: 'bg-blue-500/10',
    verifying: 'bg-blue-500/10',
    success: 'bg-green-500/10',
    error: 'bg-red-500/10',
  }

  return (
    <>
      <style>{`@keyframes spin { from { transform: rotate(0deg) } to { transform: rotate(360deg) } }`}</style>
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
          {/* Animated icon */}
          <div className="flex justify-center">
            <motion.div
              key={phase}
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1, y: phase === 'waiting' || phase === 'verifying' ? [0, -7, 0] : 0 }}
              transition={{
                scale: { delay: 0.1, duration: 0.5, type: 'spring', stiffness: 200, damping: 14 },
                opacity: { delay: 0.1, duration: 0.4 },
                y: { delay: 0.6, duration: 2.8, repeat: (phase === 'waiting' || phase === 'verifying') ? Infinity : 0, ease: 'easeInOut' },
              }}
              className={`rounded-full ${iconBg[phase]} p-4`}
            >
              {iconForPhase[phase]}
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            {/* WAITING — just signed up, no token in URL */}
            {phase === 'waiting' && (
              <motion.div
                key="waiting"
                variants={contentStagger}
                initial="hidden"
                animate="visible"
                exit={{ opacity: 0, y: -8 }}
              >
                <motion.h1 variants={blurUp} className="text-2xl font-bold text-white text-center mt-6">
                  Check your email
                </motion.h1>

                <motion.p variants={blurUp} className="text-sm text-slate-400 text-center mt-2">
                  We&apos;ve sent a verification link to
                </motion.p>

                {email && (
                  <motion.div variants={blurUp} className="flex justify-center mt-1">
                    <span className="text-sm text-white font-semibold bg-[var(--bg-input)] rounded-lg px-4 py-2 inline-block">
                      {email}
                    </span>
                  </motion.div>
                )}

                <motion.p variants={blurUp} className="text-sm text-slate-500 text-center mt-4 leading-relaxed max-w-xs mx-auto">
                  Click the link in the email to activate your account. The link expires in 24 hours.
                </motion.p>

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

                <motion.div variants={blurUp} className="flex flex-col gap-3 mt-4 text-center">
                  <AnimatePresence mode="wait">
                    {resendState === 'idle' && (
                      <motion.button
                        key="idle"
                        type="button"
                        onClick={handleResend}
                        disabled={!email}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className={`text-slate-400 hover:text-blue-400 text-sm transition-colors underline-offset-2 hover:underline ${!email ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                      >
                        Resend verification email
                      </motion.button>
                    )}
                    {resendState === 'sending' && (
                      <motion.span key="sending" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-slate-400 text-sm">
                        Sending…
                      </motion.span>
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
                      <motion.span key="cooldown" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="text-slate-600 text-sm cursor-default">
                        Resend verification email
                      </motion.span>
                    )}
                  </AnimatePresence>

                  <Link to="/signup" className="text-slate-500 hover:text-slate-300 text-sm transition-colors">
                    Wrong email? Go back
                  </Link>
                </motion.div>

                <motion.p variants={blurUp} className="text-xs text-slate-600 text-center mt-6">
                  Can&apos;t find the email? Check your spam folder.
                </motion.p>
              </motion.div>
            )}

            {/* VERIFYING — token found, API call in progress */}
            {phase === 'verifying' && (
              <motion.div
                key="verifying"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center"
              >
                <h1 className="text-2xl font-bold text-white mt-6">Verifying…</h1>
                <p className="text-sm text-slate-400 mt-2">Just a moment while we confirm your email.</p>
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
                <h1 className="text-2xl font-bold text-white mt-6">Email verified!</h1>
                <p className="text-sm text-slate-400 mt-2">Your account is active. Redirecting to your dashboard…</p>
                <div className="mt-4 flex justify-center">
                  <div className="h-1 w-48 rounded-full bg-slate-800 overflow-hidden">
                    <motion.div
                      className="h-full bg-green-500 rounded-full"
                      initial={{ width: '0%' }}
                      animate={{ width: '100%' }}
                      transition={{ duration: 3, ease: 'linear' }}
                    />
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigate('/dashboard')}
                  className="mt-6 text-blue-400 hover:text-blue-300 text-sm underline transition-colors"
                >
                  Go now
                </button>
              </motion.div>
            )}

            {/* ERROR — token expired or invalid */}
            {phase === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                className="text-center"
              >
                <h1 className="text-2xl font-bold text-white mt-6">Link expired</h1>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-xs mx-auto">
                  This verification link is invalid or has expired. Request a new one below.
                </p>

                <button
                  type="button"
                  onClick={handleResend}
                  disabled={!email || resendState !== 'idle'}
                  className={`mt-6 w-full bg-blue-600 text-white font-semibold rounded-xl py-4 transition-all duration-200 ${(!email || resendState !== 'idle') ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-500'}`}
                >
                  {resendState === 'sent' ? 'Email sent — check your inbox' : 'Resend verification email'}
                </button>

                <Link to="/signup" className="block mt-4 text-slate-500 hover:text-slate-300 text-sm transition-colors">
                  Back to sign up
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  )
}
