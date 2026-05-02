# FYPro v2 — Architecture Decisions

**Date:** Sun May 10
**Scope:** Database schema for v2, built v3-ready.

---

## Big Architectural Decisions

### Decision 1: Split `users` from `user_entitlements`

The single most important security decision here. Anything a user could profit from manipulating — `paid_features`, `paid_until`, `role`, `payment_status` — lives in a **separate table** with `service_role`-only writes.

Why: even if you write a buggy RLS policy on `users` that lets a user UPDATE their own row, they cannot grant themselves Defense Pack access, because that data isn't there. It lives in `user_entitlements` which the client SDK literally cannot write to.

This is the single biggest mistake in Supabase apps — putting `is_premium` on the `users` table with an UPDATE policy that has `WITH CHECK (auth.uid() = id)`. That's a paywall bypass waiting to happen.

### Decision 2: Bake v3 columns into v2

```
users.institution_id       -- NULL for v2 retail users, set for v3 institutional
users.role                 -- DEFAULT 'student', will gain 'supervisor' / 'admin' in v3
projects.supervisor_id     -- NULL for v2, set when v3 supervisor links to student
institutions table         -- exists from day 1, empty in v2
```

Cost: a tiny amount of extra schema. Benefit: zero migrations during v3 build, RLS policies already account for the institutional case.

### Decision 3: All `auth.uid()` calls wrapped in `(select auth.uid())`

Supabase's official performance guidance — wrapping `auth.uid()` in a subquery causes Postgres to evaluate it once per query instead of once per row. With Day 19's localStorage migration about to hit thousands of rows, this matters.

### Decision 4: One UPDATE policy per table, always with `WITH CHECK`

This is the role-flip trap. Without `WITH CHECK`, a user can UPDATE their own row to set `user_id = some_other_user_id`, effectively transferring the row.

```sql
-- WRONG (v2-killing bug):
USING ((select auth.uid()) = user_id)

-- RIGHT:
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id)
```

`USING` controls which rows you can see/touch. `WITH CHECK` controls what those rows can become after your UPDATE. **You need both.**

### Decision 5: Denormalise `user_id` onto child tables

`project_steps`, `defense_sessions`, `defense_turns` all carry `user_id` directly. RLS policies on child tables that have to JOIN to the parent to check ownership are slow at scale and a frequent source of policy bugs. Carrying `user_id` directly makes the policy `(select auth.uid()) = user_id` — fast, simple, hard to get wrong. The application enforces consistency on insert.

---

## Schema — All Tables

### `institutions` (v3-ready, empty in v2)

```sql
CREATE TABLE public.institutions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name            TEXT NOT NULL,
  short_name      TEXT NOT NULL,           -- 'UNILAG', 'OAU'
  faculty         TEXT,                     -- NULL = whole university; set = department-level contract
  contract_status TEXT NOT NULL DEFAULT 'inactive'
                  CHECK (contract_status IN ('inactive', 'pilot', 'active', 'expired')),
  contract_start  DATE,
  contract_end    DATE,
  student_cap     INTEGER,                  -- max students under this contract
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_institutions_short_name ON public.institutions(short_name);
```

**v2 reality:** sits empty. **v3 reality:** every institutional contract creates a row here.

### `users` (profile only — no entitlements)

```sql
CREATE TABLE public.users (
  id              UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email           TEXT NOT NULL,             -- mirrored from auth.users for queries
  full_name       TEXT,
  faculty         TEXT,
  department      TEXT,
  level           TEXT,                       -- '200', '300', '400', '500'

  -- v3-ready columns (NULL in v2)
  institution_id  UUID REFERENCES public.institutions(id) ON DELETE SET NULL,
  role            TEXT NOT NULL DEFAULT 'student'
                  CHECK (role IN ('student', 'supervisor', 'admin')),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_users_institution_id ON public.users(institution_id);
CREATE INDEX idx_users_role ON public.users(role);
```

**Note:** `role` is on this table because it's used in *read* policies (a supervisor needs to see students in their department in v3). It is **read-only from the client** — clients cannot UPDATE the `role` column. Enforced via the RLS policy.

### `user_entitlements` (THE SENSITIVE TABLE — service_role writes only)

```sql
CREATE TABLE public.user_entitlements (
  user_id           UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  paid_features     JSONB NOT NULL DEFAULT '[]'::jsonb,  -- e.g. ['project_reviewer', 'defense_pack']
  paid_until        TIMESTAMPTZ,                          -- NULL = no time-bound access
  defense_packs_remaining  INTEGER NOT NULL DEFAULT 0,
  total_lifetime_paid_ngn  INTEGER NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);
```

**No INSERT/UPDATE/DELETE policy for `authenticated`.** The client SDK literally cannot write here. Only the Paystack webhook (running on `service_role`) writes to this table after HMAC verification.

### `projects`

```sql
CREATE TABLE public.projects (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  title           TEXT,                      -- validated topic, set after Topic Validator
  status          TEXT NOT NULL DEFAULT 'draft'
                  CHECK (status IN ('draft', 'in_progress', 'defense_ready', 'archived')),
  current_step    TEXT NOT NULL DEFAULT 'topic_validator'
                  CHECK (current_step IN (
                    'topic_validator', 'chapter_architect',
                    'methodology_advisor', 'writing_planner',
                    'project_reviewer', 'defense_prep'
                  )),

  faculty         TEXT,
  department      TEXT,
  level           TEXT,

  -- v3-ready
  supervisor_id   UUID REFERENCES public.users(id) ON DELETE SET NULL,
  institution_id  UUID REFERENCES public.institutions(id) ON DELETE SET NULL,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_projects_user_id ON public.projects(user_id);
CREATE INDEX idx_projects_supervisor_id ON public.projects(supervisor_id);
CREATE INDEX idx_projects_institution_id ON public.projects(institution_id);
```

### `project_steps`

Each completed step output gets one row.

```sql
CREATE TABLE public.project_steps (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  step_type       TEXT NOT NULL CHECK (step_type IN (
                    'topic_validator', 'chapter_architect', 'literature_map',
                    'abstract_generator', 'methodology_advisor', 'instrument_builder',
                    'writing_planner', 'project_reviewer', 'red_flag_detector',
                    'supervisor_email', 'meeting_prep'
                  )),
  result_json     JSONB NOT NULL,            -- the step's output
  input_summary   TEXT,                       -- what the student provided

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_project_steps_project_id ON public.project_steps(project_id);
CREATE INDEX idx_project_steps_user_id ON public.project_steps(user_id);
CREATE INDEX idx_project_steps_step_type ON public.project_steps(step_type);

-- REQUIRED for upsert to work correctly (migration-plan.md Section 2).
-- Without this, re-running a step creates duplicate rows instead of overwriting.
-- Run this before Day 19 migration begins.
ALTER TABLE public.project_steps
  ADD CONSTRAINT project_steps_unique_per_step
  UNIQUE (project_id, step_type);
```

### `defense_sessions`

```sql
CREATE TABLE public.defense_sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  examiner_persona TEXT NOT NULL CHECK (examiner_persona IN (
                    'methodologist', 'subject_expert', 'external_examiner'
                  )),
  status          TEXT NOT NULL DEFAULT 'in_progress'
                  CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  total_score     INTEGER,                    -- NULL until completed
  turns_count     INTEGER NOT NULL DEFAULT 0,

  started_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ
);

CREATE INDEX idx_defense_sessions_project_id ON public.defense_sessions(project_id);
CREATE INDEX idx_defense_sessions_user_id ON public.defense_sessions(user_id);
```

### `defense_turns`

```sql
CREATE TABLE public.defense_turns (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id      UUID NOT NULL REFERENCES public.defense_sessions(id) ON DELETE CASCADE,
  user_id         UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  turn_number     INTEGER NOT NULL,
  examiner_question TEXT NOT NULL,
  student_answer  TEXT,
  score           INTEGER CHECK (score BETWEEN 0 AND 10),
  feedback        TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_defense_turns_session_id ON public.defense_turns(session_id);
CREATE INDEX idx_defense_turns_user_id ON public.defense_turns(user_id);
```

### `payments` (read-only from client)

```sql
CREATE TABLE public.payments (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id          UUID REFERENCES public.projects(id) ON DELETE SET NULL,

  paystack_reference  TEXT NOT NULL UNIQUE,
  amount_kobo         INTEGER NOT NULL,       -- amount in kobo (NGN × 100). e.g. ₦3,500 = 350000
  tier                TEXT NOT NULL CHECK (tier IN (
                        'student_pack', 'defense_pack', 'project_reset'
                      )),
  status              TEXT NOT NULL CHECK (status IN (
                        'pending', 'success', 'failed', 'refunded'
                      )),
  webhook_verified_at TIMESTAMPTZ,            -- NULL until HMAC verified

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_payments_user_id ON public.payments(user_id);
CREATE INDEX idx_payments_paystack_reference ON public.payments(paystack_reference);
```

**The client never INSERTs into `payments`.** The Paystack webhook (service_role) does. Client only SELECTs their own history.

---

### `daily_usage` (spend tracking — service_role writes only)

Used by the Day 30 daily Claude API spend cap. Tracks token usage and cost per day.
Client cannot read or write this table — admin dashboard reads via service_role only.

```sql
CREATE TABLE public.daily_usage (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date                DATE NOT NULL UNIQUE,          -- one row per calendar day (UTC)
  total_tokens_in     INTEGER NOT NULL DEFAULT 0,
  total_tokens_out    INTEGER NOT NULL DEFAULT 0,
  total_cost_usd      NUMERIC(10,6) NOT NULL DEFAULT 0,
  request_count       INTEGER NOT NULL DEFAULT 0,
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_daily_usage_date ON public.daily_usage(date);
```

**No client policies.** Only `/api/claude` (service_role) increments these counters.
Admin dashboard at `/admin/spend` reads via service_role — never the anon key.

---

## Auto-create user row on signup

This trigger runs as `service_role`, so it bypasses RLS. Without it, signup would fail because the new user couldn't INSERT their own row before being authenticated.

```sql
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.users (id, email, role)
  VALUES (NEW.id, NEW.email, 'student');

  INSERT INTO public.user_entitlements (user_id)
  VALUES (NEW.id);

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
```

---

## Sensitive Columns Map

| Column | Table | Why sensitive | Protection |
|---|---|---|---|
| `paid_features` | `user_entitlements` | Paywall bypass risk | Service-role-only writes |
| `paid_until` | `user_entitlements` | Time-bound access manipulation | Service-role-only writes |
| `defense_packs_remaining` | `user_entitlements` | Free Defense Sim access | Service-role-only writes |
| `role` | `users` | Privilege escalation to admin/supervisor | UPDATE policy `WITH CHECK` blocks self-modification |
| `institution_id` | `users` | Free-tier user spoofing institutional access | UPDATE policy `WITH CHECK` blocks self-assignment |
| `supervisor_id` | `projects` | Self-assigning a supervisor (v3) | INSERT policy forces NULL; updates blocked |
| `webhook_verified_at` | `payments` | Faking payment verification | No client write policy at all |
| `status` | `payments` | Marking own payment as `success` | No client write policy at all |

---

## v2 → v3 Evolution Path

What changes at v3 build start (no rebuild required, only additions):

1. Populate `institutions` table with first contracted university/department.
2. Add a server-side admin function (service_role) to assign `institution_id` and `supervisor_id` after contract activation. Students still cannot self-assign.
3. Uncomment the supervisor read policy in `security-policies.md` (Section 3, "v3 PREVIEW" block).
4. Add new tables: `defense_question_archive`, `referrals`, `masters_proposals`, `supervisor_pilots`. Each ships with its own RLS — repeat the pattern.
5. SIWES B2B2C: separate `companies` table + `siwes_evaluations`. Same pattern.

No changes required to existing v2 tables. No data backfill. No downtime.

---

## Files to Reference

- `security-policies.md` — all RLS SQL, service_role rules, testing approach, common bugs.
- `CLAUDE.md` — points Sonnet to both this file and security-policies.md before any DB work.
