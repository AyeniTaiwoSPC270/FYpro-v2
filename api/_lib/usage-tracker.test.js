// Tests for the spend ceilings: checkDailyCap (global) + checkUserCap (per-user)
// + trackUserUsage.
//
// This is the P0 abuse defence — without it one free-tier account (or an infra
// outage) can drain the global DAILY_CAP_USD and deny service to paying users.
// Both caps now fail CLOSED on a dependency outage (W2 — see
// docs/architecture/2026-08-02-w2-failure-policy-decision-table.md, row 2/3):
// a regression here either re-opens the uncapped-spend hole, or wrongly locks
// out legitimate users.
//
// Strategy: mock the redis handle (from rate-limit.js) and supabaseAdmin's
// `.from()` chain so each test programs its own counter/row value, and stub
// out failure-policy.js's alerting dependencies so trips don't hit real infra.

import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => ({ redis: null, supabaseFrom: null }))

vi.mock('./supabase-admin.js', () => ({
  supabaseAdmin: { from: (...a) => h.supabaseFrom(...a) },
}))
vi.mock('./rate-limit.js', () => ({
  redis: {
    get:        (...a) => h.redis.get(...a),
    incrbyfloat:(...a) => h.redis.incrbyfloat(...a),
    expire:     (...a) => h.redis.expire(...a),
  },
}))
vi.mock('./telegram.js', () => ({ sendTelegramAlertOnce: vi.fn() }))
vi.mock('./sentry-server.js', () => ({ Sentry: { captureMessage: vi.fn() } }))
vi.mock('./system-log.js', () => ({ writeSystemLog: vi.fn() }))

const { checkUserCap, trackUserUsage, checkDailyCap } = await import('./usage-tracker.js')

const FREE_CAP = 0.75
const PAID_CAP = 4

function supabaseFromReturning(maybeSingleResult) {
  return vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(maybeSingleResult),
  }))
}

beforeEach(() => {
  h.redis = {
    get:         vi.fn().mockResolvedValue(null),
    incrbyfloat: vi.fn().mockResolvedValue('0'),
    expire:      vi.fn().mockResolvedValue(1),
  }
  h.supabaseFrom = supabaseFromReturning({ data: null, error: null })
  delete process.env.DAILY_CAP_USD
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

  it('FAILS CLOSED when redis throws — an outage must never uncap spend', async () => {
    h.redis.get.mockRejectedValue(new Error('redis down'))
    const r = await checkUserCap('user-1', false)
    expect(r.allowed).toBe(false)
  })
})

describe('checkDailyCap', () => {
  it('allows when spent is under the cap', async () => {
    process.env.DAILY_CAP_USD = '10'
    h.supabaseFrom = supabaseFromReturning({ data: { total_cost_usd: '3.50' }, error: null })
    const r = await checkDailyCap()
    expect(r).toMatchObject({ allowed: true, spent: 3.5, cap: 10 })
  })

  it('blocks when spent is at or over the cap', async () => {
    process.env.DAILY_CAP_USD = '10'
    h.supabaseFrom = supabaseFromReturning({ data: { total_cost_usd: '10' }, error: null })
    const r = await checkDailyCap()
    expect(r.allowed).toBe(false)
  })

  it('treats a missing row as zero spend, allowed', async () => {
    h.supabaseFrom = supabaseFromReturning({ data: null, error: null })
    const r = await checkDailyCap()
    expect(r).toMatchObject({ allowed: true, spent: 0 })
  })

  it('defaults the cap to 10 when DAILY_CAP_USD is unset', async () => {
    h.supabaseFrom = supabaseFromReturning({ data: null, error: null })
    const r = await checkDailyCap()
    expect(r.cap).toBe(10)
  })

  it('FAILS CLOSED when the Supabase query errors — an outage must never uncap spend', async () => {
    h.supabaseFrom = supabaseFromReturning({ data: null, error: new Error('db error') })
    const r = await checkDailyCap()
    expect(r.allowed).toBe(false)
  })

  it('FAILS CLOSED when the Supabase call throws outright', async () => {
    h.supabaseFrom = vi.fn(() => { throw new Error('connection refused') })
    const r = await checkDailyCap()
    expect(r.allowed).toBe(false)
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
