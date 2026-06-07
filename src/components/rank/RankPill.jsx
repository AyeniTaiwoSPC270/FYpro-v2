import { useEffect, useRef, useState } from 'react'
import { useRank } from '../../hooks/useRank'
import { useTheme } from '../../context/ThemeContext'

export default function RankPill() {
  const { rank, loading } = useRank()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const prevKeyRef = useRef(rank.key)

  // Detect rank change in this session for the glow effect
  const [justChanged, setJustChanged] = useState(false)
  useEffect(() => {
    if (!loading && prevKeyRef.current !== rank.key) {
      prevKeyRef.current = rank.key
      setJustChanged(true)
      const t = setTimeout(() => setJustChanged(false), 3000)
      return () => clearTimeout(t)
    }
  }, [rank.key, loading])

  if (loading) return (
    <div style={{
      height: 72, borderRadius: 10,
      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      margin: '0 0 8px',
    }} />
  )

  const glowColor = rank.color + '40'

  return (
    <div style={{
      background: isDark
        ? `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)`
        : `linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)`,
      border: `1px solid ${rank.color}40`,
      borderRadius: 10,
      padding: '10px 12px',
      marginBottom: 8,
      boxShadow: justChanged ? `0 0 16px ${glowColor}` : 'none',
      transition: 'box-shadow 0.4s ease',
    }}>
      {/* Label */}
      <p style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.58rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.45)',
        margin: '0 0 4px',
      }}>
        Research Rank
      </p>

      {/* Rank name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: '1rem' }}>{rank.emoji}</span>
        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.82rem',
          fontWeight: 700,
          color: isDark ? '#fff' : '#0D1B2A',
        }}>
          {rank.label}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4,
        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(13,27,42,0.08)',
        borderRadius: 999,
        overflow: 'hidden',
        marginBottom: 5,
      }}>
        <div style={{
          height: '100%',
          width: `${rank.progressPct}%`,
          background: rank.color,
          borderRadius: 999,
          transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
          boxShadow: `0 0 6px ${glowColor}`,
        }} />
      </div>

      {/* Next rank label */}
      {rank.nextLabel ? (
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.6rem',
          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(13,27,42,0.4)',
          margin: 0,
        }}>
          1 step to {rank.nextLabel}
        </p>
      ) : (
        <p style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.6rem',
          color: rank.color,
          fontWeight: 700,
          margin: 0,
        }}>
          MAX RANK ✓
        </p>
      )}
    </div>
  )
}
