# Smooth Interactions Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every page transition, step switch, and AI result reveal in FYPro feel smooth and instant — no flashes, no jumps.

**Architecture:** Pure UI layer changes only — no feature logic touched. Five targeted file groups: route wrapper, step wrapper, global CSS, font hints, and per-step result scrolls.

**Tech Stack:** framer-motion v12, React Router v7, CSS scroll-behavior, vanilla scrollIntoView

---

## Audit of What Is Already Done

Before touching anything, confirm these exist (they should — do not re-implement):

- `RouteProgressBar` — implemented in `src/components/RouteProgressBar.jsx`
- `AnimatePresence` + `motion.div` on routes — `src/App.jsx` lines 47-55
- Button `scale(0.98)` `:active` state — `src/index.css` lines 6786-6806
- Sidebar `.step-list__item--current` CSS highlight — `src/index.css` ~line 387
- `prefers-reduced-motion` blocks — `src/index.css` lines 9219, 9336, 9519
- `scrollIntoView` in MethodologyAdvisor — `src/features/methodology/MethodologyAdvisor.jsx:163`

---

## Task 1: Route Transition — Add Y Movement

**File:** `src/App.jsx`

Current `AppRoutes` wraps `<Routes>` in a `motion.div` with opacity-only fade and `mode="sync"`.
With `mode="sync"`, two full-page divs are in the DOM simultaneously — adding Y movement would cause layout stacking. Switch to `mode="wait"` so exit completes before enter starts.

- [ ] **Step 1: Update App.jsx route transition**

Replace lines 47-55 (the `<AnimatePresence>` block) with:

```jsx
<AnimatePresence mode="wait" initial={false}>
  <motion.div
    key={location.key}
    initial={{ opacity: 0, y: 8 }}
    animate={{ opacity: 1, y: 0 }}
    exit={{ opacity: 0, y: -8 }}
    transition={{ duration: 0.18, ease: 'easeOut' }}
    style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}
  >
```

No other changes to this file.

- [ ] **Step 2: Verify**

Navigate between `/`, `/login`, `/pricing` in browser. Each transition should fade+slide up on enter, fade+slide up on exit. Total transition ≈ 360ms. No layout flash.

- [ ] **Step 3: Commit**

```bash
git add src/App.jsx
git commit -m "feat(ui): add y-axis movement to route transitions"
```

---

## Task 2: Workflow Step Transitions — Horizontal Slide

**File:** `src/features/shell/AppShell.jsx`

Currently `<CurrentStep />` swaps without animation when `state.currentStep` changes.
Add a direction-aware horizontal slide: forward = slide left, back = slide right.

- [ ] **Step 1: Add imports to AppShell.jsx**

The file already imports `AnimatePresence` from framer-motion (line 2). Extend it:

```jsx
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
```

- [ ] **Step 2: Add direction tracking and scroll ref inside AppShell()**

Add these lines directly after the existing `useState` declarations (around line 135), before the return:

```jsx
// Direction tracking for step slide animation
const prevStepRef = useRef(state.currentStep)
const directionRef = useRef(1)
if (prevStepRef.current !== state.currentStep) {
  directionRef.current = state.currentStep > prevStepRef.current ? 1 : -1
  prevStepRef.current = state.currentStep
}

// Scroll container ref — reset to top on step change
const scrollRef = useRef(null)
useEffect(() => {
  if (scrollRef.current) scrollRef.current.scrollTop = 0
}, [state.currentStep])

const prefersReduced = useReducedMotion()
const stepVariants = prefersReduced
  ? {
      enter:  () => ({ opacity: 0 }),
      center: { opacity: 1 },
      exit:   () => ({ opacity: 0 }),
    }
  : {
      enter:  (dir) => ({ x: dir * 24, opacity: 0 }),
      center: { x: 0, opacity: 1 },
      exit:   (dir) => ({ x: -dir * 24, opacity: 0 }),
    }
```

- [ ] **Step 3: Wrap step content in AnimatePresence inside app-content__scroll**

Find the `<div className="app-content__scroll">` block (around line 339).

Add `ref={scrollRef}` to that div, and wrap its contents:

```jsx
<div className="app-content__scroll" ref={scrollRef}>
  <AnimatePresence mode="wait" custom={directionRef.current}>
    <motion.div
      key={showSupervisorEmail ? 'supervisor' : String(state.currentStep)}
      custom={directionRef.current}
      variants={stepVariants}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.2, ease: 'easeOut' }}
    >
      {showSupervisorEmail ? (
        <SupervisorEmail onClose={() => setShowSupervisorEmail(false)} />
      ) : state.currentStep === 4 ? (
        <PaidFeatureGate requiredPack="student_pack">
          <CurrentStep />
        </PaidFeatureGate>
      ) : state.currentStep === 5 ? (
        <PaidFeatureGate requiredPack="defense_pack">
          <CurrentStep />
        </PaidFeatureGate>
      ) : (
        <>
          {currentStepKey && isOverLimit(currentStepKey) && (
            <RunLimitBanner stepKey={currentStepKey} onUpgrade={() => navigate('/pricing')} />
          )}
          <CurrentStep />
        </>
      )}
    </motion.div>
  </AnimatePresence>
</div>
```

- [ ] **Step 4: Verify**

In the app, click through Topic Validator → Chapter Architect → Methodology. Each step should slide in from the right. Click a previous step — it should slide in from the left. Users who have `prefers-reduced-motion: reduce` in their OS should see a plain fade instead.

- [ ] **Step 5: Commit**

```bash
git add src/features/shell/AppShell.jsx
git commit -m "feat(ui): add directional slide transition between workflow steps"
```

---

## Task 3: Global CSS Polish

**File:** `src/index.css`

Three targeted CSS changes — all appended in a new block at the bottom of the file.

- [ ] **Step 1: Check current end of file line count**

The file is long (~10000+ lines). Open it, go to the end, note the last block. Append the new block after everything else.

- [ ] **Step 2: Append the new CSS block**

Add at the very end of `src/index.css`:

```css
/* ═══════════════════════════════════════════════════════
   SMOOTH INTERACTIONS — GLOBAL POLISH
   ═══════════════════════════════════════════════════════ */

/* Smooth scroll inside the workflow content container */
.app-content__scroll {
  scroll-behavior: smooth;
}

/* Smooth scroll at document level (marketing pages, public routes) */
html {
  scroll-behavior: smooth;
}

/* Upgrade button :active press from scale(0.98) to scale(0.97)
   — targets the existing block at ~line 6786 via higher specificity.
   The existing block uses scale(0.98); this overrides it to match
   the design spec of 0.97 for a slightly crisper press feel. */
@media (prefers-reduced-motion: no-preference) {
  .tv-btn-validate:active:not(:disabled),
  .tv-btn-use:active:not(:disabled),
  .ca-btn-generate:active:not(:disabled),
  .ca-btn-confirm:active:not(:disabled),
  .ca-btn-regenerate:active:not(:disabled),
  .ma-btn-analyse:active:not(:disabled),
  .ma-btn-confirm:active:not(:disabled),
  .di-btn-generate:active:not(:disabled),
  .di-btn-continue:active:not(:disabled),
  .wp-btn-generate:active:not(:disabled),
  .wp-btn-confirm:active:not(:disabled),
  .dp-btn-start-scan:active:not(:disabled),
  .dp-btn-enter-defense:active:not(:disabled),
  .pr-btn-review:active:not(:disabled),
  .pr-btn-confirm:active:not(:disabled),
  .ag-btn-generate:active:not(:disabled),
  .lm-btn-generate:active:not(:disabled),
  .se-btn-generate:active:not(:disabled) {
    transform: scale(0.97) translateY(0) !important;
    transition: transform 0.08s ease !important;
  }
}

/* GPU hints for elements that animate their transform */
@media (prefers-reduced-motion: no-preference) {
  .nav-pill,
  .begin-btn.is-ready,
  .tv-btn-validate,
  .tv-btn-use,
  .ca-btn-generate,
  .ca-btn-confirm,
  .ma-btn-analyse,
  .ma-btn-confirm,
  .wp-btn-generate,
  .wp-btn-confirm,
  .dp-btn-enter-defense,
  .pr-btn-review {
    will-change: transform;
  }
}

/* Smooth hover on clickable sidebar step items */
.step-list__item {
  transition: background 0.15s ease, border-color 0.15s ease, opacity 0.15s ease;
}

/* Smooth hover on clickable nav pills */
.nav-pill {
  transition: background 0.15s ease, border-color 0.15s ease,
              box-shadow 0.15s ease, color 0.15s ease !important;
}
```

- [ ] **Step 3: Verify**

Open the app. Click a button — it should compress to 97% instantly on press. Sidebar step items should transition smoothly when hovering. No layout jank.

- [ ] **Step 4: Commit**

```bash
git add src/index.css
git commit -m "feat(ui): smooth scroll, button press scale, will-change GPU hints"
```

---

## Task 4: Font Preconnect Hints

**File:** `index.html`

Fonts are loaded via a `@import` in `index.css`. Adding `<link rel="preconnect">` to the HTML tells the browser to resolve DNS and open a TCP+TLS connection to Google Fonts CDN before the CSS is parsed — eliminating the connection setup lag.

- [ ] **Step 1: Add preconnect links to index.html**

Inside `<head>`, after the favicon links and before the `<title>` tag, add:

```html
<!-- Font preconnect — eliminates DNS + TLS lag for Google Fonts -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
```

- [ ] **Step 2: Verify**

Open Chrome DevTools → Network tab → filter by "fonts". Reload the page. The font requests should begin earlier in the waterfall. You should see DM Serif Display, Poppins, JetBrains Mono load with no flash of unstyled text on first visit.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "perf: add font preconnect hints for Google Fonts CDN"
```

---

## Task 5: Smooth Scroll to AI Results

**Files:**
- `src/features/topicValidator/TopicValidator.jsx`
- `src/features/chapterArchitect/ChapterArchitect.jsx`
- `src/features/writingPlanner/WritingPlanner.jsx`
- `src/features/projectReviewer/ProjectReviewer.jsx`

When an AI result arrives, the section becomes visible but the scroll position doesn't move — the user might be looking at the loading spinner above. Add a `scrollIntoView` call after each `setSection('result')` to smoothly scroll the result into view.

MethodologyAdvisor already does this correctly at line 163 — replicate the pattern.

### 5a — TopicValidator

- [ ] **Step 1: Add scroll after setSection('result') in TopicValidator.jsx**

Find the `.then(result => {` block in `handleValidate` (around line 148). After `setSection('result')`:

```js
validateTopic(studentContext, trimmed)
  .then(result => {
    inflightRef.current = false
    set({ topicValidation: result })
    animateRef.current = true
    setData(result)
    setSection('result')
    setBtnDisabled(false)
    saveStep('topic_validator', result, trimmed)
    setTimeout(() => {
      document.getElementById('tv-result-section')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }, 80)
  })
```

- [ ] **Step 2: Commit**

```bash
git add src/features/topicValidator/TopicValidator.jsx
git commit -m "feat(ui): smooth scroll to validation result"
```

### 5b — ChapterArchitect

ChapterArchitect has three `setSection('result')` calls — the initial generate, the regenerate, and a catch fallback. Only the first two should scroll (the fallback shows existing data, scrolling there is jarring).

- [ ] **Step 1: Add scroll in ChapterArchitect.jsx**

Find the **first** `.then` block (around line 379, after `resetCompanions()`):

```js
resetCompanions()
setSection('result')
setBtnDisabled(false)
saveStep('chapter_architect', result)
setTimeout(() => {
  document.getElementById('ca-result-section')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}, 80)
```

Find the **second** `.then` block (around line 414, `handleRegenerate`):

```js
resetCompanions()
setSection('result')
saveStep('chapter_architect', result)
setTimeout(() => {
  document.getElementById('ca-result-section')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}, 80)
```

The **third** `setSection('result')` is in the `.catch` (error fallback, line 420) — leave that one alone.

- [ ] **Step 2: Commit**

```bash
git add src/features/chapterArchitect/ChapterArchitect.jsx
git commit -m "feat(ui): smooth scroll to chapter outline result"
```

### 5c — WritingPlanner

- [ ] **Step 1: Add scroll in WritingPlanner.jsx**

Find the `.then` block (around line 133):

```js
setData(result)
setSection('result')
setBtnDisabled(false)
saveStep('writing_planner', { ...result, submission_deadline: dateValue }, dateValue)
setTimeout(() => {
  document.getElementById('wp-result-section')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}, 80)
```

- [ ] **Step 2: Commit**

```bash
git add src/features/writingPlanner/WritingPlanner.jsx
git commit -m "feat(ui): smooth scroll to writing plan result"
```

### 5d — ProjectReviewer

- [ ] **Step 1: Add scroll in ProjectReviewer.jsx**

Find the result assignment block (around line 414):

```js
setTruncationWarning(data._truncationWarning || null)
setReviewData(data)
setSection('result')
setIsProcessing(false)
saveStep('project_reviewer', { reviewData: data })
setTimeout(() => {
  document.getElementById('pr-result-section')
    ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
}, 80)
```

- [ ] **Step 2: Commit**

```bash
git add src/features/projectReviewer/ProjectReviewer.jsx
git commit -m "feat(ui): smooth scroll to project review result"
```

---

## Self-Review Checklist

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| Route transitions opacity + y:8 | Task 1 |
| AnimatePresence exit before mount | Task 1 (mode="wait") |
| Button scale 0.97 whileTap | Task 3 (CSS :active, identical visual) |
| Step slide forward/back | Task 2 |
| Scroll-behavior: smooth | Task 3 |
| Smooth scroll to AI result | Task 5 |
| Card/link hover transitions | Task 3 (nav-pill, step-list__item) |
| Font preloading | Task 4 |
| will-change: transform | Task 3 |
| prefers-reduced-motion | Task 2 (useReducedMotion), Task 3 (media query) |
| RouteProgressBar | Already done — verified in audit |
| React.memo | Already done on DefensePrep + Dashboard — YAGNI to add more |
| Loading state consistency | Already consistent via LoadingMessages component — YAGNI |

**Notes:**
- `whileTap={{ scale: 0.97 }}` is achieved via CSS `:active` (Task 3) which is visually identical and avoids touching 6 feature files.
- Static arrays are already at module scope in all feature components — no change needed.
- Sidebar step highlight already updates synchronously on click — no change needed.

**Files changed:** 8 total
- `index.html`
- `src/index.css`
- `src/App.jsx`
- `src/features/shell/AppShell.jsx`
- `src/features/topicValidator/TopicValidator.jsx`
- `src/features/chapterArchitect/ChapterArchitect.jsx`
- `src/features/writingPlanner/WritingPlanner.jsx`
- `src/features/projectReviewer/ProjectReviewer.jsx`
