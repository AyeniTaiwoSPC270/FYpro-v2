import type { Tier, IconColors } from './types'

// Duotone colours per tier, per theme. `fill` is a translucent tint over the
// card background so it adapts to light/dark automatically; `stroke` is solid.
export const TIER_COLORS: Record<Tier, { light: IconColors; dark: IconColors }> = {
  standard: {
    light: { stroke: '#0066FF', fill: 'rgba(0,102,255,0.28)' },
    dark:  { stroke: '#3B82F6', fill: 'rgba(0,102,255,0.28)' },
  },
  rare: {
    light: { stroke: '#0066FF', fill: 'rgba(0,102,255,0.30)' },
    dark:  { stroke: '#8FB8FF', fill: 'rgba(0,102,255,0.30)' },
  },
  elite: {
    light: { stroke: '#C6871F', fill: 'rgba(252,217,128,0.28)' },
    dark:  { stroke: '#FCD980', fill: 'rgba(252,217,128,0.22)' },
  },
}

// Applied when a badge is not yet earned (in addition to a grayscale filter).
// Alphas are deliberately higher than the earned palette's fill/stroke would
// suggest — AchievementBadge no longer layers a second opacity fade on top,
// so these values are the only thing standing between "locked" and "invisible".
export const LOCKED: { light: IconColors; dark: IconColors } = {
  light: { stroke: 'rgba(13,27,42,0.45)', fill: 'rgba(13,27,42,0.10)' },
  dark:  { stroke: 'rgba(255,255,255,0.40)', fill: 'rgba(255,255,255,0.08)' },
}
