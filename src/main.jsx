import './lib/sentry'
import posthog from 'posthog-js'
import * as Sentry from "@sentry/react";

if (import.meta.env.VITE_POSTHOG_KEY) {
  const cookieConsent = localStorage.getItem('cookie_consent')
  posthog.init(import.meta.env.VITE_POSTHOG_KEY, {
    api_host: 'https://app.posthog.com',
    capture_pageview: false,
    opt_out_capturing_by_default: cookieConsent !== 'accepted',
  })
}
import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import { tryChunkReload } from './lib/chunkReload'

// A failed lazy-route chunk (stale index.html after a redeploy, or a network
// blip mid-session) is recoverable by reloading — do it automatically instead
// of stranding the user on the error boundary. tryChunkReload() is attempt-
// limited, so if the reload doesn't fix it we fall through to Vite's default
// (which surfaces the error boundary) rather than looping forever.
window.addEventListener('vite:preloadError', (event) => {
  if (tryChunkReload()) event.preventDefault()
})

const SentryErrorFallback = () => (
  <div style={{
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    height: '100vh', backgroundColor: '#0a0f1e',
    color: 'white', fontFamily: 'Arial, sans-serif'
  }}>
    <h2>Something went wrong</h2>
    <p>We've been notified and are working on a fix.</p>
    <button
      onClick={() => window.location.reload()}
      style={{
        marginTop: '16px', padding: '10px 24px',
        backgroundColor: '#2563eb', color: 'white',
        border: 'none', borderRadius: '8px', cursor: 'pointer'
      }}
    >
      Reload page
    </button>
  </div>
);

const container = document.getElementById('root')
const app = (
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<SentryErrorFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>
)

// The build-time prerender step (scripts/prerender.mjs) ships fully-rendered
// static markup inside #root for /, /pricing, /about, /contact — every other
// route falls back to the empty shell.html. createRoot() on a non-empty
// container doesn't reconcile against existing DOM: it wipes it and mounts
// fresh, which is exactly the blank-flash-then-repaint every prerendered page
// showed on load. hydrateRoot() reconciles instead, so the prerendered paint
// stays on screen through the handoff.
if (container.hasChildNodes()) {
  hydrateRoot(container, app, {
    // React recovers from a hydration mismatch on its own (regenerates just
    // the mismatched subtree), so this is monitoring, not a crash handler —
    // it should stay quiet in normal use. Routed to Sentry instead of the
    // console so a real regression here surfaces without adding console noise.
    onRecoverableError: (error, errorInfo) => {
      Sentry.captureException(error, { extra: { componentStack: errorInfo?.componentStack } })
    },
  })
} else {
  createRoot(container).render(app)
}
