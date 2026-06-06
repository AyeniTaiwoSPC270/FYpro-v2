// src/lib/checkAchievements.ts
import { supabase } from './supabase'

/**
 * Calls /api/ai?action=check-achievements server-side.
 * Returns the list of newly earned achievement keys (may be empty).
 * Pass shared=true when the trigger was a certificate share action.
 * Fire-and-forget safe — never throws, just logs.
 */
export async function checkAchievements(opts: { shared?: boolean } = {}): Promise<string[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return []

    const res = await fetch('/api/ai?action=check-achievements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ shared: opts.shared ?? false }),
    })

    if (!res.ok) return []
    const body = await res.json()
    return Array.isArray(body.newlyEarned) ? body.newlyEarned : []
  } catch {
    return []
  }
}
