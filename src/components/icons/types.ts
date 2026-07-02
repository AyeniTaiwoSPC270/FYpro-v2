// Central type vocabulary for the FYPro icon system.
export type Tier = 'standard' | 'rare' | 'elite'

export type GlyphName =
  | 'shield' | 'cap' | 'target' | 'flame' | 'seedling' | 'halfRing'
  | 'rocket' | 'stopwatch' | 'flag' | 'star' | 'diamond' | 'loop'
  | 'comeback' | 'megaphone' | 'network' | 'trophy' | 'share'
  | 'moon' | 'sunrise' | 'bell'

export type AchievementKey =
  | 'first_step' | 'halfway' | 'defense_ready' | 'certified'
  | 'fast_starter' | 'sprint' | 'speed_run'
  | 'sharp_mind' | 'excellence' | 'perfectionist' | 'persistent' | 'never_give_up'
  | 'ambassador' | 'connector' | 'earned_it' | 'shared'
  | 'night_owl' | 'early_bird' | 'dedicated'

export interface IconColors {
  stroke: string
  fill: string
}
