import { describe, it, expect } from 'vitest'
import { ACHIEVEMENT_ICONS, getAchievementIcon } from './achievementIcons'
import { GLYPHS } from './glyphs'

const KEYS = [
  'first_step', 'halfway', 'defense_ready', 'certified',
  'fast_starter', 'sprint', 'speed_run',
  'sharp_mind', 'excellence', 'perfectionist', 'persistent', 'never_give_up',
  'ambassador', 'connector', 'earned_it', 'shared',
  'night_owl', 'early_bird', 'dedicated',
]

describe('ACHIEVEMENT_ICONS', () => {
  it('maps exactly the 19 achievement keys', () => {
    expect(Object.keys(ACHIEVEMENT_ICONS).sort()).toEqual([...KEYS].sort())
  })
  it('has the agreed tier distribution (6 elite / 8 rare / 5 standard)', () => {
    const count = (t: string) => Object.values(ACHIEVEMENT_ICONS).filter(v => v.tier === t).length
    expect(count('elite')).toBe(6)
    expect(count('rare')).toBe(8)
    expect(count('standard')).toBe(5)
  })
  it('every mapped glyph exists in the glyph registry', () => {
    Object.values(ACHIEVEMENT_ICONS).forEach(v => {
      expect(GLYPHS[v.glyph]).toBeTruthy()
    })
  })
  it('falls back to a valid glyph/tier for unknown keys', () => {
    const fallback = getAchievementIcon('does_not_exist')
    expect(GLYPHS[fallback.glyph]).toBeTruthy()
    expect(fallback.tier).toBe('standard')
  })
})
