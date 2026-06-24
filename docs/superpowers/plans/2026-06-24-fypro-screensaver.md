# FYPro Screensaver Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a single standalone `marketing/screensaver.html` file — ambient FYPro-themed screensaver with glowing particles, pulsing logo, and rotating phrases.

**Architecture:** One self-contained HTML file with inline `<style>` and `<script>`. Canvas handles particles via `requestAnimationFrame`. Logo and phrases sit in an absolutely positioned overlay div. No external JS files, no build step.

**Tech Stack:** Vanilla HTML/CSS/JS. Canvas 2D API. Google Fonts CDN (DM Serif Display, JetBrains Mono). References `../public/fypro-logo.png` via relative path.

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `marketing/screensaver.html` | Entire screensaver — shell, styles, canvas, overlay, JS |

That's the only file. Everything is inline.

---

## Task 1: HTML Shell + Base Styles

**Files:**
- Create: `marketing/screensaver.html`

- [ ] **Step 1: Create the file with shell, fonts, and base CSS**

Create `marketing/screensaver.html` with the following content:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>FYPro</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=JetBrains+Mono:wght@400&display=swap" rel="stylesheet">
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    html, body {
      width: 100%;
      height: 100%;
      overflow: hidden;
      background: #060E18;
      cursor: none;
    }

    canvas {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 0;
    }

    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 1;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }

    .version {
      position: fixed;
      bottom: 24px;
      left: 50%;
      transform: translateX(-50%);
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: rgba(0, 102, 255, 0.35);
      letter-spacing: 0.15em;
      pointer-events: none;
      z-index: 1;
    }
  </style>
</head>
<body>
  <canvas id="particles"></canvas>
  <div class="overlay">
    <!-- logo and phrase go here in later tasks -->
  </div>
  <div class="version">FYPRO v2</div>

  <script>
    // tasks add code here
  </script>
</body>
</html>
```

- [ ] **Step 2: Verify in browser**

Open `marketing/screensaver.html` directly in Chrome or Edge (double-click the file).

Expected:
- Entire screen is deep navy (`#060E18`)
- No cursor visible anywhere on the page
- No scrollbars
- "FYPRO v2" text visible in very muted blue at the bottom center
- Fonts load from Google Fonts (requires internet)

- [ ] **Step 3: Commit**

```bash
git add marketing/screensaver.html
git commit -m "feat(screensaver): html shell, base styles, version label"
```

---

## Task 2: Particle System

**Files:**
- Modify: `marketing/screensaver.html` — add canvas init + particle loop inside `<script>`

- [ ] **Step 1: Replace the `<script>` block with particle system code**

Replace the `// tasks add code here` comment inside `<script>` with:

```javascript
// ── Particles ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('particles');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth;
canvas.height = window.innerHeight;

const CENTER_X = canvas.width / 2;
const CENTER_Y = canvas.height / 2;
const PARTICLE_COUNT = 100;
const PROXIMITY_RADIUS = 200;
const PROXIMITY_BOOST = 1.3;

function randomBetween(min, max) {
  return Math.random() * (max - min) + min;
}

function createParticle() {
  const isBlue = Math.random() < 0.7;
  return {
    x: randomBetween(0, canvas.width),
    y: randomBetween(0, canvas.height),
    vx: randomBetween(-0.4, 0.4),
    vy: randomBetween(-0.4, 0.4),
    radius: randomBetween(1, 5),
    opacity: randomBetween(0.10, 0.60),
    r: isBlue ? 0   : 255,
    g: isBlue ? 102 : 255,
    b: isBlue ? 255 : 255,
  };
}

const particles = Array.from({ length: PARTICLE_COUNT }, createParticle);

function drawParticles() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  for (const p of particles) {
    // Move
    p.x += p.vx;
    p.y += p.vy;

    // Edge wrap
    if (p.x < 0)             p.x = canvas.width;
    if (p.x > canvas.width)  p.x = 0;
    if (p.y < 0)             p.y = canvas.height;
    if (p.y > canvas.height) p.y = 0;

    // Proximity boost — particles near screen center glow brighter
    const dx = p.x - CENTER_X;
    const dy = p.y - CENTER_Y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const opacity = dist < PROXIMITY_RADIUS
      ? Math.min(p.opacity * PROXIMITY_BOOST, 1)
      : p.opacity;

    // Draw dot
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
    ctx.fillStyle = `rgba(${p.r}, ${p.g}, ${p.b}, ${opacity})`;
    ctx.fill();
  }

  requestAnimationFrame(drawParticles);
}

drawParticles();
```

- [ ] **Step 2: Verify in browser**

Reload `marketing/screensaver.html`.

Expected:
- ~100 glowing dots visible across the dark screen
- Dots drift slowly in all directions
- Dots that reach a screen edge reappear from the opposite edge
- Dots near the center of the screen appear slightly brighter
- Mix of blue (`#0066FF`) and white dots — roughly 70% blue
- Animation runs smoothly and continuously

- [ ] **Step 3: Commit**

```bash
git add marketing/screensaver.html
git commit -m "feat(screensaver): particle canvas system with proximity glow"
```

---

## Task 3: Logo + Pulse Animation

**Files:**
- Modify: `marketing/screensaver.html` — add `.logo` CSS rule + `<img>` in overlay

- [ ] **Step 1: Add logo CSS inside `<style>`**

Add these rules inside the `<style>` block, before the closing `</style>` tag:

```css
.logo {
  width: 220px;
  height: auto;
  animation: logo-pulse 4s ease-in-out infinite;
}

@keyframes logo-pulse {
  0%, 100% { filter: drop-shadow(0 0 8px rgba(0, 102, 255, 0.3)); }
  50%       { filter: drop-shadow(0 0 28px rgba(0, 102, 255, 0.7)); }
}
```

- [ ] **Step 2: Add the logo image to the overlay**

Replace the `<!-- logo and phrase go here in later tasks -->` comment inside `.overlay` with:

```html
<img class="logo" src="../public/fypro-logo.png" alt="FYPro">
```

- [ ] **Step 3: Verify in browser**

Reload `marketing/screensaver.html`.

Expected:
- FYPro logo appears centered on screen, 220px wide
- Logo gently pulses — blue glow brightens and dims on a 4-second cycle
- Glow is soft, not harsh — subtle brightening, not a strobe
- Particles continue drifting behind the logo

- [ ] **Step 4: Commit**

```bash
git add marketing/screensaver.html
git commit -m "feat(screensaver): logo centered with blue glow pulse animation"
```

---

## Task 4: Rotating Phrases

**Files:**
- Modify: `marketing/screensaver.html` — add `.phrase` CSS + `<p>` element + phrase JS

- [ ] **Step 1: Add phrase CSS inside `<style>`**

Add this rule inside `<style>`, before `</style>`:

```css
.phrase {
  margin-top: 40px;
  font-family: 'DM Serif Display', Georgia, serif;
  font-size: 22px;
  color: #FFFFFF;
  letter-spacing: 0.04em;
  opacity: 0;
  transition: opacity 0.8s ease;
  text-align: center;
  max-width: 600px;
}
```

- [ ] **Step 2: Add the phrase element to the overlay**

Add this line immediately after the `<img class="logo" ...>` tag, inside `.overlay`:

```html
<p class="phrase" id="phrase"></p>
```

- [ ] **Step 3: Add phrase cycling JS**

Add this block inside `<script>`, immediately after the `drawParticles();` call:

```javascript
// ── Rotating Phrases ────────────────────────────────────────────────────────
const PHRASES = [
  'Your Final Year Companion.',
  'From rough idea to defense day.',
  'Topic Validated.',
  'Research. Write. Defend.',
  'Defense Ready.',
  '500,000 students. One companion.',
  'Built for Nigerian final year students.',
];

const phraseEl = document.getElementById('phrase');
let phraseIndex = 0;

function showPhrase() {
  // Swap text and fade in
  phraseEl.textContent = PHRASES[phraseIndex];
  phraseEl.style.opacity = '1';

  // After 3s visible, fade out
  setTimeout(() => {
    phraseEl.style.opacity = '0';

    // After 0.8s fade-out transition completes, advance to next phrase
    setTimeout(() => {
      phraseIndex = (phraseIndex + 1) % PHRASES.length;
      showPhrase();
    }, 800);
  }, 3000);
}

// Small initial delay so logo animation starts first
setTimeout(showPhrase, 800);
```

- [ ] **Step 4: Verify in browser**

Reload `marketing/screensaver.html`.

Expected:
- After ~0.8s, first phrase fades in below the logo: *"Your Final Year Companion."*
- Phrase stays visible for 3 seconds, then fades out
- Next phrase fades in immediately after: *"From rough idea to defense day."*
- Cycle continues through all 7 phrases and loops back to the first
- Fade is smooth — 0.8s ease transition in and out
- Text is centered, white, DM Serif Display font, 22px
- No layout shift — phrases appear in the same position regardless of text length

- [ ] **Step 5: Commit**

```bash
git add marketing/screensaver.html
git commit -m "feat(screensaver): rotating brand phrases with fade cycle"
```

---

## Task 5: Final Smoke Test

**Files:**
- No new files. Final verification only.

- [ ] **Step 1: Full visual check**

Open `marketing/screensaver.html` in the browser. Press F11 for fullscreen. Let it run for at least 30 seconds.

Verify every item:

| Check | Expected |
|-------|----------|
| Background | Deep navy `#060E18`, no white flash on load |
| Cursor | Hidden everywhere on the page |
| Particles | ~100 glowing dots drifting, wrapping at edges |
| Particle colors | Mix of blue and white, mostly blue |
| Proximity glow | Dots near center appear brighter |
| Logo | Centered, 220px wide, blue glow pulsing every 4s |
| Phrases | Fade in/out below logo, 7 phrases loop correctly |
| Phrase font | DM Serif Display (not system serif) |
| Version label | "FYPRO v2" bottom center, muted blue, barely visible |
| Layout | Nothing overflows, no scrollbars in fullscreen |

- [ ] **Step 2: Check logo path works from the marketing/ directory**

The logo is referenced as `../public/fypro-logo.png`. Confirm the logo loads (not a broken image icon). If it doesn't load, confirm the file exists at `public/fypro-logo.png` relative to the project root.

- [ ] **Step 3: Final commit**

```bash
git add marketing/screensaver.html
git commit -m "feat(screensaver): complete ambient fypro screensaver"
```

---

## Usage

1. Open `marketing/screensaver.html` in Chrome or Edge
2. Press F11 for fullscreen
3. Walk away — it runs forever
