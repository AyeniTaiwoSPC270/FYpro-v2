// Tests for the lifetime-run reservation used by Express Defence caps.
//
// This is the abuse defence for a ONE-TIME purchase: without it a single ₦2,000
// express unlock can draw the expensive features indefinitely. A regression here
// either re-opens that hole (cap not enforced / over-count slips through) or
// wrongly locks out paying users (fails closed when Redis is down).
//
// Strategy: mock the redis handle + freeRunKey (from rate-limit.js) and stub
// supabase-admin.js so each test programs its own counter behavior.

import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => ({ redis: null, upsert: null }))

vi.mock('./rate-limit.js', () => ({
  redis: {
    set:  (...a) => h.redis.set(...a),
    incr: (...a) => h.redis.incr(...a),
    decr: (...a) => h.redis.decr(...a),
  },
  freeRunKey: (dbKey, userId) => `runs:${dbKey}:${userId}`,
}))

vi.mock('./supabase-admin.js', () => ({
  supabaseAdmin: {
    from: () => ({ upsert: (...a) => h.upsert(...a) }),
  },
}))

const { reserveRun, syncRunCount } = await import('./run-reservation.js')
const { EXPRESS_TOTAL_LIMITS } = await import('./express-limits.js')

beforeEach(() => {
  h.redis = {
    set:  vi.fn().mockResolvedValue('OK'),
    incr: vi.fn(),
    decr: vi.fn().mockResolvedValue(0),
  }
  h.upsert = vi.fn().mockResolvedValue({ error: null })
})

describe('reserveRun', () => {
  it('allows and reserves a slot when under the cap', async () => {
    h.redis.incr.mockResolvedValue(3) // 3rd use of a cap-5 feature
    const r = await reserveRun({ dbKey: 'express_reviewer', userId: 'u1', limit: 5, dbRunCounts: { express_reviewer: 2 } })
    expect(r.allowed).toBe(true)
    expect(r.reservedCount).toBe(3)
    expect(h.redis.set).toHaveBeenCalledWith('runs:express_reviewer:u1', 2, { nx: true })
    expect(h.redis.incr).toHaveBeenCalledWith('runs:express_reviewer:u1')
  })

  it('rejects on the read-check when the DB count already meets the cap (no Redis touch)', async () => {
    const r = await reserveRun({ dbKey: 'express_reviewer', userId: 'u1', limit: 5, dbRunCounts: { express_reviewer: 5 } })
    expect(r.allowed).toBe(false)
    expect(r.reservedCount).toBe(5)
    expect(h.redis.set).not.toHaveBeenCalled()
    expect(h.redis.incr).not.toHaveBeenCalled()
  })

  it('rejects when the atomic INCR pushes past the cap (concurrency race loser)', async () => {
    h.redis.incr.mockResolvedValue(6) // two parallel requests both passed read-check at 4
    const r = await reserveRun({ dbKey: 'express_defence_brief', userId: 'u1', limit: 5, dbRunCounts: { express_defence_brief: 4 } })
    expect(r.allowed).toBe(false)
    expect(r.reservedCount).toBe(6)
  })

  it('allows exactly at the cap boundary (reservedCount === limit is fine)', async () => {
    h.redis.incr.mockResolvedValue(5)
    const r = await reserveRun({ dbKey: 'express_reviewer', userId: 'u1', limit: 5, dbRunCounts: { express_reviewer: 4 } })
    expect(r.allowed).toBe(true)
    expect(r.reservedCount).toBe(5)
  })

  it('seeds from zero when the user has no prior run_counts entry', async () => {
    h.redis.incr.mockResolvedValue(1)
    const r = await reserveRun({ dbKey: 'express_simulator', userId: 'u1', limit: 10, dbRunCounts: {} })
    expect(r.allowed).toBe(true)
    expect(h.redis.set).toHaveBeenCalledWith('runs:express_simulator:u1', 0, { nx: true })
  })

  it('refund() decrements the reserved slot', async () => {
    h.redis.incr.mockResolvedValue(2)
    const r = await reserveRun({ dbKey: 'express_reviewer', userId: 'u1', limit: 5, dbRunCounts: {} })
    r.refund()
    expect(h.redis.decr).toHaveBeenCalledWith('runs:express_reviewer:u1')
  })

  it('FAILS OPEN when redis throws — infra failure must never block a paying user', async () => {
    h.redis.incr.mockRejectedValue(new Error('redis down'))
    const r = await reserveRun({ dbKey: 'express_reviewer', userId: 'u1', limit: 5, dbRunCounts: { express_reviewer: 1 } })
    expect(r.allowed).toBe(true)
    expect(r.reservedCount).toBe(2) // seed + 1
    expect(() => r.refund()).not.toThrow() // refund is a no-op on the fail-open path
    expect(h.redis.decr).not.toHaveBeenCalled()
  })
})

describe('syncRunCount', () => {
  it('upserts the new count merged into existing run_counts', async () => {
    await syncRunCount({ userId: 'u1', dbKey: 'express_reviewer', newCount: 3, dbRunCounts: { express_simulator: 1 } })
    expect(h.upsert).toHaveBeenCalledTimes(1)
    const [row, opts] = h.upsert.mock.calls[0]
    expect(row).toMatchObject({ user_id: 'u1', run_counts: { express_simulator: 1, express_reviewer: 3 } })
    expect(opts).toEqual({ onConflict: 'user_id' })
  })

  it('never throws when the upsert fails (mirror is best-effort)', async () => {
    h.upsert.mockRejectedValue(new Error('db down'))
    await expect(
      syncRunCount({ userId: 'u1', dbKey: 'express_reviewer', newCount: 1, dbRunCounts: {} })
    ).resolves.toBeUndefined()
  })
})

describe('EXPRESS_TOTAL_LIMITS', () => {
  it('defines positive integer caps for the three expensive express features', () => {
    expect(EXPRESS_TOTAL_LIMITS).toEqual({
      express_reviewer:      5,
      express_defence_brief: 5,
      express_simulator:     10,
    })
    for (const [k, v] of Object.entries(EXPRESS_TOTAL_LIMITS)) {
      expect(Number.isInteger(v), `${k} must be integer`).toBe(true)
      expect(v, `${k} must be > 0`).toBeGreaterThan(0)
    }
  })

  it('intentionally does NOT cap the coach (daily rate limit only)', () => {
    expect(EXPRESS_TOTAL_LIMITS.express_defence_brief_coach).toBeUndefined()
  })
})
