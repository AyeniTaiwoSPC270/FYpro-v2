import { lazy, Suspense, useEffect } from 'react'
import { tryChunkReload } from './lib/chunkReload'

// iOS Safari resolves dynamic imports with undefined (instead of rejecting) when a module
// script fails silently through a service worker mid-transition. The existing vite:preloadError
// handler in main.jsx covers Chrome-style rejections; this covers the Safari undefined case.
// tryChunkReload() reloads once (shared, attempt-limited budget); if it gives up we surface the
// error so the boundary's fallback shows instead of looping or rendering a silent blank.
function safeLazy(factory) {
  return lazy(() =>
    factory().then(mod => {
      if (!mod?.default) {
        // While a reload is in flight, render nothing to avoid an error-boundary flash.
        if (tryChunkReload()) return { default: () => null }
        throw new Error('Chunk resolved without a default export')
      }
      return mod
    }).catch(err => {
      tryChunkReload()
      throw err instanceof Error ? err : new Error('Chunk failed to load')
    })
  )
}
import { BrowserRouter, Routes, Route, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import { ProjectStateProvider } from './hooks/useProjectState'
import ProtectedRoute from './components/ProtectedRoute'
import { usePaidFeatures } from './hooks/usePaidFeatures'
import { useExpressBeta } from './hooks/useExpressBeta'
import { useProjectModes } from './hooks/useProjectModes'
import { isExpressOnlyUser } from './lib/expressRouting'
import Spinner from './components/Spinner'
import { useUser } from './hooks/useUser'
import ExpressProviders from './features/expressDefense/ExpressProviders'
import RouteProgressBar from './components/RouteProgressBar'
import CookieBanner from './components/CookieBanner'
import PWAInstallPrompt from './components/PWAInstallPrompt'
import {
  AuthPageSkeleton,
  PublicPageSkeleton,
  DashboardPageSkeleton,
  AppShellSkeleton,
} from './components/skeletons/PageSkeletons'

// Lazy-loaded route components
const LandingPage       = safeLazy(() => import('./pages/LandingPage'))
const Pricing           = safeLazy(() => import('./pages/Pricing'))
const About             = safeLazy(() => import('./pages/About'))
const Contact           = safeLazy(() => import('./pages/Contact'))
const Privacy           = safeLazy(() => import('./pages/Privacy'))
const Terms             = safeLazy(() => import('./pages/Terms'))
const CookiePolicy      = safeLazy(() => import('./pages/CookiePolicy'))
const Login             = safeLazy(() => import('./pages/Login'))
const Signup            = safeLazy(() => import('./pages/Signup'))
const ForgotPassword    = safeLazy(() => import('./pages/ForgotPassword'))
const ResetPassword     = safeLazy(() => import('./pages/ResetPassword'))
const VerifyEmail       = safeLazy(() => import('./pages/VerifyEmail'))
const PaymentSuccess    = safeLazy(() => import('./pages/PaymentSuccess'))
const MaintenancePage   = safeLazy(() => import('./pages/MaintenancePage'))
const AuthConfirm       = safeLazy(() => import('./pages/auth/AuthConfirm'))
const ChangelogPage     = safeLazy(() => import('./pages/changelog/ChangelogPage'))
const RoadmapPage       = safeLazy(() => import('./pages/roadmap/RoadmapPage'))
const NotFound          = safeLazy(() => import('./pages/NotFound'))
const VerifyCertificate = safeLazy(() => import('./pages/VerifyCertificate'))
const SplashOnboarding  = safeLazy(() => import('./pages/SplashOnboarding'))
const Dashboard         = safeLazy(() => import('./pages/Dashboard'))
const Profile           = safeLazy(() => import('./pages/Profile'))
const Settings          = safeLazy(() => import('./pages/Settings'))
const EmailPreferences  = safeLazy(() => import('./pages/account/EmailPreferences'))
const MyCertificates    = safeLazy(() => import('./pages/account/MyCertificates'))
const MyReferrals       = safeLazy(() => import('./pages/account/MyReferrals'))
const Achievements      = safeLazy(() => import('./pages/account/Achievements'))
const AppShell          = safeLazy(() => import('./features/shell/AppShell'))
const SupervisorPrep    = safeLazy(() => import('./features/supervisorPrep/SupervisorPrep'))
const ExpressOnboarding = safeLazy(() => import('./pages/ExpressOnboarding'))
const ExpressShell      = safeLazy(() => import('./features/expressDefense/ExpressShell'))
const ExpressAchievements = safeLazy(() => import('./pages/ExpressAchievements'))
const ExpressDashboard  = safeLazy(() => import('./pages/ExpressDashboard'))
const AdminHealth       = safeLazy(() => import('./pages/admin/Health'))

function S({ fallback, children }) {
  return <Suspense fallback={fallback}>{children}</Suspense>
}

function RequireExpress({ children }) {
  const { features, loading: featuresLoading } = usePaidFeatures()
  const { betaFree, loading: betaLoading }     = useExpressBeta()

  if (featuresLoading || betaLoading) return <Spinner />
  if (!features.includes('express_defense') && !betaFree) {
    return <Navigate to="/express-onboarding" replace />
  }
  return children
}

function ExpressDashboardRedirect() {
  const { user } = useUser()
  const { features, loading: featuresLoading } = usePaidFeatures()
  const { betaFree, loading: betaLoading } = useExpressBeta()
  const { hasExpress, hasStandard, loading: projectsLoading } = useProjectModes()

  const loading = featuresLoading || betaLoading || projectsLoading

  if (loading) {
    // While entitlements load, use cached value to skip the skeleton flash on return visits.
    // Only used as a fast-path during loading — fresh data always wins once resolved.
    // Key is v2: the v1 key was written by the buggy beta check and would keep bouncing
    // standard users to /express from cache alone.
    const cached = user?.id ? localStorage.getItem(`fypro_express_only_v2_${user.id}`) : null
    if (cached === '1') return <Navigate to="/express" replace />
    return <DashboardPageSkeleton />
  }

  const isExpressOnly = isExpressOnlyUser({
    features,
    betaFree,
    hasExpressProject: hasExpress,
    hasStandardProject: hasStandard,
  })

  // Update cache so next session can skip the skeleton
  if (user?.id) {
    localStorage.setItem(`fypro_express_only_v2_${user.id}`, isExpressOnly ? '1' : '0')
  }

  if (isExpressOnly) return <Navigate to="/express" replace />
  return (
    <S fallback={<DashboardPageSkeleton />}>
      <Dashboard />
    </S>
  )
}

function CanonicalTag() {
  const { pathname } = useLocation()
  useEffect(() => {
    const BASE = 'https://www.fypro.com.ng'
    let el = document.querySelector('link[rel="canonical"]')
    if (!el) {
      el = document.createElement('link')
      el.setAttribute('rel', 'canonical')
      document.head.appendChild(el)
    }
    el.setAttribute('href', BASE + pathname)
  }, [pathname])
  return null
}

// Intercepts Supabase auth hash fragments that land on the wrong page.
// Supabase ignores redirect_to when the URL isn't in its allowlist and
// falls back to the Site URL (homepage) with tokens in the hash.
// This catches that case globally and routes to /auth/confirm.
function RecoveryHashInterceptor() {
  const navigate = useNavigate()
  useEffect(() => {
    const hash = new URLSearchParams(window.location.hash.slice(1))
    if (hash.get('type') === 'recovery' && hash.get('access_token')) {
      navigate('/auth/confirm' + window.location.hash, { replace: true })
    }
  }, [navigate])
  return null
}

// Route transitions — lives inside BrowserRouter so useLocation() works.
// ToastProvider, CookieBanner, and RouteProgressBar sit outside so they
// persist across navigations and are never caught by the AnimatePresence.
function AppRoutes() {
  const location = useLocation()
  return (
    <>
    <CanonicalTag />
    <RecoveryHashInterceptor />
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
      <Route path="/verify/:certNumber" element={<S fallback={<PublicPageSkeleton />}><VerifyCertificate /></S>} />

      {/* Dashboard + account pages */}
      <Route path="/dashboard" element={<ProtectedRoute><ExpressDashboardRedirect /></ProtectedRoute>} />
      <Route path="/start"     element={<ProtectedRoute><S fallback={<AuthPageSkeleton />}><SplashOnboarding /></S></ProtectedRoute>} />
      <Route path="/profile"   element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><Profile /></S></ProtectedRoute>} />
      <Route path="/settings"  element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><Settings /></S></ProtectedRoute>} />
      <Route path="/account/email-preferences" element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><EmailPreferences /></S></ProtectedRoute>} />
      <Route path="/account/certificates"      element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><MyCertificates /></S></ProtectedRoute>} />
      <Route path="/account/referrals"         element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><MyReferrals /></S></ProtectedRoute>} />
      <Route path="/account/achievements"      element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><Achievements /></S></ProtectedRoute>} />
      <Route path="/payment-success"           element={<ProtectedRoute><S fallback={<PublicPageSkeleton />}><PaymentSuccess /></S></ProtectedRoute>} />
      <Route path="/admin/health"              element={<ProtectedRoute adminOnly><S fallback={<DashboardPageSkeleton />}><AdminHealth /></S></ProtectedRoute>} />

      {/* App shell + supervisor */}
      <Route path="/app"             element={<ProtectedRoute><S fallback={<AppShellSkeleton />}><AppShell /></S></ProtectedRoute>} />
      <Route path="/supervisor-prep" element={<ProtectedRoute><S fallback={<AppShellSkeleton />}><SupervisorPrep /></S></ProtectedRoute>} />
      <Route path="/express-onboarding" element={<ProtectedRoute><S fallback={<AuthPageSkeleton />}><ExpressOnboarding /></S></ProtectedRoute>} />
      <Route path="/express" element={
        <ProtectedRoute>
          <RequireExpress>
            <ExpressProviders>
              <S fallback={<DashboardPageSkeleton />}><ExpressDashboard /></S>
            </ExpressProviders>
          </RequireExpress>
        </ProtectedRoute>
      } />
      <Route path="/express/run" element={
        <ProtectedRoute>
          <RequireExpress>
            <ExpressProviders>
              <S fallback={<AppShellSkeleton />}><ExpressShell /></S>
            </ExpressProviders>
          </RequireExpress>
        </ProtectedRoute>
      } />
      <Route path="/express/achievements" element={
        <ProtectedRoute>
          <RequireExpress>
            <ExpressProviders>
              <S fallback={<DashboardPageSkeleton />}><ExpressAchievements /></S>
            </ExpressProviders>
          </RequireExpress>
        </ProtectedRoute>
      } />

      {/* 404 */}
      <Route path="*" element={<S fallback={<PublicPageSkeleton />}><NotFound /></S>} />
    </Routes>
    </>
  )
}

export default function App() {
  return (
    <AuthProvider>
    <ThemeProvider>
    <AppProvider>
      <BrowserRouter>
        <ProjectStateProvider>
        {import.meta.env.VITE_APP_ENV === 'staging' && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: '#F59E0B', color: '#000', textAlign: 'center',
            padding: '4px 0', fontSize: '12px', fontWeight: 600,
            fontFamily: 'monospace', letterSpacing: '0.03em',
          }}>
            ⚠ STAGING — Paystack test mode · throwaway database
          </div>
        )}
        <RouteProgressBar />
        <ToastProvider />
        <CookieBanner />
        <PWAInstallPrompt />
        <Suspense fallback={null}>
          <AppRoutes />
        </Suspense>
        </ProjectStateProvider>
      </BrowserRouter>
    </AppProvider>
    </ThemeProvider>
    </AuthProvider>
  )
}
