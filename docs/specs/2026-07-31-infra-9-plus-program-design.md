# Infrastructure 9+ Program — Design

**Date:** 2026-07-31
**Status:** Design approved, not implemented
**Supersedes/extends:** the priority queue from the 2026-07-28 Architecture Ledger audit

---

## 1. Goal

Raise all ten architecture categories from the 2026-07-28 Architecture Ledger audit to a score of
9 or above, and absorb the audit's existing P0/P1/P2 queue into that effort.

This is a standing backlog with no deadline. It runs independently of v2.1 (Workspace/editor)
feature work rather than blocking it.

### Starting scores (2026-07-28, composite 7.2)

| Domain | Score | Verdict |
|---|---|---|
| Security & RLS | 9.0 | Ahead of curve |
| Scalability & cost-aware scaling | 8.5 | Ahead of curve |
| Caching & Performance | 8.0 | Solid |
| API Design | 7.5 | Solid |
| Observability | 7.0 | Solid |
| Database Design | 7.0 | Solid |
| Testing | 7.0 | Solid |
| FinOps for AI | 6.5 | Adequate |
| Reliability & Resilience | 6.0 | Gap |
| CI/CD | 5.0 | Gap |

---

## 2. Constraints

**Free tier only.** No Vercel Pro, no Supabase Pro, no GitHub paid plan. Every criterion below
must be achievable with self-hosted or free-tier equivalents. Consequences that follow directly
from this:

- No Supabase point-in-time recovery and no managed backups — durability is DIY (W4).
- The Vercel 12-serverless-function ceiling stands — endpoint decomposition must be *internal*
  modularisation, not new functions (W5).
- The 1-cron Vercel limit stands — scheduling continues via cron-job.org and GitHub Actions.
- Vercel deployment protection is unavailable — the CI gate must be enforced inside the build
  itself (W1).

**No deadline.** Workstreams are independently shippable and ordered by dependency, not by date.

---

## 3. Corrections to the ledger

Two items in the 2026-07-28 audit were out of date. Both reduce scope:

1. **Per-user AI spend caps are already implemented.** `api/_lib/usage-tracker.js` provides
   `checkUserCap()` and `trackUserUsage()` with a free-user ceiling of $0.75/day and a paid ceiling
   of $4/day, backed by a date-stamped Redis counter. The June review's P0 "per-user cost cap" is
   shipped. FinOps is stronger than 6.5 implies.
2. **Per-call cost is already computed, just not persisted.** `estimateCallCostUsd()` runs on every
   Anthropic call; the result is folded into the `daily_usage` rollup and then discarded. The P0
   "log per-call AI cost" is therefore a small change — add a table and write a number that already
   exists — not a build from scratch.

---

## 4. The scoring contract

Scores in the original audit were judgment calls, which makes "we reached 9" unfalsifiable. This
program replaces judgment with **exit criteria**: conditions a third party could check and get the
same answer.

Rules:

- A criterion is **met or not met**. No partial credit.
- Every criterion names its verification method: a command, a test file, a deliberate-failure
  drill, or a database query.
- A category scores 9+ only when **all** of its criteria pass. One failing criterion holds the
  whole category.
- Criteria are written as observable behaviour ("kill Upstash credentials in staging and `/api/ai`
  returns 503 with an alert inside 60s"), never as intentions ("improve error handling").

Progress is tracked in a checklist document maintained alongside this spec. This spec defines the
criteria; the checklist records pass/fail state.

---

## 5. Structure: workstreams, not categories

The ten categories are not independent — a single fix commonly moves several. Per-call cost logging
lifts FinOps *and* Observability *and* unblocks Caching. Wiring tests into CI lifts CI/CD *and*
Testing.

Work is therefore organised into six workstreams that cut across categories. Categories rise as a
consequence of workstreams completing. The trade-off accepted here: "which category am I working
on" is less obvious, in exchange for not re-opening the same files three times.

**Order: W1 → W2 → W3 → W4 → W5 → W6.**

- W1 is first because it is nearly free and every later workstream benefits from a gate that holds.
- W3 precedes the Caching criteria because cache-hit observability depends on the telemetry W3 adds.
- W5 precedes W6 because writing tests against a 2,544-line endpoint is materially harder than
  against decomposed modules.

---

## 6. Regression-only categories

Three categories are already at or above target. They need criteria that prove they do not silently
decay, not new work.

### Security & RLS (9.0 — hold at 9)

1. The RLS verification query (`SELECT tablename FROM pg_tables WHERE schemaname='public' AND
   rowsecurity = false`) returns zero rows, asserted **in CI**, not by hand.
2. gitleaks and `npm audit --audit-level=moderate` continue to gate merges. *(Already true.)*
3. A test asserts that no reference to `SUPABASE_SERVICE_ROLE_KEY` or any server-only secret name
   exists anywhere under `src/`.

### Scalability & cost-aware scaling (8.5 → 9)

1. The global daily cap and the per-user cap each have a test covering the allow and deny paths.
2. The documented scalability breakpoint table is re-derived from real `daily_usage` figures rather
   than the June 2026 estimate. *(Depends on W3 data.)*

### Caching & Performance (8.0 → 9)

1. Cache hit rate is queryable per feature. *(Depends on W3; not currently answerable at all.)*
2. A documented TTL rationale per cached feature, recorded alongside the cache module.
3. A test proving cache keys cannot collide across users.

---

## 7. W1 — Pipeline gates

**Lifts:** CI/CD 5.0 → 9. **Assists:** Testing, Security.

**Current state:** `.github/workflows/ci.yml` runs `npm audit` → `npm run lint` → `npm run build`.
The `typecheck` and `test` scripts exist in `package.json` and pass locally, but CI never invokes
them. A pull request that breaks every test can merge green.

### Exit criteria

1. `ci.yml` runs `npm run typecheck` and `npm run test` on every pull request; both block the build.
2. A migration-lint step fails the build when two files in `migrations/` share a numeric prefix.
   The current `0029_*` and `0034_*` collisions are renumbered **in the same change** that adds the
   lint, so `main` is never knowingly left red. Verification: reintroduce a duplicate prefix on a
   scratch branch and confirm CI fails.
3. A guard step fails the build if `api/` contains more than 12 serverless function entrypoints, so
   the Vercel Hobby ceiling surfaces as a CI error rather than a deploy failure.
4. `main` is protected such that a red CI blocks merge — verified by opening a pull request
   containing a deliberate type error and confirming the merge control is disabled.
5. A production deploy cannot bypass the gate.

6. Local and CI test runs cover the same files. Today they do not: `npm run test` locally collects
   74 test files / 936 tests, but 43 of those files are stale duplicates under `api/.worktrees/`,
   which is gitignored and therefore absent in CI. The real suite is **41 files / 507 tests**. A
   gate is not meaningful while "passes locally" and "passes in CI" mean different things.

### Known free-tier risks

- **Criterion 4 is available — resolved 2026-07-31.** `AyeniTaiwoSPC270/FYpro-v2` is a **public**
  repository, so branch protection and rulesets are free. The contingency previously recorded here
  (cap CI/CD at 8.5) is withdrawn.
- **Criterion 5 has no clean free path.** Vercel Hobby deploys on push to `main` independently of
  GitHub Actions, and deployment protection is a Pro feature. Workaround: make `npm run build` run
  typecheck and tests as part of the build, so a broken commit fails the Vercel build itself.
  Cost: slower builds. This is the only free mechanism that makes the gate real.

### Verified — 2026-08-02

All six exit criteria confirmed on `main`:

1. `.github/workflows/ci.yml` job `Audit · Lint · Typecheck · Test · Build` runs `npm run
   typecheck` and `npm run test`; both are required steps (PR #8).
2. `scripts/lint-migrations.js` fails the build on a duplicate numeric prefix; the two pre-existing
   collisions (`0029_*`, `0034_*`) were renumbered in the same change (PR #8, commit `499d116`).
3. `scripts/lint-api-functions.js` fails the build above 12 `api/` entrypoints (PR #8, commit
   `cfd6bce`, widened to also count `.mjs`/`.cjs` in commit `31f74b4`).
4. Branch ruleset **"Require CI on main"** (id `20227598`, `enforcement: active`) requires the
   `Audit · Lint · Typecheck · Test · Build` check on PRs into `main`. Blocked-merge drill: PR #10
   ("TEST: verify CI gate blocks merge") added a deliberate type error to `src/lib/storage.ts`; CI
   failed at the Typecheck step (`error TS2322: Type 'string' is not assignable to type
   'number'.`) and `gh pr view 10 --json mergeStateStatus` returned `BLOCKED`, as expected. PR
   closed and the proof branch deleted after verification.
5. `package.json`'s `vercel-build` script (PR #8, commit `4d4c8a8`) runs the same gate before
   `vite build` on every Vercel deployment. A first attempt broke production and staging (PR #8's
   merge, commit `f66ae25`): `.vercelignore` blanket-excluded all test files repo-wide, so
   `vercel-build`'s `npm run test` step found zero files inside Vercel's build container and
   failed the deploy. Fixed by scoping the exclusion to `api/**/*.test.{js,ts}` and
   `api/**/*.spec.{js,ts}` (PR #9, commit `af0e92d`) — but that scope was still too broad: it
   excluded all 15 test files under `api/`, when only the 5 directly at the top level of `api/`
   risk being deployed as spurious serverless functions (the other 10 live under `api/_lib/`,
   which Vercel's own zero-config detection already ignores as underscore-prefixed). The
   over-broad scope meant `vercel-build` ran only 18 of the repo's 33 test files (missing the
   payments/auth/credit-user suites), which the final whole-branch review caught. Corrected to
   `api/*.test.{js,ts}` / `api/*.spec.{js,ts}` (top level only) the same day. Verified via a
   deployment build log after the fix: `vercel-build` ran lint:migrations, lint:api, and
   typecheck, then `vitest run` found and passed all 33 test files, then `vite build` succeeded.
   The PR #10 drill (criterion 4) also confirmed the gate is live independently: the same
   deliberate type error failed both Vercel preview deployments, not just the GitHub Actions check.
6. `npx vitest run` reports the same file/test count locally and in CI. **Correction (final
   whole-branch review, same day):** the number recorded here was initially wrong — `vite.config.js`
   excluded `**/.worktrees/**` (with a leading dot), which does not match `.claude/worktrees/`
   (no leading dot on "worktrees" itself), a real, currently-registered git worktree from prior
   UI-fix work. Locally this collected 10 stale duplicate test files from that worktree on top of
   the real suite; CI's plain checkout never had them. Fixed by widening the pattern to
   `**/worktrees/**`. Corrected, verified count: **33 files / 366 tests**, matching
   `git ls-files | grep -cE '\.(test|spec)\.'` exactly.

---

## 8. W2 — Failure policy

**Lifts:** Reliability 6.0 → 9 (with W4). **Assists:** Observability, Security.

**Current state:** every Redis- and Supabase-backed guard fails open, with only a `console.error`
recording it. Confirmed fail-open sites in `api/ai.js`: lines 87, 399, 499, 711, 828, 1014.
`checkDailyCap()` and `checkUserCap()` in `api/_lib/usage-tracker.js` also fail open.

The consequence: **if Redis or Supabase is unavailable, AI spend is uncapped.** The global cap, the
per-user cap, and all rate limits simultaneously wave every request through, silently. This is the
sharpest edge identified in the audit.

### Exit criteria

1. A written decision table covering every dependency × call site, each mapped to fail-open,
   fail-closed, or degrade, with a one-line rationale. Committed to `docs/architecture/`.
2. **Spend-cap checks fail closed.** An infrastructure outage must never uncap spending. Rate limits
   may continue to fail open — that is a defensible product decision — but it must be a stated one
   in the table, not an accident of a `.catch()`.
3. Every fail-open path increments a counter and fires a deduplicated Sentry + Telegram alert.
   Silent degradation is disallowed.
4. The scattered inline `.catch(() => ({ allowed: true }))` swallows are replaced by one shared
   helper, so per-call-site policy drift becomes impossible.
5. Fire-and-forget side effects (Telegram alerts, nurture emails, notification inserts) get retry
   and dead-letter handling. Same bug class as the unawaited login alert fixed in `be60a7b`.
   *(This absorbs the ledger's P1 async-reliability item.)*
6. **Drill:** revoke Upstash credentials in staging, exercise every endpoint, and confirm observed
   behaviour matches the decision table row for row.

### Verified — 2026-08-02

1. Decision table committed: `docs/architecture/2026-08-02-w2-failure-policy-decision-table.md`.
2. `checkDailyCap`/`checkUserCap` fail closed — `api/_lib/usage-tracker.test.js`.
3. Every fail-open/closed trip recorded (system_logs + Sentry + deduplicated Telegram)
   via `guardedCheck` — `api/_lib/failure-policy.test.js`.
4. Shared helper (`api/_lib/failure-policy.js`) replaces all 12 inline `.catch()`
   swallows in `api/ai.js` — `git grep` confirms zero remain.
5. Retry + dead-letter for the 3 named fire-and-forget sites (signup nurture email,
   login nurture email, referral notification) plus `sendTelegramAlert` generally —
   `api/_lib/reliable-async.test.js`, `api/_lib/telegram.test.js`.
6. Drill: automated handler-layer proof for every gated action —
   `api/ai.failure-policy.test.js` (6/6 passing). Live staging credential-revocation
   half of the drill: see `docs/architecture/2026-08-02-w2-drill-runbook.md` — **not
   yet executed as of this writing; requires a human to run it against a confirmed
   staging-only Upstash instance.**

---

## 9. W3 — Cost & telemetry

**Lifts:** FinOps 6.5 → 9, Observability 7.0 → 9. **Unblocks:** Caching, Scalability criteria.

**Current state:** only the `daily_usage` rollup exists. There is no per-call attribution, so
pricing decisions — notably whether the ₦2,000 Express Defence tier is profitable at its 5-review
cap — are guesswork.

### Exit criteria

1. Every Anthropic call writes a row recording: `user_id`, action/feature, model, `tokens_in`,
   `tokens_out`, `cost_usd`, `cache_hit`, `trace_id`, `duration_ms`, `created_at`. Either a new
   table or an extension of `response_times` (which today holds only `feature`, `duration_ms`,
   `user_id`, `created_at`).
2. A single query answers "lifetime AI cost per Express Defence user," settling the margin question
   raised in the reviewer cost-economics analysis.
3. Cache hit rate is queryable per feature. *(This is the dependency that unblocks Caching → 9.)*
4. One trace ID joins client-side Sentry error → server log line → cost row for the same request.
5. A retention policy — prune or roll up rows beyond roughly 90 days. On free-tier Supabase the
   whole project has 500 MB, and a per-call log is the fastest-growing table in the schema. Without
   this criterion, W3 creates a new reliability problem while solving an observability one.

---

## 10. W4 — Data durability & schema integrity

**Lifts:** Reliability (with W2), Database Design 7.0 → 9.

**Current state:** free-tier Supabase provides no managed backups at all — daily backups begin at
Pro. No backup or restore has been evidenced. Migrations are applied by hand in the Supabase SQL
Editor, so nothing guarantees that production schema equals the sum of `migrations/`.

### Exit criteria

1. A GitHub Actions job runs `pg_dump` across the public and auth schemas **daily**. Daily is the
   cadence the RPO in criterion 4 is written against; changing one requires changing the other.
2. The dump is encrypted on the runner before leaving it — it contains emails, names, and university
   details — and is stored off Supabase. Cloudflare R2's free 10 GB tier is the intended destination,
   since Cloudflare is already in the stack.
3. **Automated restore verification.** The job restores the dump into a throwaway Postgres service
   container and asserts row counts plus a small set of schema invariants. This criterion is the
   entire distance between 6.5 and 9: a documented procedure nobody has executed is not a backup
   strategy.
4. RPO and RTO documented with numbers **measured during the drill**, not estimated.
5. Backup failure raises an alert.
6. **Schema drift check.** A job replays `migrations/` into a clean database and diffs the result
   against a production schema dump. Expect this to surface real drift after 38 hand-applied
   migrations; resolving whatever it finds is part of the workstream.

### Honest ceiling

Daily logical dumps on a single-region free Supabase project imply an **RPO of roughly 24 hours**.
For a student-focused SaaS at this scale that is proportionate engineering, and the original audit
scored proportionality — so this counts as a genuine 9 *for this product's scale and stage*. An
auditor benchmarking against enterprise practice would score it 7 and require PITR. The criterion is
therefore written as "RPO ≤ 24h, measured and alerting," with this ceiling recorded so the number is
not quietly inflated later.

---

## 11. W5 — Structure & hygiene

**Lifts:** API Design 7.5 → 9. **Assists:** Database Design.

**Current state:** `api/admin.js` is 2,544 lines, `api/notify.js` 1,790, `api/ai.js` 1,195 — the
12-function Hobby ceiling has pushed several endpoints into god-endpoint shape.

### Exit criteria

1. *(The stale `api/.worktrees/` directories move into W1 — see §7 criterion 6. **Correction:** an
   earlier draft of this spec implied they were deployed to Vercel. They are not. `.worktrees` is
   gitignored (`.gitignore:35`) and untracked, so it never reaches the repo, CI, or a deploy. It is
   also no longer a registered git worktree — these are orphaned directories. The only real damage
   is that local `npm run test` silently runs 43 stale duplicate test files, so local and CI results
   diverge. That makes it a W1 gate-integrity problem, not a W5 deployment problem.)*
2. *(Renumbering the duplicate `0029_*`/`0034_*` migrations moves into W1 — see §7 criterion 2 —
   so the lint and the fix land together.)*
3. `admin.js`, `notify.js`, and `ai.js` are decomposed into per-action handler modules under
   `api/_lib/`, behind thin routing entrypoints. Serverless function count stays at 12. No resulting
   file exceeds roughly 400 lines. *(This closes the ledger's P2 decomposition item, open since the
   June audit.)*
4. A written API contract covering every action: request schema, auth requirement, rate limit, and
   failure mode.
5. One consistent error envelope across all endpoints.

---

## 12. W6 — Test depth

**Lifts:** Testing 7.0 → 9.

**Current state (measured 2026-07-31):** 41 real test files, 507 passing tests, ~25s wall clock.
Coverage is partial and unenforced. *(A naive `npm run test` reports 74 files / 936 tests; the
difference is stale `api/.worktrees/` duplicates, addressed in W1.)*

### Exit criteria

1. Coverage thresholds enforced in CI: a high bar on money and auth paths (`payments`, `auth`,
   `credit-user`, `certificate`, entitlement grants), a lower floor elsewhere. Build fails on
   regression.
2. Every `api/_lib/` module containing branching logic has tests. Seventeen currently do not:
   `admin-auth`, `anthropic-proxy`, `cache`, `cors`, `cron-auth`, `defense-credit-check`,
   `express-beta`, `express-limits`, `maintenance`, `papers`, `rate-limit`, `rating-force`,
   `sentry-server`, `supabase-admin`, `system-log`, `telegram`, `trace`. Modules that are thin
   config wrappers with no branching (e.g. `supabase-admin`) may be exempted, but the exemption must
   be recorded in the spec checklist rather than left implicit.
3. Contract tests for every documented `/api/ai` action: valid input accepted, invalid input
   rejected with the expected status.
4. The existing RLS regression script (`scripts/verify-rls-after-refactor.js`) runs in CI rather
   than by hand.

---

## 13. Category → workstream map

| Category | Target | Workstreams |
|---|---|---|
| CI/CD | 5.0 → 9 | W1 |
| Reliability & Resilience | 6.0 → 9 | W2, W4 |
| FinOps for AI | 6.5 → 9 | W3 |
| Observability | 7.0 → 9 | W3, W2 |
| Database Design | 7.0 → 9 | W4, W5 |
| Testing | 7.0 → 9 | W6, W1 |
| API Design | 7.5 → 9 | W5 |
| Caching & Performance | 8.0 → 9 | W3, §6 |
| Scalability | 8.5 → 9 | §6, W3 |
| Security & RLS | 9.0 hold | §6, W1, W6 |

## 14. Ledger queue → workstream map

| Ledger item | Priority | Lands in |
|---|---|---|
| Gate CI on typecheck + test | P0 | W1 |
| Log per-call AI token/cost | P0 | W3 |
| Replace blanket Redis fail-open | P0 | W2 |
| Backup-restore drill | P1 | W4 |
| Migration numbering collisions | P1 | W1 |
| Retry/dead-letter for fire-and-forget side effects | P1 | W2 |
| Decompose `api/ai.js` | P2 | W5 |
| Revisit queueing | P2 | Deferred — see §15 |

---

## 15. Explicitly out of scope

- **Message queueing.** Cron-hitting-an-endpoint remains correct at current volume. Revisit trigger,
  recorded here rather than built: when a single async side-effect class exceeds roughly 1,000
  events/day, or when W2's dead-letter table shows sustained non-trivial failure volume.
- **Paid platform tiers.** Vercel Pro, Supabase Pro, and GitHub paid plans are out of scope by
  constraint (§2). Where a criterion is capped by that decision, the cap is recorded in the relevant
  workstream rather than scored around.
- **v2.1 Workspace/editor feature work.** Unrelated; runs in parallel.
- **Unrelated refactoring.** Files are improved where a workstream already touches them, not
  opportunistically.

---

## 16. Verification summary

The program is complete when, for every category in §13, all listed exit criteria pass. Each
criterion is verified by one of four means:

- **Command** — a CI step or npm script that exits non-zero on failure.
- **Test** — a named test file asserting the behaviour.
- **Drill** — a deliberate failure injected in staging, with observed behaviour compared against a
  documented expectation.
- **Query** — a SQL query returning a specific answer.

No category is marked 9+ on the strength of a code review alone.
