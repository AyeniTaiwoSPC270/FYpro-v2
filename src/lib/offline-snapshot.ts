// Offline read cache — persists step results to localStorage after every
// successful Supabase load so students can re-read their work without WiFi.

import type { UserState } from './db'

const SNAPSHOT_KEY = 'fypro_offline_snapshot'

export interface OfflineSnapshot {
  userId: string
  savedAt: string
  profile: {
    full_name: string | null
    university: string | null
    faculty: string | null
    department: string | null
    level: string | null
  } | null
  project: {
    id: string
    title: string | null
    current_step: string
  } | null
  steps: Array<{
    step_type: string
    result_json: Record<string, unknown>
  }>
}

export function persistSnapshot(userId: string, userState: UserState): void {
  try {
    const snapshot: OfflineSnapshot = {
      userId,
      savedAt: new Date().toISOString(),
      profile: userState.profile
        ? {
            full_name:  userState.profile.full_name  ?? null,
            university: (userState.profile as { university?: string | null }).university ?? null,
            faculty:    userState.profile.faculty    ?? null,
            department: userState.profile.department ?? null,
            level:      userState.profile.level      ?? null,
          }
        : null,
      project: userState.project
        ? {
            id:           userState.project.id,
            title:        userState.project.title        ?? null,
            current_step: userState.project.current_step,
          }
        : null,
      steps: (userState.steps ?? []).map(s => ({
        step_type:   s.step_type,
        result_json: s.result_json,
      })),
    }
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // silent
  }
}

export function patchSnapshotStep(
  userId: string,
  stepType: string,
  resultJson: Record<string, unknown>
): void {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return
    const snapshot: OfflineSnapshot = JSON.parse(raw)
    if (!snapshot || !Array.isArray(snapshot.steps)) return
    if (snapshot.userId !== userId) return
    const idx = snapshot.steps.findIndex(s => s.step_type === stepType)
    if (idx !== -1) {
      snapshot.steps[idx] = { step_type: stepType, result_json: resultJson }
    } else {
      snapshot.steps.push({ step_type: stepType, result_json: resultJson })
    }
    snapshot.savedAt = new Date().toISOString()
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // silent
  }
}

export function readSnapshot(userId: string): OfflineSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    const snapshot: OfflineSnapshot = JSON.parse(raw)
    if (snapshot.userId !== userId) {
      // Stale snapshot from a different user on the same device — clear it.
      localStorage.removeItem(SNAPSHOT_KEY)
      return null
    }
    return snapshot
  } catch {
    // silent
    return null
  }
}

export function clearSnapshot(): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY)
  } catch {
    // silent
  }
}
