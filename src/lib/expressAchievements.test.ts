import { describe, it, expect } from 'vitest'
import { EXPRESS_ACHIEVEMENT_KEYS, EXPRESS_ACHIEVEMENTS } from './expressAchievements'

describe('express achievement catalog', () => {
  it('has exactly the 8 agreed keys', () => {
    expect([...EXPRESS_ACHIEVEMENT_KEYS].sort()).toEqual([
      'certified', 'defense_ready', 'excellence', 'never_give_up',
      'perfectionist', 'persistent', 'shared', 'sharp_mind',
    ])
  })
  it('every catalog entry has name + emoji + desc', () => {
    EXPRESS_ACHIEVEMENTS.forEach(a => {
      expect(a.key).toBeTruthy()
      expect(a.name).toBeTruthy()
      expect(a.emoji).toBeTruthy()
      expect(a.desc).toBeTruthy()
    })
  })
  it('excludes 6-step + referral keys', () => {
    ;['first_step', 'halfway', 'fast_starter', 'sprint', 'speed_run',
      'ambassador', 'connector', 'earned_it', 'night_owl', 'early_bird', 'dedicated']
      .forEach(k => expect(EXPRESS_ACHIEVEMENT_KEYS.has(k)).toBe(false))
  })
})
