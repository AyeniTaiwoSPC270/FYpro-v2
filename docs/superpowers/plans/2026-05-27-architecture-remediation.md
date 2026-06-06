# FYPro v2 Architecture Remediation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Systematically fix every architectural issue identified in the May 2026 architecture review — critical safety bugs, server-side security gaps, performance waste, DB schema hygiene, and API code health — without breaking any existing behaviour.

**Architecture:** Changes are organised into six phases of increasing scope, from one-line safety fixes to structural refactors. Each phase can be shipped independently. No phase requires a database migration before the next phase can start, except Phase 4 which is self-contained migrations.

**Tech Stack:** React 19, TypeScript 5.9 (strict: false → incrementally tightened), Supabase JS v2, Vercel Serverless Functions (Node), Upstash Redis, Paystack webhooks, Resend.

---

## Files Created or Modified

| File | Change |
|---|---|
| `src/lib/storage.ts` | **Create** — canonical list of user localStorage keys + clearUserLocalStorage |
| `src/context/AuthContext.tsx` | Modify — import clearUserLocalStorage, fix forceSignOut |
| `src/context/AppContext.jsx` | Modify — remove hydrateFromSupabase, expose markOnboardingResolved |
| `src/hooks/useProjectState.ts` | Modify — call markOnboardingResolved after load, merge updateProject calls |
| `api/ai.js` | Modify — maybeSingle on defense, server-side run limit enforcement + increment, remove cache-hit inserts, move sync-run-counts |
| `api/payments.js` | Modify — 200→404 on not_found, fix receipt email using existing user.email |
| `api/admin.js` | Modify — receive sync-run-counts handler moved from ai.js |
| `api/_lib/anthropic-proxy.js` | **Create** — shared authenticated Anthropic call utility |
| `src/lib/db.ts` | Modify — narrow select columns |
| `tsconfig.json` | Modify — enable noImplicitAny + strictNullChecks |
| Supabase migrations (3 SQL files) | **Create** — composite index, updated_at on project_steps, vestigial columns |

---

## Phase 1: Critical Safety Fixes

### Task 1: Extract `clearUserLocalStorage` and fix `forceSignOut`

Two bugs in one task — they touch the same code path and are both one-line fixes once the shared utility exists.

**Bugs fixed:**
- `forceSignOut()` calls `localStorage.clear()` which nukes theme and cookie consent prefs
- `signingOut` flag is never reset — if `signOut()` throws, subsequent `forceSignOut()` calls silently no-op forever

**Files:**
- Create: `src/lib/storage.ts`
- Modify: `src/context/AppContext.jsx` (lines 63–84)
- Modify: `src/context/AuthContext.tsx` (lines 29–38)

- [ ] **Step 1.1 — Create `src/lib/storage.ts`**

```ts
// Canonical list of every localStorage key the app writes per authenticated user.
// cookie_consent and fypro_theme are intentionally excluded — they are device
// preferences and must survive sign-out and session expiry.
export const USER_STORAGE_KEYS = [
  'fypro_session',
  'fypro_session_owner',
  'isOnboarded',
  'fypro_run_counts',
  'fypro_autosave_topic_validator',
  'fypro_autosave_chapter_architect',
  'fypro_autosave_supervisor_prep',
  'fypro_autosave_writing_planner',
  'fypro_routing_v1',
  'fypro_sync_queue',
  'fypro_feedback_given',
  'fypro_ref_code',
  'fypro_ref_expiry',
] as const

export function clearUserLocalStorage(): void {
  USER_STORAGE_KEYS.forEach(key => {
    try { localStorage.removeItem(key) } catch {}
  })
  try { sessionStorage.clear() } catch {}
}
```

- [ ] **Step 1.2 — Update `AppContext.jsx` to import from `storage.ts`**

In `src/context/AppContext.jsx`, remove the inline `USER_STORAGE_KEYS` array (lines 63–77) and `clearUserLocalStorage` function (lines 79–84). Replace with:

```js
import { USER_STORAGE_KEYS, clearUserLocalStorage } from '../lib/storage'
export { clearUserLocalStorage }
```

Keep the `export` so any component importing `clearUserLocalStorage` from AppContext still works without a change.

- [ ] **Step 1.3 — Fix `AuthContext.tsx`**

In `src/context/AuthContext.tsx`, replace the `forceSignOut` function (lines 31–38):

```tsx
// Before:
async function forceSignOut(): Promise<void> {
  if (signingOut) return
  signingOut = true
  try { await supabase.auth.signOut() } catch { /* ignore — user may already be deleted */ }
  localStorage.clear()
  sessionStorage.clear()
  window.location.replace('/login?session_expired=1')
}
```

```tsx
// After:
import { clearUserLocalStorage } from '../lib/storage'

async function forceSignOut(): Promise<void> {
  if (signingOut) return
  signingOut = true
  try {
    await supabase.auth.signOut()
  } catch {
    // ignore — user may already be deleted or token invalid
  } finally {
    signingOut = false  // always reset so retries are possible
  }
  clearUserLocalStorage()
  window.location.replace('/login?session_expired=1')
}
```

Note: `clearUserLocalStorage` already calls `sessionStorage.clear()` internally — the separate `sessionStorage.clear()` line is removed.

- [ ] **Step 1.4 — Verify manually**

Start dev server (`npm run dev`). Log in, then in DevTools:
1. Set `localStorage.fypro_theme = 'dark'` and `localStorage.cookie_consent = 'true'`
2. Open AuthContext.tsx in source, set a breakpoint just before `window.location.replace`
3. Trigger a session expiry simulation: in console, run `supabase.auth.signOut()` then refresh
4. Confirm `fypro_theme` and `cookie_consent` are still present in localStorage after redirect
5. Confirm `fypro_session` and `fypro_run_counts` are gone

- [ ] **Step 1.5 — Commit**

```
git add src/lib/storage.ts src/context/AppContext.jsx src/context/AuthContext.tsx
git commit -m "fix(auth): extract clearUserLocalStorage, preserve theme/consent on force sign-out, reset signingOut flag"
```

---

### Task 2: Fix defense handler `.single()` → `.maybeSingle()`

**Bug:** `api/ai.js` line 220 — `handleDefense` uses `.single()` on `user_entitlements`. For new users whose entitlements row doesn't exist yet, PostgREST returns an error (PGRST116) and the user gets `403 'Feature not unlocked'` when the real issue is the row doesn't exist.

**File:** Modify `api/ai.js` (lines 217–228)

- [ ] **Step 2.1 — Fix the query in `handleDefense`**

In `api/ai.js`, inside `handleDefense`, replace:

```js
// Before (line 217):
const { data: entitlements, error: entError } = await supabaseAdmin
  .from('user_entitlements')
  .select('paid_features')
  .eq('user_id', user.id)
  .single();

if (entError || !entitlements) return res.status(403).json({ error: 'Feature not unlocked.' });

const paidFeatures = Array.isArray(entitlements.paid_features) ? entitlements.paid_features : [];
if (!paidFeatures.includes('defense_pack')) {
  return res.status(403).json({ error: 'Feature not unlocked. Please purchase the Defense Pack.' });
}
```

```js
// After:
const { data: entitlements, error: entError } = await supabaseAdmin
  .from('user_entitlements')
  .select('paid_features')
  .eq('user_id', user.id)
  .maybeSingle();  // maybeSingle: returns null (not an error) when row doesn't exist

if (entError) {
  console.error('[ai/defense] entitlements fetch error:', entError.message);
  return res.status(503).json({ error: 'Service unavailable. Please try again.' });
}

const paidFeatures = Array.isArray(entitlements?.paid_features) ? entitlements.paid_features : [];
if (!paidFeatures.includes('defense_pack')) {
  return res.status(403).json({ error: 'Feature not unlocked. Please purchase the Defense Pack.' });
}
```

- [ ] **Step 2.2 — Verify**

Using a test account without an entitlements row, attempt to call `POST /api/ai?action=defense`. Confirm the response is `403 'Feature not unlocked.'` (not a 503 or an uncaught error). The service-unavailable path should only fire if Supabase itself is down.

- [ ] **Step 2.3 — Commit**

```
git add api/ai.js
git commit -m "fix(api): use maybeSingle on defense entitlements to handle missing rows correctly"
```

---

### Task 3: Fix `check-status` returning HTTP 200 for a not-found payment

**Bug:** `api/payments.js` line 170 — returns `status(200)` when no payment row matches. Semantically wrong; should be 404.

**Safe:** `usePaystackCheckout.js` only reads `pollData.status === 'success'` from the body. It does not check the HTTP status code, so changing to 404 does not break the polling loop — it will continue polling as before.

**File:** Modify `api/payments.js` (line 170)

- [ ] **Step 3.1 — Fix the status code**

In `api/payments.js`, inside `handleCheckStatus`, replace:

```js
// Before (line 170):
if (error || !data) return res.status(200).json({ status: 'not_found' });
```

```js
// After:
if (error || !data) return res.status(404).json({ status: 'not_found' });
```

- [ ] **Step 3.2 — Verify**

In DevTools Network tab, trigger a payment poll with an unknown reference. Confirm the response is now HTTP 404 with body `{"status":"not_found"}`. Confirm the poll continues (does not crash the UI).

- [ ] **Step 3.3 — Commit**

```
git add api/payments.js
git commit -m "fix(payments): return 404 instead of 200 for unknown payment reference"
```

---

## Phase 2: Server-Side Run Limit Enforcement

### Task 4: Enforce per-step free-tier limits in `/api/ai` handleGeneral

**Security gap:** The per-step free limits (3 runs for topic-validator, 1 for chapter-architect, etc.) are currently enforced only in the browser via `useRunLimit.js`. Any authenticated user can call `POST /api/ai` directly and bypass them. The Upstash limit of 30/day is the only server-side gate, which is 10× the intended free tier.

**Fix strategy:** Expand the entitlements fetch to include `run_counts`. For unpaid users, check the count before calling Claude. After a successful response, increment the server-side count (fire-and-forget, eventually consistent). Both the check and the increment use the data already fetched in Phase 2 of `handleGeneral`, adding zero extra round-trips.

**File:** Modify `api/ai.js`

- [ ] **Step 4.1 — Add server-side free limits constant at the top of `api/ai.js`**

After the existing constants (after line 24 `const TTL_BY_STEP = {...}`), add:

```js
// Server-enforced per-step limits for unauthenticated free-tier users.
// Mirrors the FREE_LIMITS object in src/hooks/useRunLimit.js.
// Keep these two in sync when adjusting free tier quotas.
const SERVER_FREE_LIMITS = {
  'topic-validator':     3,
  'chapter-architect':   1,
  'methodology-advisor': 1,
  'writing-planner':     1,
};
```

- [ ] **Step 4.2 — Expand the entitlements fetch to include `run_counts`**

In `handleGeneral`, the Phase 2 block (around line 99–112) currently selects only `paid_features`. Change it to also select `run_counts`:

```js
// Before:
const { data } = await supabaseAdmin
  .from('user_entitlements')
  .select('paid_features')
  .eq('user_id', user.id)
  .maybeSingle();

// After:
const { data } = await supabaseAdmin
  .from('user_entitlements')
  .select('paid_features, run_counts')
  .eq('user_id', user.id)
  .maybeSingle();
```

- [ ] **Step 4.3 — Add run count gate after the `isPaid` check**

Immediately after the line `const isPaid = paidFeatures.includes('student_pack') || paidFeatures.includes('defense_pack');`, add:

```js
// Server-side run limit gate — only applies to free (unpaid) users.
// Paid users have a null limit (unlimited) so this block is skipped entirely for them.
if (!isPaid && SERVER_FREE_LIMITS[step] !== undefined) {
  const dbRunCounts = (entData?.run_counts && typeof entData.run_counts === 'object')
    ? entData.run_counts
    : {};
  // DB stores keys as snake_case (topic_validator); step param uses kebab-case (topic-validator)
  const dbKey = step.replace(/-/g, '_');
  const serverCount = typeof dbRunCounts[dbKey] === 'number' ? dbRunCounts[dbKey] : 0;
  if (serverCount >= SERVER_FREE_LIMITS[step]) {
    return res.status(429).json({
      error: 'Free tier limit reached for this feature. Upgrade to the Student Pack to continue.',
    });
  }
}
```

- [ ] **Step 4.4 — Increment server-side count after a successful response**

In `handleGeneral`, after the `setCached(cacheKey, data, ttl)` line (around line 154) and before the `return res.status(response.status).json(data)`, add the fire-and-forget increment:

```js
// Increment server-side run count for free users so the server gate stays authoritative.
// Uses upsert with full run_counts object to avoid a read-modify-write race — eventual
// consistency is acceptable here; the check at the top of the request is what matters.
if (response.ok && !isPaid && SERVER_FREE_LIMITS[step] !== undefined) {
  const dbKey = step.replace(/-/g, '_');
  const existingCounts = (entData?.run_counts && typeof entData.run_counts === 'object')
    ? entData.run_counts
    : {};
  const newCount = (typeof existingCounts[dbKey] === 'number' ? existingCounts[dbKey] : 0) + 1;
  const updatedCounts = { ...existingCounts, [dbKey]: newCount };
  supabaseAdmin
    .from('user_entitlements')
    .upsert(
      { user_id: user.id, run_counts: updatedCounts, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
    .catch(err => console.error('[ai/general] run count increment failed:', err?.message));
}
```

- [ ] **Step 4.5 — Verify: free user is blocked after limit**

1. In Supabase, set a test user's `user_entitlements.run_counts` to `{"topic_validator": 3}`
2. Call `POST /api/ai` with `{"step": "topic-validator", ...}` using the test user's JWT
3. Confirm response is `429 'Free tier limit reached...'`
4. Set run_counts to `{"topic_validator": 2}`, call again — confirm it succeeds and DB count is now 3

- [ ] **Step 4.6 — Verify: paid user is not affected**

Ensure a user with `paid_features: ["student_pack"]` and `run_counts: {"topic_validator": 99}` can still call the endpoint successfully. The `!isPaid` guard must bypass the check entirely.

- [ ] **Step 4.7 — Commit**

```
git add api/ai.js
git commit -m "feat(api): enforce server-side per-step free tier limits in /api/ai handleGeneral"
```

---

## Phase 3: Performance & Correctness Fixes

### Task 5: Eliminate double profile fetch on login

**Issue:** `AppContext.hydrateFromSupabase()` fetches the `users` table profile on login. `ProjectStateProvider.load()` also calls `loadUserState()` which fetches the same profile. Two round-trips to the same table, sequential race.

**Fix:** Remove `hydrateFromSupabase` from AppContext entirely. Expose a `markOnboardingResolved({ faculty, department, metaOnboarded })` callback. Have `ProjectStateProvider.load()` call it after hydrating the AppContext state, since it already has the profile data.

**`retryHydrate` and `hydrateError` are confirmed unused** (grep shows they're only defined in AppContext, never consumed in any component). Safe to remove.

**Files:**
- Modify: `src/context/AppContext.jsx`
- Modify: `src/hooks/useProjectState.ts`

- [ ] **Step 5.1 — Add `markOnboardingResolved` to AppContext and remove `hydrateFromSupabase`**

In `src/context/AppContext.jsx`, make these changes:

**Remove** the following state declarations (around lines 131–132):
```js
const [hydrateError, setHydrateError] = useState(false)
const [_hydrateRetryCount, setHydrateRetryCount] = useState(0)
```

**Remove** the entire `useEffect` block that calls `hydrateFromSupabase` (lines 157–215). This is the block whose dependency array is `[session?.user?.id, _hydrateRetryCount]`.

**Remove** the `retryHydrate` callback (lines 217–219).

**Add** a new callback immediately after the `completeStep` callback:

```js
// Called by ProjectStateProvider after it finishes loading profile + project data.
// Resolves the onboarding gate so AppShell and Dashboard stop waiting.
const markOnboardingResolved = useCallback(({
  faculty,
  department,
  metaOnboarded = false,
} = {}) => {
  const shouldMark = metaOnboarded === true || Boolean(faculty && department)
  if (shouldMark) {
    try { localStorage.setItem('isOnboarded', 'true') } catch {}
    setOnboardedFlag(true)
  } else {
    try { localStorage.removeItem('isOnboarded') } catch {}
    setOnboardedFlag(false)
  }
  setOnboardingResolved(true)
}, [])
```

**Update** `contextValue` — remove `hydrateError` and `retryHydrate`, add `markOnboardingResolved`:

```js
const contextValue = useMemo(() => ({
  state,
  set,
  clearState,
  clearProjectData,
  navigateStep,
  completeStep,
  studentContext,
  isOnboarded,
  onboardingResolved,
  markOnboardingResolved,
}), [state, set, clearState, clearProjectData, navigateStep, completeStep, studentContext, isOnboarded, onboardingResolved, markOnboardingResolved])
```

Also remove the `setOnboardingResolved` and `setOnboardedFlag` calls from the `loadFromStorage`-related code (they no longer need the auth guard since ProjectStateProvider owns resolution) — specifically keep `setOnboardingResolved` initialised as `() => !getCurrentAuthUserId()` (line 285). That initial value is still correct.

- [ ] **Step 5.2 — Update the `useApp()` TypeScript consumers**

Since `retryHydrate` and `hydrateError` are removed from the context, search for any remaining usages and remove them:

```
grep -r "retryHydrate\|hydrateError" src/
```

Expected result: zero matches (already confirmed by grep above).

- [ ] **Step 5.3 — Call `markOnboardingResolved` from `ProjectStateProvider.load()`**

In `src/hooks/useProjectState.ts`, destructure `markOnboardingResolved` from `useApp()` at line 115 (where `set` and `state` are already destructured):

```ts
// Before:
const { set, state } = useApp()

// After:
const { set, state, markOnboardingResolved } = useApp()
```

In the `load()` async function (lines 170–226), add `markOnboardingResolved` calls in three places:

**After the null-user early return** (around line 161–166):
```ts
if (!userId) {
  setProjectId(null)
  if (channelRef.current) {
    supabase.removeChannel(channelRef.current)
    channelRef.current = null
  }
  setIsLoading(false)
  // User is logged out — onboarding resolved immediately (isOnboarded stays false)
  markOnboardingResolved({})
  return
}
```

**After the successful hydration `set(hydration)` call** (around line 207):
```ts
if (Object.keys(hydration).length > 0) set(hydration)

markOnboardingResolved({
  faculty:       userState.profile?.faculty    ?? null,
  department:    userState.profile?.department ?? null,
  metaOnboarded: userRef.current?.user_metadata?.onboarding_completed === true,
})
```

**In the catch block** (line 221–223) — unblock the app even on error:
```ts
} catch (err) {
  console.error('[useProjectState] load error:', err)
  markOnboardingResolved({})  // fail open — unblock navigation
}
```

- [ ] **Step 5.4 — Verify the onboarding gate still works**

1. Log in with a fully-onboarded account → should land on /dashboard (not /start)
2. Log in with a fresh account (no faculty/department) → should redirect to onboarding
3. Log out and log back in → no double-fetch in Network tab (only one request to `users` table)
4. Confirm AppShell and Dashboard do not flash a redirect before data loads

- [ ] **Step 5.5 — Commit**

```
git add src/context/AppContext.jsx src/hooks/useProjectState.ts
git commit -m "perf: eliminate double profile fetch on login by moving onboarding resolution to ProjectStateProvider"
```

---

### Task 6: Merge duplicate `updateProject()` calls in `saveStep`

**Issue:** In `useProjectState.ts` `saveStep()`, when a `topic_validator` step is saved, two separate `updateProject()` calls fire — one for `current_step` and one for `title`. That's two Supabase writes where one would do.

**File:** Modify `src/hooks/useProjectState.ts` (lines 279–283)

- [ ] **Step 6.1 — Merge the two calls**

Replace:

```ts
// Before (lines 279–283):
if (NEXT_STEP[stepType]) {
  updateProject(pid, { current_step: NEXT_STEP[stepType] }).catch(() => {})
}
if (stepType === 'topic_validator' && resultJson.refined_topic) {
  updateProject(pid, { title: resultJson.refined_topic as string }).catch(() => {})
}
```

With:

```ts
// After:
if (NEXT_STEP[stepType]) {
  const projectUpdates: Partial<Pick<import('../lib/db').Project, 'title' | 'current_step' | 'status'>> = {
    current_step: NEXT_STEP[stepType],
  }
  if (stepType === 'topic_validator' && resultJson.refined_topic) {
    projectUpdates.title = resultJson.refined_topic as string
  }
  updateProject(pid, projectUpdates).catch(() => {})
}
```

- [ ] **Step 6.2 — Verify**

Save a topic_validator step result. In Supabase Studio, confirm the `projects` row has both `current_step = 'chapter_architect'` and `title = '<refined topic>'` after a single DB round-trip (check response_times or Supabase logs).

- [ ] **Step 6.3 — Commit**

```
git add src/hooks/useProjectState.ts
git commit -m "perf: merge two updateProject calls into one when saving topic_validator step"
```

---

### Task 7: Remove noisy cache-hit `response_times` inserts + fix receipt email extra queries

Two small correctness fixes grouped together.

**Issue A:** Cache hits in `api/ai.js` insert a `response_times` row with `duration_ms: 0`. These rows pollute latency analytics and provide no value. Same problem exists in `handleSupervisorPrep`.

**Issue B:** In `api/payments.js` `handleVerify`, after `creditUser()` succeeds, two additional Supabase queries are made to look up the user's email for the receipt. The email is already available in `user.email` from the auth check earlier in the same handler.

**Files:** Modify `api/ai.js`, `api/payments.js`

- [ ] **Step 7.1 — Remove cache-hit `response_times` inserts in `handleGeneral`**

In `api/ai.js` inside `handleGeneral`, find the cache-hit path (around line 122–128):

```js
// Before:
if (cached) {
  await supabaseAdmin.from('response_times').insert({ feature: step, duration_ms: 0, user_id: user.id }).catch(err => {
    console.error('[ai/general] response_times insert failed (cache-hit):', err?.message, err?.code, err?.details, err?.hint, JSON.stringify(err));
  });
  res.setHeader('X-Cache', 'HIT');
  return res.status(200).json(cached);
}
```

```js
// After:
if (cached) {
  res.setHeader('X-Cache', 'HIT');
  return res.status(200).json(cached);
}
```

- [ ] **Step 7.2 — Remove cache-hit `response_times` insert in `handleSupervisorPrep`**

Same fix in `handleSupervisorPrep` (around line 360–366):

```js
// Before:
if (cached) {
  await supabaseAdmin.from('response_times').insert({ feature: 'supervisor-prep', duration_ms: 0, user_id: user.id }).catch(err => {
    console.error('[ai/supervisor-prep] response_times insert failed (cache-hit):', err?.message, ...);
  });
  res.setHeader('X-Cache', 'HIT');
  return res.status(200).json(cached);
}
```

```js
// After:
if (cached) {
  res.setHeader('X-Cache', 'HIT');
  return res.status(200).json(cached);
}
```

- [ ] **Step 7.3 — Fix receipt email to use existing `user.email` in `handleVerify`**

In `api/payments.js`, inside `handleVerify`, the email is sent after two extra queries (around lines 300–325). The `user` variable from the auth check (line ~191) already has the email. Replace:

```js
// Before (lines 300–325 roughly):
if (result.status === 'success') {
  try {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('user_id, amount_kobo, tier')
      .eq('paystack_reference', reference)
      .single();

    if (payment) {
      const { data: dbUser } = await supabaseAdmin
        .from('users')
        .select('email')
        .eq('id', payment.user_id)
        .single();

      if (dbUser?.email) {
        const planName  = PLAN_DISPLAY_NAMES[payment.tier] || payment.tier;
        const amountNGN = payment.amount_kobo / 100;
        await sendReceiptEmail(dbUser.email, planName, amountNGN, reference);
        sendTelegramAlertOnce(`💰 Payment received: ${dbUser.email} paid ₦${amountNGN.toLocaleString('en-NG')} for ${planName}`, `tg:payment:${reference}`)
      }
    }
  } catch (emailErr) {
    console.error('[payments/verify] receipt email failed', { reference, message: emailErr.message });
  }
}
```

```js
// After:
if (result.status === 'success') {
  // user.email comes from the auth check earlier in handleVerify — no extra queries needed
  try {
    const { data: payment } = await supabaseAdmin
      .from('payments')
      .select('amount_kobo, tier')
      .eq('paystack_reference', reference)
      .single();

    if (payment && user.email) {
      const planName  = PLAN_DISPLAY_NAMES[payment.tier] || payment.tier;
      const amountNGN = payment.amount_kobo / 100;
      await sendReceiptEmail(user.email, planName, amountNGN, reference);
      sendTelegramAlertOnce(
        `💰 Payment received: ${user.email} paid ₦${amountNGN.toLocaleString('en-NG')} for ${planName}`,
        `tg:payment:${reference}`
      );
    }
  } catch (emailErr) {
    console.error('[payments/verify] receipt email failed', { reference, message: emailErr.message });
  }
}
```

- [ ] **Step 7.4 — Verify**

1. Trigger a cache hit on topic-validator. Open Supabase `response_times` table. Confirm no new row with `duration_ms = 0` was inserted.
2. Complete a test payment via verify flow. Confirm receipt email arrives and only one Supabase query for `payments` was made (not two).

- [ ] **Step 7.5 — Commit**

```
git add api/ai.js api/payments.js
git commit -m "perf: remove cache-hit response_times inserts, use existing user.email for receipt emails"
```

---

## Phase 4: Database Migrations

Each migration is a SQL file to run in the Supabase SQL Editor. Apply them in order.

### Task 8: Add composite index on `projects(user_id, updated_at DESC)`

**Issue:** `loadUserState()` in db.ts queries `projects` by `user_id` ordered by `updated_at DESC`. Without a composite index, each login does a sequential scan over all projects for that user.

**File:** Create `migrations/0021_projects_user_updated_index.sql`

- [ ] **Step 8.1 — Write the migration**

```sql
-- Migration: 0021_projects_user_updated_index.sql
-- Speeds up loadUserState() which queries projects by user_id ordered by updated_at DESC.
-- CONCURRENTLY means this does not block reads/writes while building.

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_projects_user_id_updated_at
  ON public.projects (user_id, updated_at DESC);
```

- [ ] **Step 8.2 — Apply in Supabase SQL Editor**

Run the above SQL. Confirm with:
```sql
SELECT indexname, indexdef
FROM pg_indexes
WHERE tablename = 'projects' AND indexname = 'idx_projects_user_id_updated_at';
```
Expected: one row returned.

- [ ] **Step 8.3 — Commit the migration file**

```
git add migrations/0021_projects_user_updated_index.sql
git commit -m "db: add composite index on projects(user_id, updated_at DESC) for faster login loads"
```

---

### Task 9: Add `updated_at` to `project_steps`

**Issue:** `project_steps` has `created_at` but no `updated_at`. Since steps use upsert, `created_at` shows the first creation — there is no record of when a step was last regenerated.

**File:** Create `migrations/0022_project_steps_updated_at.sql`

- [ ] **Step 9.1 — Write the migration**

```sql
-- Migration: 0022_project_steps_updated_at.sql
-- Adds updated_at column to project_steps so upserts are auditable.

ALTER TABLE public.project_steps
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now() NOT NULL;

-- Backfill existing rows to match created_at
UPDATE public.project_steps
  SET updated_at = created_at
  WHERE updated_at IS DISTINCT FROM created_at;

-- Trigger to auto-update updated_at on every UPDATE
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_project_steps_updated_at ON public.project_steps;
CREATE TRIGGER trg_project_steps_updated_at
  BEFORE UPDATE ON public.project_steps
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();
```

- [ ] **Step 9.2 — Apply in Supabase SQL Editor**

Run the migration. Verify:
```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'project_steps' AND column_name = 'updated_at';
```
Expected: one row with `data_type = 'timestamp with time zone'`.

- [ ] **Step 9.3 — Update TypeScript type in `db.ts`**

In `src/lib/db.ts`, add `updated_at` to the `ProjectStep` interface:

```ts
export interface ProjectStep {
  id: string
  project_id: string
  user_id: string
  step_type: string
  result_json: Record<string, unknown>
  input_summary: string | null
  created_at: string
  updated_at: string   // ← add this
}
```

- [ ] **Step 9.4 — Commit**

```
git add migrations/0022_project_steps_updated_at.sql src/lib/db.ts
git commit -m "db: add updated_at to project_steps with auto-update trigger"
```

---

### Task 10: Narrow `select('*')` queries in `db.ts`

**Issue:** `getAllUserProjects()` and `loadUserState()` use `select('*')`. For `getAllUserProjects`, this returns `result_json` for every step of every project on the Dashboard page load, even though only metadata is needed.

**File:** Modify `src/lib/db.ts`

- [ ] **Step 10.1 — Narrow `getAllUserProjects`**

In `src/lib/db.ts` line ~197, change:

```ts
// Before:
const { data, error } = await supabase
  .from('projects')
  .select('*')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })

// After:
const { data, error } = await supabase
  .from('projects')
  .select('id, title, status, current_step, faculty, department, level, created_at, updated_at')
  .eq('user_id', userId)
  .order('created_at', { ascending: false })
```

- [ ] **Step 10.2 — Narrow `loadUserState` profile select**

In `loadUserState()` (line ~78), the profile select is already reasonable (`select('*')` on `users` is needed for the full profile). Leave it as-is — the profile is small and fully used.

Narrow the `project_steps` select to exclude nothing (steps need result_json for hydration — leave as `select('*')`). The per-step upsert limit means max ~10 rows per project, each typically a few KB. Fine.

- [ ] **Step 10.3 — Verify Dashboard load**

Open the Dashboard with 3+ projects. Confirm in Supabase logs that the `projects` query no longer returns `result_json` columns. Confirm all project cards display their title, status, and step correctly.

- [ ] **Step 10.4 — Commit**

```
git add src/lib/db.ts
git commit -m "perf: narrow getAllUserProjects select to metadata columns only"
```

---

## Phase 5: API Code Health

### Task 11: Move `sync-run-counts` action from `ai.js` to `admin.js`

**Issue:** `handleSyncRunCounts` in `api/ai.js` has nothing to do with AI — it's a data mutation for `user_entitlements.run_counts`. Its presence in the AI proxy is confusing and adds to ai.js's already large surface.

**Plan:** Add the handler to `api/admin.js` under a new action. Update the client URL in `useRunLimit.js`. Keep the old action in `ai.js` returning a `301 Gone` for 30 days to handle any cached client requests.

**Files:**
- Modify `api/admin.js`
- Modify `api/ai.js`
- Modify `src/hooks/useRunLimit.js`

- [ ] **Step 11.1 — Add `handleSyncRunCounts` to `api/admin.js`**

In `api/admin.js`, add the handler before the main `handler` export. Copy the function body verbatim from `api/ai.js` lines 425–485:

```js
// ─── action: sync-run-counts ──────────────────────────────────────────────────
// Moved from api/ai.js — belongs in admin/entitlements surface, not the AI proxy.

async function handleSyncRunCounts(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  let user;
  try {
    const { data, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !data?.user) return res.status(401).json({ error: 'Invalid or expired authentication token.' });
    user = data.user;
  } catch (authErr) {
    console.error('[admin/sync-run-counts] auth.getUser threw:', authErr.message);
    return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
  }

  const { run_counts } = req.body || {};
  if (!run_counts || typeof run_counts !== 'object' || Array.isArray(run_counts)) {
    return res.status(400).json({ error: 'run_counts must be a plain object.' });
  }

  try {
    const { data: existing } = await supabaseAdmin
      .from('user_entitlements')
      .select('run_counts')
      .eq('user_id', user.id)
      .maybeSingle();

    const serverCounts = (existing?.run_counts && typeof existing.run_counts === 'object')
      ? existing.run_counts
      : {};

    const merged = { ...serverCounts };
    for (const k of Object.keys(run_counts)) {
      if (k === '_reset_at') { merged[k] = run_counts[k]; continue; }
      const clientVal = typeof run_counts[k] === 'number' ? run_counts[k] : 0;
      const serverVal = typeof serverCounts[k] === 'number' ? serverCounts[k] : 0;
      merged[k] = Math.max(clientVal, serverVal);
    }

    const { error } = await supabaseAdmin
      .from('user_entitlements')
      .upsert(
        { user_id: user.id, run_counts: merged, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .select('user_id');

    if (error) {
      console.error('[admin/sync-run-counts] upsert error:', error.message);
      return res.status(500).json({ error: 'Failed to sync run counts.' });
    }

    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/sync-run-counts] error:', err.message);
    return res.status(500).json({ error: 'Unexpected error syncing run counts.' });
  }
}
```

In the `admin.js` main handler router, add before the `return res.status(400).json(...)` fallback:

```js
if (action === 'sync-run-counts') {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  return handleSyncRunCounts(req, res);
}
```

- [ ] **Step 11.2 — Update client URL in `useRunLimit.js`**

In `src/hooks/useRunLimit.js` (line 117):

```js
// Before:
const res = await fetch('/api/ai?action=sync-run-counts', {

// After:
const res = await fetch('/api/admin?action=sync-run-counts', {
```

- [ ] **Step 11.3 — Replace old `handleSyncRunCounts` in `ai.js` with a 410 stub**

In `api/ai.js`, replace the entire `handleSyncRunCounts` function body (lines 425–485) with:

```js
// Moved to /api/admin?action=sync-run-counts — kept as 410 stub for 30 days
// to handle any stale client code. Remove after 2026-06-27.
async function handleSyncRunCounts(req, res) {
  return res.status(410).json({
    error: 'This action has moved. Use /api/admin?action=sync-run-counts instead.',
  });
}
```

- [ ] **Step 11.4 — Verify**

1. Sign in and complete a topic-validator run
2. In Network tab, confirm `POST /api/admin?action=sync-run-counts` returns 200 `{"ok":true}`
3. Confirm no call is made to `/api/ai?action=sync-run-counts`

- [ ] **Step 11.5 — Commit**

```
git add api/admin.js api/ai.js src/hooks/useRunLimit.js
git commit -m "refactor: move sync-run-counts from /api/ai to /api/admin"
```

---

### Task 12: Extract shared Anthropic call boilerplate into `_lib/anthropic-proxy.js`

**Issue:** `handleGeneral`, `handleDefense`, and `handleSupervisorPrep` each contain near-identical blocks: auth check → rate limit → daily cap → Anthropic fetch → `response_times` insert → error handling. Approximately 70% of each function is copy-pasted.

**Plan:** Extract a `callAnthropic({ req, token, model, max_tokens, system, messages, feature, signal })` utility that handles the Anthropic HTTP call, token tracking, and `response_times` insert. Each handler keeps only its own pre-call logic (auth, rate limit, entitlements, cache, input validation).

**File:** Create `api/_lib/anthropic-proxy.js`

- [ ] **Step 12.1 — Create `api/_lib/anthropic-proxy.js`**

```js
// Shared Anthropic API call utility.
// Handles: API key check, HTTP call, token tracking, response_times insert, timeout error handling.
// Does NOT handle: auth, rate limiting, caching, entitlement checks — those belong in callers.

import { supabaseAdmin }  from './supabase-admin.js';
import { trackUsage }     from './usage-tracker.js';
import { sendTelegramAlert } from './telegram.js';

const ANTHROPIC_API_URL     = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION     = '2023-06-01';
const DEFAULT_TIMEOUT_MS    = 50000;

/**
 * Makes an authenticated call to the Anthropic Messages API.
 * Inserts a row into response_times on success. Sends a Telegram alert on failure.
 *
 * @param {object} options
 * @param {string}   options.feature      - Label for response_times and logs (e.g. 'topic-validator')
 * @param {string}   options.userId       - Verified Supabase user ID for response_times
 * @param {string}   options.model        - Anthropic model ID (already validated by caller)
 * @param {number}   options.max_tokens   - Already capped by caller
 * @param {string}   options.system       - Resolved system prompt
 * @param {Array}    options.messages     - Message array
 * @param {number}   [options.temperature=0]
 * @returns {Promise<{ res: Response, data: object, durationMs: number }>}
 */
export async function callAnthropic({
  feature,
  userId,
  model,
  max_tokens,
  system,
  messages,
  temperature = 0,
}) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw Object.assign(new Error('ANTHROPIC_API_KEY is not set'), { isConfig: true });

  const start    = Date.now();
  const response = await fetch(ANTHROPIC_API_URL, {
    method:  'POST',
    headers: {
      'Content-Type':      'application/json',
      'x-api-key':         apiKey,
      'anthropic-version': ANTHROPIC_VERSION,
      'anthropic-beta':    'pdfs-2024-09-25',
    },
    body:   JSON.stringify({ model, max_tokens, system, messages, temperature }),
    signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
  });

  const data       = await response.json();
  const durationMs = Date.now() - start;

  if (data.usage) {
    await trackUsage(data.usage.input_tokens, data.usage.output_tokens, model);
  }

  if (response.ok) {
    const insertPromise  = supabaseAdmin
      .from('response_times')
      .insert({ feature, duration_ms: durationMs, user_id: userId });
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
    await Promise.race([insertPromise, timeoutPromise]).catch(err =>
      console.error(`[anthropic-proxy] response_times insert failed (${feature}):`, err?.message)
    );
  } else if (response.status >= 500) {
    sendTelegramAlert(`🔴 Anthropic ${response.status}: ${feature} for user:${userId.slice(0, 8)}`);
  }

  return { response, data, durationMs };
}
```

- [ ] **Step 12.2 — Refactor `handleGeneral` to use `callAnthropic`**

In `api/ai.js`, in `handleGeneral`, replace the try/catch block that contains the `fetch('https://api.anthropic.com/...')` call (lines ~130–174) with:

```js
try {
  const { response, data } = await callAnthropic({
    feature:    step,
    userId:     user.id,
    model,
    max_tokens,
    system,
    messages,
  });

  // Increment server-side run count (fire-and-forget — see Phase 2 Task 4)
  if (response.ok && !isPaid && SERVER_FREE_LIMITS[step] !== undefined) {
    const dbKey = step.replace(/-/g, '_');
    const existingCounts = (entData?.run_counts && typeof entData.run_counts === 'object')
      ? entData.run_counts : {};
    const newCount = (typeof existingCounts[dbKey] === 'number' ? existingCounts[dbKey] : 0) + 1;
    supabaseAdmin
      .from('user_entitlements')
      .upsert(
        { user_id: user.id, run_counts: { ...existingCounts, [dbKey]: newCount }, updated_at: new Date().toISOString() },
        { onConflict: 'user_id' }
      )
      .catch(err => console.error('[ai/general] run count increment failed:', err?.message));
  }

  if (response.ok) setCached(cacheKey, data, ttl);
  res.setHeader('X-Cache', 'MISS');
  return res.status(response.status).json(data);
} catch (err) {
  const userId = extractUserId(req) || 'anonymous';
  if (err.name === 'TimeoutError' || err.name === 'AbortError') {
    console.error('[ai/general] Anthropic request timed out after 50s');
    await sendTelegramAlert(`⏱️ Generation timed out: ${step} for ${userId}`);
    return res.status(504).json({ error: 'Request timed out. Please try again.' });
  }
  if (err.isConfig) {
    console.error('[ai/general] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured on server.' });
  }
  console.error('[ai/general] error:', err.message);
  await sendTelegramAlert(`🔴 Generation failed: ${step} for ${userId} - ${err.message}`);
  return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
}
```

Add the import at the top of `api/ai.js`:
```js
import { callAnthropic } from './_lib/anthropic-proxy.js';
```

- [ ] **Step 12.3 — Refactor `handleDefense` to use `callAnthropic`**

Replace the Anthropic fetch block in `handleDefense` (lines ~260–298) with:

```js
try {
  const { response, data } = await callAnthropic({
    feature:    'defense-simulator',
    userId:     user.id,
    model,
    max_tokens,
    system,
    messages,
  });
  console.log('[ai/defense] Anthropic status:', response.status);
  return res.status(response.status).json(data);
} catch (err) {
  console.error('[ai/defense] error:', err.message);
  await Promise.all([
    sendTelegramAlert(`🔴 Generation failed: defense-simulator for user:${user.id.slice(0, 8)} - ${err.message}`),
    writeSystemLog({
      severity:      'error',
      feature:       'Defense Simulator',
      source:        'ai',
      plain_message: 'A defense session failed — the AI did not respond in time or hit the token limit',
      raw_detail:    { error: err.message, userId: user.id },
    }),
  ]);
  return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
}
```

- [ ] **Step 12.4 — Verify all three step types still work**

Run through topic-validator, defense simulator, and supervisor-prep in the UI. Confirm no regressions. Check Supabase `response_times` table shows new rows with correct `duration_ms` values (not 0).

- [ ] **Step 12.5 — Commit**

```
git add api/_lib/anthropic-proxy.js api/ai.js
git commit -m "refactor: extract shared Anthropic call utility into _lib/anthropic-proxy.js"
```

---

## Phase 6: TypeScript Tightening

### Task 13: Enable `noImplicitAny` and `strictNullChecks`

**Issue:** `tsconfig.json` has `strict: false`. This disables `noImplicitAny` (untyped variables silently become `any`) and `strictNullChecks` (null/undefined can be assigned anywhere). Bugs that TypeScript would catch reach runtime.

**Approach:** Enable the two most impactful options individually rather than flipping `strict: true` all at once (which also enables strict function types, strict bind/call/apply, etc. and will produce dozens of errors). Fix each resulting error. This is safe to do incrementally.

**File:** Modify `tsconfig.json`; fix any resulting TypeScript errors in `.ts`/`.tsx` files.

- [ ] **Step 13.1 — Enable `noImplicitAny` and check errors**

In `tsconfig.json`, change:

```json
// Before:
"strict": false,

// After:
"strict": false,
"noImplicitAny": true,
"strictNullChecks": true,
```

Run the type checker:

```
npm run typecheck
```

Note every error. Common patterns and their fixes:
- `Parameter 'x' implicitly has an 'any' type` → add explicit type annotation
- `Object is possibly 'null'` → add optional chaining (`?.`) or null guard
- `Type 'string | null' is not assignable to type 'string'` → add `?? ''` fallback or narrow with `if`

- [ ] **Step 13.2 — Fix errors in `src/lib/` first (smallest surface)**

Work through errors in `src/lib/` files (db.ts, feedback.ts, progress.ts, sync-queue.ts, etc.) first since they're already `.ts` files and the types are already partially defined.

Common fix for `null` returns from Supabase:

```ts
// Pattern: const { data } = await supabase.from(...).select(...).single()
// data is T | null when using maybeSingle, T when using single
// Fix: add null guard
const { data } = await supabase.from('users').select('*').eq('id', userId).single()
if (!data) return  // narrow to non-null
```

- [ ] **Step 13.3 — Fix errors in `src/hooks/` next**

Focus on `useProjectState.ts` (already `.ts`) and `useRunLimit.js` (`.js` — add `@ts-check` at the top or convert to `.ts`).

For `.js` files, you can add JSDoc types to satisfy `noImplicitAny` without converting to `.ts`:

```js
/**
 * @param {string} stepKey
 * @param {string[]} features
 * @returns {number | null}
 */
export function resolveLimit(stepKey, features) { ... }
```

- [ ] **Step 13.4 — Fix errors in `src/context/`**

`AppContext.jsx` and `ThemeContext.jsx` are `.jsx` (no TypeScript enforcement even with these flags — only `.ts`/`.tsx` files are type-checked). No changes needed.

`AuthContext.tsx` is already typed. Run `npm run typecheck` after each change to confirm error count decreases.

- [ ] **Step 13.5 — Confirm zero typecheck errors**

```
npm run typecheck
```

Expected output: no errors, exit code 0.

- [ ] **Step 13.6 — Commit**

```
git add tsconfig.json src/lib/ src/hooks/
git commit -m "chore: enable noImplicitAny + strictNullChecks, fix resulting type errors"
```

---

## Phase 7: V3 Deferred Work (No Implementation Tasks)

These items are documented here for planning purposes. Do not implement during this sprint.

### 7.1 — Consolidate AppContext and ProjectStateProvider

**What:** Both manage adjacent project state and both call `set()` on AppContext. The current split means ProjectStateProvider reaches upward into AppContext to update state, which reverses the usual data-flow direction (parent feeds children). A unified provider with a single Supabase load path would eliminate this.

**Why deferred:** Touching both providers simultaneously risks regressions across the entire auth/onboarding flow. Phase 3 Task 5 already removes the duplicate fetch and makes the data flow cleaner without the full merge.

**When to tackle:** After Phase 3 is stable in production for ≥2 weeks.

### 7.2 — Remove vestigial database columns

Three columns are defined in TypeScript types but never written to in any code path:
- `user_entitlements.paid_until` — planned subscription model, never implemented
- `projects.supervisor_id` — future supervisor linking feature
- `projects.institution_id` — future multi-institution support

**Why deferred:** Dropping columns from a live production table requires a migration with a maintenance window or careful rolling deploy. The columns cause no harm in the short term.

**Migration template (for when ready):**
```sql
-- Run after confirming no code references these columns
ALTER TABLE public.user_entitlements DROP COLUMN IF EXISTS paid_until;
ALTER TABLE public.projects           DROP COLUMN IF EXISTS supervisor_id;
ALTER TABLE public.projects           DROP COLUMN IF EXISTS institution_id;
```

### 7.3 — Full atomic server-side run count enforcement

**What:** Phase 2 Task 4 adds a server-side check using the `run_counts` read from the entitlements row at request time. The increment is eventually consistent (fire-and-forget upsert). Under concurrent requests, two calls could both pass the check if they read the same count before either write lands.

**Full fix:** Create a PostgreSQL function `check_and_increment_run_count(user_id, step_key, limit)` that does an atomic read-modify-write in a single transaction. Call it via Supabase RPC instead of the separate select + upsert.

**Why deferred:** Requires a non-trivial migration and RPC function. The eventual-consistent approach from Phase 2 is sufficient for the free tier use case where the limit is 3 runs — a race condition would allow at most 1 extra run.

### 7.4 — Reconcile `user_progress` and `stepsCompleted`

**What:** Two separate representations of "which steps are done" — `AppContext.state.stepsCompleted` (array, derived from project_steps on load) and `Supabase.user_progress` (timestamp columns). These should stay in sync but diverge risk exists.

**Full fix:** Remove `user_progress` table entirely. Derive progress timestamps from `project_steps.created_at` where the step_type exists. Or: keep `user_progress` but remove `stepsCompleted` from AppContext and derive it from `user_progress` instead.

---

## Completion Order Summary

| Priority | Task | Estimated Time |
|---|---|---|
| 🔴 Critical | Task 1: forceSignOut + signingOut | 30 min |
| 🔴 Critical | Task 2: defense .maybeSingle | 10 min |
| 🔴 Critical | Task 3: payments 404 | 5 min |
| 🔴 Security | Task 4: server-side run limits | 90 min |
| 🟡 Performance | Task 5: double profile fetch | 60 min |
| 🟡 Performance | Task 6: merge updateProject calls | 10 min |
| 🟡 Performance | Task 7: cache-hit inserts + receipt email | 20 min |
| 🟢 DB | Task 8: composite index | 10 min |
| 🟢 DB | Task 9: updated_at on project_steps | 15 min |
| 🟢 DB | Task 10: narrow select columns | 15 min |
| 🔵 Refactor | Task 11: move sync-run-counts | 30 min |
| 🔵 Refactor | Task 12: extract Anthropic utility | 45 min |
| 🔵 Types | Task 13: TypeScript strict | 60–120 min |
