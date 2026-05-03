import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from './useUser'

export function usePaidFeatures() {
  const { user, loading: userLoading } = useUser()
  const [features, setFeatures] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userLoading) return

    if (!user) {
      setFeatures([])
      setLoading(false)
      return
    }

    setLoading(true)
    supabase
      .from('user_entitlements')
      .select('paid_features')
      .eq('user_id', user.id)
      .single()
      .then(({ data, error }) => {
        if (error || !data) {
          setFeatures([])
        } else {
          setFeatures(Array.isArray(data.paid_features) ? data.paid_features : [])
        }
        setLoading(false)
      })
  }, [user?.id, userLoading]) // eslint-disable-line

  function hasPaidFeature(feature) {
    return features.includes(feature)
  }

  return { hasPaidFeature, loading: loading || userLoading, features }
}
