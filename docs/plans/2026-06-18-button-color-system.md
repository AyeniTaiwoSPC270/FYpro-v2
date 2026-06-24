# Button Color System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix 8 CSS button color inconsistencies so every button in FYPro follows the agreed semantic system (AI Trigger → blue `#0066FF`, Commit/Confirm → green `#16A34A`).

**Architecture:** Pure CSS edits across 5 files. No JS, no component changes, no new classes. Each task targets one file, ends with a browser visual check, and commits immediately.

**Tech Stack:** CSS custom properties, Vite dev server (`npm run dev` in the project root)

## Global Constraints

- Never use hardcoded hex inside a `var()` call — use the hex directly as these files already do
- Hover state for green buttons: `background: #15803D`, `box-shadow: 0 0 20px rgba(22,163,74,0.35)`
- Hover state for blue buttons: `background: #0052CC`, `box-shadow: 0 0 20px rgba(0,102,255,0.4)`
- Do not change `border-radius`, `padding`, `font-size`, `font-weight`, `transition`, or any property not listed in a step
- Run `npm run typecheck` after all tasks — CSS changes cannot break TypeScript but confirms nothing else changed

---

## File Map

| File | Changes |
|---|---|
| `src/styles/defense-premium.css` | `dp-send-btn`, `dp-summary-done-btn` → blue; `dp-circuit-complete__btn-download` → green |
| `src/styles/steps-core.css` | `ma-btn-confirm`, `ca-btn-confirm` → green |
| `src/styles/writing-planner-email.css` | `wp-btn-confirm` → green |
| `src/styles/instrument-builder.css` | `di-btn-continue` → green |
| `src/styles/abstract-generator.css` | `pr-btn-confirm` → green |
| `src/styles/touch-targets.css` | Remove `.app-content` overrides for `ma-btn-confirm` and `wp-btn-confirm` |

---

### Task 1: Fix Defense Simulator buttons in defense-premium.css

**Files:**
- Modify: `src/styles/defense-premium.css` lines 168–194 (`dp-send-btn`), lines 280–305 (`dp-summary-done-btn`), lines 627–642 (`dp-circuit-complete__btn-download`)

- [ ] **Step 1: Fix dp-send-btn background and glow**

Find this block at line 168 and make two edits:

```css
/* BEFORE */
.dp-send-btn {
  background: #2563EB;
  ...
}
.dp-send-btn:hover:not(:disabled) {
  filter: brightness(1.12);
  box-shadow: 0 0 20px rgba(37, 99, 235, 0.45);
}

/* AFTER */
.dp-send-btn {
  background: #0066FF;
  ...
}
.dp-send-btn:hover:not(:disabled) {
  filter: brightness(1.12);
  box-shadow: 0 0 20px rgba(0, 102, 255, 0.45);
}
```

- [ ] **Step 2: Fix dp-summary-done-btn background and glow**

Find this block at line 280 and make two edits:

```css
/* BEFORE */
.dp-summary-done-btn {
  background: #2563EB;
  ...
}
.dp-summary-done-btn:hover {
  filter: brightness(1.12);
  box-shadow: 0 0 20px rgba(37, 99, 235, 0.45);
  transform: translateY(-1px);
}

/* AFTER */
.dp-summary-done-btn {
  background: #0066FF;
  ...
}
.dp-summary-done-btn:hover {
  filter: brightness(1.12);
  box-shadow: 0 0 20px rgba(0, 102, 255, 0.45);
  transform: translateY(-1px);
}
```

- [ ] **Step 3: Fix dp-circuit-complete__btn-download to green**

Find this block at line 627 and make two edits:

```css
/* BEFORE */
.dp-circuit-complete__btn-download {
  background: #0066FF;
  ...
}
.dp-circuit-complete__btn-download:hover {
  filter: brightness(1.12);
  box-shadow: 0 0 16px rgba(0, 102, 255, 0.4);
}

/* AFTER */
.dp-circuit-complete__btn-download {
  background: #16A34A;
  ...
}
.dp-circuit-complete__btn-download:hover {
  filter: brightness(1.12);
  box-shadow: 0 0 16px rgba(22, 163, 74, 0.4);
}
```

- [ ] **Step 4: Start dev server and verify visually**

```bash
npm run dev
```

Navigate to the Defense Simulator (`/app` → Step 6 → Enter Defence). Check:
- "Send Answer" button is now `#0066FF` blue (was electric blue — looks slightly brighter/purer now)
- After completing a session, "Close Defence Session" on the results screen is blue
- On the session-complete circuit panel, "Download" button is green

Also run a session to failure (circuit termination) to see the circuit-complete panel.

- [ ] **Step 5: Commit**

```bash
git add src/styles/defense-premium.css
git commit -m "fix(css): normalize defense simulator button colors to system palette

dp-send-btn and dp-summary-done-btn: #2563EB → #0066FF (AI Trigger blue).
dp-circuit-complete__btn-download: #0066FF → #16A34A (Commit green).

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 2: Fix confirm buttons in steps-core.css

**Files:**
- Modify: `src/styles/steps-core.css` lines 863–882 (`ca-btn-confirm`), lines 1236–1259 (`ma-btn-confirm`)

- [ ] **Step 1: Fix ca-btn-confirm to green**

Find `.ca-btn-confirm` at line 863:

```css
/* BEFORE */
.ca-btn-confirm {
  background: #0066FF;
  ...
}
.ca-btn-confirm:hover {
  background: #0052CC;
  box-shadow: 0 0 20px rgba(0,102,255,0.4);
  transform: translateY(-1px);
}

/* AFTER */
.ca-btn-confirm {
  background: #16A34A;
  ...
}
.ca-btn-confirm:hover {
  background: #15803D;
  box-shadow: 0 0 20px rgba(22,163,74,0.35);
  transform: translateY(-1px);
}
```

- [ ] **Step 2: Fix ma-btn-confirm base color to green**

Find `.ma-btn-confirm` at line 1236:

```css
/* BEFORE */
.ma-btn-confirm {
  background: #0066FF;
  ...
}
.ma-btn-confirm:hover:not(:disabled) {
  background: #0052CC;
  box-shadow: 0 0 20px rgba(0,102,255,0.4);
  transform: translateY(-1px);
}

/* AFTER */
.ma-btn-confirm {
  background: #16A34A;
  ...
}
.ma-btn-confirm:hover:not(:disabled) {
  background: #15803D;
  box-shadow: 0 0 20px rgba(22,163,74,0.35);
  transform: translateY(-1px);
}
```

- [ ] **Step 3: Verify visually**

With dev server running, navigate to Step 2 (Chapter Architect). Generate an outline and check that the "Confirm Outline" button is green. Then navigate to Step 3 (Methodology Advisor), select a methodology, and check that "Confirm Methodology" is green.

- [ ] **Step 4: Commit**

```bash
git add src/styles/steps-core.css
git commit -m "fix(css): ca-btn-confirm and ma-btn-confirm base color → green

Both are Commit actions. Previous base was #0066FF (blue).
ma-btn-confirm was visually green via a .app-content specificity override
in touch-targets.css — that override will be removed in a later task.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 3: Fix wp-btn-confirm in writing-planner-email.css

**Files:**
- Modify: `src/styles/writing-planner-email.css` lines 332–355 (`wp-btn-confirm`)

- [ ] **Step 1: Fix wp-btn-confirm base color to green**

Find `.wp-btn-confirm` at line 332:

```css
/* BEFORE */
.wp-btn-confirm {
  background: #0066FF;
  ...
}
.wp-btn-confirm:hover:not(:disabled) {
  background: #0052CC;
  box-shadow: 0 0 20px rgba(0,102,255,0.4);
  transform: translateY(-1px);
}

/* AFTER */
.wp-btn-confirm {
  background: #16A34A;
  ...
}
.wp-btn-confirm:hover:not(:disabled) {
  background: #15803D;
  box-shadow: 0 0 20px rgba(22,163,74,0.35);
  transform: translateY(-1px);
}
```

- [ ] **Step 2: Verify visually**

Navigate to Step 5 (Writing Planner). Generate a plan and check that "Confirm Plan" is green.

- [ ] **Step 3: Commit**

```bash
git add src/styles/writing-planner-email.css
git commit -m "fix(css): wp-btn-confirm base color → green (Commit category)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 4: Fix di-btn-continue in instrument-builder.css

**Files:**
- Modify: `src/styles/instrument-builder.css` lines 353–372 (`di-btn-continue`)

- [ ] **Step 1: Fix di-btn-continue to green**

Find `.di-btn-continue` at line 353:

```css
/* BEFORE */
.di-btn-continue {
  background: #0066FF;
  ...
}
.di-btn-continue:hover {
  background: #0052CC;
  box-shadow: 0 0 20px rgba(0,102,255,0.4);
  transform: translateY(-1px);
}

/* AFTER */
.di-btn-continue {
  background: #16A34A;
  ...
}
.di-btn-continue:hover {
  background: #15803D;
  box-shadow: 0 0 20px rgba(22,163,74,0.35);
  transform: translateY(-1px);
}
```

- [ ] **Step 2: Verify visually**

Navigate to the Instrument Builder (embedded in Step 3 / Methodology Advisor). Generate an instrument and check that the "Continue" button is green.

- [ ] **Step 3: Commit**

```bash
git add src/styles/instrument-builder.css
git commit -m "fix(css): di-btn-continue → green (Commit category)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 5: Fix pr-btn-confirm in abstract-generator.css

**Files:**
- Modify: `src/styles/abstract-generator.css` lines 970–988 (`pr-btn-confirm`)

- [ ] **Step 1: Fix pr-btn-confirm to green**

Find `.pr-btn-confirm` at line 970:

```css
/* BEFORE */
.pr-btn-confirm {
  background: var(--color-blue-primary);
  ...
}
.pr-btn-confirm:hover {
  background: #0052CC;
  box-shadow: var(--shadow-blue-glow);
  transform: translateY(-1px);
}

/* AFTER */
.pr-btn-confirm {
  background: #16A34A;
  ...
}
.pr-btn-confirm:hover {
  background: #15803D;
  box-shadow: 0 0 20px rgba(22,163,74,0.35);
  transform: translateY(-1px);
}
```

- [ ] **Step 2: Verify visually**

Navigate to Project Reviewer (Step 4 / Defense Pack feature). Upload a PDF and complete the review. Check that the "Confirm Review" button at the bottom is green.

- [ ] **Step 3: Commit**

```bash
git add src/styles/abstract-generator.css
git commit -m "fix(css): pr-btn-confirm → green (Commit category)

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

### Task 6: Remove redundant .app-content overrides from touch-targets.css

**Files:**
- Modify: `src/styles/touch-targets.css` lines 743–763

These overrides used CSS specificity (`!important`) to force `ma-btn-confirm` and `wp-btn-confirm` to appear green when they had a blue base. Tasks 2 and 3 set the base colors to green directly, making these overrides not just redundant but a maintenance hazard (they apply gradient green on top of flat green).

- [ ] **Step 1: Remove the entire .app-content override block**

Find and delete lines 743–763 in `src/styles/touch-targets.css`:

```css
/* DELETE THIS ENTIRE BLOCK — lines 743–763 */

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
```

- [ ] **Step 2: Verify visually — both confirm buttons still appear green**

Navigate to Step 3 (Methodology Advisor) and confirm the "Confirm Methodology" button is still green. Navigate to Step 5 (Writing Planner) and confirm "Confirm Plan" is still green. They should now use the flat `#16A34A` set in steps-core.css and writing-planner-email.css instead of the gradient override.

- [ ] **Step 3: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors (CSS changes cannot affect TypeScript).

- [ ] **Step 4: Commit**

```bash
git add src/styles/touch-targets.css
git commit -m "fix(css): remove redundant .app-content confirm button overrides

ma-btn-confirm and wp-btn-confirm base colors now set correctly in
their source files (steps-core.css, writing-planner-email.css).
The !important gradient overrides in touch-targets.css are no longer
needed and were a fragile specificity hack.

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Done

All 8 button color inconsistencies resolved. The semantic system from `docs/specs/2026-06-18-button-color-system-design.md` is now fully reflected in the CSS:

- Blue `#0066FF` — AI Trigger + Entry Point buttons
- Green `#16A34A` — Commit / Confirm buttons  
- Ghost — Navigation / Secondary
- Red Ghost — Danger / Destructive
- Dim Ghost — System / Utility
