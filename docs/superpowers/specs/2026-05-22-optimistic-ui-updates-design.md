# Spec: Optimistic UI Updates
**Date:** 2026-05-22
**Scope:** Companion card saves, profile saves

---

## Problem

Two categories of saves in FYPro have latency before the UI reflects the new state:

1. **Companion cards** (Literature Map, Abstract Generator, Instrument Builder, Project Reviewer) — after an AI result arrives, the component's local state is updated immediately (`setData`, `setSection`), but `AppContext` is not updated until Supabase confirms the write and fires the real-time subscription. If the user navigates away before the subscription fires, the companion result is missing from context.

2. **Profile saves** — `set({ university, faculty, department, level })` is called after `await updateUserProfile()` resolves. The user sees a loading spinner with no instant feedback; if the save fails, there is no rollback.

---

## What Is Not Changing

**Step checkmarks are already optimistic.** All five `handleConfirm` functions call `completeStep()` or `set({ stepsCompleted: [...] })` synchronously before `saveStep()`. No changes needed.

---

## Change 1 — Companion Cards: Immediate AppContext Update

### Files
| File | AppContext state key | Added call |
|------|---------------------|------------|
| `src/features/literatureMap/LiteratureMap.jsx` | `literatureMap` | `set({ literatureMap: lmResult })` |
| `src/features/chapterArchitect/ChapterArchitect.jsx` | `abstractData` | `set({ abstractData: agResult })` |
| `src/features/methodology/MethodologyAdvisor.jsx` | `instrumentBuilder` | `set({ instrumentBuilder: data })` |
| `src/features/projectReviewer/ProjectReviewer.jsx` | `uploadedProject` | `set({ uploadedProject: { fileName, reviewData: data } })` |

### Where in each file
Each change goes in the `.then()` callback, after the local state setters and before `saveStep()`:

```javascript
// Before (example — LiteratureMap)
setData(lmResult)
setSection('result')
saveStep('literature_map', lmResult)

// After
setData(lmResult)
setSection('result')
set({ literatureMap: lmResult })   // ← new: immediate AppContext update
saveStep('literature_map', lmResult)
```

### Imports to update
`LiteratureMap.jsx`, `ChapterArchitect.jsx`, and `ProjectReviewer.jsx` do not currently destructure `set` from `useApp()`. Add it.
- `MethodologyAdvisor.jsx` already has `set`.

### ProjectReviewer fileName
In `handleReview()`, `selectedFile` is in scope. Use:
```javascript
set({ uploadedProject: { fileName: selectedFile?.name || 'Uploaded document', reviewData: data } })
```

### Failure behavior
Unchanged. `saveStep()` queues failed writes locally and shows "Saved locally — will sync when reconnected". No rollback of companion data — the AI result is already computed and should stay visible.

---

## Change 2 — Profile Saves: Optimistic with Rollback

### File
`src/pages/Profile.jsx` — `handleSaveChanges()`

### Pattern
```javascript
async function handleSaveChanges() {
  // Capture current AppContext values for rollback
  const previous = {
    university: state.university,
    faculty:    state.faculty,
    department: state.department,
    level:      state.level,
  }

  // Apply immediately — instant UI update
  set({
    university: form.university,
    faculty:    form.faculty,
    department: form.department,
    level:      form.level,
  })

  setSaving(true)
  try {
    const profileUpdates = { faculty: form.faculty, department: form.department, level: form.level }
    if (form.name) {
      profileUpdates.full_name = form.name
      await supabase.auth.updateUser({ data: { full_name: form.name } })
    }
    await updateUserProfile(profileUpdates)
    showToast('Changes saved')
  } catch (err) {
    console.error('[Profile] handleSaveChanges failed:', err.message)
    set(previous)   // rollback AppContext to previous values
    showToast('Failed to save changes. Please try again.')
  } finally {
    setSaving(false)
  }
}
```

### What is not rolled back
`form.name` is not in the rollback because:
- `form.name` is local component state that reflects what the user typed — it should not snap back
- `supabase.auth.updateUser` failing means the session is invalid; the auth listener handles cleanup in that case

### University
`university` is not persisted to the Supabase `users` table (no column exists for it), so it is AppContext-only. Include it in the rollback snapshot for completeness — the rollback will be a no-op for this field if save succeeds.

---

## Summary of Files Changed

| File | Change |
|------|--------|
| `src/features/literatureMap/LiteratureMap.jsx` | Add `set` to `useApp()` destructuring; add `set({ literatureMap: lmResult })` |
| `src/features/chapterArchitect/ChapterArchitect.jsx` | Add `set` to `useApp()` destructuring; add `set({ abstractData: agResult })` |
| `src/features/methodology/MethodologyAdvisor.jsx` | Add `set({ instrumentBuilder: data })` (no import change needed) |
| `src/features/projectReviewer/ProjectReviewer.jsx` | Add `set` to `useApp()` destructuring; add `set({ uploadedProject: { fileName, reviewData: data } })` |
| `src/pages/Profile.jsx` | Move `set(...)` before awaits; add `previous` capture and rollback in `catch` |

**5 files. No new dependencies. No schema changes. No API changes.**
