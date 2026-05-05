import { Navigate } from 'react-router-dom'
import { useUser } from '../hooks/useUser'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// SQL required (run once in Supabase SQL Editor):
//   ALTER TABLE user_entitlements
//   ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ DEFAULT NULL;
export default function ProtectedRoute({ children }) {
  const { user, loading } = useUser()
  const [banned, setBanned] = useState(false)

  // Ban check is a best-effort background check — it runs after children are
  // already shown. This avoids a null → children flicker on every page transition.
  // If the check fails (network error), the user is allowed access.
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('user_entitlements')
      .select('banned_until')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.banned_until && new Date(data.banned_until) > new Date()) {
          supabase.auth.signOut()
          setBanned(true)
        }
      })
      .catch(() => {})
  }, [user?.id])

  // Hold render only while Supabase is confirming the session token.
  // Once loading is false, we know whether user exists — act immediately.
  if (loading) return null

  if (!user) return <Navigate to="/login" replace />

  if (banned) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#060E18',
        fontFamily: "'Poppins', sans-serif",
        textAlign: 'center',
        padding: '32px',
      }}>
        <div>
          <p style={{ fontSize: '1.1rem', fontWeight: 600, color: '#fff', marginBottom: 8 }}>
            Account Suspended
          </p>
          <p style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.88rem' }}>
            Your account has been suspended. Contact support.
          </p>
        </div>
      </div>
    )
  }

  return children
}
