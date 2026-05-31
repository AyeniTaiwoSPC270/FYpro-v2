# Public Pages Light Mode Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the washed-out cool blue-grey light mode on all public marketing pages with a warm academia palette — off-white base, white feature cards, warm sand "How It Works" section, and no more dark navy sections bleeding through in light mode.

**Architecture:** Two files change. `src/index.css` gets updated token values and ~60 lines of new `[data-theme="light"] [data-pub]` overrides appended before the mobile responsiveness block at line 11044. `src/pages/LandingPage.jsx` gets `data-*` attributes on 4 section elements and helper classes on 5 components so CSS can target them individually. All secondary public pages (`Pricing.jsx`, `About.jsx`, `Contact.jsx`, etc.) are fixed automatically by the token change — no JSX edits needed for them.

**Tech stack:** Plain CSS custom properties + Tailwind utility classes. React JSX attribute additions only — no logic changes. Vite dev server for visual verification.

**Important note on `bg-bg-dark`:** This Tailwind class (`bg-bg-dark`) has no matching color in `tailwind.config.js`, so Tailwind generates **no CSS rule for it**. Sections using it (`StatsBar`, `HowItWorks`, `PricingSection`, `LandingFAQSection`) are simply **transparent** in light mode — they fall through to whatever `--pub-bg*` colour is behind them. That's why updating the tokens is the primary fix, and why section-specific CSS rules don't need `!important` for those sections (there's nothing to override). Sections with inline `style={{ background: '...' }}` DO need `!important`.

---

## File Map

| File | Lines touched | What changes |
|---|---|---|
| `src/index.css` | 8003–8008 | Update 6 existing token values |
| `src/index.css` | 8013 (after) | Insert 4 new tokens |
| `src/index.css` | 11042 (after) | Append all new `[data-theme="light"] [data-pub]` overrides |
| `src/pages/LandingPage.jsx` | 5 locations | Add `data-*` attrs + helper classes |

---

## Task 1 — Update pub-* CSS tokens

**Files:**
- Modify: `src/index.css:8003–8013`

- [ ] **Step 1: Replace the 6 existing pub-bg and nav tokens**

Find this block (lines 8002–8008):
```css
  /* Public page tokens */
  --pub-bg:           #EEF2FA;
  --pub-bg-mid:       #E4ECF6;
  --pub-bg-alt:       #E8EFF7;
  --pub-nav-bg:       rgba(255,255,255,0.85);
  --pub-nav-scrolled: rgba(255,255,255,0.97);
  --pub-nav-solid:    rgba(255,255,255,0.99);
```

Replace with:
```css
  /* Public page tokens — warm academia palette */
  --pub-bg:           #FAFAF7;
  --pub-bg-mid:       #F2F0EA;
  --pub-bg-alt:       #F7F5F0;
  --pub-nav-bg:       rgba(250,250,247,0.88);
  --pub-nav-scrolled: rgba(250,250,247,0.97);
  --pub-nav-solid:    rgba(250,250,247,0.99);
```

- [ ] **Step 2: Add 4 new tokens after `--pub-border-dim` (line 8013)**

Find:
```css
  --pub-border-dim:   rgba(13,27,42,0.08);
  /* Component-specific tokens */
```

Replace with:
```css
  --pub-border-dim:   rgba(13,27,42,0.08);
  --pub-bg-sand:      #F2EFE8;
  --pub-bg-section:   #FFFFFF;
  --pub-bg-pricing:   #F7F8FA;
  --pub-bg-footer:    #F2F4F7;
  /* Component-specific tokens */
```

- [ ] **Step 3: Start the dev server and verify the hero changes colour**

```bash
npm run dev
```

Open `http://localhost:5173`, switch to light mode (top-right toggle in the app, or set `data-theme="light"` on `<html>` in DevTools). The landing page hero background should now be warm off-white (`#FAFAF7`), not the previous blue-grey. The Defense Simulator mockup embedded in the hero stays dark — that is correct.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "fix: update pub-* CSS tokens to warm academia palette for light mode"
```

---

## Task 2 — Add data attributes and helper classes to LandingPage.jsx

These are hooks that let CSS target each section independently. No visual change happens in this task — that comes in Tasks 3–5.

**Files:**
- Modify: `src/pages/LandingPage.jsx`

- [ ] **Step 1: Add `lp-hero-eyebrow` class to the hero eyebrow pill**

Find in `Hero()` (inside `HeroHeadline` call area, around line 697):
```jsx
          className="relative z-[1] inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-[0.68rem] font-medium text-[#60A5FA] tracking-[0.1em] uppercase mb-7"
```

Replace with:
```jsx
          className="lp-hero-eyebrow relative z-[1] inline-flex items-center gap-2 rounded-full px-4 py-1.5 font-mono text-[0.68rem] font-medium text-[#60A5FA] tracking-[0.1em] uppercase mb-7"
```

- [ ] **Step 2: Add `lp-feat-wm` class to the feature card watermark span**

Find in `FeatureCardWrapper()` (around line 832):
```jsx
          <span aria-hidden="true" className="absolute bottom-[-16px] right-[14px] font-serif text-[7.5rem] leading-none pointer-events-none select-none" style={{ color: 'rgba(255,255,255,0.025)' }}>{f.n}</span>
```

Replace with:
```jsx
          <span aria-hidden="true" className="lp-feat-wm absolute bottom-[-16px] right-[14px] font-serif text-[7.5rem] leading-none pointer-events-none select-none" style={{ color: 'rgba(255,255,255,0.025)' }}>{f.n}</span>
```

- [ ] **Step 3: Add `data-hiw="true"` to the How It Works section**

Find in `HowItWorks()` (around line 913):
```jsx
    <section id="how-it-works" className="py-24 bg-bg-dark">
```

Replace with:
```jsx
    <section id="how-it-works" data-hiw="true" className="py-24 bg-bg-dark">
```

- [ ] **Step 4: Add `lp-plan-card` classes and `data-pricing` to PricingSection**

Find in `PricingSection()` (around line 967):
```jsx
    <section id="pricing" className="py-24 bg-bg-dark">
```
Replace with:
```jsx
    <section id="pricing" data-pricing="true" className="py-24 bg-bg-dark">
```

Then find the pricing plan `motion.div` (around line 977) — it looks like this:
```jsx
              <motion.div
                className={`relative rounded-2xl py-7 px-6 md:py-9 md:px-8${p.featured ? ' md:scale-[1.025]' : ''}`}
```

Replace with:
```jsx
              <motion.div
                className={`lp-plan-card${p.featured ? ' lp-plan-card--featured' : ''} relative rounded-2xl py-7 px-6 md:py-9 md:px-8${p.featured ? ' md:scale-[1.025]' : ''}`}
```

- [ ] **Step 5: Add `lp-faq-card` class and `data-faq` to the FAQ section**

Find in `LandingFAQSection()` (around line 1094):
```jsx
    <section id="faq" className="pt-24 pb-14 bg-bg-dark">
```
Replace with:
```jsx
    <section id="faq" data-faq="true" className="pt-24 pb-14 bg-bg-dark">
```

Then find the FAQ container div (around line 1098):
```jsx
          <div style={{
            background: 'linear-gradient(150deg, var(--pub-bg-mid) 0%, var(--pub-bg-alt) 100%)',
            border: '1px solid var(--pub-border-dim)',
            borderRadius: '16px',
            overflow: 'hidden',
          }}>
```
Replace with:
```jsx
          <div className="lp-faq-card" style={{
            background: 'linear-gradient(150deg, var(--pub-bg-mid) 0%, var(--pub-bg-alt) 100%)',
            border: '1px solid var(--pub-border-dim)',
            borderRadius: '16px',
            overflow: 'hidden',
          }}>
```

- [ ] **Step 6: Add `data-footer="true"` to the Footer**

Find in `Footer()` (around line 1218):
```jsx
    <footer className="relative border-t border-white/[0.06]" style={{ background: 'var(--pub-bg)', padding: '56px 0 28px' }}>
```
Replace with:
```jsx
    <footer data-footer="true" className="relative border-t border-white/[0.06]" style={{ background: 'var(--pub-bg)', padding: '56px 0 28px' }}>
```

- [ ] **Step 7: Add `lp-stat-urgent` class to urgent stat numbers in `StatItem`**

Find in `StatItem()` (around line 343):
```jsx
      <div ref={ref} className="lp-stat-num-wrap font-serif leading-none mb-2" style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '3.2rem', color: urgent ? '#F87171' : '#60A5FA' }}>
```
Replace with:
```jsx
      <div ref={ref} className={`lp-stat-num-wrap font-serif leading-none mb-2${urgent ? ' lp-stat-urgent' : ''}`} style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '3.2rem', color: urgent ? '#F87171' : '#60A5FA' }}>
```

- [ ] **Step 8: Confirm no runtime errors**

With the dev server still running, check the browser console — no errors. Light mode visuals should be unchanged from Task 1 because these are just class/attribute additions with no matching CSS yet.

- [ ] **Step 9: Commit**

```bash
git add src/pages/LandingPage.jsx
git commit -m "refactor: add data attrs and helper classes to LandingPage for light mode CSS targeting"
```

---

## Task 3 — Section container background overrides

All new CSS appends **after line 11042** in `src/index.css`, inside the existing `[data-theme="light"] [data-pub]` block. Find the line:
```css
[data-theme="light"] [data-pub] .border-white\/5 { border-color: var(--pub-border-dim) !important; }
```
Everything in this task goes immediately after that line.

**Files:**
- Modify: `src/index.css` (append after line 11042)

- [ ] **Step 1: Append the section container overrides block**

```css

/* ══════════════════════════════════════════════════════════════════
   PUBLIC PAGES — WARM ACADEMIA LIGHT MODE
   All overrides scoped to [data-theme="light"] [data-pub]
   ══════════════════════════════════════════════════════════════════ */

/* ── Stats bar: bg-bg-dark is transparent (no Tailwind rule), but
      explicit colour needed for differentiation ─────────────────── */
[data-theme="light"] [data-pub] .bg-bg-dark {
  background-color: var(--pub-bg-pricing) !important;
}

/* ── How It Works: warm sand break ───────────────────────────────── */
[data-theme="light"] [data-pub] [data-hiw] {
  background-color: var(--pub-bg-sand) !important;
  background-image: radial-gradient(circle, rgba(13,27,42,0.04) 1px, transparent 1px) !important;
  background-size: 28px 28px !important;
}

/* ── Pricing section container ───────────────────────────────────── */
[data-theme="light"] [data-pub] [data-pricing] {
  background-color: var(--pub-bg-pricing) !important;
  background-image: none !important;
}

/* ── FAQ section container ───────────────────────────────────────── */
[data-theme="light"] [data-pub] [data-faq] {
  background-color: var(--pub-bg-pricing) !important;
  background-image: none !important;
}

/* ── Footer ──────────────────────────────────────────────────────── */
[data-theme="light"] [data-pub] [data-footer] {
  background: var(--pub-bg-footer) !important;
  border-top-color: rgba(13,27,42,0.09) !important;
}
```

- [ ] **Step 2: Verify in browser (light mode)**

With the dev server running and light mode active:
- Stats bar (the 4 counters: 500K+, 6 steps, 3 examiners, 1 in 3) — should be near-white `#F7F8FA`, NOT dark navy
- "How It Works" section (six numbered steps) — should be warm sand `#F2EFE8`, clearly distinct from the white features section above it
- Pricing section — should be near-white `#F7F8FA`
- FAQ section — should be near-white `#F7F8FA`
- Footer — should be light grey `#F2F4F7`, NOT dark navy

Dark mode: toggle back and confirm all sections look unchanged.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "fix: section container backgrounds in light mode — sand break for How It Works, near-white for stats/pricing/FAQ/footer"
```

---

## Task 4 — Feature cards, testimonials, stat numbers

Continue appending to the same block in `src/index.css` after Task 3's additions.

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Append feature card overrides**

```css

/* ── Feature cards: white gradient + real shadow ─────────────────── */
[data-theme="light"] [data-pub] .lp-feat-lift > div {
  background: linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 100%) !important;
  border-color: rgba(13,27,42,0.07) !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03) !important;
}

/* ── Feature card watermark: blue tint visible on white ─────────── */
[data-theme="light"] [data-pub] .lp-feat-wm {
  color: rgba(0,102,255,0.05) !important;
}

/* ── Testimonial cards: white with light border ──────────────────── */
[data-theme="light"] [data-pub] .lp-testi-card {
  background: #FFFFFF !important;
  border-color: rgba(13,27,42,0.08) !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05) !important;
}

/* ── Testimonial quote mark: softer blue on white ────────────────── */
[data-theme="light"] [data-pub] .lp-testi-card span.font-serif {
  color: rgba(0,102,255,0.15) !important;
}

/* ── Stat numbers: darker blue for legibility on light bg ────────── */
[data-theme="light"] [data-pub] .lp-stat-num-wrap:not(.lp-stat-urgent) {
  color: #0066FF !important;
}
```

- [ ] **Step 2: Verify in browser (light mode)**

- Feature cards (6 cards in the "Built for the gaps" section) — should be white with subtle shadow, each with their coloured left border (blue/green/amber/red). The faint step number watermark should be visible.
- Testimonial cards (ticker row) — should be white cards with light grey border, NOT warm cream gradient.
- Stats bar numbers (500K+, 6, 3) — should be `#0066FF` (solid blue), not the washed-out `#60A5FA`. The red "1 in 3" stat should still be red.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "fix: feature cards white with shadow, testimonials white, stat numbers darker blue in light mode"
```

---

## Task 5 — Pricing cards, FAQ card, hero eyebrow, CTA glow

Continue appending to the same block in `src/index.css`.

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Append pricing card overrides**

```css

/* ── Pricing plan cards ───────────────────────────────────────────── */
[data-theme="light"] [data-pub] .lp-plan-card {
  background: #FFFFFF !important;
  border-color: rgba(13,27,42,0.08) !important;
  box-shadow: 0 2px 8px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03) !important;
}

[data-theme="light"] [data-pub] .lp-plan-card--featured {
  background: linear-gradient(145deg, rgba(0,102,255,0.05) 0%, #FFFFFF 100%) !important;
  border-color: #0066FF !important;
  box-shadow: 0 0 0 2px rgba(0,102,255,0.12), 0 4px 16px rgba(0,102,255,0.08) !important;
}

/* Plan card divider line */
[data-theme="light"] [data-pub] .lp-plan-card hr {
  border-top-color: rgba(13,27,42,0.08) !important;
}

/* Ghost CTA buttons inside plan cards */
[data-theme="light"] [data-pub] .lp-plan-card button.bg-transparent {
  border-color: rgba(13,27,42,0.2) !important;
  color: #0D1B2A !important;
}

/* ── FAQ container card ───────────────────────────────────────────── */
[data-theme="light"] [data-pub] .lp-faq-card {
  background: #FFFFFF !important;
  border-color: rgba(13,27,42,0.08) !important;
}

/* FAQ chevron icon */
[data-theme="light"] [data-pub] .lp-faq-card .text-slate-500 {
  color: rgba(13,27,42,0.4) !important;
}

/* ── Hero eyebrow pill: softer on warm light bg ───────────────────── */
[data-theme="light"] [data-pub] .lp-hero-eyebrow {
  background: rgba(0,102,255,0.07) !important;
  border-color: rgba(0,102,255,0.2) !important;
  color: #0066FF !important;
}

/* ── Final CTA glow: much softer on light bg ─────────────────────── */
[data-theme="light"] [data-pub] .lp-cta-glow {
  background: radial-gradient(ellipse 60% 50% at 50% 70%, rgba(0,102,255,0.07) 0%, transparent 70%) !important;
}

/* ── How It Works step circle: sand bg so it floats on sand ────────── */
[data-theme="light"] [data-pub] [data-hiw] .lp-step-row > div:first-child {
  background: var(--pub-bg-sand) !important;
}
```

- [ ] **Step 2: Verify pricing section in light mode**

- Free and Defense plan cards — white with `rgba(13,27,42,0.08)` border, subtle shadow
- Student plan card (featured) — white with very faint blue tint at top, solid `#0066FF` border, faint blue glow
- Ghost "Get Started" / "Get Defense Plan" buttons — dark text on white, dark border (NOT white text/border)
- Divider lines between plan tiers and features list — light grey, NOT white-on-dark

- [ ] **Step 3: Verify FAQ section in light mode**

- FAQ container — white card, light grey border
- FAQ question text — dark (existing override handles this)
- Chevron — dark grey when closed
- Expanded answer text — `rgba(13,27,42,0.55)` (existing override handles this)

- [ ] **Step 4: Verify hero eyebrow pill**

The "Built for Nigerian Final Year Students" eyebrow pill should be: faint blue background, blue border, `#0066FF` text (solid, readable). Not the dark-mode `#60A5FA` on a very faint bg.

- [ ] **Step 5: Verify How It Works step circles**

The numbered circles (01–06) on the warm sand background should have sand as their fill — so they blend naturally into the section, floating on the sand with their blue border.

- [ ] **Step 6: Commit**

```bash
git add src/index.css
git commit -m "fix: pricing cards white with blue featured border, FAQ card white, hero eyebrow and CTA glow tuned for light mode"
```

---

## Task 6 — Full visual verification pass

No code changes in this task. This is the acceptance check.

**Files:** None

- [ ] **Step 1: Run the dev server**

```bash
npm run dev
```

- [ ] **Step 2: Landing page light mode — check every section top to bottom**

Open `http://localhost:5173` in a browser. Switch to light mode.

| Section | Expected appearance |
|---|---|
| Navbar (unscrolled) | Transparent over warm hero bg |
| Navbar (scrolled) | Warm frosted glass `rgba(250,250,247,0.97)`, dark links |
| Hero | Warm off-white gradient, blue dot grid, dark headline, dark mockup inside the hero |
| Stats bar | Near-white `#F7F8FA`, dark text, blue numbers (not `#60A5FA`), red "1 in 3" |
| Features section | White section bg, white gradient cards with shadows, coloured left borders, faint blue step number watermarks |
| How It Works | Warm sand `#F2EFE8` clearly different from white features above, dark step text, sand-bg step circles |
| Testimonials | Warm off-white section bg, white cards, light borders |
| Pricing | Near-white `#F7F8FA` bg, white plan cards, featured card has blue border |
| FAQ | Near-white `#F7F8FA` bg, white container card, dark questions, dark chevron |
| Final CTA | Warm off-white bg, very subtle blue radial glow, dark headline |
| Footer | Light grey `#F2F4F7`, dark text, NOT dark navy |

- [ ] **Step 3: Dark mode — zero regressions**

Toggle back to dark mode. Check the same sections. Everything should look identical to before this change — all overrides are scoped to `[data-theme="light"]`.

- [ ] **Step 4: Secondary public pages**

Navigate to these pages in light mode and confirm they look clean (warm backgrounds, dark text, no dark navy bleed-through):
- `/pricing`
- `/about`
- `/contact`
- `/changelog`
- `/roadmap`

These pages have no hardcoded dark values in JSX — the token update handles them automatically.

- [ ] **Step 5: Final commit if any touch-up edits were made**

```bash
git add src/index.css src/pages/LandingPage.jsx
git commit -m "fix: light mode touch-ups from visual verification pass"
```

---

## Self-review notes

**Spec coverage check:**
- ✅ Token update (6 updated + 4 new) — Task 1
- ✅ Navbar — handled by existing overrides + token update (no new CSS needed)
- ✅ Hero — token update + `lp-hero-eyebrow` class — Tasks 1, 2, 5
- ✅ Stats bar — Task 3 (`bg-bg-dark` override) + Task 4 (stat number colour)
- ✅ Features section — Task 4 (card overrides, watermark)
- ✅ How It Works — Tasks 2 (`data-hiw`) + 3 (sand bg) + 5 (step circles)
- ✅ Testimonials — Task 4 (white cards, quote mark)
- ✅ Pricing section — Tasks 2 (`lp-plan-card`, `data-pricing`) + 5 (card overrides)
- ✅ FAQ section — Tasks 2 (`lp-faq-card`, `data-faq`) + 5 (card override)
- ✅ Final CTA — Task 5 (glow reduction, auto via token)
- ✅ Footer — Tasks 2 (`data-footer`) + 3 (bg override)
- ✅ Secondary pages — handled by token update, no JSX needed

**Cascade note:** The `[data-hiw]` rule in Task 3 has equal specificity to the global `bg-bg-dark` override. The `[data-hiw]` rule must appear **after** the `bg-bg-dark` rule in the file so it wins. The plan appends them in this order — confirmed.
