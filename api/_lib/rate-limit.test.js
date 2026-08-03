// Tests for rateLimitCheck — the shared per-IP + per-user daily limiter.
// Fails OPEN on a Redis outage (W2 — see
// docs/architecture/2026-08-02-w2-failure-policy-decision-table.md, row 1):
// unlike the spend caps, availability wins here. The trip must still be
// recorded, never silent.

import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => ({ limit: null }))

vi.mock('@upstash/redis', () => ({ Redis: class {} }))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static fixedWindow() { return 'fixedWindow-config'; }
    constructor() {}
    limit(...a) { return h.limit(...a); }
  },
}))
vi.mock('./telegram.js', () => ({ sendTelegramAlertOnce: vi.fn() }))
vi.mock('./sentry-server.js', () => ({ Sentry: { captureMessage: vi.fn() } }))
vi.mock('./system-log.js', () => ({ writeSystemLog: vi.fn() }))

const { rateLimitCheck } = await import('./rate-limit.js')

function makeReq({ headers = {}, ip = '1.2.3.4', token = null } = {}) {
  const authHeader = token
    ? `Bearer header.${Buffer.from(JSON.stringify({ sub: token })).toString('base64')}.sig`
    : undefined;
  return {
    headers: { 'x-forwarded-for': ip, ...(authHeader ? { authorization: authHeader } : {}), ...headers },
    socket: {},
  };
}

beforeEach(() => {
  h.limit = vi.fn().mockResolvedValue({ success: true })
})

describe('rateLimitCheck', () => {
  it('allows a request under both the IP and user limits', async () => {
    const r = await rateLimitCheck(makeReq({ token: 'user-1' }), { userDay: 10, ipDay: 20, prefix: 'test' })
    expect(r).toEqual({ allowed: true, reason: '' })
  })

  it('blocks when the IP limiter reports failure', async () => {
    h.limit = vi.fn().mockResolvedValue({ success: false })
    const r = await rateLimitCheck(makeReq(), { userDay: 10, ipDay: 20, prefix: 'test' })
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/tomorrow/)
  })

  it('skips the user check when there is no authenticated user', async () => {
    const r = await rateLimitCheck(makeReq(), { userDay: 10, ipDay: 20, prefix: 'test' })
    expect(r.allowed).toBe(true)
    expect(h.limit).toHaveBeenCalledTimes(1) // only the IP limiter
  })

  it('FAILS OPEN when Redis throws — an outage must never lock out legitimate users', async () => {
    h.limit = vi.fn().mockRejectedValue(new Error('redis down'))
    const r = await rateLimitCheck(makeReq({ token: 'user-1' }), { userDay: 10, ipDay: 20, prefix: 'test' })
    expect(r.allowed).toBe(true)
  })

  it('never throws even when Redis is unreachable', async () => {
    h.limit = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(
      rateLimitCheck(makeReq(), { userDay: 10, ipDay: 20, prefix: 'test' })
    ).resolves.toBeDefined()
  })
})
