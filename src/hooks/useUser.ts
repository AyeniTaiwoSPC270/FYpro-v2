import { useEffect, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface UseUserReturn {
  user: User | null
  session: Session | null
  loading: boolean
}

// Synchronously checks if Supabase has stored a session in localStorage.
// Supabase key format: sb-<project-ref>-auth-token
// If the key exists we must wait for getSession() before deciding to redirect.
// If it's absent we know immediately there's no session — skip the loading phase.
function hasStoredSession(): boolean {
  try {
    return Object.keys(localStorage).some(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    )
  } catch {
    return false
  }
}

// Guard prevents duplicate redirects if the interval fires while a sign-out
// is already in progress (e.g. slow network before page unloads).
let signingOut = false

// Called when getUser() returns an error or null — means the account was deleted
// server-side while the tab was open. Signs out, wipes all local state, redirects.
async function forceSignOut(): Promise<void> {
  if (signingOut) return
  signingOut = true
  try { await supabase.auth.signOut() } catch { /* ignore — user may already be deleted */ }
  localStorage.clear()
  sessionStorage.clear()
  window.location.replace('/login?session_expired=1')
}

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  // Start loading only when a session token exists in localStorage.
  // This prevents a spinner + redirect flash on first visit or after logout.
  const [loading, setLoading] = useState(hasStoredSession)

  useEffect(() => {
    // On mount: restore session, then verify the user still exists server-side
    // before trusting it. Covers the case where a deleted user refreshes the page.
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session) {
        const { data: { user: verified }, error } = await supabase.auth.getUser()
        if (error || !verified) {
          await forceSignOut()
          return
        }
        setSession(session)
        setUser(verified)
      } else {
        setSession(null)
        setUser(null)
      }
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      // TOKEN_REFRESH_FAILED — transient network failure, keep existing state.
      // Do NOT clear user; stored token is still valid for the next request.
      if (event === 'TOKEN_REFRESH_FAILED') return

      // All other events (SIGNED_IN, SIGNED_OUT, USER_UPDATED, TOKEN_REFRESHED):
      // update user/session but NEVER set loading = true.
      // loading is set true only in useState initializer and cleared by getSession() above.
      setSession(session)
      setUser(session?.user ?? null)
    })

    // Periodic server-side validity check every 5 minutes.
    // Catches the deleted-user-with-open-tab scenario without waiting for a page reload.
    const intervalId = setInterval(async () => {
      const { data: { session: currentSession } } = await supabase.auth.getSession()
      if (!currentSession) return
      const { data: { user: verified }, error } = await supabase.auth.getUser()
      if (error || !verified) {
        await forceSignOut()
      }
    }, 5 * 60 * 1000)

    return () => {
      subscription.unsubscribe()
      clearInterval(intervalId)
    }
  }, [])

  return { user, session, loading }
}
