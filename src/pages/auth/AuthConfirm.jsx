import { useEffect, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'

function SpinnerIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#60a5fa"
      strokeWidth="1.5"
      strokeLinecap="round"
      aria-hidden="true"
      style={{ animation: 'spin 1s linear infinite' }}
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}

function XCircleIcon() {
  return (
    <svg
      width="48"
      height="48"
      viewBox="0 0 24 24"
      fill="none"
      stroke="#f87171"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <line x1="15" y1="9" x2="9" y2="15" />
      <line x1="9" y1="9" x2="15" y2="15" />
    </svg>
  )
}

// phase: 'processing' | 'error'
export default function AuthConfirm() {
  const navigate = useNavigate()
  const [phase, setPhase] = useState('processing')
  const [errorMsg, setErrorMsg] = useState('')

  useEffect(() => {
    const hash        = new URLSearchParams(window.location.hash.slice(1))
    const params      = new URLSearchParams(window.location.search)
    const access_token  = hash.get('access_token')
    const refresh_token = hash.get('refresh_token')
    const code          = params.get('code')
    const token_hash    = params.get('token_hash')
    const type          = params.get('type')

    async function confirm() {
      let error = null

      if (access_token && refresh_token) {
        // Implicit flow — tokens arrive in the URL hash fragment.
        const hashType = hash.get('type')
        ;({ error } = await supabase.auth.setSession({ access_token, refresh_token }))
        window.history.replaceState(null, '', window.location.pathname)
        if (error) {
          setErrorMsg(error.message || 'Confirmation failed. The link may have expired.')
          setPhase('error')
        } else {
          navigate(hashType === 'signup' ? '/start' : '/dashboard', { replace: true })
        }
        return
      }

      if (token_hash && type) {
        ;({ error } = await supabase.auth.verifyOtp({ token_hash, type }))
      } else if (code) {
        const { data: oauthData, error: oauthError } = await supabase.auth.exchangeCodeForSession(code)
        if (!oauthError && oauthData?.user) {
          const u = oauthData.user
          // Route to onboarding if the user has never completed it (new Google user)
          const hasOnboarded = u.user_metadata?.onboarding_completed === true
          window.history.replaceState(null, '', window.location.pathname)

          // Ensure a profile row exists for this Google user.
          // ignoreDuplicates: true means returning users are completely unaffected.
          const { error: upsertErr } = await supabase.from('users').upsert({
            id:         u.id,
            email:      u.email ?? '',
            full_name:  u.user_metadata?.full_name || u.user_metadata?.name || null,
            avatar_url: u.user_metadata?.avatar_url || u.user_metadata?.picture || null,
          }, { onConflict: 'id', ignoreDuplicates: true })
          if (upsertErr) {
            console.error('[auth/callback] profile upsert failed:', upsertErr.message)
            // Non-fatal — onboarding will collect and save profile data
          }

          // Alert admin of new Google signup (fire-and-forget, never blocks navigation)
          if (!hasOnboarded && oauthData.session?.access_token) {
            fetch('/api/notify', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${oauthData.session.access_token}`,
              },
              body: JSON.stringify({ action: 'oauth_signup' }),
            }).catch(() => {})
          }
          navigate(hasOnboarded ? '/dashboard' : '/start', { replace: true })
          return
        }
        error = oauthError
      } else {
        // No params — Supabase OTP flow authenticates before redirecting here.
        // Check whether a session was already established.
        const { data: sessionData } = await supabase.auth.getSession()
        if (sessionData?.session) {
          window.history.replaceState(null, '', window.location.pathname)
          navigate('/dashboard', { replace: true })
        } else {
          setErrorMsg('No confirmation token found. The link may be invalid or already used.')
          setPhase('error')
        }
        return
      }

      if (error) {
        setErrorMsg(error.message || 'Confirmation failed. The link may have expired.')
        setPhase('error')
        return
      }

      window.history.replaceState(null, '', window.location.pathname)
      navigate('/dashboard', { replace: true })
    }

    confirm()
  }, [navigate])

  const iconBg = phase === 'error' ? 'bg-red-500/10' : 'bg-blue-500/10'

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
          className="w-full max-w-md rounded-2xl border border-slate-800 p-10 text-center"
          style={{
            backgroundColor: 'var(--bg-card)',
            boxShadow: '0 8px 40px rgba(59,130,246,0.08)',
          }}
        >
          <div className="flex justify-center">
            <motion.div
              key={phase}
              initial={{ scale: 0, opacity: 0 }}
              animate={{
                scale: 1,
                opacity: 1,
                y: phase === 'processing' ? [0, -7, 0] : 0,
              }}
              transition={{
                scale:   { delay: 0.1, duration: 0.5, type: 'spring', stiffness: 200, damping: 14 },
                opacity: { delay: 0.1, duration: 0.4 },
                y:       { delay: 0.6, duration: 2.8, repeat: phase === 'processing' ? Infinity : 0, ease: 'easeInOut' },
              }}
              className={`rounded-full ${iconBg} p-4`}
            >
              {phase === 'processing' ? <SpinnerIcon /> : <XCircleIcon />}
            </motion.div>
          </div>

          <AnimatePresence mode="wait">
            {phase === 'processing' && (
              <motion.div
                key="processing"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <h1 className="text-2xl font-bold text-white mt-6">Confirming your account…</h1>
                <p className="text-sm text-slate-400 mt-2">Just a moment while we verify your email.</p>
              </motion.div>
            )}

            {phase === 'error' && (
              <motion.div
                key="error"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              >
                <h1 className="text-2xl font-bold text-white mt-6">Confirmation failed</h1>
                <p className="text-sm text-slate-400 mt-2 leading-relaxed max-w-xs mx-auto">
                  {errorMsg}
                </p>
                <Link
                  to="/login"
                  className="mt-6 inline-block w-full bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-xl py-4 transition-colors duration-200"
                >
                  Back to login
                </Link>
                <p className="text-slate-500 text-xs mt-4">
                  Need a new link?{' '}
                  <Link to="/signup" className="text-blue-400 hover:text-blue-300 transition-colors">
                    Sign up again
                  </Link>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </>
  )
}
