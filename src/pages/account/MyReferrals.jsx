import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMyReferrals } from '../../lib/referral'
import { showToast } from '../../components/Toast'

const BASE_URL = 'https://fypro.com.ng'

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

function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: '#0d1f35',
      borderRadius: 12,
      border: '1px solid rgba(255,255,255,0.08)',
      boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
      padding: '20px 24px',
      flex: 1,
      minWidth: 120,
    }}>
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.75rem', fontWeight: 700, color: '#FFFFFF', margin: 0, lineHeight: 1 }}>
        {value}
      </p>
      <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.78rem', color: 'rgba(255,255,255,0.5)', margin: '6px 0 0', lineHeight: 1.3 }}>
        {label}
      </p>
      {sub && (
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.7rem', color: 'rgba(255,255,255,0.3)', margin: '4px 0 0' }}>
          {sub}
        </p>
      )}
    </div>
  )
}

function MilestoneBar({ qualifiedCount }) {
  const inBatch = qualifiedCount % 3
  const filled = inBatch === 0 && qualifiedCount > 0 ? 3 : inBatch
  const pct = Math.round((filled / 3) * 100)

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.8rem', color: 'rgba(255,255,255,0.55)' }}>
          Next free Defense session
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.78rem', color: '#FFFFFF', fontWeight: 600 }}>
          {filled} / 3
        </span>
      </div>
      <div style={{ height: 8, background: 'rgba(13,27,42,0.08)', borderRadius: 999, overflow: 'hidden' }}>
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

function ReferralRow({ referral, index }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '1fr auto auto',
        alignItems: 'center',
        gap: 16,
        padding: '14px 20px',
        background: index % 2 === 0 ? 'rgba(255,255,255,0.03)' : 'rgba(255,255,255,0.01)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
      }}
    >
      <div>
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.8125rem', color: '#FFFFFF', margin: 0, fontWeight: 500 }}>
          Friend #{index + 1}
        </p>
        <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', margin: '2px 0 0' }}>
          Invited {formatDate(referral.created_at)}
        </p>
      </div>
      <StatusBadge status={referral.status} />
      <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.72rem', color: 'rgba(255,255,255,0.35)', margin: 0, minWidth: 90, textAlign: 'right' }}>
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
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetchMyReferrals()
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [])

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

  return (
    <div style={{ minHeight: '100vh', background: '#060E18', backgroundImage: 'radial-gradient(circle, rgba(0,102,255,0.05) 1px, transparent 1px)', backgroundSize: '28px 28px', padding: '40px 20px' }}>
      <div style={{ maxWidth: 680, margin: '0 auto' }}>

        {/* Back link */}
        <Link
          to="/dashboard"
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.8125rem',
            color: 'rgba(255,255,255,0.4)',
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
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: '#FFFFFF', margin: 0, lineHeight: 1.2 }}>
            Refer a Friend
          </h1>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)', marginTop: 8 }}>
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
        ) : !data ? (
          <p style={{ fontFamily: "'Poppins', sans-serif", color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '40px 0' }}>
            Could not load referral data. Please refresh the page.
          </p>
        ) : (
          <>
            {/* Referral code card */}
            <div style={{
              background: 'linear-gradient(145deg, #0D1B2A 0%, #0F2235 100%)',
              borderRadius: 16,
              border: '1px solid rgba(0,102,255,0.25)',
              boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
              padding: '28px 32px',
              marginBottom: 20,
              animation: 'card-enter 0.4s ease forwards',
            }}>
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: 'rgba(255,255,255,0.45)', textTransform: 'uppercase', letterSpacing: '0.08em', margin: '0 0 10px' }}>
                Your referral code
              </p>
              <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '2.25rem', fontWeight: 700, color: '#ffffff', margin: '0 0 16px', letterSpacing: '0.08em' }}>
                {data.referralCode ?? '—'}
              </p>

              {data.referralCode && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <code style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: '0.78rem',
                    color: 'rgba(255,255,255,0.6)',
                    background: 'rgba(255,255,255,0.06)',
                    border: '1px solid rgba(255,255,255,0.1)',
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
              <StatCard label="Friends invited" value={totalInvited} />
              <StatCard label="Qualified" value={qualifiedCount} sub="Email confirmed + topic validated" />
              <StatCard label="Rewarded" value={rewardedCount} />
              <StatCard
                label="Free sessions available"
                value={data.freeSessionsAvailable}
                sub="Ready to use"
              />
            </div>

            {/* Milestone progress */}
            <div style={{
              background: '#0d1f35',
              borderRadius: 12,
              border: '1px solid rgba(255,255,255,0.08)',
              padding: '20px 24px',
              marginBottom: 20,
              boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
              animation: 'card-enter 0.4s ease forwards',
            }}>
              <MilestoneBar qualifiedCount={qualifiedCount} />
              <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.78rem', color: 'rgba(255,255,255,0.4)', margin: '12px 0 0' }}>
                Every 3 friends who verify their email and complete their first Topic Validator run earns you 1 free Defence Simulator session.
              </p>
            </div>

            {/* Referral list */}
            {data.referrals.length > 0 ? (
              <div style={{
                background: '#0a1928',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                overflow: 'hidden',
                boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
                animation: 'card-enter 0.4s ease forwards',
              }}>
                {/* Table header */}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr auto auto',
                  gap: 16,
                  padding: '12px 20px',
                  background: 'rgba(255,255,255,0.04)',
                  borderBottom: '1px solid rgba(255,255,255,0.08)',
                }}>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Friend</span>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Status</span>
                  <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', fontWeight: 600, color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Date</span>
                </div>

                {data.referrals.map((r, i) => (
                  <ReferralRow key={r.id} referral={r} index={i} />
                ))}
              </div>
            ) : (
              <div style={{
                background: 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)',
                borderRadius: 12,
                border: '1px solid rgba(255,255,255,0.08)',
                padding: '40px 24px',
                textAlign: 'center',
                boxShadow: '0 4px 20px rgba(0,0,0,0.35)',
              }}>
                <p style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.1rem', color: '#FFFFFF', margin: '0 0 8px' }}>
                  No referrals yet
                </p>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.84rem', color: 'rgba(255,255,255,0.45)', margin: 0 }}>
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
