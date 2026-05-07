import { supabaseAdmin } from './supabase-admin.js';

/**
 * Fire-and-forget insert into system_logs.
 * Never throws — a logging failure must never propagate to the caller.
 */
export async function writeSystemLog({ severity, feature, source, plain_message, raw_detail }) {
  try {
    const { error } = await supabaseAdmin.from('system_logs').insert({
      severity,
      feature,
      source,
      plain_message,
      raw_detail: raw_detail ?? null,
    });
    if (error) console.error('[system-log] insert failed:', error.message);
  } catch (err) {
    console.error('[system-log] unexpected error:', err.message);
  }
}
