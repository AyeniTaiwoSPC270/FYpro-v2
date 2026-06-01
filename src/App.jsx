import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import { AppProvider } from './context/AppContext'
import { ThemeProvider } from './context/ThemeContext'
import { ToastProvider } from './components/Toast'
import { ProjectStateProvider } from './hooks/useProjectState'
import ProtectedRoute from './components/ProtectedRoute'
import RouteProgressBar from './components/RouteProgressBar'
import LandingPage from './pages/LandingPage'
import Pricing from './pages/Pricing'
import SplashOnboarding from './pages/SplashOnboarding'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import VerifyEmail from './pages/VerifyEmail'
import PaymentSuccess from './pages/PaymentSuccess'
import About from './pages/About'
import Contact from './pages/Contact'
import Privacy from './pages/Privacy'
import Terms from './pages/Terms'
import NotFound from './pages/NotFound'
import AppShell from './features/shell/AppShell'
import SupervisorPrep from './features/supervisorPrep/SupervisorPrep'
const AdminHealth = lazy(() => import('./pages/admin/Health'))
import ChangelogPage from './pages/changelog/ChangelogPage'
import RoadmapPage from './pages/roadmap/RoadmapPage'
import EmailPreferences from './pages/account/EmailPreferences'
import MyCertificates from './pages/account/MyCertificates'
import MyReferrals from './pages/account/MyReferrals'
import CookieBanner from './components/CookieBanner'
import CookiePolicy from './pages/CookiePolicy'
import MaintenancePage from './pages/MaintenancePage'
import AuthConfirm from './pages/auth/AuthConfirm'
import { AuthProvider } from './context/AuthContext'

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
          <Route path="/admin/health" element={<ProtectedRoute adminOnly><Suspense fallback={null}><AdminHealth /></Suspense></ProtectedRoute>} />

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
        <AppRoutes />
        </ProjectStateProvider>
      </BrowserRouter>
    </AppProvider>
    </ThemeProvider>
    </AuthProvider>
  )
}
