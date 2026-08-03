// Retry-then-dead-letter wrapper for side effects that must not be silently
// dropped (an alert that never sends, a nurture email trigger that never
// fires). Vercel freezes a function once its response is sent — an
// un-awaited promise still in flight risks never completing (the same bug
// class as the unawaited login Telegram alert fixed in be60a7b). Callers of
// `reliably()` must `await` it, before sending the response, so the retries
// actually get to run.

import { supabaseAdmin } from './supabase-admin.js';
import { Sentry } from './sentry-server.js';

const RETRY_DELAYS_MS = [500, 2000]; // 3 total attempts: immediate, +500ms, +2000ms

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Runs `fn`, retrying with backoff on failure. If every attempt fails,
 * writes a row to dead_letter_queue and captures a Sentry message, so the
 * failure is recorded rather than silently lost. Never throws.
 * @param {() => Promise<void>} fn
 * @param {object} meta
 * @param {string} meta.feature    - short id, e.g. 'nurture-email:welcome'
 * @param {object} [meta.payload]  - JSON-serialisable context for later inspection/replay
 * @returns {Promise<{ ok: boolean }>}
 */
export async function reliably(fn, { feature, payload }) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      await fn();
      return { ok: true };
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_DELAYS_MS.length) await delay(RETRY_DELAYS_MS[attempt]);
    }
  }
  await deadLetter(feature, payload, lastErr);
  return { ok: false };
}

async function deadLetter(feature, payload, err) {
  const message = String(err?.message || err);
  console.error(`[reliable-async] ${feature} exhausted retries — dead-lettering:`, message);

  Sentry.captureMessage(
    `[dead-letter] ${feature} failed after ${RETRY_DELAYS_MS.length + 1} attempts: ${message}`,
    'error'
  );

  try {
    await supabaseAdmin.from('dead_letter_queue').insert({
      feature,
      payload:       payload ?? null,
      error_message: message.slice(0, 500),
    });
  } catch (dlErr) {
    console.error('[reliable-async] dead-letter insert also failed:', dlErr?.message);
  }
}
