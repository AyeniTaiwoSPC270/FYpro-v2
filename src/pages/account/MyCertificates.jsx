import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMyCertificates, downloadCertificate } from '../../lib/certificate'
import { useTheme } from '../../context/ThemeContext'

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })
}

function ScorePill({ score }) {
  const s   = Number(score)
  const col = s >= 8 ? '#16A34A' : s >= 7 ? '#0066FF' : '#F59E0B'
  return (
    <span style={{
      fontFamily:    "'JetBrains Mono', 'Courier New', monospace",
      fontSize:      '0.72rem',
      fontWeight:    700,
      background:    col,
      color:         '#FFFFFF',
      padding:       '3px 10px',
      borderRadius:  999,
      letterSpacing: '0.4px',
      whiteSpace:    'nowrap',
    }}>
      {Number.isInteger(s) ? s : s.toFixed(1)}/10
    </span>
  )
}

function CertRow({ cert, onDownload, downloading, isDark }) {
  const [error, setError] = useState(null)

  async function handleDownload() {
    setError(null)
    try {
      await onDownload(cert.defense_session_id)
    } catch (err) {
      if (err.message === 'NAME_REQUIRED') {
        setError('Set your full name in Profile first.')
      } else {
        setError(err.message || 'Download failed. Please try again.')
      }
    }
  }

  return (
    <div style={{
      display:       'grid',
      gridTemplateColumns: '1fr auto',
      gap:           16,
      padding:       '18px 22px',
      background:    isDark
        ? 'linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.025) 100%)'
        : 'linear-gradient(145deg, #ffffff 0%, #f8faff 100%)',
      borderRadius:  12,
      border:        isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(13,27,42,0.08)',
      boxShadow:     isDark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 4px 16px rgba(0,0,0,0.06)',
      marginBottom:  12,
      animation:     'card-enter 0.4s ease forwards',
    }}>
      {/* Left: info */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <ScorePill score={cert.score} />
          <span style={{
            fontFamily:    "'JetBrains Mono', 'Courier New', monospace",
            fontSize:      '0.68rem',
            fontWeight:    500,
            color:         isDark ? 'rgba(255,255,255,0.3)' : 'rgba(13,27,42,0.35)',
            letterSpacing: '0.3px',
          }}>
            {cert.certificate_number}
          </span>
        </div>

        <p style={{
          fontFamily:  "'DM Serif Display', Georgia, serif",
          fontSize:    '0.95rem',
          color:       isDark ? '#FFFFFF' : '#0D1B2A',
          lineHeight:  1.4,
          marginBottom: 4,
          overflow:    'hidden',
          textOverflow: 'ellipsis',
          whiteSpace:  'nowrap',
        }}>
          {cert.topic_title}
        </p>

        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize:   '0.75rem',
          color:      isDark ? 'rgba(255,255,255,0.45)' : 'rgba(13,27,42,0.5)',
          margin:     0,
        }}>
          Issued {formatDate(cert.issued_at)} · {cert.recipient_name}
        </p>

        {error && (
          <p style={{
            fontFamily:  "'Poppins', sans-serif",
            fontSize:    '0.72rem',
            color:       '#DC2626',
            marginTop:   8,
          }}>
            {error}
          </p>
        )}
      </div>

      {/* Right: download */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={handleDownload}
          disabled={downloading}
          aria-label={`Download certificate ${cert.certificate_number}`}
          style={{
            padding:    '9px 16px',
            borderRadius: 10,
            background: downloading ? 'rgba(0,102,255,0.5)' : '#0066FF',
            color:      '#FFFFFF',
            border:     'none',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 600,
            fontSize:   '0.8rem',
            cursor:     downloading ? 'not-allowed' : 'pointer',
            whiteSpace: 'nowrap',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={e => { if (!downloading) e.currentTarget.style.background = '#0052CC' }}
          onMouseOut={e => { if (!downloading) e.currentTarget.style.background = '#0066FF' }}
        >
          {downloading ? 'Downloading…' : '⬇ Download'}
        </button>
      </div>
    </div>
  )
}

export default function MyCertificates() {
  const [certs,       setCerts]       = useState([])
  const [loading,     setLoading]     = useState(true)
  const [fetchError,  setFetchError]  = useState(null)
  const [downloading, setDownloading] = useState(null)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  useEffect(() => {
    fetchMyCertificates()
      .then(data => setCerts(data))
      .catch(err => setFetchError(err.message || 'Failed to load certificates'))
      .finally(() => setLoading(false))
  }, [])

  async function handleDownload(defenseSessionId) {
    setDownloading(defenseSessionId)
    try {
      await downloadCertificate(defenseSessionId)
    } finally {
      setDownloading(null)
    }
  }

  const pageBg        = isDark ? '#060E18' : '#F0F4F8'
  const dotColor      = isDark ? 'rgba(0,102,255,0.05)' : 'rgba(0,102,255,0.06)'
  const textPrimary   = isDark ? '#FFFFFF' : '#0D1B2A'
  const textSecondary = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(13,27,42,0.6)'
  const textMuted     = isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.45)'
  const emptyBg       = isDark
    ? 'linear-gradient(145deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)'
    : 'linear-gradient(145deg, #ffffff 0%, #f4f8ff 100%)'
  const emptyBorder   = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(13,27,42,0.08)'
  const emptyMuted    = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(13,27,42,0.5)'
  const countText     = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(13,27,42,0.4)'

  return (
    <div style={{
      minHeight:      '100vh',
      background:     pageBg,
      backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
      backgroundSize: '28px 28px',
      padding:        '40px 24px',
    }}>
      <div style={{ maxWidth: 660, margin: '0 auto' }}>

        {/* Back link */}
        <Link
          to="/dashboard"
          style={{
            display:        'inline-flex',
            alignItems:     'center',
            gap:            6,
            fontFamily:     "'Poppins', sans-serif",
            fontSize:       '0.82rem',
            color:          textMuted,
            textDecoration: 'none',
            marginBottom:   28,
          }}
        >
          ← Back to Dashboard
        </Link>

        {/* Page header */}
        <div style={{ marginBottom: 32, display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
          <h1 style={{
            fontFamily:   "'DM Serif Display', Georgia, serif",
            fontSize:     '2rem',
            fontWeight:   400,
            color:        textPrimary,
            lineHeight:   1.2,
            marginBottom: 8,
          }}>
            My Certificates
          </h1>
          <p style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize:   '0.875rem',
            color:      textSecondary,
            lineHeight: 1.6,
            margin:     0,
          }}>
            Download your earned Defense Readiness certificates. Each certificate is generated from your verified session score — scores are never self-reported.
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div style={{
            display:       'flex',
            flexDirection: 'column',
            alignItems:    'center',
            gap:           12,
            padding:       48,
            color:         textMuted,
            fontFamily:    "'Poppins', sans-serif",
            fontSize:      '0.875rem',
          }}>
            <div style={{
              width:       28,
              height:      28,
              border:      '2px solid rgba(0,102,255,0.3)',
              borderTop:   '2px solid #0066FF',
              borderRadius: '50%',
              animation:   'spin 1s linear infinite',
            }} />
            Loading certificates…
          </div>
        )}

        {/* Fetch error */}
        {!loading && fetchError && (
          <div style={{
            background:   '#FFF5F5',
            border:       '1px solid rgba(220,38,38,0.3)',
            borderLeft:   '4px solid #DC2626',
            borderRadius: 12,
            padding:      '16px 20px',
            fontFamily:   "'Poppins', sans-serif",
            fontSize:     '0.875rem',
            color:        '#991B1B',
          }}>
            {fetchError}
          </div>
        )}

        {/* Empty state */}
        {!loading && !fetchError && certs.length === 0 && (
          <div style={{
            background:   emptyBg,
            borderRadius: 16,
            border:       emptyBorder,
            boxShadow:    isDark ? '0 4px 24px rgba(0,0,0,0.4)' : '0 4px 24px rgba(0,0,0,0.06)',
            padding:      '48px 40px',
            textAlign:    'center',
          }}>
            <p style={{ fontSize: '2.5rem', marginBottom: 16 }}>🎓</p>
            <p style={{
              fontFamily:   "'DM Serif Display', Georgia, serif",
              fontSize:     '1.25rem',
              color:        textPrimary,
              marginBottom: 8,
            }}>
              No certificates yet
            </p>
            <p style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize:   '0.875rem',
              color:      emptyMuted,
              lineHeight: 1.6,
              maxWidth:   380,
              margin:     '0 auto',
            }}>
              Complete a Defense Simulator session with a score of 7/10 or above to earn your first certificate.
            </p>
          </div>
        )}

        {/* Certificate list */}
        {!loading && !fetchError && certs.length > 0 && (
          <>
            <p style={{
              fontFamily:   "'JetBrains Mono', 'Courier New', monospace",
              fontSize:     '0.7rem',
              color:        countText,
              letterSpacing: '0.6px',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}>
              {certs.length} certificate{certs.length !== 1 ? 's' : ''} earned
            </p>
            {certs.map(cert => (
              <CertRow
                key={cert.id}
                cert={cert}
                onDownload={handleDownload}
                downloading={downloading === cert.defense_session_id}
                isDark={isDark}
              />
            ))}
          </>
        )}

        <style>{`
          @keyframes card-enter {
            from { opacity: 0; transform: translateY(12px); }
            to   { opacity: 1; transform: translateY(0); }
          }
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    </div>
  )
}
