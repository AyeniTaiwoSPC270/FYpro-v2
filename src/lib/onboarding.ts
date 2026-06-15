import { supabase } from './supabase'

interface OnboardingRow {
  user_id: string
  topic_validator_nudge_dismissed_at: string | null
  referral_source: string | null
  expected_defence_band: string | null
  primary_goal: string | null
  notify_email: boolean | null
  notify_push: boolean | null
  walkthrough_seen_at: string | null
  created_at: string
}

const SELECT_COLS =
  'user_id, topic_validator_nudge_dismissed_at, referral_source, expected_defence_band, primary_goal, notify_email, notify_push, walkthrough_seen_at, created_at'

/**
 * Fetches the user_onboarding row for userId.
 * If no row exists, inserts one (all nullable cols = null) and returns it.
 * Returns null on any network or unexpected error — callers treat null as
 * "suppressed": do not show the nudge, do not surface an error.
 */
export async function fetchOrCreateOnboardingRow(userId: string): Promise<OnboardingRow | null> {
  try {
    const { data, error } = await supabase
      .from('user_onboarding')
      .select(SELECT_COLS)
      .eq('user_id', userId)
      .single()

    if (!error) return data

    // PGRST116 = "The result contains 0 rows" — first visit, create the row.
    if (error.code === 'PGRST116') {
      const { data: inserted, error: insertErr } = await supabase
        .from('user_onboarding')
        .insert({ user_id: userId })
        .select(SELECT_COLS)
        .single()

      if (!insertErr) return inserted

      // 23505 = unique violation — concurrent insert already created the row.
      // Re-fetch the row that won the race.
      if (insertErr.code === '23505') {
        const { data: refetched, error: refetchErr } = await supabase
          .from('user_onboarding')
          .select(SELECT_COLS)
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

export interface OnboardingAnswers {
  referral_source?: string | null
  expected_defence_band?: string | null
  primary_goal?: string | null
  notify_email?: boolean | null
  notify_push?: boolean | null
}

/**
 * Upserts onboarding question answers for the user.
 * All fields are optional — only non-undefined keys are written.
 * Returns true on success, false on any error (caller should not block on failure).
 */
export async function saveOnboardingAnswers(
  userId: string,
  answers: OnboardingAnswers
): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_onboarding')
      .upsert({ user_id: userId, ...answers }, { onConflict: 'user_id' })

    if (error) {
      console.error('[onboarding] saveOnboardingAnswers failed:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('[onboarding] saveOnboardingAnswers unexpected error:', err)
    return false
  }
}

/**
 * Records that the user has seen (or dismissed) the walkthrough card.
 * Prevents the walkthrough from reappearing on future logins.
 */
export async function markWalkthroughSeen(userId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('user_onboarding')
      .upsert(
        { user_id: userId, walkthrough_seen_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )

    if (error) {
      console.error('[onboarding] markWalkthroughSeen failed:', error.message)
      return false
    }
    return true
  } catch (err) {
    console.error('[onboarding] markWalkthroughSeen unexpected error:', err)
    return false
  }
}
