// SQL — run once in Supabase SQL Editor before deploying:
// ALTER TABLE user_entitlements
// ADD COLUMN IF NOT EXISTS run_counts JSONB DEFAULT '{}'::jsonb;

import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { getCachedEntitlements, invalidateCachedEntitlements } from '../lib/entitlements-cache'
import { useUser } from './useUser'

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
    const parsed = raw ? JSON.parse(raw) : {}
    // Strip internal metadata so _reset_at is never treated as a step count
    const { _reset_at, ...counts } = parsed
    return counts
  } catch {
    return {}
  }
}

// Merges remote run_counts (from Supabase) into localStorage.
// If remote carries a newer _reset_at than local, admin has reset this user —
// discard local counts entirely and start fresh from the server value.
function mergeRemoteIntoLocal(remote) {
  const raw       = localStorage.getItem(STORAGE_KEY)
  const localFull = raw ? (() => { try { return JSON.parse(raw) } catch { return {} } })() : {}

  const remoteResetAt = remote?._reset_at ? new Date(remote._reset_at).getTime() : 0
  const localResetAt  = localFull?._reset_at ? new Date(localFull._reset_at).getTime() : 0

  if (remoteResetAt > localResetAt) {
    // Admin reset is newer — discard local counts, accept server state
    const fresh = { _reset_at: remote._reset_at }
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh))
    window.dispatchEvent(new Event('fypro_run_counts_updated'))
    return fresh
  }

  // Normal merge: take the higher of the two for each key
  const { _reset_at: _r, ...remoteCounts } = remote || {}
  const { _reset_at: _l, ...localCounts  } = localFull
  const merged = { ...remoteCounts, ...(localResetAt > 0 ? { _reset_at: localFull._reset_at } : {}) }
  for (const k of Object.keys(localCounts)) {
    merged[k] = Math.max(localCounts[k] || 0, merged[k] || 0)
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(merged))
  return merged
}

export function resolveLimit(stepKey, features) {
  const hasStudent = Array.isArray(features) && features.includes('student_pack')
  const hasDefense = Array.isArray(features) && features.includes('defense_pack')

  if (hasStudent || hasDefense) {
    if (hasDefense) return DEFENSE_LIMITS[stepKey] ?? null
    if (hasStudent && stepKey in STUDENT_LIMITS) return STUDENT_LIMITS[stepKey]
    return null
  }

  return FREE_LIMITS[stepKey] ?? null
}

// Module-level singleton: merge Supabase run_counts into localStorage on SIGNED_IN.
// Runs once when the module loads. On SIGNED_OUT, intentionally does nothing —
// localStorage run_counts must persist so re-login restores the correct counts.
// Subscription is stored so it can be unsubscribed if ever needed (e.g. tests).
const { data: { subscription: _signedInSyncSub } } = supabase.auth.onAuthStateChange((event, session) => {
  if (event !== 'SIGNED_IN' || !session?.user?.id) return
  supabase
    .from('user_entitlements')
    .select('run_counts')
    .eq('user_id', session.user.id)
    .single()
    .then(({ data, error }) => {
      if (error || !data?.run_counts) return
      mergeRemoteIntoLocal(data.run_counts)
      window.dispatchEvent(new Event('fypro_run_counts_updated'))
    })
})
export { _signedInSyncSub as __signedInSyncSub }

async function syncRunCountsToSupabase(updatedCounts) {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.user?.id) {
    console.error('syncRunCounts: no session')
    return
  }
  // upsert so free users without an existing user_entitlements row still persist counts
  const { error } = await supabase
    .from('user_entitlements')
    .upsert(
      { user_id: session.user.id, run_counts: updatedCounts, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .select()
  if (error) {
    console.error('syncRunCounts FAILED:', error)
  } else {
    // Stale entry — next read will re-fetch paid_features + run_counts together
    invalidateCachedEntitlements(session.user.id)
  }
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
  const { user } = useUser()
  const [runCounts, setRunCounts] = useState(getRunCounts)

  // Sync from Supabase when the authenticated user is known.
  // Uses the shared entitlements cache so usePaidFeatures and useRunLimit
  // share one network call to user_entitlements instead of making two.
  useEffect(() => {
    if (!user?.id) return
    getCachedEntitlements(user.id).then((data) => {
      if (!data?.run_counts) return
      mergeRemoteIntoLocal(data.run_counts)
      setRunCounts(getRunCounts()) // getRunCounts strips _reset_at before passing to UI
    }).catch(() => {})
  }, [user?.id])

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
