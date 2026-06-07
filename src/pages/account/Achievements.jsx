// src/pages/account/Achievements.jsx
import { Link } from 'react-router-dom'
import { useAchievements } from '../../hooks/useAchievements'
import { useTheme } from '../../context/ThemeContext'

const ACHIEVEMENT_DEFS = [
  // Milestone
  { key: 'first_step',    name: 'First Step',          emoji: '🌱', desc: 'Completed Topic Validator for the first time',                    cat: 'Milestone', hidden: false },
  { key: 'halfway',       name: 'Halfway There',        emoji: '⚡', desc: 'Completed 3 of the 6 steps',                                    cat: 'Milestone', hidden: false },
  { key: 'defense_ready', name: 'Defense Ready',        emoji: '🛡️', desc: 'Completed all 6 steps and ran a defense session',                cat: 'Milestone', hidden: false },
  { key: 'certified',     name: 'Certified',            emoji: '🎓', desc: 'Earned a Defense Certificate (score 7 or higher)',               cat: 'Milestone', hidden: false },
  // Speed
  { key: 'fast_starter',  name: 'Fast Starter',         emoji: '🚀', desc: 'Completed Step 1 within 1 hour of signing up',                  cat: 'Speed',     hidden: false },
  { key: 'sprint',        name: 'Sprint',               emoji: '🏃', desc: 'Completed 3 steps in a single day',                             cat: 'Speed',     hidden: false },
  { key: 'speed_run',     name: 'Speed Run',            emoji: '💨', desc: 'Completed all 6 steps within 7 days of signup',                 cat: 'Speed',     hidden: false },
  // Effort
  { key: 'sharp_mind',    name: 'Sharp Mind',           emoji: '🎯', desc: 'Scored 8 or higher in the Defense Simulator',                   cat: 'Effort',    hidden: false },
  { key: 'excellence',    name: 'Excellence',           emoji: '⭐', desc: 'Scored 9 or higher in the Defense Simulator',                   cat: 'Effort',    hidden: false },
  { key: 'perfectionist', name: 'Perfectionist',        emoji: '💎', desc: 'Scored a perfect 10/10 in the Defense Simulator',               cat: 'Effort',    hidden: false },
  { key: 'persistent',    name: 'Persistent',           emoji: '🔄', desc: 'Ran the Defense Simulator 3 times',                             cat: 'Effort',    hidden: false },
  { key: 'never_give_up', name: 'Never Give Up',        emoji: '💪', desc: 'Ran defense again after scoring below 7',                       cat: 'Effort',    hidden: false },
  // Social
  { key: 'ambassador',    name: 'Ambassador',           emoji: '📣', desc: 'Made your first referral',                                     cat: 'Social',    hidden: false },
  { key: 'connector',     name: 'Connector',            emoji: '🌐', desc: '3 qualified referrals — friends who validated a topic',         cat: 'Social',    hidden: false },
  { key: 'earned_it',     name: 'Earned It',            emoji: '🏆', desc: 'Earned your first free Defense session via referrals',          cat: 'Social',    hidden: false },
  { key: 'shared',        name: 'Shared',               emoji: '📤', desc: 'Shared your Defense certificate',                              cat: 'Social',    hidden: false },
  // Hidden
  { key: 'night_owl',     name: 'Night Owl',            emoji: '🦉', desc: 'Completed a step between midnight and 4 AM',                   cat: 'Hidden',    hidden: true  },
  { key: 'early_bird',    name: 'Early Bird',           emoji: '🌅', desc: 'Completed a step before 7 AM',                                 cat: 'Hidden',    hidden: true  },
  { key: 'dedicated',     name: 'Dedicated',            emoji: '🔥', desc: 'Took meaningful action on 5 different days',                   cat: 'Hidden',    hidden: true  },
]

const CATEGORIES = ['Milestone', 'Speed', 'Effort', 'Social', 'Hidden']

function AchCard({ def, earned, isDark }) {
  const showLabel = !def.hidden || earned
  return (
    <div style={{
      background: earned
        ? isDark ? 'rgba(255,255,255,0.06)' : '#ffffff'
        : isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)',
      border: earned
        ? isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(13,27,42,0.12)'
        : isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(13,27,42,0.06)',
      borderRadius: 12, padding: '16px',
      opacity: earned ? 1 : def.hidden ? 0.6 : 0.4,
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
          {!earned && def.hidden ? '?' : def.emoji}
        </div>
        <p style={{
          fontFamily: "'Poppins', sans-serif", fontSize: '0.85rem', fontWeight: 700,
          color: earned ? (isDark ? '#fff' : '#0D1B2A') : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(13,27,42,0.5)',
          margin: 0,
        }}>
          {showLabel ? def.name : '???'}
        </p>
        {earned && (
          <span style={{
            marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            padding: '2px 8px', borderRadius: 999,
            background: 'rgba(22,163,74,0.12)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.3)',
            flexShrink: 0,
          }}>
            ✓
          </span>
        )}
      </div>
      <p style={{
        fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem',
        color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.45)',
        margin: 0, lineHeight: 1.5,
      }}>
        {showLabel ? def.desc : 'Keep exploring to discover this achievement.'}
      </p>
    </div>
  )
}

export default function Achievements() {
  const { earnedKeys, loading } = useAchievements()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const pageBg   = isDark ? '#060E18' : '#F0F4F8'
  const dotColor = isDark ? 'rgba(0,102,255,0.08)' : 'rgba(0,102,255,0.10)'

  const totalEarned = ACHIEVEMENT_DEFS.filter(a => earnedKeys.has(a.key)).length

  return (
    <div style={{
      minHeight: '100vh', background: pageBg,
      backgroundImage: `radial-gradient(circle, ${dotColor} 1.2px, transparent 1px)`,
      backgroundSize: '28px 28px', padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        <Link to="/dashboard" style={{
          fontFamily: "'Poppins', sans-serif", fontSize: '0.8125rem',
          color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.45)',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 28,
        }}>
          ← Back to Dashboard
        </Link>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: isDark ? '#fff' : '#0D1B2A', margin: '0 0 8px' }}>
            Achievements
          </h1>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.9rem', color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(13,27,42,0.6)', margin: 0 }}>
            {totalEarned} of {ACHIEVEMENT_DEFS.length} unlocked
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
          CATEGORIES.map(cat => {
            const defs = ACHIEVEMENT_DEFS.filter(a => a.cat === cat)
            return (
              <div key={cat} style={{ marginBottom: 36 }}>
                <p style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.45)',
                  margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  {cat}
                  <span style={{ flex: 1, height: 1, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(13,27,42,0.08)' }} />
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {defs.map(def => (
                    <AchCard key={def.key} def={def} earned={earnedKeys.has(def.key)} isDark={isDark} />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
