export interface ExpressAchievement {
  key: string
  name: string
  desc: string
}

// The 8 express-relevant achievements (defence + cert + share).
export const EXPRESS_ACHIEVEMENTS: ExpressAchievement[] = [
  { key: 'defense_ready', name: 'Defense Ready',  desc: 'Ran your first Express defence session' },
  { key: 'certified',     name: 'Certified',      desc: 'Earned a certificate (score 7+)' },
  { key: 'sharp_mind',    name: 'Sharp Mind',     desc: 'Scored 8 or higher' },
  { key: 'excellence',    name: 'Excellence',     desc: 'Scored 9 or higher' },
  { key: 'perfectionist', name: 'Perfectionist',  desc: 'Scored a perfect 10/10' },
  { key: 'persistent',    name: 'Persistent',     desc: 'Ran the simulator 3 times' },
  { key: 'never_give_up', name: 'Never Give Up',  desc: 'Ran again after scoring below 7' },
  { key: 'shared',        name: 'Shared',         desc: 'Shared your certificate' },
]

export const EXPRESS_ACHIEVEMENT_KEYS = new Set(EXPRESS_ACHIEVEMENTS.map(a => a.key))
