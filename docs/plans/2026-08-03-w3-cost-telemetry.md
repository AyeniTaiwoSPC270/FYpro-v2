# W3 — Cost & Telemetry Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give every Anthropic call (and every cache hit) a per-call cost/token/trace
record in a new `ai_call_log` table, written through one shared helper, so the Express
Defence margin question and cache-effectiveness questions can be answered with a SQL
query instead of guesswork.

**Architecture:** A new table (`ai_call_log`, migration `0043`) and a new shared write
path (`api/_lib/ai-cost-log.js`, exporting `logAiCall()`) replace four currently
duplicated Anthropic-call-tracking blocks spread across `api/_lib/anthropic-proxy.js`,
`api/ai.js` (`handleSupervisorPrep`'s own fetch), `api/project-reviewer.js`, and
`api/research.js`. `logAiCall` reuses the existing per-model USD pricing
(`estimateCallCostUsd` in `api/_lib/usage-tracker.js`) rather than reimplementing it.
Retention is a new `CRON_SECRET`-gated admin action, matching the existing
`daily-report` cron pattern — no new serverless function.

**Tech Stack:** Vercel serverless functions (Node), Supabase (Postgres + service-role
client), vitest.

## Global Constraints

- `ai_call_log` is a new, dedicated table — not an extension of `response_times`
  (per the approved design). RLS enabled, zero client policies, service-role only —
  same posture as `dead_letter_queue` (migration 0042).
- Cache hits are logged as rows (`cache_hit: true`, `cost_usd: 0`, `tokens_in/out: 0`),
  not tracked via a separate Redis counter.
- The three currently-duplicated tracking blocks (`anthropic-proxy.js`,
  `project-reviewer.js`, `research.js`) — plus a fourth discovered while writing this
  plan, `handleSupervisorPrep` in `api/ai.js`, which has its own hand-rolled `fetch()`
  and does **not** go through `callAnthropic` — all route through one shared
  `logAiCall()` function. `handleSupervisorPrep` is converted to call the shared
  `callAnthropic()` helper instead of duplicating the fetch, since its request shape
  and error-mapping already match `callAnthropic`'s other callers exactly.
- Retention: hard-delete `ai_call_log` rows older than 90 days via a new
  `action=prune-ai-cost-log` in `api/admin.js`, gated by `verifyCronSecret` exactly like
  `handleDailyReport`. No new serverless function — Vercel Hobby's 12-function limit is
  currently at capacity (`admin, ai, auth, certificate, notify, payments,
  project-reviewer, referral, research, send-nurture-email, share-card, speak`).
- Margin/cache-hit-rate questions are answered by ad-hoc SQL against `ai_call_log` —
  no new admin dashboard card in this plan.
- Server-side `Sentry.captureException` gets `{ tags: { trace_id } }` added in exactly
  3 files: `api/ai.js`, `api/project-reviewer.js`, `api/research.js` (the files that
  produce `ai_call_log` rows). No other `Sentry.captureException` call site changes.
- Migration numbering: next free 4-digit prefix is `0043` (highest existing is
  `migrations/0042_dead_letter_queue.sql`); `npm run lint:migrations` fails the build on
  duplicate prefixes.
- `npm run typecheck` (tsc) and `npm run test` (vitest) must pass before any commit that
  touches non-trivial logic, per this repo's session discipline.

---

### Task 1: `ai_call_log` migration

**Files:**
- Create: `migrations/0043_ai_call_log.sql`

**Interfaces:**
- Produces: the `ai_call_log` table (columns: `id`, `user_id`, `feature`, `model`,
  `tokens_in`, `tokens_out`, `cost_usd`, `cache_hit`, `trace_id`, `duration_ms`,
  `created_at`) that every later task's `logAiCall()` calls write to via
  `supabaseAdmin.from('ai_call_log').insert(...)`.

- [ ] **Step 1: Write the migration file**

```sql
-- Migration 0043: ai_call_log
-- Per-call AI cost/token/cache/trace ledger (W3 — see
-- docs/specs/2026-08-03-w3-cost-telemetry-design.md). One row per Anthropic call
-- or cache hit, written by api/_lib/ai-cost-log.js (service role only).
-- Pruned to 90 days by api/admin.js action=prune-ai-cost-log (cron-job.org).
-- Run in Supabase SQL Editor. Verify RLS check at the bottom.

CREATE TABLE public.ai_call_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id),
  feature       text        NOT NULL,
  model         text        NOT NULL,
  tokens_in     integer     NOT NULL DEFAULT 0,
  tokens_out    integer     NOT NULL DEFAULT 0,
  cost_usd      numeric     NOT NULL DEFAULT 0,
  cache_hit     boolean     NOT NULL DEFAULT false,
  trace_id      text,
  duration_ms   integer,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ai_call_log_created_idx ON public.ai_call_log(created_at DESC);
CREATE INDEX ai_call_log_feature_idx ON public.ai_call_log(feature, created_at DESC);
CREATE INDEX ai_call_log_user_idx    ON public.ai_call_log(user_id, created_at DESC);

ALTER TABLE public.ai_call_log ENABLE ROW LEVEL SECURITY;
-- No policies: written only by supabaseAdmin (service role, bypasses RLS).
-- There is no legitimate client-side read or write path.

-- Verify: must return zero rows
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
```

- [ ] **Step 2: Verify migration numbering passes lint**

Run: `npm run lint:migrations`
Expected: `✓ migrations: 40 files, no duplicate prefixes` (39 existing + this one)

- [ ] **Step 3: Commit**

```bash
git add migrations/0043_ai_call_log.sql
git commit -m "feat: add ai_call_log migration (W3)"
```

**Note for the implementer:** this SQL is not run automatically — it must be applied by
a human in the Supabase SQL Editor (same as every other migration in this repo). Note
this in your task report; do not attempt to apply it via any MCP/CLI tool yourself.

---

### Task 2: `logAiCall()` shared helper

**Files:**
- Modify: `api/_lib/usage-tracker.js` (export `estimateCallCostUsd` and `pricingFor`)
- Create: `api/_lib/ai-cost-log.js`
- Test: `api/_lib/ai-cost-log.test.js`

**Interfaces:**
- Consumes: `estimateCallCostUsd(tokensIn, tokensOut, model)` from
  `api/_lib/usage-tracker.js` (currently module-private, this task exports it) and
  `supabaseAdmin` from `api/_lib/supabase-admin.js`.
- Produces: `logAiCall({ userId, feature, model, tokensIn, tokensOut, cacheHit,
  traceId, durationMs })` — an async function, never throws, awaited by every later
  task's call sites before their response is sent.

- [ ] **Step 1: Export the pricing helpers from usage-tracker.js**

In `api/_lib/usage-tracker.js`, change:

```js
function pricingFor(model) {
  return MODEL_PRICING[model] || DEFAULT_PRICING;
}
```

to:

```js
export function pricingFor(model) {
  return MODEL_PRICING[model] || DEFAULT_PRICING;
}
```

and change:

```js
/** Estimated USD cost of one Anthropic call from its token usage and model. */
function estimateCallCostUsd(tokensIn, tokensOut, model) {
  const p = pricingFor(model);
  return (tokensIn || 0) * p.in + (tokensOut || 0) * p.out;
}
```

to:

```js
/** Estimated USD cost of one Anthropic call from its token usage and model. */
export function estimateCallCostUsd(tokensIn, tokensOut, model) {
  const p = pricingFor(model);
  return (tokensIn || 0) * p.in + (tokensOut || 0) * p.out;
}
```

- [ ] **Step 2: Run the existing usage-tracker suite to confirm nothing broke**

Run: `npx vitest run api/_lib/usage-tracker.test.js`
Expected: PASS (all existing tests still pass — this step only adds `export` keywords,
no behavior change)

- [ ] **Step 3: Write the failing tests for logAiCall**

Create `api/_lib/ai-cost-log.test.js`:

```js
// Tests for logAiCall — the single write path for ai_call_log (W3). Every
// Anthropic call site and every cache-hit branch across api/_lib/anthropic-proxy.js,
// api/ai.js, api/project-reviewer.js, and api/research.js routes through this
// function — see docs/specs/2026-08-03-w3-cost-telemetry-design.md.

import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => ({ insert: null, lastTable: null, lastRow: null }))

vi.mock('./supabase-admin.js', () => ({
  supabaseAdmin: {
    from: (table) => ({
      insert: (row) => { h.lastTable = table; h.lastRow = row; return h.insert(row) },
    }),
  },
}))

const { logAiCall } = await import('./ai-cost-log.js')

beforeEach(() => {
  h.insert = vi.fn().mockResolvedValue({ data: null, error: null })
  h.lastTable = null
  h.lastRow = null
})

describe('logAiCall', () => {
  it('writes to the ai_call_log table', async () => {
    await logAiCall({ userId: 'u1', feature: 'topic-validator', model: 'claude-sonnet-4-6', tokensIn: 100, tokensOut: 50 })
    expect(h.lastTable).toBe('ai_call_log')
  })

  it('computes cost_usd from tokens and model using existing Sonnet pricing', async () => {
    await logAiCall({ userId: 'u1', feature: 'topic-validator', model: 'claude-sonnet-4-6', tokensIn: 1_000_000, tokensOut: 100_000, traceId: 'fyp-abc', durationMs: 500 })
    expect(h.lastRow).toMatchObject({
      user_id: 'u1', feature: 'topic-validator', model: 'claude-sonnet-4-6',
      tokens_in: 1_000_000, tokens_out: 100_000, cache_hit: false,
      trace_id: 'fyp-abc', duration_ms: 500,
    })
    expect(h.lastRow.cost_usd).toBeCloseTo(3 + 1.5) // Sonnet: $3/1M in, $15/1M out
  })

  it('uses Haiku pricing for a Haiku model', async () => {
    await logAiCall({ userId: 'u1', feature: 'defense-simulator', model: 'claude-haiku-4-5-20251001', tokensIn: 1_000_000, tokensOut: 100_000 })
    expect(h.lastRow.cost_usd).toBeCloseTo(1 + 0.5)
  })

  it('writes a zero-cost, zero-token row for a cache hit', async () => {
    await logAiCall({ userId: 'u1', feature: 'chapter-architect', model: 'claude-sonnet-4-6', cacheHit: true, traceId: 'fyp-def' })
    expect(h.lastRow).toMatchObject({ cache_hit: true, tokens_in: 0, tokens_out: 0, cost_usd: 0 })
  })

  it('defaults user_id to null when no userId is given', async () => {
    await logAiCall({ feature: 'topic-validator', model: 'claude-sonnet-4-6', cacheHit: true })
    expect(h.lastRow.user_id).toBeNull()
  })

  it('never throws when the insert rejects', async () => {
    h.insert.mockRejectedValue(new Error('db down'))
    await expect(logAiCall({ userId: 'u1', feature: 'topic-validator', model: 'claude-sonnet-4-6' })).resolves.toBeUndefined()
  })

  it('never hangs past the 3s timeout race when the insert never resolves', async () => {
    vi.useFakeTimers()
    h.insert.mockReturnValue(new Promise(() => {}))
    const p = logAiCall({ userId: 'u1', feature: 'topic-validator', model: 'claude-sonnet-4-6' })
    await vi.advanceTimersByTimeAsync(3000)
    await expect(p).resolves.toBeUndefined()
    vi.useRealTimers()
  })
})
```

- [ ] **Step 4: Run test to verify it fails**

Run: `npx vitest run api/_lib/ai-cost-log.test.js`
Expected: FAIL — `Cannot find module './ai-cost-log.js'`

- [ ] **Step 5: Write the implementation**

Create `api/_lib/ai-cost-log.js`:

```js
// Per-call AI cost/token/cache/trace ledger (W3). One row per Anthropic call or
// cache hit — see docs/specs/2026-08-03-w3-cost-telemetry-design.md. This is the
// single write path every Anthropic-call site routes through.

import { supabaseAdmin } from './supabase-admin.js';
import { estimateCallCostUsd } from './usage-tracker.js';

/**
 * Records one row in ai_call_log: a real Anthropic call (with token counts) or a
 * cache hit (tokensIn/tokensOut default to 0, cacheHit: true). Never throws; the
 * insert races a 3s timeout so a slow/unavailable Supabase never delays the
 * response — mirrors the response_times insert pattern in anthropic-proxy.js.
 * Must be awaited before the response is sent (Vercel freezes the function
 * immediately after).
 * @param {object} params
 * @param {string}  [params.userId]     - Verified Supabase user id
 * @param {string}  params.feature      - Label matching the response_times `feature` convention
 * @param {string}  params.model        - Anthropic model ID used (or would have been used, on a cache hit)
 * @param {number}  [params.tokensIn=0]
 * @param {number}  [params.tokensOut=0]
 * @param {boolean} [params.cacheHit=false]
 * @param {string}  [params.traceId]
 * @param {number}  [params.durationMs]
 * @returns {Promise<void>}
 */
export async function logAiCall({ userId, feature, model, tokensIn = 0, tokensOut = 0, cacheHit = false, traceId, durationMs }) {
  const cost = estimateCallCostUsd(tokensIn, tokensOut, model);
  const insertPromise = supabaseAdmin.from('ai_call_log').insert({
    user_id: userId || null,
    feature,
    model,
    tokens_in: tokensIn,
    tokens_out: tokensOut,
    cost_usd: cost,
    cache_hit: cacheHit,
    trace_id: traceId || null,
    duration_ms: durationMs ?? null,
  });
  const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
  await Promise.race([insertPromise, timeoutPromise]).catch(err =>
    console.error(`[ai-cost-log] insert failed (${feature}):`, err?.message)
  );
}
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `npx vitest run api/_lib/ai-cost-log.test.js api/_lib/usage-tracker.test.js`
Expected: PASS (all tests in both files)

- [ ] **Step 7: Commit**

```bash
git add api/_lib/usage-tracker.js api/_lib/ai-cost-log.js api/_lib/ai-cost-log.test.js
git commit -m "feat: add logAiCall shared cost/telemetry write path (W3)"
```

---

### Task 3: Wire `callAnthropic` and its 4 existing `api/ai.js` call sites

**Files:**
- Modify: `api/_lib/anthropic-proxy.js`
- Modify: `api/ai.js` (`handleGeneral`, `handleDefense`, `handleDefenceBrief`,
  `handleDefenceBriefCoach`)
- Modify: `api/ai.failure-policy.test.js` (add `ai-cost-log.js` mock)
- Modify: `api/ai.finalize-defense.test.js` (add `ai-cost-log.js` mock)

**Interfaces:**
- Consumes: `logAiCall` from `api/_lib/ai-cost-log.js` (Task 2).
- Produces: `callAnthropic({ feature, userId, model, max_tokens, system, messages,
  temperature, traceId })` — same signature as before plus one new optional
  `traceId` param. All 4 real-call sites in `api/ai.js` that already use
  `callAnthropic` now pass their handler's `traceId`. `handleGeneral`'s cache-hit
  branch calls `logAiCall` directly.

- [ ] **Step 1: Add `traceId` support to `callAnthropic` and call `logAiCall` on success**

In `api/_lib/anthropic-proxy.js`, add the import:

```js
import { logAiCall } from './ai-cost-log.js';
```

Change the function signature:

```js
export async function callAnthropic({
  feature,
  userId,
  model,
  max_tokens,
  system,
  messages,
  temperature = 0,
}) {
```

to:

```js
export async function callAnthropic({
  feature,
  userId,
  model,
  max_tokens,
  system,
  messages,
  temperature = 0,
  traceId,
}) {
```

Change the success block:

```js
  if (response.ok) {
    const insertPromise  = supabaseAdmin
      .from('response_times')
      .insert({ feature, duration_ms: durationMs, user_id: userId });
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
    await Promise.race([insertPromise, timeoutPromise]).catch(err =>
      console.error(`[anthropic-proxy] response_times insert failed (${feature}):`, err?.message)
    );
  } else {
```

to:

```js
  if (response.ok) {
    const insertPromise  = supabaseAdmin
      .from('response_times')
      .insert({ feature, duration_ms: durationMs, user_id: userId });
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
    const responseTimesWrite = Promise.race([insertPromise, timeoutPromise]).catch(err =>
      console.error(`[anthropic-proxy] response_times insert failed (${feature}):`, err?.message)
    );
    const costLogWrite = data.usage
      ? logAiCall({
          userId, feature, model,
          tokensIn: data.usage.input_tokens, tokensOut: data.usage.output_tokens,
          traceId, durationMs,
        })
      : Promise.resolve();
    // Run both bounded-race writes concurrently, not sequentially — each is
    // independently capped at ~3s worst-case; awaiting them one after another
    // would double the worst-case latency added to every successful call.
    await Promise.all([responseTimesWrite, costLogWrite]);
  } else {
```

- [ ] **Step 2: Pass `traceId` from `api/ai.js`'s 4 existing `callAnthropic` call sites**

In `handleGeneral`, change:

```js
    const { response, data } = await callAnthropic({
      feature:    step,
      userId:     user.id,
      model,
      max_tokens,
      system,
      messages,
    });
```

to:

```js
    const { response, data } = await callAnthropic({
      feature:    step,
      userId:     user.id,
      model,
      max_tokens,
      system,
      messages,
      traceId,
    });
```

In `handleDefense`, change:

```js
    const { response, data } = await callAnthropic({
      feature:    'defense-simulator',
      userId:     user.id,
      model,
      max_tokens,
      system,
      messages,
    });
```

to:

```js
    const { response, data } = await callAnthropic({
      feature:    'defense-simulator',
      userId:     user.id,
      model,
      max_tokens,
      system,
      messages,
      traceId,
    });
```

In `handleDefenceBrief`, change:

```js
    const { response, data } = await callAnthropic({ feature: 'defence-brief', userId: user.id, model, max_tokens, system, messages });
```

to:

```js
    const { response, data } = await callAnthropic({ feature: 'defence-brief', userId: user.id, model, max_tokens, system, messages, traceId });
```

In `handleDefenceBriefCoach`, change:

```js
    const { response, data } = await callAnthropic({ feature: 'defence-brief-coach', userId: user.id, model, max_tokens, system, messages });
```

to:

```js
    const { response, data } = await callAnthropic({ feature: 'defence-brief-coach', userId: user.id, model, max_tokens, system, messages, traceId });
```

- [ ] **Step 3: Log the cache hit in `handleGeneral`**

In `api/ai.js`, add the import:

```js
import { logAiCall } from './_lib/ai-cost-log.js';
```

Change:

```js
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }
```

to:

```js
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    await logAiCall({ userId: user.id, feature: step, model, cacheHit: true, traceId });
    return res.status(200).json(cached);
  }
```

(`user` and `model` are both already resolved above this point in `handleGeneral` —
`user` from the Phase 1 `Promise.all`, `model` from the client-input resolution before
the cache key is built.)

- [ ] **Step 4: Add the `ai-cost-log.js` mock to both `api/ai.js` test files**

In `api/ai.failure-policy.test.js`, add this line next to the existing
`vi.mock('./_lib/anthropic-proxy.js', ...)` line:

```js
vi.mock('./_lib/ai-cost-log.js', () => ({ logAiCall: vi.fn() }));
```

In `api/ai.finalize-defense.test.js`, add the same line next to its own
`vi.mock('./_lib/anthropic-proxy.js', ...)` line:

```js
vi.mock('./_lib/ai-cost-log.js', () => ({ logAiCall: vi.fn() }));
```

- [ ] **Step 5: Run the full test suite and typecheck**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: PASS (both `api/ai.failure-policy.test.js` and `api/ai.finalize-defense.test.js`
must still pass unmodified in their assertions — this task only adds a new mock line to
each, no existing test logic changes)

- [ ] **Step 6: Commit**

```bash
git add api/_lib/anthropic-proxy.js api/ai.js api/ai.failure-policy.test.js api/ai.finalize-defense.test.js
git commit -m "feat: wire callAnthropic + 4 ai.js call sites through logAiCall (W3)"
```

---

### Task 4: Convert `handleSupervisorPrep` to use `callAnthropic`

**Files:**
- Modify: `api/ai.js` (`handleSupervisorPrep`, and the outer `Sentry.captureException`
  call site)
- Modify: `api/ai.failure-policy.test.js` (update the supervisor-prep test case)

**Interfaces:**
- Consumes: `callAnthropic` (already imported in `api/ai.js`), `sendSanitizedAiError`
  (already defined in `api/ai.js`), `generateTraceId`/`traceLog` (already imported),
  `logAiCall` (Task 3's import).
- Produces: `handleSupervisorPrep` now generates a `traceId` and sets the
  `X-Trace-Id` header like every other handler in this file, and no longer makes its
  own direct `fetch()` call to the Anthropic API.

**Context:** `handleSupervisorPrep` currently has its own hand-rolled `fetch()` to
`https://api.anthropic.com/v1/messages`, its own `trackUsage`/`trackUserUsage` calls,
its own `response_times` insert, and its own inline error-status mapping — and, unlike
every other handler in this file, **no trace ID at all**. Its error mapping
(`429 → 'FYPro is in high demand right now...'`, `>=500 → 503`, else passthrough) is
byte-identical to the existing `sendSanitizedAiError` helper already used by
`handleDefenceBrief`/`handleDefenceBriefCoach` — converting to `callAnthropic` +
`sendSanitizedAiError` is a behavior-preserving simplification, not a rewrite of the
user-facing contract.

- [ ] **Step 1: Add trace ID generation to `handleSupervisorPrep`**

Change:

```js
async function handleSupervisorPrep(req, res) {
  const authHeader = req.headers.authorization || '';
```

to:

```js
async function handleSupervisorPrep(req, res) {
  const traceId = generateTraceId();
  res.setHeader('X-Trace-Id', traceId);

  const authHeader = req.headers.authorization || '';
```

- [ ] **Step 2: Replace the manual fetch + tracking block with `callAnthropic`**

Change:

```js
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(cached);
  }

  try {

    const start    = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:       'claude-sonnet-4-6',
        max_tokens:  1000,
        system:      SUPERVISOR_PREP_SYSTEM,
        messages:    [{ role: 'user', content: userPrompt }],
        temperature: 0,
      }),
      signal: AbortSignal.timeout(50000),
    });

    const data = await response.json();
    if (data.usage) {
      await trackUsage(data.usage.input_tokens, data.usage.output_tokens, 'claude-sonnet-4-6');
      // Count this toward the shared per-user daily counter. No dedicated cap gate
      // here: supervisor-prep is rate-limited to 5/user/day and cheap, so it can't
      // drain the budget — but its spend still counts against the heavier endpoints' gates.
      await trackUserUsage(user.id, data.usage.input_tokens, data.usage.output_tokens, 'claude-sonnet-4-6');
    }

    if (!response.ok) {
      // Never forward the raw Anthropic error body — it can carry org IDs / URLs.
      console.error('[ai/supervisor-prep] Anthropic', response.status, String(data?.error?.message || '').slice(0, 200));
      const status = response.status === 429 ? 429 : response.status >= 500 ? 503 : response.status;
      return res.status(status).json({
        error: response.status === 429
          ? 'FYPro is in high demand right now. Please try again in a moment.'
          : 'AI service error. Please try again.',
      });
    }

    const duration       = Date.now() - start;
    const insertPromise  = supabaseAdmin.from('response_times').insert({ feature: 'supervisor-prep', duration_ms: duration, user_id: user.id });
    const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
    await Promise.race([insertPromise, timeoutPromise]).catch(err => {
      console.error('[ai/supervisor-prep] response_times insert failed:', err?.message, err?.code, err?.details, err?.hint, JSON.stringify(err));
    });

    const text = data.content?.[0]?.text ?? '';
```

to:

```js
  if (cached) {
    res.setHeader('X-Cache', 'HIT');
    await logAiCall({ userId: user.id, feature: 'supervisor-prep', model: 'claude-sonnet-4-6', cacheHit: true, traceId });
    return res.status(200).json(cached);
  }

  try {

    const { response, data } = await callAnthropic({
      feature:    'supervisor-prep',
      userId:     user.id,
      model:      'claude-sonnet-4-6',
      max_tokens: 1000,
      system:     SUPERVISOR_PREP_SYSTEM,
      messages:   [{ role: 'user', content: userPrompt }],
      traceId,
    });

    if (!response.ok) return sendSanitizedAiError(res, response, data, traceId, 'supervisor-prep');

    const text = data.content?.[0]?.text ?? '';
```

- [ ] **Step 3: Remove the now-unused `apiKey` guard's only remaining reference**

The `apiKey` variable near the top of the function (`const apiKey =
process.env.ANTHROPIC_API_KEY; if (!apiKey) return res.status(500)...`) is no longer
read anywhere else in this function once Step 2 removes the manual `fetch()` call —
`callAnthropic` itself checks `process.env.ANTHROPIC_API_KEY` and throws if unset. Leave
the existing `apiKey` guard in place unchanged: it gives a clearer, faster 500 before any
rate-limit/cache work happens, and removing it is not required for this task — do not
delete it.

- [ ] **Step 4: Remove the now-unused `trackUsage`/`trackUserUsage` import**

After Step 2, `trackUsage` and `trackUserUsage` are no longer called anywhere in
`api/ai.js` (they were only ever used inside `handleSupervisorPrep`, replaced in Step 2).
Change:

```js
import { checkDailyCap, trackUsage, trackUserUsage, checkUserCap } from './_lib/usage-tracker.js';
```

to:

```js
import { checkDailyCap, checkUserCap } from './_lib/usage-tracker.js';
```

Leaving these imported-but-unused would fail `npm run lint` as a new
`no-unused-vars` violation outside the existing `eslint-suppressions.json` baseline
(see `CLAUDE.md` §19) — it must be removed, not suppressed.

- [ ] **Step 5: Tag the outer Sentry capture with the request's trace ID**

In `api/ai.js`, change:

```js
  } catch (err) {
    Sentry.captureException(err);
    console.error('[api/ai] unhandled error:', err);
    if (!res.headersSent) return res.status(500).json({ error: 'Internal server error' });
  }
}
```

to:

```js
  } catch (err) {
    Sentry.captureException(err, { tags: { trace_id: res.getHeader('X-Trace-Id') } });
    console.error('[api/ai] unhandled error:', err);
    if (!res.headersSent) return res.status(500).json({ error: 'Internal server error' });
  }
}
```

This works because every handler in this file (including `handleSupervisorPrep` as of
Step 1) sets the `X-Trace-Id` response header immediately after generating its
`traceId`, before any async work — so by the time an exception reaches this shared
outer `catch`, the header is already set on `res` regardless of which handler threw.

- [ ] **Step 6: Update the supervisor-prep test case in `api/ai.failure-policy.test.js`**

Read the file first to find the exact current supervisor-prep test case and its
surrounding `global.fetch` stub (see the file's header comment, which documents this
was added specifically because `handleSupervisorPrep` used to call `fetch()` directly).
Since `handleSupervisorPrep` now goes through the already-mocked `callAnthropic` like
every other action, the defensive `global.fetch` stub for the supervisor-prep case is
no longer necessary — the mocked `callAnthropic` in this file (`vi.mock('./_lib/
anthropic-proxy.js', () => ({ callAnthropic: vi.fn() }))`) is never expected to be
invoked in the fail-closed test case (it fails before reaching that call), same as
every other action's test case in this file. Remove the `global.fetch` stub setup/
teardown that exists solely for the supervisor-prep case, and remove the outdated
header-comment paragraph describing it (the paragraph beginning "A defensive global
fetch stub is added because..."). Do not change the test's assertions — the fail-closed
behavior under test (checkDailyCap blocks, Anthropic is never called) is unchanged by
this refactor.

- [ ] **Step 7: Run the full test suite, typecheck, and lint**

Run: `npm run test && npm run typecheck && npm run lint`
Expected: PASS. `npm run lint` in particular confirms the Step 4 import removal left no
new unused-variable violation.

- [ ] **Step 8: Commit**

```bash
git add api/ai.js api/ai.failure-policy.test.js
git commit -m "refactor: convert handleSupervisorPrep to use callAnthropic (W3)"
```

---

### Task 5: `api/project-reviewer.js`

**Files:**
- Modify: `api/project-reviewer.js`

**Interfaces:**
- Consumes: `generateTraceId`/`traceLog` from `api/_lib/trace.js` (not currently
  imported in this file), `logAiCall` from `api/_lib/ai-cost-log.js` (Task 2).
- Produces: N/A (endpoint, not consumed by other tasks).

**Context:** This file has zero trace ID support today. It has two Anthropic call
sites — the streaming path (`?stream=1`) and the non-streaming path — each with its
own `trackUsage`/`trackUserUsage` + `response_times` insert block. Neither path is
cached (per `CLAUDE.md`: "Project Reviewer: NOT cached"), so there is no cache-hit
branch to add here.

**Accepted latency tradeoff:** the non-streaming path already awaits a separate
3s-bounded `response_times` race later in the function (unchanged by this task). Step 4
below replaces two fast, unbounded awaits (`trackUsage`/`trackUserUsage`) with one
3s-bounded `logAiCall` await, so the function's worst-case added latency grows from
~3s to ~6s. This stays well under the 50s Anthropic timeout + 60s `maxDuration` budget,
so it is not fixed here — unlike Task 3's `anthropic-proxy.js` change, combining the two
races here would require restructuring around the intervening `max_tokens`/relevance-gate
early-return logic, which is not worth the risk for a request path with generous timeout
headroom. Flag this in your task report rather than silently restructuring the function.

- [ ] **Step 1: Import `generateTraceId`, `traceLog`, and `logAiCall`**

Change:

```js
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { Sentry }        from './_lib/sentry-server.js';
import { rateLimitCheck } from './_lib/rate-limit.js';
import { checkDailyCap, trackUsage, trackUserUsage, checkUserCap } from './_lib/usage-tracker.js';
```

to:

```js
import { supabaseAdmin } from './_lib/supabase-admin.js';
import { Sentry }        from './_lib/sentry-server.js';
import { rateLimitCheck } from './_lib/rate-limit.js';
import { checkDailyCap, checkUserCap } from './_lib/usage-tracker.js';
import { generateTraceId, traceLog } from './_lib/trace.js';
import { logAiCall } from './_lib/ai-cost-log.js';
```

(`trackUsage`/`trackUserUsage` are removed from this import — both call sites below
replace them with `logAiCall`, which computes the same cost internally via
`estimateCallCostUsd`.)

- [ ] **Step 2: Generate the trace ID at the top of the handler**

Change:

```js
const handler = async (req, res) => {
  try {
  setCorsHeaders(req, res);
```

to:

```js
const handler = async (req, res) => {
  try {
  const traceId = generateTraceId();
  res.setHeader('X-Trace-Id', traceId);

  setCorsHeaders(req, res);
```

- [ ] **Step 3: Replace the streaming path's tracking block**

Change:

```js
      if (inputTokens || outputTokens) {
        await trackUsage(inputTokens, outputTokens, model).catch(() => {});
        await trackUserUsage(user.id, inputTokens, outputTokens, model).catch(() => {});
      }
```

to:

```js
      if (inputTokens || outputTokens) {
        await logAiCall({ userId: user.id, feature: 'project-reviewer', model, tokensIn: inputTokens, tokensOut: outputTokens, traceId });
      }
```

- [ ] **Step 4: Replace the non-streaming path's tracking block**

Change:

```js
    const data = await response.json();
    console.log('[project-reviewer] Anthropic responded with status:', response.status);
    if (data.usage) {
      await trackUsage(data.usage.input_tokens, data.usage.output_tokens, model);
      await trackUserUsage(user.id, data.usage.input_tokens, data.usage.output_tokens, model);
    }
```

to:

```js
    const data = await response.json();
    console.log('[project-reviewer] Anthropic responded with status:', response.status);
    if (data.usage) {
      await logAiCall({ userId: user.id, feature: 'project-reviewer', model, tokensIn: data.usage.input_tokens, tokensOut: data.usage.output_tokens, traceId, durationMs: Date.now() - start });
    }
```

- [ ] **Step 5: Tag the outer Sentry capture with the request's trace ID**

Change:

```js
  } catch (err) {
    Sentry.captureException(err);
    console.error('[api/project-reviewer] unhandled error:', err);
    if (!res.headersSent) return res.status(500).json({ error: 'Internal server error' });
  }
};
```

to:

```js
  } catch (err) {
    Sentry.captureException(err, { tags: { trace_id: res.getHeader('X-Trace-Id') } });
    console.error('[api/project-reviewer] unhandled error:', err);
    if (!res.headersSent) return res.status(500).json({ error: 'Internal server error' });
  }
};
```

- [ ] **Step 6: Run typecheck and the full test suite**

Run: `npm run typecheck && npm run test && npm run lint`
Expected: PASS. There is no existing `project-reviewer.test.js` in this repo — this
step confirms the module still imports and typechecks cleanly, not endpoint behavior.
Note in your task report that this file has no endpoint-level test coverage today
(pre-existing gap, out of scope for this task to backfill).

- [ ] **Step 7: Commit**

```bash
git add api/project-reviewer.js
git commit -m "feat: route project-reviewer Anthropic calls through logAiCall (W3)"
```

---

### Task 6: `api/research.js`

**Files:**
- Modify: `api/research.js`

**Interfaces:**
- Consumes: `generateTraceId`/`traceLog` from `api/_lib/trace.js` (not currently
  imported in this file), `logAiCall` from `api/_lib/ai-cost-log.js` (Task 2).
- Produces: N/A (endpoint, not consumed by other tasks).

**Context:** This file has zero trace ID support today and two handlers
(`handleValidate` for `topic-validator`, `handleLitMap` for `lit-map`), each with a
cache-hit branch (today inserting a bare `response_times` row with `duration_ms: 0`
and no cache marker) and a real-call branch with its own `trackUsage`/`trackUserUsage`
block. Both handlers share one top-level `Sentry.captureException` in the exported
default `handler` function.

**Accepted latency tradeoff:** same as Task 5 — both `handleValidate` and
`handleLitMap` each await a separate 3s-bounded `response_times` race later in the
function (unchanged by this task), so replacing `trackUsage`/`trackUserUsage` with
`logAiCall` grows each handler's worst-case added latency from ~3s to ~6s, still well
under the 50s Anthropic timeout + 60s `maxDuration` budget. Not fixed here for the same
reason as Task 5.

- [ ] **Step 1: Import `generateTraceId`, `traceLog`, and `logAiCall`**

Change:

```js
import { rateLimitCheck, redis, freeRunKey } from './_lib/rate-limit.js';
import { setCorsHeaders }                 from './_lib/cors.js';
import { checkDailyCap, trackUsage, trackUserUsage, checkUserCap } from './_lib/usage-tracker.js';
import { getCached, setCached, buildCacheKey } from './_lib/cache.js';
```

to:

```js
import { rateLimitCheck, redis, freeRunKey } from './_lib/rate-limit.js';
import { setCorsHeaders }                 from './_lib/cors.js';
import { checkDailyCap, checkUserCap } from './_lib/usage-tracker.js';
import { getCached, setCached, buildCacheKey } from './_lib/cache.js';
import { generateTraceId, traceLog } from './_lib/trace.js';
import { logAiCall } from './_lib/ai-cost-log.js';
```

- [ ] **Step 2: Generate a trace ID in `handleValidate`**

Change:

```js
async function handleValidate(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
```

to:

```js
async function handleValidate(req, res) {
  const traceId = generateTraceId();
  res.setHeader('X-Trace-Id', traceId);

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
```

- [ ] **Step 3: Replace `handleValidate`'s cache-hit block**

Change:

```js
  if (claudeCached) {
    const { error: cacheInsertErr } = await supabaseAdmin.from('response_times').insert({ feature: 'topic-validator', duration_ms: 0, user_id: user.id });
    if (cacheInsertErr) {
      console.error('[research/validate] response_times insert failed (cache-hit):', cacheInsertErr?.message, cacheInsertErr?.code, cacheInsertErr?.details, cacheInsertErr?.hint, JSON.stringify(cacheInsertErr));
    }
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(claudeCached);
  }
```

to:

```js
  if (claudeCached) {
    const { error: cacheInsertErr } = await supabaseAdmin.from('response_times').insert({ feature: 'topic-validator', duration_ms: 0, user_id: user.id });
    if (cacheInsertErr) {
      console.error('[research/validate] response_times insert failed (cache-hit):', cacheInsertErr?.message, cacheInsertErr?.code, cacheInsertErr?.details, cacheInsertErr?.hint, JSON.stringify(cacheInsertErr));
    }
    await logAiCall({ userId: user.id, feature: 'topic-validator', model: 'claude-sonnet-4-6', cacheHit: true, traceId });
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(claudeCached);
  }
```

- [ ] **Step 4: Replace `handleValidate`'s real-call tracking block**

Change:

```js
    const data = await response.json();
    if (data.usage) {
      await trackUsage(data.usage.input_tokens, data.usage.output_tokens, 'claude-sonnet-4-6');
      await trackUserUsage(user.id, data.usage.input_tokens, data.usage.output_tokens, 'claude-sonnet-4-6');
    }

    if (!response.ok) {
      refundRun(); // Anthropic returned an error status — don't charge the run
```

to:

```js
    const data = await response.json();
    if (data.usage) {
      await logAiCall({ userId: user.id, feature: 'topic-validator', model: 'claude-sonnet-4-6', tokensIn: data.usage.input_tokens, tokensOut: data.usage.output_tokens, traceId });
    }

    if (!response.ok) {
      refundRun(); // Anthropic returned an error status — don't charge the run
```

- [ ] **Step 5: Generate a trace ID in `handleLitMap`**

Change:

```js
async function handleLitMap(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
```

to:

```js
async function handleLitMap(req, res) {
  const traceId = generateTraceId();
  res.setHeader('X-Trace-Id', traceId);

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
```

- [ ] **Step 6: Replace `handleLitMap`'s cache-hit block**

Change:

```js
  if (claudeCached) {
    const { error: cacheInsertErr } = await supabaseAdmin.from('response_times').insert({ feature: 'lit-map', duration_ms: 0, user_id: user.id });
    if (cacheInsertErr) {
      console.error('[research/lit-map] response_times insert failed (cache-hit):', cacheInsertErr?.message, cacheInsertErr?.code, cacheInsertErr?.details, cacheInsertErr?.hint, JSON.stringify(cacheInsertErr));
    }
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(claudeCached);
  }
```

to:

```js
  if (claudeCached) {
    const { error: cacheInsertErr } = await supabaseAdmin.from('response_times').insert({ feature: 'lit-map', duration_ms: 0, user_id: user.id });
    if (cacheInsertErr) {
      console.error('[research/lit-map] response_times insert failed (cache-hit):', cacheInsertErr?.message, cacheInsertErr?.code, cacheInsertErr?.details, cacheInsertErr?.hint, JSON.stringify(cacheInsertErr));
    }
    await logAiCall({ userId: user.id, feature: 'lit-map', model: 'claude-sonnet-4-6', cacheHit: true, traceId });
    res.setHeader('X-Cache', 'HIT');
    return res.status(200).json(claudeCached);
  }
```

- [ ] **Step 7: Replace `handleLitMap`'s real-call tracking block**

Change:

```js
    const data = await response.json();
    if (data.usage) {
      await trackUsage(data.usage.input_tokens, data.usage.output_tokens, 'claude-sonnet-4-6');
      await trackUserUsage(user.id, data.usage.input_tokens, data.usage.output_tokens, 'claude-sonnet-4-6');
    }

    if (response.ok && data.content?.[0]?.text) {
```

to:

```js
    const data = await response.json();
    if (data.usage) {
      await logAiCall({ userId: user.id, feature: 'lit-map', model: 'claude-sonnet-4-6', tokensIn: data.usage.input_tokens, tokensOut: data.usage.output_tokens, traceId });
    }

    if (response.ok && data.content?.[0]?.text) {
```

- [ ] **Step 8: Tag the outer Sentry capture with the request's trace ID**

Change:

```js
  } catch (err) {
    Sentry.captureException(err);
    console.error('[api/research] unhandled error:', err);
    sendTelegramAlert(`🔴 Unhandled error in /api/research?action=${req.query?.action || 'unknown'} — ${err.message}`).catch(() => null);
```

to:

```js
  } catch (err) {
    Sentry.captureException(err, { tags: { trace_id: res.getHeader('X-Trace-Id') } });
    console.error('[api/research] unhandled error:', err);
    sendTelegramAlert(`🔴 Unhandled error in /api/research?action=${req.query?.action || 'unknown'} — ${err.message}`).catch(() => null);
```

(`handleUserCount`, the third action in this file, never calls Anthropic and never sets
an `X-Trace-Id` header — if an error from that path reaches this catch, `res.getHeader
('X-Trace-Id')` is simply `undefined`, which is fine.)

- [ ] **Step 9: Run typecheck and the full test suite**

Run: `npm run typecheck && npm run test && npm run lint`
Expected: PASS. There is no existing `research.test.js` in this repo — this step
confirms the module still imports and typechecks cleanly, not endpoint behavior. Note
in your task report that this file has no endpoint-level test coverage today
(pre-existing gap, out of scope for this task to backfill).

- [ ] **Step 10: Commit**

```bash
git add api/research.js
git commit -m "feat: route research.js Anthropic calls through logAiCall (W3)"
```

---

### Task 7: Retention, admin visibility, and docs

**Files:**
- Modify: `api/admin.js` (new `handlePruneAiCostLog`, route registration,
  `ALLOWED_TABLES`)
- Modify: `api/notify.js` (`DATA_KEY_COLS`)
- Modify: `CLAUDE.md` (§3 file tree, §5 schema)

**Interfaces:**
- Consumes: `verifyCronSecret` from `api/_lib/cron-auth.js` (already imported in
  `api/admin.js`), `supabaseAdmin`.
- Produces: `GET/POST /api/admin?action=prune-ai-cost-log` (CRON_SECRET-gated),
  `ai_call_log` browsable via the admin Data Tab and the Telegram `/data` command.

- [ ] **Step 1: Add the prune handler**

In `api/admin.js`, near `handleDailyReport` (search for `// action: "daily-report"`),
add a new function directly above it:

```js
// action: "prune-ai-cost-log"
// Triggered by external cron (cron-job.org), same auth pattern as daily-report.
// Hard-deletes ai_call_log rows older than 90 days. No rollup: daily_usage already
// retains the long-term aggregate independently of this per-call table — see
// docs/specs/2026-08-03-w3-cost-telemetry-design.md.
async function handlePruneAiCostLog(req, res) {
  if (!verifyCronSecret(req, res)) return;

  try {
    const cutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const { error, count } = await supabaseAdmin
      .from('ai_call_log')
      .delete({ count: 'exact' })
      .lt('created_at', cutoff);

    if (error) throw error;

    console.log(`[prune-ai-cost-log] deleted ${count ?? 0} row(s) older than ${cutoff}`);
    return res.status(200).json({ deleted: count ?? 0 });
  } catch (err) {
    console.error('[prune-ai-cost-log] error:', err.message);
    Sentry.captureException(err);
    return res.status(500).json({ error: 'Prune failed.' });
  }
}
```

- [ ] **Step 2: Register the route**

In `api/admin.js`'s action-routing chain, next to the `daily-report` line:

```js
  if (action === 'daily-report')            return handleDailyReport(req, res);
```

add directly after it:

```js
  if (action === 'prune-ai-cost-log')       return handlePruneAiCostLog(req, res);
```

- [ ] **Step 3: Add `ai_call_log` to `admin.js`'s `ALLOWED_TABLES`**

Change:

```js
const ALLOWED_TABLES = new Set([
  'admin_users','app_config','auth_attempts','daily_usage',
  'defense_certificates','defense_credits','defense_sessions','defense_turns',
  'email_log','email_preferences','feature_feedback','generation_failures',
  'institutions','notifications','payment_issues','payments',
  'project_steps','projects','push_subscriptions','referrals',
  'response_times','system_logs','user_achievements','user_entitlements',
  'user_onboarding','user_progress','user_ratings','user_reports','users',
])
```

to:

```js
const ALLOWED_TABLES = new Set([
  'admin_users','ai_call_log','app_config','auth_attempts','daily_usage',
  'defense_certificates','defense_credits','defense_sessions','defense_turns',
  'email_log','email_preferences','feature_feedback','generation_failures',
  'institutions','notifications','payment_issues','payments',
  'project_steps','projects','push_subscriptions','referrals',
  'response_times','system_logs','user_achievements','user_entitlements',
  'user_onboarding','user_progress','user_ratings','user_reports','users',
])
```

- [ ] **Step 4: Add `ai_call_log` to `notify.js`'s `DATA_KEY_COLS`**

In `api/notify.js`, change:

```js
  user_reports:         ['id','user_id','reason','created_at'],
  user_ratings:         ['id','user_id','rating','feedback','created_at'],
}
```

to:

```js
  user_reports:         ['id','user_id','reason','created_at'],
  user_ratings:         ['id','user_id','rating','feedback','created_at'],
  ai_call_log:          ['id','user_id','feature','model','cost_usd','cache_hit','created_at'],
}
```

- [ ] **Step 5: Document the table and module in CLAUDE.md**

In `CLAUDE.md` §3 (file structure), under the `api/_lib/` listing, add a line for the
new module next to the other W2/W3-era `_lib` files:

```
│   │   ├── ai-cost-log.js         # W3: per-call Anthropic cost/token/cache/trace ledger (logAiCall)
```

In `CLAUDE.md` §5 (database schema), after the `dead_letter_queue` subsection, add:

```
### ai_call_log (migration 0043)
- id (uuid)
- user_id (uuid, nullable — FK auth.users)
- feature (text) — e.g. 'topic-validator', 'defense-simulator', 'project-reviewer'
- model (text)
- tokens_in, tokens_out (integer)
- cost_usd (numeric)
- cache_hit (boolean)
- trace_id (text, nullable)
- duration_ms (integer, nullable)
- created_at (timestamptz)
- Service-role only: no client INSERT/SELECT/UPDATE/DELETE policies. Written by
  api/_lib/ai-cost-log.js (logAiCall) from every Anthropic call site and cache-hit
  branch. Pruned to 90 days by api/admin.js action=prune-ai-cost-log.
```

- [ ] **Step 6: Run typecheck and the full test suite**

Run: `npm run typecheck && npm run test && npm run lint`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add api/admin.js api/notify.js CLAUDE.md
git commit -m "feat: add ai_call_log retention + admin/Telegram visibility (W3)"
```

**Note for the implementer:** a new cron-job.org job pointing at
`GET/POST https://www.fypro.com.ng/api/admin?action=prune-ai-cost-log` with the
`x-cron-secret` (or `Authorization: Bearer <CRON_SECRET>`) header must be registered
manually — this is an external, human setup step (same as the existing daily-report and
nurture-email cron jobs), not something this task can provision. Flag this clearly as an
open follow-up in your task report so it isn't silently left undone.

---

## Post-plan verification (for the final whole-branch review, not a task)

- `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;`
  must return zero rows after the migration is applied.
- Every one of the 8 AI-cost-producing actions (general workflow steps, defense,
  supervisor-prep, defence-brief, defence-brief-coach, project-reviewer streaming,
  project-reviewer non-streaming, topic-validator, lit-map — 9 counting both
  project-reviewer paths) should be traceable to a `logAiCall` call site added in
  Tasks 3–6.
- `npm run lint:api` must still report the same function count (no new serverless
  function was added — only `api/_lib/ai-cost-log.js`, which is a `_lib` module, and
  changes inside existing `admin.js`/`ai.js`/`project-reviewer.js`/`research.js`).
