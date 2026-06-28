// Express beta mode helper — used by API routes.
// Caches express_beta_free flag in Redis for 30 seconds, falls back to Supabase.

import { Redis } from '@upstash/redis';
import { supabaseAdmin } from './supabase-admin.js';

const REDIS_KEY = 'app:express_beta_free';
const REDIS_TTL = 30; // seconds

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function getExpressBetaFree() {
  try {
    const cached = await redis.get(REDIS_KEY);
    if (cached !== null && cached !== undefined) {
      return cached === 'true' || cached === true;
    }
  } catch {
    // Redis unavailable — fall through to Supabase
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('app_config')
      .select('value')
      .eq('key', 'express_beta_free')
      .maybeSingle();

    if (error) return false;

    const active = data?.value === 'true';
    redis.set(REDIS_KEY, String(active), { ex: REDIS_TTL }).catch(() => {});
    return active;
  } catch {
    return false;
  }
}

export async function setExpressBetaFree(enabled) {
  const { error } = await supabaseAdmin
    .from('app_config')
    .upsert({
      key:        'express_beta_free',
      value:      String(enabled),
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;

  await redis.set(REDIS_KEY, String(enabled), { ex: REDIS_TTL }).catch(() => {});
}
