// Visual preview of the shareable defense result card.
// The actual PNG is rendered server-side by /api/share-card.
// This component shows the same design in-app for preview — one
// sub-component per style, mirroring api/share-card.js's build functions.

import DarkPremiumCard from './cards/DarkPremiumCard'
import ScoreboardCard from './cards/ScoreboardCard'

export default function DefenseShareCard({ score, scoreLabel, topic, style = 'dark' }) {
  if (style === 'scoreboard') {
    return <ScoreboardCard score={score} scoreLabel={scoreLabel} topic={topic} />
  }
  if (style === 'prestige') {
    // added in a later task
  }
  return <DarkPremiumCard score={score} scoreLabel={scoreLabel} topic={topic} />
}
