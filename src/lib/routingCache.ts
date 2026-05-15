import { supabase } from './supabase'

export interface RoutingState {
  onboarded: boolean
  activeProjectId: string | null
}

const CACHE_KEY = 'fypro_routing_v1'

export function getRoutingCache(): RoutingState | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY)
    return raw ? (JSON.parse(raw) as RoutingState) : null
  } catch {
    return null
  }
}

export function setRoutingCache(state: RoutingState): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(state))
  } catch {}
}

export function clearRoutingCache(): void {
  localStorage.removeItem(CACHE_KEY)
}

// Single batched call that determines the correct post-login destination.
// Runs two parallel Supabase queries (profile + most recent active project)
// and caches the result in localStorage so subsequent page loads are instant.
export async function resolveRouteAfterLogin(userId: string): Promise<string> {
  const [profileRes, projectRes] = await Promise.all([
    supabase
      .from('users')
      .select('faculty, department')
      .eq('id', userId)
      .single(),
    supabase
      .from('projects')
      .select('id')
      .eq('user_id', userId)
      .neq('status', 'archived')
      .order('updated_at', { ascending: false })
      .limit(1),
  ])

  const isOnboarded = Boolean(
    profileRes.data?.faculty && profileRes.data?.department,
  )
  const rows = projectRes.data as Array<{ id: string }> | null
  const activeProjectId = rows?.[0]?.id ?? null

  setRoutingCache({ onboarded: isOnboarded, activeProjectId })

  // Keep legacy isOnboarded flag in sync so AppContext reads correctly immediately.
  if (isOnboarded) {
    localStorage.setItem('isOnboarded', 'true')
  } else {
    localStorage.removeItem('isOnboarded')
  }

  if (!isOnboarded) return '/start'
  if (activeProjectId) return `/dashboard?project=${activeProjectId}`
  return '/dashboard'
}
