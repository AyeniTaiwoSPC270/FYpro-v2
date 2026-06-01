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

// Route transitions — lives inside BrowserRouter so useLocation() works.
// ToastProvider, CookieBanner, and RouteProgressBar sit outside so they
// persist across navigations and are never caught by the AnimatePresence.
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
