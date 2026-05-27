# Frontend Design Execution Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the gap between MASTER.md design spec and the rendered UI across FYPro's 6-step workflow — midnight blue workspace, per-step accent card colors, step-number watermarks, per-step nav pill colors, green CTA buttons, and JetBrains Mono for the defense score display.

**Architecture:** Append-only CSS block at the bottom of `src/index.css` (per CLAUDE.md rules — never modify existing blocks). One targeted JSX edit to `AppShell.jsx` for `STEP_COLORS`, `data-step` attribute, and sidebar badge inline colors. No component file changes needed — all heading fonts, verdict typography, and most button colors are already correct in the existing CSS.

**Tech Stack:** CSS (`!important` overrides in append-only block), React JSX inline styles for sidebar badges

---

## Files Changed

| File | Change |
|------|--------|
| `src/index.css` | Append ~160 lines to end: workspace bg, card accents, watermarks, nav pills, connectors, missing button CTAs, score font |
| `src/features/shell/AppShell.jsx` | Add `STEP_COLORS` const, `data-step` attr on nav pills, per-step inline style on sidebar badges |

**What is NOT needed (already correct in existing CSS):**
- Step label fonts — all `.{prefix}-step-label` classes already use `'DM Serif Display'`
- Verdict font — `.tv-verdict-label` already has `font-family: 'JetBrains Mono'`
- Methodology badge font — `.di-methodology-badge` already has `font-family: 'JetBrains Mono'`
- Card entrance animation — `card-enter` keyframe at line 3016 already applied to all card classes in original CSS; dark override does not remove it
- Validate/Generate/Analyse buttons — already blue in existing dark override block (lines 5250–5314)
- `tv-btn-use` ("Use This Topic") — already green in existing dark override (line 5258)

---

## Task 1 — Workspace background + per-step card accent colors

**Files:**
- Modify: `src/index.css` (append to end)

- [ ] **Step 1: Append the workspace + card accent CSS block**

Open `src/index.css`. Scroll to the very end (currently line 10674). Append exactly this block:

```css
/* ════════════════════════════════════════════════════════════════════
   DESIGN EXECUTION — 2026-05-24
   Midnight blue workspace, per-step accent card colors, watermarks,
   nav pill per-step colors, CTA button fixes, defense score font.
   Append-only — never modify existing blocks above this line.
   ════════════════════════════════════════════════════════════════════ */

/* ── A1. Workspace background → midnight blue ────────────────────── */
.app-content {
  background-color: #0B1929 !important;
}

/* ── A2. Per-step card accent colors ─────────────────────────────── */
/* All cards share the same #112240→#0D1E35 gradient base.
   Each step gets a distinct border-left, border tint, and glow.    */

/* Step 1 — Topic Validator: Blue #0066FF */
.app-content .tv-card {
  background: linear-gradient(145deg, #112240 0%, #0D1E35 100%) !important;
  border: 1px solid rgba(0,102,255,0.09) !important;
  border-left: 4px solid #0066FF !important;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 36px rgba(0,102,255,0.09) !important;
  position: relative !important;
  overflow: hidden !important;
}
/* Preserve verdict-tinted backgrounds — must come AFTER .tv-card rule */
.app-content .tv-card.tv-card--green  { background: linear-gradient(145deg,#061a10 0%,#071a14 100%) !important; }
.app-content .tv-card.tv-card--yellow { background: linear-gradient(145deg,#1a1406 0%,#141208 100%) !important; }
.app-content .tv-card.tv-card--red    { background: linear-gradient(145deg,#1a0608 0%,#14060a 100%) !important; }

/* Step 2 — Chapter Architect / Literature Map / Abstract Gen: Cyan #06B6D4 */
.app-content .ca-card,
.app-content .ag-card,
.app-content .lm-card {
  background: linear-gradient(145deg, #112240 0%, #0D1E35 100%) !important;
  border: 1px solid rgba(6,182,212,0.09) !important;
  border-left: 4px solid #06B6D4 !important;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 36px rgba(6,182,212,0.09) !important;
  position: relative !important;
  overflow: hidden !important;
}

/* Step 3 — Methodology Advisor / Instrument Builder: Amber #F59E0B */
.app-content .ma-card,
.app-content .di-card {
  background: linear-gradient(145deg, #112240 0%, #0D1E35 100%) !important;
  border: 1px solid rgba(245,158,11,0.09) !important;
  border-left: 4px solid #F59E0B !important;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 36px rgba(245,158,11,0.09) !important;
  position: relative !important;
  overflow: hidden !important;
}

/* Step 4 — Writing Planner: Green #16A34A */
.app-content .wp-card {
  background: linear-gradient(145deg, #112240 0%, #0D1E35 100%) !important;
  border: 1px solid rgba(22,163,74,0.09) !important;
  border-left: 4px solid #16A34A !important;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 36px rgba(22,163,74,0.09) !important;
  position: relative !important;
  overflow: hidden !important;
}

/* Step 5 — Project Reviewer: Violet #8B5CF6 */
.app-content .pr-card {
  background: linear-gradient(145deg, #112240 0%, #0D1E35 100%) !important;
  border: 1px solid rgba(139,92,246,0.09) !important;
  border-left: 4px solid #8B5CF6 !important;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 36px rgba(139,92,246,0.09) !important;
  position: relative !important;
  overflow: hidden !important;
}

/* Step 6 — Defense Prep: Red #DC2626 */
.app-content .dp-card {
  background: linear-gradient(145deg, #112240 0%, #0D1E35 100%) !important;
  border: 1px solid rgba(220,38,38,0.09) !important;
  border-left: 4px solid #DC2626 !important;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 36px rgba(220,38,38,0.09) !important;
  position: relative !important;
  overflow: hidden !important;
}

/* Supervisor Email — bonus (unnumbered), keep blue */
.app-content .se-card {
  background: linear-gradient(145deg, #112240 0%, #0D1E35 100%) !important;
  border: 1px solid rgba(0,102,255,0.09) !important;
  border-left: 4px solid #0066FF !important;
  box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 36px rgba(0,102,255,0.09) !important;
  position: relative !important;
  overflow: hidden !important;
}
```

- [ ] **Step 2: Save the file and verify it builds without errors**

Run: `npm run dev` (or check the existing dev server is still running)
Expected: no build errors in the terminal

- [ ] **Step 3: Visual check — workspace and card borders**

Open http://localhost:5173/app in a browser.
Check:
- Background is midnight blue (#0B1929), not `#060E18` (was slightly lighter/greener before)
- Topic Validator card has a blue left border
- Navigate to Chapter Architect — cyan left border
- Navigate to Methodology Advisor — amber left border
- Navigate to Writing Planner — green left border
- Navigate to Project Reviewer — violet left border
- Navigate to Defense Prep — red left border
- Run a topic validation to get the green/yellow/red verdict card — verify the verdict-tinted background still shows (not overridden to midnight blue)

- [ ] **Step 4: Commit**

```
git add src/index.css
git commit -m "style(workspace): midnight blue bg + per-step card accent colors"
```

---

## Task 2 — Step-number watermarks

**Files:**
- Modify: `src/index.css` (append to end, after Task 1 block)

**Context:** Watermarks are large faded step numbers in the top-right corner of each card, rendered via CSS `::before` pseudo-elements. Cards have `position: relative; overflow: hidden` added in Task 1, so this is safe to add now.

- [ ] **Step 1: Append the watermark CSS block**

Append exactly this to the bottom of `src/index.css` (after the Task 1 block):

```css
/* ── A3. Step-number watermarks via ::before ─────────────────────── */
/* Large faded number, accent color at 5% opacity, top-right of card  */

.app-content .tv-card::before {
  content: '1';
  font-family: 'JetBrains Mono', monospace;
  font-size: 140px;
  font-weight: 700;
  color: rgba(0,102,255,0.05);
  position: absolute;
  top: -20px;
  right: -10px;
  line-height: 1;
  pointer-events: none;
  user-select: none;
  z-index: 0;
}

.app-content .ca-card::before,
.app-content .ag-card::before,
.app-content .lm-card::before {
  content: '2';
  font-family: 'JetBrains Mono', monospace;
  font-size: 140px;
  font-weight: 700;
  color: rgba(6,182,212,0.05);
  position: absolute;
  top: -20px;
  right: -10px;
  line-height: 1;
  pointer-events: none;
  user-select: none;
  z-index: 0;
}

.app-content .ma-card::before,
.app-content .di-card::before {
  content: '3';
  font-family: 'JetBrains Mono', monospace;
  font-size: 140px;
  font-weight: 700;
  color: rgba(245,158,11,0.05);
  position: absolute;
  top: -20px;
  right: -10px;
  line-height: 1;
  pointer-events: none;
  user-select: none;
  z-index: 0;
}

.app-content .wp-card::before {
  content: '4';
  font-family: 'JetBrains Mono', monospace;
  font-size: 140px;
  font-weight: 700;
  color: rgba(22,163,74,0.05);
  position: absolute;
  top: -20px;
  right: -10px;
  line-height: 1;
  pointer-events: none;
  user-select: none;
  z-index: 0;
}

.app-content .pr-card::before {
  content: '5';
  font-family: 'JetBrains Mono', monospace;
  font-size: 140px;
  font-weight: 700;
  color: rgba(139,92,246,0.05);
  position: absolute;
  top: -20px;
  right: -10px;
  line-height: 1;
  pointer-events: none;
  user-select: none;
  z-index: 0;
}

.app-content .dp-card::before {
  content: '6';
  font-family: 'JetBrains Mono', monospace;
  font-size: 140px;
  font-weight: 700;
  color: rgba(220,38,38,0.05);
  position: absolute;
  top: -20px;
  right: -10px;
  line-height: 1;
  pointer-events: none;
  user-select: none;
  z-index: 0;
}
```

- [ ] **Step 2: Visual check — watermarks visible**

In the browser:
- Each step card should show a faint large number in the top-right corner
- The number should be barely visible (5% opacity) — it adds depth without distracting from content
- Watermark should not overlap or clip buttons or inputs (it's behind all content because `z-index: 0` and card content is `z-index: 1` or stacking context above)
- On the Topic Validator after validation, the verdict-tinted card (green/yellow/red) should also show "1" faintly

If the watermark clips card content: reduce `font-size` to 120px or shift `top` to `-10px`.

- [ ] **Step 3: Commit**

```
git add src/index.css
git commit -m "style(cards): step-number watermarks via CSS ::before pseudo-elements"
```

---

## Task 3 — AppShell.jsx: STEP_COLORS, data-step, sidebar badge colors

**Files:**
- Modify: `src/features/shell/AppShell.jsx`

**Context:**
- `STEP_COLORS` is a constant array mapping step index → accent hex. Used for badge inline styles.
- `data-step={String(i + 1)}` on each `.nav-pill` div enables the CSS selectors in Task 4 to target pills by step without nth-child fragility.
- Sidebar `.step-list__badge` gets a per-step background color when the step is current or completed.
- Nav connector gradients are handled via CSS in Task 4 using the adjacent sibling selector (`.nav-pill[data-step="X"].nav-pill--completed + .nav-connector--completed`) — no inline styles needed in JSX for connectors.

- [ ] **Step 1: Add STEP_COLORS constant**

In `src/features/shell/AppShell.jsx`, find the existing constants block (around line 19, after the imports). The `STEPS` array is defined there. Add the `STEP_COLORS` constant immediately after `STEP_COMPONENTS`:

Find this:
```javascript
const STEP_COMPONENTS = [
  TopicValidator,
  ChapterArchitect,
  MethodologyAdvisor,
  WritingPlanner,
  ProjectReviewer,
  DefensePrep,
]
```

Add immediately after:
```javascript
const STEP_COLORS = ['#0066FF', '#06B6D4', '#F59E0B', '#16A34A', '#8B5CF6', '#DC2626']
```

- [ ] **Step 2: Add data-step attribute to nav pills**

In the same file, find the nav pill div inside the `STEPS.map` (around line 340). Find this exact block:

```jsx
<div
  className={[
    'nav-pill',
    isCompleted ? 'nav-pill--completed' : '',
    isCurrent   ? 'nav-pill--current'   : '',
  ].filter(Boolean).join(' ')}
  style={isAccessible ? { cursor: 'pointer' } : undefined}
  onClick={isAccessible ? () => navigateStep(i) : undefined}
  title={name}
>
```

Replace with (add `data-step` line only):
```jsx
<div
  className={[
    'nav-pill',
    isCompleted ? 'nav-pill--completed' : '',
    isCurrent   ? 'nav-pill--current'   : '',
  ].filter(Boolean).join(' ')}
  data-step={String(i + 1)}
  style={isAccessible ? { cursor: 'pointer' } : undefined}
  onClick={isAccessible ? () => navigateStep(i) : undefined}
  title={name}
>
```

- [ ] **Step 3: Add per-step color to sidebar step badges**

Find the `.step-list__badge` div in the STEPS.map for the sidebar (around line 257). Find this:

```jsx
<div className="step-list__badge">
```

Replace with:
```jsx
<div
  className="step-list__badge"
  style={(isCompleted || isCurrent) ? { background: STEP_COLORS[i], borderColor: STEP_COLORS[i] } : undefined}
>
```

- [ ] **Step 4: Visual check — sidebar badges and nav data-step**

In the browser:
- Sidebar step badges: the active step badge should show in its accent color (step 1 = blue, step 2 = cyan, etc.)
- Completed step badges: should show the step's accent color (not the old fixed blue)
- Open DevTools → Inspector → click a nav pill → confirm `data-step="1"` (or correct number) attribute is present in the DOM

- [ ] **Step 5: Commit**

```
git add src/features/shell/AppShell.jsx
git commit -m "style(shell): STEP_COLORS constant, data-step on nav pills, per-step sidebar badge colors"
```

---

## Task 4 — Nav pill per-step colors + connector gradients (CSS)

**Files:**
- Modify: `src/index.css` (append to end, after Task 2 block)

**Context:** This task depends on Task 3 being done first (the `data-step` attribute must be in the DOM for these CSS selectors to work). Nav connectors use the CSS adjacent sibling selector: `.nav-pill[data-step="X"].nav-pill--completed + .nav-connector--completed`. This avoids inline style vs `!important` collisions.

- [ ] **Step 1: Append the nav pill + connector CSS block**

Append exactly this to the bottom of `src/index.css`:

```css
/* ── A4. Nav pill per-step accent colors ─────────────────────────── */
/* Requires data-step attribute on each .nav-pill (added in Task 3)   */

/* Step 1 — Blue */
.nav-pill[data-step="1"].nav-pill--current,
.nav-pill[data-step="1"].nav-pill--completed {
  background: #0066FF !important;
  border-color: #0066FF !important;
  color: #ffffff !important;
  box-shadow: 0 0 12px rgba(0,102,255,0.45) !important;
}

/* Step 2 — Cyan */
.nav-pill[data-step="2"].nav-pill--current,
.nav-pill[data-step="2"].nav-pill--completed {
  background: #06B6D4 !important;
  border-color: #06B6D4 !important;
  color: #ffffff !important;
  box-shadow: 0 0 12px rgba(6,182,212,0.45) !important;
}

/* Step 3 — Amber (dark text for contrast on light amber) */
.nav-pill[data-step="3"].nav-pill--current,
.nav-pill[data-step="3"].nav-pill--completed {
  background: #F59E0B !important;
  border-color: #F59E0B !important;
  color: #000000 !important;
  box-shadow: 0 0 12px rgba(245,158,11,0.45) !important;
}

/* Step 4 — Green */
.nav-pill[data-step="4"].nav-pill--current,
.nav-pill[data-step="4"].nav-pill--completed {
  background: #16A34A !important;
  border-color: #16A34A !important;
  color: #ffffff !important;
  box-shadow: 0 0 12px rgba(22,163,74,0.45) !important;
}

/* Step 5 — Violet */
.nav-pill[data-step="5"].nav-pill--current,
.nav-pill[data-step="5"].nav-pill--completed {
  background: #8B5CF6 !important;
  border-color: #8B5CF6 !important;
  color: #ffffff !important;
  box-shadow: 0 0 12px rgba(139,92,246,0.45) !important;
}

/* Step 6 — Red */
.nav-pill[data-step="6"].nav-pill--current,
.nav-pill[data-step="6"].nav-pill--completed {
  background: #DC2626 !important;
  border-color: #DC2626 !important;
  color: #ffffff !important;
  box-shadow: 0 0 12px rgba(220,38,38,0.45) !important;
}

/* ── A4b. Nav connector per-step gradients ───────────────────────── */
/* Adjacent sibling selector: pill (completed) → its connector        */
.nav-pill[data-step="1"].nav-pill--completed + .nav-connector--completed {
  background: linear-gradient(90deg, #0066FF, #06B6D4) !important;
}
.nav-pill[data-step="2"].nav-pill--completed + .nav-connector--completed {
  background: linear-gradient(90deg, #06B6D4, #F59E0B) !important;
}
.nav-pill[data-step="3"].nav-pill--completed + .nav-connector--completed {
  background: linear-gradient(90deg, #F59E0B, #16A34A) !important;
}
.nav-pill[data-step="4"].nav-pill--completed + .nav-connector--completed {
  background: linear-gradient(90deg, #16A34A, #8B5CF6) !important;
}
.nav-pill[data-step="5"].nav-pill--completed + .nav-connector--completed {
  background: linear-gradient(90deg, #8B5CF6, #DC2626) !important;
}
```

- [ ] **Step 2: Visual check — nav pills and connectors**

In the browser (complete a couple of steps to get completed pills):
- Current step pill should show its accent color with a glow ring
- Completed step pill should show its accent color (solid fill)
- Connector between two completed steps should gradient from step N's color to step N+1's color
- Step 3 pill (amber) should have dark/black text for legibility
- Inactive pills remain grey (existing CSS handles this)

- [ ] **Step 3: Commit**

```
git add src/index.css
git commit -m "style(nav): per-step pill accent colors and connector gradients"
```

---

## Task 5 — Confirm button CTAs green + defense score JetBrains Mono

**Files:**
- Modify: `src/index.css` (append to end, after Task 4 block)

**Context:**
- `ma-btn-confirm` ("Confirm Methodology") and `wp-btn-confirm` ("Confirm Plan") are both blue in base CSS and not overridden in the existing dark override block. They are CTA buttons (user commits to a choice) → should be green.
- `dp-results-bar__score` shows the final defense score (e.g., "7/10"). Its CSS at line 7772 sets `color` and `font-weight` but no `font-family`. It inherits Poppins from the parent. Needs JetBrains Mono for the precision-instrument feel.
- All other button colors (`tv-btn-validate`, `ca-btn-generate`, `ma-btn-analyse`, `wp-btn-generate`) are already correct blue in the existing dark override (lines 5250–5314). Do not touch them.

- [ ] **Step 1: Append the button + score font CSS block**

Append exactly this to the bottom of `src/index.css`:

```css
/* ── A5. Confirm button CTAs → green ─────────────────────────────── */
/* ma-btn-confirm and wp-btn-confirm are "Confirm" CTAs (user commits  */
/* to a methodology / plan) — green matches CTA semantic convention.  */

.app-content .ma-btn-confirm {
  background: linear-gradient(135deg, #16A34A, #15803D) !important;
  box-shadow: 0 2px 8px rgba(22,163,74,0.35) !important;
}
.app-content .ma-btn-confirm:hover:not(:disabled) {
  background: linear-gradient(135deg, #22C55E, #16A34A) !important;
  box-shadow: 0 0 24px rgba(22,163,74,0.5) !important;
}

.app-content .wp-btn-confirm {
  background: linear-gradient(135deg, #16A34A, #15803D) !important;
  box-shadow: 0 2px 8px rgba(22,163,74,0.35) !important;
}
.app-content .wp-btn-confirm:hover:not(:disabled) {
  background: linear-gradient(135deg, #22C55E, #16A34A) !important;
  box-shadow: 0 0 24px rgba(22,163,74,0.5) !important;
}

/* ── A5b. Defense score display → JetBrains Mono ─────────────────── */
/* The final panel score (e.g. "7/10") should feel like a readout.   */

.dp-results-bar__score {
  font-family: 'JetBrains Mono', monospace !important;
}
```

- [ ] **Step 2: Visual check — confirm buttons and score font**

In the browser:
- Go to Methodology Advisor, run an analysis, select a methodology → "Confirm Methodology" button should be green (not blue)
- Go to Writing Planner, generate a plan → "Confirm Plan" button should be green (not blue)
- Complete a Defense Simulator session → the score display (e.g., "7/10") should render in JetBrains Mono (monospace, distinct from Poppins body text)

- [ ] **Step 3: Commit**

```
git add src/index.css
git commit -m "style(buttons): green confirm CTAs + JetBrains Mono for defense score"
```

---

## Task 6 — Code review (two parallel subagents)

**Context:** Per the spec, two parallel subagents review the changes independently before anything is considered done. Launch them together so reviews run concurrently.

- [ ] **Step 1: Launch both review subagents in parallel**

Dispatch Agent 1 and Agent 2 at the same time (both in the same message).

**Agent 1 — CSS review**

Prompt:
> Review the CSS appended to the bottom of `src/index.css` in this branch (the block starting with the comment "DESIGN EXECUTION — 2026-05-24"). Check for:
> 1. **Specificity conflicts**: Do any new selectors lose to earlier `!important` rules above them in the file? The verdict-colored card backgrounds (`.tv-card--green/yellow/red`) must use `.app-content .tv-card.tv-card--green` (3 classes, wins) not `.app-content .tv-card--green` (2 classes, loses to the new `.app-content .tv-card` rule appended at the same specificity level).
> 2. **position:relative / overflow:hidden**: Confirm that every card class in the new block (tv, ca, ag, lm, ma, di, wp, pr, dp, se) has both `position: relative !important; overflow: hidden !important;` applied. The `::before` watermark requires these.
> 3. **Watermark content strings**: Confirm `tv-card` → '1', `ca/ag/lm-card` → '2', `ma/di-card` → '3', `wp-card` → '4', `pr-card` → '5', `dp-card` → '6'. No watermark on `se-card` (unnumbered bonus).
> 4. **Animation coverage**: Confirm `card-enter` keyframe is present (line ~3016) and that the original CSS applies it to the card classes. Confirm the new block does NOT remove `animation` from any card class.
> 5. **Nav connector selectors**: Confirm the adjacent sibling selector `.nav-pill[data-step="X"].nav-pill--completed + .nav-connector--completed` is syntactically correct and covers steps 1–5 (no connector after step 6 — it's the last pill).
>
> Report: list each check as PASS or FAIL with a brief reason.

**Agent 2 — Component and integration review**

Prompt:
> Review the changes to `src/features/shell/AppShell.jsx` in this branch. Check for:
> 1. **STEP_COLORS array**: Confirm it has exactly 6 entries in the correct order: `['#0066FF', '#06B6D4', '#F59E0B', '#16A34A', '#8B5CF6', '#DC2626']`. Confirm it is module-scoped (not inside a component function).
> 2. **data-step attribute**: Confirm `data-step={String(i + 1)}` is present on each `.nav-pill` div in the `STEPS.map`. Confirm it uses `i + 1` (not `i`), so steps are 1-indexed in the DOM.
> 3. **Sidebar badge inline style**: Confirm `.step-list__badge` has `style={(isCompleted || isCurrent) ? { background: STEP_COLORS[i], borderColor: STEP_COLORS[i] } : undefined}`. Confirm the condition is `isCompleted || isCurrent` (not just `isCurrent`).
> 4. **No broken hover states**: Confirm no existing button hover handlers in AppShell.jsx were accidentally removed or modified.
> 5. **Button semantic check (cross-file)**: Confirm the existing dark override in `index.css` (around line 5250) has `tv-btn-validate` as blue and `tv-btn-use` as green. Confirm the new block (Task 5) has `ma-btn-confirm` and `wp-btn-confirm` as green. Confirm no "Generate/Validate/Analyse" action button was accidentally turned green.
>
> Report: list each check as PASS or FAIL with a brief reason.

- [ ] **Step 2: Read both agent reports and fix any FAILs**

If Agent 1 or Agent 2 reports a FAIL:
- Fix the issue in the relevant file
- Re-run the failing check manually to confirm it's resolved
- Commit the fix: `git commit -m "fix(design): [describe what was wrong]"`

- [ ] **Step 3: Final visual walkthrough**

Walk through all 6 steps in the browser and confirm every success criterion from the spec:
- [ ] Workspace background is midnight blue (#0B1929) with dot texture
- [ ] Each step card has a visually distinct left border in its accent color
- [ ] Each step card shows a faint step number in the top-right corner
- [ ] Primary CTA buttons (Use This Topic, Confirm Methodology, Confirm Plan) are green
- [ ] Action buttons (Validate Topic, Generate Chapters, Analyse Methodology, Generate Plan) are blue
- [ ] Step labels use DM Serif Display (already correct — verify still working)
- [ ] Defense score display uses JetBrains Mono
- [ ] Active nav pill shows the current step's accent color
- [ ] Completed nav pills show their step's accent color
- [ ] Connector between two completed steps gradients from one step's color to the next
- [ ] Sidebar step badge shows the step's accent color when active or completed
- [ ] Card entrance animation plays when navigating to a new step
- [ ] No existing functionality broken (complete a full topic validation end-to-end)

- [ ] **Step 4: Final commit (if any last fixes)**

```
git add src/index.css src/features/shell/AppShell.jsx
git commit -m "style(review-fixes): address code review findings"
```

---

## Self-review Notes

**Spec coverage check:**
- A1 (workspace bg): Task 1 ✓
- A2 (per-step card colors): Task 1 ✓
- A3 (watermarks): Task 2 ✓
- A4 (nav pill colors): Task 4 ✓ (requires Task 3 for data-step)
- A5 (card animations): existing CSS already handles this — no action needed ✓
- B1 (STEP_COLORS): Task 3 ✓
- B2 (data-step): Task 3 ✓
- B3 (badge colors): Task 3 ✓
- B4 (connector gradients): Task 4 (done via CSS, not JSX inline styles) ✓
- C1 (button semantics): Task 5 for missing confirms; existing dark override handles the rest ✓
- C2 (heading typography): all step labels already use DM Serif Display — no action ✓
- C3 (verdict/score/badge font): verdict and badge already have JetBrains Mono; score fixed in Task 5 ✓

**Ordering constraint:** Task 4 MUST run after Task 3 (data-step attribute must be in the DOM for CSS selectors to match).

**Verdict card background note:** The `.tv-card.tv-card--green` combined selector in Task 1 has 3 class selectors (higher specificity than the new `.app-content .tv-card` with 2) — verdict-tinted backgrounds are preserved correctly.
