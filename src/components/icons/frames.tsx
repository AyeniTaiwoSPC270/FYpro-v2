import type { Tier } from './types'

// Renders the medallion frame + its gradient <defs> on a 48×48 grid.
// `uid` scopes gradient ids so multiple badges on a page don't collide.
export function HexFrame({ tier, uid, earned }: { tier: Tier; uid: string; earned: boolean }) {
  const blue = `grad-blue-${uid}`
  const gold = `grad-gold-${uid}`
  const HEX = '24,3 42,13 42,35 24,45 6,35 6,13'
  return (
    <>
      <defs>
        <linearGradient id={blue} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3B82F6" />
          <stop offset="1" stopColor="#0066FF" />
        </linearGradient>
        <linearGradient id={gold} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#FCD980" />
          <stop offset="1" stopColor="#D99B2B" />
        </linearGradient>
      </defs>
      {tier === 'elite' ? (
        <>
          <polygon points={HEX} fill="rgba(217,155,43,0.14)" />
          <polygon points={HEX} fill="none" stroke={earned ? `url(#${gold})` : '#7C8AA0'} strokeWidth="2.2" />
          <polygon points="24,6 39,14.5 39,33.5 24,42 9,33.5 9,14.5" fill="none" stroke="rgba(252,217,128,0.35)" strokeWidth="0.8" />
        </>
      ) : (
        <>
          <polygon points={HEX} fill="rgba(0,102,255,0.10)" />
          <polygon points={HEX} fill="none" stroke={earned ? `url(#${blue})` : '#7C8AA0'} strokeWidth="2.2" />
        </>
      )}
    </>
  )
}
