# Frontend Design Execution — Spec
**Date:** 2026-05-24
**Approach:** C — Hybrid (CSS layer + targeted component edits)
**Scope:** Close the gap between MASTER.md design spec and the rendered UI across FYPro's 6-step workflow

---

## 1. Decisions Made

| Dimension | Decision |
|-----------|----------|
| Overall tone | Midnight blue — `#0B1929` workspace, `#112240→#0D1E35` cards |
| Card differentiation | Per-step accent colors — left border + badge + glow |
| Step number watermarks | Yes — JetBrains Mono, accent color at 5% opacity, top-right of each card |
| Button semantics | Green `#16A34A` for CTAs, Blue `#0066FF` for action buttons |
| Typography | DM Serif Display headings, JetBrains Mono scores/badges, Poppins body |
| Animations | Card entrance fade-up 0.4s, nav dot completion pulse (one-shot) |

---

## 2. Step → Accent Color Map

| Step | Card classes | Accent color | Hex |
|------|-------------|--------------|-----|
| 1 — Topic Validator | `.tv-card` | Blue | `#0066FF` |
| 2 — Chapter Architect | `.ca-card`, `.ag-card`, `.lm-card` | Cyan | `#06B6D4` |
| 3 — Methodology Advisor | `.ma-card`, `.di-card` | Amber | `#F59E0B` |
| 4 — Writing Planner | `.wp-card` | Green | `#16A34A` |
| 5 — Project Reviewer | `.pr-card` | Violet | `#8B5CF6` |
| 6 — Defense Prep | `.dp-card` | Red | `#DC2626` |

---

## 3. Implementation Tracks

### Track A — index.css (pure CSS, no component risk)

**A1 — Workspace background**
Update the existing dark override block (currently `#060E18`) to `#0B1929`. Same dot-pattern texture (`rgba(0,102,255,0.05)`, 28px grid).

**A2 — Per-step card colors**
For each card class in the existing `.app-content .{prefix}-card` override block:
- `border-left: 4px solid {accent}`
- `box-shadow: 0 8px 40px rgba(0,0,0,0.5), 0 0 36px {accent}18`
- `border: 1px solid {accent}18`

**A3 — Watermarks via CSS `::before`**
Each card class gets a `::before` pseudo-element:
```css
.app-content .ca-card::before {
  content: '2';
  font-family: 'JetBrains Mono', monospace;
  font-size: 140px;
  font-weight: 700;
  color: rgba(6, 182, 212, 0.05);
  position: absolute;
  top: -20px;
  right: -10px;
  line-height: 1;
  pointer-events: none;
  user-select: none;
}
```
Add `position: relative; overflow: hidden` to every card class in the override block unconditionally — do not check, just set it. This is safe to set even if already present.

**A4 — Nav pill per-step colors**
Add CSS custom properties for each nav pill state keyed to `data-step` attribute OR use nth-child selectors if `data-step` is not present. If AppShell.jsx can add `data-step={i}` to each pill (a 1-line JSX change), use:
```css
.nav-pill[data-step="1"].nav-pill--current,
.nav-pill[data-step="1"].nav-pill--completed { background: #0066FF; border-color: #0066FF; }
.nav-pill[data-step="2"].nav-pill--current,
.nav-pill[data-step="2"].nav-pill--completed { background: #06B6D4; border-color: #06B6D4; }
/* ...etc for steps 3–6 */
```

**A5 — Card entrance animation**
Ensure `.tv-card`, `.ca-card`, etc. all include:
```css
animation: card-enter 0.4s ease forwards;
```
The `@keyframes card-enter` is already defined — just verify it's applied to every card class.

---

### Track B — AppShell.jsx (1 file, ~10 line changes)

**B1 — STEP_COLORS constant**
Add at the top of the component:
```javascript
const STEP_COLORS = ['#0066FF', '#06B6D4', '#F59E0B', '#16A34A', '#8B5CF6', '#DC2626']
```

**B2 — Nav pill data-step attribute**
Add `data-step={String(i + 1)}` to each `.nav-pill` div so Track A CSS selectors work.

**B3 — Sidebar step badge colors**
The `.step-list__badge` div currently uses a fixed blue for completed and active states. Pass `color: STEP_COLORS[i]` as an inline style when `isCompleted || isCurrent`.

**B4 — Connector gradient**
The `.nav-connector` between pills should gradient from `STEP_COLORS[i]` to `STEP_COLORS[i+1]` when the left pill is completed. Set as an inline `background` style.

---

### Track C — Step components (~8 files, 3–5 line changes each)

Affected files:
- `src/features/topicValidator/TopicValidator.jsx`
- `src/features/chapterArchitect/ChapterArchitect.jsx`
- `src/features/methodology/MethodologyAdvisor.jsx`
- `src/features/writingPlanner/WritingPlanner.jsx`
- `src/features/defensePrep/DefensePrep.jsx`
- `src/features/projectReviewer/ProjectReviewer.jsx`
- `src/features/supervisorEmail/SupervisorEmail.jsx`
- `src/features/supervisorPrep/SupervisorPrep.jsx`

**C1 — Button color semantics**

Primary CTAs (Continue →, Use This Topic, Confirm, Save, Generate Plan):
```javascript
style={{ background: '#16A34A', /* keep all other properties */ }}
```
On hover: add `boxShadow: '0 0 20px rgba(22,163,74,0.35)'`

Action buttons (Validate Topic, Generate Chapters, Analyse Methodology, Build Instrument):
```javascript
style={{ background: '#0066FF', /* keep all other properties */ }}
```
On hover: add `boxShadow: '0 0 24px rgba(0,102,255,0.4)'`

Destructive (End Session, Delete): red border, transparent fill — unchanged from current.

**C2 — Heading typography**
The main card heading in each step component (h1, h2, or the styled div that serves as the step title) gets:
```javascript
style={{ fontFamily: "'DM Serif Display', serif", fontWeight: 400 }}
```

**C3 — Score/verdict typography**
Specific targets only — do not apply broadly:
- `TopicValidator.jsx`: the verdict chip showing "Researchable" / "Needs Refinement" / "Not Suitable"
- `DefensePrep.jsx`: the final score display (e.g. "7/10")
- `MethodologyAdvisor.jsx`: the methodology badge ("Quantitative" / "Qualitative" / "Mixed Methods")

These elements get:
```javascript
style={{ fontFamily: "'JetBrains Mono', monospace" }}
```

---

## 4. Files Changed

| File | Track | Change type |
|------|-------|-------------|
| `src/index.css` | A | CSS additions to existing override block (~60 lines) |
| `src/features/shell/AppShell.jsx` | B | Add STEP_COLORS, data-step, badge colors, connector gradients |
| `src/features/topicValidator/TopicValidator.jsx` | C | Button colors, heading font, verdict font |
| `src/features/chapterArchitect/ChapterArchitect.jsx` | C | Button colors, heading font |
| `src/features/methodology/MethodologyAdvisor.jsx` | C | Button colors, heading font, badge font |
| `src/features/writingPlanner/WritingPlanner.jsx` | C | Button colors, heading font |
| `src/features/defensePrep/DefensePrep.jsx` | C | Button colors, heading font |
| `src/features/projectReviewer/ProjectReviewer.jsx` | C | Button colors, heading font |
| `src/features/supervisorEmail/SupervisorEmail.jsx` | C | Button colors, heading font |
| `src/features/supervisorPrep/SupervisorPrep.jsx` | C | Button colors, heading font |

---

## 5. What Is Explicitly Out of Scope

- Dark mode / light mode toggle — staying full dark
- Landing page, pricing page, auth pages — workflow only
- Mobile-specific layouts — basic responsiveness only
- New animations beyond card-enter and dot-complete pulse
- Any change to API calls, state management, or routing
- Modifying existing CSS blocks (append only, per MASTER.md rules)

---

## 6. Code Review Plan

After implementation, run two parallel subagents:
- **Agent 1** — reviews `index.css` changes: specificity conflicts, missing `position:relative/overflow:hidden` on card containers, watermark content strings match step numbers, animation keyframe coverage
- **Agent 2** — reviews component changes: button color semantics are correct (CTA vs action), no broken hover states, heading font applied consistently, no unintended style regressions

Both agents report findings before any changes are merged.

---

## 7. Success Criteria

- Workspace background is midnight blue with dot texture (not `#060E18`, not `#F0F4F8`)
- Each step card has a visually distinct left border and glow in its accent color
- Each card shows a faded step number watermark in the top-right corner
- Primary CTA buttons are green with green glow on hover
- Action/generate buttons are blue with blue glow on hover
- Step headings use DM Serif Display
- AI verdicts and scores use JetBrains Mono
- Nav pills and sidebar badges reflect per-step accent colors
- Card entrance animation plays on step mount
- No existing functionality broken
