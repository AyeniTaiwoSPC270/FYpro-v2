import type { ReactElement } from 'react'
import type { GlyphName } from './types'

// 24×24 grid. Paint is set via `style` (NOT presentation attributes) so the
// `var(--gl-stroke)` / `var(--gl-fill)` custom properties — defined on the
// parent <g> in AchievementBadge — actually resolve. `var()` only works in CSS
// declarations, never in raw SVG presentation attributes.
export const GLYPHS: Record<GlyphName, ReactElement> = {
  shield: (
    <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.6" strokeLinejoin="round" />
  ),
  cap: (
    <>
      <path d="M2 8l10-4 10 4-10 4L2 8z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 10.4V15c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-4.6" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M22 8v5" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.5" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.2" style={{ fill: 'var(--gl-stroke)' }} />
    </>
  ),
  flame: (
    <path d="M12 3c1.4 3.2 4.4 5 4.4 8.8a4.4 4.4 0 0 1-8.8 0c0-1.8.6-2.9 1.7-3.9C10.3 9 9 7.2 12 3z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.5" strokeLinejoin="round" />
  ),
  seedling: (
    <>
      <path d="M12 21v-8" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 14c0-3-2-5.2-5.2-5.2C6.8 12 8.8 14 12 14z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 12c0-2.6 2-4.8 4.8-4.8C16.8 10 14.8 12 12 12z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
  halfRing: (
    <>
      <circle cx="12" cy="12" r="8" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.6" opacity="0.4" />
      <path d="M12 4a8 8 0 0 1 0 16z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.6" strokeLinejoin="round" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 2c3.2 2.2 4.8 5.4 4.8 9.2L14.5 14h-5L7.2 11.2C7.2 7.4 8.8 4.2 12 2z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="1.8" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.3" />
      <path d="M9.5 14l-2.2 2.6 2.8-.8M14.5 14l2.2 2.6-2.8-.8" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M11 19l1 2 1-2" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  stopwatch: (
    <>
      <circle cx="12" cy="13.5" r="7.5" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.5" />
      <path d="M12 13.5l3.2-3.2" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.5 3h5M12 3v3" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  flag: (
    <>
      <path d="M6 21V4" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 5h11l-2.2 3L17 11H6z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
  star: (
    <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8L12 3z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" strokeLinejoin="round" />
  ),
  diamond: (
    <>
      <path d="M7 8h10l3 4-8 10-8-10 3-4z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4 12h16M12 8v14" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="0.9" opacity="0.85" />
    </>
  ),
  loop: (
    <>
      <path d="M4 12a8 8 0 0 1 13-6.2" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 2v4h-4" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12a8 8 0 0 1-13 6.2" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 22v-4h4" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  comeback: (
    <>
      <path d="M3 20h18" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" opacity="0.5" strokeLinecap="round" />
      <path d="M4 18l5-6 4 3 6-9" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6h5v5" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10.5v3l9 3.5V7l-9 3.5z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M13 8.5a3.5 3.5 0 0 1 0 7" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 14v3.5a1.5 1.5 0 0 0 3 0V15" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  network: (
    <>
      <path d="M8.5 8.5l7 2M8.5 8.5l3.5 7M15.5 10.5l-3.5 5" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.3" opacity="0.7" />
      <circle cx="8.5" cy="8.5" r="2.6" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" />
      <circle cx="15.5" cy="10.5" r="2.6" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" />
      <circle cx="12" cy="16.5" r="2.6" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 5.5H5v2a3 3 0 0 0 3 3M16 5.5h3v2a3 3 0 0 1-3 3" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.3" />
      <path d="M12 12v4M9 20h6M10 16h4v4h-4z" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
  share: (
    <>
      <path d="M12 3v11" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.5 6.5L12 3l3.5 3.5" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 11H5.5v8h13v-8H17" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  moon: (
    <>
      <path d="M20 14a8 8 0 1 1-8-11 6.2 6.2 0 0 0 8 11z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18 4l.7 1.5L20 6l-1.3.6-.7 1.4-.6-1.4L16 6l1.4-.5L18 4z" style={{ fill: 'var(--gl-stroke)' }} />
    </>
  ),
  sunrise: (
    <>
      <path d="M7 17a5 5 0 0 1 10 0z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3 17h18" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 5v2.5M5.5 9l1.4 1.4M18.5 9l-1.4 1.4" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  bell: (
    <>
      <path d="M12 3a5 5 0 0 0-5 5c0 5.2-2 6.7-2 6.7h14s-2-1.5-2-6.7a5 5 0 0 0-5-5z" style={{ fill: 'var(--gl-fill)', stroke: 'var(--gl-stroke)' }} strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M9.5 17.5a2.5 2.5 0 0 0 5 0" style={{ fill: 'none', stroke: 'var(--gl-stroke)' }} strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
}
