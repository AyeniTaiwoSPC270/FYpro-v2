# FYPro — Master Design System

> **LOGIC:** When building a specific page or step, first check `design-system/fypro/pages/[page].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow this document.

**Project:** FYPro — AI-Powered Final Year Project Companion
**Version:** 2.0 | **Date:** 2026-09-02
**Stack:** React (Vite) + Tailwind + CSS custom properties. Not vanilla HTML/JS — v1 was removed from the repo May 2026.
**Aesthetic Direction:** Dark academia × Precision engineering × African digital product

---

## 1. Design Philosophy

FYPro is not a generic SaaS tool. It is a *companion* — serious, authoritative, and warm.
It should feel like the smartest professor in the department redesigned their entire office into an app.

**The three pillars:**
- **Dark academia** — Deliberate, typographically rich, authoritative. The kind of UI that makes you feel like your work matters.
- **Precision engineering** — Monospace scores, structured layouts, clinical data readouts. Every pixel earns its place.
- **African digital product** — Confident, modern, never derivative of Western defaults. Uses color and warmth with intention, not restraint.

**What the UI must never be:**
- A white card floating on a grey background
- A purple-gradient AI startup clone
- Generic Inter + blue button everything
- Cold or sterile — it has warmth within its darkness

**Deliberate register divergence:** general product-UI guidance discourages display/serif typefaces in dashboards and app chrome (they read as decoration, not function). FYPro breaks that rule on purpose — DM Serif Display on step headings is core to "dark academia" and to *not* looking like Linear/Notion/generic-SaaS. This is a considered trade-off, not an oversight: keep it, but never let a serif leak into data, labels, or anything that needs to be scanned quickly (see §3).

---

## 2. Color Palette

> **Rule:** Always use CSS variables. Never hardcode hex values in component CSS — including inside example snippets in this document. If a color isn't tokenized yet, add the token here first.

```css
:root {
  /* ─── Primary Backgrounds ─────────────────────────── */
  --color-bg-deep:        #060E18;   /* Defense Mode — very dark navy */
  --color-bg-dark:        #0D1B2A;   /* Sidebar, primary dark surfaces */
  --color-bg-mid:         #0F2235;   /* Secondary dark surfaces, hover states */
  --color-bg-surface:     #F0F4F8;   /* Main content workspace (light shell) */
  --color-bg-card:        #FFFFFF;   /* Card backgrounds */

  /* ─── Brand Blues ─────────────────────────────────── */
  --color-blue-primary:   #0066FF;   /* Primary action, CTAs, active states */
  --color-blue-light:     #3B82F6;   /* Secondary elements */
  --color-blue-glow:      rgba(0, 102, 255, 0.15);
  --color-blue-subtle:    #EFF6FF;   /* Light blue tint backgrounds */

  /* ─── Accent Colors ───────────────────────────────── */
  --color-green:          #16A34A;   /* Success, confirm, completed, primary CTA */
  --color-green-dark:     #15803D;
  --color-green-light:    #F0FFF4;
  --color-red:            #DC2626;   /* Error, critical flags, danger */
  --color-red-light:      #FFF5F5;
  --color-amber:          #F59E0B;   /* Warning, buffer weeks, serious flags */
  --color-amber-light:    #FFFBEB;
  --color-teal:           #0891B2;   /* Writing Planner / secondary data accent */
  --color-orange:         #EA580C;

  /* ─── Per-step accent identity ────────────────────── */
  --color-step-topic:      #0066FF;  /* Step 1 — Topic Validator */
  --color-step-chapter:    #F59E0B;  /* Step 2 — Chapter Architect */
  --color-step-method:     #16A34A;  /* Step 3 — Methodology Advisor */
  --color-step-instrument: #8B5CF6;  /* Step 4 — Instrument Builder */
  --color-step-writing:    #0891B2;  /* Step 5 — Writing Planner */
  --color-step-defense:    #DC2626;  /* Step 6 — Defense Prep */

  /* ─── Text ────────────────────────────────────────── */
  --color-text-primary:   #0D1B2A;
  --color-text-secondary: rgba(13, 27, 42, 0.6);
  --color-text-muted:     rgba(13, 27, 42, 0.4);
  --color-text-faint:     rgba(13, 27, 42, 0.25);
  --color-text-white:     #FFFFFF;
  --color-text-white-dim: rgba(255, 255, 255, 0.7);
  --color-text-white-faint: rgba(255, 255, 255, 0.45);

  /* ─── Borders ─────────────────────────────────────── */
  --color-border:         rgba(13, 27, 42, 0.1);
  --color-border-strong:  rgba(13, 27, 42, 0.2);
  --color-border-blue:    rgba(0, 102, 255, 0.3);
  --color-border-white:   rgba(255, 255, 255, 0.08);
  --color-border-white-strong: rgba(255, 255, 255, 0.15);

  /* ─── Card surface gradients (subtle sheen, not hex-in-place) ─ */
  --gradient-card-blue:   linear-gradient(145deg, var(--color-bg-card) 0%, #f4f8ff 100%);
  --gradient-card-amber:  linear-gradient(145deg, var(--color-bg-card) 0%, #fffdf5 100%);
  --gradient-card-green:  linear-gradient(145deg, var(--color-bg-card) 0%, #f4fff8 100%);
  --gradient-card-violet: linear-gradient(145deg, var(--color-bg-card) 0%, #faf7ff 100%);
  --gradient-card-cyan:   linear-gradient(145deg, var(--color-bg-card) 0%, #f3fbfd 100%);
  --gradient-card-red:    linear-gradient(145deg, var(--color-bg-card) 0%, #fff5f5 100%);
  --gradient-sidebar:     linear-gradient(180deg, var(--color-bg-dark) 0%, #091420 100%);

  /* ─── Shadows ─────────────────────────────────────── */
  --shadow-card:          0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04);
  --shadow-card-hover:    0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-blue-glow:     0 0 24px rgba(0, 102, 255, 0.4);
  --shadow-blue-glow-soft:0 0 16px rgba(0, 102, 255, 0.25);
  --shadow-green-glow:    0 0 20px rgba(22, 163, 74, 0.35);
  --shadow-red-glow:      0 0 18px rgba(220, 38, 38, 0.35);
  --shadow-shield:        0 8px 32px rgba(0, 102, 255, 0.45);
}
```

**Glow shadows — use with intent, not by default.** `--shadow-blue-glow` / `--shadow-green-glow` are already used across most primary-action hovers in the shipped app, so they stay as tokens. But a full-bleed glow on every hover is a well-known generic-AI-tool tell. For **new** components, default to `--shadow-card-hover` (a neutral, background-tinted lift) and reach for a glow token only on the one or two actions per screen that are meant to feel like the "electric" primary action (Defense Simulator submit, primary step CTA) — not on every button.

### Color Usage Map

| Context | Variable | Rationale |
|---------|----------|-----------|
| Page background (dark zones) | `--color-bg-dark` | Sidebar, defense mode |
| Page background (workspace) | `--color-bg-surface` | Light, textured — not white |
| Card background | `--color-bg-card` | White cards on textured surface |
| Primary CTA (Continue, Confirm, Use This) | `--color-green` | Completion, forward motion — not blue |
| Generate / Analyse / Validate | `--color-blue-primary` | Active processing — feels electric |
| Ghost / Secondary | Transparent + border | Never fill ghost buttons |
| Danger | `--color-red` border only | Never solid red fill unless actively pressed |
| Active step indicator | `--color-blue-primary` | Navigator dots, sidebar active state |
| Companion card identity | `--color-step-*` | Literature Map / Abstract Generator / Instrument Builder each get their parent step's accent, not a new color |

---

## 2b. Theming — Light & Dark Mode

Both modes are first-class on every page, public and authenticated. This is not optional or a stretch goal — treat it as a hard requirement on any new component.

**Mechanism:** the active theme is applied as `[data-theme="light"]` / `[data-theme="dark"]` on a root element (also mirrored as `.light` / `.dark` classes in some older selectors) and toggled by `src/context/ThemeContext.jsx`. Two token layers exist and both matter:

1. **Static CSS custom properties** — the `--color-*` scale in §2, defined once in `src/styles/design-system.css`. These are the ones this document specifies and the ones new components should reach for.
2. **Runtime theme tokens** — `--bg-base`, `--bg-card`, `--bg-sidebar`, `--bg-input`, `--text-primary`, `--text-secondary`, `--text-muted`, `--border-color`, `--sidebar-gradient-end`, referenced with fallback values (e.g. `var(--bg-base, #060E18)`) throughout `base.css` and `light-mode.css`. These flip value per theme and predate the `--color-*` set. Don't invent a third naming scheme — if a component needs a themed value, check whether it already has a `--bg-*`/`--text-*`/`--border-color` runtime token before reaching for a `--color-*` static one.

Light-mode overrides for both layers live in `src/styles/light-mode.css` (2,000+ lines — this document doesn't restate every override; treat that file as the source of truth for exact per-component light values). The canonical example: `--color-text-primary` defaults to `#0D1B2A` (dark navy, correct for light surfaces) at the root, while `.app-content` on the dark shell explicitly re-pins several `--color-*` and `--text-*` tokens together so text stays legible against the light workspace regardless of which layer a given component reads from.

**When building new UI:** write one sentence of physical scene (who's looking at this, on what device, in what light) before defaulting to dark — see the shared design law. FYPro's own answer, already encoded in the shipped app, is: dark shell as the default mood (matches "dark academia"), full light-mode parity because Nigerian students use this in bright rooms, on shared devices, during the day. Don't relitigate that per-component; just implement both.

---

## 3. Typography

> **Rule:** Three fonts, three roles. Never substitute with system fonts. This is FYPro's one deliberate exception to product-register default typography guidance — see §1.

```css
/* Already imported in index.html — do not re-import */
/* DM Serif Display — Headings, step labels, hero text */
/* Poppins — All body text, descriptions, labels, buttons */
/* JetBrains Mono — Verdicts, scores, badges, technical readouts */
```

```css
:root {
  --font-display: 'DM Serif Display', 'Georgia', serif;
  --font-body:    'Poppins', -apple-system, sans-serif;
  --font-mono:    'JetBrains Mono', 'Menlo', monospace;
}
```

### Type Scale

```css
:root {
  --text-xs:    0.65rem;    /* ~10.4px — tiny labels, mono badges */
  --text-sm:    0.75rem;    /* 12px — metadata, uppercase labels */
  --text-base:  0.875rem;   /* 14px — body text, descriptions */
  --text-md:    1rem;       /* 16px — emphasized body */
  --text-lg:    1.125rem;   /* 18px — onboarding tagline */
  --text-xl:    1.4rem;     /* 22.4px — step labels (serif) */
  --text-2xl:   1.875rem;   /* 30px — onboarding wordmark */
  --text-3xl:   2.75rem;    /* 44px — splash wordmark */

  --tracking-tight: 0.01em;
  --tracking-base:  0.02em;
  --tracking-wide:  0.04em;
  --tracking-caps:  0.1em;
}
```

### Typography Rules

| Element | Font | Weight | Size |
|---------|------|--------|------|
| Step name / hero heading | DM Serif Display | 400 | `--text-3xl` |
| Section headings | DM Serif Display | 400 | `--text-2xl` |
| Body text | Poppins | 400 | `--text-base` |
| Button labels | Poppins | 600 | `--text-base` |
| Form labels | Poppins | 500 | `--text-sm` |
| AI verdict / score | JetBrains Mono | 700 | `--text-xl` |
| Step number (watermark) | JetBrains Mono | 700 | 120px+ |
| Technical badges | JetBrains Mono | 500 | `--text-xs` |

**Never** put DM Serif Display on a data value, a table cell, a badge, or anything that needs to be scanned quickly — that's what breaks the "product, not brand poster" contract. Serif is for headings and hero moments only.

**Line height:** `--leading-tight` 1.3 for headings, `--leading-base` 1.6 for body, `--leading-relaxed` 1.65 for longer copy blocks, 1.0 for badges/mono.
**Line length:** Max 70ch for body text blocks — never full-width paragraphs.

---

## 4. Spacing & Layout

```css
:root {
  --space-xs:   4px;
  --space-sm:   8px;
  --space-md:   16px;
  --space-lg:   24px;
  --space-xl:   32px;
  --space-2xl:  48px;
  --space-3xl:  64px;
}
```

### Layout Zones

| Zone | Width | Background |
|------|-------|------------|
| Sidebar | 260px fixed | `--color-bg-dark` |
| Content workspace | flex-fill | `--color-bg-surface` with dot pattern |
| Step card | max-width 660px | `--color-bg-card` |
| Defense panel | full width | `--color-bg-deep` |

### Content Area Texture
The workspace must feel like a surface, not a void:
```css
.app-content {
  background-color: var(--color-bg-surface);
  background-image: radial-gradient(circle, rgba(0, 102, 255, 0.06) 1px, transparent 1px);
  background-size: 28px 28px;
}
```

### Multi-surface layouts (dashboard, admin)
Not every screen is a single centered step card. The multi-project dashboard grid, `/admin/health` Mission Control tabs, and gamification surfaces (badges, achievements, momentum ring) are all real, shipped parts of the product and follow the same tokens — but they're grids and panels, not step cards. Don't force a step-card shape onto them. Companion cards (Literature Map, Abstract Generator inside Chapter Architect; Instrument Builder inside Methodology Advisor) nest inside their parent step card — when they do, they must NOT visually read as a second, competing card: no independent drop shadow stacked on top of the parent's, inherit the parent step's accent color (`--color-step-*`) rather than picking a new one, and keep their own elevation flat relative to the parent.

---

## 5. Border Radius

```css
:root {
  --radius-sm:   8px;
  --radius-md:   10px;
  --radius-lg:   12px;
  --radius-xl:   16px;
  --radius-2xl:  24px;
  --radius-pill: 999px;
}
```

| Element | Radius |
|---------|--------|
| Step cards | `--radius-lg` |
| Buttons | `--radius-md` |
| Badges / tags | `--radius-pill` |
| Input fields | `--radius-sm` |
| Modals | `--radius-2xl` |
| Sidebar items (active) | `--radius-sm` |

---

## 6. Component Patterns

### Step Card (Base Pattern)
Every step uses this as the starting point:
```css
.step-card {
  background: var(--gradient-card-blue);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
  padding: 40px;
  width: 100%;
  max-width: 660px;
  position: relative;
  overflow: hidden;
  animation: card-enter 0.4s var(--ease-out-expo) forwards;
}

.step-card:hover {
  box-shadow: var(--shadow-card-hover);
  transition: box-shadow var(--transition-base);
}

/* Step number watermark — each step sets its own content */
.step-card::before {
  content: attr(data-step);
  font-family: var(--font-mono);
  font-size: 140px;
  font-weight: 700;
  color: rgba(0, 102, 255, 0.04);
  position: absolute;
  top: -20px;
  right: -10px;
  line-height: 1;
  pointer-events: none;
  user-select: none;
}
```
Swap `--gradient-card-blue` for the matching `--gradient-card-*` token when a step wants a different undertone (e.g. amber for Chapter Architect, green for Methodology Advisor) instead of introducing a new hardcoded gradient.

### Card Entry Animation
```css
@keyframes card-enter {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
```

### Buttons — Four Variants

```css
/* 1. Primary CTA — Confirm, Continue, Use This Topic */
.btn-primary {
  background: var(--color-green);
  color: var(--color-text-white);
  border: none;
  padding: 14px 28px;
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-weight: 600;
  font-size: var(--text-base);
  cursor: pointer;
  transition: all var(--transition-base);
}
.btn-primary:hover {
  box-shadow: var(--shadow-green-glow);
  transform: translateY(-1px);
}

/* 2. Action — Generate, Validate, Analyse */
.btn-action {
  background: var(--color-blue-primary);
  color: var(--color-text-white);
  border: none;
  padding: 14px 28px;
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-weight: 600;
  font-size: var(--text-base);
  cursor: pointer;
  transition: all var(--transition-base);
}
.btn-action:hover {
  box-shadow: var(--shadow-blue-glow);
  transform: translateY(-1px);
}
.btn-action:disabled {
  opacity: 0.5;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
}

/* 3. Ghost / Secondary */
.btn-ghost {
  background: transparent;
  color: var(--color-text-primary);
  border: 1.5px solid var(--color-border-strong);
  padding: 13px 27px;
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-weight: 600;
  font-size: var(--text-base);
  cursor: pointer;
  transition: all var(--transition-base);
}
.btn-ghost:hover {
  background: var(--color-blue-subtle);
  border-color: var(--color-blue-primary);
  color: var(--color-blue-primary);
}

/* 4. Danger */
.btn-danger {
  background: transparent;
  color: var(--color-red);
  border: 1.5px solid var(--color-red);
  padding: 13px 27px;
  border-radius: var(--radius-md);
  font-family: var(--font-body);
  font-weight: 600;
  cursor: pointer;
  transition: all var(--transition-base);
}
.btn-danger:hover {
  background: var(--color-red-light);
}
```

### Input Fields

```css
.form-input {
  width: 100%;
  padding: 14px 16px;
  border: 1.5px solid var(--color-border-strong);
  border-radius: var(--radius-sm);
  font-family: var(--font-body);
  font-size: var(--text-base);
  color: var(--color-text-primary);
  background: var(--bg-input);
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  line-height: var(--leading-base);
}
.form-input:focus {
  outline: none;
  border-color: var(--color-blue-primary);
  box-shadow: 0 0 0 3px var(--color-blue-glow);
  background: var(--color-bg-card);
}
.form-input::placeholder {
  color: var(--color-text-muted);
}
```

### Loading State

```css
.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: var(--space-md);
  padding: var(--space-2xl);
}
.loading-state .spinner {
  animation: spin 1s linear infinite;
}
@keyframes spin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
/* Always disable the trigger button while loading */
/* Always show loading state before any API call fires */
/* Use the shared Spinner component (src/components/Spinner.jsx) rather than a bespoke spinner per feature */
```

### Section Reveal Pattern

React state drives visibility (`useState`/conditional render) — this replaced the earlier `classList.add/remove('STEP-section--visible')` DOM-toggle pattern when the app moved off vanilla JS. Don't reintroduce direct `classList` manipulation in a React component.

```css
.STEP-section--visible { display: block; animation: card-enter 0.35s var(--ease-out-expo) forwards; }
.STEP-section--hidden  { display: none; }
```

---

## 7. Navigation Components

### Step Navigator (Top Dots)

| State | Treatment |
|-------|-----------|
| Completed | Solid `--color-blue-primary` + subtle pulse on first completion |
| Active | Solid `--color-blue-primary` + glow ring |
| Inactive | `rgba(13, 27, 42, 0.2)` — no decoration |
| Connecting line | Gradient: blue → grey as completed → incomplete |

```css
@keyframes dot-complete {
  0%   { transform: scale(1); box-shadow: none; }
  50%  { transform: scale(1.3); box-shadow: 0 0 12px rgba(0, 102, 255, 0.6); }
  100% { transform: scale(1); box-shadow: none; }
}
/* Trigger once when step completes */
```

### Sidebar

```css
.app-sidebar {
  background: var(--gradient-sidebar);
  width: 260px;
}

/* Completed step checkmark */
@keyframes check-appear {
  from { transform: scale(0.35); opacity: 0; }
  to   { transform: scale(1); opacity: 1; }
}
.step-check { animation: check-appear 0.4s var(--ease-out-expo) forwards; }
```

**Active-state indicator — legacy pattern, don't extend it.** The shipped sidebar (`.sidebar__context-card`, `.db-sidebar-active`), chapter rows (`.ca-chapter-row`), and dashboard active-step row (`.db-step-active-row`) all currently signal "active/current" with a colored `border-left`. That's a side-stripe accent, which is a well-documented generic-AI-tool tell and is on the explicit anti-pattern list below — it's already pervasive enough in the shipped app that ripping it out everywhere is its own migration project, not a documentation fix. For any **new** active/selected-state component, use a background tint (`rgba(0, 102, 255, 0.08)`-style, already the established hover/active fill) plus font-weight or a leading icon instead of a border-left. Do not add new `border-left` accents to match the old pattern.

---

## 8. Transitions

```css
:root {
  --transition-fast:   0.15s ease;
  --transition-base:   0.2s ease;
  --transition-slow:   0.35s ease;
  --ease-out-expo:      cubic-bezier(0.22, 1, 0.36, 1);
}
```

**Rules:**
- Micro-interactions (hover, focus, simple opacity/color changes): `--transition-fast` / `--transition-base` with plain `ease` — these are short enough that the curve doesn't read.
- Anything with real motion distance — card entry, panel slides, section reveals, checkmarks — use `--ease-out-expo`, not plain `ease` and never a bounce/overshoot curve (no `cubic-bezier` values that exceed 1.0, e.g. `1.56`). The one sanctioned exception is a deliberate "pop" on verdict/status badges (`badge-bounce-in`), which is a considered flourish for a specific high-stakes moment (Defense Simulator scoring), not a default.
- Loading spinners: `1s linear infinite`.
- Never animate `width`, `height`, or other layout properties — only `transform` and `opacity`.

---

## 9. CSS Naming Convention

Each feature has its own prefix. **Never mix prefixes between features** — a class using the wrong prefix is a correctness bug, not a style nit.

| Feature | Prefix |
|------|--------|
| Step 1 — Topic Validator | `tv-` |
| Step 2 — Chapter Architect | `ca-` |
| Step 3 — Methodology Advisor | `ma-` |
| Step 4 — Instrument Builder | `di-` *(the CSS file is `instrument-builder.css`, but the classes are `di-*`, not `ib-*` — verified against `src/styles/instrument-builder.css`)* |
| Step 5 — Writing Planner | `wp-` |
| Step 6 — Defense Prep / Defense Simulator | `dp-` |
| Supervisor Email | `se-` |
| Supervisor Meeting Prep Agent | `sp-` |
| Literature Map (companion card) | `lm-` |
| Abstract Generator (companion card) | `ag-` |
| Project Reviewer | `pr-` |
| Express Defence shell | `es-` |
| Onboarding questions / TourCarousel | `oq-` |
| Defence Brief | `db-` |

> **⚠ Known collision, unresolved:** `db-` is currently used for **both** Defence Brief (`src/styles/defense-brief.css`, as intended) **and** the Dashboard premium animations block in `src/styles/light-mode.css` (`.db-header-enter`, `.db-step-active-row`, `.db-sidebar-item`, `.db-sidebar-active`, `.db-bar-red-glow`, `.db-quick-icon`, `.db-quick-card`). This wasn't caught before both shipped. It hasn't caused a visible clash yet because the class *names* don't literally overlap, only the *prefix* does — but it violates the naming rule and the next person adding a `db-` class to either feature could easily collide for real. Recommend renaming the Dashboard block to `dash-` in a dedicated follow-up (touches `light-mode.css` and the Dashboard JSX that applies these classes) rather than folding it into this document pass.

New CSS always appends to the bottom of the relevant `src/styles/*.css` file inside a clearly delimited block:
```css
/* ═══════════════════════════════════════════════════════
   FEATURE NAME — prefix-
   ═══════════════════════════════════════════════════════ */
```

---

## 10. Z-Index Scale

```css
:root {
  --z-base:     1;
  --z-card:     10;
  --z-sticky:   20;
  --z-dropdown: 30;
  --z-modal:    50;
  --z-toast:    60;
}
```

---

## 11. Anti-Patterns

**Visual:**
- White cards on plain grey backgrounds — always add texture to the workspace
- Purple gradients — ever
- All cards looking identical — differentiate each step
- Flat, uninteresting backgrounds — add depth, texture, character
- Side-stripe (`border-left`/`border-right`) accents on **new** components — see §7. It's tolerated as legacy in a handful of already-shipped places, never added fresh.
- A glow shadow on every hover — reserve `--shadow-blue-glow`/`--shadow-green-glow` for the one or two primary actions per screen that should feel electric, default to `--shadow-card-hover` otherwise

**Typography:**
- Inter, Roboto, Arial, or system fonts as primary typeface
- DM Serif Display anywhere except headings/hero text — never on data, labels, or badges
- All-caps body text
- Line lengths beyond 70ch
- Bounce/overshoot easing (`cubic-bezier` values above 1.0) on anything but the sanctioned badge-pop moment

**Color:**
- Generic blue as the only CTA color — green for confirm/continue
- Solid red fill for danger buttons (border only)
- Hardcoded hex values in component CSS — including in this document; add a token instead

**Interaction:**
- No loading state before API calls
- Two simultaneous API calls from the same step
- `JSON.parse()` without `try/catch`
- Missing `cursor: pointer` on interactive elements
- Direct `classList` manipulation for show/hide inside a React component — use conditional render / state instead (see §6)

**Layout:**
- Forcing every screen into the single-step-card shape — dashboards, admin, and grid surfaces get their own patterns (§4)
- Content hidden behind fixed navbars
- Horizontal scroll on mobile

---

## 12. Accessibility Checklist

Before delivering any step or component:
- [ ] All form inputs have `<label>` elements
- [ ] Icon-only buttons have `aria-label`
- [ ] Color is never the only indicator of meaning
- [ ] `prefers-reduced-motion` respected — wrap all animations in media query (see the `@media (prefers-reduced-motion: reduce)` blocks already established in `light-mode.css` for a working pattern to copy)
- [ ] Tab order matches visual order
- [ ] Focus states visible (use `:focus-visible` — a global keyboard-focus ring already exists in `design-system.css`, don't suppress it with a per-element `outline: none` unless you replace it)
- [ ] Text contrast ≥ 4.5:1 on light surfaces, ≥ 7:1 on dark surfaces
- [ ] Touch targets ≥ 44×44px (applies to step nav dots and sidebar items)
- [ ] All SVG icons have appropriate `aria-hidden="true"` if decorative

No formal WCAG level is declared elsewhere in the project docs — treat AA as the floor (the contrast targets above already exceed AA on dark surfaces) until told otherwise.

---

## 13. Performance Rules

- All API calls must show a loading state before firing
- Never make two API calls simultaneously from the same step
- `JSON.parse()` always wrapped in `try/catch`
- React handles output escaping automatically — never use `dangerouslySetInnerHTML` (see CLAUDE.md §15.5); there is no manual `escapeHtml()` step to remember
- Route-level code is lazy-loaded (`React.lazy`) with per-route skeleton screens — this is standard for new routes, not an exception
- Animations use `transform` and `opacity` only — no layout thrashing

---

## 14. Motion Layer — React

Beyond the plain-CSS keyframes in this document, page-level and step transitions run through Framer Motion (`motion.div`, `AnimatePresence`) in `src/features/shell/AppShell.jsx`. This is easy to get wrong: `Suspense` boundaries for lazy-loaded routes must stay *inside* the `motion.div`, not wrap it — putting `Suspense` outside `AnimatePresence` has previously caused a step to render blank in production builds only (dev server masked it). If you're touching route transitions or adding a new lazy route, check `AppShell.jsx`'s existing structure before changing the nesting.

---

## 15. Page-Specific Override Files

| File | Applies To |
|------|------------|
| `pages/onboarding.md` | Splash + onboarding screens |
| `pages/step4-instrument.md` | Data Collection Instrument Builder (Step 4) |
| `pages/step6-defense.md` | Three-examiner Defense Panel (Step 6) |
