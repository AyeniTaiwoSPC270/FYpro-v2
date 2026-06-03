# Offline Content Caching Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make all saved step results (validated topic, chapter plan, methodology, etc.) readable when the student opens FYPro with no WiFi, by persisting a localStorage snapshot after every successful Supabase load.

**Architecture:** A new `offline-snapshot.ts` module owns read/write/patch/clear of a single `fypro_offline_snapshot` localStorage key. `useProjectState.ts` wraps `loadUserState()` in a 5-second timeout and falls back to the snapshot on failure, exposing `isOfflineMode: boolean` through context. `OfflineBanner` shows an amber message when the snapshot is being served. Generation attempts short-circuit with an `OFFLINE` error code in `api.js` before any network call.

**Tech Stack:** TypeScript, React, Workbox (SW unchanged), localStorage, Supabase (existing client unchanged)

---

## File Map

| File | Action |
|---|---|
| `src/lib/offline-snapshot.ts` | Create — snapshot module |
| `src/lib/storage.ts` | Modify — add snapshot key to `USER_STORAGE_KEYS` |
| `src/hooks/useProjectState.ts` | Modify — timeout, persist, fallback, patch, reset, `isOfflineMode` |
| `src/components/OfflineBanner.tsx` | Modify — `isOfflineMode` prop + amber variant |
| `src/features/shell/AppShell.jsx` | Modify — wire `isOfflineMode` to banner |
| `src/services/api.js` | Modify — `OFFLINE` early exit in 5 fetch helpers + `handleApiError` |

---

## Task 1: Create `src/lib/offline-snapshot.ts`

**Files:**
- Create: `src/lib/offline-snapshot.ts`

- [ ] **Step 1: Create the file with all four exports**

```ts
// Offline read cache — persists step results to localStorage after every
// successful Supabase load so students can re-read their work without WiFi.

import type { UserState } from './db'

const SNAPSHOT_KEY = 'fypro_offline_snapshot'

export interface OfflineSnapshot {
  userId: string
  savedAt: string
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

export function persistSnapshot(userId: string, userState: UserState): void {
  try {
    const snapshot: OfflineSnapshot = {
      userId,
      savedAt: new Date().toISOString(),
      profile: userState.profile
        ? {
            full_name:  userState.profile.full_name  ?? null,
            faculty:    userState.profile.faculty    ?? null,
            department: userState.profile.department ?? null,
            level:      userState.profile.level      ?? null,
          }
        : null,
      project: userState.project
        ? {
            id:           userState.project.id,
            title:        userState.project.title        ?? null,
            current_step: userState.project.current_step,
          }
        : null,
      steps: (userState.steps ?? []).map(s => ({
        step_type:   s.step_type,
        result_json: s.result_json,
      })),
    }
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // localStorage quota or serialisation error — never affect UX
  }
}

export function patchSnapshotStep(
  stepType: string,
  resultJson: Record<string, unknown>
): void {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return
    const snapshot: OfflineSnapshot = JSON.parse(raw)
    const idx = snapshot.steps.findIndex(s => s.step_type === stepType)
    if (idx !== -1) {
      snapshot.steps[idx] = { step_type: stepType, result_json: resultJson }
    } else {
      snapshot.steps.push({ step_type: stepType, result_json: resultJson })
    }
    snapshot.savedAt = new Date().toISOString()
    localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snapshot))
  } catch {
    // silent
  }
}

export function readSnapshot(userId: string): OfflineSnapshot | null {
  try {
    const raw = localStorage.getItem(SNAPSHOT_KEY)
    if (!raw) return null
    const snapshot: OfflineSnapshot = JSON.parse(raw)
    if (snapshot.userId !== userId) {
      // Stale snapshot from a different user on the same device — clear it.
      localStorage.removeItem(SNAPSHOT_KEY)
      return null
    }
    return snapshot
  } catch {
    return null
  }
}

export function clearSnapshot(): void {
  try {
    localStorage.removeItem(SNAPSHOT_KEY)
  } catch {
    // silent
  }
}
```

- [ ] **Step 2: Verify the file compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors referencing `offline-snapshot.ts`.

- [ ] **Step 3: Verify the snapshot key manually in the browser**

Start the dev server (`npm run dev`), open DevTools → Application → Local Storage → `http://localhost:5173`. The `fypro_offline_snapshot` key should not yet exist (module created but not wired in).

- [ ] **Step 4: Commit**

```bash
git add src/lib/offline-snapshot.ts
git commit -m "feat: add offline-snapshot module (persist/patch/read/clear)"
```

---

## Task 2: Register the snapshot key in `src/lib/storage.ts`

**Files:**
- Modify: `src/lib/storage.ts`

- [ ] **Step 1: Add the key to `USER_STORAGE_KEYS`**

Open `src/lib/storage.ts`. The array currently ends at `'fypro_run_counts'`. Add one entry:

```ts
export const USER_STORAGE_KEYS = [
  'fypro_session',
  'fypro_session_owner',
  'isOnboarded',
  'fypro_autosave_topic_validator',
  'fypro_autosave_chapter_architect',
  'fypro_autosave_supervisor_prep',
  'fypro_autosave_writing_planner',
  'fypro_routing_v1',
  'fypro_sync_queue',
  'fypro_feedback_given',
  'fypro_ref_code',
  'fypro_ref_expiry',
  'fypro_run_counts',
  'fypro_offline_snapshot',   // offline read cache — cleared on logout
] as const
```

- [ ] **Step 2: Verify the type still compiles**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/storage.ts
git commit -m "feat: register fypro_offline_snapshot in USER_STORAGE_KEYS"
```

---

## Task 3: Wire snapshot into `src/hooks/useProjectState.ts`

**Files:**
- Modify: `src/hooks/useProjectState.ts`

This task has six sub-changes. Make them in order and keep a single commit at the end.

- [ ] **Step 1: Add imports at the top of the file**

After the existing imports (around line 23), add:

```ts
import {
  persistSnapshot,
  patchSnapshotStep,
  readSnapshot,
  clearSnapshot,
} from '../lib/offline-snapshot'
```

- [ ] **Step 2: Add the `withTimeout` helper**

After the `withRetry` function (around line 110), add:

```ts
function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('load_timeout')), ms)
    ),
  ])
}
```

- [ ] **Step 3: Add `isOfflineMode` state to `ProjectStateProvider`**

Inside `ProjectStateProvider`, after the existing `useState` declarations (around line 136), add:

```ts
const [isOfflineMode, setIsOfflineMode] = useState(false)
```

- [ ] **Step 4: Update `ProjectStateValue` interface**

Add one field to the interface (around line 114):

```ts
interface ProjectStateValue {
  projectId: string | null
  isLoading: boolean
  isOfflineMode: boolean          // ← new
  showMigrationModal: boolean
  dismissMigrationModal: () => void
  confirmMigration: () => void
  saveStep: (stepType: string, resultJson: Record<string, unknown>, inputSummary?: string) => Promise<void>
  ensureProject: () => Promise<string | null>
  resetProject: () => Promise<void>
  selectProject: (projectId: string) => Promise<void>
}
```

- [ ] **Step 5: Update the `load` function**

The existing `load` function starts at around line 174. Replace the body with the timeout, snapshot persist on success, and snapshot fallback on failure. The changes are:

1. Wrap `loadUserState` in `withTimeout`
2. Call `persistSnapshot` right after `loadUserState` resolves
3. In the `catch` block, read the snapshot and hydrate from it

Here is the complete updated `load` function body. **Replace everything inside `async function load(userId: string | null)`:**

```ts
async function load(userId: string | null) {
  if (!userId) {
    setProjectId(null)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
    setIsLoading(false)
    markOnboardingResolved({})
    return
  }

  setIsLoading(true)
  try {
    const userState = await withTimeout(loadUserState(userId), 5000)
    if (cancelled) return

    // Persist snapshot for offline fallback before hydrating
    persistSnapshot(userId, userState)

    const hydration: Record<string, unknown> = {}

    if (userState.profile) {
      const name = userState.profile.full_name
        ?? (userRef.current?.user_metadata?.full_name as string | undefined)
        ?? null
      if (name) hydration.name = name
      if (userState.profile.faculty)    hydration.faculty    = userState.profile.faculty
      if (userState.profile.department) hydration.department = userState.profile.department
      if (userState.profile.level)      hydration.level      = userState.profile.level
    }

    if (userState.project) {
      setProjectId(userState.project.id)
      if (userState.project.title) hydration.validatedTopic = userState.project.title
      subscribeToProject(userState.project.id)
    } else {
      setProjectId(null)
    }

    const completed = [false, false, false, false, false, false]
    for (const step of userState.steps) {
      const key = STEP_TO_STATE[step.step_type]
      if (key) hydration[key] = resolveStepResult(step.step_type, step.result_json)
      const idx = STEP_TO_IDX[step.step_type]
      if (idx !== undefined) completed[idx] = true
    }
    hydration.stepsCompleted = completed
    const last = completed.lastIndexOf(true)
    hydration.currentStep = last !== -1 ? Math.min(last + 1, 5) : 0

    if (Object.keys(hydration).length > 0) set(hydration)

    markOnboardingResolved({
      faculty:       userState.profile?.faculty    ?? undefined,
      department:    userState.profile?.department ?? undefined,
      metaOnboarded: userRef.current?.user_metadata?.onboarding_completed === true,
    })

    if (!userState.project) {
      const raw = localStorage.getItem('fypro_session')
      if (raw) {
        try {
          const saved = JSON.parse(raw)
          const hasProgress = saved.roughTopic || saved.validatedTopic ||
            (saved.stepsCompleted || []).some(Boolean)
          if (hasProgress) setShowMigrationModal(true)
        } catch { /* malformed — ignore */ }
      }
    }
  } catch (err) {
    console.error('[useProjectState] load error:', err)

    // Supabase unreachable or timed out — attempt snapshot fallback
    const snapshot = readSnapshot(userId)
    if (snapshot) {
      const hydration: Record<string, unknown> = {}

      if (snapshot.profile) {
        const name = snapshot.profile.full_name
          ?? (userRef.current?.user_metadata?.full_name as string | undefined)
          ?? null
        if (name) hydration.name = name
        if (snapshot.profile.faculty)    hydration.faculty    = snapshot.profile.faculty
        if (snapshot.profile.department) hydration.department = snapshot.profile.department
        if (snapshot.profile.level)      hydration.level      = snapshot.profile.level
      }

      if (snapshot.project) {
        setProjectId(snapshot.project.id)
        if (snapshot.project.title) hydration.validatedTopic = snapshot.project.title
        // Do NOT call subscribeToProject — we are offline
      }

      const completed = [false, false, false, false, false, false]
      for (const step of snapshot.steps) {
        const key = STEP_TO_STATE[step.step_type]
        if (key) hydration[key] = resolveStepResult(step.step_type, step.result_json)
        const idx = STEP_TO_IDX[step.step_type]
        if (idx !== undefined) completed[idx] = true
      }
      hydration.stepsCompleted = completed
      const last = completed.lastIndexOf(true)
      hydration.currentStep = last !== -1 ? Math.min(last + 1, 5) : 0

      if (Object.keys(hydration).length > 0) set(hydration)

      markOnboardingResolved({
        faculty:       snapshot.profile?.faculty    ?? undefined,
        department:    snapshot.profile?.department ?? undefined,
        metaOnboarded: userRef.current?.user_metadata?.onboarding_completed === true,
      })

      setIsOfflineMode(true)
    } else {
      markOnboardingResolved({})  // fail open — unblock navigation
    }
  } finally {
    if (!cancelled) setIsLoading(false)
  }
}
```

- [ ] **Step 6: Patch snapshot in `saveStep` after any write**

In the `saveStep` callback (around line 285), add `patchSnapshotStep` as the very first line after `const pid` is resolved. Replace the current `saveStep` body with:

```ts
const saveStep = useCallback(async (
  stepType: string,
  resultJson: Record<string, unknown>,
  inputSummary?: string
): Promise<void> => {
  const pid = projectId ?? await ensureProject()

  // Update offline snapshot immediately — result is available regardless of network
  patchSnapshotStep(stepType, resultJson)

  if (!pid) {
    enqueue({ projectId: '', stepType, resultJson, inputSummary: inputSummary ?? null })
    showToast('Saved locally — will sync when connected')
    return
  }

  const isOnline = getStatus() !== 'offline' && navigator.onLine

  if (isOnline) {
    try {
      await withRetry(() => supabaseSaveStep(pid, stepType, resultJson, inputSummary))
      if (NEXT_STEP[stepType]) {
        const projectUpdates: Partial<Pick<import('../lib/db').Project, 'title' | 'current_step' | 'status'>> = {
          current_step: NEXT_STEP[stepType],
        }
        if (stepType === 'topic_validator' && resultJson.refined_topic) {
          projectUpdates.title = resultJson.refined_topic as string
        }
        updateProject(pid, projectUpdates).catch(() => {})
      }
    } catch {
      enqueue({ projectId: pid, stepType, resultJson, inputSummary: inputSummary ?? null })
      showToast('Saved locally — will sync when reconnected')
    }
  } else {
    enqueue({ projectId: pid, stepType, resultJson, inputSummary: inputSummary ?? null })
    showToast('Saved locally — will sync when reconnected')
  }
}, [projectId, ensureProject])
```

- [ ] **Step 7: Clear snapshot in `resetProject`**

In `resetProject` (around line 321), add one line after `deleteAllUserData`:

```ts
async function resetProject() {
  if (userRef.current) {
    try {
      await deleteAllUserData(userRef.current.id)
    } catch (err) {
      console.error('[resetProject] delete failed', err)
    }
  }
  clearSnapshot()   // ← new
  setProjectId(null)
  if (channelRef.current) {
    supabase.removeChannel(channelRef.current)
    channelRef.current = null
  }
}
```

- [ ] **Step 8: Add `isOfflineMode` to the context value object**

Near the bottom of `ProjectStateProvider` (around line 427), replace the `value` object:

```ts
const value: ProjectStateValue = {
  projectId,
  isLoading,
  isOfflineMode,              // ← new
  showMigrationModal,
  dismissMigrationModal,
  confirmMigration,
  saveStep,
  ensureProject,
  resetProject,
  selectProject,
}
```

- [ ] **Step 9: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 10: Verify snapshot writes in browser**

1. `npm run dev`, sign in, load `/app`
2. DevTools → Application → Local Storage
3. Confirm `fypro_offline_snapshot` key exists with your userId, profile, project, and steps fields
4. Complete a step — confirm the step appears in the snapshot immediately (before page reload)

- [ ] **Step 11: Verify snapshot fallback in browser**

1. DevTools → Network tab → set throttling to "Offline"
2. Hard-refresh the page (Ctrl+Shift+R)
3. App should load with step data visible (not blank) within ~5 seconds
4. Check `isOfflineMode` is `true` by adding a temporary `console.log(isOfflineMode)` in `AppShell.jsx` if needed

- [ ] **Step 12: Commit**

```bash
git add src/hooks/useProjectState.ts
git commit -m "feat: wire offline snapshot into useProjectState (timeout, persist, fallback, patch)"
```

---

## Task 4: Update `src/components/OfflineBanner.tsx`

**Files:**
- Modify: `src/components/OfflineBanner.tsx`

- [ ] **Step 1: Rewrite the component to accept `isOfflineMode` prop**

Replace the entire file contents with:

```tsx
// Offline indicator — shown at the top of the app when connectivity is lost.
// Does NOT block the UI. Students in Nigerian universities lose connectivity routinely.
// isOfflineMode = true means the app loaded from the offline snapshot (Supabase unreachable).

import { useEffect, useState } from 'react'
import { onStatusChange, getStatus, drain } from '../lib/sync-queue'

interface Props {
  isOfflineMode?: boolean
}

export default function OfflineBanner({ isOfflineMode = false }: Props) {
  const [status, setStatus] = useState(getStatus())

  useEffect(() => {
    const unsub = onStatusChange(setStatus)
    return unsub
  }, [])

  const isVisible = isOfflineMode || status !== 'online'
  if (!isVisible) return null

  // isOfflineMode: Supabase unreachable at load — showing cached data (amber, non-critical)
  if (isOfflineMode) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full flex items-center justify-between px-4 py-2 font-sans text-[0.78rem] font-medium"
        style={{
          background: 'rgba(245,158,11,0.12)',
          borderBottom: '1px solid rgba(245,158,11,0.25)',
          color: '#F59E0B',
        }}
      >
        <span>Viewing your last saved project — connect to generate new content.</span>
      </div>
    )
  }

  // Write-side queue states: reconnecting or offline
  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full flex items-center justify-between px-4 py-2 font-sans text-[0.78rem] font-medium"
      style={{
        background: status === 'reconnecting'
          ? 'rgba(245,158,11,0.12)'
          : 'rgba(220,38,38,0.10)',
        borderBottom: `1px solid ${status === 'reconnecting'
          ? 'rgba(245,158,11,0.25)'
          : 'rgba(220,38,38,0.2)'}`,
        color: status === 'reconnecting' ? '#F59E0B' : '#EF4444',
      }}
    >
      <span>
        {status === 'reconnecting'
          ? 'Syncing saved changes…'
          : 'You\'re offline. Changes will sync when you reconnect.'}
      </span>

      {status === 'offline' && (
        <button
          onClick={() => drain()}
          className="font-mono text-[0.72rem] underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0"
          style={{ color: 'inherit' }}
        >
          Retry
        </button>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify types compile**

```bash
npx tsc --noEmit
```

Expected: zero errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/OfflineBanner.tsx
git commit -m "feat: add isOfflineMode prop to OfflineBanner with amber cached-data variant"
```

---

## Task 5: Wire `isOfflineMode` in `src/features/shell/AppShell.jsx`

**Files:**
- Modify: `src/features/shell/AppShell.jsx`

- [ ] **Step 1: Destructure `isOfflineMode` from `useProjectState`**

Find line 117 (the `useProjectState` destructure). Replace it:

```js
const { isLoading, showMigrationModal, dismissMigrationModal, confirmMigration, isOfflineMode } = useProjectState()
```

- [ ] **Step 2: Pass the prop to `OfflineBanner`**

Find line 199 (the `<OfflineBanner />` call). Replace it:

```jsx
<OfflineBanner isOfflineMode={isOfflineMode} />
```

- [ ] **Step 3: Verify in browser**

1. With DevTools Network set to Offline, hard-refresh `/app`
2. The amber banner "Viewing your last saved project — connect to generate new content." should appear at the top
3. Step data should be visible below it

- [ ] **Step 4: Commit**

```bash
git add src/features/shell/AppShell.jsx
git commit -m "feat: wire isOfflineMode from useProjectState to OfflineBanner"
```

---

## Task 6: Add `OFFLINE` early exit to `src/services/api.js`

**Files:**
- Modify: `src/services/api.js`

This task adds the same two-line guard to five functions, plus one entry to `handleApiError`.

- [ ] **Step 1: Add guard to `callClaude`**

`callClaude` starts at line 32. Add the guard as the first two lines of the function body, before `const token = await getAccessToken()`:

```js
async function callClaude(step, messages, maxTokens = 2000, extraParams = {}) {
  if (!navigator.onLine) { const e = new Error('offline'); e.code = 'OFFLINE'; throw e }
  const token = await getAccessToken()
  // ... rest of function unchanged
```

- [ ] **Step 2: Add guard to `callTopicValidator`**

`callTopicValidator` starts at line 102. Add guard as first line of function body:

```js
async function callTopicValidator(messages, topic) {
  if (!navigator.onLine) { const e = new Error('offline'); e.code = 'OFFLINE'; throw e }
  const token = await getAccessToken()
  // ... rest of function unchanged
```

- [ ] **Step 3: Add guard to `callLiteratureMap`**

`callLiteratureMap` starts at line 159. Add guard as first line of function body:

```js
async function callLiteratureMap(messages, topic) {
  if (!navigator.onLine) { const e = new Error('offline'); e.code = 'OFFLINE'; throw e }
  const token = await getAccessToken()
  // ... rest of function unchanged
```

- [ ] **Step 4: Add guard to `callClaudeAuth`**

`callClaudeAuth` starts at line 221. Add guard as first line of function body:

```js
async function callClaudeAuth(endpoint, system, messages, maxTokens = 2000) {
  if (!navigator.onLine) { const e = new Error('offline'); e.code = 'OFFLINE'; throw e }
  const token = await getAccessToken()
  // ... rest of function unchanged
```

- [ ] **Step 5: Add guard to `callClaudeAuthRaw`**

`callClaudeAuthRaw` starts at line 281. Add guard as first line of function body:

```js
async function callClaudeAuthRaw(endpoint, system, messages, maxTokens = 2000, extra = {}) {
  if (!navigator.onLine) { const e = new Error('offline'); e.code = 'OFFLINE'; throw e }
  const token = await getAccessToken()
  // ... rest of function unchanged
```

- [ ] **Step 6: Add `OFFLINE` handler to `handleApiError`**

`handleApiError` starts at line 578. Add the offline check as the **first** check in the function, before the existing `NO_PAPERS` check:

```js
export function handleApiError(err, showError) {
  if (err.code === 'OFFLINE') {
    showError("You're offline. Connect to generate new content.")
    return true
  }
  if (err.code === 'NO_PAPERS') {
  // ... rest of function unchanged
```

- [ ] **Step 7: Verify in browser**

1. With DevTools Network set to Offline, navigate to Topic Validator
2. Type a topic and click Validate
3. The error message "You're offline. Connect to generate new content." should appear immediately — no spinner, no 30-second wait

- [ ] **Step 8: Commit**

```bash
git add src/services/api.js
git commit -m "feat: add OFFLINE early exit to all API fetch helpers"
```

---

## Task 7: End-to-End Verification

**No code changes — verification only.**

- [ ] **Step 1: Full online flow**

1. `npm run dev`, sign in, complete at least Steps 1–2 with network connected
2. DevTools → Application → Local Storage → confirm `fypro_offline_snapshot` exists
3. Confirm it has `userId`, `profile`, `project`, and `steps` with your completed steps

- [ ] **Step 2: Offline load**

1. DevTools → Network → set to "Offline"
2. Hard-refresh the page (Ctrl+Shift+R)
3. Confirm: amber banner appears at top
4. Confirm: Step 1 and Step 2 data is visible (not blank)
5. Confirm: sidebar shows correct step progress

- [ ] **Step 3: Offline generation attempt**

1. While in Offline mode, navigate to Step 1
2. Click Validate Topic
3. Confirm: error message "You're offline. Connect to generate new content." appears immediately (no spinner delay)

- [ ] **Step 4: Back online**

1. Set Network back to "No throttling"
2. Soft-reload the page (Ctrl+R without hard-refresh)
3. Confirm: amber banner disappears
4. Confirm: data is still correct (fresh load from Supabase, snapshot refreshed)

- [ ] **Step 5: Logout clears snapshot**

1. Sign out
2. DevTools → Application → Local Storage
3. Confirm `fypro_offline_snapshot` key is gone

- [ ] **Step 6: Final commit (if any cleanup needed)**

```bash
git add -p
git commit -m "chore: offline content caching end-to-end verified"
```
