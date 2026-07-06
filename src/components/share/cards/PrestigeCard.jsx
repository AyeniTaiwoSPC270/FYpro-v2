import { truncate } from '../cardHelpers'

const GOLD = '#C9A84C'
const SHIELD_PATH = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

export default function PrestigeCard({ score, scoreLabel, topic }) {
  return (
    <div
      aria-label="Defense result share card preview"
      style={{
        width: 'min(270px, 100%)',
        aspectRatio: '270 / 337',
        height: 'auto',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#FFFDF5',
        border: `2px solid ${GOLD}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div aria-hidden="true" style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, borderTop: `2px solid ${GOLD}`, borderLeft: `2px solid ${GOLD}` }} />
      <div aria-hidden="true" style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderTop: `2px solid ${GOLD}`, borderRight: `2px solid ${GOLD}` }} />
      <div aria-hidden="true" style={{ position: 'absolute', bottom: 8, left: 8, width: 18, height: 18, borderBottom: `2px solid ${GOLD}`, borderLeft: `2px solid ${GOLD}` }} />
      <div aria-hidden="true" style={{ position: 'absolute', bottom: 8, right: 8, width: 18, height: 18, borderBottom: `2px solid ${GOLD}`, borderRight: `2px solid ${GOLD}` }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '22px 20px 0', position: 'relative' }}>
        <svg width="26" height="26" viewBox="0 0 256 256" fill={GOLD} aria-hidden="true">
          <path d={SHIELD_PATH} />
        </svg>
        <span style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '0.72rem',
          color: '#0D1B2A',
          letterSpacing: '0.14em',
          marginTop: 8,
        }}>
          DEFENCE RESULT
        </span>
      </div>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.62rem',
          color: '#7A6530',
          letterSpacing: '0.1em',
          marginBottom: 6,
        }}>
          PANEL SCORE
        </span>
        <span style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '2.4rem',
          fontWeight: 700,
          color: '#0D1B2A',
          lineHeight: 1,
        }}>
          {score ?? '?'}<span style={{ fontSize: '1.1rem', color: '#7A6530' }}>/10</span>
        </span>
        {scoreLabel && (
          <span style={{
            marginTop: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.56rem',
            fontWeight: 700,
            color: '#7A6530',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '3px 10px',
            border: `1px solid ${GOLD}`,
          }}>
            {scoreLabel.toUpperCase()}
          </span>
        )}
      </div>

      <div style={{ padding: '0 22px 10px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, position: 'relative' }}>
        <div style={{ width: '60%', height: 1.5, background: GOLD, opacity: 0.85 }} />
        <p style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontStyle: 'italic',
          fontSize: '0.62rem',
          color: '#0D1B2A',
          textAlign: 'center',
          margin: 0,
        }}>
          {truncate(topic || 'Research topic', 80)}
        </p>
      </div>

      <div style={{ padding: '8px 22px', borderTop: `1px solid ${GOLD}66`, position: 'relative' }}>
        <p style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '0.6rem',
          color: '#0D1B2A',
          textAlign: 'center',
          margin: 0,
        }}>
          I just simulated my project defense on FYPro.
        </p>
      </div>

      <div style={{ padding: '6px 20px 12px', textAlign: 'center', position: 'relative' }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.52rem',
          fontWeight: 600,
          color: '#7A6530',
          letterSpacing: '0.06em',
        }}>
          fypro.com.ng
        </span>
      </div>
    </div>
  )
}
