# Button Color System — Design Spec
**Date:** 2026-06-18  
**Status:** Approved  
**Scope:** All interactive buttons across fypro-v2 (src/ + admin panel)  
**Fixes:** 5 CSS changes across 3 files

---

## Problem

FYPro had no written rule for which color a button should be. The result was four inconsistencies:
- Defense Simulator buttons used `#2563EB` (electric blue) while every other blue button used `#0066FF`
- Download PDF meant green in Defence Brief but blue in the Defense circuit-complete panel
- `ma-btn-confirm` and `wp-btn-confirm` had `#0066FF` as their base color but were overridden to green only inside `.app-content` — a fragile CSS specificity hack
- "Continue" buttons were blue in onboarding but green in other contexts

---

## The System — 6 Categories, 5 Treatments

Every button in the app belongs to exactly one of these six semantic categories. Color follows category, not component.

### 1. AI Trigger
**Color:** Solid Blue `#0066FF`  
**Rule:** "I am asking the AI to act."  
**Buttons:** Validate Topic, Generate Outline, Regenerate Outline, Analyse Methodology, Generate Instrument, Generate Plan, Generate Abstract, Generate Map, Review PDF, Generate Brief, Generate Email, Generate Questions

### 2. Commit / Confirm
**Color:** Solid Green `#16A34A`  
**Rule:** "I accept this result and advance the workflow."  
**Buttons:** Use This Topic, Confirm Outline, Confirm Methodology, Continue (Instrument Builder), Confirm Plan, Confirm Review, Download PDF (Defence Brief), Confirm (Defence Brief coaching), Enter App (completion screen)

### 3. Entry Point / CTA
**Color:** Solid Blue `#0066FF`  
**Rule:** Same blue as AI Trigger. Differentiated by **shape only** — landing page CTAs use `border-radius: 999px` (pill); in-app entry buttons use standard `border-radius: 10-12px` (rounded rect).  
**Buttons:** Start Free (landing, ×2), Get Express Defence (landing), Enter Defence, Install App (PWA), Get Started (walkthrough)

### 4. Navigation / Secondary
**Color:** Ghost — `background: transparent`, `border: 1.5px solid` using `--color-border-strong`  
**Rule:** "This does not advance or commit state — it moves around or edits."  
**Buttons:** ← Back (all steps), Edit Chapter, Methodology selectors, Copy Email, Start Over, Practice Answering, Not Now (PWA), Skip (tour), Restart (circuit complete on dark bg uses white ghost variant)

### 5. Danger / Destructive
**Color:** Red Ghost — `background: transparent`, `border: 1.5px solid rgba(248,113,113,0.45)`, `color: #F87171`  
**Rule:** Never solid red fill. Visible threat without being alarming.  
**Buttons:** End Defence, Leave Defence Early, Delete Project

### 6. System / Utility
**Color:** Dim Ghost — `background: transparent`, `border: 1px solid rgba(255,255,255,0.1)`, muted text  
**Rule:** Non-workflow UI chrome. Admin buttons use contextual inline `color` + `borderColor` overrides on top of the same dim ghost base.  
**Contextual admin accents:**
- Resolve / approve → green text `rgba(74,222,128,0.8)` + green border
- Warn / Unban → amber text `rgba(251,191,36,0.8)` + amber border  
- Delete / Ban → red text `rgba(248,113,113,0.7)` + red border
- Default → muted white text `rgba(255,255,255,0.55)`  
**Buttons:** Retry (error box), Admin action buttons (Ban, +Stu, +Def, +Exp, Reset, Runs, Diag, Resolve, Prev/Next), Sidebar toggle, Mic button

---

## Decision: Defense Simulator Blue

The Defense Simulator previously used `#2563EB` for Send Answer and Close Session (inside the dark overlay). **Decision: normalize to `#0066FF`.** These are AI Trigger / Entry Point actions and must follow the standard system. The dark overlay provides sufficient visual context without a unique blue shade.

---

## Required CSS Changes (4 fixes)

| Button | File | Change |
|---|---|---|
| `dp-send-btn` | `src/styles/defense-premium.css` | `background: #2563EB` → `#0066FF`, update glow from `rgba(37,99,235,...)` → `rgba(0,102,255,...)` |
| `dp-summary-done-btn` | `src/styles/defense-premium.css` | `background: #2563EB` → `#0066FF`, update glow |
| `dp-circuit-complete__btn-download` | `src/styles/defense-premium.css` | `background: #0066FF` → `#16A34A` (download = Commit category, same as db-btn-download) |
| `ma-btn-confirm` | `src/styles/steps-core.css` + `src/styles/touch-targets.css` | Set base to `#16A34A`; remove `.app-content .ma-btn-confirm` override in touch-targets.css |
| `wp-btn-confirm` | `src/styles/writing-planner-email.css` + `src/styles/touch-targets.css` | Set base to `#16A34A`; remove `.app-content .wp-btn-confirm` override in touch-targets.css |

---

## What Does Not Change

All of the following already follow the system correctly and require no edits:

- All 23 solid blue AI trigger buttons
- `tv-btn-use`, `ca-btn-confirm`, `db-btn-download`, `db-btn-confirm`, `cs-btn-enter`, `pr-btn-confirm`, `di-btn-continue` (all green ✓)
- All `fy-back-btn` instances (ghost ✓)
- `dp-defense-end-btn`, `dp-exit-modal-leave` (red ghost ✓)
- All admin `mc-action-btn` instances (dim ghost with contextual accents ✓)
- Landing page pill CTAs (blue, pill shape ✓)
- `oq-skip`, `oq-tour-skip`, `db-btn-skip`, `sp-back-btn`, `tv-push-card__btn--no` (text/borderless ghost — acceptable for minimal dismiss actions)

---

## Non-Goals

- No changes to button shape, size, or typography
- No changes to hover/active/disabled states beyond the color fix
- No new button classes — all fixes are to existing CSS properties only
- Admin panel inline styles remain as-is (they already follow the dim ghost + contextual accent pattern)
