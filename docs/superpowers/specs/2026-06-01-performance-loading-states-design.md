# Performance & Loading States — Design Spec
**Date:** 2026-06-01
**Status:** Approved

---

## Problem

Users see empty states, blank flashes, and multiple spinners before content appears on every protected route. Three independent problems compound each other:

1. **Render-blocking fonts** — Google Fonts loaded via CSS `@import` delays the first paint.
2. **No code splitting** — all pages bundled into one JS file; browser parses all code before showing anything.
3. **Sequential loading waterfall** — auth → ban check → page data run as three sequential DB round trips.

---

## Goals

- No blank/white screen at any point during navigation
- Users see the app structure (skeleton) while data loads — never an empty page
- First meaningful paint faster on both initial load and route changes
- Zero changes to business logic, auth security, payment flows, or Supabase RLS

---

## Non-Goals

- Changing any API, prompt, or Supabase schema
- Adding any npm packages
- Modifying `vercel.json` or `api/` files
- Mobile-specific layouts

---

## Solution Overview

| Problem | Fix | Files |
|---|---|---|
| Render-blocking fonts | Move `@import` → `preconnect` + `<link>` in `index.html` with `font-display: swap` | `index.html`, `src/index.css` |
| No code splitting | Lazy-load all routes in `App.jsx`; lazy-load 6 step components in `AppShell.jsx` | `src/App.jsx`, `src/features/shell/AppShell.jsx` |
| Sequential waterfall | Cache ban check in `sessionStorage` (30-min TTL); show skeleton while data loads | `src/components/ProtectedRoute.jsx`, `src/pages/Dashboard.jsx`, `src/features/shell/AppShell.jsx`, `src/index.css` |

---

## Section 1: Google Fonts Fix

**Current:** `src/index.css` line 1 uses `@import url("https://fonts.googleapis.com/...")`. This is render-blocking — the browser must download and parse the CSS file, then make a second network request, before it can paint.

**Change:**
- Remove the `@import` line from `src/index.css`
- Add to `index.html` `<head>` (before existing meta tags):

```html
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap">
```

The `display=swap` query parameter causes Google Fonts to include `font-display: swap` in every `@font-face` it returns. Text renders immediately in the system fallback font and swaps to the custom font when loaded — no blocked paint, no invisible text.

---

## Section 2: Code Splitting

### Routes in `App.jsx`

All page imports converted from static to `lazy()`. Currently only `AdminHealth` is lazy — every other page is eagerly bundled.

```js
// Pattern applied to all pages
const Dashboard        = lazy(() => import('./pages/Dashboard'))
const LandingPage      = lazy(() => import('./pages/LandingPage'))
const Login            = lazy(() => import('./pages/Login'))
// ... all remaining page imports
```

Pages that keep static imports (because they are tiny utility components, not pages):
- `ProtectedRoute` — used as a wrapper, not a route component
- `RouteProgressBar`, `ToastProvider`, `CookieBanner` — persistent UI, not routes

A single `<Suspense>` wraps `<AppRoutes>` with an `<AppLoadingShell>` fallback (see below). This covers all lazy route chunks.

### Step components in `AppShell.jsx`

The 6 step feature components are eagerly imported today. They are large features — lazy-loading means only the current step's code downloads when first needed.

```js
const TopicValidator    = lazy(() => import('../topicValidator/TopicValidator'))
const ChapterArchitect  = lazy(() => import('../chapterArchitect/ChapterArchitect'))
const MethodologyAdvisor = lazy(() => import('../methodology/MethodologyAdvisor'))
const WritingPlanner    = lazy(() => import('../writingPlanner/WritingPlanner'))
const ProjectReviewer   = lazy(() => import('../projectReviewer/ProjectReviewer'))
const DefensePrep       = lazy(() => import('../defensePrep/DefensePrep'))
```

The step render area inside AppShell is wrapped in `<Suspense fallback={<StepLoadingSkeleton />}>`.

### `AppLoadingShell` component

A new small inline component in `App.jsx` (not a separate file):

```jsx
function AppLoadingShell() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base, #060E18)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      {/* FyproLogo is already static-imported — no flash */}
      <FyproLogo
        height={48}
        width={48}
        style={{ opacity: 0.6, animation: 'fypro-logo-pulse 1.4s ease-in-out infinite' }}
      />
    </div>
  )
}
```

`FyproLogo` is kept as a static import in `App.jsx` (it's tiny) so it's always available for the fallback without needing its own chunk.

The `fypro-logo-pulse` keyframe is added alongside the shimmer animation in `src/index.css`:

```css
@keyframes fypro-logo-pulse {
  0%, 100% { opacity: 0.6; }
  50%       { opacity: 1;   }
}
```

---

## Section 3: Ban Check Cache

**Current:** `ProtectedRoute` queries `user_entitlements.banned_until` from Supabase on every mount. Every navigation to a protected route triggers a DB round trip and shows a spinner.

**Change:** Check `sessionStorage` first before querying Supabase.

Cache key: `fypro_ban_${user.id}`
Cache value: `{ banned: boolean, ts: number }` (JSON)
TTL: 30 minutes

Logic:
1. On mount, if a cached entry exists and `Date.now() - ts < 30 * 60 * 1000`, use it — skip the DB call entirely.
2. If no cache or expired, run the Supabase query, store result in `sessionStorage`.
3. On `SIGNED_OUT` / user change, the cache key changes naturally (different `user.id`).

**Security:** The cache only affects the client-side redirect. The backend enforces bans on every API call regardless. A banned user with a stale cache can see the UI but all Claude/payment/project API calls will fail. This is acceptable — the real enforcement is server-side.

The `banChecking` state that currently shows a spinner is eliminated for cached results. For a first visit the spinner still shows briefly (one DB call), then never again for that session.

---

## Section 4: Skeleton Screens

### Shimmer animation (appended to `src/index.css`)

```css
/* ── Skeleton shimmer ───────────────────────────── */
@keyframes fypro-shimmer {
  0%   { background-position: -400px 0; }
  100% { background-position: 400px 0; }
}
.skeleton-shimmer {
  background: linear-gradient(
    90deg,
    rgba(255,255,255,0.04) 25%,
    rgba(255,255,255,0.09) 50%,
    rgba(255,255,255,0.04) 75%
  );
  background-size: 400px 100%;
  animation: fypro-shimmer 1.4s infinite;
  border-radius: 6px;
}
[data-theme="light"] .skeleton-shimmer {
  background: linear-gradient(
    90deg,
    rgba(0,0,0,0.06) 25%,
    rgba(0,0,0,0.12) 50%,
    rgba(0,0,0,0.06) 75%
  );
  background-size: 400px 100%;
}
```

### Dashboard skeleton

Shown while `projectsLoading === true`. Replaces the current blank/spinner state.

Layout mirrors the real dashboard:
- Top bar: logo placeholder (120×24px) + avatar placeholder (32×32px circle)
- Stats row: 3 card placeholders (same size as real stat cards)
- Projects section: heading placeholder + 2 project card placeholders

All skeleton elements use `className="skeleton-shimmer"`.

The sidebar remains visible during loading (it renders from cached state). Only the main content area shows the skeleton.

### AppShell step skeleton (`StepLoadingSkeleton`)

Shown while a lazy step component chunk is downloading. Inline in `AppShell.jsx`.

Layout:
- Step header placeholder (title bar height)
- Content card placeholder (matches card dimensions of the current step)

This only appears for ~200–400ms on first visit to a step. On subsequent visits the chunk is cached by the browser.

---

## Files Changed Summary

| File | Change |
|---|---|
| `index.html` | Add 3 `<link>` tags for fonts preconnect |
| `src/index.css` | Remove `@import` line; append shimmer keyframes, `fypro-logo-pulse`, and `.skeleton-shimmer` class |
| `src/App.jsx` | Convert all page imports to `lazy()`; add `AppLoadingShell`; wrap `AppRoutes` in `Suspense` |
| `src/features/shell/AppShell.jsx` | Convert 6 step imports to `lazy()`; wrap step render in `Suspense`; add `StepLoadingSkeleton` |
| `src/components/ProtectedRoute.jsx` | Add `sessionStorage` ban check cache (30-min TTL) |
| `src/pages/Dashboard.jsx` | Replace blank `projectsLoading` state with skeleton |

Total: 6 files. No new files created (skeletons are inline components).

---

## Risk Assessment

| Change | Risk | Mitigation |
|---|---|---|
| Lazy routes | Low — React Suspense is stable | Suspense fallback ensures no blank screen if chunk fails |
| Ban check cache | Low — backend still enforces | Cache only affects client redirect speed |
| Font preconnect | Zero — functionally identical | `font-display: swap` is the same behaviour the old import had |
| Skeletons | Zero — purely additive UI | Only shown when data is loading; no logic changed |
