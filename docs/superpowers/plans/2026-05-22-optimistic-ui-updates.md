# Optimistic UI Updates — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make companion card saves and profile saves respond instantly in the UI without waiting for Supabase confirmation, with rollback on failure for profile saves.

**Architecture:** Each companion card's `.then()` callback gains a synchronous `set({stateKey: result})` call immediately before the existing `saveStep()` call, pushing data into AppContext the instant the AI returns rather than waiting for the real-time subscription. Profile's `handleSaveChanges` applies the same AppContext update before the async Supabase calls, captures a rollback snapshot, and reverts on error.

**Tech Stack:** React 19, Vite, Supabase JS v2, `useApp()` context (`set` / `state`), existing `saveStep` from `useProjectState`.

---

## File Map

| File | Change |
|------|--------|
| `src/features/literatureMap/LiteratureMap.jsx` | Add `set` to `useApp()` destructure; add `set({ literatureMap })` before `saveStep` |
| `src/features/chapterArchitect/ChapterArchitect.jsx` | Add `set` to `useApp()` destructure; add `set({ abstractData })` before `saveStep` for abstract |
| `src/features/methodology/MethodologyAdvisor.jsx` | Add `set({ instrumentBuilder })` before `saveStep` (no import change needed) |
| `src/features/projectReviewer/ProjectReviewer.jsx` | Add `set` to `useApp()` destructure; add `set({ uploadedProject })` before `saveStep` |
| `src/pages/Profile.jsx` | Move `set({…})` before awaits; capture rollback snapshot; revert in `catch` |

---

## Task 1 — LiteratureMap: immediate AppContext update

**Files:**
- Modify: `src/features/literatureMap/LiteratureMap.jsx:18` (destructure)
- Modify: `src/features/literatureMap/LiteratureMap.jsx:88-90` (`.then()` callback)

- [ ] **Step 1: Add `set` to `useApp()` destructuring**

Open `src/features/literatureMap/LiteratureMap.jsx`. Line 18 currently reads:

```javascript
const { state, studentContext } = useApp()
```

Change to:

```javascript
const { state, set, studentContext } = useApp()
```

- [ ] **Step 2: Add immediate AppContext update in `.then()` callback**

Lines 88–90 currently read:

```javascript
        setData(lmResult)
        setSection('result')
        saveStep('literature_map', lmResult)
```

Change to:

```javascript
        setData(lmResult)
        setSection('result')
        set({ literatureMap: lmResult })
        saveStep('literature_map', lmResult)
```

- [ ] **Step 3: Verify with dev server**

Run `npm run dev`. Navigate to `/app`, complete Step 1 (Topic Validator), go to Step 2 (Chapter Architect), confirm the structure, then click "Generate Literature Map". After the map appears:

1. Open React DevTools → find `AppContext` → confirm `literatureMap` is populated **immediately** (not after a delay).
2. Navigate to a different step and back — confirm literature map is still shown.

- [ ] **Step 4: Commit**

```bash
git add src/features/literatureMap/LiteratureMap.jsx
git commit -m "feat(ui): optimistic AppContext update for literature map"
```

---

## Task 2 — ChapterArchitect: immediate AppContext update for Abstract Generator

**Files:**
- Modify: `src/features/chapterArchitect/ChapterArchitect.jsx:156` (destructure)
- Modify: `src/features/chapterArchitect/ChapterArchitect.jsx:~470-478` (abstract `.then()` callback)

- [ ] **Step 1: Add `set` to `useApp()` destructuring**

Line 156 currently reads:

```javascript
  const { state, studentContext, completeStep, navigateStep } = useApp()
```

Change to:

```javascript
  const { state, set, studentContext, completeStep, navigateStep } = useApp()
```

- [ ] **Step 2: Add immediate AppContext update in abstract generator `.then()` callback**

Locate the block inside `handleGenerateAbstract` that ends with `saveStep('abstract_generator', agResult)`. It currently reads (approximately lines 462–478):

```javascript
        setAgData(agResult)
        setAgSection('result')
        agTimers.current.forEach(clearTimeout)
        setAgVisible([])
        const timers = AG_COMPONENTS.map((_, i) =>
          setTimeout(() => setAgVisible(prev => [...prev, i]), i * 350)
        )
        agTimers.current = timers
        saveStep('abstract_generator', agResult)
```

Change to:

```javascript
        setAgData(agResult)
        setAgSection('result')
        agTimers.current.forEach(clearTimeout)
        setAgVisible([])
        const timers = AG_COMPONENTS.map((_, i) =>
          setTimeout(() => setAgVisible(prev => [...prev, i]), i * 350)
        )
        agTimers.current = timers
        set({ abstractData: agResult })
        saveStep('abstract_generator', agResult)
```

- [ ] **Step 3: Verify with dev server**

Navigate to Step 2 (Chapter Architect), generate chapters, then click "Generate Abstract Scaffold". After the abstract appears:

1. React DevTools → `AppContext` → confirm `abstractData` is populated immediately.
2. Navigate away and back — confirm abstract is still shown.

- [ ] **Step 4: Commit**

```bash
git add src/features/chapterArchitect/ChapterArchitect.jsx
git commit -m "feat(ui): optimistic AppContext update for abstract generator"
```

---

## Task 3 — MethodologyAdvisor: immediate AppContext update for Instrument Builder

**Files:**
- Modify: `src/features/methodology/MethodologyAdvisor.jsx:~185-191` (instrument `.then()` callback)

No import change needed — `set` is already destructured on line 27:
```javascript
const { state, studentContext, navigateStep, set } = useApp()
```

- [ ] **Step 1: Add immediate AppContext update in instrument builder `.then()` callback**

Locate the block inside `handleGenerateInstrument` that ends with `saveStep('instrument_builder', data)`. It currently reads (approximately lines 185–191):

```javascript
        diInflightRef.current = false
        buildPlainText(data)
        setDiData(data)
        setDiSection('result')
        saveStep('instrument_builder', data)
```

Change to:

```javascript
        diInflightRef.current = false
        buildPlainText(data)
        setDiData(data)
        setDiSection('result')
        set({ instrumentBuilder: data })
        saveStep('instrument_builder', data)
```

- [ ] **Step 2: Verify with dev server**

Navigate to Step 3 (Methodology Advisor), generate and confirm a methodology, then click "Generate Instrument". After the instrument appears:

1. React DevTools → `AppContext` → confirm `instrumentBuilder` is populated immediately.
2. Navigate away and back — confirm instrument is still shown.

- [ ] **Step 3: Commit**

```bash
git add src/features/methodology/MethodologyAdvisor.jsx
git commit -m "feat(ui): optimistic AppContext update for instrument builder"
```

---

## Task 4 — ProjectReviewer: immediate AppContext update

**Files:**
- Modify: `src/features/projectReviewer/ProjectReviewer.jsx:223` (destructure)
- Modify: `src/features/projectReviewer/ProjectReviewer.jsx:~411-417` (`handleReview` success block)

- [ ] **Step 1: Add `set` to `useApp()` destructuring**

Line 223 currently reads:

```javascript
  const { state, studentContext, navigateStep, completeStep } = useApp()
```

Change to:

```javascript
  const { state, set, studentContext, navigateStep, completeStep } = useApp()
```

- [ ] **Step 2: Add immediate AppContext update in `handleReview` success block**

Locate the success block inside `handleReview` that ends with `saveStep('project_reviewer', { reviewData: data })`. It currently reads (approximately lines 412–417):

```javascript
      inflightRef.current = false
      setTruncationWarning(data._truncationWarning || null)
      setReviewData(data)
      setSection('result')
      setIsProcessing(false)
      saveStep('project_reviewer', { reviewData: data })
```

Change to:

```javascript
      inflightRef.current = false
      setTruncationWarning(data._truncationWarning || null)
      setReviewData(data)
      setSection('result')
      setIsProcessing(false)
      set({ uploadedProject: {
        fileName: selectedFile?.name || 'Uploaded document',
        fileType: (selectedFile?.name || '').split('.').pop().toLowerCase() || 'unknown',
        reviewData: data,
      } })
      saveStep('project_reviewer', { reviewData: data })
```

- [ ] **Step 3: Verify with dev server**

Navigate to Step 5 (Project Reviewer), upload a PDF/DOCX/TXT. After the review appears:

1. React DevTools → `AppContext` → confirm `uploadedProject` has `{ fileName, reviewData }` populated immediately.
2. Navigate away and back — confirm review is still shown.

- [ ] **Step 4: Commit**

```bash
git add src/features/projectReviewer/ProjectReviewer.jsx
git commit -m "feat(ui): optimistic AppContext update for project reviewer"
```

---

## Task 5 — Profile: optimistic save with rollback

**Files:**
- Modify: `src/pages/Profile.jsx:419-440` (`handleSaveChanges`)

- [ ] **Step 1: Rewrite `handleSaveChanges` with optimistic update and rollback**

The current function (lines 419–440) reads:

```javascript
  async function handleSaveChanges() {
    setSaving(true)
    try {
      const profileUpdates = {
        faculty:    form.faculty,
        department: form.department,
        level:      form.level,
      }
      if (form.name) {
        profileUpdates.full_name = form.name
        await supabase.auth.updateUser({ data: { full_name: form.name } })
      }
      await updateUserProfile(profileUpdates)
      set({ university: form.university, faculty: form.faculty, department: form.department, level: form.level })
      showToast('Changes saved')
    } catch (err) {
      console.error('[Profile] handleSaveChanges failed:', err.message)
      showToast('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }
```

Replace with:

```javascript
  async function handleSaveChanges() {
    const previous = {
      university: state.university,
      faculty:    state.faculty,
      department: state.department,
      level:      state.level,
    }
    set({ university: form.university, faculty: form.faculty, department: form.department, level: form.level })
    setSaving(true)
    try {
      const profileUpdates = {
        faculty:    form.faculty,
        department: form.department,
        level:      form.level,
      }
      if (form.name) {
        profileUpdates.full_name = form.name
        await supabase.auth.updateUser({ data: { full_name: form.name } })
      }
      await updateUserProfile(profileUpdates)
      showToast('Changes saved')
    } catch (err) {
      console.error('[Profile] handleSaveChanges failed:', err.message)
      set(previous)
      showToast('Failed to save changes. Please try again.')
    } finally {
      setSaving(false)
    }
  }
```

- [ ] **Step 2: Verify optimistic update with dev server**

Navigate to `/profile`. Change your Faculty field to something new. Click "Save Changes":

1. The sidebar's context card (which reads from AppContext) should update **immediately** — before the button stops spinning.
2. Let the save complete normally. Toast "Changes saved" should appear.

- [ ] **Step 3: Verify rollback**

To test rollback without breaking real data: temporarily add `throw new Error('test')` as the first line of the `try` block (after `setSaving(true)`), reload, change a field, click Save:

1. Fields should show the new value briefly.
2. After the error, AppContext should revert — sidebar context card shows original value.
3. Toast "Failed to save changes" appears.

Remove the `throw` line after confirming rollback works.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Profile.jsx
git commit -m "feat(ui): optimistic profile save with rollback on error"
```

---

## Task 6 — Final smoke test

- [ ] **Step 1: Run through the full workflow once**

With `npm run dev`:

1. Complete Topic Validator → confirm step checkmark appears instantly.
2. Generate + confirm Chapter Architect → confirm Literature Map generates and AppContext `literatureMap` is populated before navigating away.
3. Generate Abstract Scaffold → AppContext `abstractData` populated immediately.
4. Complete Methodology → generate Instrument Builder → AppContext `instrumentBuilder` populated immediately.
5. Navigate to `/profile` → change fields → confirm sidebar updates without waiting for spinner to stop.

- [ ] **Step 2: Commit final if any cleanup needed**

```bash
git add -p
git commit -m "chore: post-integration cleanup"
```
