export interface ExpressAchievement {
  key: string
  name: string
  emoji: string
  desc: string
}

// The 8 express-relevant achievements (defence + cert + share).
export const EXPRESS_ACHIEVEMENTS: ExpressAchievement[] = [
  { key: 'defense_ready', name: 'Defense Ready',  emoji: '🛡️', desc: 'Ran your first Express defence session' },
  { key: 'certified',     name: 'Certified',      emoji: '🎓', desc: 'Earned a certificate (score 7+)' },
  { key: 'sharp_mind',    name: 'Sharp Mind',     emoji: '🎯', desc: 'Scored 8 or higher' },
  { key: 'excellence',    name: 'Excellence',     emoji: '⭐', desc: 'Scored 9 or higher' },
  { key: 'perfectionist', name: 'Perfectionist',  emoji: '💎', desc: 'Scored a perfect 10/10' },
  { key: 'persistent',    name: 'Persistent',     emoji: '🔄', desc: 'Ran the simulator 3 times' },
  { key: 'never_give_up', name: 'Never Give Up',  emoji: '💪', desc: 'Ran again after scoring below 7' },
  { key: 'shared',        name: 'Shared',         emoji: '📤', desc: 'Shared your certificate' },
]

export const EXPRESS_ACHIEVEMENT_KEYS = new Set(EXPRESS_ACHIEVEMENTS.map(a => a.key))
