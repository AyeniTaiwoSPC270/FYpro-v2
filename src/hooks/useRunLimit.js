import { useState, useEffect } from 'react'

const FREE_LIMITS = {
  topic_validator:    3,
  chapter_architect:  1,
  methodology_advisor: 1,
  writing_planner:    1,
  project_reviewer:   10,
  defense_simulator:  5,
  red_flag_detector:  3,
}

const STUDENT_LIMITS = {
  topic_validator:  20,
  project_reviewer: 10,
}

const DEFENSE_LIMITS = {
  defense_simulator: 5,
  red_flag_detector: 3,
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

function resolveLimit(stepKey, features) {
  const hasStudent = Array.isArray(features) && features.includes('student_pack')
  const hasDefense = Array.isArray(features) && features.includes('defense_pack')

  if (hasStudent || hasDefense) {
    if (hasStudent && stepKey in STUDENT_LIMITS) return STUDENT_LIMITS[stepKey]
    if (hasDefense && stepKey in DEFENSE_LIMITS) return DEFENSE_LIMITS[stepKey]
    return null // unlimited at this tier
  }

  return FREE_LIMITS[stepKey] ?? null
}

export function checkAndRecord(stepKey, features) {
  const limit = resolveLimit(stepKey, features)
  if (limit === null) return true // unlimited

  const counts = getRunCounts()
  const current = counts[stepKey] ?? 0
  if (current >= limit) return false

  counts[stepKey] = current + 1
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counts))
  window.dispatchEvent(new Event('fypro_run_counts_updated'))
  return true
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

  function isOverLimit(stepKey) {
    const limit = resolveLimit(stepKey, features)
    if (limit === null) return false
    return (runCounts[stepKey] ?? 0) >= limit
  }

  function getRemainingRuns(stepKey) {
    const limit = resolveLimit(stepKey, features)
    if (limit === null) return null
    return Math.max(0, limit - (runCounts[stepKey] ?? 0))
  }

  return { isOverLimit, getRemainingRuns }
}
