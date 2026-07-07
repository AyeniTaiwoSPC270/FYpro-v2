# Design: Don't Charge Free-Tier Runs (or Cache) on Unusable AI Output

**Date:** 2026-07-07
**Status:** Approved

## Problem

Three steps enforce a free-tier lifetime/daily run cap by reserving a slot in Redis
before calling Anthropic, then refunding it (`refundRun()` / `redis.decr`) if the
Anthropic call returns an HTTP error or throws (timeout, network failure). That part
already works correctly.

The gap: when Anthropic responds `200 OK` but the generated text isn't usable —
truncated by `max_tokens`, wrapped in prose instead of clean JSON, or otherwise
malformed — the server currently treats this as a success. It:

1. Syncs the run count in `user_entitlements.run_counts` (charging the user's free run)
2. Caches the broken response for hours (`setCached`, TTL 12–24h)
3. Returns `200` with the unusable payload

The client then tries to parse that same text, fails, and shows the user a generic
error — after they've already lost one of their 3 free runs and after Anthropic has
already billed real tokens for output nobody can use.

`api/research.js` (topic-validator) actually already attempts a server-side JSON parse
(to inject paper data into the verdict), but on failure it just `console.warn`s and
falls through to `res.status(200)` anyway — same outcome, half-built fix already in
place.

Real Anthropic $ cost can't be un-spent once Anthropic responds — that part of the
complaint is unavoidable after the fact. What *can* be fixed is (a) not charging the
free-tier run count for output nobody can use, and (b) making repeated waste visible
so it can be investigated.

## Scope

Fix applies to the 3 free-tier-limited steps only:
- `topic-validator` (`api/research.js`, action=validate)
- `chapter-architect` and `methodology-advisor` (`api/ai.js`, `handleGeneral`)

`instrument-builder`, `writing-planner`, `supervisor-email`, and `abstract-generator`
also flow through `handleGeneral` but are not run-limited today — they are
intentionally left untouched to keep the change's blast radius small.

## Design

### 1. Shared validation helper — `api/_lib/parse-model-json.js`

```js
export function extractModelJson(data) {
  if (data?.stop_reason === 'max_tokens') {
    return { ok: false, reason: 'truncated' };
  }
  const text = data?.content?.[0]?.text ?? '';
  try {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const parsed = JSON.parse(match ? match[0] : cleaned);
    if (parsed && typeof parsed === 'object') return { ok: true, parsed };
    return { ok: false, reason: 'unparseable' };
  } catch {
    return { ok: false, reason: 'unparseable' };
  }
}
```

This mirrors the extraction logic already duplicated across ~6 functions in
`src/services/api.js` (strip code fences, regex-match, `JSON.parse`). It is a
structural validity check (parses to a non-null object/array), not full per-step
schema validation — consistent with how `parsePanelTurnScores` in `api/ai.js`
already validates defense-turn output.

### 2. `api/ai.js` — `handleGeneral`

After `callAnthropic` returns with `response.ok === true`, and only when
`isLimitedStep` is true:

- Call `extractModelJson(data)` **before** `setCached` and **before** the run-count
  sync (currently lines ~212–227).
- On failure: call the existing `refundRun()` closure, call
  `logServerGenerationFailure(...)` (see below), skip `setCached`, skip the run-count
  sync, and return `res.status(422).json({ error: <reassuring message> })`.
- On success: unchanged — cache, sync run count, return `200`.

Non-limited steps in the same handler keep exactly today's behavior (no validation).

### 3. `api/research.js` — topic-validator

Existing code (lines ~221–267) already attempts a JSON parse to inject paper data,
but swallows a failure with a `console.warn` and falls through to `res.status(200)`.
Restructure so a parse failure — or `stop_reason === 'max_tokens'`, which isn't
checked today — takes the same early-return path the existing `!response.ok` branch
already uses: `refundRun()`, `logServerGenerationFailure(...)`, `res.status(422)`,
and move `setCached` to fire only after validation passes (currently unconditional
on `response.ok`).

### 4. Cost-side visibility — `api/_lib/generation-failure.js`

```js
export async function logServerGenerationFailure({ userId, feature, errorMessage }) {
  try {
    await supabaseAdmin.from('generation_failures').insert({
      user_id: userId || null,
      feature,
      error_type: 'validation',
      error_message: errorMessage,
    });
  } catch (err) {
    console.error('[generation-failure] log insert failed:', err?.message);
  }
}
```

Best-effort, never throws — matches the existing client-side `logFailure()` pattern.
Writes through `supabaseAdmin` (service role bypasses RLS), so no migration is
needed against the existing `generation_failures` table (migration 0004). These rows
surface in the admin dashboard's existing Generation Failures view alongside
client-logged failures. No new Telegram alert channel per this design — the existing
admin view is sufficient visibility for now.

### 5. Client — `src/services/api.js`

Server responds `422` (a status not used by these endpoints today, so it can't
collide with the existing 429/503/504/400 special-casing in `callClaude` and the
topic-validator/literature-map fetch functions).

- In each of the 3 relevant fetch functions, add:
  ```js
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body?.error || 'Invalid AI response');
    err.code = 'AI_INVALID_RESPONSE';
    throw err;
  }
  ```
- In `handleApiError`, add a branch mapping `AI_INVALID_RESPONSE` to a new
  `AI_ERRORS.invalid_response`:
  > "FYPro's AI returned an unusable response. This attempt didn't use one of your
  > free generations — please try again."

### Retry behavior

No auto-retry. The user sees the error and clicks Generate again manually — this
avoids silently doubling worst-case API spend per request, at the cost of one extra
click when this (rare) failure occurs.

### Abuse consideration

Removing the cache-on-failure and run-count-charge-on-failure could theoretically let
someone hammer an input that reliably produces bad output, forcing repeated real
Anthropic calls at no cost to their own free-tier count. This is already bounded by
existing, unrelated protections: the per-user daily rate limit (30 req/day on
`claude` prefix) and the per-user daily spend cap (`checkUserCap`) both still apply
regardless of run-count charging. No new mechanism is added for this in this design.

## Testing

- Unit tests for `extractModelJson`: valid JSON, JSON wrapped in prose, JSON in code
  fences, truncated (`stop_reason: 'max_tokens'`), empty content, non-object JSON
  (e.g. a bare string or number).
- `api/ai.js` handleGeneral: verify a validation failure on a limited step calls
  `refundRun`, does not call `setCached`, does not sync run count, and returns 422.
  Verify a non-limited step (e.g. writing-planner) is unaffected by malformed output
  (returns 200 as today — out of scope for this fix).
- `api/research.js`: verify a validation failure refunds the run, does not cache, and
  returns 422 instead of falling through to 200.
- Client: verify `handleApiError` shows the new reassuring message for
  `AI_INVALID_RESPONSE` and that existing error-code branches are unaffected.
