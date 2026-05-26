import { createHash } from 'crypto';

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function authHeaders() {
  return { Authorization: `Bearer ${UPSTASH_TOKEN}` };
}

/**
 * Retrieves a cached value from Upstash Redis by key.
 * @param {string} key - SHA-256 hex key produced by buildCacheKey
 * @returns {Promise<object|null>} Parsed cached value, or null on cache miss / unavailable Redis
 */
export async function getCached(key) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return null;
  try {
    const res  = await fetch(`${UPSTASH_URL}/get/${key}`, { headers: authHeaders() });
    const json = await res.json();
    if (json.result == null) return null;
    incrementHits();
    return JSON.parse(json.result);
  } catch {
    return null;
  }
}

/**
 * Stores a JSON-serialisable value in Upstash Redis with a TTL. Never throws.
 * @param {string} key        - SHA-256 hex key produced by buildCacheKey
 * @param {object} value      - Value to cache (must be JSON-serialisable)
 * @param {number} ttlSeconds - Cache lifetime in seconds
 * @returns {Promise<void>}
 */
export async function setCached(key, value, ttlSeconds) {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  try {
    const encoded = encodeURIComponent(JSON.stringify(value));
    await fetch(`${UPSTASH_URL}/set/${key}/${encoded}?ex=${ttlSeconds}`, {
      method: 'POST',
      headers: authHeaders(),
    });
  } catch {
    // never throw
  }
}

/**
 * Builds a deterministic SHA-256 cache key from a step prefix and both prompt strings.
 * @param {string} prefix       - Short step identifier (e.g. 'topic-validator')
 * @param {string} systemPrompt - Full server-resolved system prompt
 * @param {string} userPrompt   - Serialised user message content
 * @returns {string} 64-character lowercase hex digest
 */
export function buildCacheKey(prefix, systemPrompt, userPrompt) {
  return createHash('sha256')
    .update(prefix + systemPrompt + userPrompt)
    .digest('hex');
}

function incrementHits() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  const today = new Date().toISOString().slice(0, 10);
  fetch(`${UPSTASH_URL}/incr/stats:cache_hits:${today}`, {
    method: 'POST',
    headers: authHeaders(),
  }).catch(() => {});
}
