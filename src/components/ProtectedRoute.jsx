import { Navigate } from 'react-router-dom'
import { useUser } from '../hooks/useUser'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

// SQL required (run once in Supabase SQL Editor):
//   ALTER TABLE user_entitlements
//   ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ DEFAULT NULL;
export default function ProtectedRoute({ children }) {
  const { user, loading } = useUser()
  const [banState, setBanState] = useState('idle') // 'idle' | 'checking' | 'ok' | 'banned'

  useEffect(() => {
    if (!user?.id) { setBanState('ok'); return }
    setBanState('checking')
    supabase
      .from('user_entitlements')
      .select('banned_until')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        if (data?.banned_until && new Date(data.banned_until) > new Date()) {
          supabase.auth.signOut()
          setBanState('banned')
        } else {
          setBanState('ok')
        }
      })
      .catch(() => setBanState('ok')) // network error — allow access, ban is best-effort
  }, [user?.id])

  if (loading || banState === 'idle' || banState === 'checking') return null

  if (!user) return <Navigate to="/login" replace />

  if (banState === 'banned') {
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
