import fyproLogoWhite from '../../../assets/fypro-logo-white.png'
import { scoreColor, truncate } from '../cardHelpers'

export default function ScoreboardCard({ score, scoreLabel, topic }) {
  const color = scoreColor(score)

  return (
    <div
      aria-label="Defense result share card preview"
      style={{
        width: 'min(270px, 100%)',
        aspectRatio: '270 / 337',
        height: 'auto',
        borderRadius: 16,
        overflow: 'hidden',
        background: color,
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.16) 1.5px, transparent 1.5px)',
          backgroundSize: '18px 18px',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '16px 20px 0', position: 'relative' }}>
        <img
          src={fyproLogoWhite}
          alt="FYPro"
          style={{ height: 22, width: 'auto', objectFit: 'contain', display: 'block' }}
        />
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.5rem',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.9)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          Defence Result
        </span>
      </div>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '3.4rem',
          fontWeight: 700,
          color: '#fff',
          lineHeight: 0.9,
        }}>
          {score ?? '?'}<span style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,0.7)' }}>/10</span>
        </span>

        {scoreLabel && (
          <span style={{
            marginTop: 10,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.62rem',
            fontWeight: 700,
            color: '#0D1B2A',
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            padding: '4px 12px',
            borderRadius: 999,
            background: '#fff',
          }}>
            {scoreLabel.toUpperCase()}
          </span>
        )}
      </div>

      <div style={{ padding: '0 20px 12px', position: 'relative' }}>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.62rem',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.92)',
          lineHeight: 1.5,
          margin: 0,
          textAlign: 'center',
        }}>
          {truncate(topic || 'Research topic', 80)}
        </p>
      </div>

      <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.25)', position: 'relative' }}>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.6rem',
          color: 'rgba(255,255,255,0.85)',
          margin: 0,
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          I just simulated my project defense on FYPro.
        </p>
      </div>

      <div style={{ padding: '8px 20px 14px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.52rem',
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '0.08em',
        }}>
          fypro.com.ng
        </span>
      </div>
    </div>
  )
}
