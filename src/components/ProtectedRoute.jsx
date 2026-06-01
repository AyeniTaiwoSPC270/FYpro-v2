import { Navigate } from 'react-router-dom'
import { useUser } from '../hooks/useUser'
import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import WhatsAppButton from './WhatsAppButton'

const BAN_CACHE_TTL = 30 * 60 * 1000 // 30 minutes

function readBanCache(userId) {
  try {
    const raw = sessionStorage.getItem(`fypro_ban_${userId}`)
    if (!raw) return null
    const { banned, ts } = JSON.parse(raw)
    if (Date.now() - ts < BAN_CACHE_TTL) return banned
    return null // expired
  } catch {
    return null
  }
}

function writeBanCache(userId, banned) {
  try {
    sessionStorage.setItem(`fypro_ban_${userId}`, JSON.stringify({ banned, ts: Date.now() }))
  } catch {}
}

// SQL required (run once in Supabase SQL Editor):
//   ALTER TABLE user_entitlements
//   ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ DEFAULT NULL;
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useUser()
  const [banned, setBanned] = useState(false)
  // Lazy initializer: only show ban-check spinner if no valid cache exists for this user.
  const [banChecking, setBanChecking] = useState(() => {
    if (!user?.id) return false
    return readBanCache(user.id) === null
  })

  useEffect(() => {
    if (!user?.id) {
      setBanChecking(false)
      return
    }

    const cached = readBanCache(user.id)
    if (cached !== null) {
      // Cache hit — no DB call, no spinner
      if (cached) { supabase.auth.signOut(); setBanned(true) }
      setBanChecking(false)
      return
    }

    // Cache miss — run the query and cache the result
    setBanChecking(true)
    supabase
      .from('user_entitlements')
      .select('banned_until')
      .eq('user_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        const isBanned = !!(data?.banned_until && new Date(data.banned_until) > new Date())
        writeBanCache(user.id, isBanned)
        if (isBanned) { supabase.auth.signOut(); setBanned(true) }
      })
      .catch(() => {})
      .finally(() => setBanChecking(false))
  }, [user?.id])

  // Show spinner while auth resolves or (first-visit only) ban check is in flight.
  if (loading || (banChecking && !!user?.id)) return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base, #060E18)',
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

  if (adminOnly && user.email !== import.meta.env.VITE_ADMIN_EMAIL) {
    return <Navigate to="/dashboard" replace />
  }

  if (banned) {
    return (
      <div style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base, #060E18)',
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
