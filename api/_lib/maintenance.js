// Maintenance mode helper — used by API routes (not middleware).
// Middleware uses direct Upstash REST calls for edge compatibility.

import { Redis } from '@upstash/redis';
import { supabaseAdmin } from './supabase-admin.js';

const REDIS_KEY = 'app:maintenance_mode';
const REDIS_TTL = 30; // seconds

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function getMaintenanceMode() {
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
      .eq('key', 'maintenance_mode')
      .maybeSingle();

    if (error) return false;

    const active = data?.value === 'true';

    redis.set(REDIS_KEY, String(active), { ex: REDIS_TTL }).catch(() => {});

    return active;
  } catch {
    return false;
  }
}

export async function setMaintenanceMode(enabled) {
  const { error } = await supabaseAdmin
    .from('app_config')
    .upsert({
      key:        'maintenance_mode',
      value:      String(enabled),
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;

  // Update Redis immediately so middleware picks it up within one request
  await redis.set(REDIS_KEY, String(enabled), { ex: REDIS_TTL }).catch(() => {});
}
