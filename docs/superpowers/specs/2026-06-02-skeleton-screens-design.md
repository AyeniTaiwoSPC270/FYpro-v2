# Skeleton Screens — Design Spec
**Date:** 2026-06-02  
**Status:** Approved  

---

## Problem

`App.jsx` wraps all lazy-loaded routes in a single `<Suspense fallback={<AppLoadingShell />}>`. `AppLoadingShell` renders a full-screen dark background with a 48×48 pulsing FYPro logo. Every page navigation shows this same generic screen regardless of where the user is going, making the app feel unpolished and jarring.

---

## Solution

Per-route `<Suspense>` boundaries in `App.jsx`, each wired to a skeleton that mirrors the real page layout. The skeletons use the shimmer animation already in `index.css` (`.skeleton-shimmer`, `--skeleton-base`, `--skeleton-shimmer` CSS vars) so dark/light mode works for free.

---

## Skeleton Variants

Four skeleton components, all exported from one new file:  
**`src/components/skeletons/PageSkeletons.jsx`**

### 1. `AuthPageSkeleton`
**Used for:** Login, Signup, ForgotPassword, ResetPassword, VerifyEmail, AuthConfirm

Layout:
- Full-screen dark background (`var(--bg-base)`)
- Centered column: shimmer logo block → tagline bar → card
- Card contains: title bar, subtitle bar, two input bars, button bar, link bar

### 2. `PublicPageSkeleton`
**Used for:** LandingPage, Pricing, About, Contact, Privacy, Terms, CookiePolicy, NotFound, ChangelogPage, RoadmapPage, MaintenancePage

Layout:
- Top navbar: logo shimmer left, three nav-link bars center, button bar right
- Hero section centered: badge pill, two headline bars, two subtitle bars, two CTA buttons
- Below hero: row of three feature card placeholders

### 3. `DashboardPageSkeleton`
**Used for:** Dashboard, Profile, Settings, MyCertificates, MyReferrals, EmailPreferences, SplashOnboarding, PaymentSuccess, AdminHealth

Layout:
- Left: narrow dark sidebar (`var(--bg-dark)`) with icon placeholders stacked vertically
- Right: content area with dot-background texture
  - Topbar row: title shimmer left, button shimmer right
  - Stat cards row: 3 equal shimmer blocks
  - Section label bar
  - Project cards grid: 2 shimmer blocks

### 4. `AppShellSkeleton`
**Used for:** AppShell (`/app`), SupervisorPrep

Layout:
- Left: narrow dark sidebar with icon placeholders + 6 step icon stubs
- Right: content area with dot-background texture
  - Step dots row (6 dots, first one blue, rest shimmer)
  - Step label bar
  - Large step card placeholder

---

## File Changes

### New file: `src/components/skeletons/PageSkeletons.jsx`
Exports: `AuthPageSkeleton`, `PublicPageSkeleton`, `DashboardPageSkeleton`, `AppShellSkeleton`

All four components:
- Use only `className="skeleton-shimmer"` and CSS variables for color — no hardcoded hex
- Are pure functional components, no props, no state, no hooks
- Render in under 1ms (static HTML + CSS only)

### Modified file: `src/App.jsx`
- Import all 4 skeleton components from `PageSkeletons.jsx`
- Remove `AppLoadingShell` function and its `FyproLogo` import (no longer needed)
- Wrap each `<Route element={…}>` with `<Suspense fallback={<SkeletonName />}>` per the table below
- Keep one outer `<Suspense fallback={null}>` around `<Routes>` as a final safety net

**Route → Skeleton mapping:**

| Route(s) | Skeleton |
|---|---|
| `/login`, `/signup`, `/forgot-password`, `/reset-password`, `/verify-email`, `/auth/confirm` | `AuthPageSkeleton` |
| `/`, `/pricing`, `/about`, `/contact`, `/privacy`, `/terms`, `/cookie-policy`, `/changelog`, `/roadmap`, `/maintenance`, `*` (404) | `PublicPageSkeleton` |
| `/dashboard`, `/start`, `/profile`, `/settings`, `/account/certificates`, `/account/referrals`, `/account/email-preferences`, `/payment-success`, `/admin/health` | `DashboardPageSkeleton` |
| `/app`, `/supervisor-prep` | `AppShellSkeleton` |

---

## What Is NOT Changed

- `ProtectedRoute` spinner (auth-check loading state) — left as-is
- `StepLoadingSkeleton` inside `AppShell.jsx` — handles lazy step switching, stays
- `DashboardSkeleton` inside `Dashboard.jsx` — handles data fetch loading, stays
- All existing CSS — no additions or modifications to `index.css`
- `vercel.json`, `api/`, any serverless functions

---

## Acceptance Criteria

1. Navigating to `/login` shows `AuthPageSkeleton` shimmer, not the pulsing logo
2. Navigating to `/` (landing page) shows `PublicPageSkeleton` shimmer
3. Navigating to `/dashboard` shows `DashboardPageSkeleton` shimmer
4. Navigating to `/app` shows `AppShellSkeleton` shimmer
5. All four skeletons work in both dark mode and light mode (shimmer colors flip via CSS vars)
6. No regressions: ProtectedRoute spinner, step switching skeleton, and dashboard data skeleton all still work
7. `AppLoadingShell` and its `FyproLogo` import are removed from `App.jsx`
