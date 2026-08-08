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

A full code audit during planning found the color surface is bigger than
originally scoped: beyond the ~150 inline styles using the named constants,
there are ~90 additional literal `rgba(255,255,255,X)` / hex values scattered
through `Health.jsx` that bypass the constants entirely, plus 3 more
`` `${COLOR}NN` `` alpha-suffix concatenation hacks beyond the 2 first found
(in `StatusBadge` and `PlanBadge`). Auditing every one of those individually
would be a large, error-prone effort disproportionate to the feature. The
palette design below avoids that entirely by only theming the **structural**
tokens (backgrounds/surfaces/borders/text) and keeping the **semantic accent**
colors (blue/green/amber/red) identical hex in both themes:

- Blue/green/amber/red are only ever used for badges, borders, chart accents,
  and icons in this file — never as body text color (text always resolves
  through `WHITE`/`DIM`/`MUTED`, which *do* theme). Decorative accent contrast
  on a light surface isn't a WCAG concern the way body text contrast is, so
  there's no need for a per-theme variant of these four colors.
- Because they stay plain hex strings (not `var()` references), every
  existing `` `${GREEN}22` ``-style alpha-suffix concatenation — the 2
  originally found plus the 3 more found in `StatusBadge`/`PlanBadge` —
  continues to work with **zero code changes**, since string concatenation
  onto a `var(--x)` reference is what breaks it, not onto a plain hex string.
- Only `BG`, `SURFACE`, `CARD`, `BORDER`, `WHITE`, `DIM`, `MUTED` become
  `var(--admin-*)` references.
- The ~90 scattered literal `rgba(255,255,255,X)` overlays (dividers,
  skeleton backgrounds, hover states, dimmed text that never got routed
  through the `BORDER`/`DIM`/`MUTED` constants originally) get fixed by one
  mechanical, non-semantic token: `--admin-fg-rgb`, holding just the RGB
  triplet (no alpha). Every literal `rgba(255,255,255,` in the file becomes
  `rgba(var(--admin-fg-rgb),`, preserving whatever alpha value was already
  there. This is a single find-and-replace, not 90 individual judgment calls.
- `rgba(0,0,0,*)` modal backdrop scrims are left untouched — a dark overlay
  behind a modal is correct in both themes.
- The vivid one-off accent hexes (`#4ade80`, `#fbbf24`, `#60a5fa`, `#f87171`,
  `#3B82F6`, `#8B5CF6`, `#06B6D4`, `PIE_COLORS`) are decorative (chart glows,
  live-pulse dot, feed-item dots) and stay constant across themes for the same
  reason as the semantic accents above.

```css
[data-admin-theme="dark"] {
  --admin-bg: #060E18;
  --admin-surface: #0D1B2A;
  --admin-card: #0F2235;
  --admin-border: rgba(255,255,255,0.08);
  --admin-white: #FFFFFF;
  --admin-dim: rgba(255,255,255,0.7);
  --admin-muted: rgba(255,255,255,0.4);
  --admin-fg-rgb: 255,255,255;
}

[data-admin-theme="light"] {
  --admin-bg: #F0F4F8;
  --admin-surface: #FFFFFF;
  --admin-card: #FFFFFF;
  --admin-border: rgba(13,27,42,0.10);
  --admin-white: #0D1B2A; /* "white text" token inverts to dark navy text */
  --admin-dim: rgba(13,27,42,0.65);
  --admin-muted: rgba(13,27,42,0.40);
  --admin-fg-rgb: 13,27,42;
}
```

`BLUE` (#0066FF), `GREEN` (#16A34A), `AMBER` (#F59E0B), `RED` (#DC2626), and
`PIE_COLORS` are unaffected by the theme and stay plain hex constants — see
Section 4.

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
one shared export. Only the structural 7 become CSS-variable strings; the
semantic/decorative colors are re-exported unchanged (this still fixes the
existing three-way duplication, it's just not theme-dependent for these five):

```js
export const BG = 'var(--admin-bg)'
export const SURFACE = 'var(--admin-surface)'
export const CARD = 'var(--admin-card)'
export const BORDER = 'var(--admin-border)'
export const WHITE = 'var(--admin-white)'
export const DIM = 'var(--admin-dim)'
export const MUTED = 'var(--admin-muted)'

export const BLUE = '#0066FF'
export const GREEN = '#16A34A'
export const AMBER = '#F59E0B'
export const RED = '#DC2626'
export const PIE_COLORS = ['#0066FF', '#16A34A', '#F59E0B', '#DC2626', '#8B5CF6', '#06B6D4']
```

`Health.jsx`, `FeatureFeedbackWidget.jsx`, and `RatingsWidget.jsx` import from
this module instead of redeclaring their own copies. Because `var(--admin-*)`
is a valid CSS `<paint>`/color value everywhere a hex string was previously
accepted (inline styles, SVG presentation attributes, recharts props all pass
through to real CSS/SVG rendering), every existing call site that already
used `BG`/`SURFACE`/`CARD`/`BORDER`/`WHITE`/`DIM`/`MUTED` themes automatically
with **zero per-call-site edits**. Call sites using `BLUE`/`GREEN`/`AMBER`/
`RED`/`PIE_COLORS` — including all 5 `` `${COLOR}NN` `` alpha-suffix
concatenation call sites — are untouched, because those constants are still
plain hex strings.

### 5. Structural literal sweep + static `<style>` block

Two mechanical, non-semantic find-and-replace passes across `Health.jsx`,
`FeatureFeedbackWidget.jsx`, `RatingsWidget.jsx`, and the `<style>{`...`}`</style>`
block (Health.jsx ~lines 1989–2034):

1. Every literal `rgba(255,255,255,` becomes `rgba(var(--admin-fg-rgb),` —
   this covers the ~90 scattered structural overlays (dividers, skeleton
   backgrounds, hover states, dimmed labels) that never routed through the
   named constants originally.
2. The handful of duplicated literal `#060E18` (→ `BG`), `#0D1B2A` (→
   `SURFACE`), and `#fff`/`#FFFFFF` (→ `WHITE`) instances that should have
   used the constants but didn't (e.g. the `isAdmin === null` loading screen
   at Health.jsx:1805-1806, and `.mc-topbar`/`.mc-tabs`/`.mc-action-btn:hover`
   inside the `<style>` block) get swapped to reference the token/var
   directly.

`rgba(0,0,0,*)` modal backdrops and the vivid one-off accent hexes (`#4ade80`,
`#fbbf24`, `#60a5fa`, `#f87171`, `#3B82F6`, `#8B5CF6`, `#06B6D4`) are
deliberately left untouched per Section 1.

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
- The `rgba(var(--admin-fg-rgb),*)` sweep resolves correctly in both themes
  (spot-check dividers, skeleton loaders, and dimmed labels specifically,
  since those are the highest-volume swap).
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

- Confirm icon choice/placement for the toggle button doesn't collide with
  existing `.mc-topbar` icons (refresh, alerts test, Sentry test, founder
  photo) in the right-hand icon group, or at the 600px mobile breakpoint
  where `mc-topbar-date`/`mc-topbar-center`/`mc-topbar-utility` already hide.
