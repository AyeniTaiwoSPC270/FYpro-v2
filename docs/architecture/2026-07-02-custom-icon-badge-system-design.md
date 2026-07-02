# FYPro Custom Icon & Badge System — Design

**Date:** 2026-07-02
**Status:** Approved design, ready for implementation planning
**Owner:** Taiwo

---

## 1. Goal

Replace FYPro's OS emojis and generic open-source icon paths with a single, owned icon
language that fits the design system ("dark academia meets precision engineering meets
African digital product"). Today, achievements render as platform emojis (🌱⚡🛡️🎓…) that
look different on every device, rank badges use emojis, and the top-bar chrome icons are
mismatched Feather/Lucide paths at inconsistent sizes. There is also a leftover generic
sprite (`public/icons/icons.svg`, purple Discord/GitHub/X icons) that violates the no-purple
rule.

The system must work in both light and dark mode, be theme-aware, animate on unlock, and be
delivered as tree-shakeable React SVG components.

---

## 2. Locked design decisions

These were decided during brainstorming and are not to be revisited without cause:

1. **Scope:** Full app icon system (not just achievements).
2. **Base style:** **Duotone** — solid tinted fill + crisp single-weight stroke edge.
3. **Rarity treatment:** **Medallion frame** (faceted hexagon ring) reserved for Rare and
   Elite tiers only. Standard achievements are unframed duotone glyphs.
4. **Delivery:** **React SVG components** under `src/components/icons/` — a glyph registry
   (path data) plus wrapper components. No sprite sheet, no pre-rendered PNGs for in-app UI.
5. **Two registers** (see §3): a colored **Reward register** and a quiet monoline
   **Chrome register**, drawn by the same hand.

---

## 3. Two registers

The system is deliberately split so rewards feel special and chrome stays quiet, while both
read as one family (shared 24-unit grid, rounded terminals, matched corner radius).

### Reward register — celebratory, colored
- Used by: achievements, the Defense-Ready badge, rank badges.
- Duotone glyph = translucent tinted fill (tier color at low alpha) + solid stroke.
- Optional **medallion frame**: faceted hexagon (outer polygon + inner facet line) with a
  metal-gradient ring, plus a soft glow on Elite.

### Chrome register — functional, quiet
- Used by: top-bar (bell, settings, theme, plus, hamburger, avatar is not an icon), sidebar
  nav, step navigator line icons, per-feature header icons, small utility icons (check, lock,
  arrow, trash, download, play, dots).
- Monoline: **no fill**, single stroke, `currentColor` (slate → white on hover in chrome).
- Optical size **20px** for top-bar/nav, `strokeWidth` **1.75**; utility icons keep their
  smaller sizes but adopt the same stroke ratio and terminals.

---

## 4. Reward register — detailed spec

### 4.1 Tiers

| Tier | Frame | Ring color | Glyph color (dark) | Notes |
|------|-------|------------|--------------------|-------|
| **Standard** | none | — | stroke `#3B82F6`, fill `rgba(0,102,255,0.28)` | everyday wins |
| **Rare** | blue hex medallion | `linear-gradient(#3B82F6→#0066FF)` | stroke `#8FB8FF`, fill `rgba(0,102,255,0.30)` | took real effort |
| **Elite** | gold hex medallion + inner facet + soft glow | `linear-gradient(#FCD980→#D99B2B)` | stroke `#FCD980`, fill `rgba(252,217,128,0.22)` | the peak |

- **Hexagon frame geometry** (48×48 viewBox): `polygon points="24,3 42,13 42,35 24,45 6,35 6,13"`.
  Elite adds an inner facet polygon at ~0.8 stroke, low opacity.
- **Glyph placement in frame:** glyph drawn on the 24-grid, centered and scaled to ~0.6 so
  the frame reads clearly (roughly `translate(16.8,16.8) scale(0.6)` when composing a 24-grid
  glyph into a 48 frame; the component handles this).
- **Locked state:** grayscale + reduced opacity (~0.35–0.4), frame desaturated; hidden
  achievements show `?` until earned (existing behavior preserved).

### 4.2 Light-mode adaptation
Duotone fills are translucent tints over the card background, so they adapt automatically.
Two explicit adjustments:
- Elite gold on light cards uses a slightly deeper gold for the stroke (e.g. `#C6871F`) to
  keep contrast; the ring gradient stays gold.
- Standard/Rare blue stroke may deepen to `#0066FF` on light for contrast. The component
  reads theme via `useTheme()` and picks the right palette.

### 4.3 The 19 achievement glyphs and tier map

Grouped by category as they appear in the app.

| Category | Key | Name | Glyph | Tier |
|----------|-----|------|-------|------|
| Milestone | `first_step` | First Step | seedling / sprout | Standard |
| Milestone | `halfway` | Halfway There | half-filled ring | Standard |
| Milestone | `defense_ready` | Defense Ready | shield | **Elite** |
| Milestone | `certified` | Certified | graduation cap | **Elite** |
| Speed | `fast_starter` | Fast Starter | rocket | Standard |
| Speed | `sprint` | Sprint | stopwatch | **Rare** |
| Speed | `speed_run` | Speed Run | chequered flag | **Elite** |
| Effort | `sharp_mind` | Sharp Mind | target / bullseye | **Rare** |
| Effort | `excellence` | Excellence | star | **Elite** |
| Effort | `perfectionist` | Perfectionist | diamond / gem | **Elite** |
| Effort | `persistent` | Persistent | loop arrows | **Rare** |
| Effort | `never_give_up` | Never Give Up | comeback arrow (rising from baseline) | **Rare** |
| Social | `ambassador` | Ambassador | megaphone | Standard |
| Social | `connector` | Connector | 3-node network | **Rare** |
| Social | `earned_it` | Earned It | trophy | **Elite** |
| Social | `shared` | Shared | share / upload arrow | Standard |
| Hidden | `night_owl` | Night Owl | crescent moon + star | **Rare** |
| Hidden | `early_bird` | Early Bird | sunrise over horizon | **Rare** |
| Hidden | `dedicated` | Dedicated | flame | **Rare** |

Distribution: Elite ×6, Rare ×8, Standard ×5.

The **Express** achievement set (`src/lib/expressAchievements.ts`, 8 items) is a subset of
these keys (`defense_ready`, `certified`, `sharp_mind`, `excellence`, `perfectionist`,
`persistent`, `never_give_up`, `shared`) and reuses the exact same glyph + tier — no separate
artwork.

### 4.4 Rank badges
`src/hooks/useRank.ts` currently uses 8 emojis for ranks. These move into the reward register
as duotone glyphs (tier/prestige escalating with rank). Rank glyph set is defined during
implementation planning (candidate metaphors: sprout → book → compass → shield → laurel →
star → crown-equivalent), reusing the same duotone + medallion machinery. This is Phase 3.

---

## 5. Chrome register — detailed spec

- **Grid:** 24×24 viewBox, `fill="none"`, `stroke="currentColor"`, `strokeWidth` 1.75,
  `strokeLinecap="round"`, `strokeLinejoin="round"`.
- **Optical sizes:** 20px (top bar, sidebar nav, feature headers), utility icons keep 11–14px
  but same stroke ratio.
- **Color:** inherits `currentColor`; chrome buttons drive slate→white on hover via existing
  classes. No fills, no tier colors.

### 5.1 Icons in scope (replacing `_shared.jsx` + inline paths)
From `src/features/dashboard/_shared.jsx` (14 today) and inline top-bar markup:
`ShieldIcon, BellIcon, GearIcon(→ proper cog), CheckIcon, LockIcon, ArrowRightIcon, PlusIcon,
TrashIcon, DownloadIcon, ZapIcon, PlayIcon, SunIcon, MoonIcon, DotsHorizontalIcon`, plus the
inline **hamburger** in `DashTopBar.jsx`.

Notable redraw: the current `GearIcon` (circle + two arcs) reads oddly and is replaced by a
proper cog. Bell keeps its unread badge (unchanged markup; only the glyph swaps).

Search / help icons are **not** added now (no current use); the family makes adding them
trivial later.

### 5.2 Step navigator line icons
`StepBadge.jsx` already uses 6 hand-drawn line icons (TV/CA/MA/WP/PR/DP). These are re-homed
into the shared `<Icon>` registry and normalized to the chrome family's stroke/terminals so
they match. Visual change is minimal — mainly consolidation. (Phase 3.)

---

## 6. Delivery architecture

```
src/components/icons/
  glyphs.tsx            // path-data registry: reward glyphs (24-grid) keyed by name
  chromeGlyphs.tsx      // path-data registry: chrome/line icons keyed by name
  AchievementBadge.jsx  // reward wrapper: glyph + tier frame + earned/locked + animation
  Icon.jsx              // chrome wrapper: <Icon name size /> monoline, currentColor
  frames.tsx            // hex medallion + gradient defs (blue/gold), glow
  tokens.ts             // tier palettes (dark/light), stroke widths, sizes
  index.ts              // barrel exports
```

### 6.1 Component APIs

```jsx
// Reward
<AchievementBadge
  glyph="shield"        // key into glyphs.tsx
  tier="elite"          // 'standard' | 'rare' | 'elite'
  earned={true}         // controls color vs grayscale/locked
  size={48}
  animateOnEarn         // optional framer-motion pop + glow when it transitions to earned
/>

// Chrome
<Icon name="bell" size={20} />          // currentColor, strokeWidth 1.75
<Icon name="settings" size={20} />
```

- Gradient `<defs>` for the medallion rings are rendered **once** (e.g. a mounted
  `<IconDefs/>` in the app shell, or inline-per-instance with unique ids) to avoid duplicate
  id collisions. Decide during planning; the components encapsulate it either way.
- `AchievementBadge` composes a glyph from `glyphs.tsx` with a frame from `frames.tsx` based
  on `tier`; `standard` renders no frame.
- The **glyph is the single source of truth** — the same `shield` glyph is reused by
  `AchievementBadge` (Defense Ready, elite) and can be reused as a plain `<Icon>` elsewhere.

### 6.2 Animation
`AchievementBadge` reuses the existing unlock motion patterns (scale pop, glow, tick overlay)
already present in `StepBadge.jsx` / `DefenseReadyBadge.jsx` via framer-motion. No new
animation library.

---

## 7. Integration points (files that consume the new components)

| File | Change |
|------|--------|
| `src/pages/account/Achievements.jsx` | Replace `emoji` field + emoji `<div>` with `<AchievementBadge glyph tier earned>`; keep categories, hidden `?` logic, layout. |
| `src/components/badges/AchievementsRow.jsx` | Same swap in the compact chip row; normalize catalog to include `glyph` + `tier`. |
| `src/lib/expressAchievements.ts` | Replace `emoji` with `glyph`/`tier` (reusing shared keys). |
| `src/components/badges/DefenseReadyBadge.jsx` | Re-home shield to `glyphs.tsx`; render via reward machinery (behavior/animation preserved). |
| `src/components/badges/StepBadge.jsx` | Move the 6 step line icons into `<Icon>` registry; normalize stroke. |
| `src/features/dashboard/_shared.jsx` | Replace the 14 exported `*Icon` components with re-exports/thin wrappers around `<Icon name>` (or migrate call sites). |
| `src/features/dashboard/DashTopBar.jsx` | Hamburger + bell + theme + settings via `<Icon>`; unread badge unchanged. |
| `src/hooks/useRank.ts` + rank UI (`RankPill`) | Replace rank emojis with reward glyphs. |
| Minor emoji cleanup | `changelog.ts`, `roadmap/RoadmapColumn.jsx`, `admin/widgets/RatingsWidget.jsx`, step header emojis (TopicValidator/ChapterArchitect/Methodology/ProjectReviewer/WritingPlanner) — evaluate case by case; convert to `<Icon>` where it's UI, leave content emojis in changelog copy if purely editorial. |
| `public/icons/icons.svg` | **Remove** the generic purple social sprite once confirmed unused (grep for `icons.svg` references first). |

A source-of-truth mapping (achievement key → glyph name + tier) lives with the glyph registry
so `Achievements.jsx`, `AchievementsRow.jsx`, and `expressAchievements.ts` all read the same
definitions instead of duplicating.

---

## 8. Phasing

The design is defined whole; implementation ships in phases so each is independently
verifiable in the browser.

- **Phase 1 — Achievements (reward register core).** Build `src/components/icons/` scaffolding
  (`glyphs.tsx`, `frames.tsx`, `AchievementBadge`, `tokens`), the 19 glyphs, tier frames,
  light/dark palettes, unlock animation. Swap `Achievements.jsx`, `AchievementsRow.jsx`,
  `expressAchievements.ts`, and re-home `DefenseReadyBadge`. **Biggest visible win.**
- **Phase 2 — Chrome register.** Build `Icon.jsx` + `chromeGlyphs.tsx`; redraw the 14
  `_shared.jsx` icons + hamburger + proper cog; migrate `DashTopBar` and sidebar. Remove the
  generic `public/icons/icons.svg`.
- **Phase 3 — Nav, ranks, feature icons & cleanup.** Re-home `StepBadge` line icons; convert
  rank emojis (`useRank`/`RankPill`); per-feature header icons; remaining minor emoji cleanup.

Each phase gets its own implementation plan (writing-plans) and is verified in-browser in
both light and dark mode before merge.

---

## 9. Accessibility

- Decorative SVGs: `aria-hidden="true"`. Meaningful badges keep the existing
  `role="img"` + descriptive `aria-label` pattern already used in `StepBadge`/`DefenseReadyBadge`
  (e.g. "Defense Ready — awarded 2 Jul 2026", locked variants explain how to unlock).
- Tooltips remain (portal pattern already implemented) for names/dates.
- Color is never the sole signal: tier is also communicated by the presence/shape of the
  medallion frame and the label, not just gold vs blue.

---

## 10. Non-goals / out of scope

- No sprite sheet, no pre-rendered PNGs for in-app icons (PNGs remain only for the existing
  social share badges in `public/badges/`).
- No new icon/animation libraries.
- No change to achievement unlock logic, keys, DB, or `/api/ai?action=check-achievements`.
- No new achievements or ranks — artwork only.
- No redesign of the social share badges (`public/badges/*.png`) in this effort.

---

## 11. Verification

- `npm run typecheck` and `npm run test` pass (per CLAUDE.md working rules).
- Visual check in browser, **both light and dark mode**, for: Achievements page, dashboard
  `AchievementsRow`, Express achievements page, Defense-Ready badge locked + unlocked, the
  top bar, and the step navigator.
- Confirm no leftover references to `public/icons/icons.svg` before deletion.
- Confirm no achievement/rank still renders a raw emoji after its phase.
