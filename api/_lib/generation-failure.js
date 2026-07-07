// api/_lib/generation-failure.js
// Server-side counterpart to the client's best-effort logFailure() in
// src/services/api.js — but reliable in cases the client never learns about
// (e.g. this request's own JSON validation failure, detected and handled
// entirely server-side before a response is sent). Writes through the service
// role client, which bypasses RLS, so no policy change is needed against the
// existing generation_failures table (migration 0004).

import { supabaseAdmin } from './supabase-admin.js';

/**
 * @param {object} args
 * @param {string|null} args.userId       - Verified Supabase user id (table allows null)
 * @param {string}      args.feature      - snake_case or kebab-case step identifier
 * @param {string}      args.errorMessage - Human-readable failure detail (not user-facing)
 * @returns {Promise<void>} Never throws.
 */
export async function logServerGenerationFailure({ userId, feature, errorMessage }) {
  try {
    await supabaseAdmin.from('generation_failures').insert({
      user_id:       userId || null,
      feature,
      error_type:    'validation',
      error_message: String(errorMessage).slice(0, 500),
    });
  } catch (err) {
    console.error('[generation-failure] log insert failed:', err?.message);
  }
}
