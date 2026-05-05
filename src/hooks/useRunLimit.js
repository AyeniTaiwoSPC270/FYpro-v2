// SQL — run once in Supabase SQL Editor before deploying:
// ALTER TABLE user_entitlements
// ADD COLUMN IF NOT EXISTS run_counts JSONB DEFAULT '{}'::jsonb;

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

const FREE_LIMITS = {
  topic_validator:     3,
  chapter_architect:   1,
  methodology_advisor: 1,
  writing_planner:     1,
  project_reviewer:    10,
  defense_simulator:   5,
  red_flag_detector:   3,
}

const STUDENT_LIMITS = {
  topic_validator:     20,
  chapter_architect:   10,
  methodology_advisor: 10,
  writing_planner:      5,
  literature_map:      10,
  abstract_generator:  10,
  instrument_builder:  10,
  project_reviewer:    10,
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

export function resolveLimit(stepKey, features) {
  const hasStudent = Array.isArray(features) && features.includes('student_pack')
  const hasDefense = Array.isArray(features) && features.includes('defense_pack')

  if (hasStudent || hasDefense) {
    if (hasStudent && stepKey in STUDENT_LIMITS) return STUDENT_LIMITS[stepKey]
    if (hasDefense && stepKey in DEFENSE_LIMITS) return DEFENSE_LIMITS[stepKey]
    return null
  }

  return FREE_LIMITS[stepKey] ?? null
}

// Module-level singleton: merge Supabase run_counts into localStorage on SIGNED_IN.
// Runs once when the module loads. On SIGNED_OUT, intentionally does nothing —
// localStorage run_counts must persist so re-login restores the correct counts.
;(function setupSignedInSync() {
  supabase.auth.onAuthStateChange((event, session) => {
    if (event !== 'SIGNED_IN' || !session?.user?.id) return
    supabase
      .from('user_entitlements')
      .select('run_counts')
      .eq('user_id', session.user.id)
      .single()
      .then(({ data, error }) => {
        console.log('Supabase run_counts on SIGNED_IN:', data?.run_counts, error?.message)
        if (error || !data?.run_counts) return
        const local  = getRunCounts()
        const remote = data.run_counts
        const merged = { ...remote }
        for (const k of Object.keys(local)) {
          merged[k] = Math.max(local[k] || 0, merged[k] || 0)
        }
        localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
        window.dispatchEvent(new Event('fypro_run_counts_updated'))
      })
  })
})()

async function syncRunCountsToSupabase(updatedCounts) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) return
  // upsert so free users without an existing user_entitlements row still persist counts
  const { error } = await supabase
    .from('user_entitlements')
    .upsert(
      { user_id: session.user.id, run_counts: updatedCounts, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  console.log('Supabase run_counts write:', error ? `ERROR: ${error.message}` : 'OK', updatedCounts)
}

export async function checkAndRecord(stepKey, features) {
  const limit = resolveLimit(stepKey, features)

  const counts = getRunCounts()
  const current = counts[stepKey] ?? 0

  // Gate: deny if at limit (null = unlimited, always allowed)
  if (limit !== null && current >= limit) return false

  // Always record the run so admin analytics and cross-device restore work
  // regardless of whether this step has a finite limit or is unlimited.
  counts[stepKey] = current + 1
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counts))
  window.dispatchEvent(new Event('fypro_run_counts_updated'))
  await syncRunCountsToSupabase(counts)
  return true
}

export function recordStepRun(stepKey) {
  const counts = getRunCounts()
  counts[stepKey] = (counts[stepKey] ?? 0) + 1
  localStorage.setItem(STORAGE_KEY, JSON.stringify(counts))
  window.dispatchEvent(new Event('fypro_run_counts_updated'))
  syncRunCountsToSupabase(counts).catch(() => {})
}

export function useRunLimit(features) {
  const [runCounts, setRunCounts] = useState(getRunCounts)

  // Sync from Supabase on mount — merge, taking the higher count for each key.
  // Supabase must NOT overwrite localStorage unconditionally: the user may have
  // run a feature moments ago whose syncRunCountsToSupabase hasn't committed yet.
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session?.user?.id) return
      supabase
        .from('user_entitlements')
        .select('run_counts')
        .eq('user_id', session.user.id)
        .single()
        .then(({ data, error }) => {
          console.log('Supabase run_counts on mount:', data?.run_counts, error?.message)
          if (error || !data?.run_counts) return
          const local  = getRunCounts()
          const remote = data.run_counts
          const merged = { ...remote }
          for (const k of Object.keys(local)) {
            merged[k] = Math.max(local[k] || 0, merged[k] || 0)
          }
          localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
          setRunCounts(merged)
        })
    })
  }, [])

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

  return { isOverLimit, getRemainingRuns, runCounts }
}
