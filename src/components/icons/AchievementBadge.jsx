import { useId } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { GLYPHS } from './glyphs'
import { TIER_COLORS, LOCKED } from './tokens'
import { HexFrame } from './frames'

// Renders one achievement badge: a duotone glyph, framed with a hex medallion
// for rare/elite tiers. Locked (earned=false) badges desaturate + fade.
export default function AchievementBadge({
  glyph,
  tier = 'standard',
  earned = true,
  size = 48,
  title,
}) {
  const { theme } = useTheme()
  const mode = theme === 'light' ? 'light' : 'dark'
  const uid = useId().replace(/:/g, '')

  const palette = earned ? TIER_COLORS[tier][mode] : LOCKED[mode]
  const framed = tier !== 'standard'
  // Glyphs are drawn on a 24 grid. Framed → shrink to sit inside the hex;
  // standard → scale up to fill the 48 box.
  const transform = framed ? 'translate(16.5,16.5) scale(0.62)' : 'translate(4,4) scale(1.6667)'
  const eliteGlow = earned && tier === 'elite'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title || glyph}
      style={{
        filter: !earned
          ? 'grayscale(1)'
          : eliteGlow
          ? 'drop-shadow(0 0 6px rgba(217,155,43,0.45))'
          : 'none',
        opacity: earned ? 1 : 0.4,
        flexShrink: 0,
      }}
    >
      {framed && <HexFrame tier={tier} uid={uid} earned={earned} />}
      <g transform={transform} style={{ '--gl-stroke': palette.stroke, '--gl-fill': palette.fill }}>
        {GLYPHS[glyph]}
      </g>
    </svg>
  )
}
