# Generation Failure Run Refund Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop charging a user's free-tier run count (and stop caching the response) when Claude's output for topic-validator, chapter-architect, or methodology-advisor comes back `200 OK` but is truncated or unparseable — and make these failures visible server-side.

**Architecture:** A new shared helper, `extractModelJson`, does the same JSON-extraction the client already does (strip code fences, regex-match, `JSON.parse`, and check `stop_reason`), but runs server-side *before* the existing `refundRun()` / cache / run-count-sync decision point in `api/ai.js` and `api/research.js`. A validation failure takes the same "don't charge" path an Anthropic HTTP error already takes today. A second new helper, `logServerGenerationFailure`, writes these failures into the existing `generation_failures` table (server-side, more reliable than the client's best-effort insert). The client gets a new `422` branch so the reassuring "this didn't use one of your free generations" message actually reaches the user instead of falling back to a generic error.

**Tech Stack:** Vercel serverless functions (`api/`), Vitest for unit tests, Supabase service-role client for logging.

Spec: `docs/superpowers/specs/2026-07-07-generation-failure-run-refund-design.md`

---

### Task 1: `extractModelJson` helper

**Files:**
- Create: `api/_lib/parse-model-json.js`
- Test: `api/_lib/parse-model-json.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// api/_lib/parse-model-json.test.js
import { describe, it, expect } from 'vitest';
import { extractModelJson } from './parse-model-json.js';

function anthropicResponse(text, stopReason = 'end_turn') {
  return { stop_reason: stopReason, content: [{ text }] };
}

describe('extractModelJson', () => {
  it('accepts clean JSON', () => {
    const r = extractModelJson(anthropicResponse('{"verdict":"strong"}'));
    expect(r).toEqual({ ok: true, parsed: { verdict: 'strong' } });
  });

  it('accepts JSON wrapped in a ```json code fence', () => {
    const r = extractModelJson(anthropicResponse('```json\n{"verdict":"strong"}\n```'));
    expect(r.ok).toBe(true);
    expect(r.parsed).toEqual({ verdict: 'strong' });
  });

  it('accepts JSON with surrounding prose', () => {
    const r = extractModelJson(anthropicResponse('Here is the result: {"verdict":"strong"} Hope that helps!'));
    expect(r.ok).toBe(true);
    expect(r.parsed).toEqual({ verdict: 'strong' });
  });

  it('accepts a JSON array', () => {
    const r = extractModelJson(anthropicResponse('[{"a":1},{"a":2}]'));
    expect(r.ok).toBe(true);
    expect(r.parsed).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('rejects truncated output even if the partial text looks parseable', () => {
    const r = extractModelJson(anthropicResponse('{"verdict":"str', 'max_tokens'));
    expect(r).toEqual({ ok: false, reason: 'truncated' });
  });

  it('rejects unparseable prose with no JSON in it', () => {
    const r = extractModelJson(anthropicResponse('Sorry, I cannot help with that request.'));
    expect(r).toEqual({ ok: false, reason: 'unparseable' });
  });

  it('rejects empty content', () => {
    const r = extractModelJson({ stop_reason: 'end_turn', content: [] });
    expect(r).toEqual({ ok: false, reason: 'unparseable' });
  });

  it('rejects a bare JSON primitive (not an object or array)', () => {
    const r = extractModelJson(anthropicResponse('42'));
    expect(r).toEqual({ ok: false, reason: 'unparseable' });
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- api/_lib/parse-model-json.test.js`
Expected: FAIL — `Cannot find module './parse-model-json.js'`

- [ ] **Step 3: Write the implementation**

```js
// api/_lib/parse-model-json.js
// Structural validation for Claude's raw JSON output — run this BEFORE deciding
// whether a request charges a free-tier run or gets cached. Mirrors the
// extraction logic already duplicated across src/services/api.js (strip code
// fences, regex-match, JSON.parse), so the server rejects the same malformed
// output the client would reject anyway — but before spending the user's free
// run on it.

/**
 * @param {object} data - Raw Anthropic Messages API response body.
 * @returns {{ ok: true, parsed: object } | { ok: false, reason: 'truncated' | 'unparseable' }}
 */
export function extractModelJson(data) {
  if (data?.stop_reason === 'max_tokens') {
    return { ok: false, reason: 'truncated' };
  }

  const text = data?.content?.[0]?.text ?? '';
  try {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const match   = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const parsed  = JSON.parse(match ? match[0] : cleaned);
    if (parsed && typeof parsed === 'object') return { ok: true, parsed };
    return { ok: false, reason: 'unparseable' };
  } catch {
    return { ok: false, reason: 'unparseable' };
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- api/_lib/parse-model-json.test.js`
Expected: PASS (8 tests)

- [ ] **Step 5: Commit**

```bash
git add api/_lib/parse-model-json.js api/_lib/parse-model-json.test.js
git commit -m "feat: add server-side model-JSON validation helper"
```

---

### Task 2: `logServerGenerationFailure` helper

**Files:**
- Create: `api/_lib/generation-failure.js`
- Test: `api/_lib/generation-failure.test.js`

- [ ] **Step 1: Write the failing tests**

```js
// api/_lib/generation-failure.test.js
// Mirrors the mocking style of run-reservation.test.js: stub supabase-admin.js
// so each test programs its own insert() behavior.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ insert: null }));

vi.mock('./supabase-admin.js', () => ({
  supabaseAdmin: {
    from: () => ({ insert: (...a) => h.insert(...a) }),
  },
}));

const { logServerGenerationFailure } = await import('./generation-failure.js');

beforeEach(() => {
  h.insert = vi.fn().mockResolvedValue({ error: null });
});

describe('logServerGenerationFailure', () => {
  it('inserts a row with the expected shape', async () => {
    await logServerGenerationFailure({
      userId: 'u1',
      feature: 'chapter_architect',
      errorMessage: 'validation failed (truncated)',
    });
    expect(h.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      feature: 'chapter_architect',
      error_type: 'validation',
      error_message: 'validation failed (truncated)',
    });
  });

  it('falls back to null user_id when none is given', async () => {
    await logServerGenerationFailure({ userId: null, feature: 'topic_validator', errorMessage: 'x' });
    const row = h.insert.mock.calls[0][0];
    expect(row.user_id).toBeNull();
  });

  it('clips an overly long error message to 500 chars', async () => {
    await logServerGenerationFailure({ userId: 'u1', feature: 'x', errorMessage: 'a'.repeat(600) });
    const row = h.insert.mock.calls[0][0];
    expect(row.error_message).toHaveLength(500);
  });

  it('never throws when the insert rejects', async () => {
    h.insert.mockRejectedValue(new Error('db down'));
    await expect(
      logServerGenerationFailure({ userId: 'u1', feature: 'x', errorMessage: 'y' })
    ).resolves.toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npm run test -- api/_lib/generation-failure.test.js`
Expected: FAIL — `Cannot find module './generation-failure.js'`

- [ ] **Step 3: Write the implementation**

```js
// api/_lib/generation-failure.js
// Server-side counterpart to the client's best-effort logFailure() in
// src/services/api.js — but reliable in cases the client never learns about
// (e.g. this request's own JSON validation failure, detected and handled
// entirely server-side before a response is sent). Writes through the service
// role client, which bypasses RLS, so no policy change is needed against the
// existing generation_failures table (migration 0004).

import { supabaseAdmin } from './supabase-admin.js';

/**
 * @param {object} args
 * @param {string|null} args.userId       - Verified Supabase user id (table allows null)
 * @param {string}      args.feature      - snake_case or kebab-case step identifier
 * @param {string}      args.errorMessage - Human-readable failure detail (not user-facing)
 * @returns {Promise<void>} Never throws.
 */
export async function logServerGenerationFailure({ userId, feature, errorMessage }) {
  try {
    await supabaseAdmin.from('generation_failures').insert({
      user_id:       userId || null,
      feature,
      error_type:    'validation',
      error_message: String(errorMessage).slice(0, 500),
    });
  } catch (err) {
    console.error('[generation-failure] log insert failed:', err?.message);
  }
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npm run test -- api/_lib/generation-failure.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: Commit**

```bash
git add api/_lib/generation-failure.js api/_lib/generation-failure.test.js
git commit -m "feat: add server-side generation-failure logger"
```

---

### Task 3: Wire validation into `api/ai.js` handleGeneral

**Files:**
- Modify: `api/ai.js:1-20` (imports), `api/ai.js:196-230` (handleGeneral)

**Note on testing:** `handleGeneral` is not unit-tested anywhere today — it's a large
Vercel handler wired to ~8 dependencies (auth, rate limiting, cache, entitlements,
Anthropic, Telegram, trace, Sentry), consistent with this codebase's existing test
coverage split: pure/extracted `_lib` helpers get unit tests (as in Tasks 1–2), the
handler files that wire them together are verified manually (per CLAUDE.md: "Verify
visually in browser after every session"). Building a full mock harness for this
function is out of scope for this fix — the new logic itself (`extractModelJson`,
`logServerGenerationFailure`) is already fully unit-tested in isolation; what's added
here is a few lines of glue code calling them.

- [ ] **Step 1: Add the two new imports**

In `api/ai.js`, find:

```js
import { reserveRun, syncRunCount } from './_lib/run-reservation.js';
import { getExpressBetaFree } from './_lib/express-beta.js';
```

Replace with:

```js
import { reserveRun, syncRunCount } from './_lib/run-reservation.js';
import { getExpressBetaFree } from './_lib/express-beta.js';
import { extractModelJson } from './_lib/parse-model-json.js';
import { logServerGenerationFailure } from './_lib/generation-failure.js';
```

- [ ] **Step 2: Insert the validation gate before caching / run-count sync**

In `api/ai.js`, find this exact block inside `handleGeneral`:

```js
    if (response.ok) {
      setCached(cacheKey, data, ttl); // intentional fire-and-forget: cache write failure does not affect response

      // Sync the DB run count for free users — fire-and-forget, display/fallback only.
      // The Redis reservation above is the enforcement source; the DB copy mirrors it
      // (or falls back to read+1 when Redis was unavailable).
      if (isLimitedStep) {
```

Replace with:

```js
    if (response.ok) {
      // Reject a "successful" Anthropic call whose output is truncated or not
      // valid JSON BEFORE it can charge a free-tier run or get cached — the
      // user never gets a usable result either way, so it must not count
      // against their free-run allowance. Only gated on isLimitedStep because
      // the other four steps handled by this function aren't run-limited.
      if (isLimitedStep) {
        const check = extractModelJson(data);
        if (!check.ok) {
          refundRun();
          logServerGenerationFailure({
            userId: user.id,
            feature: dbKey,
            errorMessage: `validation failed (${check.reason})`,
          });
          res.setHeader('X-Cache', 'MISS');
          return res.status(422).json({
            error: "FYPro's AI returned an unusable response. This attempt didn't use one of your free generations — please try again.",
          });
        }
      }

      setCached(cacheKey, data, ttl); // intentional fire-and-forget: cache write failure does not affect response

      // Sync the DB run count for free users — fire-and-forget, display/fallback only.
      // The Redis reservation above is the enforcement source; the DB copy mirrors it
      // (or falls back to read+1 when Redis was unavailable).
      if (isLimitedStep) {
```

- [ ] **Step 3: Run the existing test suite**

Run: `npm run test`
Expected: PASS — no existing test touches `handleGeneral` directly, this confirms nothing else broke.

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Manual verification**

Start the app locally (`vercel dev` or the project's normal dev command) and run a normal Chapter Architect or Methodology Advisor generation end-to-end as a free-tier user. Confirm:
- A normal (valid) generation still succeeds exactly as before (200, result renders, run count decrements by one in the UI).
- Nothing about this change is reachable from a real user without deliberately breaking the Anthropic response, so this is a regression check, not a fault-injection test.

- [ ] **Step 6: Commit**

```bash
git add api/ai.js
git commit -m "fix: don't charge free-tier run for unparseable Claude output in handleGeneral"
```

---

### Task 4: Wire validation into `api/research.js` handleValidate

**Files:**
- Modify: `api/research.js:1-16` (imports), `api/research.js:220-267` (handleValidate)

**Note on testing:** same rationale as Task 3 — `handleValidate` has no existing unit
tests (large handler wired to auth, rate limiting, cache, entitlements, paper
fetching, Anthropic). The new decision logic is a thin wrapper around the
already-unit-tested `extractModelJson` and `logServerGenerationFailure`.

- [ ] **Step 1: Add the two new imports**

In `api/research.js`, find:

```js
import { writeSystemLog }                 from './_lib/system-log.js';
import { Sentry }                         from './_lib/sentry-server.js';
```

Replace with:

```js
import { writeSystemLog }                 from './_lib/system-log.js';
import { Sentry }                         from './_lib/sentry-server.js';
import { extractModelJson }               from './_lib/parse-model-json.js';
import { logServerGenerationFailure }     from './_lib/generation-failure.js';
```

- [ ] **Step 2: Replace the papers-injection block with validate-then-inject**

In `api/research.js`, find this exact block inside `handleValidate`:

```js
    if (response.ok && data.content?.[0]?.text) {
      try {
        const raw     = data.content[0].text;
        const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        const match   = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          const verdict = JSON.parse(match[0]);
          verdict.papers            = papersResult.papers;
          verdict.papers_status     = papersResult.status;
          verdict.sparse_literature = papersResult.sparse_literature;
          data.content[0].text      = JSON.stringify(verdict);
        }
      } catch {
        console.warn('[research/validate] Could not inject papers into Claude response — returning verdict only');
      }
    }

    if (!response.ok) {
      refundRun(); // Anthropic returned an error status — don't charge the run
      const errorMsg = data?.error?.message || data?.error || `Claude API error (${response.status})`;
      console.error('[research/validate] Anthropic error:', response.status, errorMsg);
      return res.status(502).json({ error: errorMsg });
    }

    res.setHeader('X-Cache', 'MISS');
    setCached(claudeKey, data, CLAUDE_TTL);
```

Replace with:

```js
    if (!response.ok) {
      refundRun(); // Anthropic returned an error status — don't charge the run
      const errorMsg = data?.error?.message || data?.error || `Claude API error (${response.status})`;
      console.error('[research/validate] Anthropic error:', response.status, errorMsg);
      return res.status(502).json({ error: errorMsg });
    }

    // Reject a "successful" Anthropic call whose output is truncated or not
    // valid JSON BEFORE it can charge the free-tier run or get cached — this
    // replaces the old silent console.warn-and-continue behavior, which used
    // to charge the run and cache a broken response even when this exact
    // parse attempt failed.
    const check = extractModelJson(data);
    if (!check.ok) {
      refundRun();
      logServerGenerationFailure({
        userId: user.id,
        feature: 'topic_validator',
        errorMessage: `validation failed (${check.reason})`,
      });
      return res.status(422).json({
        error: "FYPro's AI returned an unusable response. This attempt didn't use one of your free generations — please try again.",
      });
    }

    // Inject real paper metadata into the validated verdict before caching/returning.
    check.parsed.papers            = papersResult.papers;
    check.parsed.papers_status     = papersResult.status;
    check.parsed.sparse_literature = papersResult.sparse_literature;
    data.content[0].text           = JSON.stringify(check.parsed);

    res.setHeader('X-Cache', 'MISS');
    setCached(claudeKey, data, CLAUDE_TTL);
```

- [ ] **Step 3: Run the existing test suite**

Run: `npm run test`
Expected: PASS

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 5: Manual verification**

Run a normal Topic Validator generation end-to-end as a free-tier user. Confirm:
- Verdict renders with `papers`, `papers_status`, and `sparse_literature` populated exactly as before.
- Run count still decrements by one on a successful generation.

- [ ] **Step 6: Commit**

```bash
git add api/research.js
git commit -m "fix: don't charge free-tier run for unparseable Claude output in topic-validator"
```

---

### Task 5: Client — surface the reassuring message

**Files:**
- Modify: `src/services/api.js` (imports unaffected — same file, three spots: `callClaude`, `AI_ERRORS`, `handleApiError`)

- [ ] **Step 1: Add the 422 branch to `callClaude`**

In `src/services/api.js`, find this exact block:

```js
  if (res.status === 504) {
    const err = new Error('Gateway timeout');
    err.code = 'GATEWAY_TIMEOUT';
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.code = 'HTTP_ERROR';
    err.status = res.status;
    throw err;
  }

  const raw = await res.json();
  const text = raw?.content?.[0]?.text ?? '';

  if (raw?.stop_reason === 'max_tokens') {
```

Replace with:

```js
  if (res.status === 504) {
    const err = new Error('Gateway timeout');
    err.code = 'GATEWAY_TIMEOUT';
    throw err;
  }
  if (res.status === 422) {
    const body = await res.json().catch(() => ({}));
    const err = new Error(body.error || 'AI returned an unusable response.');
    err.code = 'AI_INVALID_RESPONSE';
    throw err;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`);
    err.code = 'HTTP_ERROR';
    err.status = res.status;
    throw err;
  }

  const raw = await res.json();
  const text = raw?.content?.[0]?.text ?? '';

  if (raw?.stop_reason === 'max_tokens') {
```

*(Note: `callTopicValidator`'s existing generic `!res.ok` branch already reads `body.error` into the thrown message today, so the server's reassuring 422 text reaches the user through that existing path without any code change there — verified by inspection, no edit needed.)*

- [ ] **Step 2: Add the new error message**

In `src/services/api.js`, find:

```js
const AI_ERRORS = {
  rate_limit:    'FYPro is in high demand right now. Your progress is saved — please try again in {secs} seconds.',
  timeout:       'This is taking longer than expected. Your progress is saved. Please click Try Again.',
  network:       'Connection lost. Your progress is saved. Check your internet and try again.',
  generic:       'Something went wrong on our end. Your progress is saved. Please try again.',
  token_limit:   'Your input is too long. Please shorten it and try again.',
  json_parse:    'Received an unexpected response. Your progress is saved. Please try again.',
  forbidden:     'This feature requires a paid upgrade. Please visit the Pricing page to unlock it.',
  unauthorized:  'Your session has expired. Please sign in again.',
  unavailable:   'FYPro is temporarily unavailable. Your progress is saved. Please try again in a moment.',
};
```

Replace with:

```js
const AI_ERRORS = {
  rate_limit:       'FYPro is in high demand right now. Your progress is saved — please try again in {secs} seconds.',
  timeout:          'This is taking longer than expected. Your progress is saved. Please click Try Again.',
  network:          'Connection lost. Your progress is saved. Check your internet and try again.',
  generic:          'Something went wrong on our end. Your progress is saved. Please try again.',
  token_limit:      'Your input is too long. Please shorten it and try again.',
  json_parse:       'Received an unexpected response. Your progress is saved. Please try again.',
  invalid_response: "FYPro's AI returned an unusable response. This attempt didn't use one of your free generations — please try again.",
  forbidden:        'This feature requires a paid upgrade. Please visit the Pricing page to unlock it.',
  unauthorized:     'Your session has expired. Please sign in again.',
  unavailable:      'FYPro is temporarily unavailable. Your progress is saved. Please try again in a moment.',
};
```

- [ ] **Step 3: Handle the new code in `handleApiError`**

In `src/services/api.js`, find:

```js
  if (err.code === 'JSON_PARSE') {
    showError(AI_ERRORS.json_parse);
    return true;
  }
```

Replace with:

```js
  if (err.code === 'JSON_PARSE') {
    showError(AI_ERRORS.json_parse);
    return true;
  }
  if (err.code === 'AI_INVALID_RESPONSE') {
    showError(AI_ERRORS.invalid_response);
    return true;
  }
```

- [ ] **Step 4: Write the failing test**

```js
// src/services/api.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) } },
}));
vi.mock('../lib/sentry', () => ({ setTraceId: vi.fn() }));

const { buildChapters, handleApiError } = await import('./api.js');

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callClaude 422 handling', () => {
  it('throws AI_INVALID_RESPONSE with the server message on a 422', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      headers: { get: () => null },
      json: async () => ({ error: "This attempt didn't use one of your free generations." }),
    }));

    await expect(buildChapters({}, 'topic', 'linear', 8000, [])).rejects.toMatchObject({
      code: 'AI_INVALID_RESPONSE',
      message: "This attempt didn't use one of your free generations.",
    });
  });
});

describe('handleApiError AI_INVALID_RESPONSE', () => {
  it('shows the invalid_response message', () => {
    const showError = vi.fn();
    const handled = handleApiError({ code: 'AI_INVALID_RESPONSE' }, showError);
    expect(handled).toBe(true);
    expect(showError).toHaveBeenCalledWith(
      "FYPro's AI returned an unusable response. This attempt didn't use one of your free generations — please try again."
    );
  });
});
```

- [ ] **Step 5: Run the test to verify it fails first (before Steps 1-3 if not already applied) — then verify it passes**

Run: `npm run test -- src/services/api.test.js`
Expected: PASS (2 tests) — Steps 1–3 above must already be applied for this to pass, since the test targets the new behavior directly.

- [ ] **Step 6: Run the full test suite and typecheck**

Run: `npm run test && npm run typecheck`
Expected: PASS

- [ ] **Step 7: Commit**

```bash
git add src/services/api.js src/services/api.test.js
git commit -m "feat: surface reassuring message when AI output fails server-side validation"
```

---

### Task 6: Final full-suite verification

**Files:** None (verification only)

- [ ] **Step 1: Run the complete test suite**

Run: `npm run test`
Expected: PASS — all existing tests plus the new ones from Tasks 1, 2, and 5.

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

- [ ] **Step 3: Manual end-to-end smoke test**

Start the app locally and, as a free-tier user, run one full generation each for Topic Validator, Chapter Architect, and Methodology Advisor. Confirm for each:
- Generation succeeds normally and the free-run counter decrements by exactly one.
- No console errors related to `extractModelJson` or `logServerGenerationFailure`.

This is a regression check confirming the validation gate doesn't interfere with normal (valid) output — it cannot literally reproduce a truncated/malformed Claude response in a live environment, since that depends on what Claude actually returns.
