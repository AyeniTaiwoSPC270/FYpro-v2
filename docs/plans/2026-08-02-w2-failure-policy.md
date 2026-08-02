# W2 — Failure Policy Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make every Redis- and Supabase-backed spend guard in the Claude API proxy fail *closed* on an infrastructure outage instead of silently uncapping spend, replace the scattered inline `.catch(() => ({ allowed: true }))` fail-open swallows with one shared, alerting helper, and give fire-and-forget side effects (Telegram alerts, nurture emails, notification inserts) retry + dead-letter handling instead of silent loss.

**Architecture:** Two small shared libraries carry the whole workstream. `api/_lib/failure-policy.js` wraps any Redis/Supabase check with an explicit `'open'` or `'closed'` policy, and on a trip writes a `system_logs` counter row plus a deduplicated Sentry + Telegram alert — so a failure is recorded once, in one place, instead of being reinvented (or forgotten) at every call site. `api/_lib/reliable-async.js` retries a fire-and-forget side effect with backoff and, if every attempt fails, records it in a new `dead_letter_queue` table instead of dropping it. `checkDailyCap`/`checkUserCap` in `usage-tracker.js` and `rateLimitCheck` in `rate-limit.js` are rewritten to use the first helper (closed and open respectively); `api/ai.js`'s 12 duplicated inline catch blocks around those two functions are then deleted, since both functions now never throw. Three specific fire-and-forget call sites (signup nurture email, login nurture email, referral notification) are converted to use the second helper.

**Tech Stack:** No new dependencies. Existing Supabase (service-role `supabaseAdmin`), Upstash Redis (`@upstash/redis`, `@upstash/ratelimit`), `@sentry/node`, Telegram Bot API via `fetch`, vitest.

## Global Constraints

- Free tier only — no new paid infrastructure. (docs/specs/2026-07-31-infra-9-plus-program-design.md §2)
- Rate limits (`rateLimitCheck`) stay fail-**open** — this is a stated, defensible product decision, not something this plan changes. (spec §8, exit criterion 2)
- Spend-cap checks (`checkDailyCap`, `checkUserCap`) must fail **closed** — an infrastructure outage must never uncap spending. (spec §8, exit criterion 2 — "the sharpest edge identified in the audit")
- Every fail-open *and* fail-closed trip must be recorded: a counter increment plus a deduplicated Sentry + Telegram alert. No silent degradation. (spec §8, exit criterion 3)
- One shared helper for the fail-open/closed decision — no more per-call-site `.catch()` policy drift. (spec §8, exit criterion 4)
- Fire-and-forget side effects that must not be silently lost get retry + dead-letter handling, same bug class as the unawaited login alert fixed in commit `be60a7b`. (spec §8, exit criterion 5)
- `npm run typecheck` and `npm run test` must pass before every commit (CLAUDE.md §17). Migration files are numbered sequentially from the last one in `migrations/` (currently `0041`) and linted by `npm run lint:migrations` (CLAUDE.md §17, W1).
- New Supabase tables must have RLS enabled — zero tables with `rowsecurity = false` is a hard rule. Verify via `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;` after any schema change. (CLAUDE.md §6, §15)
- Server-only secrets (Supabase service role, Telegram token) never appear in `src/`. This plan only touches `api/` and `migrations/`. (CLAUDE.md §4)

---

### Task 1: Failure-policy decision table

**Files:**
- Create: `docs/architecture/2026-08-02-w2-failure-policy-decision-table.md`

**Interfaces:**
- Produces: the written policy that Tasks 2–5 implement. No code depends on this file, but its content (which mechanism is fail-open vs fail-closed vs degrade, and why) must match exactly what Tasks 2–5 build — if a later task needs to diverge from a row in this table, fix the table, don't silently drift from it.

This is a documentation-only task — satisfies spec exit criterion 1 ("a written decision table covering every dependency × call site... committed to `docs/architecture/`").

- [ ] **Step 1: Write the decision table**

Create `docs/architecture/2026-08-02-w2-failure-policy-decision-table.md` with exactly this content:

```markdown
# W2 Failure Policy — Decision Table

**Date:** 2026-08-02
**Spec:** docs/specs/2026-07-31-infra-9-plus-program-design.md §8 (W2 — Failure policy)

Every Redis- or Supabase-backed guard in the Claude API proxy, and what happens to a
request when that dependency is unavailable. "Recorded" means: a `system_logs` row
(queryable counter) plus a deduplicated Sentry + Telegram alert — see
`api/_lib/failure-policy.js`. Rate limits, spend caps, and the free-run reservation all
protect the same underlying resource (Anthropic spend) but at different layers; the
policy differs per layer, not per endpoint, so this table is organised by mechanism, not
by the ~12 call sites that use them.

| # | Mechanism | Dependency | Current file | Policy | Recorded on trip? | Rationale |
|---|---|---|---|---|---|---|
| 1 | `rateLimitCheck` (per-IP + per-user daily request count) | Redis (Upstash) | `api/_lib/rate-limit.js` | **Open** | Yes (Task 3) | Availability outweighs abuse risk for a request-count limiter during a brief outage — a legitimate user should not be locked out because Redis hiccuped. Real spend is still bounded by rows 2–3 below, which stay closed. |
| 2 | `checkDailyCap` (global daily spend ceiling) | Supabase (`daily_usage`) | `api/_lib/usage-tracker.js` | **Closed** | Yes (Task 2) | The sharpest edge in the 2026-07-28 audit: a Supabase outage must never let Claude spend run uncapped. Blocking is the safe direction — a false block during a rare outage costs a delayed generation; a false allow could cost the whole daily budget. |
| 3 | `checkUserCap` (per-user daily spend ceiling) | Redis (Upstash) | `api/_lib/usage-tracker.js` | **Closed** | Yes (Task 2) | Same reasoning as row 2, scoped per user — without this, a Redis outage lets one abusive account drain the global cap uncontested even while row 2 holds. |
| 4 | Free-tier run-count reservation (per-step lifetime limit for unpaid users) | Redis (Upstash) | `api/ai.js` `handleGeneral` (inline, lines ~179–198) | **Open** (unchanged) | No — pre-existing, out of scope | A quota layered *on top of* rows 2–3, which now both fail closed. Failing this open during a rare Redis blip lets a free user run one extra generation of a single step; total spend for that user is still bounded by the now-closed per-user cap (row 3). Not touched by this plan — already correct given rows 2–3's fix. |
| 5 | Express lifetime-cap reservation (`reserveRun`) | Redis (Upstash) | `api/_lib/run-reservation.js` | **Open** (unchanged) | No — pre-existing, out of scope | Same reasoning as row 4: a quota on top of the spend caps, which are the real backstop. Already documented in the file's own comment ("Fails OPEN... an infra outage must never block paying users"). |
| 6 | Response cache read/write (`getCached`/`setCached`) | Redis (Upstash) | `api/_lib/cache.js` | **Degrade** (unchanged) | No — not a spend-integrity issue | A cache miss just means the *real* Anthropic call happens (paying its normal cost, still bounded by rows 2–3); a cache-write failure means the next identical request also pays full cost. Neither uncaps spend, so this is a performance degradation, not a policy trip. |
| 7 | `getMaintenanceMode` (admin kill switch) | Redis, then Supabase fallback | `api/_lib/maintenance.js` | **Open** (unchanged) | No — operational switch, not spend | Fail-open here means "the site stays up" during an infra hiccup, which is the desired behaviour — a Redis/Supabase blip must not itself trigger the maintenance page for every visitor. |
| 8 | `supabaseAdmin.auth.getUser(token)` (JWT verification) | Supabase Auth (GoTrue) | `api/ai.js` (all handlers) | **Closed** (already correct) | No — returns 503, doesn't need the shared helper | On throw, every handler already returns `503 Authentication service unavailable` rather than treating the request as authenticated. No unauthenticated request can reach a spend-gated path. Not touched by this plan. |
| 9 | User bans | Supabase Auth (GoTrue `ban_duration`) | Set via `api/admin.js` ban-user action | **Closed** (already correct, delegated) | No — enforced by GoTrue itself | Bans are enforced at the GoTrue level, not app code — a banned user's token simply fails verification (row 8). There is no app-level "check if banned" call that could itself fail open. |
| 10 | Entitlements fetch (`user_entitlements.paid_features`) | Supabase | `api/ai.js` `handleGeneral` (lines ~117–127) | **Degrade** (unchanged, known trade-off) | No — UX cost, not a spend/security risk | On error, `entData` stays `null` → the user is treated as free-tier. This can wrongly deny a *paying* customer their higher limits during an outage — a UX bug — but it never uncaps spend (a free-tier misclassification only makes limits *tighter*, and rows 2–3 still apply). Documented here as a known trade-off; not fixed by this plan (out of scope — see spec §8 criteria, none of which cover this path). |

## Fire-and-forget side effects (spec exit criterion 5)

Separate from the checks above: side effects that fire after a decision is made and
must not be silently lost if they fail. Retried with backoff, then dead-lettered — see
`api/_lib/reliable-async.js` (Task 4).

| # | Side effect | Call site | Was it awaited before? | Treatment |
|---|---|---|---|---|
| 11 | Telegram alerts (all ~40 call sites across `api/`) | via `sendTelegramAlert`/`sendTelegramAlertOnce` in `api/_lib/telegram.js` | Mixed — roughly half already awaited, half intentionally fire-and-forget for latency | `sendTelegramAlert` retries internally with backoff before dead-lettering (Task 4). This is a real reliability improvement for every already-awaited call site. For call sites that remain un-awaited by their caller, retries can still be cut short if Vercel freezes the function after the response is sent — that risk is unchanged for those sites and is an accepted trade-off (documented here, not an accident). |
| 12 | Signup welcome nurture email trigger | `api/auth.js` (~line 216) | No (fire-and-forget, `.catch()` logs only) | Converted to `await reliably(...)` (Task 5) — this is exactly the "same bug class as the unawaited login alert fixed in be60a7b" the spec names. |
| 13 | Login nurture email trigger | `api/notify.js` (~line 1266) | No (explicitly documented as intentional fire-and-forget) | Converted to `await reliably(...)` (Task 5). The prior comment's rationale ("response doesn't depend on the email completing") is a latency preference, not a reliability one — W2 prioritises not silently losing the email over saving the few hundred ms. |
| 14 | Referrer notification insert | `api/referral.js` (~lines 128–144) | No (`.then()` chain, `.catch()` logs only) | Converted to `await reliably(...)` (Task 5). |

## What this plan does *not* change

Rows 4–10 and the "mixed" half of row 11 are deliberate, stated fail-open/degrade
decisions per the table above — not gaps. Extending retry+dead-letter treatment to
every one of the ~40 Telegram call sites in row 11 is out of scope for this plan (see
spec §8: the exit criteria name Telegram alerts, nurture emails, and notification
inserts as the target class, not an exhaustive rewrite of every call site) — the shared
`sendTelegramAlert` fix in Task 4 already lifts every already-awaited call site for
free, and rows 12–14 cover the specific named "same bug class" instances.
```

- [ ] **Step 2: Commit**

```bash
git add docs/architecture/2026-08-02-w2-failure-policy-decision-table.md
git commit -m "docs: add W2 failure-policy decision table"
```

---

### Task 2: Shared `guardedCheck` helper + fail-closed spend caps

**Files:**
- Create: `api/_lib/failure-policy.js`
- Create: `api/_lib/failure-policy.test.js`
- Modify: `api/_lib/usage-tracker.js` (`checkDailyCap`, `checkUserCap`)
- Modify: `api/_lib/usage-tracker.test.js`

**Interfaces:**
- Produces: `guardedCheck(checkFn, { policy, name, openResult, closedResult })` from `api/_lib/failure-policy.js` — runs `checkFn()`; on throw, records the trip (system_logs + Sentry + deduplicated Telegram alert) and returns `openResult` (policy `'open'`) or `closedResult` (policy `'closed'`); never throws.
- Consumes (Task 2 only): `writeSystemLog` from `./system-log.js`, `sendTelegramAlertOnce` from `./telegram.js`, `Sentry` from `./sentry-server.js` — all already exist, unchanged signatures.

- [ ] **Step 1: Write `api/_lib/failure-policy.js`**

```js
// Shared policy for what happens when a Redis- or Supabase-backed guard is
// unavailable. Before this file, each call site in api/ai.js hand-rolled its
// own `.catch(() => ({ allowed: true }))` — meaning the fail-open/fail-closed
// choice was an accident of whichever fallback someone typed, not a decision.
// See docs/architecture/2026-08-02-w2-failure-policy-decision-table.md for the
// full per-mechanism rationale this file implements.

import { sendTelegramAlertOnce } from './telegram.js';
import { Sentry } from './sentry-server.js';
import { writeSystemLog } from './system-log.js';

/**
 * Runs `checkFn`. If it throws — the guarded dependency (Redis or Supabase)
 * is unavailable — applies `policy` instead of letting the error propagate:
 *   - 'closed': return `closedResult` (block the request). Use for anything
 *     that bounds spend — an infra outage must never uncap it.
 *   - 'open':   return `openResult` (let the request through). Use for
 *     availability-over-abuse checks like rate limits.
 * Either way, the trip is recorded once: a system_logs row (queryable
 * counter) plus a deduplicated Sentry + Telegram alert, so a fail-open/closed
 * event is never silent. Never throws.
 * @template T
 * @param {() => Promise<T>} checkFn
 * @param {object} opts
 * @param {'open'|'closed'} opts.policy
 * @param {string} opts.name         - short id, e.g. 'checkDailyCap' (used in the alert key)
 * @param {T} opts.openResult        - value returned when policy is 'open'
 * @param {T} opts.closedResult      - value returned when policy is 'closed'
 * @returns {Promise<T>}
 */
export async function guardedCheck(checkFn, { policy, name, openResult, closedResult }) {
  try {
    return await checkFn();
  } catch (err) {
    recordFailurePolicyTrip(name, policy, err);
    return policy === 'closed' ? closedResult : openResult;
  }
}

function recordFailurePolicyTrip(name, policy, err) {
  const message = String(err?.message || err);
  console.error(`[failure-policy] ${name} unavailable — failing ${policy}:`, message);

  writeSystemLog({
    severity:      'error',
    feature:       `fail-${policy}:${name}`,
    source:        'failure-policy',
    plain_message: `${name} dependency unavailable — failed ${policy}`,
    raw_detail:    { error: message },
  });

  Sentry.captureMessage(`[fail-${policy}] ${name} dependency unavailable: ${message}`, 'error');

  const today = new Date().toISOString().slice(0, 10);
  sendTelegramAlertOnce(
    `🛑 ${name} failing ${policy === 'closed' ? 'CLOSED (blocking requests)' : 'OPEN'} — dependency unavailable: ${message}`,
    `tg:failpolicy:${name}:${today}`,
    3600
  );
}
```

- [ ] **Step 2: Write `api/_lib/failure-policy.test.js`**

```js
// Tests for guardedCheck — the shared fail-open/fail-closed decision used by
// checkDailyCap, checkUserCap (closed) and rateLimitCheck (open).

import { describe, it, expect, beforeEach, vi } from 'vitest'

vi.mock('./telegram.js', () => ({ sendTelegramAlertOnce: vi.fn() }))
vi.mock('./sentry-server.js', () => ({ Sentry: { captureMessage: vi.fn() } }))
vi.mock('./system-log.js', () => ({ writeSystemLog: vi.fn() }))

const { guardedCheck } = await import('./failure-policy.js')
const { sendTelegramAlertOnce } = await import('./telegram.js')
const { Sentry } = await import('./sentry-server.js')
const { writeSystemLog } = await import('./system-log.js')

beforeEach(() => {
  vi.clearAllMocks()
})

describe('guardedCheck', () => {
  it('returns the checkFn result when it resolves, and records nothing', async () => {
    const r = await guardedCheck(
      async () => ({ allowed: true, spent: 1, cap: 10 }),
      { policy: 'closed', name: 'test-check', openResult: { allowed: true }, closedResult: { allowed: false } }
    )
    expect(r).toEqual({ allowed: true, spent: 1, cap: 10 })
    expect(writeSystemLog).not.toHaveBeenCalled()
    expect(sendTelegramAlertOnce).not.toHaveBeenCalled()
  })

  it('policy closed: returns closedResult when checkFn throws', async () => {
    const r = await guardedCheck(
      async () => { throw new Error('supabase down') },
      { policy: 'closed', name: 'test-check', openResult: { allowed: true }, closedResult: { allowed: false, spent: 0, cap: 10 } }
    )
    expect(r).toEqual({ allowed: false, spent: 0, cap: 10 })
  })

  it('policy open: returns openResult when checkFn throws', async () => {
    const r = await guardedCheck(
      async () => { throw new Error('redis down') },
      { policy: 'open', name: 'test-check', openResult: { allowed: true, reason: '' }, closedResult: { allowed: false } }
    )
    expect(r).toEqual({ allowed: true, reason: '' })
  })

  it('records the trip once: system_logs, Sentry, and a deduplicated Telegram alert', async () => {
    await guardedCheck(
      async () => { throw new Error('boom') },
      { policy: 'closed', name: 'test-check', openResult: null, closedResult: null }
    )
    expect(writeSystemLog).toHaveBeenCalledTimes(1)
    expect(writeSystemLog).toHaveBeenCalledWith(expect.objectContaining({
      feature: 'fail-closed:test-check',
      severity: 'error',
    }))
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
    expect(sendTelegramAlertOnce).toHaveBeenCalledTimes(1)
    const [message, dedupeKey] = sendTelegramAlertOnce.mock.calls[0]
    expect(message).toContain('test-check')
    expect(message).toContain('CLOSED')
    expect(dedupeKey).toMatch(/^tg:failpolicy:test-check:\d{4}-\d{2}-\d{2}$/)
  })

  it('never throws, even if checkFn rejects with a non-Error', async () => {
    await expect(guardedCheck(
      async () => { throw 'raw string error' },
      { policy: 'open', name: 'test-check', openResult: 'fallback', closedResult: null }
    )).resolves.toBe('fallback')
  })
})
```

- [ ] **Step 3: Run the new test file, confirm it passes**

Run: `npx vitest run api/_lib/failure-policy.test.js`
Expected: 5 tests pass.

- [ ] **Step 4: Rewrite `checkDailyCap` and `checkUserCap` in `api/_lib/usage-tracker.js` to fail closed**

In `api/_lib/usage-tracker.js`, add the import at the top (after the existing `redis` import):

```js
import { guardedCheck } from './failure-policy.js';
```

Replace the whole `checkDailyCap` function (currently lines 112–135) with:

```js
/**
 * Checks whether today's cumulative Claude spend is still under DAILY_CAP_USD.
 * Fails CLOSED (returns allowed: false) if the DB is unreachable — an infra
 * outage must never uncap spend. The trip is recorded via guardedCheck
 * (system_logs counter + deduplicated Sentry + Telegram alert).
 * @returns {Promise<{ allowed: boolean, spent: number, cap: number }>}
 */
export async function checkDailyCap() {
  const cap = parseFloat(process.env.DAILY_CAP_USD || '10');
  return guardedCheck(
    async () => {
      const { data, error } = await supabaseAdmin
        .from('daily_usage')
        .select('total_cost_usd')
        .eq('date', todayDate())
        .maybeSingle();

      if (error) throw error;
      if (!data) return { allowed: true, spent: 0, cap };

      const spent = parseFloat(data.total_cost_usd) || 0;
      return { allowed: spent < cap, spent, cap };
    },
    {
      policy:       'closed',
      name:         'checkDailyCap',
      openResult:   { allowed: true,  spent: 0, cap },
      closedResult: { allowed: false, spent: 0, cap },
    }
  );
}
```

Replace the whole `checkUserCap` function (currently lines 160–179) with:

```js
/**
 * Checks whether a single user is still under their per-user daily spend ceiling.
 * Free and paid users get different ceilings. Fails CLOSED (allowed: false) on
 * any Redis error — an infra outage must never uncap spend, matching checkDailyCap.
 * The trip is recorded via guardedCheck (system_logs counter + deduplicated
 * Sentry + Telegram alert).
 * @param {string}  userId - Verified Supabase user id
 * @param {boolean} isPaid - true if the user holds any paid entitlement
 * @returns {Promise<{ allowed: boolean, spent: number, cap: number, isPaid: boolean }>}
 */
export async function checkUserCap(userId, isPaid) {
  const cap = isPaid ? PAID_USER_DAILY_CAP_USD : FREE_USER_DAILY_CAP_USD;
  if (!userId) return { allowed: true, spent: 0, cap, isPaid: !!isPaid };

  return guardedCheck(
    async () => {
      const raw   = await redis.get(userCostKey(userId));
      const spent = parseFloat(raw) || 0;
      return { allowed: spent < cap, spent, cap, isPaid: !!isPaid };
    },
    {
      policy:       'closed',
      name:         'checkUserCap',
      openResult:   { allowed: true,  spent: 0, cap, isPaid: !!isPaid },
      closedResult: { allowed: false, spent: 0, cap, isPaid: !!isPaid },
    }
  );
}
```

- [ ] **Step 5: Rewrite `api/_lib/usage-tracker.test.js` — invert the fail-open assertion, add checkDailyCap coverage**

Replace the whole file with:

```js
// Tests for the spend ceilings: checkDailyCap (global) + checkUserCap (per-user)
// + trackUserUsage.
//
// This is the P0 abuse defence — without it one free-tier account (or an infra
// outage) can drain the global DAILY_CAP_USD and deny service to paying users.
// Both caps now fail CLOSED on a dependency outage (W2 — see
// docs/architecture/2026-08-02-w2-failure-policy-decision-table.md, row 2/3):
// a regression here either re-opens the uncapped-spend hole, or wrongly locks
// out legitimate users.
//
// Strategy: mock the redis handle (from rate-limit.js) and supabaseAdmin's
// `.from()` chain so each test programs its own counter/row value, and stub
// out failure-policy.js's alerting dependencies so trips don't hit real infra.

import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => ({ redis: null, supabaseFrom: null }))

vi.mock('./supabase-admin.js', () => ({
  supabaseAdmin: { from: (...a) => h.supabaseFrom(...a) },
}))
vi.mock('./rate-limit.js', () => ({
  redis: {
    get:        (...a) => h.redis.get(...a),
    incrbyfloat:(...a) => h.redis.incrbyfloat(...a),
    expire:     (...a) => h.redis.expire(...a),
  },
}))
vi.mock('./telegram.js', () => ({ sendTelegramAlertOnce: vi.fn() }))
vi.mock('./sentry-server.js', () => ({ Sentry: { captureMessage: vi.fn() } }))
vi.mock('./system-log.js', () => ({ writeSystemLog: vi.fn() }))

const { checkUserCap, trackUserUsage, checkDailyCap } = await import('./usage-tracker.js')

const FREE_CAP = 0.75
const PAID_CAP = 4

function supabaseFromReturning(maybeSingleResult) {
  return vi.fn(() => ({
    select: vi.fn().mockReturnThis(),
    eq:     vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockResolvedValue(maybeSingleResult),
  }))
}

beforeEach(() => {
  h.redis = {
    get:         vi.fn().mockResolvedValue(null),
    incrbyfloat: vi.fn().mockResolvedValue('0'),
    expire:      vi.fn().mockResolvedValue(1),
  }
  h.supabaseFrom = supabaseFromReturning({ data: null, error: null })
  delete process.env.DAILY_CAP_USD
})

describe('checkUserCap', () => {
  it('allows a free user under the free ceiling', async () => {
    h.redis.get.mockResolvedValue('0.40')
    const r = await checkUserCap('user-1', false)
    expect(r).toMatchObject({ allowed: true, cap: FREE_CAP, isPaid: false })
    expect(r.spent).toBeCloseTo(0.40)
  })

  it('blocks a free user at or over the free ceiling', async () => {
    h.redis.get.mockResolvedValue('0.80')
    const r = await checkUserCap('user-1', false)
    expect(r.allowed).toBe(false)
    expect(r.cap).toBe(FREE_CAP)
  })

  it('blocks exactly at the ceiling (spent === cap is not allowed)', async () => {
    h.redis.get.mockResolvedValue(String(FREE_CAP))
    const r = await checkUserCap('user-1', false)
    expect(r.allowed).toBe(false)
  })

  it('gives paid users the higher ceiling — spend above the free cap still passes', async () => {
    h.redis.get.mockResolvedValue('1.50')
    const r = await checkUserCap('user-1', true)
    expect(r).toMatchObject({ allowed: true, cap: PAID_CAP, isPaid: true })
  })

  it('blocks a paid user over the paid ceiling', async () => {
    h.redis.get.mockResolvedValue('4.20')
    const r = await checkUserCap('user-1', true)
    expect(r.allowed).toBe(false)
    expect(r.cap).toBe(PAID_CAP)
  })

  it('treats a missing counter as zero spend', async () => {
    h.redis.get.mockResolvedValue(null)
    const r = await checkUserCap('user-1', false)
    expect(r).toMatchObject({ allowed: true, spent: 0 })
  })

  it('allows when there is no userId (cannot key a counter)', async () => {
    const r = await checkUserCap(null, false)
    expect(r.allowed).toBe(true)
    expect(h.redis.get).not.toHaveBeenCalled()
  })

  it('FAILS CLOSED when redis throws — an outage must never uncap spend', async () => {
    h.redis.get.mockRejectedValue(new Error('redis down'))
    const r = await checkUserCap('user-1', false)
    expect(r.allowed).toBe(false)
  })
})

describe('checkDailyCap', () => {
  it('allows when spent is under the cap', async () => {
    process.env.DAILY_CAP_USD = '10'
    h.supabaseFrom = supabaseFromReturning({ data: { total_cost_usd: '3.50' }, error: null })
    const r = await checkDailyCap()
    expect(r).toMatchObject({ allowed: true, spent: 3.5, cap: 10 })
  })

  it('blocks when spent is at or over the cap', async () => {
    process.env.DAILY_CAP_USD = '10'
    h.supabaseFrom = supabaseFromReturning({ data: { total_cost_usd: '10' }, error: null })
    const r = await checkDailyCap()
    expect(r.allowed).toBe(false)
  })

  it('treats a missing row as zero spend, allowed', async () => {
    h.supabaseFrom = supabaseFromReturning({ data: null, error: null })
    const r = await checkDailyCap()
    expect(r).toMatchObject({ allowed: true, spent: 0 })
  })

  it('defaults the cap to 10 when DAILY_CAP_USD is unset', async () => {
    h.supabaseFrom = supabaseFromReturning({ data: null, error: null })
    const r = await checkDailyCap()
    expect(r.cap).toBe(10)
  })

  it('FAILS CLOSED when the Supabase query errors — an outage must never uncap spend', async () => {
    h.supabaseFrom = supabaseFromReturning({ data: null, error: new Error('db error') })
    const r = await checkDailyCap()
    expect(r.allowed).toBe(false)
  })

  it('FAILS CLOSED when the Supabase call throws outright', async () => {
    h.supabaseFrom = vi.fn(() => { throw new Error('connection refused') })
    const r = await checkDailyCap()
    expect(r.allowed).toBe(false)
  })
})

describe('trackUserUsage', () => {
  it('adds the call cost to the user counter and refreshes its TTL', async () => {
    await trackUserUsage('user-1', 1000, 1000) // 1000*3/1e6 + 1000*15/1e6 = 0.018
    expect(h.redis.incrbyfloat).toHaveBeenCalledTimes(1)
    const [key, amount] = h.redis.incrbyfloat.mock.calls[0]
    expect(key).toMatch(/^cost:user:user-1:\d{4}-\d{2}-\d{2}$/)
    expect(amount).toBeCloseTo(0.018)
    expect(h.redis.expire).toHaveBeenCalledWith(key, expect.any(Number))
  })

  it('is a no-op without a userId', async () => {
    await trackUserUsage(null, 1000, 1000)
    expect(h.redis.incrbyfloat).not.toHaveBeenCalled()
  })

  it('never throws when redis fails (cost tracking is best-effort)', async () => {
    h.redis.incrbyfloat.mockRejectedValue(new Error('redis down'))
    await expect(trackUserUsage('user-1', 500, 500)).resolves.toBeUndefined()
  })
})

describe('model-aware pricing', () => {
  it('prices Sonnet calls at $3 in / $15 out per 1M tokens', async () => {
    await trackUserUsage('user-1', 1_000_000, 100_000, 'claude-sonnet-4-6')
    const [, amount] = h.redis.incrbyfloat.mock.calls[0]
    expect(amount).toBeCloseTo(3 + 1.5)
  })

  it('prices Haiku calls at $1 in / $5 out per 1M tokens', async () => {
    await trackUserUsage('user-1', 1_000_000, 100_000, 'claude-haiku-4-5-20251001')
    const [, amount] = h.redis.incrbyfloat.mock.calls[0]
    expect(amount).toBeCloseTo(1 + 0.5)
  })

  it('falls back to Sonnet rates for an unknown model ID', async () => {
    await trackUserUsage('user-1', 1000, 1000, 'claude-nonexistent-9')
    const [, amount] = h.redis.incrbyfloat.mock.calls[0]
    expect(amount).toBeCloseTo(0.018)
  })

  it('falls back to Sonnet rates when model is omitted (legacy call sites)', async () => {
    await trackUserUsage('user-1', 1000, 1000)
    const [, amount] = h.redis.incrbyfloat.mock.calls[0]
    expect(amount).toBeCloseTo(0.018)
  })
})
```

- [ ] **Step 6: Run both test files, confirm they pass**

Run: `npx vitest run api/_lib/usage-tracker.test.js api/_lib/failure-policy.test.js`
Expected: all tests pass (usage-tracker.test.js grows from 13 to 19 tests).

- [ ] **Step 7: Typecheck and commit**

```bash
npm run typecheck
git add api/_lib/failure-policy.js api/_lib/failure-policy.test.js api/_lib/usage-tracker.js api/_lib/usage-tracker.test.js
git commit -m "fix: fail closed on spend-cap dependency outage (W2)"
```

---

### Task 3: Fail-open rate limiting through the same helper + `ai.js` cleanup

**Files:**
- Modify: `api/_lib/rate-limit.js` (`rateLimitCheck`)
- Create: `api/_lib/rate-limit.test.js`
- Modify: `api/ai.js` (12 call sites: 7 `rateLimitCheck`, 5 `checkDailyCap`)

**Interfaces:**
- Consumes: `guardedCheck` from `./failure-policy.js` (Task 2).
- Produces: `rateLimitCheck(req, limits)` now **never throws** (previously it threw on Redis failure and every caller had to `.catch()`). Its resolved shape (`{ allowed, reason }`) is unchanged, so callers that only ever read the resolved value are unaffected.

- [ ] **Step 1: Wrap `rateLimitCheck` with `guardedCheck` (policy: open)**

In `api/_lib/rate-limit.js`, add the import at the top:

```js
import { guardedCheck } from './failure-policy.js';
```

Rename the existing function body to an internal helper and wrap it. Replace the whole `rateLimitCheck` function (currently lines 49–98) with:

```js
/**
 * Enforces per-IP and per-user daily rate limits via Upstash Redis fixedWindow counters.
 * Call at the top of any serverless handler. Fails OPEN on any Redis error — a cache
 * outage must never lock out legitimate users; the trip is recorded via guardedCheck
 * (system_logs counter + deduplicated Sentry + Telegram alert). Never throws.
 * @param {object} req            - Vercel request object (reads x-forwarded-for and Authorization)
 * @param {object} limits         - Rate limit configuration
 * @param {number} limits.userDay - Max requests per authenticated user per UTC calendar day
 * @param {number} limits.ipDay   - Max requests per IP per UTC calendar day
 * @param {string} limits.prefix  - Redis key namespace (e.g. 'claude', 'defense')
 * @returns {Promise<{ allowed: boolean, reason: string }>}
 */
export async function rateLimitCheck(req, limits) {
  return guardedCheck(
    () => rateLimitCheckUnguarded(req, limits),
    {
      policy:       'open',
      name:         `rateLimit:${limits.prefix || 'default'}`,
      openResult:   { allowed: true, reason: '' },
      closedResult: { allowed: false, reason: 'Rate limit check unavailable.' },
    }
  );
}

async function rateLimitCheckUnguarded(req, limits) {
  const { userDay, ipDay, prefix = 'default' } = limits;

  const ip = String(
    req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
  ).split(',')[0].trim();

  const userId = extractUserId(req);

  // IP check — fixed calendar-day window, applies to all requests (authenticated or not)
  const ipLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.fixedWindow(ipDay, '1 d'),
    prefix: `rl:ip:${prefix}`,
  });

  const ipResult = await ipLimiter.limit(ip);
  if (!ipResult.success) {
    return { allowed: false, reason: 'Rate limit exceeded. Try again tomorrow.' };
  }

  // User check — fixed calendar-day key resets at UTC midnight.
  // Key: userId:YYYY-MM-DD — each new day gets a fresh Redis entry.
  if (userId) {
    const userLimiter = new Ratelimit({
      redis,
      limiter: Ratelimit.fixedWindow(userDay, '1 d'),
      prefix: `rl:user:${prefix}`,
    });

    const dateKey = `${userId}:${utcDateKey()}`;
    const userResult = await userLimiter.limit(dateKey);
    if (!userResult.success) {
      return { allowed: false, reason: 'Daily limit reached. Your allowance resets at midnight UTC.' };
    }
  }

  return { allowed: true, reason: '' };
}
```

Note the JSDoc `@throws` line from the old version is removed — `rateLimitCheck` no longer throws.

- [ ] **Step 2: Write `api/_lib/rate-limit.test.js`**

```js
// Tests for rateLimitCheck — the shared per-IP + per-user daily limiter.
// Fails OPEN on a Redis outage (W2 — see
// docs/architecture/2026-08-02-w2-failure-policy-decision-table.md, row 1):
// unlike the spend caps, availability wins here. The trip must still be
// recorded, never silent.

import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => ({ limit: null }))

vi.mock('@upstash/redis', () => ({ Redis: vi.fn(() => ({})) }))
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: Object.assign(
    vi.fn(() => ({ limit: (...a) => h.limit(...a) })),
    { fixedWindow: vi.fn(() => 'fixedWindow-config') }
  ),
}))
vi.mock('./telegram.js', () => ({ sendTelegramAlertOnce: vi.fn() }))
vi.mock('./sentry-server.js', () => ({ Sentry: { captureMessage: vi.fn() } }))
vi.mock('./system-log.js', () => ({ writeSystemLog: vi.fn() }))

const { rateLimitCheck } = await import('./rate-limit.js')

function makeReq({ headers = {}, ip = '1.2.3.4', token = null } = {}) {
  const authHeader = token
    ? `Bearer header.${Buffer.from(JSON.stringify({ sub: token })).toString('base64')}.sig`
    : undefined;
  return {
    headers: { 'x-forwarded-for': ip, ...(authHeader ? { authorization: authHeader } : {}), ...headers },
    socket: {},
  };
}

beforeEach(() => {
  h.limit = vi.fn().mockResolvedValue({ success: true })
})

describe('rateLimitCheck', () => {
  it('allows a request under both the IP and user limits', async () => {
    const r = await rateLimitCheck(makeReq({ token: 'user-1' }), { userDay: 10, ipDay: 20, prefix: 'test' })
    expect(r).toEqual({ allowed: true, reason: '' })
  })

  it('blocks when the IP limiter reports failure', async () => {
    h.limit = vi.fn().mockResolvedValue({ success: false })
    const r = await rateLimitCheck(makeReq(), { userDay: 10, ipDay: 20, prefix: 'test' })
    expect(r.allowed).toBe(false)
    expect(r.reason).toMatch(/tomorrow/)
  })

  it('skips the user check when there is no authenticated user', async () => {
    const r = await rateLimitCheck(makeReq(), { userDay: 10, ipDay: 20, prefix: 'test' })
    expect(r.allowed).toBe(true)
    expect(h.limit).toHaveBeenCalledTimes(1) // only the IP limiter
  })

  it('FAILS OPEN when Redis throws — an outage must never lock out legitimate users', async () => {
    h.limit = vi.fn().mockRejectedValue(new Error('redis down'))
    const r = await rateLimitCheck(makeReq({ token: 'user-1' }), { userDay: 10, ipDay: 20, prefix: 'test' })
    expect(r.allowed).toBe(true)
  })

  it('never throws even when Redis is unreachable', async () => {
    h.limit = vi.fn().mockRejectedValue(new Error('ECONNREFUSED'))
    await expect(
      rateLimitCheck(makeReq(), { userDay: 10, ipDay: 20, prefix: 'test' })
    ).resolves.toBeDefined()
  })
})
```

- [ ] **Step 3: Run the new test file, confirm it passes**

Run: `npx vitest run api/_lib/rate-limit.test.js`
Expected: 5 tests pass.

- [ ] **Step 4: Remove the 12 now-redundant inline catch blocks in `api/ai.js`**

`rateLimitCheck` and `checkDailyCap` no longer throw, so every `.catch(...)` wrapped
around them is dead code that would silently mask a real bug if one were ever
reintroduced. Remove all 12, at these exact locations (grep `rateLimitCheck(req,` and
`checkDailyCap()` in `api/ai.js` to re-find them if line numbers have shifted from a
prior task's edits):

**Line 87–91** (`handleGeneral`), replace:
```js
      rateLimitCheck(req, { userDay: 30, ipDay: 60, prefix: 'claude' }).catch(rlErr => {
        traceLog(traceId, 'error', '[ai/general] rateLimitCheck threw (failing open):', rlErr.message);
        return { allowed: true, reason: '' };
      }),
      checkDailyCap().catch(() => ({ allowed: true, spent: 0, cap: 10 })),
```
with:
```js
      rateLimitCheck(req, { userDay: 30, ipDay: 60, prefix: 'claude' }),
      checkDailyCap(),
```

**Line 399** (`handleFinalizeDefense`), replace:
```js
      rateLimitCheck(req, { userDay: 20, ipDay: 40, prefix: 'finalize-defense' }).catch(() => ({ allowed: true, reason: '' })),
```
with:
```js
      rateLimitCheck(req, { userDay: 20, ipDay: 40, prefix: 'finalize-defense' }),
```

**Lines 499–503** (`handleDefense`), replace:
```js
      rateLimitCheck(req, { userDay: 20, ipDay: 40, prefix: 'defense' }).catch(rlErr => {
        traceLog(traceId, 'error', '[ai/defense] rateLimitCheck threw (failing open):', rlErr.message);
        return { allowed: true, reason: '' };
      }),
      checkDailyCap().catch(() => ({ allowed: true, spent: 0, cap: 10 })),
```
with:
```js
      rateLimitCheck(req, { userDay: 20, ipDay: 40, prefix: 'defense' }),
      checkDailyCap(),
```

**Lines 711–712** (`handleSupervisorPrep`), replace:
```js
      rateLimitCheck(req, { userDay: 5, ipDay: 15, prefix: 'supervisor-prep' }).catch(() => ({ allowed: true, reason: '' })),
      checkDailyCap().catch(() => ({ allowed: true })),
```
with:
```js
      rateLimitCheck(req, { userDay: 5, ipDay: 15, prefix: 'supervisor-prep' }),
      checkDailyCap(),
```

**Lines 828–831** (`handleCheckAchievements`), replace:
```js
  const rl = await rateLimitCheck(req, { userDay: 30, ipDay: 60, prefix: 'check-achievements' }).catch(rlErr => {
    console.error('[ai/check-achievements] rateLimitCheck threw (failing open):', rlErr.message);
    return { allowed: true, reason: '' };
  });
```
with:
```js
  const rl = await rateLimitCheck(req, { userDay: 30, ipDay: 60, prefix: 'check-achievements' });
```

**Lines 1014–1015** (`handleDefenceBrief`), replace:
```js
      rateLimitCheck(req, { userDay: 30, ipDay: 60, prefix: 'defence-brief' }).catch(() => ({ allowed: true, reason: '' })),
      checkDailyCap().catch(() => ({ allowed: true, spent: 0, cap: 10 })),
```
with:
```js
      rateLimitCheck(req, { userDay: 30, ipDay: 60, prefix: 'defence-brief' }),
      checkDailyCap(),
```

**Lines 1119–1120** (`handleDefenceBriefCoach`), replace:
```js
      rateLimitCheck(req, { userDay: 60, ipDay: 120, prefix: 'defence-brief-coach' }).catch(() => ({ allowed: true, reason: '' })),
      checkDailyCap().catch(() => ({ allowed: true, spent: 0, cap: 10 })),
```
with:
```js
      rateLimitCheck(req, { userDay: 60, ipDay: 120, prefix: 'defence-brief-coach' }),
      checkDailyCap(),
```

After this step, `api/ai.js` should have zero occurrences of `.catch(` immediately
following a `rateLimitCheck(` or `checkDailyCap(` call. Verify with:

Run: `grep -n "rateLimitCheck(req.*\.catch\|checkDailyCap().catch" api/ai.js`
Expected: no output.

- [ ] **Step 5: Run the full ai.js test suite, confirm nothing broke**

Run: `npx vitest run api/ai.finalize-defense.test.js`
Expected: all existing tests still pass — the test file mocks `rateLimitCheck` and
`checkDailyCap` directly and asserts on their resolved shape, which is unchanged.

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add api/_lib/rate-limit.js api/_lib/rate-limit.test.js api/ai.js
git commit -m "refactor: move rate-limit fail-open policy into guardedCheck, drop 12 dead catch blocks in ai.js (W2)"
```

---

### Task 4: `reliable-async.js` retry + dead-letter helper

**Files:**
- Create: `migrations/0042_dead_letter_queue.sql`
- Create: `api/_lib/reliable-async.js`
- Create: `api/_lib/reliable-async.test.js`
- Modify: `api/_lib/telegram.js` (`sendTelegramAlert`)
- Create: `api/_lib/telegram.test.js`

**Interfaces:**
- Produces: `reliably(fn, { feature, payload })` from `api/_lib/reliable-async.js` — runs `fn()`, retrying twice with backoff (500ms, then 2000ms) on failure; if all 3 attempts fail, writes a row to `dead_letter_queue` and captures a Sentry message. Never throws. Returns `Promise<{ ok: boolean }>`. Task 5 consumes this directly for the three named fire-and-forget call sites.
- Consumes: `supabaseAdmin` from `./supabase-admin.js`, `Sentry` from `./sentry-server.js` (both already exist).

- [ ] **Step 1: Write the migration**

Create `migrations/0042_dead_letter_queue.sql`:

```sql
-- Migration 0042: dead_letter_queue
-- Records fire-and-forget side effects (Telegram alerts, nurture email triggers,
-- notification inserts) that failed even after retrying — see
-- api/_lib/reliable-async.js and
-- docs/architecture/2026-08-02-w2-failure-policy-decision-table.md.
-- Run in Supabase SQL Editor. Verify RLS check at the bottom.

CREATE TABLE public.dead_letter_queue (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  feature       text        NOT NULL,
  payload       jsonb,
  error_message text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  resolved_at   timestamptz
);

CREATE INDEX dead_letter_queue_created_idx ON public.dead_letter_queue(created_at DESC);
CREATE INDEX dead_letter_queue_feature_idx ON public.dead_letter_queue(feature);

ALTER TABLE public.dead_letter_queue ENABLE ROW LEVEL SECURITY;
-- No policies: this table is written only by supabaseAdmin (service role,
-- which bypasses RLS). There is no legitimate client-side read or write path.

-- Verify: must return zero rows
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
```

- [ ] **Step 2: Run the migration lint**

Run: `npm run lint:migrations`
Expected: passes — `0042` is the next sequential number after `0041`.

- [ ] **Step 3: Write `api/_lib/reliable-async.js`**

```js
// Retry-then-dead-letter wrapper for side effects that must not be silently
// dropped (an alert that never sends, a nurture email trigger that never
// fires). Vercel freezes a function once its response is sent — an
// un-awaited promise still in flight risks never completing (the same bug
// class as the unawaited login Telegram alert fixed in be60a7b). Callers of
// `reliably()` must `await` it, before sending the response, so the retries
// actually get to run.

import { supabaseAdmin } from './supabase-admin.js';
import { Sentry } from './sentry-server.js';

const RETRY_DELAYS_MS = [500, 2000]; // 3 total attempts: immediate, +500ms, +2000ms

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Runs `fn`, retrying with backoff on failure. If every attempt fails,
 * writes a row to dead_letter_queue and captures a Sentry message, so the
 * failure is recorded rather than silently lost. Never throws.
 * @param {() => Promise<void>} fn
 * @param {object} meta
 * @param {string} meta.feature    - short id, e.g. 'nurture-email:welcome'
 * @param {object} [meta.payload]  - JSON-serialisable context for later inspection/replay
 * @returns {Promise<{ ok: boolean }>}
 */
export async function reliably(fn, { feature, payload }) {
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
    try {
      await fn();
      return { ok: true };
    } catch (err) {
      lastErr = err;
      if (attempt < RETRY_DELAYS_MS.length) await delay(RETRY_DELAYS_MS[attempt]);
    }
  }
  await deadLetter(feature, payload, lastErr);
  return { ok: false };
}

async function deadLetter(feature, payload, err) {
  const message = String(err?.message || err);
  console.error(`[reliable-async] ${feature} exhausted retries — dead-lettering:`, message);

  Sentry.captureMessage(
    `[dead-letter] ${feature} failed after ${RETRY_DELAYS_MS.length + 1} attempts: ${message}`,
    'error'
  );

  try {
    await supabaseAdmin.from('dead_letter_queue').insert({
      feature,
      payload:       payload ?? null,
      error_message: message.slice(0, 500),
    });
  } catch (dlErr) {
    console.error('[reliable-async] dead-letter insert also failed:', dlErr?.message);
  }
}
```

- [ ] **Step 4: Write `api/_lib/reliable-async.test.js`**

```js
// Tests for reliably() — retry with backoff, then dead-letter on exhaustion.
// Uses real timers with tiny delays would be flaky; fake timers keep this fast
// and deterministic.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

const h = vi.hoisted(() => ({ insert: null }))

vi.mock('./supabase-admin.js', () => ({
  supabaseAdmin: { from: () => ({ insert: (...a) => h.insert(...a) }) },
}))
vi.mock('./sentry-server.js', () => ({ Sentry: { captureMessage: vi.fn() } }))

const { reliably } = await import('./reliable-async.js')
const { Sentry } = await import('./sentry-server.js')

beforeEach(() => {
  vi.useFakeTimers()
  h.insert = vi.fn().mockResolvedValue({ error: null })
  Sentry.captureMessage.mockClear()
})

afterEach(() => {
  vi.useRealTimers()
})

async function runWithFakeTimers(promise) {
  // Drain both retry backoff windows (500ms, 2000ms) so the promise can settle.
  await vi.advanceTimersByTimeAsync(500)
  await vi.advanceTimersByTimeAsync(2000)
  return promise
}

describe('reliably', () => {
  it('succeeds on the first attempt without retrying', async () => {
    const fn = vi.fn().mockResolvedValue(undefined)
    const result = await reliably(fn, { feature: 'test' })
    expect(result).toEqual({ ok: true })
    expect(fn).toHaveBeenCalledTimes(1)
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('retries after a failure and succeeds on the second attempt', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('transient'))
      .mockResolvedValueOnce(undefined)
    const promise = reliably(fn, { feature: 'test' })
    const result = await runWithFakeTimers(promise)
    expect(result).toEqual({ ok: true })
    expect(fn).toHaveBeenCalledTimes(2)
    expect(h.insert).not.toHaveBeenCalled()
  })

  it('dead-letters after 3 total failed attempts', async () => {
    const fn = vi.fn().mockRejectedValue(new Error('permanently down'))
    const promise = reliably(fn, { feature: 'test-feature', payload: { a: 1 } })
    const result = await runWithFakeTimers(promise)
    expect(result).toEqual({ ok: false })
    expect(fn).toHaveBeenCalledTimes(3)
    expect(h.insert).toHaveBeenCalledTimes(1)
    expect(h.insert).toHaveBeenCalledWith(expect.objectContaining({
      feature: 'test-feature',
      payload: { a: 1 },
      error_message: expect.stringContaining('permanently down'),
    }))
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1)
  })

  it('never throws even if the dead-letter insert itself fails', async () => {
    h.insert = vi.fn().mockRejectedValue(new Error('db also down'))
    const fn = vi.fn().mockRejectedValue(new Error('permanently down'))
    const promise = reliably(fn, { feature: 'test' })
    await expect(runWithFakeTimers(promise)).resolves.toEqual({ ok: false })
  })
})
```

- [ ] **Step 5: Run the new test file, confirm it passes**

Run: `npx vitest run api/_lib/reliable-async.test.js`
Expected: 4 tests pass.

- [ ] **Step 6: Wrap `sendTelegramAlert`'s fetch with `reliably`**

In `api/_lib/telegram.js`, add the import at the top:

```js
import { reliably } from './reliable-async.js'
```

Replace the whole `sendTelegramAlert` function with:

```js
/**
 * Sends a Telegram alert, retrying with backoff and dead-lettering on
 * exhaustion (W2). No-ops silently if TELEGRAM_BOT_TOKEN or TELEGRAM_CHAT_ID
 * are not set. Never throws.
 *
 * This only guarantees delivery for callers that `await` it — Vercel can
 * still cut an un-awaited promise short once the response is sent. Most
 * call sites across api/ already await this; the ones that intentionally
 * don't (documented in the W2 decision table, row 11) keep that trade-off.
 */
export async function sendTelegramAlert(message) {
  const token  = process.env.TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHAT_ID
  if (!token || !chatId) return

  await reliably(async () => {
    const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text: message, parse_mode: 'HTML' }),
      signal:  AbortSignal.timeout(8000),
    })
    if (!res.ok) throw new Error(`Telegram API ${res.status}`)
  }, { feature: 'telegram-alert', payload: { message: message.slice(0, 200) } })
}
```

Note the added `if (!res.ok) throw` — the original code treated any non-throwing
`fetch` as success even on a 4xx/5xx from Telegram, so retries never triggered on a
Telegram-side error (only on a network failure). This is a genuine behavior fix
needed for `reliably()`'s retries to mean anything here.

- [ ] **Step 7: Write `api/_lib/telegram.test.js`**

```js
// Tests for sendTelegramAlert/sendTelegramAlertOnce.
// sendTelegramAlert now retries via reliably() (W2) — see reliable-async.test.js
// for retry/dead-letter coverage; these tests focus on telegram.js's own logic:
// env-var no-op, non-ok response handling, and the dedupe wrapper.

import { describe, it, expect, beforeEach, vi } from 'vitest'

const originalFetch = global.fetch

vi.mock('./reliable-async.js', () => ({ reliably: vi.fn() }))

const { sendTelegramAlert, sendTelegramAlertOnce, escapeTgHtml } = await import('./telegram.js')
const { reliably } = await import('./reliable-async.js')

beforeEach(() => {
  process.env.TELEGRAM_BOT_TOKEN = 'test-token'
  process.env.TELEGRAM_CHAT_ID   = 'test-chat'
  reliably.mockReset()
})

afterEach(() => {
  global.fetch = originalFetch
  delete process.env.TELEGRAM_BOT_TOKEN
  delete process.env.TELEGRAM_CHAT_ID
})

describe('sendTelegramAlert', () => {
  it('no-ops without throwing when TELEGRAM_BOT_TOKEN is unset', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN
    await expect(sendTelegramAlert('hello')).resolves.toBeUndefined()
    expect(reliably).not.toHaveBeenCalled()
  })

  it('no-ops without throwing when TELEGRAM_CHAT_ID is unset', async () => {
    delete process.env.TELEGRAM_CHAT_ID
    await expect(sendTelegramAlert('hello')).resolves.toBeUndefined()
    expect(reliably).not.toHaveBeenCalled()
  })

  it('delegates to reliably() with the telegram-alert feature tag', async () => {
    reliably.mockResolvedValue({ ok: true })
    await sendTelegramAlert('hello world')
    expect(reliably).toHaveBeenCalledTimes(1)
    const [, meta] = reliably.mock.calls[0]
    expect(meta.feature).toBe('telegram-alert')
    expect(meta.payload.message).toContain('hello world')
  })

  it('the wrapped function throws on a non-ok Telegram response, so reliably() will retry it', async () => {
    reliably.mockImplementation(async (fn) => { await fn(); return { ok: true } })
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429 })
    await expect(sendTelegramAlert('hello')).rejects.toThrow('Telegram API 429')
  })

  it('the wrapped function resolves cleanly on a 200 from Telegram', async () => {
    reliably.mockImplementation(async (fn) => { await fn(); return { ok: true } })
    global.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    await expect(sendTelegramAlert('hello')).resolves.toBeUndefined()
  })
})

describe('escapeTgHtml', () => {
  it('escapes &, <, and >', () => {
    expect(escapeTgHtml('a < b & c > d')).toBe('a &lt; b &amp; c &gt; d')
  })
})

describe('sendTelegramAlertOnce', () => {
  it('calls sendTelegramAlert (via reliably) when no Redis is configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL
    reliably.mockResolvedValue({ ok: true })
    await sendTelegramAlertOnce('hi', 'dedupe-key-1')
    expect(reliably).toHaveBeenCalledTimes(1)
  })
})
```

- [ ] **Step 8: Run both test files, confirm they pass**

Run: `npx vitest run api/_lib/telegram.test.js api/_lib/reliable-async.test.js`
Expected: all tests pass.

- [ ] **Step 9: Typecheck and commit**

```bash
npm run typecheck
git add migrations/0042_dead_letter_queue.sql api/_lib/reliable-async.js api/_lib/reliable-async.test.js api/_lib/telegram.js api/_lib/telegram.test.js
git commit -m "feat: add retry + dead-letter handling for fire-and-forget side effects (W2)"
```

- [ ] **Step 10: Apply the migration**

Run `migrations/0042_dead_letter_queue.sql` in the Supabase SQL Editor (production
project `ayvunikgfwpylfrkpalj`, per CLAUDE.md §18), then run the RLS verification
query from the migration's last line and confirm it returns zero rows.

---

### Task 5: Await the three named fire-and-forget sites through `reliably()`

**Files:**
- Modify: `api/auth.js` (signup nurture email, ~line 216)
- Modify: `api/notify.js` (login nurture email, ~line 1266)
- Modify: `api/referral.js` (referrer notification, ~lines 128–144)
- Modify: `api/auth.test.js` (if it asserts on the fire-and-forget shape of the signup email call)

**Interfaces:**
- Consumes: `reliably` from `./_lib/reliable-async.js` (Task 4).

These are the three call sites named in the W2 decision table (Task 1, rows 12–14) as
matching "the same bug class as the unawaited login alert fixed in be60a7b" — a
side effect that can be silently lost if Vercel freezes the function before it
completes. All three become `await reliably(...)`.

- [ ] **Step 1: `api/auth.js` — await the signup welcome nurture email**

Add the import near the top of `api/auth.js` (alongside the existing `telegram.js`
import):

```js
import { reliably } from './_lib/reliable-async.js';
```

Replace the block (currently ~lines 215–221):

```js
    if (process.env.CRON_SECRET) {
      fetch(`${APP_URL}/api/send-nurture-email`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
        body:    JSON.stringify({ userId, emailType: 'welcome', email, name: full_name || '' }),
      }).catch(e => traceLog(traceId, 'error', '[auth/signup] welcome email failed:', e.message));
    }
```

with:

```js
    if (process.env.CRON_SECRET) {
      // Retried + dead-lettered on failure (W2) rather than silently dropped —
      // same bug class as the unawaited login alert fixed in be60a7b.
      const nurturePayload = { userId, emailType: 'welcome', email, name: full_name || '' };
      await reliably(async () => {
        const res = await fetch(`${APP_URL}/api/send-nurture-email`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
          body:    JSON.stringify(nurturePayload),
        });
        if (!res.ok) throw new Error(`send-nurture-email ${res.status}`);
      }, { feature: 'nurture-email:welcome', payload: nurturePayload });
    }
```

- [ ] **Step 2: Check and update `api/auth.test.js` if needed**

Run: `grep -n "welcome email\|send-nurture-email" api/auth.test.js`

If a test asserts the signup nurture-email fetch is fire-and-forget (not awaited) or
mocks `fetch` directly for this path without expecting a retry wrapper, update it to
mock `./_lib/reliable-async.js`'s `reliably` (matching the pattern in
`api/_lib/telegram.test.js` from Task 4) instead of asserting on raw `fetch` call
timing. If no such test exists, skip this step — Step 4 below covers overall
regression via the full suite run.

- [ ] **Step 3: `api/notify.js` — await the login nurture email**

Add the import near the top of `api/notify.js` (alongside the existing `telegram.js`
import):

```js
import { reliably } from './_lib/reliable-async.js'
```

Replace the block (currently ~lines 1258–1279):

```js
    try {
      // Telegram is awaited (matches the sibling oauth_signup branch above);
      // the nurture-email fetch below is intentionally NOT awaited — this
      // response doesn't depend on the email completing, unlike the inbound
      // Telegram webhook handler elsewhere in this file, which must await
      // before responding since Vercel freezes the function on res.end().
      await sendTelegramAlert(`🔓 Login: ${escapeTgHtml(email)} (IP: ${escapeTgHtml(ip)})`)
      if (process.env.CRON_SECRET) {
        fetch(`${APP_URL}/api/send-nurture-email`, {
          method:  'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
          body:    JSON.stringify({
            userId:    user.id,
            emailType: 'login_alert',
            email,
            name:      user.user_metadata?.full_name || '',
            ip,
            userAgent,
            loginAt:   new Date().toISOString(),
          }),
        }).catch(e => traceLog(traceId, 'error', '[notify/oauth_login] welcome email failed:', e.message))
      }
    } catch (e) {
      console.error('[notify/oauth_login] notification block failed:', e.message)
    }
```

with:

```js
    try {
      // Telegram is awaited (matches the sibling oauth_signup branch above).
      // The nurture-email fetch is now also awaited, through reliably() — W2
      // requires retry + dead-letter for this class of side effect, which only
      // works if the call is still in flight when the retries run: Vercel can
      // kill an un-awaited promise once the response is sent (see
      // api/_lib/reliable-async.js). The prior "don't block on this" choice
      // traded a few hundred ms of latency for not silently losing the email
      // on a transient failure — W2 makes the opposite trade.
      await sendTelegramAlert(`🔓 Login: ${escapeTgHtml(email)} (IP: ${escapeTgHtml(ip)})`)
      if (process.env.CRON_SECRET) {
        const nurturePayload = {
          userId:    user.id,
          emailType: 'login_alert',
          email,
          name:      user.user_metadata?.full_name || '',
          ip,
          userAgent,
          loginAt:   new Date().toISOString(),
        }
        await reliably(async () => {
          const res = await fetch(`${APP_URL}/api/send-nurture-email`, {
            method:  'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.CRON_SECRET}` },
            body:    JSON.stringify(nurturePayload),
          })
          if (!res.ok) throw new Error(`send-nurture-email ${res.status}`)
        }, { feature: 'nurture-email:login_alert', payload: nurturePayload })
      }
    } catch (e) {
      console.error('[notify/oauth_login] notification block failed:', e.message)
    }
```

- [ ] **Step 4: `api/referral.js` — await the referrer notification insert**

Add the import near the top of `api/referral.js` (alongside the existing
`telegram.js` import):

```js
import { reliably } from './_lib/reliable-async.js';
```

Replace the block (currently ~lines 128–144):

```js
  // Notify the referrer — best-effort
  supabaseAdmin
    .from('users')
    .select('full_name')
    .eq('id', newUser.id)
    .maybeSingle()
    .then(({ data: profile }) => {
      const referredName = profile?.full_name || normalEmail
      return supabaseAdmin.from('notifications').insert({
        user_id:  referrer.id,
        type:     'referral_join',
        title:    'Referral joined',
        message:  `${referredName} signed up using your referral link.`,
        metadata: { referred_name: referredName },
      })
    })
    .catch(e => console.error('[referral/track] notification insert failed:', e.message));
```

with:

```js
  // Notify the referrer — retried + dead-lettered on failure (W2) rather
  // than silently dropped.
  const { data: profile } = await supabaseAdmin
    .from('users')
    .select('full_name')
    .eq('id', newUser.id)
    .maybeSingle();
  const referredName = profile?.full_name || normalEmail;
  await reliably(async () => {
    const { error } = await supabaseAdmin.from('notifications').insert({
      user_id:  referrer.id,
      type:     'referral_join',
      title:    'Referral joined',
      message:  `${referredName} signed up using your referral link.`,
      metadata: { referred_name: referredName },
    });
    if (error) throw error;
  }, { feature: 'notification:referral_join', payload: { referrer_id: referrer.id, referred_name: referredName } });
```

- [ ] **Step 5: Run the full test suite, fix any breakage from the three call-site changes**

Run: `npm run test`
Expected: all tests pass. If `api/auth.test.js` (or any referral/notify test file)
fails because it asserted the old fire-and-forget timing, update its mocks to match
Step 2's guidance — mock `./_lib/reliable-async.js`'s `reliably` rather than raw
`fetch` timing.

- [ ] **Step 6: Typecheck and commit**

```bash
npm run typecheck
git add api/auth.js api/notify.js api/referral.js api/auth.test.js
git commit -m "fix: retry + dead-letter the 3 fire-and-forget side effects named in the W2 decision table" -m "Signup nurture email, login nurture email, referrer notification — same bug class as the unawaited login alert fixed in be60a7b."
```

(Drop `api/auth.test.js` from the `git add` if Step 5 required no changes to it.)

---

### Task 6: Drill — automated fail-closed/fail-open proof + manual runbook + spec closeout

**Files:**
- Create: `api/ai.failure-policy.test.js`
- Create: `docs/architecture/2026-08-02-w2-drill-runbook.md`
- Modify: `CLAUDE.md` (§3 file tree, §5 schema)
- Modify: `docs/specs/2026-07-31-infra-9-plus-program-design.md` (§8, add a "Verified" subsection)

**Interfaces:**
- Consumes: nothing new — exercises the real `api/ai.js` handler (default export) the
  same way `api/ai.finalize-defense.test.js` does, with `usage-tracker.js` and
  `rate-limit.js` mocked at their exported-function boundary (their internal
  fail-open/closed correctness is already proven by Tasks 2–3's unit tests; this task
  proves the *handler layer* correctly enforces whatever those functions return).

This is the "drill" — spec exit criterion 6: "revoke Upstash credentials in staging,
exercise every endpoint, and confirm observed behaviour matches the decision table row
for row." The automated part below exercises every endpoint's *code path* against a
simulated outage. **The live-credential part (bullet 2 of the runbook) touches a real
staging environment and must be run by a human, not by an implementer subagent** — see
Step 2's note.

- [ ] **Step 1: Write `api/ai.failure-policy.test.js`**

```js
// The W2 drill (spec exit criterion 6): for every action api/ai.js exposes,
// confirm the handler enforces a fail-closed checkDailyCap result (blocks,
// never calls Anthropic) and proceeds through a fail-open rateLimitCheck
// result (doesn't block). usage-tracker.js/rate-limit.js's own internal
// fail-open/closed correctness is proven in their own unit tests (Tasks 2-3);
// this file proves the handler layer actually acts on what those functions
// return, across every action — see
// docs/architecture/2026-08-02-w2-failure-policy-decision-table.md.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ getUser: null, rateLimit: null, dailyCap: null, userCap: null, config: {} }));

vi.mock('./_lib/supabase-admin.js', () => ({
  supabaseAdmin: {
    auth: { getUser: (...a) => h.getUser(...a) },
    from: (table) => tableBuilder(h.config[table] || {}),
  },
}));
vi.mock('./_lib/rate-limit.js', () => ({
  rateLimitCheck: (...a) => h.rateLimit(...a),
  extractUserId: () => 'anon',
  redis: { set: vi.fn(), incr: vi.fn(), decr: vi.fn() },
  freeRunKey: () => 'k',
}));
vi.mock('./_lib/usage-tracker.js', () => ({
  checkDailyCap: (...a) => h.dailyCap(...a),
  checkUserCap:  (...a) => h.userCap(...a),
  trackUsage: vi.fn(), trackUserUsage: vi.fn(),
}));
vi.mock('./_lib/cache.js', () => ({
  getCached: vi.fn().mockResolvedValue(null), setCached: vi.fn(), buildCacheKey: () => 'k',
}));
vi.mock('./_lib/system-log.js', () => ({ writeSystemLog: vi.fn() }));
vi.mock('./_lib/anthropic-proxy.js', () => ({ callAnthropic: vi.fn() }));
vi.mock('./_lib/telegram.js', () => ({ sendTelegramAlert: vi.fn(), sendTelegramAlertOnce: vi.fn() }));
vi.mock('./_lib/sentry-server.js', () => ({ Sentry: { captureException: vi.fn(), captureMessage: vi.fn() } }));
vi.mock('./_lib/run-reservation.js', () => ({ reserveRun: vi.fn(), syncRunCount: vi.fn() }));
vi.mock('./_lib/express-beta.js', () => ({ getExpressBetaFree: vi.fn().mockResolvedValue(false) }));
vi.mock('./_lib/generation-failure.js', () => ({ logServerGenerationFailure: vi.fn() }));

const { default: handler } = await import('./ai.js');
const { callAnthropic } = await import('./_lib/anthropic-proxy.js');

function tableBuilder(cfg) {
  const b = {
    select: () => b, eq: () => b, insert: () => b, update: () => b,
    maybeSingle: () => Promise.resolve(cfg.maybeSingle ?? { data: null, error: null }),
    single:      () => Promise.resolve(cfg.single ?? { data: null, error: null }),
    then: (res, rej) => Promise.resolve(cfg.then ?? { data: null, error: null }).then(res, rej),
  };
  return b;
}

function makeReq({ action, body = {} }) {
  return {
    method: 'POST',
    query: { action },
    headers: { authorization: 'Bearer test-token' },
    body,
  };
}

function makeRes() {
  return {
    statusCode: null, body: null, headers: {}, headersSent: false,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; this.headersSent = true; return this; },
    end() { this.headersSent = true; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

beforeEach(() => {
  h.getUser  = vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'e@x.com' } }, error: null });
  h.rateLimit = vi.fn().mockResolvedValue({ allowed: true, reason: '' });
  h.dailyCap  = vi.fn().mockResolvedValue({ allowed: true, spent: 0, cap: 10 });
  h.userCap   = vi.fn().mockResolvedValue({ allowed: true, spent: 0, cap: 10, isPaid: false });
  h.config = {};
  callAnthropic.mockReset();
  callAnthropic.mockResolvedValue({ response: { ok: true, status: 200 }, data: { content: [{ text: '{}' }] } });
});

describe('W2 drill — fail-closed checkDailyCap blocks every gated action', () => {
  const cases = [
    { action: undefined, body: { step: 'topic-validator', messages: [{ role: 'user', content: 'hi' }] } }, // handleGeneral
    { action: 'defense',            body: { promptType: 'x', messages: [] } },
    { action: 'supervisor-prep',    body: { messages: [] } },
    { action: 'defence-brief',      body: {} },
    { action: 'defence-brief-coach',body: {} },
  ];

  for (const { action, body } of cases) {
    it(`blocks ${action || 'general'} with 503 and never calls Anthropic when checkDailyCap fails closed`, async () => {
      h.dailyCap = vi.fn().mockResolvedValue({ allowed: false, spent: 0, cap: 10 }); // simulated Supabase outage → fail-closed
      const res = makeRes();
      await handler(makeReq({ action, body }), res);
      expect(res.statusCode).toBe(503);
      expect(callAnthropic).not.toHaveBeenCalled();
    });
  }
});

describe('W2 drill — fail-open rateLimitCheck does not block requests', () => {
  it('handleGeneral proceeds past the rate-limit gate when rateLimitCheck fails open (simulated Redis outage)', async () => {
    // rateLimitCheck itself never throws post-Task-3 (guardedCheck catches
    // internally) — a Redis outage surfaces here as an allowed:true result,
    // exactly like a healthy check. Confirms the handler doesn't add its own
    // extra gate on top.
    h.rateLimit = vi.fn().mockResolvedValue({ allowed: true, reason: '' });
    h.config = { user_entitlements: { maybeSingle: { data: { paid_features: [], run_counts: {} }, error: null } } };
    const res = makeRes();
    await handler(makeReq({ action: undefined, body: { step: 'topic-validator', messages: [{ role: 'user', content: 'hi' }] } }), res);
    expect(res.statusCode).not.toBe(429);
  });
});
```

- [ ] **Step 2: Run the new test file, confirm it passes**

Run: `npx vitest run api/ai.failure-policy.test.js`
Expected: 6 tests pass (5 fail-closed cases + 1 fail-open case).

- [ ] **Step 3: Write the manual drill runbook**

Create `docs/architecture/2026-08-02-w2-drill-runbook.md`:

```markdown
# W2 Drill Runbook — Live Staging Credential Revocation

**Spec:** docs/specs/2026-07-31-infra-9-plus-program-design.md §8, exit criterion 6.
**Automated coverage:** `api/ai.failure-policy.test.js` proves every gated action in
`api/ai.js` blocks with 503 when `checkDailyCap` fails closed, and proceeds when
`rateLimitCheck` fails open — at the handler layer, against a simulated outage.

**This runbook covers the remaining, live half of the drill: revoking real Upstash
credentials against the staging environment.** Unlike the automated tests above, this
step touches live infrastructure and is *not* safe to run unsupervised — if staging
shares any credentials with production (unconfirmed as of this writing; verify in
Vercel's environment variables for both projects before proceeding), this could cause
a production outage. **A human must run this drill, with the go-ahead confirmed in the
moment — do not automate this step.**

## Steps

1. In the Vercel dashboard, confirm the `fypro-staging` project's
   `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` env vars point at a
   **staging-only** Upstash database, distinct from production's. If they are shared,
   stop — this drill cannot safely proceed against shared credentials; provision a
   separate staging Upstash database first (Upstash's free tier supports multiple
   databases).
2. In the Upstash dashboard, revoke or rotate the staging database's REST token (or
   temporarily delete the staging database, if a rotation isn't available).
3. Against the staging deployment, exercise each of: Topic Validator (general),
   Defense Simulator, Supervisor Prep, Defence Brief, Defence Brief Coach, and a login
   (nurture email trigger) and a referral signup.
4. For each, confirm the observed behaviour matches the decision table
   (`docs/architecture/2026-08-02-w2-failure-policy-decision-table.md`):
   - The Claude-spend paths (rows 2–3) should **block** with a 503/429-style message,
     since `checkUserCap` depends on Redis and now fails closed.
   - Request-count rate limiting (row 1) should **not** block — requests still go
     through.
   - The nurture-email and referral-notification triggers (rows 12, 14) should still
     succeed via retry (Redis is not in their path — they depend on Supabase and the
     `send-nurture-email` endpoint, not Upstash) — this specific drill does not
     exercise rows 12–14's failure path; note that as a known gap if you want full
     coverage, since it would require revoking Supabase credentials instead.
5. Restore the staging Upstash credentials (rotate back / recreate the database).
6. Record the outcome (pass/fail per row, with timestamps) in §8 of
   `docs/specs/2026-07-31-infra-9-plus-program-design.md` under a new "Verified"
   subsection, the same way W1's drill outcome was recorded in §7.
```

- [ ] **Step 4: Update CLAUDE.md**

In `CLAUDE.md` §3 (file structure), in the `api/_lib/` listing, add two lines
alongside the existing entries (matching the existing comment style), e.g. after the
`usage-tracker.js` line:

```
│   │   ├── failure-policy.js      # W2: shared fail-open/fail-closed guardedCheck() — see docs/architecture decision table
│   │   ├── reliable-async.js      # W2: retry + dead-letter for fire-and-forget side effects (reliably())
```

In `CLAUDE.md` §5 (database schema), add a new subsection after `user_reports`:

```markdown
### dead_letter_queue (migration 0042)
- id (uuid)
- feature (text)
- payload (jsonb, nullable)
- error_message (text, nullable)
- created_at
- resolved_at (nullable)
- Service-role only: no client INSERT/SELECT/UPDATE/DELETE policies. Written by
  api/_lib/reliable-async.js when a retried side effect exhausts all attempts.
```

- [ ] **Step 5: Update the spec with a "Verified" note for the automated portion**

In `docs/specs/2026-07-31-infra-9-plus-program-design.md`, immediately after the "### Exit criteria" list under `## 8. W2 — Failure policy`, add:

```markdown
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
```

- [ ] **Step 6: Run the full suite one more time and commit**

```bash
npm run typecheck
npm run test
git add api/ai.failure-policy.test.js docs/architecture/2026-08-02-w2-drill-runbook.md CLAUDE.md docs/specs/2026-07-31-infra-9-plus-program-design.md
git commit -m "test: add W2 fail-closed/fail-open drill, close out W2 decision table + runbook"
```

---

## Post-plan note for whoever runs the final whole-branch review

Exit criterion 6 is **partially** verified by this plan: the automated handler-layer
drill is real and passing, but the live-credential half (runbook Step 3's items 1–5)
requires a human to actually execute it against a confirmed staging-only Upstash
instance, which this plan explicitly does not do. Flag this as a known incomplete
item rather than treating the spec's "Verified" note as claiming full completion —
it says so explicitly in its own text.
