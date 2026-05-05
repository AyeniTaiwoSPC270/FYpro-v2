import { supabase } from './supabase'

interface EntitlementsData {
  paid_features: string[]
  run_counts: Record<string, number>
}

interface CacheEntry {
  data: EntitlementsData
  fetchedAt: number
}

const TTL_MS = 30_000
const store = new Map<string, CacheEntry>()
const pending = new Map<string, Promise<EntitlementsData | null>>()

export async function getCachedEntitlements(userId: string): Promise<EntitlementsData | null> {
  const hit = store.get(userId)
  if (hit && Date.now() - hit.fetchedAt < TTL_MS) return hit.data

  const inflight = pending.get(userId)
  if (inflight) return inflight

  // Wrap in an IIFE so we can store the promise before awaiting it,
  // which is required for request deduplication.
  const promise = (async (): Promise<EntitlementsData | null> => {
    try {
      const { data } = await supabase
        .from('user_entitlements')
        .select('paid_features, run_counts')
        .eq('user_id', userId)
        .maybeSingle()

      if (!data) return null

      const result: EntitlementsData = {
        paid_features: Array.isArray(data.paid_features)
          ? (data.paid_features as string[])
          : [],
        run_counts:
          data.run_counts && typeof data.run_counts === 'object'
            ? (data.run_counts as Record<string, number>)
            : {},
      }
      store.set(userId, { data: result, fetchedAt: Date.now() })
      return result
    } finally {
      pending.delete(userId)
    }
  })()

  pending.set(userId, promise)
  return promise
}

export function invalidateCachedEntitlements(userId: string): void {
  store.delete(userId)
  pending.delete(userId)
}
