// Rating modal force flag — Redis-backed with Supabase fallback.
// When enabled, the rating modal appears for every authenticated user
// on their next AppShell mount, regardless of prior dismissal or step.
// Intended for admin testing of the rating modal + submission flow.

import { Redis } from '@upstash/redis';
import { supabaseAdmin } from './supabase-admin.js';

const REDIS_KEY = 'app:rating_modal_force';
const REDIS_TTL = 60; // seconds

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function getRatingForce() {
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
      .eq('key', 'rating_modal_force')
      .maybeSingle();

    if (error) return false;

    const active = data?.value === 'true';
    redis.set(REDIS_KEY, String(active), { ex: REDIS_TTL }).catch(() => {});
    return active;
  } catch {
    return false;
  }
}

export async function setRatingForce(enabled) {
  const { error } = await supabaseAdmin
    .from('app_config')
    .upsert({
      key:        'rating_modal_force',
      value:      String(enabled),
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;

  await redis.set(REDIS_KEY, String(enabled), { ex: REDIS_TTL }).catch(() => {});
}
