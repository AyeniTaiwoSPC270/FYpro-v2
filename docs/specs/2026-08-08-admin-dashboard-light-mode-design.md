# Admin Dashboard Light Mode — Design

Date: 2026-08-08
Status: Approved, ready for planning

## Problem

`/admin/health` (`src/pages/admin/Health.jsx`, ~3,455 lines) plus its widgets
(`src/pages/admin/widgets/FeatureFeedbackWidget.jsx`,
`src/pages/admin/widgets/RatingsWidget.jsx`) render entirely in a hardcoded dark
theme. Colors live in two disconnected places:

- ~150 inline `style={{}}` props (plus recharts `stroke`/`fill`/`contentStyle`
  props and a couple of raw SVG `stroke` attributes) driven by JS constants —
  `BG`, `SURFACE`, `CARD`, `BORDER`, `BLUE`, `GREEN`, `AMBER`, `RED`, `WHITE`,
  `DIM`, `MUTED`, `PIE_COLORS` — each **redeclared independently** as hex
  literals in all three files.
- A static `<style>{`...`}`</style>` block (Health.jsx ~lines 1989–2029) with
  its own hardcoded hex/rgba for `.mc-topbar`, `.mc-tabs`, `.mc-card`,
  `.mc-action-btn`, `.mc-skeleton`, `.mc-live-pulse`, `.mc-section-divider`,
  etc.

None of this participates in the site-wide `ThemeContext` (`src/context/ThemeContext.jsx`),
which only themes the public/user-facing app via `document.documentElement`'s
`data-theme` attribute and `fypro_theme` localStorage key.

The admin dashboard should get a real, toggleable light mode — as its **own**
isolated preference, independent of the public site's theme.

## Goals

- Admin gets a light/dark toggle scoped only to `/admin/health`.
- Default theme on first visit is **dark** (matches current behavior exactly
  until an admin opts in).
- Fully isolated from the public site's `ThemeContext`/`fypro_theme` — toggling
  one never affects the other.
- No visual regression in dark mode (byte-for-byte same computed colors as
  today, just resolved through CSS variables instead of literals).
- Reuses the light palette values the rest of the app already established in
  `src/styles/light-mode.css` / `design-system.css` (`#F0F4F8` bg, `#ffffff`
  cards, `rgba(13,27,42,*)` borders/text, `#0066FF` accent) rather than
  inventing a new one.

## Non-goals

- Not changing the site-wide `ThemeContext` or `fypro_theme` behavior.
- Not rewriting `Health.jsx` markup to Tailwind/CSS modules (considered and
  rejected — see Alternatives).
- Not redesigning admin layout, tabs, or information architecture.

## Design

### 1. Token layer — new `src/pages/admin/adminTheme.css`

Defines admin-scoped CSS custom properties under an attribute selector that is
distinct from the public site's `[data-theme]`:

```css
[data-admin-theme="dark"] {
  --admin-bg: #060E18;
  --admin-surface: #0D1B2A;
  --admin-card: #0F2235;
  --admin-border: rgba(255,255,255,0.08);
  --admin-blue: #0066FF;
  --admin-green: #16A34A;
  --admin-amber: #F59E0B;
  --admin-red: #DC2626;
  --admin-white: #FFFFFF;
  --admin-dim: rgba(255,255,255,0.7);
  --admin-muted: rgba(255,255,255,0.4);
  --admin-green-soft: rgba(22,163,74,0.13);
  --admin-pie-1: #0066FF; --admin-pie-2: #16A34A; --admin-pie-3: #F59E0B;
  --admin-pie-4: #DC2626; --admin-pie-5: #8B5CF6; --admin-pie-6: #06B6D4;
}

[data-admin-theme="light"] {
  --admin-bg: #F0F4F8;
  --admin-surface: #FFFFFF;
  --admin-card: #FFFFFF;
  --admin-border: rgba(13,27,42,0.10);
  --admin-blue: #0066FF;
  --admin-green: #16A34A;
  --admin-amber: #D97706; /* deepened from #F59E0B for AA contrast on white */
  --admin-red: #DC2626;
  --admin-white: #0D1B2A; /* "white text" token inverts to dark navy text */
  --admin-dim: rgba(13,27,42,0.65);
  --admin-muted: rgba(13,27,42,0.40);
  --admin-green-soft: rgba(22,163,74,0.12);
  --admin-pie-1: #0066FF; --admin-pie-2: #16A34A; --admin-pie-3: #D97706;
  --admin-pie-4: #DC2626; --admin-pie-5: #8B5CF6; --admin-pie-6: #0891B2;
}
```

The `--admin-green-soft` token replaces the two existing alpha-suffix hacks in
`Health.jsx` (string concatenation like `` `${GREEN}22` `` to fake an alpha
channel on a hex constant) — those break once `GREEN` becomes a `var()`
string, so they get a dedicated pre-blended token instead.

### 2. Isolation

The root element Health.jsx currently returns gets `data-admin-theme={adminTheme}`.
Because this attribute lives only on that subtree (not `document.documentElement`),
it never interacts with the public site's `data-theme` attribute or the
`ThemeContext` provider. Two completely independent theme systems.

### 3. State — local to `Health.jsx`, no Context needed

```js
const [adminTheme, setAdminTheme] = useState(
  () => localStorage.getItem('fypro_admin_theme') || 'dark'
)
useEffect(() => {
  localStorage.setItem('fypro_admin_theme', adminTheme)
}, [adminTheme])
```

Because colors resolve via CSS custom-property inheritance from the
`data-admin-theme` attribute, `FeatureFeedbackWidget` and `RatingsWidget` need
**no theme awareness in JS at all** — they render inside the themed subtree
and inherit the resolved values automatically. No React Context, no prop
drilling.

### 4. Shared token module — new `src/pages/admin/adminTokens.js`

Replaces the three independent hex-literal copies of `BG`/`SURFACE`/`CARD`/
`BORDER`/`BLUE`/`GREEN`/`AMBER`/`RED`/`WHITE`/`DIM`/`MUTED`/`PIE_COLORS` with
one shared export, as CSS-variable strings:

```js
export const BG = 'var(--admin-bg)'
export const SURFACE = 'var(--admin-surface)'
export const CARD = 'var(--admin-card)'
export const BORDER = 'var(--admin-border)'
export const BLUE = 'var(--admin-blue)'
export const GREEN = 'var(--admin-green)'
export const AMBER = 'var(--admin-amber)'
export const RED = 'var(--admin-red)'
export const WHITE = 'var(--admin-white)'
export const DIM = 'var(--admin-dim)'
export const MUTED = 'var(--admin-muted)'
export const GREEN_SOFT = 'var(--admin-green-soft)'
export const PIE_COLORS = [
  'var(--admin-pie-1)', 'var(--admin-pie-2)', 'var(--admin-pie-3)',
  'var(--admin-pie-4)', 'var(--admin-pie-5)', 'var(--admin-pie-6)',
]
```

`Health.jsx`, `FeatureFeedbackWidget.jsx`, and `RatingsWidget.jsx` import from
this module instead of redeclaring their own copies. This is both the fix for
the existing three-way duplication and the mechanism that makes every one of
the ~150 existing inline-style call sites, every recharts `stroke`/`fill`/
`contentStyle` prop, and the raw SVG `stroke` attributes theme automatically —
**zero per-call-site edits** required, because `var(--admin-*)` is a valid CSS
`<paint>`/color value everywhere a hex string was previously accepted
(inline styles, SVG presentation attributes, recharts props all pass through
to real CSS/SVG rendering).

The two `` `${GREEN}22` `` call sites are the one exception and get changed to
reference `GREEN_SOFT` directly instead of string-concatenating an alpha
suffix onto a token.

### 5. Static `<style>` block

Mechanical swap of the ~15 hardcoded hex/rgba values in the `<style>{`...`}`</style>`
block (`.mc-topbar`, `.mc-tabs`, `.mc-card`, `.mc-action-btn`, `.mc-skeleton`,
`.mc-live-pulse`, `.mc-section-divider`, `.mc-mobile-tab-select`, etc.) to the
matching `var(--admin-*)` custom properties. Contained entirely within this
one ~40-line block.

### 6. Toggle UI

A sun/moon icon button added to `.mc-topbar`, alongside the existing utility
icons, calling:

```js
setAdminTheme(t => (t === 'dark' ? 'light' : 'dark'))
```

### 7. Verification

Manual pass through all 8 Mission Control tabs (Overview, Users, Payments,
Vitals, Logs, Reports, Ratings, Data) plus both widgets, in both themes,
checking:
- Chart legibility (recharts tooltips, `CartesianGrid` lines, pie segments)
  against the new light background.
- The `GREEN_SOFT` token and any other one-off literal hex found during
  implementation that bypasses the shared token module (a full grep sweep of
  raw `#`/`rgba(` literals in `Health.jsx` turned up ~119 occurrences at
  design time; most are the token definitions themselves or already route
  through the named constants, but a residual few may be one-offs that need
  folding into the token set as they're found).
- Dark mode renders pixel-identical to current production (regression check).

## Alternatives considered

**B. Dynamic JS constants only (no CSS vars).** Compute `BG`/`SURFACE`/etc. as
plain hex per-render from a `theme` value via a shared `AdminThemeContext`,
instead of CSS variables. This fixes the ~150 inline-style call sites the same
way, but the static `<style>{`...`}`</style>` block is literal CSS text set
once — it can't react to a JS variable without also being rewritten to
interpolate `theme` into the template string (which just becomes Approach A
with extra steps) or being converted to CSS vars anyway. Rejected because it
leaves `.mc-topbar`/`.mc-tabs`/`.mc-card`/`.mc-action-btn` stuck in dark mode
on their own.

**C. Full rebuild to Tailwind/CSS-module classes.** Rip out inline styles and
the `<style>` block, rebuild markup with Tailwind utility classes and
`dark:`/light variants. Rejected: disproportionate to the ask (touches every
call site across 3,455 lines instead of just the token definitions),
introduces Tailwind to a file that currently uses none of it, and creates
unnecessary regression risk on the page relied on for spend-cap, payment, and
error-spike monitoring — with no architectural upside since no broader Tailwind
migration is planned.

## Open items for implementation

- Confirm the residual ad-hoc hex literals (beyond the two `${GREEN}22` spots
  already accounted for) found via `grep -n "#[0-9A-Fa-f]\{3,6\}\|rgba(" src/pages/admin/Health.jsx`
  are either already routed through named constants or get folded into
  `adminTokens.js`/`adminTheme.css` as new tokens.
- Confirm icon choice/placement for the toggle button doesn't collide with
  existing `.mc-topbar` icons (notification bell, admin identity, etc.) at the
  600px mobile breakpoint where several topbar elements already hide
  (`mc-topbar-date`, `mc-topbar-center`, `mc-topbar-utility`).
