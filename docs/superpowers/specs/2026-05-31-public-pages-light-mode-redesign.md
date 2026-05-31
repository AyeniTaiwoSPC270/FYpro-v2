# FYPro — Public Pages Light Mode Redesign

**Date:** 2026-05-31  
**Scope:** All public/marketing pages (landing, pricing, about, contact, changelog, roadmap, privacy, terms, cookie policy)  
**Excluded:** Any page behind login — `/app/*`, Dashboard, Signup, Login, ResetPassword, VerifyEmail  

---

## Problem

The current light mode for public pages sets `--pub-bg: #EEF2FA`, `--pub-bg-mid: #E4ECF6`, `--pub-bg-alt: #E8EFF7` — three barely-distinguishable cool blue-greys. Every section uses one of these as its background, producing a flat, washed-out blue look with no visual rhythm.

Additionally, several sections use the Tailwind class `bg-bg-dark` which resolves to `#0D1B2A` (dark navy) in both modes — the Stats bar, How It Works, Pricing, and FAQ sections all render dark in light mode even though they should be light.

The Defense Simulator mockup in the hero (component `HeroMockup`) uses hardcoded `#080F1C` — this is intentional and correct. It represents the actual app shell. It stays dark.

---

## Design Direction: Warm Academia

**Chosen in brainstorm:** Option A — warm off-white base, not cool blue.  
**Aesthetic:** Purposeful, typographically rich, like an academic document that has been designed rather than defaulted.  
**Not:** generic SaaS, cold white, or blue-washed.

---

## Color Token Changes (`src/index.css` — light mode block)

### Updated tokens

| Token | Old value | New value | Description |
|---|---|---|---|
| `--pub-bg` | `#EEF2FA` | `#FAFAF7` | Warm white — base for hero, testimonials, CTA, footer |
| `--pub-bg-mid` | `#E4ECF6` | `#F2F0EA` | Warm cream — used in hero gradient |
| `--pub-bg-alt` | `#E8EFF7` | `#F7F5F0` | Warm parchment — used in animated hero gradient |
| `--pub-nav-bg` | `rgba(255,255,255,0.85)` | `rgba(250,250,247,0.88)` | Warm frosted nav (unscrolled) |
| `--pub-nav-scrolled` | `rgba(255,255,255,0.97)` | `rgba(250,250,247,0.97)` | Warm frosted nav (scrolled) |
| `--pub-nav-solid` | `rgba(255,255,255,0.99)` | `rgba(250,250,247,0.99)` | Mobile menu background |

### New tokens (add to light mode block only)

| Token | Value | Used by |
|---|---|---|
| `--pub-bg-sand` | `#F2EFE8` | How It Works section background |
| `--pub-bg-section` | `#FFFFFF` | Features section background |
| `--pub-bg-pricing` | `#F7F8FA` | Pricing + FAQ section background |
| `--pub-bg-footer` | `#F2F4F7` | Footer background (light mode) |

---

## Section-by-Section Spec

### Navbar

- Background unscrolled: transparent (over warm hero)
- Background scrolled: `var(--pub-nav-scrolled)` with `backdrop-filter: blur(12px)`
- Nav links: `var(--pub-text)` = `#0D1B2A` at 55% opacity, hover full opacity
- "Login" ghost button: dark border `rgba(13,27,42,0.22)`, dark text
- "Try Free / Start Free" CTA: `#0066FF` fill, white text — unchanged
- Mobile menu background: `var(--pub-nav-solid)`
- Active underline indicator: `#0066FF` — unchanged

**Current problem:** Nav links are `text-white/65` in JSX, which the existing `[data-theme="light"] [data-pub]` override already catches. Nav scroll border is `rgba(0,102,255,0.18)` — fine in light mode, keep as-is.

---

### Hero Section

- Background: animated `linear-gradient(135deg, var(--pub-bg) 0%, var(--pub-bg-alt) 28%, var(--pub-bg-mid) 54%, var(--pub-bg-alt) 80%, var(--pub-bg) 100%)` — with updated tokens this becomes warm automatically, no JSX change needed
- Dot grid overlay: `rgba(0,102,255,0.04)` 1px dots — unchanged, subtle on warm bg
- Blue radial at top: `rgba(0,102,255,0.18)` ellipse — unchanged, still gives depth on warm
- Eyebrow pill: blue `rgba(0,102,255,0.1)` background, `rgba(0,102,255,0.3)` border, `#60A5FA` text — add light-mode override: background `rgba(0,102,255,0.07)`, border `rgba(0,102,255,0.2)`, text `#0066FF`
- Headline `h1`: `text-white` — existing light override catches this → `#0D1B2A`
- Sub paragraph: `text-white/65` — existing override → `rgba(13,27,42,0.6)`
- `HeroMockup` component: hardcoded `background: '#080F1C'` — **do not change**. It represents the real app shell. It reads correctly as "this dark thing is what you're signing up for."
- Bottom fade: `linear-gradient(to bottom, transparent, var(--pub-bg))` — auto-correct with token update

---

### Stats Bar

- **Root cause:** `className="bg-bg-dark ..."` → dark navy in both modes
- Light mode fix: add `[data-theme="light"] [data-pub] .bg-bg-dark` override → `background: var(--pub-bg-pricing) !important`
- Text: `lp-stat-num-wrap` uses hardcoded `color: '#60A5FA'` (blue) — add light override → `#0066FF`
- Urgent stat (`color: '#F87171'`) stays red in both modes — correct
- Muted label: `var(--pub-text-muted)` — auto-correct

---

### Features Section

- **Root cause:** `style={{ background: 'var(--pub-bg)' }}` — token update fixes this automatically → `#FAFAF7`
- Feature cards: `background: 'linear-gradient(150deg,var(--pub-bg-mid) 0%,var(--pub-bg-alt) 100%)'` → warm cream gradient automatically with token update. But this doesn't look distinctive enough for light mode.
- **Override:** In light mode, feature cards get `background: linear-gradient(145deg, #FFFFFF 0%, #F8FAFC 100%)` with `border: 1px solid rgba(13,27,42,0.07)` and `box-shadow: 0 2px 8px rgba(0,0,0,0.05), 0 1px 2px rgba(0,0,0,0.03)`
- Left border accent colours (blue/green/amber/red): unchanged — these work in both modes
- Card hover border: override to `rgba(0,102,255,0.25)` instead of `rgba(0,102,255,0.4)` (slightly less intense on light)
- Step number watermark: `rgba(255,255,255,0.025)` → light mode override → `rgba(0,102,255,0.04)` (blue tint visible on white)
- Icon background `iconBg` (e.g. `rgba(0,102,255,0.12)`): unchanged — works on white
- Card kicker, title, description: existing `[data-pub]` text overrides catch these

---

### How It Works Section

- **Root cause:** `className="py-24 bg-bg-dark"` → dark in both modes
- Light mode fix: same `bg-bg-dark` override → `background: var(--pub-bg-sand) !important` — but this conflicts with the global override for Stats Bar and Pricing
- **Solution:** Add `data-hiw="true"` attribute to the `<section>` in `HowItWorks()` in `LandingPage.jsx`. Then target specifically: `[data-theme="light"] [data-pub] [data-hiw] { background: var(--pub-bg-sand) !important; }`
- Dot grid on sand section: `radial-gradient(circle, rgba(13,27,42,0.04) 1px, transparent 1px)` — dark dots on warm sand
- Vertical connector line: `linear-gradient(to bottom, #0066FF, rgba(0,102,255,0.08))` — unchanged, reads well on sand
- Step number circles: background override → `var(--pub-bg-sand)` so they don't show white circle on sand bg
- Step title: `text-white` → existing override → dark
- Step description: `text-white/65` → existing override → `rgba(13,27,42,0.55)`

---

### Testimonials Section

- `style={{ background: 'var(--pub-bg)' }}` → `#FAFAF7` automatically with token update
- Testimonial cards: currently `background: 'linear-gradient(150deg, var(--pub-bg-mid) 0%, var(--pub-bg-alt) 100%)'` → warm cream in light mode (acceptable)
- **Override to white cards:** `[data-theme="light"] [data-pub] .lp-testi-card { background: #FFFFFF !important; border-color: rgba(13,27,42,0.08) !important; }`
- Quote mark `"`: currently `rgba(37,99,235,0.4)` → light mode override → `rgba(0,102,255,0.15)`
- Card quote text `text-white/[0.78]`: existing override catches this → dark
- Name `text-white`: existing override → dark
- Dept `text-white/65`: existing override → dark
- Fade overlays use `var(--pub-bg)` for gradient edges — auto-correct with token

---

### Pricing Section

- **Root cause:** `className="py-24 bg-bg-dark"` → dark in both modes
- Light mode fix: `[data-theme="light"] [data-pub] [data-pricing] { background: var(--pub-bg-pricing) !important; }` — add `data-pricing="true"` to pricing section
- Plan cards: `background: 'linear-gradient(150deg,var(--pub-bg-mid) 0%,var(--pub-bg-alt) 100%)'` → override to white `#FFFFFF` in light mode with `rgba(13,27,42,0.08)` border
- Featured plan: `background: 'linear-gradient(150deg, rgba(0,102,255,0.1) 0%, var(--pub-bg-mid) 100%)'` → override to `linear-gradient(145deg, rgba(0,102,255,0.05) 0%, #FFFFFF 100%)` with `#0066FF` border
- Feature list items: `text-white/[0.72]` → existing override → dark
- "MOST POPULAR" badge: blue fill stays — unchanged
- Divider `<hr>`: `border-white/[0.07]` → override to `rgba(13,27,42,0.08)`
- Period text, tier label `text-white/65`: existing overrides catch these
- CTA buttons: ghost buttons get dark border/text in light mode via existing overrides

---

### FAQ Section

- **Root cause:** `className="pt-24 pb-14 bg-bg-dark"` → dark in both modes  
- Light mode fix: `[data-theme="light"] [data-pub] [data-faq] { background: var(--pub-bg-pricing) !important; }` — add `data-faq="true"`
- FAQ container card: `background: 'linear-gradient(150deg, var(--pub-bg-mid) 0%, var(--pub-bg-alt) 100%)'` → override to `#FFFFFF` with `rgba(13,27,42,0.08)` border
- FAQ border dividers `border-white/[0.06]`: override to `rgba(13,27,42,0.07)`
- Question text `text-white`: existing override → dark
- Answer text `text-slate-400`: existing override → `rgba(13,27,42,0.55)`
- Chevron icon `text-slate-500`: override → `rgba(13,27,42,0.4)`

---

### Final CTA Section

- `style={{ background: 'var(--pub-bg)' }}` → `#FAFAF7` automatically with token update
- `lp-cta-glow` div: `background: radial-gradient(ellipse 60% 50% at 50% 70%, rgba(0,102,255,0.22) 0%, transparent 70%)` → light mode override → `rgba(0,102,255,0.08)` (much softer glow on light bg)
- Shield icon: `filter: drop-shadow(0 4px 18px rgba(0,102,255,0.45))` → light mode → `rgba(0,102,255,0.3)`
- Heading `text-white`: existing override → dark
- Body `text-white/65`: existing override → dark
- Italic `color: var(--pub-text-em)` — auto-correct
- Urgency pulsing dot stays red — correct on light bg
- CTA buttons: existing overrides handle these

---

### Footer

- Currently `style={{ background: 'var(--pub-bg)' }}` → auto-correct to `#FAFAF7`
- But the footer should be slightly differentiated — use `var(--pub-bg-footer)` = `#F2F4F7`
- **Solution:** Add `data-footer="true"` to the footer element. Override: `[data-theme="light"] [data-pub] [data-footer] { background: var(--pub-bg-footer) !important; border-top-color: rgba(13,27,42,0.09) !important; }`
- Column headings `text-white`: existing override → dark at full opacity
- Links `text-white/65`: existing override → `rgba(13,27,42,0.5)`
- Copyright `text-white/[0.28]`: existing override → `rgba(13,27,42,0.3)`
- Logo float animation: unchanged
- Privacy/Terms/Cookie links: same as links above

---

### Scroll Progress Bar

- Currently hardcoded `backgroundColor: '#2563EB'` (blue line at top) — unchanged, correct in both modes

---

## Secondary Public Pages

All secondary pages (`Pricing.jsx`, `About.jsx`, `Contact.jsx`, `ChangelogPage.jsx`, `RoadmapPage.jsx`, `Privacy.jsx`, `Terms.jsx`, `CookiePolicy.jsx`) use `var(--pub-*)` tokens and `data-pub="true"` on their root elements. **Verified:** none of these files contain hardcoded dark hex values in JSX `style` props. Updating the CSS tokens fixes them automatically — no JSX changes required for any of these files.

---

## Implementation Notes

### `data-*` attribute pattern for section targeting

Because multiple sections use `bg-bg-dark` (which maps to different background colours depending on section), the global override `[data-theme="light"] [data-pub] .bg-bg-dark` cannot target them individually. Solution: add specific `data-*` attributes to sections in `LandingPage.jsx` and target them individually in CSS.

Sections that need attributes added:
- `<section id="how-it-works" ...>` → add `data-hiw="true"`
- `<section id="pricing" ...>` → add `data-pricing="true"`
- `<section id="faq" ...>` → add `data-faq="true"`
- `<footer ...>` → add `data-footer="true"`

Stats bar does not need an attribute — `bg-bg-dark` global override (`var(--pub-bg-pricing)`) is fine for it.

### Existing override system

The file already contains a large `[data-theme="light"] [data-pub]` block at the bottom of `index.css`. All new light-mode overrides for public pages append to this block. Do not scatter overrides elsewhere.

### What does not change

- Dark mode: zero changes — all new CSS is scoped to `[data-theme="light"]`
- App routes (`/app/*`): zero changes — scoped to `[data-pub]`
- `HeroMockup` dark colours: zero changes — intentional
- `SectionDivider` (animated blue line): unchanged
- Any component inside the authenticated shell

---

## Files Modified

| File | Type of change |
|---|---|
| `src/index.css` | Update 6 token values, add 4 new tokens, add ~60 lines of `[data-theme="light"] [data-pub]` overrides |
| `src/pages/LandingPage.jsx` | Add `data-hiw`, `data-pricing`, `data-faq`, `data-footer` attributes to 4 elements only |
| All other public pages | No JSX changes — token update in `index.css` is sufficient |

---

## Verification

After implementation, toggle light mode and check:
1. Landing page — every section has warm (not blue) background
2. Hero — warm off-white with dark app mockup embedded, no visual clash
3. How It Works — warm sand (`#F2EFE8`), visible as distinct from adjacent white sections
4. Feature cards — white cards with real shadows and coloured left borders
5. Pricing cards — white on near-white, featured card has blue border
6. Footer — light grey, dark text links, no dark navy
7. Pricing page, About, Contact — no dark sections unless intentionally dark
8. Dark mode — zero regressions, everything unchanged
