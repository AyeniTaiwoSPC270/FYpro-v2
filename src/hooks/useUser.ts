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

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  // Start loading only when a session token exists in localStorage.
  // This prevents a spinner + redirect flash on first visit or after logout.
  const [loading, setLoading] = useState(hasStoredSession)

  useEffect(() => {
    // Restore session on mount — sets loading false exactly once.
    // stopAutoRefresh() in supabase.ts prevents any visibility/focus re-triggers.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
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

    return () => subscription.unsubscribe()
  }, [])

  return { user, session, loading }
}
