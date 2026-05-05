import { useState, useEffect, useCallback } from 'react'
import { useUser } from './useUser'
import { getCachedEntitlements, invalidateCachedEntitlements } from '../lib/entitlements-cache'

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
    try {
      const data = await getCachedEntitlements(userId)
      setFeatures(data?.paid_features ?? [])
    } catch {
      setFeatures([])
    }
    setLoading(false)
  }, [])

  // Fresh fetch whenever user is resolved — cache absorbs repeat calls within TTL.
  useEffect(() => {
    if (userLoading) return
    fetchFeatures(user?.id ?? null)
  }, [user?.id, userLoading, fetchFeatures])

  // Re-fetch after payment success without a page reload.
  useEffect(() => {
    const handler = () => {
      if (user?.id) {
        invalidateCachedEntitlements(user.id)
        fetchFeatures(user.id)
      }
    }
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
    refetch: () => {
      if (user?.id) invalidateCachedEntitlements(user.id)
      return fetchFeatures(user?.id ?? null)
    },
  }
}
