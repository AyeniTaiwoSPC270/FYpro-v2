# Custom Icon & Badge System — Phase 1 (Achievements) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the emoji achievement icons (19 main + 8 Express) with an owned duotone SVG glyph set, using blue/gold hexagon medallion frames for Rare/Elite tiers, delivered as React SVG components.

**Architecture:** A new `src/components/icons/` module holds a glyph registry (`glyphs.tsx`, 24-grid duotone paths coloured via CSS custom properties), tier palettes (`tokens.ts`), the single source-of-truth achievement→glyph/tier map (`achievementIcons.ts`), a hexagon `HexFrame` (`frames.tsx`), and the `AchievementBadge` wrapper. Existing consumers (`Achievements.jsx`, `AchievementsRow.jsx`, `ExpressAchievements.jsx`, `expressAchievements.ts`) drop their `emoji` fields and render `<AchievementBadge>` by looking up glyph + tier from the central map. `DefenseReadyBadge.jsx` re-homes its shield to the shared glyph.

**Tech Stack:** React 19, framer-motion (already present, unchanged), vitest (node env — data-layer tests only), Vite. No new dependencies.

**Spec:** `docs/architecture/2026-07-02-custom-icon-badge-system-design.md`

**Testing note:** The vitest environment is `node` with no jsdom/RTL, so React components are **not** unit-tested (matches the repo's existing style). Tests cover the pure data layer (glyph registry, achievement map, Express catalog). Components are verified by `npm run typecheck` and in-browser checks in **both light and dark mode**.

**Out of scope (later phases):** Chrome icons / top bar (`_shared.jsx`, `DashTopBar`), step-navigator re-home (`StepBadge`), rank badges (`useRank`), removal of the generic `public/icons/icons.svg`, and any minor editorial-emoji cleanup. Do not touch these here.

---

## File Structure

**Create:**
- `src/components/icons/types.ts` — `Tier`, `GlyphName`, `AchievementKey` type unions.
- `src/components/icons/tokens.ts` — `TIER_COLORS`, `LOCKED` palettes (light + dark).
- `src/components/icons/glyphs.tsx` — `GLYPHS` registry (19 duotone glyphs, 24-grid).
- `src/components/icons/achievementIcons.ts` — `ACHIEVEMENT_ICONS` map + `getAchievementIcon()`.
- `src/components/icons/frames.tsx` — `HexFrame` medallion component.
- `src/components/icons/AchievementBadge.jsx` — the wrapper component.
- `src/components/icons/index.ts` — barrel exports.
- `src/components/icons/glyphs.test.ts` — glyph registry contract test.
- `src/components/icons/achievementIcons.test.ts` — achievement map contract test.

**Modify:**
- `src/lib/expressAchievements.ts` — drop `emoji` field.
- `src/lib/expressAchievements.test.ts` — update assertions (no `emoji`).
- `src/pages/account/Achievements.jsx` — render `<AchievementBadge>` in `AchCard`.
- `src/components/badges/AchievementsRow.jsx` — render `<AchievementBadge>` in `AchievementChip`.
- `src/pages/ExpressAchievements.jsx` — render `<AchievementBadge>` in its `AchCard`.
- `src/components/badges/DefenseReadyBadge.jsx` — re-home shield to shared glyph.

---

## Task 1: Types and tier palettes

**Files:**
- Create: `src/components/icons/types.ts`
- Create: `src/components/icons/tokens.ts`

- [ ] **Step 1: Create the type unions**

Create `src/components/icons/types.ts`:

```ts
// Central type vocabulary for the FYPro icon system.
export type Tier = 'standard' | 'rare' | 'elite'

export type GlyphName =
  | 'shield' | 'cap' | 'target' | 'flame' | 'seedling' | 'halfRing'
  | 'rocket' | 'stopwatch' | 'flag' | 'star' | 'diamond' | 'loop'
  | 'comeback' | 'megaphone' | 'network' | 'trophy' | 'share'
  | 'moon' | 'sunrise'

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
```

- [ ] **Step 2: Create the tier palettes**

Create `src/components/icons/tokens.ts`:

```ts
import type { Tier, IconColors } from './types'

// Duotone colours per tier, per theme. `fill` is a translucent tint over the
// card background so it adapts to light/dark automatically; `stroke` is solid.
export const TIER_COLORS: Record<Tier, { light: IconColors; dark: IconColors }> = {
  standard: {
    light: { stroke: '#0066FF', fill: 'rgba(0,102,255,0.28)' },
    dark:  { stroke: '#3B82F6', fill: 'rgba(0,102,255,0.28)' },
  },
  rare: {
    light: { stroke: '#0066FF', fill: 'rgba(0,102,255,0.30)' },
    dark:  { stroke: '#8FB8FF', fill: 'rgba(0,102,255,0.30)' },
  },
  elite: {
    light: { stroke: '#C6871F', fill: 'rgba(252,217,128,0.28)' },
    dark:  { stroke: '#FCD980', fill: 'rgba(252,217,128,0.22)' },
  },
}

// Applied when a badge is not yet earned (in addition to a grayscale filter).
export const LOCKED: { light: IconColors; dark: IconColors } = {
  light: { stroke: 'rgba(13,27,42,0.30)', fill: 'rgba(13,27,42,0.06)' },
  dark:  { stroke: 'rgba(255,255,255,0.30)', fill: 'rgba(255,255,255,0.05)' },
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS (no errors from the two new files).

- [ ] **Step 4: Commit**

```bash
git add src/components/icons/types.ts src/components/icons/tokens.ts
git commit -m "feat(icons): add icon system types and tier palettes"
```

---

## Task 2: Glyph registry

**Files:**
- Create: `src/components/icons/glyphs.tsx`
- Test: `src/components/icons/glyphs.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/icons/glyphs.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { GLYPHS } from './glyphs'
import type { GlyphName } from './types'

const ALL_GLYPHS: GlyphName[] = [
  'shield', 'cap', 'target', 'flame', 'seedling', 'halfRing',
  'rocket', 'stopwatch', 'flag', 'star', 'diamond', 'loop',
  'comeback', 'megaphone', 'network', 'trophy', 'share', 'moon', 'sunrise',
]

describe('GLYPHS registry', () => {
  it('defines all 19 named glyphs', () => {
    expect(Object.keys(GLYPHS).sort()).toEqual([...ALL_GLYPHS].sort())
  })
  it('every glyph is a defined React element', () => {
    ALL_GLYPHS.forEach(name => {
      expect(GLYPHS[name]).toBeTruthy()
    })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/icons/glyphs.test.ts`
Expected: FAIL — cannot resolve `./glyphs`.

- [ ] **Step 3: Create the glyph registry**

Create `src/components/icons/glyphs.tsx`. Every glyph is authored on a 24×24 grid and coloured via the CSS custom properties `--gl-stroke` / `--gl-fill` set by `AchievementBadge` on the parent `<g>`.

```tsx
import type { ReactElement } from 'react'
import type { GlyphName } from './types'

// 24×24 grid. `var(--gl-stroke)` / `var(--gl-fill)` are set by the parent <g>.
export const GLYPHS: Record<GlyphName, ReactElement> = {
  shield: (
    <path d="M12 3l7 3v5c0 4.5-3 7.6-7 9-4-1.4-7-4.5-7-9V6l7-3z" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.6" strokeLinejoin="round" />
  ),
  cap: (
    <>
      <path d="M2 8l10-4 10 4-10 4L2 8z" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M6 10.4V15c0 1.4 2.7 2.6 6 2.6s6-1.2 6-2.6v-4.6" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M22 8v5" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  target: (
    <>
      <circle cx="12" cy="12" r="8.5" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="4.5" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.6" />
      <circle cx="12" cy="12" r="1.2" fill="var(--gl-stroke)" />
    </>
  ),
  flame: (
    <path d="M12 3c1.4 3.2 4.4 5 4.4 8.8a4.4 4.4 0 0 1-8.8 0c0-1.8.6-2.9 1.7-3.9C10.3 9 9 7.2 12 3z" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.5" strokeLinejoin="round" />
  ),
  seedling: (
    <>
      <path d="M12 21v-8" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M12 14c0-3-2-5.2-5.2-5.2C6.8 12 8.8 14 12 14z" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M12 12c0-2.6 2-4.8 4.8-4.8C16.8 10 14.8 12 12 12z" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
  halfRing: (
    <>
      <circle cx="12" cy="12" r="8" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.6" opacity="0.4" />
      <path d="M12 4a8 8 0 0 1 0 16z" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.6" strokeLinejoin="round" />
    </>
  ),
  rocket: (
    <>
      <path d="M12 2c3.2 2.2 4.8 5.4 4.8 9.2L14.5 14h-5L7.2 11.2C7.2 7.4 8.8 4.2 12 2z" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.4" strokeLinejoin="round" />
      <circle cx="12" cy="9.5" r="1.8" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.3" />
      <path d="M9.5 14l-2.2 2.6 2.8-.8M14.5 14l2.2 2.6-2.8-.8" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.3" strokeLinejoin="round" />
      <path d="M11 19l1 2 1-2" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.3" strokeLinecap="round" />
    </>
  ),
  stopwatch: (
    <>
      <circle cx="12" cy="13.5" r="7.5" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.5" />
      <path d="M12 13.5l3.2-3.2" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M9.5 3h5M12 3v3" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.5" strokeLinecap="round" />
    </>
  ),
  flag: (
    <>
      <path d="M6 21V4" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M6 5h11l-2.2 3L17 11H6z" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
  star: (
    <path d="M12 3l2.6 5.6 6 .8-4.4 4.2 1.1 6L12 16.8 6.7 19.6l1.1-6L3.4 9.4l6-.8L12 3z" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.4" strokeLinejoin="round" />
  ),
  diamond: (
    <>
      <path d="M7 8h10l3 4-8 10-8-10 3-4z" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M4 12h16M12 8v14" fill="none" stroke="var(--gl-stroke)" strokeWidth="0.9" opacity="0.85" />
    </>
  ),
  loop: (
    <>
      <path d="M4 12a8 8 0 0 1 13-6.2" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M17 2v4h-4" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M20 12a8 8 0 0 1-13 6.2" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M7 22v-4h4" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  comeback: (
    <>
      <path d="M3 20h18" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.4" opacity="0.5" strokeLinecap="round" />
      <path d="M4 18l5-6 4 3 6-9" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M15 6h5v5" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  megaphone: (
    <>
      <path d="M4 10.5v3l9 3.5V7l-9 3.5z" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M13 8.5a3.5 3.5 0 0 1 0 7" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.4" strokeLinecap="round" />
      <path d="M6 14v3.5a1.5 1.5 0 0 0 3 0V15" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
  network: (
    <>
      <path d="M8.5 8.5l7 2M8.5 8.5l3.5 7M15.5 10.5l-3.5 5" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.3" opacity="0.7" />
      <circle cx="8.5" cy="8.5" r="2.6" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.4" />
      <circle cx="15.5" cy="10.5" r="2.6" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.4" />
      <circle cx="12" cy="16.5" r="2.6" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.4" />
    </>
  ),
  trophy: (
    <>
      <path d="M8 4h8v4a4 4 0 0 1-8 0V4z" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.4" strokeLinejoin="round" />
      <path d="M8 5.5H5v2a3 3 0 0 0 3 3M16 5.5h3v2a3 3 0 0 1-3 3" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.3" />
      <path d="M12 12v4M9 20h6M10 16h4v4h-4z" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.4" strokeLinejoin="round" />
    </>
  ),
  share: (
    <>
      <path d="M12 3v11" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.6" strokeLinecap="round" />
      <path d="M8.5 6.5L12 3l3.5 3.5" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M7 11H5.5v8h13v-8H17" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </>
  ),
  moon: (
    <>
      <path d="M20 14a8 8 0 1 1-8-11 6.2 6.2 0 0 0 8 11z" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M18 4l.7 1.5L20 6l-1.3.6-.7 1.4-.6-1.4L16 6l1.4-.5L18 4z" fill="var(--gl-stroke)" />
    </>
  ),
  sunrise: (
    <>
      <path d="M7 17a5 5 0 0 1 10 0z" fill="var(--gl-fill)" stroke="var(--gl-stroke)" strokeWidth="1.5" strokeLinejoin="round" />
      <path d="M3 17h18" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M12 5v2.5M5.5 9l1.4 1.4M18.5 9l-1.4 1.4" fill="none" stroke="var(--gl-stroke)" strokeWidth="1.4" strokeLinecap="round" />
    </>
  ),
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/icons/glyphs.test.ts`
Expected: PASS (both tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/icons/glyphs.tsx src/components/icons/glyphs.test.ts
git commit -m "feat(icons): add 19-glyph duotone registry"
```

---

## Task 3: Achievement → glyph/tier map

**Files:**
- Create: `src/components/icons/achievementIcons.ts`
- Test: `src/components/icons/achievementIcons.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/components/icons/achievementIcons.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/components/icons/achievementIcons.test.ts`
Expected: FAIL — cannot resolve `./achievementIcons`.

- [ ] **Step 3: Create the map**

Create `src/components/icons/achievementIcons.ts`:

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/components/icons/achievementIcons.test.ts`
Expected: PASS (all four tests green).

- [ ] **Step 5: Commit**

```bash
git add src/components/icons/achievementIcons.ts src/components/icons/achievementIcons.test.ts
git commit -m "feat(icons): add achievement glyph/tier map"
```

---

## Task 4: Hexagon medallion frame

**Files:**
- Create: `src/components/icons/frames.tsx`

This is a presentational SVG component; verified via typecheck + browser (no unit test).

- [ ] **Step 1: Create the frame component**

Create `src/components/icons/frames.tsx`:

```tsx
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
```

- [ ] **Step 2: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add src/components/icons/frames.tsx
git commit -m "feat(icons): add hexagon medallion frame"
```

---

## Task 5: AchievementBadge wrapper + barrel

**Files:**
- Create: `src/components/icons/AchievementBadge.jsx`
- Create: `src/components/icons/index.ts`

Presentational component; verified via typecheck + browser.

- [ ] **Step 1: Create the badge component**

Create `src/components/icons/AchievementBadge.jsx`:

```jsx
import { useId } from 'react'
import { useTheme } from '../../context/ThemeContext'
import { GLYPHS } from './glyphs'
import { TIER_COLORS, LOCKED } from './tokens'
import { HexFrame } from './frames'

// Renders one achievement badge: a duotone glyph, framed with a hex medallion
// for rare/elite tiers. Locked (earned=false) badges desaturate + fade.
export default function AchievementBadge({
  glyph,
  tier = 'standard',
  earned = true,
  size = 48,
  title,
}) {
  const { theme } = useTheme()
  const mode = theme === 'light' ? 'light' : 'dark'
  const uid = useId().replace(/:/g, '')

  const palette = earned ? TIER_COLORS[tier][mode] : LOCKED[mode]
  const framed = tier !== 'standard'
  // Glyphs are drawn on a 24 grid. Framed → shrink to sit inside the hex;
  // standard → scale up to fill the 48 box.
  const transform = framed ? 'translate(16.5,16.5) scale(0.62)' : 'translate(4,4) scale(1.6667)'
  const eliteGlow = earned && tier === 'elite'

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={title || glyph}
      style={{
        filter: !earned
          ? 'grayscale(1)'
          : eliteGlow
          ? 'drop-shadow(0 0 6px rgba(217,155,43,0.45))'
          : 'none',
        opacity: earned ? 1 : 0.4,
        flexShrink: 0,
      }}
    >
      {framed && <HexFrame tier={tier} uid={uid} earned={earned} />}
      <g transform={transform} style={{ '--gl-stroke': palette.stroke, '--gl-fill': palette.fill }}>
        {GLYPHS[glyph]}
      </g>
    </svg>
  )
}
```

- [ ] **Step 2: Create the barrel**

Create `src/components/icons/index.ts`:

```ts
export { default as AchievementBadge } from './AchievementBadge'
export { GLYPHS } from './glyphs'
export { ACHIEVEMENT_ICONS, getAchievementIcon } from './achievementIcons'
export { TIER_COLORS, LOCKED } from './tokens'
export { HexFrame } from './frames'
export type { Tier, GlyphName, AchievementKey, IconColors } from './types'
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add src/components/icons/AchievementBadge.jsx src/components/icons/index.ts
git commit -m "feat(icons): add AchievementBadge component + barrel"
```

---

## Task 6: Integrate into the Achievements page

**Files:**
- Modify: `src/pages/account/Achievements.jsx`

- [ ] **Step 1: Add imports**

At the top of `src/pages/account/Achievements.jsx`, below the existing imports (after the `useTheme` import on line 4), add:

```jsx
import AchievementBadge from '../../components/icons/AchievementBadge'
import { getAchievementIcon } from '../../components/icons/achievementIcons'
```

- [ ] **Step 2: Remove the `emoji` fields from `ACHIEVEMENT_DEFS`**

In the `ACHIEVEMENT_DEFS` array (lines 6–31), delete the `emoji: '…',` property from every one of the 19 entries. Keep `key`, `name`, `desc`, `cat`, `hidden`. Example — the first entry becomes:

```jsx
  { key: 'first_step',    name: 'First Step',          desc: 'Completed Topic Validator for the first time',                    cat: 'Milestone', hidden: false },
```

Apply the same deletion to all 19 rows.

- [ ] **Step 3: Replace the emoji box in `AchCard`**

In `AchCard`, replace the icon `<div>` (currently lines 52–60, the block that renders `{!earned && def.hidden ? '?' : def.emoji}`) with this. Add `const ICON = getAchievementIcon(def.key)` just inside `AchCard` before the `return` (after the `showLabel` line):

```jsx
function AchCard({ def, earned, isDark }) {
  const showLabel = !def.hidden || earned
  const ICON = getAchievementIcon(def.key)
  return (
    <div style={{
      /* ...unchanged wrapper styles... */
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        {(!earned && def.hidden) ? (
          <div style={{
            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
            background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
            color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.4)',
          }}>?</div>
        ) : (
          <AchievementBadge glyph={ICON.glyph} tier={ICON.tier} earned={earned} size={44} title={def.name} />
        )}
        {/* ...unchanged name <p> and earned ✓ chip... */}
```

Leave the rest of `AchCard` (the name `<p>`, the earned `✓` chip, the description `<p>`) exactly as-is.

- [ ] **Step 4: Typecheck + full test run**

Run: `npm run typecheck && npm run test`
Expected: PASS (no new failures).

- [ ] **Step 5: Visual check**

Run `npm run dev`, open `/account/achievements` in **both light and dark mode**. Confirm: earned badges show duotone glyphs; elite badges show gold hex + glow; rare show blue hex; hidden-unearned still show `?`; grid layout unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/pages/account/Achievements.jsx
git commit -m "feat(icons): render AchievementBadge on the Achievements page"
```

---

## Task 7: Integrate into the dashboard AchievementsRow

**Files:**
- Modify: `src/components/badges/AchievementsRow.jsx`

- [ ] **Step 1: Add imports and drop `emoji` from the local list**

At the top of `src/components/badges/AchievementsRow.jsx`, after the existing imports, add:

```jsx
import AchievementBadge from '../icons/AchievementBadge'
import { getAchievementIcon } from '../icons/achievementIcons'
```

In `ALL_ACHIEVEMENTS` (lines 12–32), delete the `emoji: '…',` property from all 19 entries, keeping `key`, `label`, `hidden`.

- [ ] **Step 2: Update the catalog normalization**

In `AchievementsRow`, the `defs` normalization currently copies `emoji`. Replace it (around lines 144–149) with:

```jsx
  const defs = (catalog ?? ALL_ACHIEVEMENTS).map(a => ({
    key: a.key,
    label: a.label ?? a.name,
    hidden: a.hidden ?? false,
  }))
```

- [ ] **Step 3: Replace the emoji inside `AchievementChip`**

In `AchievementChip`, replace the emoji-rendering `motion.div` (lines 73–96) so the chip renders a badge for earned/visible items and keeps the `?` circle only for hidden-unearned. The `ref`, hover/touch tooltip handlers, and outer structure stay:

```jsx
  const ICON = getAchievementIcon(def.key)
  const showMystery = def.hidden && !earned

  return (
    <>
      <motion.div
        ref={ref}
        onMouseEnter={() => { if (wasTouchRef.current) return; capture(); setVisible(true) }}
        onMouseLeave={() => { if (wasTouchRef.current) { wasTouchRef.current = false; return } setVisible(false) }}
        onTouchStart={handleTouchStart}
        animate={earned ? { scale: [1, 1.2, 1] } : {}}
        transition={{ duration: 0.5 }}
        style={{
          width: 36, height: 36, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          cursor: 'default',
          borderRadius: showMystery ? '50%' : 0,
          background: showMystery ? (isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)') : 'transparent',
          border: showMystery ? (isLight ? '1.5px solid rgba(13,27,42,0.1)' : '1.5px solid rgba(255,255,255,0.08)') : 'none',
          opacity: showMystery ? 0.35 : 1,
        }}
      >
        {showMystery
          ? <span style={{ fontSize: '1rem', color: isLight ? 'rgba(13,27,42,0.4)' : 'rgba(255,255,255,0.4)' }}>?</span>
          : <AchievementBadge glyph={ICON.glyph} tier={ICON.tier} earned={earned} size={36} title={def.label} />}
      </motion.div>

      {/* ...unchanged tooltip portal... */}
```

Add `const ICON = getAchievementIcon(def.key)` and `const showMystery = def.hidden && !earned` at the top of `AchievementChip` (before the `label` const). Leave the tooltip `createPortal` block unchanged.

- [ ] **Step 4: Typecheck + full test run**

Run: `npm run typecheck && npm run test`
Expected: PASS.

- [ ] **Step 5: Visual check**

Open `/dashboard` (main) in light + dark. Confirm the achievements row shows the new badges, the `earned` scale-pop still fires, hidden-unearned show `?`, and horizontal scroll still works.

- [ ] **Step 6: Commit**

```bash
git add src/components/badges/AchievementsRow.jsx
git commit -m "feat(icons): render AchievementBadge in dashboard achievements row"
```

---

## Task 8: Integrate Express (catalog, page, test)

**Files:**
- Modify: `src/lib/expressAchievements.ts`
- Modify: `src/lib/expressAchievements.test.ts`
- Modify: `src/pages/ExpressAchievements.jsx`

- [ ] **Step 1: Update the failing test first**

Edit `src/lib/expressAchievements.test.ts`. Replace the second test (the `name + emoji + desc` one) so it no longer expects `emoji`:

```ts
  it('every catalog entry has name + desc', () => {
    EXPRESS_ACHIEVEMENTS.forEach(a => {
      expect(a.key).toBeTruthy()
      expect(a.name).toBeTruthy()
      expect(a.desc).toBeTruthy()
    })
  })
```

Leave the other two tests (the key list, and the exclusions) unchanged.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/lib/expressAchievements.test.ts`
Expected: FAIL — `EXPRESS_ACHIEVEMENTS` still carries `emoji`, but the source still compiles; the failure appears once Step 3 removes `emoji` and TypeScript/consumers reference it. To force a clean red→green, run this step after Step 3. (If it passes now because `emoji` is still present, that's fine — the contract is enforced after Step 3.)

- [ ] **Step 3: Remove `emoji` from the catalog**

Edit `src/lib/expressAchievements.ts`. Change the interface and drop every `emoji` field:

```ts
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
```

- [ ] **Step 4: Update the Express achievements page**

Edit `src/pages/ExpressAchievements.jsx`. Add imports after the existing ones:

```jsx
import AchievementBadge from '../components/icons/AchievementBadge'
import { getAchievementIcon } from '../components/icons/achievementIcons'
```

In its local `AchCard` (lines 7–58), add `const ICON = getAchievementIcon(def.key)` before the `return`, and replace the emoji `<div>` (lines 24–31) with:

```jsx
        <AchievementBadge glyph={ICON.glyph} tier={ICON.tier} earned={earned} size={44} title={def.name} />
```

(Express has no hidden achievements, so no `?` branch is needed.)

- [ ] **Step 5: Run the full test suite**

Run: `npm run typecheck && npm run test`
Expected: PASS — including the updated `expressAchievements.test.ts` (no reference to `emoji` remains anywhere).

- [ ] **Step 6: Visual check**

Open `/express/achievements` (needs an Express project) in light + dark. Confirm the 8 badges render with correct tiers.

- [ ] **Step 7: Commit**

```bash
git add src/lib/expressAchievements.ts src/lib/expressAchievements.test.ts src/pages/ExpressAchievements.jsx
git commit -m "feat(icons): render AchievementBadge in Express achievements"
```

---

## Task 9: Re-home the Defense-Ready shield

**Files:**
- Modify: `src/components/badges/DefenseReadyBadge.jsx`

Goal: the Defense-Ready badge draws the **same** shield glyph as the `defense_ready` achievement, so the shield is unified. All existing animation, pulse rings, padlock overlay, star burst, tooltip, and aria-labels are preserved — only the inner shield `<svg>` markup changes.

- [ ] **Step 1: Add the glyph import**

At the top of `src/components/badges/DefenseReadyBadge.jsx`, after the `useTheme` import, add:

```jsx
import { GLYPHS } from '../icons/glyphs'
```

- [ ] **Step 2: Replace the unlocked shield**

Find the unlocked shield (the `<svg ... viewBox="0 0 256 256" ... fill="#0066FF">` with `<path d={SHIELD_PATH} />`, around lines 150–153). Replace that `<svg>` with a 24-grid render of the shared shield, coloured blue:

```jsx
          <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"
            style={{ '--gl-stroke': '#0066FF', '--gl-fill': 'rgba(0,102,255,0.28)' }}>
            {GLYPHS.shield}
          </svg>
```

- [ ] **Step 3: Replace the locked shield**

Find the locked shield (the `<svg ... viewBox="0 0 256 256" ... fill={isLight ? 'rgba(13,27,42,0.2)' : 'rgba(255,255,255,0.2)'}>` inside the locked branch, around lines 156–158). Replace that `<svg>` with:

```jsx
            <svg width="30" height="30" viewBox="0 0 24 24" aria-hidden="true"
              style={{
                '--gl-stroke': isLight ? 'rgba(13,27,42,0.25)' : 'rgba(255,255,255,0.25)',
                '--gl-fill': isLight ? 'rgba(13,27,42,0.06)' : 'rgba(255,255,255,0.05)',
              }}>
              {GLYPHS.shield}
            </svg>
```

Keep the padlock overlay `<div>` that follows it unchanged. Leave `SHIELD_PATH` defined for now if any other code references it; if `SHIELD_PATH` is now unused, delete the `const SHIELD_PATH = '…'` declaration (lines 6–7) to avoid a dead-constant lint warning.

- [ ] **Step 4: Typecheck + test**

Run: `npm run typecheck && npm run test`
Expected: PASS.

- [ ] **Step 5: Visual check**

On `/dashboard`, view the Defense-Ready badge in both locked and unlocked states (dark + light). Confirm the shield now matches the achievement shield, and the pulse/star-burst/tooltip animations still work.

- [ ] **Step 6: Commit**

```bash
git add src/components/badges/DefenseReadyBadge.jsx
git commit -m "feat(icons): re-home Defense-Ready shield to shared glyph"
```

---

## Task 10: Phase 1 verification sweep

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck + test**

Run: `npm run typecheck && npm run test`
Expected: PASS, zero failures.

- [ ] **Step 2: Confirm no achievement emoji remain**

Run: `git grep -nE "emoji" -- src/pages/account/Achievements.jsx src/components/badges/AchievementsRow.jsx src/pages/ExpressAchievements.jsx src/lib/expressAchievements.ts`
Expected: no matches (all achievement emoji removed).

- [ ] **Step 3: Build**

Run: `npm run build`
Expected: build succeeds (icons chunk included, no missing-import errors).

- [ ] **Step 4: Full visual pass (light + dark)**

Verify badges render correctly on: `/account/achievements`, `/dashboard` (AchievementsRow + Defense-Ready badge), `/express/achievements`. Check earned vs locked, and all three tiers.

- [ ] **Step 5: Final commit (if any doc/state updates)**

```bash
git add -A
git commit -m "chore(icons): Phase 1 achievements verification pass" || echo "nothing to commit"
```

---

## Self-Review (completed during planning)

- **Spec coverage:** Duotone base (Tasks 1–2), tier medallions rare/elite (Task 4), 19 glyphs + tier map matching spec §4.3 with 6/8/5 distribution (Tasks 2–3), React component delivery under `src/components/icons/` (Tasks 1–5), light/dark theming (`tokens.ts` + `useTheme` in `AchievementBadge`), consumers `Achievements.jsx` / `AchievementsRow.jsx` / `expressAchievements.ts` / `ExpressAchievements.jsx` (Tasks 6–8), Express subset reuse via shared map (Task 8), `DefenseReadyBadge` re-home (Task 9), accessibility `role="img"` + `aria-label` (Task 5). Phase 2/3 items (chrome, StepBadge, ranks, `public/icons/icons.svg` removal) are explicitly excluded.
- **Placeholder scan:** No TBD/TODO; all code is complete and inline.
- **Type consistency:** `Tier`/`GlyphName`/`AchievementKey` from `types.ts` used consistently; `GLYPHS` keyed by `GlyphName`; `ACHIEVEMENT_ICONS` keyed by `AchievementKey`; `getAchievementIcon()` signature matches its test and all consumers; CSS custom properties `--gl-stroke`/`--gl-fill` set in `AchievementBadge`/`DefenseReadyBadge` and consumed in every glyph.
