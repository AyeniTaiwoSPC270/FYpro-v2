// Tests for sendTelegramAlert/sendTelegramAlertOnce.
// sendTelegramAlert now retries via reliably() (W2) — see reliable-async.test.js
// for retry/dead-letter coverage; these tests focus on telegram.js's own logic:
// env-var no-op, non-ok response handling, and the dedupe wrapper.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const originalFetch = global.fetch

vi.mock('./reliable-async.js', () => ({ reliably: vi.fn() }))

const { sendTelegramAlert, sendTelegramAlertOnce, escapeTgHtml } = await import('./telegram.js')
const { reliably } = await import('./reliable-async.js')

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = 'test-token'
  process.env.TELEGRAM_CHAT_ID   = 'test-chat'
  reliably.mockReset()
})

afterEach(() => {
  global.fetch = originalFetch
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_CHAT_ID
})

describe('sendTelegramAlert', () => {
  it('no-ops without throwing when TELEGRAM_BOT_TOKEN is unset', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    await expect(sendTelegramAlert('hello')).resolves.toBeUndefined()
    expect(reliably).not.toHaveBeenCalled()
  })

  it('no-ops without throwing when TELEGRAM_CHAT_ID is unset', async () => {
    delete process.env.TELEGRAM_CHAT_ID
    await expect(sendTelegramAlert('hello')).resolves.toBeUndefined()
    expect(reliably).not.toHaveBeenCalled()
  })

  it('delegates to reliably() with the telegram-alert feature tag', async () => {
    reliably.mockResolvedValue({ ok: true })
    await sendTelegramAlert('hello world')
    expect(reliably).toHaveBeenCalledTimes(1)
    const [, meta] = reliably.mock.calls[0]
    expect(meta.feature).toBe('telegram-alert')
    expect(meta.payload.message).toContain('hello world')
  })

  it('the wrapped function throws on a non-ok Telegram response, so reliably() will retry it', async () => {
    reliably.mockImplementation(async (fn) => { await fn(); return { ok: true } })
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 })
    await expect(sendTelegramAlert('hello')).rejects.toThrow('Telegram API 429')
  })

  it('the wrapped function resolves cleanly on a 200 from Telegram', async () => {
    reliably.mockImplementation(async (fn) => { await fn(); return { ok: true } })
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    await expect(sendTelegramAlert('hello')).resolves.toBeUndefined()
  })
})

describe('escapeTgHtml', () => {
  it('escapes &, <, and >', () => {
    expect(escapeTgHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d')
  })
})

describe('sendTelegramAlertOnce', () => {
  it('calls sendTelegramAlert (via reliably) when no Redis is configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    reliably.mockResolvedValue({ ok: true })
    await sendTelegramAlertOnce('hi', 'dedupe-key-1')
    expect(reliably).toHaveBeenCalledTimes(1)
  })
})
