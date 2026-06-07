import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMyReferrals } from '../../lib/referral'
import { showToast } from '../../components/Toast'
import { useTheme } from '../../context/ThemeContext'
import { useUser } from '../../hooks/useUser'

const BASE_URL = 'https://www.fypro.com.ng'

function formatDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

function StatusBadge({ status }) {
  const map = {
    pending:   { label: 'Pending',   bg: 'rgba(245,158,11,0.12)', color: '#F59E0B', border: 'rgba(245,158,11,0.3)' },
    qualified: { label: 'Qualified', bg: 'rgba(0,102,255,0.1)',   color: '#0066FF', border: 'rgba(0,102,255,0.3)' },
    rewarded:  { label: 'Rewarded',  bg: 'rgba(22,163,74,0.1)',   color: '#16A34A', border: 'rgba(22,163,74,0.3)' },
  }
  const s = map[status] ?? map.pending
  return (
    <span style={{
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '0.04em',
      textTransform: 'uppercase',
      padding: '3px 10px',
      borderRadius: 999,
      background: s.bg,
      color: s.color,
      border: `1px solid ${s.border}`,
      whiteSpace: 'nowrap',
    }}>
      {s.label}
    </span>
  )
}

function StatCard({ label, value, sub, isDark }) {
  return (
    <div style={{
      background: isDark ? '#0d1f35' : 'linear-gradient(145deg, #ffffff 0%, #f4f8ff 100%)',
      borderRadius: 12,
      border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(13,27,42,0.08)',
      boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 4px 20px rgba(0,0,0,0.06)',
      padding: '20px 24px',
      flex: 1,
      minWidth: 120,
    }}>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.75rem', fontWeight: 700, color: isDark ? '#FFFFFF' : '#0D1B2A', margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.78rem', color: isDark ? 'rgba(255,255,255,0.5)' : 'rgba(13,27,42,0.55)', margin: '6px 0 0', lineHeight: 1.3 }}>
        {label}
      </p>
      {sub && (
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.7rem', color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(13,27,42,0.35)', margin: '4px 0 0' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

function MilestoneBar({ qualifiedCount, isDark }) {
  const inBatch = qualifiedCount % 3
  const filled = inBatch === 0 && qualifiedCount > 0 ? 3 : inBatch
  const pct = Math.round((filled / 3) * 100)

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.8rem', color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(13,27,42,0.55)' }}>
          Next free Defense session
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: isDark ? '#FFFFFF' : '#0D1B2A', fontWeight: 600 }}>
          {filled} / 3
        </span>
      </div>
      <div style={{ height: 8, background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(13,27,42,0.08)', borderRadius: 999, overflow: 'hidden' }}>
        <div style={{
          height: '100%',
          width: pct + '%',
          background: pct === 100 ? '#16A34A' : '#0066FF',
          borderRadius: 999,
          transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
          boxShadow: pct === 100 ? '0 0 12px rgba(22,163,74,0.4)' : '0 0 8px rgba(0,102,255,0.3)',
        }} />
      </div>
    </div>
  )
}

function ReferralRow({ referral, index, isDark }) {
  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '1fr auto auto',
      alignItems: 'center',
      gap: 16,
      padding: '14px 20px',
      background: index % 2 === 0
        ? (isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)')
        : 'transparent',
      borderBottom: isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(13,27,42,0.06)',
    }}>
      <div>
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.8125rem', color: isDark ? '#FFFFFF' : '#0D1B2A', margin: 0, fontWeight: 500 }}>
          Friend #{index + 1}
        </p>
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.45)', margin: '2px 0 0' }}>
          Invited {formatDate(referral.created_at)}
        </p>
      </div>
      <StatusBadge status={referral.status} />
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(13,27,42,0.4)', margin: 0, minWidth: 90, textAlign: 'right' }}>
        {referral.status === 'qualified' && referral.qualified_at
          ? formatDate(referral.qualified_at)
          : referral.status === 'rewarded' && referral.rewarded_at
          ? formatDate(referral.rewarded_at)
          : '—'}
      </p>
    </div>
  )
}

export default function MyReferrals() {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [copied, setCopied] = useState(false)
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const { user } = useUser()

  useEffect(() => {
    if (!user) return
    setLoading(true)
    setError(false)
    fetchMyReferrals()
      .then((result) => {
        if (result) setData(result)
        else setError(true)
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false))
  }, [user?.id])

  function handleCopy() {
    if (!data?.referralCode) return
    const link = `${BASE_URL}/?ref=${data.referralCode}`
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      showToast('Link copied!')
      setTimeout(() => setCopied(false), 2500)
    }).catch(() => showToast('Could not copy — try manually'))
  }

  const qualifiedCount = data ? data.referrals.filter((r) => r.status === 'qualified' || r.status === 'rewarded').length : 0
  const totalInvited   = data?.referrals.length ?? 0
  const rewardedCount  = data ? data.referrals.filter((r) => r.status === 'rewarded').length : 0

  const pageBg        = isDark ? '#060E18' : '#F0F4F8'
  const dotColor      = isDark ? 'rgba(51,122,255,0.14)' : 'rgba(51,122,255,0.18)'
  const textPrimary   = isDark ? '#FFFFFF' : '#0D1B2A'
  const textSecondary = isDark ? 'rgba(255,255,255,0.55)' : 'rgba(13,27,42,0.6)'
  const textMuted     = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.45)'
  const cardBg        = isDark ? 'linear-gradient(145deg, #0D1B2A 0%, #0F2235 100%)' : 'linear-gradient(145deg, #ffffff 0%, #f4f8ff 100%)'
  const cardBorder    = isDark ? '1px solid rgba(0,102,255,0.25)' : '1px solid rgba(0,102,255,0.18)'
  const cardShadow    = isDark ? '0 8px 32px rgba(0,0,0,0.15)' : '0 4px 24px rgba(0,0,0,0.08)'
  const milestoneCard = isDark ? '#0d1f35' : 'linear-gradient(145deg, #ffffff 0%, #f4f8ff 100%)'
  const milestoneBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(13,27,42,0.08)'
  const listBg        = isDark ? '#0a1928' : '#ffffff'
  const listBorder    = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(13,27,42,0.08)'
  const listHeaderBg  = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.03)'
  const listHeaderText = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.45)'
  const codeChipBg    = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(13,27,42,0.04)'
  const codeChipBorder = isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(13,27,42,0.1)'
  const codeChipText  = isDark ? 'rgba(255,255,255,0.6)' : 'rgba(13,27,42,0.6)'
  const emptyBg       = isDark ? 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)' : 'linear-gradient(145deg, #ffffff 0%, #f4f8ff 100%)'
  const emptyBorder   = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(13,27,42,0.08)'

  return (
    <div style={{ minHeight: '100vh', background: pageBg, backgroundImage: `radial-gradient(circle, ${dotColor} 1.6px, transparent 1px)`, backgroundSize: '28px 28px', padding: '40px 20px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Back link */}
        <Link
          to="/dashboard"
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.8125rem',
            color: textMuted,
            textDecoration: 'none',
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            marginBottom: 28,
          }}
        >
          ← Back to Dashboard
        </Link>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: textPrimary, margin: 0, lineHeight: 1.2 }}>
            Refer a Friend
          </h1>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.9rem', color: textSecondary, marginTop: 8 }}>
            Share your link. Every 3 friends who qualify earns you a free Defense session.
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{
              width: 32, height: 32,
              border: '3px solid rgba(0,102,255,0.15)',
              borderTopColor: '#0066FF',
              borderRadius: '50%',
              animation: 'mr-spin 0.7s linear infinite',
            }} />
            <style>{`@keyframes mr-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : error || !data ? (
          <div style={{
            background: isDark
              ? 'linear-gradient(145deg, rgba(220,38,38,0.08) 0%, rgba(220,38,38,0.04) 100%)'
              : 'linear-gradient(145deg, #fff5f5 0%, #fff 100%)',
            borderRadius: 16,
            border: isDark ? '1px solid rgba(220,38,38,0.25)' : '1px solid rgba(220,38,38,0.2)',
            padding: '40px 32px',
            textAlign: 'center',
            boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 4px 20px rgba(0,0,0,0.06)',
            animation: 'card-enter 0.4s ease forwards',
          }}>
            <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', color: textPrimary, margin: '0 0 8px' }}>
              Could not load referrals
            </p>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.84rem', color: textSecondary, margin: '0 0 20px' }}>
              Something went wrong. Please refresh the page and try again.
            </p>
            <button
              onClick={() => window.location.reload()}
              style={{
                fontFamily: "'Poppins', sans-serif",
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#ffffff',
                background: '#DC2626',
                border: 'none',
                borderRadius: 8,
                padding: '9px 20px',
                cursor: 'pointer',
              }}
            >
              Refresh page
            </button>
          </div>
        ) : (
          <>
            {/* Referral code card */}
            <div style={{
              background: cardBg,
              borderRadius: 16,
              border: cardBorder,
              boxShadow: cardShadow,
              padding: '28px 32px',
              marginBottom: 20,
              animation: 'card-enter 0.4s ease forwards',
            }}>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: textMuted, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                Your referral code
              </p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '2.25rem', fontWeight: 700, color: textPrimary, margin: '0 0 16px', letterSpacing: '0.08em' }}>
                {data.referralCode ?? '—'}
              </p>

              {data.referralCode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <code style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.78rem',
                    color: codeChipText,
                    background: codeChipBg,
                    border: codeChipBorder,
                    borderRadius: 8,
                    padding: '6px 12px',
                    userSelect: 'all',
                    wordBreak: 'break-all',
                  }}>
                    {BASE_URL}/?ref={data.referralCode}
                  </code>
                  <button
                    onClick={handleCopy}
                    style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: '0.8125rem',
                      fontWeight: 600,
                      color: '#ffffff',
                      background: copied ? '#16A34A' : '#0066FF',
                      border: 'none',
                      borderRadius: 8,
                      padding: '8px 18px',
                      cursor: 'pointer',
                      transition: 'background 0.2s ease',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {copied ? '✓ Copied' : 'Copy link'}
                  </button>
                </div>
              )}
            </div>

            {/* Stats row */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 20 }}>
              <StatCard label="Friends invited" value={totalInvited} isDark={isDark} />
              <StatCard label="Qualified" value={qualifiedCount} sub="Email confirmed + topic validated" isDark={isDark} />
              <StatCard label="Rewarded" value={rewardedCount} isDark={isDark} />
              <StatCard
                label="Free sessions available"
                value={data.freeSessionsAvailable}
                sub="Ready to use"
                isDark={isDark}
              />
            </div>

            {/* Milestone progress */}
            <div style={{
              background: milestoneCard,
              borderRadius: 12,
              border: milestoneBorder,
              padding: '20px 24px',
              marginBottom: 20,
              boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 4px 20px rgba(0,0,0,0.06)',
              animation: 'card-enter 0.4s ease forwards',
            }}>
              <MilestoneBar qualifiedCount={qualifiedCount} isDark={isDark} />
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.78rem', color: textMuted, margin: '12px 0 0' }}>
                Every 3 friends who verify their email and complete their first Topic Validator run earns you 1 free Defence Simulator session.
              </p>
            </div>

            {/* Referral list */}
            {data.referrals.length > 0 ? (
              <div style={{
                background: listBg,
                borderRadius: 12,
                border: listBorder,
                overflow: 'hidden',
                boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 4px 20px rgba(0,0,0,0.06)',
                animation: 'card-enter 0.4s ease forwards',
              }}>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 16,
                  padding: '12px 20px',
                  background: listHeaderBg,
                  borderBottom: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(13,27,42,0.08)',
                }}>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', fontWeight: 600, color: listHeaderText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Friend</span>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', fontWeight: 600, color: listHeaderText, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</span>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', fontWeight: 600, color: listHeaderText, textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Date</span>
                </div>

                {data.referrals.map((r, i) => (
                  <ReferralRow key={r.id} referral={r} index={i} isDark={isDark} />
                ))}
              </div>
            ) : (
              <div style={{
                background: emptyBg,
                borderRadius: 12,
                border: emptyBorder,
                padding: '40px 24px',
                textAlign: 'center',
                boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 4px 20px rgba(0,0,0,0.06)',
              }}>
                <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', color: textPrimary, margin: '0 0 8px' }}>
                  No referrals yet
                </p>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.84rem', color: textSecondary, margin: 0 }}>
                  Share your link above and start earning free Defence sessions.
                </p>
              </div>
            )}
          </>
        )}

        <style>{`
          @keyframes card-enter {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
        `}</style>
      </div>
    </div>
  )
}
