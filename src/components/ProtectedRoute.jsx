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

// Admin route gate compares a SHA-256 hash of the signed-in email against
// VITE_ADMIN_EMAIL_HASH, so the admin email is never shipped in plaintext in the
// JS bundle. This is a convenience gate ONLY — real enforcement is server-side in
// api/admin.js via a timing-safe ADMIN_EMAIL check on the verified JWT.
async function emailMatchesAdminHash(email) {
  const target = import.meta.env.VITE_ADMIN_EMAIL_HASH
  if (!target || !email || !globalThis.crypto?.subtle) return false
  const bytes = new TextEncoder().encode(email.trim().toLowerCase())
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return hex === target.trim().toLowerCase()
}

// SQL required (run once in Supabase SQL Editor):
//   ALTER TABLE user_entitlements
//   ADD COLUMN IF NOT EXISTS banned_until TIMESTAMPTZ DEFAULT NULL;
export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useUser()
  const [banned, setBanned] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  // Only admin routes need the async hash check; non-admin routes never block on it.
  const [adminChecking, setAdminChecking] = useState(adminOnly)
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

  // Resolve admin status for admin-only routes via the hashed-email comparison.
  useEffect(() => {
    if (!adminOnly) { setAdminChecking(false); return }
    if (!user?.email) { setIsAdmin(false); setAdminChecking(false); return }
    let cancelled = false
    setAdminChecking(true)
    emailMatchesAdminHash(user.email).then((ok) => {
      if (!cancelled) { setIsAdmin(ok); setAdminChecking(false) }
    })
    return () => { cancelled = true }
  }, [adminOnly, user?.email])

  // Show spinner while auth resolves, the ban check is in flight (first visit only),
  // or the admin hash check is resolving for an admin-only route.
  if (loading || (banChecking && !!user?.id) || (adminChecking && !!user?.id)) return (
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

  if (adminOnly && !isAdmin) {
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
