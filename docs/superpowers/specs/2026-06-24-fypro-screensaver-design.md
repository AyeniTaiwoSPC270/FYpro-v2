# FYPro Screensaver — Design Spec
**Date:** 2026-06-24
**Status:** Approved

---

## Overview

A standalone ambient screensaver for personal PC use. A single `marketing/screensaver.html` file opened in a browser (F11 for fullscreen). FYPro-themed: deep navy background, glowing drifting particles, the real FYPro logo pulsing at center, and rotating brand phrases fading beneath it.

Not part of the app. No build step. No dependencies beyond Google Fonts (CDN) and a relative path to `public/fypro-logo.png`.

---

## Visual Design

**Background:** `#060E18` — FYPro's deepest navy. Full viewport, no scroll, no cursor, no UI chrome.

**Fonts:**
- `DM Serif Display` — phrases
- `JetBrains Mono` — version label
- Loaded from Google Fonts CDN (requires internet connection)

**Colors:** Strictly from the FYPro design system CSS variables:
- Blue primary: `#0066FF`
- White: `#FFFFFF`
- Muted blue label: `rgba(0, 102, 255, 0.35)`

---

## Components

### 1. Particle Canvas

- Full-screen `<canvas>` element, z-index below logo/text layer
- ~100 particles, rendered each animation frame via `requestAnimationFrame`
- Each particle has: `x`, `y`, `vx`, `vy`, `radius` (1–5px), `opacity` (0.10–0.60), `color` (blue or white, weighted 70% blue / 30% white)
- Velocity: slow drift, `vx` and `vy` randomly in range `[-0.4, 0.4]` px/frame
- Edge wrapping: particles that exit one side re-enter from the opposite side
- Proximity glow: particles within 200px of screen center render at 1.3× their base opacity

### 2. Logo

- `<img src="../public/fypro-logo.png">` centered absolutely on screen
- Width: 220px, height: auto
- Pulse animation: CSS `@keyframes` — `filter: drop-shadow(0 0 Xpx rgba(0,102,255,Y))` cycles from low to high glow and back
- Cycle duration: 4s, `ease-in-out`, infinite

```css
@keyframes logo-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(0, 102, 255, 0.3)); }
  50%       { filter: drop-shadow(0 0 28px rgba(0, 102, 255, 0.7)); }
}
```

### 3. Rotating Phrases

- `<p>` element centered below the logo (~40px gap)
- Font: `DM Serif Display`, 22px, `#FFFFFF`, `letter-spacing: 0.04em`
- Phrases cycle in order, looping:
  1. "Your Final Year Companion."
  2. "From rough idea to defense day."
  3. "Topic Validated."
  4. "Research. Write. Defend."
  5. "Defense Ready."
  6. "500,000 students. One companion."
  7. "Built for Nigerian final year students."
- Timing: 3s visible, 0.8s fade-in, 0.8s fade-out (CSS `opacity` transition)
- JavaScript cycles `opacity: 0 → 1 → 0` with `setTimeout`, then swaps text and repeats

### 4. Version Label

- Fixed at bottom center: `FYPRO v2`
- Font: `JetBrains Mono`, 11px, `rgba(0, 102, 255, 0.35)`, `letter-spacing: 0.15em`
- No animation — static, barely visible

---

## File Placement

```
fypro-v2/
└── marketing/
    └── screensaver.html   ← the deliverable
```

References logo via relative path: `../public/fypro-logo.png`

The `marketing/` folder already exists in the repo (currently untracked). The screensaver lives there.

---

## Behavior

- Completely passive — no mouse, keyboard, or touch handling
- Runs indefinitely via `requestAnimationFrame` loop + phrase `setTimeout` cycle
- No audio, no network calls after initial font load
- Works offline after first load (fonts cached by browser)

---

## What This Is Not

- Not part of the FYPro app or React codebase
- Not a PWA, not installable
- Not interactive
- Not mobile-optimised (PC fullscreen only)

---

## Implementation Notes

- All in one HTML file: inline `<style>` + inline `<script>` — no external JS files
- Canvas sized to `window.innerWidth × window.innerHeight` on load (no resize handling needed for a screensaver)
- Logo and text layer: absolutely positioned `<div>` over the canvas, `pointer-events: none`
- Phrase swap logic: fade out → swap text content → fade in, using `setTimeout` chains
