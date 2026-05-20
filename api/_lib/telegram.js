import { Redis } from '@upstash/redis'

let _redis = null

function getRedis() {
  if (!process.env.UPSTASH_REDIS_REST_URL) return null
  if (!_redis) {
    _redis = new Redis({
      url:   process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    })
  }
  return _redis
}

/**
 * Fire-and-forget Telegram alert. Never throws.
 * No-ops silently if TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID are not set.
 */
export async function sendTelegramAlert(message) {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
      signal:  AbortSignal.timeout(8000),
    })
  } catch (err) {
    console.error('[telegram] alert failed:', err.message)
  }
}

/**
 * Send a Telegram alert at most once per dedupeKey window.
 * Uses Redis to deduplicate; falls back to always sending if Redis is unavailable.
 * @param {string} dedupeKey - unique key, e.g. 'tg:spend:cap:2026-05-11'
 * @param {number} ttlSeconds - how long to suppress duplicates (default 24 hours)
 */
export async function sendTelegramAlertOnce(message, dedupeKey, ttlSeconds = 86400) {
  try {
    const redis = getRedis()
    if (redis) {
      const exists = await redis.get(dedupeKey)
      if (exists) return
      await redis.set(dedupeKey, '1', { ex: ttlSeconds })
    }
    await sendTelegramAlert(message)
  } catch (err) {
    console.error('[telegram] dedupe alert failed:', err.message)
  }
}
