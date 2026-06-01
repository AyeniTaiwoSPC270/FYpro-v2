# Performance & Loading States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Eliminate blank-screen flashes and sequential loading spinners so users always see either real content or a structural skeleton — never an empty page.

**Architecture:** Three independent changes applied in order: (1) move Google Fonts out of render-blocking CSS into non-blocking HTML link tags, (2) lazy-load all route and step components so the initial JS bundle is small, (3) cache the per-navigation ban check and replace loading spinners with skeleton screens that mirror the real layout.

**Tech Stack:** React 18 `lazy` + `Suspense`, `sessionStorage` for ban cache, inline skeleton components using a CSS shimmer animation, Tailwind utility classes already in the project.

---

## Task 1: Fix Google Fonts — move out of render-blocking CSS

**Files:**
- Modify: `index.html` (add `<link rel="stylesheet">` for fonts)
- Modify: `src/index.css` (remove `@import` line 1)

- [ ] **Step 1.1: Add the font stylesheet link to index.html**

  `index.html` currently has the two `preconnect` links but is **missing** the actual font stylesheet. Open `index.html` and add one line immediately after the two existing `preconnect` links (after line 24):

  ```html
  <!-- Font preconnect — eliminates DNS + TLS lag for Google Fonts -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <!-- Non-blocking font load — display=swap means text shows in fallback font immediately -->
  <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap">
  ```

  The full `<head>` opening should now look like this (up to the favicon lines):

  ```html
  <head>
    <meta charset="UTF-8" />
    <!-- Anti-flicker: set theme synchronously so no dark flash ever appears -->
    <script>
      (function() {
        try {
          var t = localStorage.getItem('fypro_theme') || 'dark';
          var d = document.documentElement;
          var isLight = t === 'light';
          d.setAttribute('data-theme', t);
          d.classList.add(isLight ? 'light' : 'dark');
          d.classList.remove(isLight ? 'dark' : 'light');
          var bg = isLight ? '#F8FAFC' : '#0A0F1C';
          d.style.setProperty('--bg-base', bg);
          d.style.background = bg;
        } catch(e) {}
      })();
    </script>
    <!-- Font preconnect — eliminates DNS + TLS lag for Google Fonts -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap">
    <link rel="icon" type="image/svg+xml" href="/shield-star.svg" />
  ```

- [ ] **Step 1.2: Remove the @import from src/index.css**

  `src/index.css` line 1 is:
  ```css
  @import url("https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=JetBrains+Mono:wght@400;500;600;700&family=Poppins:wght@400;500;600;700&family=Space+Mono:wght@400;700&display=swap");
  ```
  Delete that entire line. The file should now start with `@tailwind base;`.

- [ ] **Step 1.3: Verify fonts still load**

  Run `npm run dev`, open the app in the browser, open DevTools → Network tab, filter by "fonts.googleapis.com". You should see one request for the stylesheet and several font file requests. Text should render in Poppins/DM Serif Display as before. There should be NO `@import` request triggered from a CSS file.

- [ ] **Step 1.4: Commit**

  ```bash
  git add index.html src/index.css
  git commit -m "perf: move Google Fonts from CSS @import to non-blocking HTML link"
  ```

---

## Task 2: Add skeleton CSS to src/index.css

**Files:**
- Modify: `src/index.css` (append at the very bottom)

- [ ] **Step 2.1: Append skeleton shimmer CSS**

  Add the following block at the very bottom of `src/index.css`. Do not modify any existing CSS:

  ```css
  /* ── Skeleton shimmer ───────────────────────────────────────────────────── */
  @keyframes fypro-shimmer {
    0%   { background-position: -400px 0; }
    100% { background-position:  400px 0; }
  }

  @keyframes fypro-logo-pulse {
    0%, 100% { opacity: 0.6; }
    50%       { opacity: 1;   }
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

- [ ] **Step 2.2: Verify animation in browser**

  Run `npm run dev`. In the browser console run:
  ```js
  document.body.insertAdjacentHTML('beforeend', '<div class="skeleton-shimmer" style="width:200px;height:40px;position:fixed;top:16px;left:16px;z-index:9999"></div>')
  ```
  You should see a shimmering grey bar. Remove it after confirming. Also confirm the `[data-theme="light"]` variant works by toggling theme in the app.

- [ ] **Step 2.3: Commit**

  ```bash
  git add src/index.css
  git commit -m "perf: add skeleton shimmer and logo-pulse CSS animations"
  ```

---

## Task 3: Lazy-load all routes in App.jsx + add AppLoadingShell

**Files:**
- Modify: `src/App.jsx`

The goal is to convert every page/feature import to `lazy()`, add a `FyproLogo` static import (for the fallback), define `AppLoadingShell`, and wrap `<AppRoutes />` in a `<Suspense>`.

- [ ] **Step 3.1: Replace App.jsx with the lazy-loaded version**

  Open `src/App.jsx`. Replace the entire file with the following:

  ```jsx
  import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
  import { lazy, Suspense } from 'react'
  import { AppProvider } from './context/AppContext'
  import { ThemeProvider } from './context/ThemeContext'
  import { ToastProvider } from './components/Toast'
  import { ProjectStateProvider } from './hooks/useProjectState'
  import { AuthProvider } from './context/AuthContext'
  import ProtectedRoute from './components/ProtectedRoute'
  import RouteProgressBar from './components/RouteProgressBar'
  import CookieBanner from './components/CookieBanner'
  import FyproLogo from './components/FyproLogo'

  // ── Lazy page/feature imports ────────────────────────────────────────────
  // Every route component is lazy so the initial bundle stays small.
  // Non-route persistent UI (ProtectedRoute, RouteProgressBar, CookieBanner,
  // context providers, FyproLogo) stays static — they must always be available.
  const LandingPage       = lazy(() => import('./pages/LandingPage'))
  const Pricing           = lazy(() => import('./pages/Pricing'))
  const About             = lazy(() => import('./pages/About'))
  const Contact           = lazy(() => import('./pages/Contact'))
  const Privacy           = lazy(() => import('./pages/Privacy'))
  const Terms             = lazy(() => import('./pages/Terms'))
  const CookiePolicy      = lazy(() => import('./pages/CookiePolicy'))
  const Login             = lazy(() => import('./pages/Login'))
  const Signup            = lazy(() => import('./pages/Signup'))
  const ForgotPassword    = lazy(() => import('./pages/ForgotPassword'))
  const ResetPassword     = lazy(() => import('./pages/ResetPassword'))
  const VerifyEmail       = lazy(() => import('./pages/VerifyEmail'))
  const PaymentSuccess    = lazy(() => import('./pages/PaymentSuccess'))
  const MaintenancePage   = lazy(() => import('./pages/MaintenancePage'))
  const AuthConfirm       = lazy(() => import('./pages/auth/AuthConfirm'))
  const ChangelogPage     = lazy(() => import('./pages/changelog/ChangelogPage'))
  const RoadmapPage       = lazy(() => import('./pages/roadmap/RoadmapPage'))
  const NotFound          = lazy(() => import('./pages/NotFound'))
  const SplashOnboarding  = lazy(() => import('./pages/SplashOnboarding'))
  const Dashboard         = lazy(() => import('./pages/Dashboard'))
  const Profile           = lazy(() => import('./pages/Profile'))
  const Settings          = lazy(() => import('./pages/Settings'))
  const EmailPreferences  = lazy(() => import('./pages/account/EmailPreferences'))
  const MyCertificates    = lazy(() => import('./pages/account/MyCertificates'))
  const MyReferrals       = lazy(() => import('./pages/account/MyReferrals'))
  const AppShell          = lazy(() => import('./features/shell/AppShell'))
  const SupervisorPrep    = lazy(() => import('./features/supervisorPrep/SupervisorPrep'))
  const AdminHealth       = lazy(() => import('./pages/admin/Health'))

  // ── Full-screen fallback shown while any lazy route chunk downloads ──────
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

        {/* Admin — recharts only downloads when admin visits */}
        <Route path="/admin/health" element={<ProtectedRoute adminOnly><AdminHealth /></ProtectedRoute>} />

        {/* 404 catch-all */}
        <Route path="*" element={<NotFound />} />
      </Routes>
    )
  }

  export default function App() {
    return (
      <AuthProvider>
        <ThemeProvider>
          <AppProvider>
            <BrowserRouter>
              <ProjectStateProvider>
                <RouteProgressBar />
                <ToastProvider />
                <CookieBanner />
                <Suspense fallback={<AppLoadingShell />}>
                  <AppRoutes />
                </Suspense>
              </ProjectStateProvider>
            </BrowserRouter>
          </AppProvider>
        </ThemeProvider>
      </AuthProvider>
    )
  }
  ```

- [ ] **Step 3.2: Verify the app still works**

  Run `npm run dev`. Navigate to `/`, `/login`, `/dashboard` (if logged in), and `/app`. Each route should load without errors. In DevTools → Network, you should see separate JS chunks loading per route (e.g. `Dashboard-[hash].js`, `Login-[hash].js`). The `AppLoadingShell` (logo pulse) should appear briefly during chunk download on first visit.

- [ ] **Step 3.3: Commit**

  ```bash
  git add src/App.jsx
  git commit -m "perf: lazy-load all route components and add AppLoadingShell fallback"
  ```

---

## Task 4: Lazy-load step components in AppShell + add StepLoadingSkeleton

**Files:**
- Modify: `src/features/shell/AppShell.jsx`

- [ ] **Step 4.1: Replace the eager step imports with lazy imports**

  In `src/features/shell/AppShell.jsx`, find the block of step and supervisor email imports at the top (lines 11–17):

  ```js
  import TopicValidator from '../topicValidator/TopicValidator'
  import ChapterArchitect from '../chapterArchitect/ChapterArchitect'
  import MethodologyAdvisor from '../methodology/MethodologyAdvisor'
  import WritingPlanner from '../writingPlanner/WritingPlanner'
  import ProjectReviewer from '../projectReviewer/ProjectReviewer'
  import DefensePrep from '../defensePrep/DefensePrep'
  import SupervisorEmail from '../supervisorEmail/SupervisorEmail'
  ```

  Replace them with lazy imports. Also add `lazy` and `Suspense` to the React import at line 1:

  ```js
  import { useEffect, useState, Fragment, useRef, lazy, Suspense } from 'react'
  ```

  Replace the 7 import lines with:

  ```js
  const TopicValidator     = lazy(() => import('../topicValidator/TopicValidator'))
  const ChapterArchitect   = lazy(() => import('../chapterArchitect/ChapterArchitect'))
  const MethodologyAdvisor = lazy(() => import('../methodology/MethodologyAdvisor'))
  const WritingPlanner     = lazy(() => import('../writingPlanner/WritingPlanner'))
  const ProjectReviewer    = lazy(() => import('../projectReviewer/ProjectReviewer'))
  const DefensePrep        = lazy(() => import('../defensePrep/DefensePrep'))
  const SupervisorEmail    = lazy(() => import('../supervisorEmail/SupervisorEmail'))
  ```

- [ ] **Step 4.2: Add the StepLoadingSkeleton component**

  Add this component definition immediately before the `export default function AppShell()` line (around line 104):

  ```jsx
  function StepLoadingSkeleton() {
    return (
      <div style={{ width: '100%', maxWidth: 660, margin: '0 auto', padding: '32px 16px' }}>
        <div className="skeleton-shimmer" style={{ height: 32, width: '55%', marginBottom: 20 }} />
        <div className="skeleton-shimmer" style={{ height: 320, width: '100%', borderRadius: 16 }} />
      </div>
    )
  }
  ```

- [ ] **Step 4.3: Wrap the step render area in Suspense**

  Find this block inside `AppShell` (around line 372):

  ```jsx
  {/* Current step or bonus feature */}
  <div className="app-content__scroll" ref={scrollRef}>
    <AnimatePresence mode="wait" custom={directionRef.current}>
  ```

  Wrap the `<AnimatePresence>` block in a `<Suspense>`:

  ```jsx
  {/* Current step or bonus feature */}
  <div className="app-content__scroll" ref={scrollRef}>
    <Suspense fallback={<StepLoadingSkeleton />}>
      <AnimatePresence mode="wait" custom={directionRef.current}>
  ```

  And close it before the `</div>` that closes `app-content__scroll`:

  ```jsx
          </AnimatePresence>
        </Suspense>
      </div>
  ```

  The full updated block should look like:

  ```jsx
  {/* Current step or bonus feature */}
  <div className="app-content__scroll" ref={scrollRef}>
    <Suspense fallback={<StepLoadingSkeleton />}>
      <AnimatePresence mode="wait" custom={directionRef.current}>
        <motion.div
          key={showSupervisorEmail ? 'supervisor' : String(state.currentStep)}
          custom={directionRef.current}
          variants={stepVariants}
          initial="enter"
          animate="center"
          exit="exit"
          transition={{ duration: 0.2, ease: 'easeOut' }}
        >
          {showSupervisorEmail ? (
            <SupervisorEmail onClose={() => setShowSupervisorEmail(false)} />
          ) : state.currentStep === 4 ? (
            <PaidFeatureGate requiredPack="student_pack">
              <CurrentStep />
            </PaidFeatureGate>
          ) : state.currentStep === 5 ? (
            <PaidFeatureGate requiredPack="defense_pack">
              <CurrentStep />
            </PaidFeatureGate>
          ) : (
            <>
              {currentStepKey && isOverLimit(currentStepKey) && (
                <RunLimitBanner stepKey={currentStepKey} onUpgrade={() => navigate('/pricing')} />
              )}
              <CurrentStep />
            </>
          )}
        </motion.div>
      </AnimatePresence>
    </Suspense>
  </div>
  ```

- [ ] **Step 4.4: Verify step lazy loading**

  Run `npm run dev` and navigate to `/app`. In DevTools → Network, you should see that on first load only the current step's chunk downloads. Navigate to Step 2 — a new chunk should appear. The `StepLoadingSkeleton` (two shimmer bars) should flash briefly on first visit to each step.

- [ ] **Step 4.5: Commit**

  ```bash
  git add src/features/shell/AppShell.jsx
  git commit -m "perf: lazy-load step components and add StepLoadingSkeleton"
  ```

---

## Task 5: Cache ban check in ProtectedRoute

**Files:**
- Modify: `src/components/ProtectedRoute.jsx`

- [ ] **Step 5.1: Replace ProtectedRoute.jsx with the cached version**

  Replace the entire contents of `src/components/ProtectedRoute.jsx` with:

  ```jsx
  import { Navigate } from 'react-router-dom'
  import { useUser } from '../hooks/useUser'
  import { useState, useEffect } from 'react'
  import { supabase } from '../lib/supabase'
  import WhatsAppButton from './WhatsAppButton'

  const BAN_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

  function readBanCache(userId) {
    try {
      const raw = sessionStorage.getItem(`fypro_ban_${userId}`)
      if (!raw) return null
      const { banned, ts } = JSON.parse(raw)
      if (Date.now() - ts < BAN_CACHE_TTL) return banned
      return null // expired
    } catch {
      return null
    }
  }

  function writeBanCache(userId, banned) {
    try {
      sessionStorage.setItem(`fypro_ban_${userId}`, JSON.stringify({ banned, ts: Date.now() }))
    } catch {}
  }

  // SQL required (run once in Supabase SQL Editor):
  //   ALTER TABLE user_entitlements
  //   ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ DEFAULT NULL;
  export default function ProtectedRoute({ children, adminOnly = false }) {
    const { user, loading } = useUser()
    const [banned, setBanned] = useState(false)
    // Start checking only if there is no valid cache for the current user.
    // Lazy initializer: user from useUser() is available in the same render.
    const [banChecking, setBanChecking] = useState(() => {
      if (!user?.id) return false
      return readBanCache(user.id) === null
    })

    useEffect(() => {
      if (!user?.id) {
        setBanChecking(false)
        return
      }

      const cached = readBanCache(user.id)
      if (cached !== null) {
        // Cache hit — no DB call, no spinner
        if (cached) { supabase.auth.signOut(); setBanned(true) }
        setBanChecking(false)
        return
      }

      // Cache miss — run the query and store the result
      setBanChecking(true)
      supabase
        .from('user_entitlements')
        .select('banned_until')
        .eq('user_id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          const isBanned = !!(data?.banned_until && new Date(data.banned_until) > new Date())
          writeBanCache(user.id, isBanned)
          if (isBanned) { supabase.auth.signOut(); setBanned(true) }
        })
        .catch(() => {})
        .finally(() => setBanChecking(false))
    }, [user?.id])

    // Show spinner while auth resolves or (first-visit) ban check is in flight.
    if (loading || (banChecking && !!user?.id)) return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base, #060E18)',
      }}>
        <div style={{
          width: 36,
          height: 36,
          border: '3px solid rgba(0,102,255,0.15)',
          borderTopColor: '#0066FF',
          borderRadius: '50%',
          animation: 'pr-spin 0.7s linear infinite',
        }} />
        <style>{`@keyframes pr-spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )

    if (!user) return <Navigate to="/login" replace />

    if (adminOnly && user.email !== import.meta.env.VITE_ADMIN_EMAIL) {
      return <Navigate to="/dashboard" replace />
    }

    if (banned) {
      return (
        <div style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-base, #060E18)',
          fontFamily: "'Poppins', sans-serif",
          textAlign: 'center',
          padding: '32px',
        }}>
          <div>
            <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: 8 }}>
              Account Suspended
            </p>
            <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.88rem' }}>
              Your account has been suspended. Contact support.
            </p>
          </div>
        </div>
      )
    }

    return (
      <>
        {children}
        <WhatsAppButton />
      </>
    )
  }
  ```

- [ ] **Step 5.2: Verify the cache works**

  Run `npm run dev`. Log in and navigate to `/dashboard`. Open DevTools → Application → Session Storage. You should see a key `fypro_ban_<your-user-id>` with a JSON value like `{"banned":false,"ts":1234567890}`. Navigate to `/app` and back — no new Supabase request for `user_entitlements` should appear in the Network tab (the cache is reused).

- [ ] **Step 5.3: Commit**

  ```bash
  git add src/components/ProtectedRoute.jsx
  git commit -m "perf: cache ban check in sessionStorage to eliminate per-navigation DB call"
  ```

---

## Task 6: Replace Dashboard loading spinner with skeleton

**Files:**
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 6.1: Add the DashboardSkeleton component**

  Open `src/pages/Dashboard.jsx`. Add this component definition immediately above `export default function Dashboard()` (just before line 30):

  ```jsx
  function DashboardSkeleton() {
    return (
      <div style={{ padding: '4px 0 48px' }}>
        {/* Stat cards row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 96, borderRadius: 12 }} />
          ))}
        </div>
        {/* Section heading placeholder */}
        <div className="skeleton-shimmer" style={{ height: 22, width: 160, marginBottom: 16, borderRadius: 6 }} />
        {/* Project cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
          {[0, 1].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 140, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    )
  }
  ```

- [ ] **Step 6.2: Replace the spinner with the skeleton**

  In `src/pages/Dashboard.jsx`, find the `projectsLoading` conditional in the `<main>` block (around line 242):

  ```jsx
  {projectsLoading ? (
    <div className="flex items-center justify-center" style={{ minHeight: 'calc(100vh - 120px)' }}>
      <div style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: '#0066FF', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  ) : projectsError ? (
  ```

  Replace the loading branch only (keep `projectsError` and everything after it unchanged):

  ```jsx
  {projectsLoading ? (
    <DashboardSkeleton />
  ) : projectsError ? (
  ```

- [ ] **Step 6.3: Verify the skeleton renders**

  Run `npm run dev`. Log in and navigate to `/dashboard`. The skeleton (3 shimmer stat cards + 2 project card placeholders) should appear briefly before the real projects load. Open DevTools → Network, throttle to "Slow 3G" under the Network tab, then reload `/dashboard` — the skeleton should be clearly visible for a few seconds.

  Remove the throttle after testing.

- [ ] **Step 6.4: Commit**

  ```bash
  git add src/pages/Dashboard.jsx
  git commit -m "perf: replace dashboard loading spinner with skeleton screen"
  ```

---

## Task 7: Smoke test all routes

- [ ] **Step 7.1: Test the full happy path**

  With `npm run dev` running:

  1. Open the app at `http://localhost:5173` — landing page loads without blank flash
  2. Navigate to `/login` — login form appears without blank flash
  3. Log in — redirects to `/dashboard`, skeleton appears then projects load
  4. Click "Continue" on a project — `/app` loads, step 1 skeleton appears then TopicValidator loads
  5. Navigate through steps 1–3 via the sidebar — each step's chunk loads, skeleton appears briefly on first visit
  6. Navigate to `/pricing`, `/about`, `/changelog` — all load correctly
  7. Open DevTools → Application → Session Storage — confirm `fypro_ban_<id>` key exists
  8. Navigate away from `/dashboard` and back — no new `user_entitlements` request in Network tab

- [ ] **Step 7.2: Test in light mode**

  Toggle light mode in the app settings. Verify the skeleton shimmer uses the dark-on-light variant (subtle dark overlay instead of light-on-dark). The `[data-theme="light"] .skeleton-shimmer` rule covers this.

- [ ] **Step 7.3: Final commit**

  ```bash
  git add .
  git commit -m "perf: smoke test complete — all routes loading correctly with skeletons"
  ```
