import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from './useUser'

export function usePaidFeatures() {
  const { user, loading: userLoading } = useUser()
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)

  const fetchFeatures = useCallback(async (userId) => {
    if (!userId) {
      setFeatures([])
      setLoading(false)
      return
    }
    setLoading(true)
    const { data, error } = await supabase
      .from('user_entitlements')
      .select('paid_features')
      .eq('user_id', userId)
      .single()
    setFeatures(!error && data && Array.isArray(data.paid_features) ? data.paid_features : [])
    setLoading(false)
  }, [])

  // Fresh fetch whenever user is resolved — no localStorage caching of entitlements.
  useEffect(() => {
    if (userLoading) return
    fetchFeatures(user?.id ?? null)
  }, [user?.id, userLoading, fetchFeatures])

  // Re-fetch after payment success without a page reload.
  useEffect(() => {
    const handler = () => { if (user?.id) fetchFeatures(user.id) }
    window.addEventListener('fypro_entitlements_updated', handler)
    return () => window.removeEventListener('fypro_entitlements_updated', handler)
  }, [user?.id, fetchFeatures])

  function hasPaidFeature(feature) {
    return features.includes(feature)
  }

  return {
    hasPaidFeature,
    loading: loading || userLoading,
    features,
    refetch: () => fetchFeatures(user?.id ?? null),
  }
}
