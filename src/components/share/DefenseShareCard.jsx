// Visual preview of the shareable defense result card.
// The actual PNG is rendered server-side by /api/share-card.
// This component shows the same design in-app for preview.

import fyproLogo from '../../assets/fypro-logo.png'

function scoreColor(score) {
  if (score == null) return '#3B82F6'
  if (score >= 8) return '#16A34A'
  if (score >= 5) return '#F59E0B'
  return '#DC2626'
}

function truncate(str, max) {
  if (!str) return ''
  return str.length <= max ? str : str.slice(0, max - 1) + '…'
}

export default function DefenseShareCard({ score, scoreLabel, topic }) {
  const color = scoreColor(score)

  return (
    <div
      aria-label="Defense result share card preview"
      style={{
        width: 270,
        height: 337,
        borderRadius: 16,
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #060E18 0%, #0D1B2A 55%, #0F2235 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(0,102,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        flexShrink: 0,
      }}
    >
      {/* Subtle grid texture */}
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(0,102,255,0.04) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          pointerEvents: 'none',
        }}
      />

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '16px 20px 0',
        position: 'relative',
      }}>
        <img
          src={fyproLogo}
          alt="FYPro"
          style={{ height: 22, width: 'auto', objectFit: 'contain', display: 'block' }}
        />
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.5rem',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.75)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          Defence Result
        </span>
      </div>

      {/* Score centre */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        {/* Glow behind score */}
        <div aria-hidden="true" style={{
          position: 'absolute',
          width: 90, height: 90,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}22, transparent 70%)`,
          filter: 'blur(12px)',
        }} />

        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.6rem',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.75)',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          marginBottom: 4,
        }}>
          Panel Score
        </span>

        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '2.8rem',
          fontWeight: 700,
          color,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          position: 'relative',
        }}>
          {score ?? '?'}<span style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.75)' }}>/10</span>
        </span>

        {scoreLabel && (
          <span style={{
            marginTop: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.58rem',
            fontWeight: 700,
            color,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            padding: '3px 10px',
            borderRadius: 999,
            border: `1px solid ${color}55`,
            background: `${color}12`,
          }}>
            {scoreLabel.toUpperCase()}
          </span>
        )}
      </div>

      {/* Topic */}
      <div style={{ padding: '0 20px 12px' }}>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.62rem',
          color: 'rgba(255,255,255,0.82)',
          lineHeight: 1.5,
          margin: 0,
          textAlign: 'center',
        }}>
          {truncate(topic || 'Research topic', 80)}
        </p>
      </div>

      {/* Caption */}
      <div style={{
        padding: '10px 20px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.6rem',
          color: 'rgba(255,255,255,0.8)',
          margin: 0,
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          I just simulated my project defense on FYPro.
        </p>
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 20px 14px',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.52rem',
          fontWeight: 600,
          color: '#7ab8ff',
          letterSpacing: '0.08em',
          opacity: 0.9,
        }}>
          fypro.com.ng
        </span>
      </div>
    </div>
  )
}
