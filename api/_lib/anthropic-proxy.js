// Shared Anthropic API call utility.
// Handles: API key check, HTTP call, token tracking, response_times insert, timeout error handling.
// Does NOT handle: auth, rate limiting, caching, entitlement checks — those belong in callers.

import { supabaseAdmin }    from './supabase-admin.js';
import { trackUsage, trackUserUsage } from './usage-tracker.js';
import { sendTelegramAlert } from './telegram.js';

const ANTHROPIC_API_URL  = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION  = '2023-06-01';
const DEFAULT_TIMEOUT_MS = 50000;

/**
 * Makes an authenticated call to the Anthropic Messages API.
 * Inserts a row into response_times on success. Sends a Telegram alert on failure.
 *
 * @param {object} options
 * @param {string}   options.feature      - Label for response_times and logs (e.g. 'topic-validator')
 * @param {string}   options.userId       - Verified Supabase user ID for response_times
 * @param {string}   options.model        - Anthropic model ID (already validated by caller)
 * @param {number}   options.max_tokens   - Already capped by caller
 * @param {string}   options.system       - Resolved system prompt
 * @param {Array}    options.messages     - Message array
 * @param {number}   [options.temperature=0]
 * @returns {Promise<{ response: Response, data: object, durationMs: number }>}
 */
export async function callAnthropic({
  feature,
  userId,
  model,
  max_tokens,
  system,
  messages,
  temperature = 0,
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw Object.assign(new Error('ANTHROPIC_API_KEY is not set'), { isConfig: true });

  const start    = Date.now();
  const response = await fetch(ANTHROPIC_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-beta':    'pdfs-2024-09-25',
    },
    body:   JSON.stringify({ model, max_tokens, system, messages, temperature }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  const data       = await response.json();
  const durationMs = Date.now() - start;

  if (data.usage) {
    await trackUsage(data.usage.input_tokens, data.usage.output_tokens, model);
    await trackUserUsage(userId, data.usage.input_tokens, data.usage.output_tokens, model);
  }

  if (response.ok) {
    const insertPromise  = supabaseAdmin
      .from('response_times')
      .insert({ feature, duration_ms: durationMs, user_id: userId });
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
    await Promise.race([insertPromise, timeoutPromise]).catch(err =>
      console.error(`[anthropic-proxy] response_times insert failed (${feature}):`, err?.message)
    );
  } else {
    sendTelegramAlert(`🔴 Generation failed: ${feature} for user:${userId.slice(0, 8)} — Anthropic ${response.status}: ${String(data?.error?.message || data?.type || '').slice(0, 120)}`);
  }

  return { response, data, durationMs };
}
