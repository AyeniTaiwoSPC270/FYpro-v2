// Recovers from a failed lazy-route chunk load — a stale index.html after a
// redeploy (hashed chunk 404s on the CDN) or a flaky-network preload error —
// by reloading the page once to pick up the fresh app shell.
//
// The guard is attempt-limited AND time-windowed so a reload that never fixes
// the problem (e.g. a stale service worker keeps serving the old shell offline)
// cannot spin into an infinite reload loop. After the cap is hit we return
// false so the caller lets the error boundary show its fallback instead.
//
// Shared by main.jsx (vite:preloadError) and App.jsx (safeLazy) so both
// recovery paths draw from the same attempt budget.

const KEY = 'chunk-reload'
const MAX_ATTEMPTS = 1 // reload once; a second immediate failure = give up
const WINDOW_MS = 30_000 // attempts older than this are a fresh incident, not a loop

function readState() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY) || 'null')
  } catch {
    return null
  }
}

function writeState(state) {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(state))
  } catch {
    /* sessionStorage unavailable (private mode / quota) — best effort only */
  }
}

/**
 * Attempt a one-shot recovery reload for a failed chunk load.
 * @returns {boolean} true if a reload was triggered (or is in progress),
 *   false if the attempt cap was reached and the caller should surface the error.
 */
export function tryChunkReload() {
  const now = Date.now()
  let state = readState()

  // Treat a failure long after the last attempt as a fresh incident, not a loop.
  if (!state || now - state.t > WINDOW_MS) {
    state = { n: 0, t: now }
  }

  if (state.n >= MAX_ATTEMPTS) {
    return false
  }

  writeState({ n: state.n + 1, t: now })
  window.location.reload()
  return true
}
