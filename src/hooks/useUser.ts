import { useEffect, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'

interface UseUserReturn {
  user: User | null
  session: Session | null
  loading: boolean
}

// Prevent rapid re-renders when the browser refreshes the token on tab return.
const REFRESH_DEBOUNCE_MS = 30_000

export function useUser(): UseUserReturn {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const lastRefreshRef = useRef<number>(0)

  useEffect(() => {
    // Restore session on mount — sets loading false exactly once.
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'TOKEN_REFRESHED') {
        // Tab-return triggers a token refresh; debounce to avoid cascade re-renders.
        const now = Date.now()
        if (now - lastRefreshRef.current < REFRESH_DEBOUNCE_MS) return
        lastRefreshRef.current = now
        setSession(session)
        setUser(session?.user ?? null)
        return
      }

      if (event === 'TOKEN_REFRESH_FAILED') {
        // Transient network failure — keep showing existing session state.
        // Do NOT set user to null; the stored token is still valid.
        return
      }

      // SIGNED_IN, SIGNED_OUT, USER_UPDATED, PASSWORD_RECOVERY, etc.
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  return { user, session, loading }
}
