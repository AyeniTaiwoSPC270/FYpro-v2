# FYPro v2 — localStorage → Supabase Migration Plan

**Date:** Thu May 14
**Companion files Sonnet must read:** `CLAUDE.md`, `architecture-decisions.md`, `security-policies.md`.

---

## TL;DR — The Three Rules

1. **No write goes to Supabase without going through the auth-scoped client.** Every read and write uses `supabase.auth` session token. Service_role never touches frontend code, ever.
2. **localStorage stops being the source of truth and becomes an offline cache.** Supabase is canonical. localStorage mirrors what Supabase has, plus a queue of writes that haven't synced yet.
3. **Every step output is one row in `project_steps`.** Topic Validator, Chapter Architect, Methodology Advisor, Writing Planner, Literature Map, Abstract Generator, Instrument Builder — each writes one row keyed by `step_type`.

---

## 1. Read Pattern (App Load + Step Navigation)

### When the user logs in / app loads

```
1. Supabase auth restores session from cookie
2. Fetch user profile:        SELECT * FROM users WHERE id = auth.uid()  ← RLS scoped
3. Fetch entitlements:        SELECT * FROM user_entitlements WHERE user_id = auth.uid()  ← RLS scoped
4. Fetch active project:      SELECT * FROM projects WHERE user_id = auth.uid() ORDER BY updated_at DESC LIMIT 1
5. Fetch all step results for that project:
                              SELECT * FROM project_steps WHERE project_id = <active.id>  ← RLS scoped
6. Hydrate React state from query results
7. Mirror to localStorage (offline cache only)
```

**Key point:** the client never says `WHERE user_id = '...'`. RLS does that automatically. If you ever see Sonnet writing `.eq('user_id', someId)` in a query, that's a code smell — RLS already handles it. Filtering by user_id client-side is defence-in-depth at best, redundancy at worst.

### When the user navigates to a step

```
1. Read from React state (hydrated at app load)
2. If state empty for that step → show "No data yet, complete the step"
3. If offline → read from localStorage cache, show "Offline mode" indicator
```

No fresh DB query per step navigation. State is loaded once, on app load.

### When the user opens a different project (v3-relevant, build the hook now)

```
1. Update active_project_id in localStorage (UI state, not auth state)
2. Re-fetch project_steps for that project_id
3. Re-hydrate React state
```

---

## 2. Write Pattern (After Each Step Completes)

### Pattern: Atomic upsert per step

When Topic Validator returns a result, the flow is:

```
1. Receive Claude's response in /api/topic-validator (Vercel function)
2. Function returns to client
3. Client calls supabase.from('project_steps').upsert({
     project_id,
     user_id: session.user.id,
     step_type: 'topic_validator',
     result_json: <claude response>,
     input_summary: <what student typed>
   }, { onConflict: 'project_id,step_type' })
4. On success → update React state, mirror to localStorage
5. On failure → keep React state, queue to localStorage retry queue, show toast
```

**Why upsert + `onConflict`:** if the user re-runs Topic Validator on the same project, you overwrite the old result rather than creating duplicates. This requires a unique constraint on `(project_id, step_type)` — add this to the schema:

```sql
ALTER TABLE public.project_steps
  ADD CONSTRAINT project_steps_unique_per_step
  UNIQUE (project_id, step_type);
```

Add this to `architecture-decisions.md` Section 2.5 and have Sonnet run it before starting the migration.

**Exception — Defense Simulator turns:** these are NOT upsert. Each turn is a new row in `defense_turns`. The session itself is one row in `defense_sessions`, updated with `total_score` and `status='completed'` when the session ends.

### When the project itself updates (title, current_step, status)

```
supabase.from('projects').update({
  title: validated_topic,
  current_step: 'chapter_architect',
  updated_at: new Date()
}).eq('id', project_id)
```

RLS handles ownership. The `.eq('id', project_id)` is just selecting which row to update — RLS ensures it has to be the user's own project.

### Critical: Project creation

A new project is created when:
- A logged-in user with no projects opens `/app` → auto-create one
- A user clicks "Start a new project" (paid feature: Project Reset)

```
supabase.from('projects').insert({
  user_id: session.user.id,        // RLS WITH CHECK enforces this matches auth.uid()
  status: 'draft',
  current_step: 'topic_validator',
  faculty: <from onboarding>,
  department: <from onboarding>,
  level: <from onboarding>
}).select().single()
```

`supervisor_id` and `institution_id` are NOT set by client (RLS WITH CHECK blocks both, per `security-policies.md` Step 5).

---

## 3. Anonymous localStorage Migration

**Recommendation: prompt them, default to start fresh.**

Reasoning: anonymous localStorage data on first signup is messy. Users explore the free tier, generate three half-finished topic validations across abandoned sessions, then sign up. Importing all of that creates a confusing dashboard. Cleaner to ask.

### The flow

When a user completes signup AND `localStorage.getItem('fypro_anonymous_state')` returns non-null data:

```
Show modal:
  "We noticed you were working on something before signing up.
  Want to bring it into your account?"

  [ Bring it over ]   [ Start fresh ]   ← default highlighted
```

### If "Bring it over"

```
1. Parse anonymous state
2. Validate shape (use a Zod schema or hand-rolled validator — anonymous storage can be corrupted)
3. Create project: supabase.from('projects').insert(...)
4. For each step result in anonymous state:
   - Validate against expected JSON shape for that step_type
   - Upsert to project_steps with the new project_id
5. Clear anonymous localStorage
6. Reload state from Supabase (don't trust the migrated copy in memory)
```

### If "Start fresh"

```
1. localStorage.removeItem('fypro_anonymous_state')
2. Create empty project
3. Drop user into onboarding → Topic Validator
```

### Edge cases

- Anonymous data is malformed JSON → silently fall through to "Start fresh", log to Sentry as a warn-level event.
- Anonymous data has a step result for a step type the schema doesn't know about → skip that step, import the others.
- User clicks "Bring it over" but the migration fails partway (network drop after creating project, before importing all steps) → the project exists but is incomplete. The next app load will show whatever made it through. Not ideal but not catastrophic. Don't add transactional guarantees here — too much complexity for an edge case.

---

## 4. Offline Fallback

### Strategy

localStorage stays as a **read cache + write queue**, never as the source of truth.

### Offline detection

```
Listen on window 'online' / 'offline' events
+ ping a lightweight Supabase endpoint every 30s when active

State machine:
  ONLINE → all reads and writes go through Supabase
  OFFLINE → reads from localStorage, writes go to localStorage write queue
  RECONNECTING → drain the write queue, then resume normal mode
```

### The write queue

```javascript
// In src/lib/sync-queue.ts
{
  pending_writes: [
    { id: <uuid>, table: 'project_steps', op: 'upsert', payload: {...}, queued_at: <iso> },
    ...
  ]
}
```

When connectivity returns:
```
1. Show "Syncing..." indicator
2. Drain queue in order (FIFO)
3. For each write, attempt Supabase call
4. On success, remove from queue
5. On failure (e.g. RLS rejection because session expired) → prompt user to re-login, do NOT silently drop
6. On all-clear, show "Synced" indicator briefly, then dismiss
```

### Conflict on drain

If user wrote to step X offline, and another tab/device wrote to step X online, the queued write will overwrite the online write (last-write-wins). For v2 this is fine — most users have one device. v3 may need real conflict resolution. Note this as a v3 backlog item.

### Offline indicator

A subtle banner: "You're offline. Changes will sync when you reconnect." Do NOT block the UI. Users in Nigerian universities lose connectivity routinely — the product must keep working.

---

## 5. Edge Cases (Explicit Handling)

### Two tabs editing the same project

Last-write-wins. Acceptable for v2. Both tabs subscribe to `projects` realtime updates so the UI refreshes when the other tab writes — but no merge logic. If tabs disagree, the most recent write wins.

```javascript
// In useProjectState hook
useEffect(() => {
  const channel = supabase.channel(`project_${projectId}`)
    .on('postgres_changes', {
      event: 'UPDATE',
      schema: 'public',
      table: 'project_steps',
      filter: `project_id=eq.${projectId}`
    }, (payload) => {
      // Refresh local state with the new row
    })
    .subscribe()
  return () => supabase.removeChannel(channel)
}, [projectId])
```

Realtime is RLS-aware — the channel will only deliver rows the user is authorised to see.

### Network drop mid-save

Retry policy:
```
attempt 1 → fail → wait 1s → attempt 2 → fail → wait 3s → attempt 3 → fail → queue for offline drain
```

Show toast on attempt 1 fail: "Saving... retrying". On final fail: "Saved locally — will sync when reconnected".

### Supabase rate limit hit (429 response)

```
1. Show toast: "We're saving more often than usual. Hold on a moment."
2. Exponential backoff: wait 5s, 15s, 30s before retry
3. After 3 backoffs → queue for offline drain
4. Log to Sentry (rate limit = signal that you may need a plan upgrade)
```

This is unlikely to hit free tier in v2 unless something is in a tight loop. If you see it in production, look for the loop.

### Session expired mid-session

User is in Defense Simulator. Token expires. Next save returns 401.

```
1. Catch 401 from any Supabase call
2. Attempt silent token refresh: supabase.auth.refreshSession()
3. If refresh succeeds, retry the original call
4. If refresh fails, show modal: "Your session expired. Please log in again."
   Save current state to localStorage before redirecting to /login
   On re-login, restore from localStorage if it's newer than DB
```

### User signs up while a paid feature is mid-call

Edge case but possible: user starts Defense Simulator on free tier (somehow), Vercel function rejects with 403, but the UI is open. Don't write half-states to DB. The `defense_sessions` row is only INSERTed by the Vercel function AFTER it confirms entitlement via service_role check.

---

## 6. Security Verification — Every Operation Goes Through RLS

### The RLS coverage table

Every operation the app performs, mapped to the policy that protects it. If any row has a "?" — that's a security gap.

| Operation | Table | RLS Policy (from `security-policies.md`) |
|---|---|---|
| Read own profile | `users` | "users select own" (Step 3) |
| Update own profile (name, faculty, dept) | `users` | "users update own profile" (Step 3) — `WITH CHECK` blocks role/institution flips |
| Read own entitlements | `user_entitlements` | "entitlements select own" (Step 4) |
| Read own projects | `projects` | "projects select own" (Step 5) |
| Create new project | `projects` | "projects insert own" (Step 5) — forces `supervisor_id` and `institution_id` to NULL |
| Update project title / current_step | `projects` | "projects update own" (Step 5) — `WITH CHECK` blocks ownership transfer |
| Delete project (Project Reset) | `projects` | "projects delete own" (Step 5) |
| Read step results | `project_steps` | "project_steps select own" (Step 6) |
| Save step result (upsert) | `project_steps` | "project_steps insert own" + "project_steps update own" (Step 6) |
| Read defense session | `defense_sessions` | "defense_sessions select own" (Step 7) |
| Create defense session | `defense_sessions` | INSERT happens **server-side** in Vercel function with service_role, after entitlement check. NOT a client write. |
| Save defense turn | `defense_turns` | INSERT happens **server-side** in Vercel function during the simulator API call. NOT a client write. |
| Read payment history | `payments` | "payments select own" (Step 8) |

### Two operations are server-side only — Sonnet must NOT make these client writes

**Defense session creation and turn saves go through `/api/defense-simulator/*` Vercel functions.** Reasons:
1. Entitlement check (`paid_features` contains `defense_pack`) requires reading `user_entitlements` — which the client *can* read but shouldn't be the trust boundary for paywall.
2. The Vercel function calls Claude API and writes the result. Splitting that into "function calls Claude, returns to client, client writes to DB" creates a window where the client can write fake turns. Don't do it.

So the client makes `POST /api/defense-simulator/turn` with the user's answer. The function:
1. Verifies the JWT (Supabase has helpers for this)
2. Fetches entitlements with service_role
3. Confirms paid access
4. Calls Claude
5. Inserts the turn into `defense_turns` with service_role
6. Returns the examiner's next question to the client

Client only ever reads `defense_turns` directly via RLS. Never writes.

### The verification test (Sonnet runs after every refactor)

```javascript
// Save as scripts/verify-rls-after-refactor.js
// Run: node scripts/verify-rls-after-refactor.js
// Run after any DB-touching change. Zero output = all good.
// The scripts/ folder lives at repo root — NOT inside src/, NOT deployed to Vercel.

import { createClient } from '@supabase/supabase-js'

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const noAuth = createClient(url, anonKey)  // no session

const tables = ['users', 'user_entitlements', 'projects', 'project_steps',
                'defense_sessions', 'defense_turns', 'payments']

for (const t of tables) {
  const { data, error } = await noAuth.from(t).select('*').limit(1)
  if (data && data.length > 0) {
    console.error(`SECURITY FAIL: anonymous client can read ${t}`)
    process.exit(1)
  }
  console.log(`OK ${t}: anonymous read blocked`)
}
console.log('All tables RLS-protected against anonymous access.')
```

Sonnet runs this after every DB-touching commit. If it fails, the policy is broken — fix the policy, never patch around it with service_role.

---

## 7. The Refactor Order (For Sonnet)

Big refactor. Wrong order = broken app for hours. Do it like this:

1. **Add the `(project_id, step_type)` unique constraint to `project_steps`.** Without it, upserts won't work.
2. **Build `src/lib/supabase-client.ts`** — wraps the auth-scoped client, exports typed helpers: `loadUserState()`, `saveStep()`, `createProject()`, `updateProject()`. All other code calls these helpers, never the raw client.
3. **Build `src/lib/sync-queue.ts`** — write queue, drain logic, online/offline detection.
4. **Build `src/hooks/useProjectState.ts`** — single source of truth React hook. Loads state on mount, exposes `state`, `saveStep`, `setCurrentStep`. Internally chooses Supabase or localStorage based on online status.
5. **Refactor one component at a time** — start with Topic Validator (simplest single step). Replace its localStorage calls with `useProjectState`. Verify it works for a logged-in user. Verify the RLS test fails for an anonymous user.
6. **Repeat for Chapter Architect, Methodology Advisor, Writing Planner, Literature Map, Abstract Generator, Instrument Builder.**
7. **Defense Simulator stays partially client-side for state** but writes go through `/api/defense-simulator/*`.
8. **Add the anonymous→authed migration modal.**
9. **Run the full RLS verification script.**
10. **Manual test: log in, complete a step, refresh, see step result. Log out, log back in, see step result. Open in two tabs, edit one, watch the other update.**

---

## 8. Files Sonnet Will Create or Modify

**New files:**
- `src/lib/supabase-client.ts` — auth-scoped client + typed helpers
- `src/lib/sync-queue.ts` — offline write queue
- `src/hooks/useProjectState.ts` — single source of truth hook
- `src/components/AnonymousMigrationModal.tsx` — the "bring it over / start fresh" modal
- `src/components/OfflineBanner.tsx` — the offline indicator
- `scripts/verify-rls-after-refactor.js` — security regression test
- `migrations/0002_unique_step_constraint.sql` — the unique constraint

**Modified files (every component currently using localStorage):**
- All workflow step components in `src/app/[step-name]`
- The dashboard
- The onboarding flow (writes profile fields to `users` table at completion)

**Untouched (deliberately):**
- Defense Simulator client UI (server-side writes already planned for week 4–6)
- Payment flow (week 4)
- Anything in `src/pages/auth/*` (already wired in days 16–18)

---

## 9. What "Done" Looks Like

The Day 19 done state:
- A logged-in user can complete a step, refresh the page, and see the result.
- The same user logs in on a different device → state restored from Supabase.
- An anonymous user (logged out) cannot read any table. RLS verification script passes.
- Network dropped mid-save → toast appears, work saved locally, syncs on reconnect.
- Two tabs open, edit in tab A → tab B updates within seconds.
- Service_role key appears in zero frontend files. Grep verifies: `grep -rn "service_role\|SERVICE_ROLE" src/` returns zero matches.

If all six are true, you're ready for Day 20's penetration test.

---

## 10. The One Trap to Watch

If Sonnet at any point writes:

```javascript
const adminClient = createClient(url, SERVICE_ROLE_KEY)  // ← in src/
```

**Stop immediately.** That's the moment v2 becomes a data leak. Every problem can be solved with the right RLS policy. If you can't see how, the answer is to refine the policy or move that operation to a Vercel function — never to break out service_role on the client.

The role-flip protection in `security-policies.md` exists for a reason. The entitlements table being write-protected exists for a reason. Don't unwind those decisions because a query feels easier with service_role.

---

**Hand this doc to Sonnet along with `CLAUDE.md`, `architecture-decisions.md`, and `security-policies.md`.**

Sonnet has all four documents → it has full context → it can do the refactor without inventing schema, inventing policies, or quietly bypassing RLS.
