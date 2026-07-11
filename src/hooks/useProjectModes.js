import { useState, useEffect } from 'react'
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
        // Fail towards the standard dashboard — never strand someone in Express
        // because a query blipped.
        const rows = error ? [] : (data ?? [])
        setResult({
          uid: user.id,
          hasExpress: rows.some(r => r.mode === 'express'),
          hasStandard: rows.some(r => r.mode !== 'express'),
        })
      })

    return () => { cancelled = true }
  }, [user?.id, authLoading])

  if (authLoading) return { ...EMPTY, loading: true }
  if (!user?.id) return { ...EMPTY, loading: false }
  if (result?.uid !== user.id) return { ...EMPTY, loading: true }
  return { hasExpress: result.hasExpress, hasStandard: result.hasStandard, loading: false }
}
