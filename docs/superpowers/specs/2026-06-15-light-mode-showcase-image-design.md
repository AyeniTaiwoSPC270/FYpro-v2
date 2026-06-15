# Light-mode variant of the product-showcase image

**Date:** 2026-06-15
**Status:** Approved design — ready for implementation plan

## Problem

The landing page (`src/pages/LandingPage.jsx`) supports light mode: its hero
background flips from dark navy (`#060E18`) to warm cream (`#FAFAF7`) via the
`--pub-*` CSS variables defined in `src/styles/theme-responsive.css`. The page
itself has no theme toggle — the theme is whatever the user persisted elsewhere
in the app (`fypro_theme` in `localStorage`, read by `ThemeContext`).

The product-showcase hero image (`public/FYPro-Product-Showcase-v2.png`, used at
`LandingPage.jsx:738`) is a fixed **dark** navy board. In light mode it sits
inside a cream hero and clashes badly.

Goal: produce a **light-mode variant** of the showcase image and swap to it when
the app theme is light. Decision (confirmed with user): the variant is a **full**
light recolor — the canvas *and* the app screens inside the three phones flip to
the app's real light theme, so it reads as a genuine light-mode product shot.

The image appears in exactly one place (`LandingPage.jsx:738`) — verified by grep.

## Source of the current image

The current PNG was produced by a design-export tool that left a self-rendering
"bundler" file at `public/FYPro-Product-Showcase-Standalone.html`. Inside it, the
real board markup is stored as an escaped string in
`<script type="__bundler/template">`, with fonts embedded as base64 and the logo
images stored as bundler resources referenced by UUID.

The board is a clean, hand-coded **1600×900** HTML/CSS canvas:
- Top-left: FYPro wordmark + headline "From topic to defence. Powered by AI." + sub-text.
- Three phone mockups: **left** = Dashboard, **center** = Topic Validator, **right** = Defence Simulator.
- Background: dark canvas + blue radial glow + vignette + subtle grain.

All colors are hardcoded hex / `rgba(255,255,255,.X)`. Brand accent colors
(blue `#0066FF`, green `#16A34A`, amber `#F59E0B`, red `#DC2626`, and badge
colors indigo/cyan/violet) are theme-independent.

## Architecture — three components

### 1. Editable board source: `scripts/showcase/board.html`

Derived from the **extracted** bundler template (the literal source of the
existing PNG), so a dark render reproduces `-v2.png` faithfully. Changes:

- **Resolve image refs.** Replace the two bundler-UUID `<img>` refs (wordmark,
  shield) with real `public/` assets. Pick the theme-correct logo per variant:
  white-on-dark wordmark for dark, dark-on-light wordmark for light. Confirm
  which file is which during implementation (`fypro-logo.png`,
  `fypro-logo-light.png`, `fypro-logo-gold.png`, `public/shield-star.svg`);
  cross-check against `src/components/FyproLogo.jsx` which already chooses
  per-theme variants.
- **Refactor flipping colors to CSS variables.** Convert the ~15–20 colors that
  differ between themes (see mapping table) into `:root` CSS variables in the
  `<style>` block. Leave brand-accent inline styles on badges untouched.
- **Add a light override block.** `html[data-theme="light"] { ...vars... }`.
- **Theme selector.** A tiny inline script sets `data-theme` from a `?theme=`
  query param (default `dark`), so one file renders both variants.
- **Keep embedded base64 fonts** so renders are deterministic and match the
  existing dark PNG.

### 2. Render script: `scripts/screenshot-showcase.mjs`

Mirrors the existing `scripts/screenshot-og.mjs` pattern:
- `puppeteer-core` launching system Chrome (path as in `screenshot-og.mjs`).
- Viewport `1600×900`, `deviceScaleFactor: 1` (confirmed: `-v2.png` is exactly
  1600×900, so no retina scaling).
- Load `board.html?theme=light` via `file://` (or a tiny static serve if
  `file://` font/asset loading is unreliable), wait for font paint (~2.5s as in
  the og script), `clip` to `0,0,1600,900`.
- Output `public/FYPro-Product-Showcase-light.png`.
- **Verification mode:** also render `?theme=dark` to a temp path
  (`public/.showcase-dark-check.png`) so we can eyeball/diff it against
  `-v2.png` and confirm the reconstruction is faithful before trusting the
  light sibling. The script must **never** overwrite `-v2.png`.

### 3. Frontend swap: `src/pages/LandingPage.jsx`

In the Hero component (the function rendering the `motion.img` at line ~738):
- `import { useTheme } from '../context/ThemeContext'`.
- `const { theme } = useTheme()`.
- `src={theme === 'light' ? '/FYPro-Product-Showcase-light.png' : '/FYPro-Product-Showcase-v2.png'}`.
- Keep the existing `motion.img` animation, `alt`, shadow, and classes.

Single image downloads per page load (landing has no theme toggle → theme is
fixed per load → no swap-flash and no double-download; good for the LCP hero).

## Light color mapping

| Element | Dark | Light |
|---|---|---|
| Canvas bg | `#060E18` | `#FAFAF7` warm cream + soft gradient |
| Headline / brand / titles | `#fff` | `#0D1B2A` ink |
| Sub-text | `#8899AA` | `rgba(13,27,42,.55)` |
| Center phone screen | `#060E18` | `#FFFFFF` |
| Left phone screen | `#0D1B2A` | `#F7F8FA` |
| Right phone screen | `#040A12` | `#FFFFFF` |
| Inner sidebar (`.tv-sb`) | `#0D1B2A` | `#E4EBF5` (app light sidebar) |
| White-opacity text | `rgba(255,255,255,.X)` | `rgba(13,27,42,.X)` |
| White-opacity borders | `rgba(255,255,255,.04–.1)` | `rgba(13,27,42,.06–.12)` |
| Subtle card fills | `rgba(255,255,255,.02–.07)` | white cards w/ `rgba(13,27,42,.06)` border |
| Glow | blue `.24` | blue `.12` (softer) |
| Vignette | black `.6` | warm `rgba(13,27,42,.08)` (barely there) |
| Grain | white `.07` | keep, very subtle |
| Brand accents (blue/green/amber/red, badge colors) | — | unchanged |
| Phone metallic frames | — | unchanged (works on both) |

Inner screens target FYPro's real light tokens from `theme-responsive.css`:
`--bg-base #F8FAFC`, ink `#0D1B2A`, white cards, `--sidebar-gradient-end #E4EBF5`.

## Out of scope (YAGNI)

- No runtime CSS filter/invert tricks.
- No dual-image preloading or `<picture>` complexity.
- No modification of `-v2.png` (the dark image).
- No changes to landing-page theming (already works).
- No new npm dependencies (`puppeteer` already in `package.json`).

## Verification

1. Run the render script; confirm `FYPro-Product-Showcase-light.png` is written
   at the correct dimensions.
2. Diff the script's dark-check render against `-v2.png` to confirm the
   reconstruction is faithful (fonts, layout, logo).
3. Visually inspect the light PNG: cream canvas, dark ink text, light app
   screens, brand accents intact, no leftover dark surfaces.
4. In the app, toggle light mode and load the landing page; confirm the hero
   image is the light variant and matches the cream hero; toggle dark and
   confirm it reverts to `-v2.png`.
5. `npm run build` succeeds (no broken import).

## Files touched

- `scripts/showcase/board.html` (new — editable board source)
- `scripts/screenshot-showcase.mjs` (new — render script)
- `public/FYPro-Product-Showcase-light.png` (new — generated asset)
- `src/pages/LandingPage.jsx` (edit — theme-aware `src`)
