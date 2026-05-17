import { Navigate } from 'react-router-dom'
import { useUser } from '../hooks/useUser'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import WhatsAppButton from './WhatsAppButton'

// SQL required (run once in Supabase SQL Editor):
//   ALTER TABLE user_entitlements
//   ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ DEFAULT NULL;
export default function ProtectedRoute({ children }) {
  const { user, loading } = useUser()
  const [banned, setBanned] = useState(false)
  const [banChecking, setBanChecking] = useState(true)

  useEffect(() => {
    if (!user?.id) {
      setBanChecking(false)
      return
    }
    setBanChecking(true)
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
      .finally(() => setBanChecking(false))
  }, [user?.id])

  // Show spinner while auth resolves or ban check is in flight.
  if (loading || (banChecking && !!user?.id)) return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: '#060E18',
    }}>
      <div style={{
        width: 36,
        height: 36,
        border: '3px solid rgba(0,102,255,0.15)',
        borderTopColor: '#0066FF',
        borderRadius: '50%',
        animation: 'pr-spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes pr-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )

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
          <p style={{ color: 'rgba(255,255,255,0.82)', fontSize: '0.88rem' }}>
            Your account has been suspended. Contact support.
          </p>
        </div>
      </div>
    )
  }

  return (
    <>
      {children}
      <WhatsAppButton />
    </>
  )
}
