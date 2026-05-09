import { supabase } from './supabase'

interface OnboardingRow {
  user_id: string
  topic_validator_nudge_dismissed_at: string | null
  created_at: string
}

/**
 * Fetches the user_onboarding row for userId.
 * If no row exists, inserts one (dismissed_at = null) and returns it.
 * Returns null on any network or unexpected error — callers treat null as
 * "suppressed": do not show the nudge, do not surface an error.
 */
export async function fetchOrCreateOnboardingRow(userId: string): Promise<OnboardingRow | null> {
  try {
    const { data, error } = await supabase
      .from('user_onboarding')
      .select('user_id, topic_validator_nudge_dismissed_at, created_at')
      .eq('user_id', userId)
      .single()

    if (!error) return data

    // PGRST116 = "The result contains 0 rows" — first visit, create the row.
    if (error.code === 'PGRST116') {
      const { data: inserted, error: insertErr } = await supabase
        .from('user_onboarding')
        .insert({ user_id: userId })
        .select('user_id, topic_validator_nudge_dismissed_at, created_at')
        .single()

      if (!insertErr) return inserted

      // 23505 = unique violation — concurrent insert already created the row.
      // Re-fetch the row that won the race.
      if (insertErr.code === '23505') {
        const { data: refetched, error: refetchErr } = await supabase
          .from('user_onboarding')
          .select('user_id, topic_validator_nudge_dismissed_at, created_at')
          .eq('user_id', userId)
          .single()

        if (!refetchErr) return refetched
      }

      console.error('[onboarding] insert failed:', insertErr.message)
      return null
    }

    // Any other fetch error is unexpected
    console.error('[onboarding] fetch failed:', error.message)
    return null
  } catch (err) {
    console.error('[onboarding] unexpected error:', err)
    return null
  }
}

/**
 * Marks topic_validator_nudge_dismissed_at = now() for the user.
 * Returns true on success, false on failure.
 * Callers are responsible for retry logic if needed.
 */
export async function dismissTopicValidatorNudge(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_onboarding')
      .update({ topic_validator_nudge_dismissed_at: new Date().toISOString() })
      .eq('user_id', userId)

    if (error) {
      console.error('[onboarding] dismiss failed:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('[onboarding] dismiss unexpected error:', err)
    return false
  }
}
