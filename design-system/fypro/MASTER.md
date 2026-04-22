# FYPro — Master Design System

> **LOGIC:** When building a specific page or step, first check `design-system/fypro/pages/[page].md`.
> If that file exists, its rules **override** this Master file.
> If not, strictly follow this document.

**Project:** FYPro — AI-Powered Final Year Project Companion
**Version:** 1.0 | **Date:** 2026-04-22
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

---

## 2. Color Palette

> **Rule:** Always use CSS variables. Never hardcode hex values in component CSS.

```css
:root {
  /* ─── Primary Backgrounds ─────────────────────────── */
  --color-bg-deep:        #060E18;   /* Defense Mode — very dark navy */
  --color-bg-dark:        #0D1B2A;   /* Sidebar, primary dark surfaces */
  --color-bg-mid:         #0F2235;   /* Secondary dark surfaces, hover states */
  --color-bg-surface:     #F0F4F8;   /* Main content workspace */
  --color-bg-card:        #FFFFFF;   /* Card backgrounds */

  /* ─── Brand Blues ─────────────────────────────────── */
  --color-blue-primary:   #0066FF;   /* Primary action, CTAs, active states */
  --color-blue-light:     #3B82F6;   /* Secondary elements */
  --color-blue-glow:      rgba(0, 102, 255, 0.15);
  --color-blue-subtle:    #EFF6FF;   /* Light blue tint backgrounds */

  /* ─── Accent Colors ───────────────────────────────── */
  --color-green:          #16A34A;   /* Success, confirm, completed, primary CTA */
  --color-green-light:    #F0FFF4;
  --color-red:            #DC2626;   /* Error, critical flags, danger */
  --color-red-light:      #FFF5F5;
  --color-amber:          #F59E0B;   /* Warning, buffer weeks, serious flags */
  --color-amber-light:    #FFFBEB;

  /* ─── Text ────────────────────────────────────────── */
  --color-text-primary:   #0D1B2A;
  --color-text-secondary: rgba(13, 27, 42, 0.6);
  --color-text-muted:     rgba(13, 27, 42, 0.4);
  --color-text-white:     #FFFFFF;
  --color-text-white-dim: rgba(255, 255, 255, 0.7);

  /* ─── Borders ─────────────────────────────────────── */
  --color-border:         rgba(13, 27, 42, 0.1);
  --color-border-strong:  rgba(13, 27, 42, 0.2);
  --color-border-blue:    rgba(0, 102, 255, 0.3);
  --color-border-dark:    rgba(255, 255, 255, 0.08);  /* Borders on dark surfaces */

  /* ─── Shadows ─────────────────────────────────────── */
  --shadow-card:          0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04);
  --shadow-card-hover:    0 8px 32px rgba(0, 0, 0, 0.12), 0 2px 8px rgba(0, 0, 0, 0.06);
  --shadow-blue-glow:     0 0 24px rgba(0, 102, 255, 0.4);
  --shadow-green-glow:    0 0 20px rgba(22, 163, 74, 0.35);
  --shadow-dark-card:     0 4px 20px rgba(0, 0, 0, 0.4), 0 1px 6px rgba(0, 0, 0, 0.2);
}
```

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

---

## 3. Typography

> **Rule:** Three fonts, three roles. Never substitute with system fonts.

```css
/* Already imported in index.html — do not re-import */
/* DM Serif Display — Headings, step labels, hero text */
/* Poppins — All body text, descriptions, labels, buttons */
/* JetBrains Mono — Verdicts, scores, badges, technical readouts */
```

### Type Scale

```css
:root {
  --text-xs:    0.65rem;    /* 10px — tiny labels, status badges */
  --text-sm:    0.75rem;    /* 12px — muted labels, metadata */
  --text-base:  0.875rem;   /* 14px — body text */
  --text-md:    1rem;       /* 16px — medium body */
  --text-lg:    1.125rem;   /* 18px — large body */
  --text-xl:    1.25rem;    /* 20px — step labels */
  --text-2xl:   1.5rem;     /* 24px — section headings */
  --text-3xl:   2rem;       /* 32px — major headings */
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

**Line height:** 1.6 for body text. 1.2 for headings. 1.0 for badges/mono.
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

---

## 5. Border Radius

```css
:root {
  --radius-sm:   8px;
  --radius-md:   12px;
  --radius-lg:   16px;
  --radius-xl:   24px;
  --radius-pill: 999px;
}
```

| Element | Radius |
|---------|--------|
| Step cards | `--radius-lg` |
| Buttons | `--radius-md` |
| Badges / tags | `--radius-pill` |
| Input fields | `--radius-sm` |
| Modals | `--radius-xl` |
| Sidebar items (active) | `--radius-sm` |

---

## 6. Component Patterns

### Step Card (Base Pattern)
Every step uses this as the starting point:
```css
.step-card {
  background: linear-gradient(145deg, #ffffff 0%, #f8fafc 100%);
  border-radius: var(--radius-lg);
  border: 1px solid var(--color-border);
  box-shadow: var(--shadow-card);
  padding: 40px;
  width: 100%;
  max-width: 660px;
  position: relative;
  overflow: hidden;
  animation: card-enter 0.4s ease forwards;
}

.step-card:hover {
  box-shadow: var(--shadow-card-hover);
  transition: box-shadow var(--transition-base);
}

/* Step number watermark — each step sets its own content */
.step-card::before {
  content: attr(data-step);
  font-family: 'JetBrains Mono', monospace;
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
  font-family: 'Poppins', sans-serif;
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
  font-family: 'Poppins', sans-serif;
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
  font-family: 'Poppins', sans-serif;
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
  font-family: 'Poppins', sans-serif;
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
  font-family: 'Poppins', sans-serif;
  font-size: var(--text-base);
  color: var(--color-text-primary);
  background: #FAFBFC;
  transition: border-color var(--transition-fast), box-shadow var(--transition-fast);
  line-height: 1.6;
}
.form-input:focus {
  outline: none;
  border-color: var(--color-blue-primary);
  box-shadow: 0 0 0 3px var(--color-blue-glow);
  background: #FFFFFF;
}
.form-input::placeholder {
  color: var(--color-text-muted);
}
```

### Loading State (Spinning Shield)

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
```

### Section Toggle Pattern

```css
/* Show a section */
el.classList.remove('STEP-section--hidden');
el.classList.add('STEP-section--visible');

/* Hide a section */
el.classList.remove('STEP-section--visible');
el.classList.add('STEP-section--hidden');

.STEP-section--visible { display: block; animation: card-enter 0.35s ease forwards; }
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
  background: linear-gradient(180deg, #0D1B2A 0%, #091420 100%);
  width: 260px;
}

/* Active step item */
.sidebar-step--active {
  border-left: 3px solid var(--color-blue-primary);
  background: rgba(0, 102, 255, 0.08);
}

/* Completed step checkmark */
@keyframes check-appear {
  from { transform: scale(0) rotate(-10deg); opacity: 0; }
  to   { transform: scale(1) rotate(0deg); opacity: 1; }
}
.step-check { animation: check-appear 0.3s cubic-bezier(0.34, 1.56, 0.64, 1) forwards; }
```

---

## 8. Transitions

```css
:root {
  --transition-fast:   0.15s ease;
  --transition-base:   0.2s ease;
  --transition-slow:   0.35s ease;
}
```

**Rules:**
- Micro-interactions (hover, focus): `--transition-fast`
- State changes (section reveal, button fill): `--transition-base`
- Card entry, panel slides: `--transition-slow`
- Loading spinners: `1s linear infinite`
- Never animate `width`, `height`, or `layout properties` — only `transform` and `opacity`

---

## 9. CSS Naming Convention

Each step has its own prefix. NEVER mix prefixes between steps:

| Step | Prefix | Feature |
|------|--------|---------|
| Step 1 | `tv-` | Topic Validator |
| Step 2 | `ca-` | Chapter Architect |
| Step 3 | `ma-` | Methodology Advisor |
| Step 4 | `di-` | Instrument Builder |
| Step 5 | `wp-` | Writing Planner |
| Step 6 | `dp-` | Defense Prep |
| Bonus | `se-` | Supervisor Email |

New CSS always appends to the bottom of `style.css` inside a clearly delimited block:
```css
/* ═══════════════════════════════════════════════════════
   STEP N — FEATURE NAME
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

**Typography:**
- Inter, Roboto, Arial, or system fonts as primary typeface
- All-caps body text
- Line lengths beyond 70ch

**Color:**
- Generic blue as the only CTA color — green for confirm/continue
- Solid red fill for danger buttons (border only)
- Hardcoded hex values in component CSS

**Interaction:**
- No loading state before API calls
- `innerHTML` insertion without `escapeHtml()`
- Two simultaneous API calls from the same step
- `JSON.parse()` without `try/catch`
- Missing `cursor: pointer` on interactive elements

**Layout:**
- Mobile-specific breakpoints (basic responsiveness only)
- Content hidden behind fixed navbars
- Horizontal scroll on mobile

---

## 12. Accessibility Checklist

Before delivering any step or component:
- [ ] All form inputs have `<label>` elements
- [ ] Icon-only buttons have `aria-label`
- [ ] Color is never the only indicator of meaning
- [ ] `prefers-reduced-motion` respected — wrap all animations in media query
- [ ] Tab order matches visual order
- [ ] Focus states visible (use `:focus-visible`)
- [ ] Text contrast ≥ 4.5:1 on light surfaces, ≥ 7:1 on dark surfaces
- [ ] Touch targets ≥ 44×44px (applies to step nav dots and sidebar items)
- [ ] All SVG icons have appropriate `aria-hidden="true"` if decorative

---

## 13. Performance Rules

- All API calls must show a loading state before firing
- Never make two API calls simultaneously from the same step
- `JSON.parse()` always wrapped in `try/catch`
- `escapeHtml()` always used before `innerHTML` insertion
- Lazy-load nothing — this is a single-page app with progressive revelation
- Animations use `transform` and `opacity` only — no layout thrashing

---

## 14. Script Load Order

Strict order in `index.html`:
```
state.js → universities.js → prompts.js → api.js →
step1.js → step2.js → step3.js → step4.js →
step5.js → step6.js → supervisor-email.js → app.js
```

---

## 15. Page-Specific Override Files

| File | Applies To |
|------|------------|
| `pages/onboarding.md` | Splash + onboarding screens |
| `pages/step4-instrument.md` | Data Collection Instrument Builder (Step 4) |
| `pages/step6-defense.md` | Three-examiner Defense Panel (Step 6) |
