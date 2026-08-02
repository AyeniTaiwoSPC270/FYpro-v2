// Tests for guardedCheck — the shared fail-open/fail-closed decision used by
// checkDailyCap, checkUserCap (closed) and rateLimitCheck (open).

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./telegram.js', () => ({ sendTelegramAlertOnce: vi.fn() }))
vi.mock('./sentry-server.js', () => ({ Sentry: { captureMessage: vi.fn() } }))
vi.mock('./system-log.js', () => ({ writeSystemLog: vi.fn() }))

const { guardedCheck } = await import('./failure-policy.js')
const { sendTelegramAlertOnce } = await import('./telegram.js')
const { Sentry } = await import('./sentry-server.js')
const { writeSystemLog } = await import('./system-log.js')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('guardedCheck', () => {
  it('returns the checkFn result when it resolves, and records nothing', async () => {
    const r = await guardedCheck(
      async () => ({ allowed: true, spent: 1, cap: 10 }),
      { policy: 'closed', name: 'test-check', openResult: { allowed: true }, closedResult: { allowed: false } }
    )
    expect(r).toEqual({ allowed: true, spent: 1, cap: 10 })
    expect(writeSystemLog).not.toHaveBeenCalled()
    expect(sendTelegramAlertOnce).not.toHaveBeenCalled()
  })

  it('policy closed: returns closedResult when checkFn throws', async () => {
    const r = await guardedCheck(
      async () => { throw new Error('supabase down') },
      { policy: 'closed', name: 'test-check', openResult: { allowed: true }, closedResult: { allowed: false, spent: 0, cap: 10 } }
    )
    expect(r).toEqual({ allowed: false, spent: 0, cap: 10 })
  })

  it('policy open: returns openResult when checkFn throws', async () => {
    const r = await guardedCheck(
      async () => { throw new Error('redis down') },
      { policy: 'open', name: 'test-check', openResult: { allowed: true, reason: '' }, closedResult: { allowed: false } }
    )
    expect(r).toEqual({ allowed: true, reason: '' })
  })

  it('records the trip once: system_logs, Sentry, and a deduplicated Telegram alert', async () => {
    await guardedCheck(
      async () => { throw new Error('boom') },
      { policy: 'closed', name: 'test-check', openResult: null, closedResult: null }
    )
    expect(writeSystemLog).toHaveBeenCalledTimes(1)
    expect(writeSystemLog).toHaveBeenCalledWith(expect.objectContaining({
      feature: 'fail-closed:test-check',
      severity: 'error',
    }))
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(sendTelegramAlertOnce).toHaveBeenCalledTimes(1)
    const [message, dedupeKey] = sendTelegramAlertOnce.mock.calls[0]
    expect(message).toContain('test-check')
    expect(message).toContain('CLOSED')
    expect(dedupeKey).toMatch(/^tg:failpolicy:test-check:\d{4}-\d{2}-\d{2}$/)
  })

  it('never throws, even if checkFn rejects with a non-Error', async () => {
    await expect(guardedCheck(
      async () => { throw 'raw string error' },
      { policy: 'open', name: 'test-check', openResult: 'fallback', closedResult: null }
    )).resolves.toBe('fallback')
  })
})
