// Tests for the per-user daily spend ceiling: checkUserCap + trackUserUsage.
//
// This is the P0 abuse defence — without it one free-tier account can drain the
// global DAILY_CAP_USD and deny service to paying users. A regression here either
// re-opens that hole (cap not enforced) or wrongly locks out legitimate users.
//
// Strategy: mock the redis handle (from rate-limit.js) so each test programs its
// own counter value, and stub supabase-admin.js (it throws at import without env
// vars and the per-user helpers never touch it).

import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => ({ redis: null }))

vi.mock('./supabase-admin.js', () => ({ supabaseAdmin: {} }))
vi.mock('./rate-limit.js', () => ({
  redis: {
    get:        (...a) => h.redis.get(...a),
    incrbyfloat:(...a) => h.redis.incrbyfloat(...a),
    expire:     (...a) => h.redis.expire(...a),
  },
}))

const { checkUserCap, trackUserUsage } = await import('./usage-tracker.js')

const FREE_CAP = 0.75
const PAID_CAP = 4

beforeEach(() => {
  h.redis = {
    get:         vi.fn().mockResolvedValue(null),
    incrbyfloat: vi.fn().mockResolvedValue('0'),
    expire:      vi.fn().mockResolvedValue(1),
  }
})

describe('checkUserCap', () => {
  it('allows a free user under the free ceiling', async () => {
    h.redis.get.mockResolvedValue('0.40')
    const r = await checkUserCap('user-1', false)
    expect(r).toMatchObject({ allowed: true, cap: FREE_CAP, isPaid: false })
    expect(r.spent).toBeCloseTo(0.40)
  })

  it('blocks a free user at or over the free ceiling', async () => {
    h.redis.get.mockResolvedValue('0.80')
    const r = await checkUserCap('user-1', false)
    expect(r.allowed).toBe(false)
    expect(r.cap).toBe(FREE_CAP)
  })

  it('blocks exactly at the ceiling (spent === cap is not allowed)', async () => {
    h.redis.get.mockResolvedValue(String(FREE_CAP))
    const r = await checkUserCap('user-1', false)
    expect(r.allowed).toBe(false)
  })

  it('gives paid users the higher ceiling — spend above the free cap still passes', async () => {
    h.redis.get.mockResolvedValue('1.50')
    const r = await checkUserCap('user-1', true)
    expect(r).toMatchObject({ allowed: true, cap: PAID_CAP, isPaid: true })
  })

  it('blocks a paid user over the paid ceiling', async () => {
    h.redis.get.mockResolvedValue('4.20')
    const r = await checkUserCap('user-1', true)
    expect(r.allowed).toBe(false)
    expect(r.cap).toBe(PAID_CAP)
  })

  it('treats a missing counter as zero spend', async () => {
    h.redis.get.mockResolvedValue(null)
    const r = await checkUserCap('user-1', false)
    expect(r).toMatchObject({ allowed: true, spent: 0 })
  })

  it('allows when there is no userId (cannot key a counter)', async () => {
    const r = await checkUserCap(null, false)
    expect(r.allowed).toBe(true)
    expect(h.redis.get).not.toHaveBeenCalled()
  })

  it('FAILS OPEN when redis throws — infra failure must never block users', async () => {
    h.redis.get.mockRejectedValue(new Error('redis down'))
    const r = await checkUserCap('user-1', false)
    expect(r.allowed).toBe(true)
  })
})

describe('trackUserUsage', () => {
  it('adds the call cost to the user counter and refreshes its TTL', async () => {
    await trackUserUsage('user-1', 1000, 1000) // 1000*3/1e6 + 1000*15/1e6 = 0.018
    expect(h.redis.incrbyfloat).toHaveBeenCalledTimes(1)
    const [key, amount] = h.redis.incrbyfloat.mock.calls[0]
    expect(key).toMatch(/^cost:user:user-1:\d{4}-\d{2}-\d{2}$/)
    expect(amount).toBeCloseTo(0.018)
    expect(h.redis.expire).toHaveBeenCalledWith(key, expect.any(Number))
  })

  it('is a no-op without a userId', async () => {
    await trackUserUsage(null, 1000, 1000)
    expect(h.redis.incrbyfloat).not.toHaveBeenCalled()
  })

  it('never throws when redis fails (cost tracking is best-effort)', async () => {
    h.redis.incrbyfloat.mockRejectedValue(new Error('redis down'))
    await expect(trackUserUsage('user-1', 500, 500)).resolves.toBeUndefined()
  })
})

describe('model-aware pricing', () => {
  it('prices Sonnet calls at $3 in / $15 out per 1M tokens', async () => {
    await trackUserUsage('user-1', 1_000_000, 100_000, 'claude-sonnet-4-6')
    const [, amount] = h.redis.incrbyfloat.mock.calls[0]
    expect(amount).toBeCloseTo(3 + 1.5)
  })

  it('prices Haiku calls at $1 in / $5 out per 1M tokens', async () => {
    await trackUserUsage('user-1', 1_000_000, 100_000, 'claude-haiku-4-5-20251001')
    const [, amount] = h.redis.incrbyfloat.mock.calls[0]
    expect(amount).toBeCloseTo(1 + 0.5)
  })

  it('falls back to Sonnet rates for an unknown model ID', async () => {
    await trackUserUsage('user-1', 1000, 1000, 'claude-nonexistent-9')
    const [, amount] = h.redis.incrbyfloat.mock.calls[0]
    expect(amount).toBeCloseTo(0.018)
  })

  it('falls back to Sonnet rates when model is omitted (legacy call sites)', async () => {
    await trackUserUsage('user-1', 1000, 1000)
    const [, amount] = h.redis.incrbyfloat.mock.calls[0]
    expect(amount).toBeCloseTo(0.018)
  })
})
