# Offline Content Caching — Design Spec
**Date:** 2026-06-03
**Status:** Approved

---

## Problem

Students open FYPro at 2AM with no WiFi to re-read their chapter plan or methodology before a supervisor meeting. `loadUserState()` calls Supabase, times out, and AppContext stays empty — every step card shows a blank loading state. The app is useless exactly when it is needed most.

The app shell (HTML, JS, CSS, fonts) is already offline-capable via Workbox precache. The gap is user step data.

---

## Goal

Full app-shell offline mode: once a student has completed steps online, they can open FYPro on Airplane Mode and read all their saved step outputs (validated topic, chapter plan, methodology, writing plan, etc.). Connectivity is only required for generating new content.

---

## Non-Goals

- Caching generation responses at the Service Worker level (POST requests not supported by Cache API without custom code — unnecessary complexity)
- Caching Supabase REST responses in the SW (JWT token rotation causes cache misses; app-layer snapshot is simpler and sufficient)
- Offline generation of new content (requires Claude API — not feasible)
- IndexedDB (localStorage is sufficient; step data is ~100KB max)

---

## Architecture

Two existing layers stay unchanged:

| Layer | Owns | Status |
|---|---|---|
| Service Worker (`sw.js`) | App shell, fonts, static assets | Already done |
| `sync-queue.ts` (localStorage) | Offline write queue for step saves | Already done |

One new layer:

| Layer | Owns | Status |
|---|---|---|
| `offline-snapshot.ts` (localStorage) | Offline read cache for step results | To build |

---

## Touch Points

Five files changed, one new file:

| File | Change |
|---|---|
| `src/lib/offline-snapshot.ts` | **New** — read/write/patch/clear snapshot |
| `src/lib/storage.ts` | Add `fypro_offline_snapshot` to `USER_STORAGE_KEYS` |
| `src/hooks/useProjectState.ts` | Timeout wrapper, persist on success, read on failure, expose `isOfflineMode` |
| `src/components/OfflineBanner.tsx` | Add `isOfflineMode` prop + two message variants |
| `src/features/shell/AppShell.jsx` | Pass `isOfflineMode` to `OfflineBanner` |
| `src/services/api.js` | Early-exit `OFFLINE` error code in all five fetch helpers |

---

## New Module: `src/lib/offline-snapshot.ts`

### Storage key
`fypro_offline_snapshot` — static key, fits into `USER_STORAGE_KEYS` for automatic cleanup on logout.

### Snapshot shape
```ts
interface OfflineSnapshot {
  userId: string
  savedAt: string   // ISO timestamp
  profile: {
    full_name: string | null
    faculty: string | null
    department: string | null
    level: string | null
  } | null
  project: {
    id: string
    title: string | null
    current_step: string
  } | null
  steps: Array<{
    step_type: string
    result_json: Record<string, unknown>
  }>
}
```

This mirrors the output of `loadUserState()` so the fallback hydration path in `useProjectState.ts` requires zero extra transformation.

### API
```ts
persistSnapshot(userId: string, userState: UserState): void
// Full overwrite. Called after loadUserState() succeeds.

patchSnapshotStep(stepType: string, resultJson: Record<string, unknown>): void
// Update a single step entry. Called after supabaseSaveStep() succeeds.
// Reads current snapshot, replaces the matching step_type entry (or appends), writes back.

readSnapshot(userId: string): OfflineSnapshot | null
// Returns snapshot if userId matches. Returns null and clears storage if userId mismatches
// (different user logged in on same device). Returns null if storage is empty or malformed.

clearSnapshot(): void
// Removes fypro_offline_snapshot from localStorage.
```

All functions are wrapped in try/catch — storage errors never affect UX.

### Size estimate
10 step results × ~10KB each = ~100KB. Well within the 5MB localStorage limit.

---

## Changes to `src/lib/storage.ts`

Add one entry to `USER_STORAGE_KEYS`:
```ts
'fypro_offline_snapshot',
```

This ensures both logout paths (`forceSignOut` in `AuthContext.tsx` and `handleLogout` in `DashTopBar.jsx`) clear the snapshot automatically via `clearUserLocalStorage()` — no changes required to either logout file.

---

## Changes to `src/hooks/useProjectState.ts`

### 1. 5-second timeout wrapper
```ts
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('load_timeout')), ms)
    )
  ])
}
```

Handles the "online but barely" case common on Nigerian campuses. Without it, students on weak 4G wait 30+ seconds before the fallback kicks in.

### 2. Success path — persist snapshot
After `loadUserState()` resolves:
```ts
const userState = await withTimeout(loadUserState(userId), 5000)
persistSnapshot(userId, userState)   // ← new, before existing hydration logic
// ... existing hydration logic unchanged
```

### 3. Failure path — read snapshot
In the existing `catch` block:
```ts
} catch (err) {
  const snapshot = readSnapshot(userId)
  if (snapshot) {
    // Hydrate AppContext from snapshot using identical logic to the success path
    hydrateFromSnapshot(snapshot)
    setIsOfflineMode(true)
  }
  markOnboardingResolved({})   // existing line — keep, fail open
}
```

The hydration logic is the same as the success path (same `STEP_TO_STATE` map, same `resolveStepResult` function). The snapshot shape mirrors `loadUserState()` output exactly, so no new transformation code is needed.

### 4. Patch snapshot after step save
In the `saveStep` callback, after `supabaseSaveStep` succeeds:
```ts
await withRetry(() => supabaseSaveStep(pid, stepType, resultJson, inputSummary))
patchSnapshotStep(stepType, resultJson)   // ← new
```

Ensures a step completed on campus WiFi is in the offline cache before the student closes the app — no extra reload required.

### 5. New context value field
```ts
interface ProjectStateValue {
  // ... existing fields unchanged
  isOfflineMode: boolean   // true when snapshot fallback was used for initial data load
}
```

`isOfflineMode` starts as `false`. Flips to `true` only when the snapshot fallback is used. Does not reset during the same session (a page reload online will re-run `loadUserState()` successfully and the flag stays `false`).

### 6. Clear on project reset
In `resetProject()`, after the existing `deleteAllUserData` call:
```ts
localStorage.removeItem('fypro_offline_snapshot')
```

---

## Changes to `src/components/OfflineBanner.tsx`

Add one optional prop: `isOfflineMode?: boolean`.

Three display states:

| Condition | Colour | Message |
|---|---|---|
| `isOfflineMode === true` | Amber | "Viewing your last saved project — connect to generate new content." |
| `status === 'reconnecting'` | Amber | "Syncing saved changes…" (unchanged) |
| `status === 'offline'` | Red | "You're offline. Changes will sync when you reconnect." (unchanged) |

`isOfflineMode` uses amber (not red) because the student has their data and the app is functional — red is reserved for write-side queue failures.

The banner renders when `isOfflineMode || status !== 'online'`.

---

## Changes to `src/features/shell/AppShell.jsx`

Line 117 — extend `useProjectState` destructure:
```js
const {
  isLoading,
  showMigrationModal,
  dismissMigrationModal,
  confirmMigration,
  isOfflineMode,           // ← new
} = useProjectState()
```

Line 199 — pass prop:
```jsx
<OfflineBanner isOfflineMode={isOfflineMode} />
```

No other changes to AppShell.

---

## Changes to `src/services/api.js`

Add an early exit at the top of each of the five internal fetch helpers:
`callClaude`, `callTopicValidator`, `callLiteratureMap`, `callClaudeAuth`, `callClaudeAuthRaw`.

```js
if (!navigator.onLine) {
  const err = new Error('offline')
  err.code = 'OFFLINE'
  throw err
}
```

Add one new entry to `handleApiError` — as the first check, before the existing network error check at the bottom:
```js
if (err.code === 'OFFLINE') {
  showError("You're offline. Connect to generate new content.")
  return true
}
```

No changes to step components. The existing error UI handles display — it already exists, is styled, and clears as soon as the next successful call goes through.

---

## Snapshot Lifecycle Summary

| Event | Action |
|---|---|
| App loads, Supabase responds within 5s | `persistSnapshot(userId, userState)` — full overwrite |
| Step completed and saved to Supabase | `patchSnapshotStep(stepType, resultJson)` — single step update |
| App loads, Supabase fails or times out | `readSnapshot(userId)` — hydrate AppContext, set `isOfflineMode = true` |
| Logout (any path) | `clearUserLocalStorage()` wipes `fypro_offline_snapshot` automatically |
| Project reset | `localStorage.removeItem('fypro_offline_snapshot')` |
| Different user logs in on same device | `readSnapshot(newUserId)` returns null (userId mismatch), stale entry cleared |

---

## Error Handling

- All `offline-snapshot.ts` functions are wrapped in try/catch — localStorage quota errors or malformed JSON never throw to the caller
- `withTimeout` rejection is caught by the existing `catch` block in `load()` — no new error boundary needed
- `readSnapshot` returning null when offline and no snapshot exists: the existing fallback (`markOnboardingResolved({})`) already handles this — the app fails open with an empty state, same as today

---

## What Is Not Changed

- `sw.js` — no changes
- `sync-queue.ts` — no changes
- All step components — no changes
- All auth files (`AuthContext.tsx`, `DashTopBar.jsx`) — no changes
- `vercel.json` — no changes
