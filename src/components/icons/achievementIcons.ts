import type { AchievementKey, GlyphName, Tier } from './types'

// SINGLE SOURCE OF TRUTH for which glyph + tier each achievement uses.
// Read by Achievements.jsx, AchievementsRow.jsx and ExpressAchievements.jsx.
export const ACHIEVEMENT_ICONS: Record<AchievementKey, { glyph: GlyphName; tier: Tier }> = {
  // Milestone
  first_step:    { glyph: 'seedling', tier: 'standard' },
  halfway:       { glyph: 'halfRing',  tier: 'standard' },
  defense_ready: { glyph: 'shield',    tier: 'elite' },
  certified:     { glyph: 'cap',       tier: 'elite' },
  // Speed
  fast_starter:  { glyph: 'rocket',    tier: 'standard' },
  sprint:        { glyph: 'stopwatch', tier: 'rare' },
  speed_run:     { glyph: 'flag',      tier: 'elite' },
  // Effort
  sharp_mind:    { glyph: 'target',    tier: 'rare' },
  excellence:    { glyph: 'star',      tier: 'elite' },
  perfectionist: { glyph: 'diamond',   tier: 'elite' },
  persistent:    { glyph: 'loop',      tier: 'rare' },
  never_give_up: { glyph: 'comeback',  tier: 'rare' },
  // Social
  ambassador:    { glyph: 'megaphone', tier: 'standard' },
  connector:     { glyph: 'network',   tier: 'rare' },
  earned_it:     { glyph: 'trophy',    tier: 'elite' },
  shared:        { glyph: 'share',     tier: 'standard' },
  // Hidden
  night_owl:     { glyph: 'moon',      tier: 'rare' },
  early_bird:    { glyph: 'sunrise',   tier: 'rare' },
  dedicated:     { glyph: 'flame',     tier: 'rare' },
}

const FALLBACK = { glyph: 'star' as GlyphName, tier: 'standard' as Tier }

// Safe lookup — never throws, so unknown keys degrade gracefully.
export function getAchievementIcon(key: string): { glyph: GlyphName; tier: Tier } {
  return ACHIEVEMENT_ICONS[key as AchievementKey] ?? FALLBACK
}
