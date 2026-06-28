import { useState, useEffect } from 'react'

// Module-level cache so multiple component mounts share one fetch per TTL window.
let _cache = null      // { value: boolean, ts: number } | null
const CACHE_TTL = 60_000 // 60 seconds

export function useExpressBeta() {
  const [betaFree, setBetaFree] = useState(false)
  const [loading,  setLoading]  = useState(true)

  useEffect(() => {
    let cancelled = false
    const now = Date.now()

    if (_cache && now - _cache.ts < CACHE_TTL) {
      setBetaFree(_cache.value)
      setLoading(false)
      return
    }

    fetch('/api/admin?action=express-beta-info')
      .then(r => r.json())
      .then(d => {
        if (cancelled) return
        const val = d.express_beta_free === true
        _cache = { value: val, ts: Date.now() }
        setBetaFree(val)
      })
      .catch(() => {
        // Fail closed — keep betaFree=false, paywall stays up
        if (!cancelled) setBetaFree(false)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [])

  return { betaFree, loading }
}
