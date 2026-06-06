// src/lib/celebrations.ts
// Tracks which celebration modals have already been shown in this browser,
// so they don't re-fire on page reload.

const STORAGE_KEY = 'fypro_celebrations_seen'

function getSeenSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveSeenSet(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch { /* quota exceeded — silently ignore */ }
}

/** Returns true if this celebration has NOT been shown yet (and marks it as shown). */
export function shouldShowCelebration(key: string): boolean {
  const seen = getSeenSet()
  if (seen.has(key)) return false
  seen.add(key)
  saveSeenSet(seen)
  return true
}

export function markCelebrationSeen(key: string): void {
  const seen = getSeenSet()
  seen.add(key)
  saveSeenSet(seen)
}
