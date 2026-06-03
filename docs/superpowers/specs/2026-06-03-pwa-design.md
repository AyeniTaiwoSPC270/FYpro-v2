# FYPro PWA — Design Spec
**Date:** 2026-06-03
**Status:** Approved

---

## 1. Goal

Make FYPro installable as a Progressive Web App on Android (and iOS) with a polished
bottom-sheet install prompt and app-shell caching. The app loads instantly from cache
on repeat visits, degrades gracefully offline, and updates silently when a new version
is deployed.

Push notifications and full offline content caching are explicitly out of scope.

---

## 2. Approach

Use `vite-plugin-pwa` (wraps Workbox) to generate the service worker at build time.
This handles cache versioning, SW lifecycle, and update detection automatically — the
alternative (manual SW) introduces silent production bugs around stale caches and is
not worth the saved dependency.

---

## 3. Architecture

### 3.1 Files Changed

| File | Change |
|------|--------|
| `vite.config.js` | Add `VitePWA()` plugin with Workbox config |
| `public/manifest.json` | Fix icon sizes, add scope/orientation/lang fields |
| `src/App.jsx` | Mount `<PWAInstallPrompt />` once at root, outside router |

### 3.2 Files Added

| File | Purpose |
|------|---------|
| `src/components/PWAInstallPrompt.jsx` | Bottom-sheet install prompt component |
| `public/icons/icon-192.png` | 192×192 PNG — Android home screen icon |
| `public/icons/icon-512.png` | 512×512 PNG — splash screen + adaptive icon |
| `public/icons/icon-512-maskable.png` | 512×512 maskable PNG — Android adaptive icon |

### 3.3 Files Not Touched

- `api/` — zero serverless function changes
- `vercel.json` — no changes (Vercel serves SW files correctly by default)
- All step feature components — no changes
- `main.jsx` — SW registration is handled automatically by the plugin

---

## 4. Service Worker & Caching

### 4.1 Precache (build-time, automatic)

Workbox precaches all Vite build output at deploy time:
- JS and CSS bundles (versioned by content hash)
- `index.html` app shell
- All `public/` static assets (icons, manifest, images)
- Google Fonts stylesheet + font files (via runtime cache, see below)

Cache is automatically invalidated and refreshed on every new deploy.

### 4.2 Runtime Cache

| Pattern | Strategy | Reason |
|---------|----------|--------|
| `https://fonts.googleapis.com/*` | StaleWhileRevalidate | Fonts load instantly, refresh in background |
| `https://fonts.gstatic.com/*` | CacheFirst (30 days) | Font files are immutable |

### 4.3 Network-Only (never cached)

- `/api/*` — all Claude, Supabase, and Paystack calls bypass the SW entirely
- `wss://*` — Supabase realtime websockets are not intercepted

### 4.4 Offline Fallback

When offline, the SW serves the cached `index.html` for any navigation request.
React Router renders the correct route client-side. AI features show the existing
`ApiErrorBox` component — no custom offline UI is needed.

### 4.5 Update Strategy

- `skipWaiting: true` + `clientsClaim: true` — new SW activates immediately after deploy
- On SW update detected: show a "New version available — tap to reload" message using
  the existing `Toast.jsx` component
- The update check runs automatically on each page load in the background

---

## 5. PWAInstallPrompt Component

**File:** `src/components/PWAInstallPrompt.jsx`

### 5.1 Trigger Logic

1. Listen for `beforeinstallprompt` event (browser fires this when install criteria are met)
2. Store the deferred prompt object in a ref
3. Wait 30 seconds after the event fires before showing the sheet
4. Suppress entirely if:
   - `window.matchMedia('(display-mode: standalone)').matches` — already installed
   - `localStorage.getItem('fypro_pwa_prompt_dismissed')` is set

### 5.2 UI

- Slides up from the bottom: CSS `transform: translateY(100%)` → `translateY(0)`, `0.35s ease`
- Background: `var(--color-bg-dark)` (`#0D1B2A`) — matches the sidebar
- Content: FYPro shield icon + "Install FYPro" heading + "Add to your home screen for faster access" subtext
- **Install button:** blue primary (`var(--color-blue-primary)`)
- **Not now button:** ghost style (transparent + border)
- Overlay: semi-transparent backdrop behind the sheet

### 5.3 Actions

| Action | Result |
|--------|--------|
| Tap Install | Call `deferredPrompt.prompt()` → browser native dialog takes over → set dismissed flag |
| Tap Not now | Dismiss sheet → set `fypro_pwa_prompt_dismissed` in localStorage |
| Install accepted (browser) | Track `pwa_installed` PostHog event → set dismissed flag |
| Install declined (browser) | Track `pwa_prompt_dismissed` PostHog event → set dismissed flag (do not re-prompt) |

### 5.4 Analytics Events

Three new PostHog events (consistent with existing naming convention):

| Event | Fired when |
|-------|-----------|
| `pwa_prompt_shown` | Bottom sheet becomes visible |
| `pwa_installed` | User accepts the browser's install dialog |
| `pwa_prompt_dismissed` | User taps "Not now" or declines browser dialog |

---

## 6. Manifest Fixes

### 6.1 Icon Updates

Replace current incomplete icon list with:

```json
"icons": [
  { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
  { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" },
  { "src": "/icons/icon-512-maskable.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable" }
]
```

Icons are generated by resizing the existing `public/fypro-logo.png`. The maskable
version adds safe-zone padding (10% on all sides) so the logo isn't clipped by Android's
adaptive icon shape (squircle).

### 6.2 New Fields

```json
"scope": "/",
"start_url": "/?source=pwa",
"orientation": "portrait",
"display_override": ["standalone", "minimal-ui"],
"categories": ["education", "productivity"],
"lang": "en-NG"
```

`start_url` uses `?source=pwa` so PostHog can distinguish installs from regular browser
visits with zero additional code.

### 6.3 Apple Meta Tags (index.html)

Add to `<head>`:

```html
<meta name="apple-mobile-web-app-capable" content="yes" />
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
```

Update existing `apple-touch-icon` to point to `icon-192.png` (currently points to
`favicon-32x32.png` which is too small):

```html
<link rel="apple-touch-icon" sizes="192x192" href="/icons/icon-192.png" />
```

---

## 7. What This Does Not Include

- Push notifications — deferred to a future session
- Full offline content caching (step results, project data) — deferred
- iOS install prompt (iOS does not support `beforeinstallprompt`; the browser handles
  it natively via the Share sheet)
- Any changes to `api/` serverless functions
- Any changes to Supabase schema or RLS policies

---

## 8. Success Criteria

- App passes Chrome's PWA installability checklist (Lighthouse PWA audit: 100)
- "Add to Home Screen" prompt appears in Chrome on Android after 30 seconds
- App icon and name display correctly on Android home screen
- Repeat visits load the app shell instantly (< 100ms) even on slow connections
- Deploying a new version shows the update toast within one page reload
- `pwa_installed` PostHog event fires correctly on install
- No regressions on existing routes or features
