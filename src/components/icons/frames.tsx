import type { Tier } from './types'

// Renders the medallion frame + its gradient <defs> on a 48×48 grid.
// `uid` scopes the gradient id so multiple badges on a page don't collide.
// Only the gradient actually used is emitted, and only when earned (a locked
// badge uses a flat desaturated stroke, so no gradient is needed).
export function HexFrame({ tier, uid, earned }: { tier: Tier; uid: string; earned: boolean }) {
  const isElite = tier === 'elite'
  const gradId = `grad-${uid}`
  const HEX = '24,3 42,13 42,35 24,45 6,35 6,13'
  const ringStroke = earned ? `url(#${gradId})` : '#7C8AA0'
  return (
    <>
      {earned && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            {isElite ? (
              <>
                <stop offset="0" stopColor="#FCD980" />
                <stop offset="1" stopColor="#D99B2B" />
              </>
            ) : (
              <>
                <stop offset="0" stopColor="#3B82F6" />
                <stop offset="1" stopColor="#0066FF" />
              </>
            )}
          </linearGradient>
        </defs>
      )}
      <polygon points={HEX} fill={isElite ? 'rgba(217,155,43,0.14)' : 'rgba(0,102,255,0.10)'} />
      <polygon points={HEX} fill="none" stroke={ringStroke} strokeWidth="2.2" />
      {isElite && (
        <polygon points="24,6 39,14.5 39,33.5 24,42 9,33.5 9,14.5" fill="none" stroke="rgba(252,217,128,0.35)" strokeWidth="0.8" />
      )}
    </>
  )
}
