import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { fetchMyCertificates, downloadCertificate } from '../../lib/certificate'

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

function CertRow({ cert, onDownload, downloading }) {
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
      background:    'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
      borderRadius:  12,
      border:        '1px solid rgba(13,27,42,0.1)',
      boxShadow:     '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
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
            color:         'rgba(13,27,42,0.4)',
            letterSpacing: '0.3px',
          }}>
            {cert.certificate_number}
          </span>
        </div>

        <p style={{
          fontFamily:  "'DM Serif Display', Georgia, serif",
          fontSize:    '0.95rem',
          color:       '#0D1B2A',
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
          color:      'rgba(13,27,42,0.5)',
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
  const [downloading, setDownloading] = useState(null) // session_id being downloaded

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

  return (
    <div style={{
      minHeight:      '100vh',
      background:     '#F0F4F8',
      backgroundImage: 'radial-gradient(circle, rgba(0,102,255,0.06) 1px, transparent 1px)',
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
            color:          'rgba(13,27,42,0.5)',
            textDecoration: 'none',
            marginBottom:   28,
          }}
        >
          ← Back to Dashboard
        </Link>

        {/* Page header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{
            fontFamily:   "'DM Serif Display', Georgia, serif",
            fontSize:     '2rem',
            fontWeight:   400,
            color:        '#0D1B2A',
            lineHeight:   1.2,
            marginBottom: 8,
          }}>
            My Certificates
          </h1>
          <p style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize:   '0.875rem',
            color:      'rgba(13,27,42,0.55)',
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
            color:         'rgba(13,27,42,0.4)',
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
            background:   'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
            borderRadius: 16,
            border:       '1px solid rgba(13,27,42,0.1)',
            boxShadow:    '0 4px 24px rgba(0,0,0,0.08)',
            padding:      '48px 40px',
            textAlign:    'center',
          }}>
            <p style={{ fontSize: '2.5rem', marginBottom: 16 }}>🎓</p>
            <p style={{
              fontFamily:   "'DM Serif Display', Georgia, serif",
              fontSize:     '1.25rem',
              color:        '#0D1B2A',
              marginBottom: 8,
            }}>
              No certificates yet
            </p>
            <p style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize:   '0.875rem',
              color:      'rgba(13,27,42,0.5)',
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
              color:        'rgba(13,27,42,0.4)',
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
              />
            ))}
          </>
        )}

      </div>
    </div>
  )
}
