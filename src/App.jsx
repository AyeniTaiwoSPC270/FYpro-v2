import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { ThemeProvider } from './context/ThemeContext'
import { AuthProvider } from './context/AuthContext'
import { ToastProvider } from './components/Toast'
import { ProjectStateProvider } from './hooks/useProjectState'
import ProtectedRoute from './components/ProtectedRoute'
import { usePaidFeatures } from './hooks/usePaidFeatures'
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
const VerifyCertificate = lazy(() => import('./pages/VerifyCertificate'))
const SplashOnboarding  = lazy(() => import('./pages/SplashOnboarding'))
const Dashboard         = lazy(() => import('./pages/Dashboard'))
const Profile           = lazy(() => import('./pages/Profile'))
const Settings          = lazy(() => import('./pages/Settings'))
const EmailPreferences  = lazy(() => import('./pages/account/EmailPreferences'))
const MyCertificates    = lazy(() => import('./pages/account/MyCertificates'))
const MyReferrals       = lazy(() => import('./pages/account/MyReferrals'))
const Achievements       = lazy(() => import('./pages/account/Achievements'))
const AppShell          = lazy(() => import('./features/shell/AppShell'))
const SupervisorPrep    = lazy(() => import('./features/supervisorPrep/SupervisorPrep'))
const ExpressOnboarding = lazy(() => import('./pages/ExpressOnboarding'))
const ExpressShell      = lazy(() => import('./features/expressDefense/ExpressShell'))
const ExpressDashboard  = lazy(() => import('./pages/ExpressDashboard'))
const AdminHealth       = lazy(() => import('./pages/admin/Health'))

function S({ fallback, children }) {
  return <Suspense fallback={fallback}>{children}</Suspense>
}

function RequireExpress({ children }) {
  const { features, loading } = usePaidFeatures()
  if (loading) return <DashboardPageSkeleton />
  if (!features.includes('express_defense')) return <Navigate to="/express-onboarding" replace />
  return children
}

function ExpressDashboardRedirect() {
  const { features, loading } = usePaidFeatures()
  if (loading) return <DashboardPageSkeleton />
  const isExpressOnly =
    features.includes('express_defense') &&
    !features.includes('defense_pack') &&
    !features.includes('student_pack')
  if (isExpressOnly) return <Navigate to="/express" replace />
  return (
    <S fallback={<DashboardPageSkeleton />}>
      <Dashboard />
    </S>
  )
}

// Route transitions — lives inside BrowserRouter so useLocation() works.
// ToastProvider, CookieBanner, and RouteProgressBar sit outside so they
// persist across navigations and are never caught by the AnimatePresence.
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

      {/* 404 */}
      <Route path="*" element={<S fallback={<PublicPageSkeleton />}><NotFound /></S>} />
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
