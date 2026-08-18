// Daily report alert preference — used by api/admin.js (handleDailyReport) and
// the Telegram bot's /alerts command (api/notify.js).
// Unlike maintenance_mode / express_beta_free, this defaults to ENABLED when
// no app_config row exists yet, preserving the existing always-on behavior.

import { Redis } from '@upstash/redis';
import { supabaseAdmin } from './supabase-admin.js';

const REDIS_KEY = 'app:daily_report_enabled';
const REDIS_TTL = 30; // seconds

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function getDailyReportEnabled() {
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
      .eq('key', 'daily_report_enabled')
      .maybeSingle();

    if (error) return true;

    // No row yet = never toggled = preserve the existing always-on default
    const enabled = data ? data.value !== 'false' : true;

    redis.set(REDIS_KEY, String(enabled), { ex: REDIS_TTL }).catch(() => {});

    return enabled;
  } catch {
    return true;
  }
}

export async function setDailyReportEnabled(enabled) {
  const { error } = await supabaseAdmin
    .from('app_config')
    .upsert({
      key:        'daily_report_enabled',
      value:      String(enabled),
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;

  await redis.set(REDIS_KEY, String(enabled), { ex: REDIS_TTL }).catch(() => {});
}
