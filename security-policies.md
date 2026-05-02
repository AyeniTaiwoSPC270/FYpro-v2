# FYPro v2 — Security Policies

**Date:** Sun May 10
**Scope:** RLS policy migration SQL, `service_role` rules, testing protocol, common bugs.
**Companion:** `architecture-decisions.md` (schema + design rationale).

---

## How to Use This File

1. Run Section 1 (entire SQL block) in Supabase SQL Editor in order. Do not skip the `ENABLE ROW LEVEL SECURITY` lines.
2. Run the verification queries at the bottom of Section 1. They MUST return zero rows.
3. Read Sections 2–4 before writing any auth or DB code.
4. Day 20: run the penetration test in Section 5. Do not move past Day 20 with any test failing.

---

## 1. RLS Policy Migration SQL

Paste this entire block into Supabase SQL Editor in order.

### Step 1 — Enable RLS on every table

```sql
ALTER TABLE public.institutions          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_entitlements     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_steps         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defense_sessions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.defense_turns         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_usage           ENABLE ROW LEVEL SECURITY;
```

### Step 2 — `institutions` policies

```sql
-- v2: empty. v3: students need to read their institution name.
CREATE POLICY "institutions readable by authenticated"
  ON public.institutions FOR SELECT
  TO authenticated
  USING (true);

-- No INSERT/UPDATE/DELETE policy = service_role only.
```

### Step 3 — `users` policies (with role-flip protection)

```sql
-- Read your own row
CREATE POLICY "users select own"
  ON public.users FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = id);

-- v3 PREVIEW (commented out for v2; uncomment in v3 week 3):
-- CREATE POLICY "supervisors select their students"
--   ON public.users FOR SELECT
--   TO authenticated
--   USING (
--     (select auth.uid()) IN (
--       SELECT supervisor_id FROM public.projects WHERE user_id = users.id
--     )
--   );

-- Insert: a user may insert exactly their own row, exactly once.
-- The trigger in architecture-decisions.md auto-creates the row on signup,
-- so this policy is mostly a belt-and-braces second check.
CREATE POLICY "users insert self"
  ON public.users FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = id
    AND role = 'student'             -- can never self-elevate
    AND institution_id IS NULL       -- v2 users always start unaffiliated
  );

-- Update: own row, but cannot change role, institution_id, or id.
-- WITHOUT WITH CHECK this is the role-flip vulnerability.
CREATE POLICY "users update own profile"
  ON public.users FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = id)
  WITH CHECK (
    (select auth.uid()) = id
    AND role = (SELECT role FROM public.users WHERE id = (select auth.uid()))
    AND institution_id IS NOT DISTINCT FROM
        (SELECT institution_id FROM public.users WHERE id = (select auth.uid()))
  );

-- No DELETE policy. Account deletion goes through a service_role function.
```

**What could go wrong here?** The classic role-flip: user UPDATEs their own row and sets `role = 'admin'`. The `WITH CHECK` clause above blocks this by requiring the new `role` value equal the existing one. Same logic protects `institution_id` from being self-assigned in v3 (preventing a free-tier student from joining a paid institution's roster).

### Step 4 — `user_entitlements` policies (READ ONLY from client)

```sql
CREATE POLICY "entitlements select own"
  ON public.user_entitlements FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- NO INSERT, UPDATE, DELETE policies for `authenticated`.
-- Only the Paystack webhook (service_role) writes here.
```

**What could go wrong here?** Nothing — that's the point. No policy means denied. Even if a user discovers your service_role key (which they won't because it never touches the frontend), they'd have to compromise your Vercel env vars first.

### Step 5 — `projects` policies

```sql
CREATE POLICY "projects select own"
  ON public.projects FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "projects insert own"
  ON public.projects FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND supervisor_id IS NULL        -- v2: students can't self-assign supervisors
    AND institution_id IS NULL       -- v2: students can't self-claim institutional access
  );

CREATE POLICY "projects update own"
  ON public.projects FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK (
    (select auth.uid()) = user_id   -- cannot transfer ownership
  );

CREATE POLICY "projects delete own"
  ON public.projects FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
```

**What could go wrong here?** The `INSERT WITH CHECK` is the v2/v3 boundary. In v3 you'll add a separate policy for institutional auto-assignment via a server-side function. In v2, students cannot self-claim `institution_id` — preventing free-tier users from spoofing premium status if you ever gate features on `institution_id IS NOT NULL`.

### Step 6 — `project_steps` policies

```sql
CREATE POLICY "project_steps select own"
  ON public.project_steps FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

CREATE POLICY "project_steps insert own"
  ON public.project_steps FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND project_id IN (
      SELECT id FROM public.projects
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "project_steps update own"
  ON public.project_steps FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "project_steps delete own"
  ON public.project_steps FOR DELETE
  TO authenticated
  USING ((select auth.uid()) = user_id);
```

### Step 7 — `defense_sessions` and `defense_turns` policies

Defense is a paid feature — but the paywall is enforced at the Vercel function (which checks `user_entitlements` with service_role) BEFORE writing here. RLS just confirms ownership; it doesn't enforce the paywall.

```sql
CREATE POLICY "defense_sessions select own"
  ON public.defense_sessions FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "defense_sessions insert own"
  ON public.defense_sessions FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND project_id IN (
      SELECT id FROM public.projects
      WHERE user_id = (select auth.uid())
    )
  );

CREATE POLICY "defense_sessions update own"
  ON public.defense_sessions FOR UPDATE
  TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "defense_turns select own"
  ON public.defense_turns FOR SELECT
  TO authenticated USING ((select auth.uid()) = user_id);

CREATE POLICY "defense_turns insert own"
  ON public.defense_turns FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = user_id
    AND session_id IN (
      SELECT id FROM public.defense_sessions
      WHERE user_id = (select auth.uid())
    )
  );

-- No UPDATE/DELETE on defense_turns — turns are immutable history.
```

### Step 8 — `payments` policies

```sql
CREATE POLICY "payments select own"
  ON public.payments FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- No INSERT/UPDATE/DELETE for authenticated.
-- Paystack webhook (service_role) writes after HMAC verification.
```

### Step 9 — `daily_usage` policies

```sql
-- No client policies. Service_role only (via /api/claude serverless function).
-- Intentionally has no SELECT policy for authenticated users.
-- Admin dashboard reads this via service_role, never via the client SDK.
```

### Step 10 — Verification queries (must run before moving on)

```sql
-- Query A: Every table has RLS enabled. MUST return zero rows.
SELECT tablename
FROM pg_tables
WHERE schemaname='public' AND rowsecurity = false;

-- Query B: Every table that has RLS enabled also has at least one policy.
-- (RLS-on without policies = silently denied = app will break at runtime.)
-- MUST return zero rows.
-- Note: user_entitlements and payments intentionally have only SELECT policies —
-- this query still counts those and will correctly show them as having policies.
-- If you add a new table in v3, run this query immediately after enabling RLS.
SELECT t.tablename
FROM pg_tables t
LEFT JOIN pg_policies p
  ON p.tablename = t.tablename AND p.schemaname = 'public'
WHERE t.schemaname = 'public'
  AND t.rowsecurity = true
GROUP BY t.tablename
HAVING COUNT(p.policyname) = 0;
```

If Query A returns rows → those tables are publicly readable. Fix immediately.
If Query B returns rows → those tables silently deny everything. App will break.

---

## 2. The `service_role` Key — Where It Lives, Where It Dies

The `service_role` key bypasses ALL RLS. Treat it like a nuclear key.

### Where it MUST appear

- Vercel environment variable: `SUPABASE_SERVICE_ROLE_KEY` (note: NO `NEXT_PUBLIC_` prefix — that prefix exposes vars to the browser)
- Server-side code only: `/api/paystack-webhook.js`, `/api/admin/*` routes
- Used in: `createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` inside Vercel functions

### Where it MUST NEVER appear

- Frontend code (`src/`)
- Any file imported by a React component
- Any env var prefixed `NEXT_PUBLIC_` or `VITE_`
- GitHub repository (in any branch, ever)
- Browser console.log
- Sentry breadcrumbs (configure `beforeSend` to strip)

### The frontend gets exactly one key

```
NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...
```

The anon key is fine to expose — it has zero privileges except what RLS policies explicitly grant.

### Naming convention enforces safety

Always name the service_role env var WITHOUT the `NEXT_PUBLIC_` prefix. If anyone tries to import it into a client-side file, the build will silently substitute `undefined` (and the call will fail loudly), instead of bundling the real key into your JS.

---

## 3. How to Test RLS Properly

### The trap: SQL Editor lies

The Supabase dashboard SQL Editor runs as `service_role`. Every query bypasses RLS. If you test policies there, **everything will work**, and then your client SDK calls will silently fail or — worse — silently succeed when they shouldn't.

### The right way: client SDK, two real users

```javascript
// In a scratch test file:
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

// Sign in as User A
await supabase.auth.signInWithPassword({
  email: 'a@test.com',
  password: 'testpass123'
})

// Try to read all projects
const { data, error } = await supabase
  .from('projects')
  .select('*')

console.log('User A sees:', data?.length, 'projects')
// Should ONLY see User A's projects. If User B's appear, RLS is broken.

// Try the role-flip attack
const { error: flipError } = await supabase
  .from('users')
  .update({ role: 'admin' })
  .eq('id', userA.id)

console.log('Role flip:', flipError ? 'BLOCKED' : 'SUCCEEDED — POLICY BROKEN')
```

### The Supabase user impersonation feature

Dashboard → Authentication → Users → click any user → "Impersonate user". This generates a JWT for that user. Use it with the SQL Editor's "Run as user" option (look for the role selector at the top right of the SQL Editor — switch from `postgres` to `authenticated` and provide the user's JWT).

This lets you simulate exactly what a logged-in user sees, without leaving the dashboard. Use this every time you write or change a policy.

---

## 4. The 5 Things That Will Bite You

These are the specific failure modes most likely to happen on this schema:

1. **Forgetting `WITH CHECK` on UPDATE.** Causes role-flip and ownership-transfer attacks. Every UPDATE policy in this doc has `WITH CHECK`. Don't remove them when Sonnet "simplifies" later.
2. **Putting `paid_features` on the `users` table.** Defeats the entire entitlements separation. If you find yourself doing this, stop.
3. **Testing in SQL Editor.** It bypasses RLS. You will think your policies work. They won't.
4. **Adding a new table later without RLS.** Every new table in v3 needs the same `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` ritual. Run the verification query in Section 1 Step 9 weekly.
5. **A Vercel function importing the service_role key into a file that gets bundled to the client.** Use the `SUPABASE_SERVICE_ROLE_KEY` name (no `NEXT_PUBLIC_` prefix) so the build will fail rather than leak.

---

## 5. Day 20 RLS Penetration Test (Must-Pass List)

Before moving past Day 20, ALL of these tests must pass.

### Setup

1. Create User A via signup flow (real email, real password).
2. Create User B via signup flow (different email, different password).
3. As User A, create a project. Note the project ID.
4. As User B, create a project. Note the project ID.

### Tests

**Test 1 — Cross-user read isolation**
- Logged in as A, devtools fetch to `/rest/v1/projects` returns ONLY A's projects.
- Expected: User A sees 1 project (their own).
- Fail signal: User A sees 2 projects.

**Test 2 — Cross-user UPDATE block**
- As User A, attempt UPDATE on User B's project (by ID).
- Expected: error or zero rows updated.
- Fail signal: success / 1 row updated.

**Test 3 — Role-flip block**
- As User A, attempt UPDATE on own user row to set `role = 'admin'`.
- Expected: error.
- Fail signal: success.

**Test 4 — Institution-claim block**
- As User A, attempt UPDATE on own user row to set `institution_id = <any UUID>`.
- Expected: error.
- Fail signal: success.

**Test 5 — Entitlements write block**
- As User A, attempt UPDATE/INSERT/PATCH on `user_entitlements` to set `paid_features = ["defense_pack"]`.
- Expected: error (no policy = denied).
- Fail signal: success.

**Test 6 — Payments write block**
- As User A, attempt INSERT into `payments` with `status = 'success'`.
- Expected: error.
- Fail signal: success.

**Test 7 — Unauthenticated access**
- Without auth header, fetch any table.
- Expected: 401 or empty array.
- Fail signal: returns data.

**Test 8 — Direct users table query**
- As User A, query the users table without filter.
- Expected: returns only User A's row.
- Fail signal: returns User B's row (or all rows).

**Test 9 — Project-step ownership transfer block**
- As User A, INSERT a project_step with `project_id` set to User B's project ID and `user_id` set to A.
- Expected: error (project_id not in A's projects).
- Fail signal: success.

**Test 10 — Defense session creation paywall**
- As User A (with no paid_features), attempt to create a defense_session by calling the API endpoint directly.
- Expected: 403 from the Vercel function (paywall check).
- Fail signal: 200 / session created.

If ANY test fails, do NOT proceed to Day 21. Fix the failing policy. Re-run the entire test list.

---

## 6. Quick Reference: RLS Policy Patterns Used

### Pattern 1: Users own their own data

```sql
CREATE POLICY "users own data" ON projects FOR ALL TO authenticated
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id);
```

Both `USING` and `WITH CHECK` are required. `USING` controls what they can see/modify. `WITH CHECK` prevents them from changing `user_id` to someone else's.

### Pattern 2: Read own, no client writes

```sql
CREATE POLICY "select own" ON user_entitlements FOR SELECT TO authenticated
USING ((select auth.uid()) = user_id);

-- No other policies = INSERT/UPDATE/DELETE denied for client.
-- Service_role bypasses RLS, so server-side code can still write.
```

Use for: anything sensitive (entitlements, payments, audit logs).

### Pattern 3: Public read, service-role write

```sql
CREATE POLICY "public read" ON institutions FOR SELECT TO authenticated
USING (true);

-- No write policy = only service_role writes.
```

Use for: reference data managed by admins (institutions in v3, FAQ entries, etc.).

---

## Companion Files

- `architecture-decisions.md` — full schema, design rationale, sensitive columns map.
- `CLAUDE.md` — points Sonnet to read both files before any DB work.
