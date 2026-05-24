import { createContext, useContext, useState, useEffect, useRef, useMemo } from 'react'
import type { ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase } from '../lib/supabase'
import { clearRoutingCache } from '../lib/routingCache'

export interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
}

export const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: false,
})

function hasStoredSession(): boolean {
  try {
    return Object.keys(localStorage).some(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    )
  } catch {
    return false
  }
}

let signingOut = false

async function forceSignOut(): Promise<void> {
  if (signingOut) return
  signingOut = true
  try { await supabase.auth.signOut() } catch { /* ignore — user may already be deleted */ }
  localStorage.clear()
  sessionStorage.clear()
  window.location.replace('/login?session_expired=1')
}

// Single auth provider for the entire app. Auth state is resolved exactly once
// here and shared via context. All components must read via useUser() or
// useAuth() — never call getSession()/getUser() on mount in child components.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser]       = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState<boolean>(hasStoredSession)
  // Ref lets the periodic check read the latest session without a stale closure.
  const sessionRef = useRef<Session | null>(null)

  useEffect(() => {
    sessionRef.current = session
  }, [session])

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session: initial } }) => {
      if (initial) {
        const { data: { user: verified }, error } = await supabase.auth.getUser()
        if (error || !verified) {
          await forceSignOut()
          return
        }
        sessionRef.current = initial
        setSession(initial)
        setUser(verified)
      } else {
        sessionRef.current = null
        setSession(null)
        setUser(null)
      }
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, updated) => {
      if ((event as string) === 'TOKEN_REFRESH_FAILED') { forceSignOut(); return }
      if (event === 'SIGNED_OUT') clearRoutingCache()
      sessionRef.current = updated
      setSession(updated)
      setUser(updated?.user ?? null)
    })

    // Periodic server-side validity check every 5 min.
    // Reads sessionRef so there is no extra getSession() call in the hot path.
    const intervalId = setInterval(async () => {
      if (!sessionRef.current) return
      const { data: { user: verified }, error } = await supabase.auth.getUser()
      if (error || !verified) await forceSignOut()
    }, 5 * 60 * 1000)

    return () => {
      subscription.unsubscribe()
      clearInterval(intervalId)
    }
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({ user, session, loading }),
    [user, session, loading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext)
}
