import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { fetchOrCreateOnboardingRow, dismissTopicValidatorNudge } from '../lib/onboarding'

interface UseOnboardingStateReturn {
  showNudge: boolean
  dismiss: () => void
  loading: boolean
}

export function useOnboardingState(): UseOnboardingStateReturn {
  const [showNudge, setShowNudge] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false

    async function load(userId: string) {
      const row = await fetchOrCreateOnboardingRow(userId)
      if (cancelled) return

      setLoading(false)

      // row === null means a network failure — suppress the nudge rather than
      // risk spamming users on every reconnect.
      if (row !== null) {
        setShowNudge(row.topic_validator_nudge_dismissed_at === null)
      }
    }

    // Subscribe to auth state changes so the hook fires correctly on fresh
    // signup redirects, where the component may mount before the JWT exchange
    // completes and getUser() would return null.
    // INITIAL_SESSION fires immediately with the current session (or null).
    // SIGNED_IN fires after a successful email-verification redirect.
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if ((event === 'INITIAL_SESSION' || event === 'SIGNED_IN') && session?.user) {
        setLoading(true)
        load(session.user.id)
      } else if (event === 'INITIAL_SESSION' && !session) {
        // No session at all — stop loading.
        setLoading(false)
      } else if (event === 'SIGNED_OUT') {
        setShowNudge(false)
        setLoading(false)
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
    }
  }, [])

  const dismiss = useCallback(async () => {
    setShowNudge(false) // Optimistic: hide immediately in UI

    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    if (!user) return

    const success = await dismissTopicValidatorNudge(user.id)
    if (!success) {
      // Silent single retry after 2 s. If this also fails, the nudge may
      // reappear on the next visit — acceptable, and not surfaced to the user.
      setTimeout(() => {
        dismissTopicValidatorNudge(user.id)
      }, 2000)
    }
  }, [])

  return { showNudge, dismiss, loading }
}
