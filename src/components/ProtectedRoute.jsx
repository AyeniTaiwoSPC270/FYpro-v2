import { Navigate } from 'react-router-dom'
import { useUser } from '../hooks/useUser'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useUser()

  // loading is true only when a Supabase token exists in localStorage but
  // getSession() hasn't resolved yet. Render nothing — don't redirect.
  if (loading) return null

  // Session confirmed absent — redirect immediately with no flash.
  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
