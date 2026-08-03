// Tests for reliably() — retry with backoff, then dead-letter on exhaustion.
// Uses real timers with tiny delays would be flaky; fake timers keep this fast
// and deterministic.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const h = vi.hoisted(() => ({ insert: null }))

vi.mock('./supabase-admin.js', () => ({
  supabaseAdmin: { from: () => ({ insert: (...a) => h.insert(...a) }) },
}))
vi.mock('./sentry-server.js', () => ({ Sentry: { captureMessage: vi.fn() } }))

const { reliably } = await import('./reliable-async.js')
const { Sentry } = await import('./sentry-server.js')

beforeEach(() => {
  vi.useFakeTimers()
  h.insert = vi.fn().mockResolvedValue({ error: null })
  Sentry.captureMessage.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

async function runWithFakeTimers(promise) {
  // Drain both retry backoff windows (500ms, 2000ms) so the promise can settle.
  await vi.advanceTimersByTimeAsync(500)
  await vi.advanceTimersByTimeAsync(2000)
  return promise
}

describe('reliably', () => {
  it('succeeds on the first attempt without retrying', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const result = await reliably(fn, { feature: 'test' })
    expect(result).toEqual({ ok: true })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('retries after a failure and succeeds on the second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(undefined)
    const promise = reliably(fn, { feature: 'test' })
    const result = await runWithFakeTimers(promise)
    expect(result).toEqual({ ok: true })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('dead-letters after 3 total failed attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permanently down'))
    const promise = reliably(fn, { feature: 'test-feature', payload: { a: 1 } })
    const result = await runWithFakeTimers(promise)
    expect(result).toEqual({ ok: false })
    expect(fn).toHaveBeenCalledTimes(3)
    expect(h.insert).toHaveBeenCalledTimes(1)
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({
      feature: 'test-feature',
      payload: { a: 1 },
      error_message: expect.stringContaining('permanently down'),
    }))
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('never throws even if the dead-letter insert itself fails', async () => {
    h.insert = vi.fn().mockRejectedValue(new Error('db also down'))
    const fn = vi.fn().mockRejectedValue(new Error('permanently down'))
    const promise = reliably(fn, { feature: 'test' })
    await expect(runWithFakeTimers(promise)).resolves.toEqual({ ok: false })
  })
})
