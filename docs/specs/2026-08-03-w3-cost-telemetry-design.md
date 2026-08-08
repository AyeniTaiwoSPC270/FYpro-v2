# W3 — Cost & Telemetry Design

**Parent program:** `docs/specs/2026-07-31-infra-9-plus-program-design.md`, §9 (W3 — Cost & telemetry).
**Status:** approved, not yet implemented.

## Goal

Give every Anthropic call a per-call cost/token/cache/trace record, so the Express Defence
margin question ("is ₦2,000 profitable at the 5-review cap?") and cache-effectiveness
questions can be answered with a query instead of guesswork. Today only a daily rollup
(`daily_usage`) exists — no per-call attribution.

## Current state (as of 2026-08-03)

Three separate code paths make Anthropic calls, each with its own duplicated tracking logic:

1. **`api/_lib/anthropic-proxy.js`** (`callAnthropic()`) — the shared choke point used by
   `api/ai.js` for 5 actions: general workflow steps, defense, supervisor-prep,
   defence-brief, defence-brief-coach. Already calls `trackUsage`/`trackUserUsage` and
   inserts into `response_times`.
2. **`api/project-reviewer.js`** — hand-rolled fetch to the Anthropic API (streaming and
   non-streaming variants), with its own `trackUsage`/`trackUserUsage` + `response_times`
   insert calls, duplicated rather than shared with `callAnthropic`.
3. **`api/research.js`** — same pattern, duplicated again, for `topic-validator` and
   `lit-map`.

Gaps this design closes:

- Cache hits are invisible to cost/usage tracking. In `api/ai.js` a cache hit returns
  before `callAnthropic` is ever called. In `research.js` a cache hit inserts a
  `response_times` row with `duration_ms: 0` and no cache marker. Neither path calls
  `trackUsage`, so there's no per-feature cache-hit-rate signal anywhere — only a global
  daily Redis counter (`stats:cache_hits:DATE`) with no feature breakdown.
- `api/project-reviewer.js` and `api/research.js` have **no trace ID support at all** —
  zero references to `generateTraceId`/`traceId`/`X-Trace-Id` in either file. Only
  `api/ai.js` generates one per request.
- No server-side `Sentry.captureException` call (12 sites across `api/`) is tagged with
  the request's trace ID, so a server-side Sentry alert can't currently be traced back to
  the request that caused it.
- Model-level USD pricing (`MODEL_PRICING`, `estimateCallCostUsd`) already exists in
  `api/_lib/usage-tracker.js` and should be reused, not reimplemented.

## Architecture

### New table: `ai_call_log`

A dedicated table, not an extension of `response_times` — keeps the existing
latency-monitoring table (which the admin dashboard reads live for "recent activity" /
"active sessions") separate from the new cost/billing ledger, which carries a 90-day
retention policy and billing-relevant data.

Migration `0043_ai_call_log.sql`:

```sql
CREATE TABLE public.ai_call_log (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid        REFERENCES auth.users(id),
  feature       text        NOT NULL,   -- e.g. 'topic-validator', 'defense', 'project-reviewer'
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
-- No client policies — service-role only, same posture as dead_letter_queue (migration 0042).
-- There is no legitimate client-side read or write path.

-- Verify: must return zero rows
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
```

Cache hits are logged as rows too (`cache_hit: true`, `cost_usd: 0`, `tokens_in/out: 0`)
rather than tracked in a separate Redis counter. This makes cache-hit rate per feature a
single SQL query instead of requiring a Redis read-out path, and gives cache-hit rows the
same 90-day retention handling as real calls for free.

### Shared write path: `api/_lib/ai-cost-log.js`

```js
export async function logAiCall({ userId, feature, model, tokensIn = 0, tokensOut = 0, cacheHit = false, traceId, durationMs }) {
  const cost = estimateCallCostUsd(tokensIn, tokensOut, model); // imported from usage-tracker.js, exported there
  const insertPromise = supabaseAdmin.from('ai_call_log').insert({
    user_id: userId, feature, model,
    tokens_in: tokensIn, tokens_out: tokensOut,
    cost_usd: cost, cache_hit: cacheHit, trace_id: traceId, duration_ms: durationMs,
  });
  const timeoutPromise = new Promise(resolve => setTimeout(resolve, 3000));
  await Promise.race([insertPromise, timeoutPromise]).catch(err =>
    console.error(`[ai-cost-log] insert failed (${feature}):`, err?.message)
  );
}
```

`estimateCallCostUsd` and `pricingFor` move from module-private to exported in
`usage-tracker.js` so this module reuses them instead of reimplementing pricing.
Never throws; awaited before the response is sent (Vercel freezes the function
immediately after), same constraint `trackUsage`/`trackUserUsage` already document and
the same bounded-race-against-timeout pattern `anthropic-proxy.js` already uses for its
`response_times` insert.

One function replaces three duplicated tracking blocks — the same class of bug that
caused the pre-W2 unawaited-fire-and-forget issues (drift between near-identical blocks
in different files) is the risk this consolidation removes.

## Call sites

**`api/_lib/anthropic-proxy.js`** — `callAnthropic()` gains a `traceId` parameter
(threaded from each caller). On a successful response it calls
`logAiCall({ ..., cacheHit: false })` alongside (not instead of) the existing
`trackUsage`/`trackUserUsage` calls — those still drive the Redis spend-cap counters,
a separate concern from this per-call ledger. Covers all 5 `api/ai.js` actions in one
place.

**`api/ai.js`** — pass the already-generated `traceId` into `callAnthropic`. Add
`logAiCall({ ..., cacheHit: true, tokensIn: 0, tokensOut: 0 })` on the two cache-hit
branches (general-step handler, supervisor-prep handler); `model` is already resolved
before the cache check in both.

**`api/project-reviewer.js`** — add `generateTraceId()` + `X-Trace-Id` response header +
`traceLog` (mirroring the `api/ai.js` pattern this file currently lacks entirely).
Replace both duplicated `trackUsage` + `response_times` blocks (streaming and
non-streaming) with `logAiCall(...)`. This file has no caching (per CLAUDE.md: "Project
Reviewer: NOT cached"), so no cache-hit branch needed.

**`api/research.js`** — same trace-ID addition. Replace the duplicated tracking blocks
for `topic-validator` and `lit-map` (2 real-call sites, 2 cache-hit sites) with
`logAiCall(...)`, `cacheHit: true` on the cache-hit branches that today insert a bare
`duration_ms: 0` row with no cache marker.

**Sentry tagging** (adjacent fix, scoped to these same 3 files only — not the other 9
`Sentry.captureException` call sites project-wide, which aren't part of the AI-cost
chain): `Sentry.captureException(err)` → `Sentry.captureException(err, { tags: { trace_id: traceId } })`
in `api/ai.js`, `api/project-reviewer.js`, `api/research.js`. This isn't required by exit
criterion 4 (client-side Sentry, server log line, and the cost row's `trace_id` column
already share the ID without it) but closes a real, related gap: today a server-side
Sentry alert on an AI call can't be traced to its request.

Net effect: all 8 AI-cost-producing actions across 3 files write through one function,
with one trace ID threaded end to end, and cache hits become visible rows instead of an
invisible fast path.

## Retention

New `action=prune-ai-cost-log` in `api/admin.js` — no new serverless function (admin.js
already exists, stays within the 12-function Hobby-plan limit), gated by `CRON_SECRET`
exactly like the existing `daily-report` action. Hard-deletes `ai_call_log` rows older
than 90 days. No rollup step needed — `daily_usage` already retains long-term aggregate
totals independently of this per-call table.

Requires a new cron-job.org job pointing at this action, set up the same manual way the
existing daily-report and nurture-email jobs were (external step, not something the
implementation can provision itself — call this out explicitly in the plan/runbook so it
isn't silently left undone the way past cron jobs required a manual registration step).

## Admin visibility

Add `ai_call_log` to the `ALLOWED` table lists in `api/admin.js` (Data Tab 29-table
browser) and `api/notify.js` (Telegram `/data` command) — same treatment `response_times`
already gets. This is browsability only, not a dedicated dashboard card; the margin and
cache-hit-rate questions are answered by ad-hoc SQL (below), not new UI.

### Example queries

```sql
-- Lifetime AI cost per Express Defence user (exit criterion 2)
SELECT l.user_id, SUM(l.cost_usd) AS lifetime_cost_usd
FROM ai_call_log l
JOIN user_entitlements e ON e.user_id = l.user_id
WHERE e.paid_features ? 'express_defense'
GROUP BY l.user_id;

-- Cache hit rate per feature (exit criterion 3)
SELECT feature,
       COUNT(*) FILTER (WHERE cache_hit) * 1.0 / COUNT(*) AS hit_rate
FROM ai_call_log
GROUP BY feature;
```

## Testing scope

- New vitest coverage for `logAiCall` itself: cost calculation correctness (reusing
  `estimateCallCostUsd`), cache-hit row shape (`cost_usd: 0`, `tokens: 0`,
  `cache_hit: true`), never-throws behavior on a Supabase insert failure — mirroring the
  style of the existing usage-tracker tests.
- Known integration point for the implementation plan: `api/ai.failure-policy.test.js`
  and other `api/ai*.test.js` suites mock `api/_lib/usage-tracker.js` at the module
  boundary; their mocks will need extending to cover the new `ai-cost-log.js` import so
  those suites don't silently stop exercising the real call path. Not resolved here —
  flagged for the implementer.

## Exit criteria mapping

| # | Criterion | Satisfied by |
|---|-----------|--------------|
| 1 | Every Anthropic call writes a row with user_id, feature, model, tokens_in/out, cost_usd, cache_hit, trace_id, duration_ms, created_at | `ai_call_log` schema + `logAiCall` called from all 8 actions across 3 files |
| 2 | Single query answers lifetime AI cost per Express Defence user | Example query above; `user_entitlements` join |
| 3 | Cache hit rate queryable per feature | Cache hits logged as rows with `cache_hit: true`; example query above |
| 4 | One trace ID joins client Sentry error → server log line → cost row | `traceId` threaded into `logAiCall`'s `trace_id` column; client-side Sentry tagging and `traceLog` server log lines already existed pre-W3 |
| 5 | Retention policy beyond ~90 days | `prune-ai-cost-log` admin action, cron-job.org scheduled, hard-delete |

## Out of scope for W3

- Server-side Sentry trace-ID tagging for the other 9 `Sentry.captureException` call
  sites outside the AI-cost chain (auth, payments, admin, referral, notify, certificate,
  speak, share-card, send-nurture-email) — real gap, separate follow-up.
- A dedicated admin Data Tab card for cost/margin data — ad-hoc SQL/Telegram `/data`
  browsing covers the exit criteria; a visual card is a future enhancement if the margin
  question needs checking often enough to justify the UI work.
- Rolling up `ai_call_log` rows before deletion — `daily_usage` already serves as the
  long-term aggregate; no rollup step is needed for this table's stated purpose
  (per-call attribution, not historical reporting).
