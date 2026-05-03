import { useState, useEffect } from 'react'

const FREE_LIMITS = {
  topic_validator: 3,
  chapter_architect: 1,
  methodology_advisor: 1,
  writing_planner: 1,
}

const STORAGE_KEY = 'fypro_run_counts'

function getRunCounts() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

export function recordStepRun(stepKey) {
  const counts = getRunCounts()
  counts[stepKey] = (counts[stepKey] ?? 0) + 1
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counts))
  window.dispatchEvent(new Event('fypro_run_counts_updated'))
}

export function useRunLimit(features) {
  const [runCounts, setRunCounts] = useState(getRunCounts)

  useEffect(() => {
    const handler = () => setRunCounts(getRunCounts())
    window.addEventListener('fypro_run_counts_updated', handler)
    return () => window.removeEventListener('fypro_run_counts_updated', handler)
  }, [])

  const hasAnyPaidFeature = Array.isArray(features) && features.length > 0

  function isOverLimit(stepKey) {
    if (hasAnyPaidFeature) return false
    const limit = FREE_LIMITS[stepKey]
    if (!limit) return false
    return (runCounts[stepKey] ?? 0) >= limit
  }

  function getRemainingRuns(stepKey) {
    if (hasAnyPaidFeature) return null
    const limit = FREE_LIMITS[stepKey] ?? 0
    return Math.max(0, limit - (runCounts[stepKey] ?? 0))
  }

  return { isOverLimit, getRemainingRuns }
}
