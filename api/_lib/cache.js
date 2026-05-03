import { createHash } from 'crypto';

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL;
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;

function authHeaders() {
  return { Authorization: `Bearer ${UPSTASH_TOKEN}` };
}

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

export function buildCacheKey(prefix, systemPrompt, userPrompt) {
  return createHash('sha256')
    .update(prefix + systemPrompt + userPrompt)
    .digest('hex');
}

function incrementHits() {
  if (!UPSTASH_URL || !UPSTASH_TOKEN) return;
  fetch(`${UPSTASH_URL}/incr/stats:cache_hits`, {
    method: 'POST',
    headers: authHeaders(),
  }).catch(() => {});
}
