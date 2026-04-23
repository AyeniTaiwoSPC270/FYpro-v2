import LandingPage from './pages/LandingPage'
import Dashboard from './pages/Dashboard'

// Switch between pages: '/' → landing, '/dashboard' → dashboard
const page = window.location.pathname

export default function App() {
  if (page === '/dashboard') return <Dashboard />
  return <LandingPage />
}
