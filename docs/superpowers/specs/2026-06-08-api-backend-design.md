# API/Backend: Zod Validation + Request Tracing
**Date:** 2026-06-08
**Status:** Approved

---

## Problem

Three gaps in the current API layer:

1. **Weak input validation** — `auth.js` accepts any string as an email or password (Supabase silently rejects short passwords with a confusing error). `payments.js` validates `tier` via a runtime throw inside a utility function, returning a 500 instead of a clean 400. `ai.js` passes the `messages` array to Anthropic with no shape check — a malformed array causes a cryptic upstream error.

2. **No request tracing** — Frontend Sentry errors and backend Vercel logs are completely disconnected. When a user reports a bug, there is no way to find the corresponding backend log entry.

---

## Design

### 1. Shared validation library — `api/_lib/validate.js`

A single file that owns all Zod schemas and exports a `validate(schema, data)` helper.

```js
// Returns { ok: true } or { ok: false, error: 'human-readable message' }
validate(AuthLoginSchema, req.body)
```

**Schemas defined:**

| Schema | Fields validated |
|--------|-----------------|
| `AuthLoginSchema` | `email` — valid email format; `password` — string, min 1 char |
| `AuthSignupSchema` | `email` — valid email format; `password` — string, min 8 chars; `full_name` — optional string, max 100 chars |
| `AuthForgotSchema` | `email` — valid email format |
| `PaymentInitiateSchema` | `tier` — enum of `student_pack`, `defense_pack`, `project_reset` |
| `AiMessagesSchema` | `messages` — array of `{ role: 'user'|'assistant', content: string }`, min 1 item |

Validation runs **before auth and rate limiting** so invalid requests are rejected cheaply, without hitting Upstash or Supabase.

The `validate()` helper returns the first Zod issue message — plain English, no stack traces in the response.

---

### 2. Request tracing — `api/_lib/trace.js`

Two exports:

- **`generateTraceId()`** — returns a short ID like `fyp-3a8f2c1b` (prefix + 8 random hex chars). Short enough to paste into Vercel log search; unique enough that collisions are negligible.
- **`traceLog(traceId, level, ...args)`** — wraps `console.error` / `console.warn` with a `[fyp-3a8f2c1b]` prefix so every log line in a request shares the same ID.

**Backend flow per request:**

```
generateTraceId()                        ← always first
  ↓
validate() — if invalid, return 400
             response still includes X-Trace-Id header
  ↓
traceLog() for all console.error / console.warn calls
  ↓
res.setHeader('X-Trace-Id', traceId)    ← on every response, success or error
```

**Frontend:**

`src/services/api.js` already wraps all fetch calls. It will read the `X-Trace-Id` header from every response and store the last trace ID in a module-level variable. A `getLastTraceId()` export makes it readable anywhere.

`src/lib/sentry.ts` adds a `setTraceId(id)` function that calls `Sentry.setTag('trace_id', id)`. Called from `api.js` after each response.

When a Sentry error fires, the `trace_id` tag is already set on the scope from the last API call. You search that ID in Vercel logs and immediately find the backend error.

---

### 3. Files changed

| File | Change |
|------|--------|
| `api/_lib/validate.js` | **New** — Zod schemas + `validate()` helper |
| `api/_lib/trace.js` | **New** — `generateTraceId()` + `traceLog()` |
| `api/auth.js` | Add schema validation + trace ID on all three handlers |
| `api/payments.js` | Add tier enum validation + trace ID on `initiate` and `verify` |
| `api/ai.js` | Add messages schema validation + trace ID on `handleGeneral` and `handleDefense` |
| `src/services/api.js` | Read `X-Trace-Id` from responses, call `setTraceId()` |
| `src/lib/sentry.ts` | Add `setTraceId()` — sets `trace_id` tag on active Sentry scope |

---

## What is NOT changing

- No changes to rate limiting, auth, or HMAC logic
- No new npm packages beyond adding `zod` as a direct dependency (already in node_modules as a transitive dep)
- No changes to any frontend component — only `api.js` service layer and `sentry.ts`
- No changes to the webhook handler in `payments.js` — it has no user-controlled JSON body to validate

---

## Error response format

Validation errors return HTTP 400:
```json
{ "error": "Invalid email address." }
```

All error responses (including existing ones) now also include the trace ID in the `X-Trace-Id` **header** (not the body — keeps the body format stable for existing frontend error handling).

---

## Out of scope

- Full OpenTelemetry / distributed tracing — overkill for current scale
- Validating every field in every handler — only the gaps that cause real problems
- New tests — test coverage is audit area #8, a separate session
