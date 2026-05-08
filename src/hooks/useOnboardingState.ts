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

    async function load() {
      const { data: { user } } = await supabase.auth.getUser()

      if (cancelled || !user) {
        setLoading(false)
        return
      }

      const row = await fetchOrCreateOnboardingRow(user.id)
      if (cancelled) return

      setLoading(false)

      // row === null means a network failure — suppress the nudge rather than
      // risk spamming users on every reconnect.
      if (row !== null) {
        setShowNudge(row.topic_validator_nudge_dismissed_at === null)
      }
    }

    load()
    return () => { cancelled = true }
  }, [])

  const dismiss = useCallback(async () => {
    setShowNudge(false) // Optimistic: hide immediately in UI

    const { data: { user } } = await supabase.auth.getUser()
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
