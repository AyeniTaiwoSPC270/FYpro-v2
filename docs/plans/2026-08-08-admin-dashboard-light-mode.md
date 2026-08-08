# Admin Dashboard Light Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give `/admin/health` (Mission Control) its own light/dark toggle, fully isolated from the public site's `ThemeContext`, without touching any of the ~150 existing inline-style call sites individually.

**Architecture:** A new CSS custom-property layer (`src/pages/admin/adminTheme.css`) scoped by a `data-admin-theme` attribute on the page's root element, driven by local `useState` + `localStorage` in `Health.jsx`. Structural colors (bg/surface/card/border/text) become `var(--admin-*)` references exported from a new shared `src/pages/admin/adminTokens.js` module; semantic accent colors (blue/green/amber/red) stay plain hex, unaffected by theme. Two mechanical find-and-replace passes handle the ~90 scattered literal `rgba(255,255,255,X)` overlays that bypass the named constants today.

**Tech Stack:** React 18 (JSX), plain CSS custom properties (no Tailwind in this file), Vite. No new dependencies.

**Reference spec:** `docs/specs/2026-08-08-admin-dashboard-light-mode-design.md`

---

## File Structure

- Create: `src/pages/admin/adminTheme.css` — the two `[data-admin-theme]` token blocks.
- Create: `src/pages/admin/adminTokens.js` — shared JS constants (7 var-based + 5 static hex + `TABLE_HEAD`), replacing the three duplicated `const` blocks.
- Modify: `src/pages/admin/Health.jsx` — import the new css/token files, add `adminTheme` state + toggle button + `data-admin-theme` attribute, remove its local const block, sweep `rgba(255,255,255,*)`, fix a few literal-instead-of-constant spots.
- Modify: `src/pages/admin/widgets/FeatureFeedbackWidget.jsx` — import shared tokens instead of its own const block, sweep `rgba(255,255,255,*)`, use `TABLE_HEAD` for the one non-constant hex it has.
- Modify: `src/pages/admin/widgets/RatingsWidget.jsx` — import shared tokens instead of its own const block, sweep `rgba(255,255,255,*)`.

---

### Task 1: Token CSS + shared JS token module

**Files:**
- Create: `src/pages/admin/adminTheme.css`
- Create: `src/pages/admin/adminTokens.js`

- [ ] **Step 1: Create `src/pages/admin/adminTheme.css`**

```css
/* Admin (Mission Control) theme tokens.
   Scoped by [data-admin-theme] — fully independent of the public site's
   [data-theme] / ThemeContext. Only structural colors vary by theme; the
   semantic accent colors (blue/green/amber/red) are intentionally constant
   across both — see docs/specs/2026-08-08-admin-dashboard-light-mode-design.md */

[data-admin-theme="dark"] {
  --admin-bg: #060E18;
  --admin-surface: #0D1B2A;
  --admin-card: #0F2235;
  --admin-border: rgba(255,255,255,0.08);
  --admin-white: #FFFFFF;
  --admin-dim: rgba(255,255,255,0.7);
  --admin-muted: rgba(255,255,255,0.4);
  --admin-fg-rgb: 255,255,255;
  --admin-card-glass: rgba(15,34,53,0.7);
  --admin-table-head: #091420;
  --admin-select-bg: rgba(13,27,42,0.9);
}

[data-admin-theme="light"] {
  --admin-bg: #F0F4F8;
  --admin-surface: #FFFFFF;
  --admin-card: #FFFFFF;
  --admin-border: rgba(13,27,42,0.10);
  --admin-white: #0D1B2A;
  --admin-dim: rgba(13,27,42,0.65);
  --admin-muted: rgba(13,27,42,0.40);
  --admin-fg-rgb: 13,27,42;
  --admin-card-glass: rgba(255,255,255,0.72);
  --admin-table-head: rgba(13,27,42,0.04);
  --admin-select-bg: #FFFFFF;
}
```

- [ ] **Step 2: Create `src/pages/admin/adminTokens.js`**

```js
// Shared color tokens for the admin dashboard (Health.jsx + widgets/).
// Structural tokens resolve through CSS custom properties defined in
// adminTheme.css, scoped by the [data-admin-theme] attribute set on
// Health.jsx's root element. Semantic accent colors are theme-invariant —
// see docs/specs/2026-08-08-admin-dashboard-light-mode-design.md

export const BG = 'var(--admin-bg)'
export const SURFACE = 'var(--admin-surface)'
export const CARD = 'var(--admin-card)'
export const BORDER = 'var(--admin-border)'
export const WHITE = 'var(--admin-white)'
export const DIM = 'var(--admin-dim)'
export const MUTED = 'var(--admin-muted)'
export const TABLE_HEAD = 'var(--admin-table-head)'

export const BLUE = '#0066FF'
export const GREEN = '#16A34A'
export const AMBER = '#F59E0B'
export const RED = '#DC2626'
export const PIE_COLORS = ['#0066FF', '#16A34A', '#F59E0B', '#DC2626', '#8B5CF6', '#06B6D4']
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/adminTheme.css src/pages/admin/adminTokens.js
git commit -m "feat: add admin dashboard theme token layer"
```

---

### Task 2: Wire the theme toggle into `Health.jsx`

**Files:**
- Modify: `src/pages/admin/Health.jsx:1-23` (imports + const block)
- Modify: `src/pages/admin/Health.jsx:648` (state block, insert before)
- Modify: `src/pages/admin/Health.jsx:1987-1988` (root element)
- Modify: `src/pages/admin/Health.jsx:2053-2076` (topbar icon group)

- [ ] **Step 1: Replace the imports + local const block with shared imports**

Current (lines 1–23):
```js
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useUser } from '../../hooks/useUser'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import FeatureFeedbackWidget from './widgets/FeatureFeedbackWidget'
import RatingsWidget from './widgets/RatingsWidget'
import { supabase } from '../../lib/supabase'

// ── Design tokens (dark admin theme) ────────────────────────────────
const BG      = '#060E18'
const SURFACE = '#0D1B2A'
const CARD    = '#0F2235'
const BORDER  = 'rgba(255,255,255,0.08)'
const BLUE    = '#0066FF'
const GREEN   = '#16A34A'
const AMBER   = '#F59E0B'
const RED     = '#DC2626'
const WHITE   = '#FFFFFF'
const DIM     = 'rgba(255,255,255,0.7)'
const MUTED   = 'rgba(255,255,255,0.4)'
const PIE_COLORS = ['#0066FF', '#16A34A', '#F59E0B', '#DC2626', '#8B5CF6', '#06B6D4']
```

Replace with:
```js
import { useState, useEffect, useLayoutEffect, useRef, useMemo, useCallback, memo } from 'react'
import { useUser } from '../../hooks/useUser'
import {
  LineChart, Line, BarChart, Bar, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from 'recharts'
import FeatureFeedbackWidget from './widgets/FeatureFeedbackWidget'
import RatingsWidget from './widgets/RatingsWidget'
import { supabase } from '../../lib/supabase'
import { SunIcon, MoonIcon } from '../../features/dashboard/_shared'
import './adminTheme.css'
import { BG, SURFACE, CARD, BORDER, BLUE, GREEN, AMBER, RED, WHITE, DIM, MUTED, PIE_COLORS } from './adminTokens'
```

- [ ] **Step 2: Add `adminTheme` state before the `activeTab` state**

Find (Health.jsx, inside `AdminHealth()`, just above line 648):
```js
  const [confirmModal, setConfirmModal] = useState(null) // { title, body, onConfirm, danger }

  const [activeTab, setActiveTab] = useState('overview')
```

Replace with:
```js
  const [confirmModal, setConfirmModal] = useState(null) // { title, body, onConfirm, danger }

  const [adminTheme, setAdminTheme] = useState(() => localStorage.getItem('fypro_admin_theme') || 'dark')
  useEffect(() => {
    localStorage.setItem('fypro_admin_theme', adminTheme)
  }, [adminTheme])

  const [activeTab, setActiveTab] = useState('overview')
```

- [ ] **Step 3: Add `data-admin-theme` to the root element**

Find:
```jsx
  return (
    <div style={{ minHeight: '100vh', background: BG, fontFamily: "'Poppins', sans-serif", color: WHITE }}>
```

Replace with:
```jsx
  return (
    <div data-admin-theme={adminTheme} style={{ minHeight: '100vh', background: BG, fontFamily: "'Poppins', sans-serif", color: WHITE }}>
```

- [ ] **Step 4: Add the toggle button to the topbar icon group**

Find (Health.jsx, right-hand topbar icon group):
```jsx
            <button
              onClick={() => { setShowPhotoModal(true); setPhotoFile(null); setPhotoError(null); setPhotoSuccess(false) }}
              title="Update founder photo"
              style={{ position:'relative', width:32, height:32, borderRadius:'50%', overflow:'hidden', border:`2px solid ${founderPhotoUrl ? GREEN : BLUE}`, background:'linear-gradient(135deg,#0066FF,#3B82F6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', padding:0 }}
            >
```

Replace with:
```jsx
            <button
              onClick={() => setAdminTheme(t => (t === 'dark' ? 'light' : 'dark'))}
              aria-label={adminTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={adminTheme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ display:'flex', alignItems:'center', justifyContent:'center', width:32, height:32, borderRadius:8, border:`1px solid ${BORDER}`, background:'transparent', color:WHITE, cursor:'pointer', flexShrink:0 }}
            >
              {adminTheme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>
            <button
              onClick={() => { setShowPhotoModal(true); setPhotoFile(null); setPhotoError(null); setPhotoSuccess(false) }}
              title="Update founder photo"
              style={{ position:'relative', width:32, height:32, borderRadius:'50%', overflow:'hidden', border:`2px solid ${founderPhotoUrl ? GREEN : BLUE}`, background:'linear-gradient(135deg,#0066FF,#3B82F6)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, cursor:'pointer', padding:0 }}
            >
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/Health.jsx
git commit -m "feat: add theme toggle state and button to admin dashboard"
```

---

### Task 3: Fix literal-instead-of-constant colors and the static `<style>` block in `Health.jsx`

**Files:**
- Modify: `src/pages/admin/Health.jsx:1805-1806` (loading screen)
- Modify: `src/pages/admin/Health.jsx:1989-2034` (static `<style>` block)

- [ ] **Step 1: Fix the `isAdmin === null` loading screen literals**

Find:
```jsx
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: '#060E18' }}>
      <div style={{ color: '#fff', fontFamily: 'Poppins, sans-serif', fontSize: '1rem', opacity: 0.6 }}>
```

Replace with:
```jsx
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', background: BG }}>
      <div style={{ color: WHITE, fontFamily: 'Poppins, sans-serif', fontSize: '1rem', opacity: 0.6 }}>
```

(This early-return branch renders before the themed root wrapper, so it stays dark regardless — this fix just stops it from duplicating the literal, keeping a single source of truth. It's a brief loading flash, not worth wrapping in `data-admin-theme` separately.)

- [ ] **Step 2: Sweep every literal `rgba(255,255,255,` in the file to the CSS-variable form**

This single edit covers every remaining occurrence — inline styles, the `<style>` block, and both `<style>` block hover/media rules alike — because `rgba(255,255,255,` is a distinctive, unambiguous substring.

```
old_string: rgba(255,255,255,
new_string: rgba(var(--admin-fg-rgb),
replace_all: true
```

- [ ] **Step 3: Replace the remaining non-rgba hardcoded hex inside the `<style>` block**

Find:
```css
        .mc-card { background:rgba(15,34,53,0.7); border:1px solid rgba(var(--admin-fg-rgb),0.08); border-radius:14px; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }
```

Replace with:
```css
        .mc-card { background:var(--admin-card-glass); border:1px solid rgba(var(--admin-fg-rgb),0.08); border-radius:14px; backdrop-filter:blur(12px); -webkit-backdrop-filter:blur(12px); }
```

Find:
```css
        .mc-topbar       { position:sticky; top:0; z-index:50; background:#0D1B2A; border-bottom:1px solid rgba(var(--admin-fg-rgb),0.07); }
        .mc-tabs         { background:#060E18; border-bottom:1px solid rgba(var(--admin-fg-rgb),0.07); }
```

Replace with:
```css
        .mc-topbar       { position:sticky; top:0; z-index:50; background:var(--admin-surface); border-bottom:1px solid rgba(var(--admin-fg-rgb),0.07); }
        .mc-tabs         { background:var(--admin-bg); border-bottom:1px solid rgba(var(--admin-fg-rgb),0.07); }
```

Find:
```css
        .mc-action-btn:hover    { background:rgba(var(--admin-fg-rgb),0.08); color:#fff; }
```

Replace with:
```css
        .mc-action-btn:hover    { background:rgba(var(--admin-fg-rgb),0.08); color:var(--admin-white); }
```

Find:
```css
        .mc-mobile-tab-select { width:100%; background:rgba(13,27,42,0.9); border:1px solid rgba(var(--admin-fg-rgb),0.1); color:#fff; border-radius:10px; padding:10px 14px; font-size:13px; font-family:'Poppins',sans-serif; }
```

Replace with:
```css
        .mc-mobile-tab-select { width:100%; background:var(--admin-select-bg); border:1px solid rgba(var(--admin-fg-rgb),0.1); color:var(--admin-white); border-radius:10px; padding:10px 14px; font-size:13px; font-family:'Poppins',sans-serif; }
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/Health.jsx
git commit -m "fix: route admin dashboard literal colors through theme tokens"
```

---

### Task 4: Theme `FeatureFeedbackWidget.jsx`

**Files:**
- Modify: `src/pages/admin/widgets/FeatureFeedbackWidget.jsx:1-10`
- Modify: `src/pages/admin/widgets/FeatureFeedbackWidget.jsx:132`

- [ ] **Step 1: Replace the local const block with the shared import**

Find:
```js
const BG     = '#060E18'
const CARD   = '#0F2235'
const BORDER = 'rgba(255,255,255,0.08)'
const WHITE  = '#FFFFFF'
const DIM    = 'rgba(255,255,255,0.7)'
const MUTED  = 'rgba(255,255,255,0.4)'
const BLUE   = '#0066FF'
const GREEN  = '#16A34A'
const RED    = '#DC2626'
const AMBER  = '#F59E0B'
```

Replace with:
```js
import { CARD, BORDER, WHITE, DIM, MUTED, GREEN, RED, AMBER, TABLE_HEAD } from '../adminTokens'
```

(`BG` and `BLUE` were declared but never used in this file even before this change — matching that, they're left out of the import rather than added as new unused imports, which `no-unused-vars` would flag as a fresh lint violation outside the existing `eslint-suppressions.json` baseline.)

- [ ] **Step 2: Sweep literal `rgba(255,255,255,` occurrences**

```
old_string: rgba(255,255,255,
new_string: rgba(var(--admin-fg-rgb),
replace_all: true
```

- [ ] **Step 3: Replace the one-off table-header hex**

Find:
```jsx
                      background: '#091420',
```

Replace with:
```jsx
                      background: TABLE_HEAD,
```

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/widgets/FeatureFeedbackWidget.jsx
git commit -m "feat: theme FeatureFeedbackWidget for admin light mode"
```

---

### Task 5: Theme `RatingsWidget.jsx`

**Files:**
- Modify: `src/pages/admin/widgets/RatingsWidget.jsx:1-13`

- [ ] **Step 1: Replace the local const block with the shared import**

Find:
```js
// src/pages/admin/widgets/RatingsWidget.jsx

const BG     = '#060E18'
const CARD   = '#0F2235'
const BORDER = 'rgba(255,255,255,0.08)'
const WHITE  = '#FFFFFF'
const DIM    = 'rgba(255,255,255,0.7)'
const MUTED  = 'rgba(255,255,255,0.4)'
const BLUE   = '#0066FF'
const GREEN  = '#16A34A'
const AMBER  = '#F59E0B'
const RED    = '#DC2626'
```

Replace with:
```js
// src/pages/admin/widgets/RatingsWidget.jsx

import { CARD, BORDER, WHITE, DIM, MUTED, BLUE, GREEN, AMBER, RED } from '../adminTokens'
```

(`BG` was declared but never used in this file even before this change — matching that, it's left out of the import rather than added as a new unused import, which `no-unused-vars` would flag as a fresh lint violation outside the existing `eslint-suppressions.json` baseline.)

- [ ] **Step 2: Sweep literal `rgba(255,255,255,` occurrences**

```
old_string: rgba(255,255,255,
new_string: rgba(var(--admin-fg-rgb),
replace_all: true
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/widgets/RatingsWidget.jsx
git commit -m "feat: theme RatingsWidget for admin light mode"
```

---

### Task 6: Verify

**Files:** none (verification only)

- [ ] **Step 1: Run typecheck**

Run: `npm run typecheck`
Expected: no new errors introduced by this change (Health.jsx and the two widgets are `.jsx`, so this mainly guards the rest of the app hasn't regressed).

- [ ] **Step 2: Run lint**

Run: `npm run lint`
Expected: passes. If any of the touched files were already in `eslint-suppressions.json` and now have fewer violations, run `npm run lint:prune` and commit the updated baseline per CLAUDE.md §17/§19.

- [ ] **Step 3: Run the test suite**

Run: `npm run test`
Expected: all existing tests pass (there are no existing tests for `Health.jsx` or the admin widgets, so this is a regression guard for the rest of the app, not new coverage — this is a pure-UI change with no testable logic to add).

- [ ] **Step 4: Manual browser verification**

Start the dev server (`npm run dev`), sign in as admin, open `/admin/health`, and for **both** dark and light (toggle via the new topbar button):
- Confirm dark mode looks pixel-identical to current production (regression check).
- Click through all 8 tabs: Overview, Users, Payments, Vitals, Logs, Reports, Ratings (renders `RatingsWidget`), Data. Confirm Overview also renders `FeatureFeedbackWidget`.
- Check every recharts chart (line, bar, pie) for legible tooltips, grid lines, and pie segments against the light background.
- Check the mobile tab `<select>` (narrow viewport, <900px) renders readably in both themes.
- Confirm the toggle button icon flips (sun ↔ moon) and the choice survives a page reload (localStorage `fypro_admin_theme`).
- Confirm toggling admin theme does **not** affect the public site's theme (e.g. open `/dashboard` in another tab and confirm its theme is unchanged).

- [ ] **Step 5: Final commit if manual verification required fixes**

If Step 4 surfaces any spot that didn't theme correctly, fix it directly (same pattern as Task 3 Step 3: identify the literal, route it through an existing token or a new one in `adminTheme.css`/`adminTokens.js`), then:

```bash
git add -A
git commit -m "fix: address admin light mode verification findings"
```

---

## Self-Review Notes

- **Spec coverage:** Token layer (Task 1), isolation + state + toggle UI (Task 2), structural literal sweep + `<style>` block (Task 3), widget theming (Tasks 4–5), verification (Task 6) — all seven design sections are covered.
- **Type consistency:** `BG`/`SURFACE`/`CARD`/`BORDER`/`WHITE`/`DIM`/`MUTED`/`BLUE`/`GREEN`/`AMBER`/`RED`/`PIE_COLORS`/`TABLE_HEAD` names match exactly between `adminTokens.js` and every import site across Tasks 2, 4, 5.
- **No placeholders:** every step shows the literal find/replace text or full new-file content; the `rgba(255,255,255,` sweep is intentionally a single mechanical substring replace (via `replace_all: true`) rather than manually enumerating ~90+ call sites, per the design doc's Section 1 rationale.
