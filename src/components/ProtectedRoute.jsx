import { Navigate } from 'react-router-dom'
import { useUser } from '../hooks/useUser'

export default function ProtectedRoute({ children }) {
  const { user, loading } = useUser()

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg-base)',
        }}
      >
        <div
          style={{
            width: 32,
            height: 32,
            border: '3px solid rgba(0,102,255,0.2)',
            borderTopColor: '#0066FF',
            borderRadius: '50%',
            animation: 'spin 0.7s linear infinite',
          }}
        />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  return children
}
