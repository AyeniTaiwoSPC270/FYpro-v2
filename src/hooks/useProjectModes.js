import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from './useUser'

const EMPTY = { hasExpress: false, hasStandard: false }

// Which kinds of project does this user actually have? This is the per-user signal
// that tells an Express user apart from a standard one — entitlements cannot, because
// Express is free for everyone during the beta.
export function useProjectModes() {
  const { user, loading: authLoading } = useUser()
  // Keyed by uid so a user switch reports loading rather than the previous user's answer.
  const [result, setResult] = useState(null)
  const [retryToken, setRetryToken] = useState(0)

  useEffect(() => {
    if (authLoading || !user?.id) return
    let cancelled = false

    supabase
      .from('projects')
      .select('mode')
      .eq('user_id', user.id)
      .neq('status', 'archived')
      .then(({ data, error }) => {
        if (cancelled) return
        if (error) {
          // Query failed — this is NOT the same as "no projects". Callers making a
          // redirect decision must check `error` rather than trusting hasExpress/
          // hasStandard, which stay at their safe EMPTY defaults here.
          setResult({ uid: user.id, ...EMPTY, error: true })
          return
        }
        const rows = data ?? []
        setResult({
          uid: user.id,
          hasExpress: rows.some(r => r.mode === 'express'),
          hasStandard: rows.some(r => r.mode !== 'express'),
          error: false,
        })
      })

    return () => { cancelled = true }
  }, [user?.id, authLoading, retryToken])

  const refetch = useCallback(() => setRetryToken(t => t + 1), [])

  if (authLoading) return { ...EMPTY, loading: true, error: false, refetch }
  if (!user?.id) return { ...EMPTY, loading: false, error: false, refetch }
  if (result?.uid !== user.id) return { ...EMPTY, loading: true, error: false, refetch }
  return { hasExpress: result.hasExpress, hasStandard: result.hasStandard, loading: false, error: result.error, refetch }
}
