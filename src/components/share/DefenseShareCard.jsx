// Visual preview of the shareable defense result card.
// The actual PNG is rendered server-side by /api/share-card.
// This component shows the same design in-app for preview.

const SHIELD_PATH =
  'M224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

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
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="18" height="18" fill="#0066FF" aria-hidden="true">
          <path d={SHIELD_PATH} />
        </svg>
        <span style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '0.9rem',
          color: '#FFFFFF',
          letterSpacing: '0.01em',
        }}>
          FYPro
        </span>
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.5rem',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.3)',
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
          color: 'rgba(255,255,255,0.35)',
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
          {score ?? '?'}<span style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.4)' }}>/10</span>
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
          color: 'rgba(255,255,255,0.55)',
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
          color: 'rgba(255,255,255,0.45)',
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
          color: '#0066FF',
          letterSpacing: '0.08em',
          opacity: 0.8,
        }}>
          fypro.com.ng
        </span>
      </div>
    </div>
  )
}
