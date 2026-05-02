// Offline write queue — keeps step saves while disconnected and drains on reconnect.
// localStorage-backed so writes survive page refresh.
// Supabase is canonical. localStorage is write cache only.

import { saveStep } from './supabase-client'

export type SyncStatus = 'online' | 'offline' | 'reconnecting'

interface QueueItem {
  id: string
  projectId: string
  stepType: string
  resultJson: Record<string, unknown>
  inputSummary: string | null
  queuedAt: string
}

const STORAGE_KEY = 'fypro_sync_queue'
let currentStatus: SyncStatus = typeof navigator !== 'undefined' && !navigator.onLine ? 'offline' : 'online'
const listeners: ((s: SyncStatus) => void)[] = []
let draining = false

function notify(s: SyncStatus) {
  currentStatus = s
  listeners.forEach(fn => fn(s))
}

export function getStatus(): SyncStatus {
  return currentStatus
}

export function onStatusChange(fn: (s: SyncStatus) => void): () => void {
  listeners.push(fn)
  return () => {
    const i = listeners.indexOf(fn)
    if (i !== -1) listeners.splice(i, 1)
  }
}

function load(): QueueItem[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as QueueItem[]) : []
  } catch {
    return []
  }
}

function persist(queue: QueueItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(queue))
  } catch {
    // Storage full — silently swallow
  }
}

export function enqueue(item: Omit<QueueItem, 'id' | 'queuedAt'>): void {
  const queue = load()
  // Replace any pending write for the same project+step (last-write-wins per migration-plan.md §4)
  const filtered = queue.filter(
    q => !(q.projectId === item.projectId && q.stepType === item.stepType)
  )
  filtered.push({ ...item, id: crypto.randomUUID(), queuedAt: new Date().toISOString() })
  persist(filtered)
}

export async function drain(): Promise<void> {
  if (draining) return
  const queue = load()
  if (queue.length === 0) return

  draining = true
  notify('reconnecting')

  const failed: QueueItem[] = []
  for (const item of queue) {
    try {
      await saveStep(item.projectId, item.stepType, item.resultJson, item.inputSummary ?? undefined)
    } catch {
      failed.push(item)
    }
  }

  persist(failed)
  draining = false
  notify(typeof navigator !== 'undefined' && navigator.onLine ? 'online' : 'offline')
}

// Wire browser events once
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    drain().catch(() => { /* drain handles its own errors */ })
  })
  window.addEventListener('offline', () => notify('offline'))
}
