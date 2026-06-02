# Skeleton Screens Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the generic pulsing-logo loading screen with per-route skeleton screens that mirror each page's real layout.

**Architecture:** Create one new file (`src/components/skeletons/PageSkeletons.jsx`) exporting 4 pure skeleton components. Update `App.jsx` to wrap each lazy route element in its own `<Suspense>` with the matching skeleton. The outer `<Suspense>` in `App.jsx` becomes a null-fallback safety net.

**Tech Stack:** React (Suspense, lazy), existing `.skeleton-shimmer` CSS class and `--skeleton-base` / `--skeleton-shimmer` / `--bg-base` / `--dot-bg-image` CSS variables already defined in `index.css`.

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Create | `src/components/skeletons/PageSkeletons.jsx` | All 4 skeleton components |
| Modify | `src/App.jsx` | Per-route Suspense wiring, remove `AppLoadingShell` |

---

## Task 1: Create `PageSkeletons.jsx` with all 4 skeleton components

**Files:**
- Create: `src/components/skeletons/PageSkeletons.jsx`

- [ ] **Step 1: Create the file with all 4 components**

Create `src/components/skeletons/PageSkeletons.jsx` with exactly this content:

```jsx
// Pure shimmer skeletons — one per page-layout group.
// All use .skeleton-shimmer (defined in index.css) so dark/light mode works via CSS vars.
// No props, no state, no hooks — these are static layout placeholders only.

export function AuthPageSkeleton() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      gap: '12px',
    }}>
      <div className="skeleton-shimmer" style={{ width: 48, height: 48, borderRadius: '50%' }} />
      <div className="skeleton-shimmer" style={{ width: 120, height: 12, borderRadius: 6 }} />
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--bg-card, #0D1425)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderRadius: 16,
        padding: '32px 28px',
        marginTop: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div className="skeleton-shimmer" style={{ width: '55%', height: 22, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: '80%', height: 12, borderRadius: 6 }} />
        <div style={{ height: 8 }} />
        <div className="skeleton-shimmer" style={{ width: '100%', height: 44, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: '100%', height: 44, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: '100%', height: 44, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 140, height: 12, borderRadius: 6, alignSelf: 'center' }} />
      </div>
    </div>
  )
}

export function PublicPageSkeleton() {
  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        borderBottom: '1px solid rgba(255,255,255,0.07)',
      }}>
        <div className="skeleton-shimmer" style={{ width: 80, height: 18, borderRadius: 6 }} />
        <div style={{ display: 'flex', gap: 24 }}>
          <div className="skeleton-shimmer" style={{ width: 44, height: 12, borderRadius: 6 }} />
          <div className="skeleton-shimmer" style={{ width: 44, height: 12, borderRadius: 6 }} />
          <div className="skeleton-shimmer" style={{ width: 44, height: 12, borderRadius: 6 }} />
        </div>
        <div className="skeleton-shimmer" style={{ width: 80, height: 36, borderRadius: 8 }} />
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '80px 24px 48px',
        gap: 16,
      }}>
        <div className="skeleton-shimmer" style={{ width: 120, height: 16, borderRadius: 99 }} />
        <div className="skeleton-shimmer" style={{ width: 'min(55%, 480px)', height: 40, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 'min(40%, 360px)', height: 40, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 'min(45%, 400px)', height: 14, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: 'min(35%, 320px)', height: 14, borderRadius: 6 }} />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <div className="skeleton-shimmer" style={{ width: 140, height: 48, borderRadius: 10 }} />
          <div className="skeleton-shimmer" style={{ width: 120, height: 48, borderRadius: 10 }} />
        </div>
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: 20,
        padding: '0 40px 48px',
        maxWidth: 960,
        margin: '0 auto',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ height: 100, borderRadius: 14 }} />
        ))}
      </div>
    </div>
  )
}

export function DashboardPageSkeleton() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <div style={{
        width: 220,
        background: 'linear-gradient(180deg, #0D1B2A 0%, #091420 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        flexShrink: 0,
      }}>
        <div className="skeleton-shimmer" style={{ width: '70%', height: 20, borderRadius: 8, marginBottom: 16 }} />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ width: '100%', height: 36, borderRadius: 8 }} />
        ))}
      </div>
      <div style={{
        flex: 1,
        backgroundImage: 'var(--dot-bg-image)',
        backgroundSize: '28px 28px',
        padding: '28px 32px',
        display: 'flex',
        flexDirection: 'column',
        gap: 20,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="skeleton-shimmer" style={{ width: 160, height: 22, borderRadius: 6 }} />
          <div className="skeleton-shimmer" style={{ width: 100, height: 36, borderRadius: 8 }} />
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 96, borderRadius: 12 }} />
          ))}
        </div>
        <div className="skeleton-shimmer" style={{ width: 140, height: 16, borderRadius: 6 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[0, 1].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 140, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function AppShellSkeleton() {
  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <div style={{
        width: 220,
        background: 'linear-gradient(180deg, #0D1B2A 0%, #091420 100%)',
        borderRight: '1px solid rgba(255,255,255,0.06)',
        padding: '20px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        flexShrink: 0,
      }}>
        <div className="skeleton-shimmer" style={{ width: '70%', height: 20, borderRadius: 8, marginBottom: 16 }} />
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ width: '100%', height: 36, borderRadius: 8 }} />
        ))}
      </div>
      <div style={{
        flex: 1,
        backgroundImage: 'var(--dot-bg-image)',
        backgroundSize: '28px 28px',
        padding: '28px 32px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
      }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? '#0066FF' : undefined }}
              className={i === 0 ? undefined : 'skeleton-shimmer'}
            />
          ))}
        </div>
        <div className="skeleton-shimmer" style={{ width: 180, height: 16, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: '100%', maxWidth: 660, height: 360, borderRadius: 16 }} />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify the file was created**

```bash
ls src/components/skeletons/
```

Expected output: `PageSkeletons.jsx`

- [ ] **Step 3: Commit**

```bash
git add src/components/skeletons/PageSkeletons.jsx
git commit -m "feat: add per-route page skeleton components"
```

---

## Task 2: Wire skeletons into `App.jsx`

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Replace the import block at the top of `App.jsx`**

Find this block (lines 1–11):

```jsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import { ProjectStateProvider } from './hooks/useProjectState'
import ProtectedRoute from './components/ProtectedRoute'
import RouteProgressBar from './components/RouteProgressBar'
import CookieBanner from './components/CookieBanner'
import FyproLogo from './components/FyproLogo'
```

Replace with:

```jsx
import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import { ProjectStateProvider } from './hooks/useProjectState'
import ProtectedRoute from './components/ProtectedRoute'
import RouteProgressBar from './components/RouteProgressBar'
import CookieBanner from './components/CookieBanner'
import {
  AuthPageSkeleton,
  PublicPageSkeleton,
  DashboardPageSkeleton,
  AppShellSkeleton,
} from './components/skeletons/PageSkeletons'
```

- [ ] **Step 2: Remove `AppLoadingShell`**

Find and delete this entire block (lines 43–60):

```jsx
// Fullscreen branded loading shell — shown while any lazy route chunk loads.
function AppLoadingShell() {
  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base, #060E18)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <FyproLogo
        height={48}
        width={48}
        style={{ animation: 'fypro-logo-pulse 1.4s ease-in-out infinite' }}
      />
    </div>
  )
}
```

- [ ] **Step 3: Replace the `AppRoutes` function with the per-route Suspense version**

Find the entire `AppRoutes` function (starts at `function AppRoutes()`, ends at the closing `}`):

```jsx
function AppRoutes() {
  const location = useLocation()
  return (
    <Routes location={location}>
          {/* Public marketing */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/about" element={<About />} />
          <Route path="/contact" element={<Contact />} />
          <Route path="/privacy" element={<Privacy />} />
          <Route path="/terms" element={<Terms />} />
          <Route path="/cookie-policy" element={<CookiePolicy />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/payment-success" element={<PaymentSuccess />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
          <Route path="/auth/confirm" element={<AuthConfirm />} />
          <Route path="/auth/callback" element={<AuthConfirm />} />
          <Route path="/changelog" element={<ChangelogPage />} />
          <Route path="/roadmap" element={<RoadmapPage />} />

          {/* App entry — splash + onboarding */}
          <Route path="/start" element={<ProtectedRoute><SplashOnboarding /></ProtectedRoute>} />

          {/* Main app */}
          <Route path="/app" element={<ProtectedRoute><AppShell /></ProtectedRoute>} />

          {/* Supervisor Meeting Prep */}
          <Route path="/supervisor-prep" element={<ProtectedRoute><SupervisorPrep /></ProtectedRoute>} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

          {/* Profile */}
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />

          {/* Settings */}
          <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />

          {/* Email Preferences */}
          <Route path="/account/email-preferences" element={<ProtectedRoute><EmailPreferences /></ProtectedRoute>} />

          {/* My Certificates */}
          <Route path="/account/certificates" element={<ProtectedRoute><MyCertificates /></ProtectedRoute>} />

          {/* My Referrals */}
          <Route path="/account/referrals" element={<ProtectedRoute><MyReferrals /></ProtectedRoute>} />

          {/* Admin — lazy-loaded so recharts only downloads when admin visits */}
          <Route path="/admin/health" element={<ProtectedRoute adminOnly><AdminHealth /></ProtectedRoute>} />

          {/* 404 catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
  )
}
```

Replace with:

```jsx
function S({ fallback, children }) {
  return <Suspense fallback={fallback}>{children}</Suspense>
}

function AppRoutes() {
  const location = useLocation()
  return (
    <Routes location={location}>
      {/* Auth pages */}
      <Route path="/login"           element={<S fallback={<AuthPageSkeleton />}><Login /></S>} />
      <Route path="/signup"          element={<S fallback={<AuthPageSkeleton />}><Signup /></S>} />
      <Route path="/forgot-password" element={<S fallback={<AuthPageSkeleton />}><ForgotPassword /></S>} />
      <Route path="/reset-password"  element={<S fallback={<AuthPageSkeleton />}><ResetPassword /></S>} />
      <Route path="/verify-email"    element={<S fallback={<AuthPageSkeleton />}><VerifyEmail /></S>} />
      <Route path="/auth/confirm"    element={<S fallback={<AuthPageSkeleton />}><AuthConfirm /></S>} />
      <Route path="/auth/callback"   element={<S fallback={<AuthPageSkeleton />}><AuthConfirm /></S>} />

      {/* Public pages */}
      <Route path="/"            element={<S fallback={<PublicPageSkeleton />}><LandingPage /></S>} />
      <Route path="/pricing"     element={<S fallback={<PublicPageSkeleton />}><Pricing /></S>} />
      <Route path="/about"       element={<S fallback={<PublicPageSkeleton />}><About /></S>} />
      <Route path="/contact"     element={<S fallback={<PublicPageSkeleton />}><Contact /></S>} />
      <Route path="/privacy"     element={<S fallback={<PublicPageSkeleton />}><Privacy /></S>} />
      <Route path="/terms"       element={<S fallback={<PublicPageSkeleton />}><Terms /></S>} />
      <Route path="/cookie-policy" element={<S fallback={<PublicPageSkeleton />}><CookiePolicy /></S>} />
      <Route path="/maintenance" element={<S fallback={<PublicPageSkeleton />}><MaintenancePage /></S>} />
      <Route path="/changelog"   element={<S fallback={<PublicPageSkeleton />}><ChangelogPage /></S>} />
      <Route path="/roadmap"     element={<S fallback={<PublicPageSkeleton />}><RoadmapPage /></S>} />

      {/* Dashboard + account pages */}
      <Route path="/dashboard" element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><Dashboard /></S></ProtectedRoute>} />
      <Route path="/start"     element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><SplashOnboarding /></S></ProtectedRoute>} />
      <Route path="/profile"   element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><Profile /></S></ProtectedRoute>} />
      <Route path="/settings"  element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><Settings /></S></ProtectedRoute>} />
      <Route path="/account/email-preferences" element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><EmailPreferences /></S></ProtectedRoute>} />
      <Route path="/account/certificates"      element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><MyCertificates /></S></ProtectedRoute>} />
      <Route path="/account/referrals"         element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><MyReferrals /></S></ProtectedRoute>} />
      <Route path="/payment-success"           element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><PaymentSuccess /></S></ProtectedRoute>} />
      <Route path="/admin/health"              element={<ProtectedRoute adminOnly><S fallback={<DashboardPageSkeleton />}><AdminHealth /></S></ProtectedRoute>} />

      {/* App shell + supervisor */}
      <Route path="/app"             element={<ProtectedRoute><S fallback={<AppShellSkeleton />}><AppShell /></S></ProtectedRoute>} />
      <Route path="/supervisor-prep" element={<ProtectedRoute><S fallback={<AppShellSkeleton />}><SupervisorPrep /></S></ProtectedRoute>} />

      {/* 404 */}
      <Route path="*" element={<S fallback={<PublicPageSkeleton />}><NotFound /></S>} />
    </Routes>
  )
}
```

- [ ] **Step 4: Update the outer `<Suspense>` in `App()` to use a null fallback**

Find in the `App()` function:

```jsx
        <Suspense fallback={<AppLoadingShell />}>
          <AppRoutes />
        </Suspense>
```

Replace with:

```jsx
        <Suspense fallback={null}>
          <AppRoutes />
        </Suspense>
```

- [ ] **Step 5: Verify the app builds with no errors**

```bash
npm run build
```

Expected: build completes with no errors. Warnings about chunk size are fine.

- [ ] **Step 6: Start dev server and manually verify each skeleton group**

```bash
npm run dev
```

Open http://localhost:5173 (or whatever port Vite uses).

Check these 4 navigations — each should show a shimmer skeleton, not the pulsing logo:
1. Hard-refresh on `/login` → should show `AuthPageSkeleton` (logo circle + card with input bars)
2. Hard-refresh on `/` → should show `PublicPageSkeleton` (navbar + hero blocks)
3. Hard-refresh on `/dashboard` → should show `DashboardPageSkeleton` (dark sidebar + stat cards) — ProtectedRoute spinner appears first (that's expected), then the skeleton, then the real page
4. Hard-refresh on `/app` → should show `AppShellSkeleton` (dark sidebar + step dots + big card)

Also verify: navigating between steps inside `/app` still shows the existing `StepLoadingSkeleton` (not the full page skeleton).

- [ ] **Step 7: Check light mode**

Toggle to light mode and repeat the 4 hard-refreshes above. Shimmer should use lighter colors (`--skeleton-base: #E2E8F0`, `--skeleton-shimmer: #CBD5E1`).

- [ ] **Step 8: Commit**

```bash
git add src/App.jsx
git commit -m "feat: wire per-route skeleton screens, remove AppLoadingShell"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task covering it |
|---|---|
| `AuthPageSkeleton` for auth routes | Task 1 (create), Task 2 Step 3 |
| `PublicPageSkeleton` for public routes | Task 1 (create), Task 2 Step 3 |
| `DashboardPageSkeleton` for dashboard/account routes | Task 1 (create), Task 2 Step 3 |
| `AppShellSkeleton` for /app and /supervisor-prep | Task 1 (create), Task 2 Step 3 |
| Remove `AppLoadingShell` and `FyproLogo` import | Task 2 Steps 1–2 |
| Outer Suspense becomes null fallback | Task 2 Step 4 |
| No changes to ProtectedRoute, StepLoadingSkeleton, DashboardSkeleton | Not touched anywhere |
| Dark + light mode both work | Task 2 Step 7 |

**Placeholder scan:** No TBDs, no "implement later", all code blocks complete.

**Type consistency:** `S` helper defined once (Task 2 Step 3), used consistently throughout. All 4 skeleton names match exactly between Task 1 exports and Task 2 imports.
