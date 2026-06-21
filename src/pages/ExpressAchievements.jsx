import { Link } from 'react-router-dom'
import { useAchievements } from '../hooks/useAchievements'
import { useProjectState } from '../hooks/useProjectState'
import { useTheme } from '../context/ThemeContext'
import { EXPRESS_ACHIEVEMENTS } from '../lib/expressAchievements'

function AchCard({ def, earned, isDark }) {
  return (
    <div style={{
      background: earned
        ? isDark ? 'rgba(255,255,255,0.06)' : '#ffffff'
        : isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)',
      border: earned
        ? isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(13,27,42,0.12)'
        : isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(13,27,42,0.06)',
      borderRadius: 12, padding: '16px',
      opacity: earned ? 1 : 0.4,
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: earned
        ? isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.06)'
        : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
          background: earned ? 'rgba(0,102,255,0.1)' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          filter: earned ? 'none' : 'grayscale(1)',
        }}>
          {def.emoji}
        </div>
        <p style={{
          fontFamily: "'Poppins', sans-serif", fontSize: '0.85rem', fontWeight: 700,
          color: earned ? (isDark ? '#fff' : '#0D1B2A') : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(13,27,42,0.5)',
          margin: 0,
        }}>
          {def.name}
        </p>
        {earned && (
          <span style={{
            marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            padding: '2px 8px', borderRadius: 999,
            background: 'rgba(22,163,74,0.12)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.3)',
            flexShrink: 0,
          }}>✓</span>
        )}
      </div>
      <p style={{
        fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem',
        color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.45)',
        margin: 0, lineHeight: 1.5,
      }}>
        {def.desc}
      </p>
    </div>
  )
}

export default function ExpressAchievements() {
  const { projectId } = useProjectState()
  const { earnedKeys, loading } = useAchievements(projectId)
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const pageBg   = isDark ? '#060E18' : '#F0F4F8'
  const dotColor = isDark ? 'rgba(0,102,255,0.08)' : 'rgba(0,102,255,0.10)'
  const totalEarned = EXPRESS_ACHIEVEMENTS.filter(a => earnedKeys.has(a.key)).length

  return (
    <div style={{
      minHeight: '100vh', background: pageBg,
      backgroundImage: `radial-gradient(circle, ${dotColor} 1.2px, transparent 1px)`,
      backgroundSize: '28px 28px', padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>
        <Link to="/express" style={{
          fontFamily: "'Poppins', sans-serif", fontSize: '0.8125rem',
          color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.45)',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 28,
        }}>
          ← Back to Express Dashboard
        </Link>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: isDark ? '#fff' : '#0D1B2A', margin: '0 0 8px' }}>
            Achievements
          </h1>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.9rem', color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(13,27,42,0.6)', margin: 0 }}>
            {totalEarned} of {EXPRESS_ACHIEVEMENTS.length} unlocked
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{
              width: 32, height: 32, border: '3px solid rgba(0,102,255,0.15)', borderTopColor: '#0066FF',
              borderRadius: '50%', animation: 'ach-spin 0.7s linear infinite',
            }} />
            <style>{`@keyframes ach-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
            {EXPRESS_ACHIEVEMENTS.map(def => (
              <AchCard key={def.key} def={def} earned={earnedKeys.has(def.key)} isDark={isDark} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
