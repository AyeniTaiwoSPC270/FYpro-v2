import { supabase } from './supabase'

const LS_KEY = 'fypro_feedback_given'

function storageKey(feature: string, contextId?: string): string {
  return contextId ? `${feature}:${contextId}` : feature
}

export function hasFeedbackGiven(feature: string, contextId?: string): boolean {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return false
    const given: string[] = JSON.parse(raw)
    return given.includes(storageKey(feature, contextId))
  } catch {
    return false
  }
}

function markFeedbackGiven(feature: string, contextId?: string): void {
  try {
    const raw  = localStorage.getItem(LS_KEY)
    const given: string[] = raw ? JSON.parse(raw) : []
    const key  = storageKey(feature, contextId)
    if (!given.includes(key)) {
      given.push(key)
      localStorage.setItem(LS_KEY, JSON.stringify(given))
    }
  } catch {
    // localStorage unavailable — non-fatal
  }
}

export async function submitFeedback(
  feature: string,
  rating: 1 | -1,
  contextId?: string,
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase.from('feature_feedback').insert({
    user_id:    user.id,
    feature,
    rating,
    context_id: contextId ?? null,
  })

  if (error) throw error

  markFeedbackGiven(feature, contextId)
}
