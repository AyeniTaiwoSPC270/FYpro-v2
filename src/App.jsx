import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AppProvider } from './context/AppContext'
import { ToastProvider } from './components/Toast'
import LandingPage from './pages/LandingPage'
import Pricing from './pages/Pricing'
import SplashOnboarding from './pages/SplashOnboarding'
import AppShell from './components/AppShell'
import Dashboard from './pages/Dashboard'
import Profile from './pages/Profile'
import Login from './pages/Login'
import Signup from './pages/Signup'
import ForgotPassword from './pages/ForgotPassword'
import VerifyEmail from './pages/VerifyEmail'

export default function App() {
  return (
    <AppProvider>
      <BrowserRouter>
        <ToastProvider />
        <Routes>
          {/* Public marketing */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/pricing" element={<Pricing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* App entry — splash + onboarding */}
          <Route path="/start" element={<SplashOnboarding />} />

          {/* Main app shell — all 6 steps rendered inside */}
          <Route path="/app" element={<AppShell />} />

          {/* Dashboard */}
          <Route path="/dashboard" element={<Dashboard />} />

          {/* Profile */}
          <Route path="/profile" element={<Profile />} />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AppProvider>
  )
}
