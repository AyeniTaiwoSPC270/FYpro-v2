// api/_lib/trace.js
import { randomBytes } from 'crypto';

/**
 * Returns a short request-scoped ID like "fyp-3a8f2c1b".
 * Paste it into Vercel log search to find every log line from one request.
 */
export function generateTraceId() {
  return 'fyp-' + randomBytes(4).toString('hex');
}

/**
 * Wraps console.error / console.warn with the trace ID prefix.
 * @param {string} traceId
 * @param {'error'|'warn'} level
 * @param {...unknown} args
 */
export function traceLog(traceId, level, ...args) {
  const fn = level === 'warn' ? console.warn : console.error;
  fn(`[${traceId}]`, ...args);
}
