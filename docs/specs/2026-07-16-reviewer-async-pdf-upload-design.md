# Project Reviewer — Async PDF Upload (decouple upload from the 60s function budget)

**Date:** 2026-07-16
**Status:** Approved design — ready for implementation planning
**Feature area:** Project Reviewer (standard Defense Pack flow + Express Defence flow)

---

## Problem

The Project Reviewer keeps failing on slow (Nigerian) networks, and — until the fixes
shipped alongside this design — every failed attempt still burned a paid run.

Two root causes:

1. **The upload competes with the serverless budget.** The PDF is base64-encoded
   client-side (inflating its size ~33%) and sent as a single synchronous POST body to
   `api/project-reviewer.js`, which is capped at `maxDuration: 60` (the hard ceiling on
   Vercel's Hobby plan). On a slow connection, merely *transmitting* a multi-MB base64
   payload can take 40–90+ seconds — so the function is killed by the platform mid-upload
   before Claude is ever called. This surfaces to the user as a raw "network error" with
   nothing in `system_logs` or Sentry, because the platform killed the function rather
   than the app handling an error.

2. **Client/server timeout mismatch.** The server dies at 60s but the client watchdog in
   `ProjectReviewer.jsx` waits 120s. So on a bad connection the user sees the network
   error, then sits on a dead loading spinner for another ~60s before the client gives up
   — two confusing failures for one doomed attempt.

Observed in production 2026-07-14: one user, one PDF, two failures ~90s apart
(`network error`, then the 120s client timeout), no Telegram alert, nothing server-side.

### Already shipped (prerequisite fixes, not part of this build)

These landed while diagnosing the issue and are assumed present:

- **Telegram relay for client-detected failures.** `logFailure()` in `src/services/api.js`
  now also POSTs `{ action: 'generation_failed' }` to `api/notify.js`, which fires a
  deduped Telegram alert (`sendTelegramAlertOnce`, keyed `tg:genfail:{user}:{feature}:{day}`).
  Client-side timeouts/network drops are now visible to admin.
- **Client-side run refunds.** A `refundRun(stepKey)` helper in `src/hooks/useRunLimit.js`,
  wired into every non-success exit path of `ProjectReviewer.jsx` (file-read failure,
  relevance rejection, irrelevant-document response, malformed response, 120s timeout,
  general catch). A failed/rejected attempt no longer permanently burns a run.

This spec builds the actual reliability fix on top of those.

---

## Goal

Remove the 60-second function budget as a factor in whether a PDF review succeeds, by
moving the large file transfer off the serverless function entirely.

**Non-goals:** changing the DOCX or TXT paths (they don't hit the ceiling); changing the
Claude prompt, scoring, or streamed-result UX; retaining uploaded drafts.

---

## Scope decisions (from brainstorming)

| Decision | Choice |
|---|---|
| Which upload paths | **PDF only.** DOCX (server-side mammoth) and TXT (tiny, client-extracted) stay on the current synchronous path. |
| Which flows | **Both** standard (Defense Pack) and Express (5-use lifetime cap) — they share `ProjectReviewer.jsx`; same pipeline. |
| Completion signal | **None needed.** The Claude call stays a single synchronous streamed request; it's just triggered *after* upload instead of racing it. No polling/job table. |
| Upload path | **Direct browser → Supabase Storage**, using the existing `supabase.storage.from().upload()` pattern (as avatars do). No signed-URL minting endpoint required. |
| Processing model | **Synchronous streamed Claude call** after upload. Vercel functions freeze on response, so true background work isn't available; but once the upload no longer eats the budget, the server-to-server Claude call fits 60s reliably. |

---

## Architecture

New PDF flow:

1. Client uploads the PDF **directly to Supabase Storage** via `supabase.storage
   .from('project-uploads').upload(path, file)` using the user's session. This transfer
   goes browser → Supabase and never touches our serverless functions, so it is not bound
   by the 60s cap. A slow connection just makes it take longer.
2. Client then calls the existing reviewer streaming endpoint
   (`?action=review&stream=1`) but sends a **`pdf_storage_path`** reference instead of the
   base64 PDF in the body.
3. Server verifies the path is owned by the caller, downloads the object via the
   service-role client (fast, server-to-server), runs the existing magic-byte + 4 MB
   validation on those bytes, re-encodes to the base64 `document` block the Claude call
   already expects, and proceeds **exactly as today** (system prompt, express slot
   reservation, SSE streaming).
4. Server deletes the storage object once processing finishes (success or failure).

Everything downstream of "where do the bytes come from" is unchanged.

### Component boundaries

- **Storage bucket `project-uploads`** — private, RLS-scoped per user. Holds a draft only
  for the duration of its single review.
- **`api/project-reviewer.js`** — gains a `pdf_storage_path` input branch: ownership check
  → service-role download → existing validation → existing Claude/stream path → cleanup.
- **`src/services/api.js`** — `reviewProjectPDFStream` sends a storage path, not base64.
  A new client upload helper wraps `supabase.storage...upload()` with progress events.
- **`src/hooks/useRunLimit.js`** — unchanged from the prerequisite fixes; run is recorded
  only *after* a successful upload (see Credit integrity).
- **`ProjectReviewer.jsx`** — PDF branch of `handleReview()` becomes upload → review;
  two-phase loading UI (upload % then analysis spinner).

---

## Storage bucket & security

**New private bucket `project-uploads`** (migration, following the avatar-bucket RLS
pattern in `supabase/migrations/20260518110004_medium_fix_avatar_bucket_policy.sql`):

- **Private** — no public CDN URLs; these are unpublished student drafts.
- **Path convention:** `{user_id}/{uuid}.pdf`. The user-id prefix is what RLS keys on.
- **RLS policies on `storage.objects`:**
  - `INSERT`: authenticated users may write only into their own `{user_id}/…` prefix.
  - `SELECT` / `DELETE`: owner-only (`owner_id = (auth.uid())::text`). The server uses the
    service-role client (bypasses RLS) for its download + cleanup.
  - No public read policy.

**Abuse / hygiene:**

1. *Free user uploads without entitlement* — entitlement is still enforced server-side at
   the review step (`project-reviewer.js:84`), so the review is rejected and the orphaned
   object is swept. Storage-write is cheap and RLS-bounded to the user's own folder.
2. *Storage accumulation* — each object is deleted right after its review; a safety-net
   sweep removes orphans older than ~1 hour (see Cleanup).

**Validation is unchanged, just re-sourced:** the existing 4 MB cap and `%PDF` magic-byte
check (`project-reviewer.js:140-160`) run against the bytes downloaded from Storage
instead of the request-body base64. The client keeps its existing pre-upload 4 MB guard as
a fast-fail courtesy.

---

## Endpoint & client changes

### `api/project-reviewer.js`

Add a `pdf_storage_path` input. When present (PDF streaming path):

1. Verify `pdf_storage_path` starts with `${user.id}/` — reject 403 otherwise
   (defense-in-depth atop RLS; no download attempted).
2. Download the object via the service-role storage client.
3. Run the existing magic-byte + 4 MB validation on the downloaded bytes.
4. Re-encode to base64 and build the same `{ type:'document', source:{ type:'base64', … } }`
   block the Claude call already expects.

Downstream (system prompt resolution, `reserveRun` express slot, the `?stream=1` SSE loop
at `project-reviewer.js:217+`, the `refundRun()` on Claude error/timeout) is **untouched**.

The base64-in-body path remains for DOCX and TXT — those flows do not change.

### `src/services/api.js`

- New upload helper targeting a `{user_id}/{uuid}.pdf` path in `project-uploads`.
  **Progress caveat:** supabase-js's plain `.upload()` does **not** expose progress
  events. For a real percentage the helper must either (a) use the resumable/TUS upload
  path, or (b) POST directly to the Storage REST endpoint via `XMLHttpRequest` and read
  `upload.onprogress` (authing with the user's access token). Implementation planning
  picks one; the XHR-to-REST approach is the lighter option and still uploads
  browser → Supabase (off our functions). If neither is worth the complexity, the
  fallback is an indeterminate "Uploading…" state (no percentage) — the reliability fix
  does not depend on the percentage, only on the transfer leaving the 60s budget.
- `reviewProjectPDFStream(...)` sends `{ promptType: 'review-with-relevance', pdf_storage_path }`
  instead of embedding the base64 document block. `callClaudeAuthStream` is otherwise
  unchanged.

### `src/features/projectReviewer/ProjectReviewer.jsx`

- PDF branch of `handleReview()`: upload to storage (progress bar) → call
  `reviewProjectPDFStream` with the storage path → existing streamed-result handling and
  the `refundRun` paths already added.
- **Two-phase loading UI:** an "Uploading…" phase (with a real percentage if the progress
  caveat above is resolved, otherwise an indeterminate state) then "Analysing your
  project…" (existing chunk-streaming spinner). A stalled *upload* is now visibly distinct
  from a stalled *analysis* regardless of whether a percentage is shown.
- **Timeouts:** the upload phase gets a generous timeout (a transfer that's slow is
  expected, no 60s pressure); the analysis phase inherits the server's real budget. The
  120s-vs-60s mismatch is removed because the upload no longer races the function clock.

---

## Error handling, cleanup & credit integrity

**Cleanup — the object is deleted in every case:**

- Success: after the review streams back and is saved.
- Any server-side failure (validation reject, entitlement reject, Claude error/timeout):
  before the error response returns.
- Safety net: remove orphans older than ~1 hour. To avoid a 13th cron (we're at the Vercel
  function limit; cron-job.org is already wired), fold an **opportunistic best-effort
  sweep** into the review endpoint — on each invocation, delete stale objects in the
  caller's own folder. Self-cleaning per user, no new infra.
  - *Alternative if preferred later:* a real scheduled sweep added to the existing
    cron-job.org set. Not chosen for v1.

**Credit integrity** (ties directly to the original complaint):

- The Express lifetime-slot reservation (`reserveRun`, server-side) is unchanged, and the
  streaming path already calls `refundRun()` on Claude error/timeout.
- The client-side `project_reviewer` counter refunds (prerequisite fixes) all still apply.
- The run is **recorded only after a successful upload**, not before it. A student whose
  connection dies mid-upload never reaches the "record a run" step; a failed *analysis*
  refunds as already built. Net: no failure path — upload or analysis — burns a run.

**Failure surfacing:** client-detected upload failures flow through the existing
`logFailure()` → `generation_failed` Telegram relay, deduped per user+feature+day, so
slow-network upload failures are finally visible in Telegram/admin.

---

## Testing

**Server-side (vitest, following existing `project-reviewer` test patterns):**

- `pdf_storage_path` owned by the user → downloads, validates, proceeds to the (mocked)
  Claude call.
- **Ownership guard:** a path with another user's prefix → 403, no download attempted.
- Validation against storage bytes: non-PDF magic bytes → 400; over-4 MB object → 400
  (same assertions as today, sourced from a mocked storage download).
- **Cleanup invariant (highest-value test):** object delete is called on the success path,
  the validation-reject path, and the Claude-error path.
- Express reservation unchanged: express-only user reserves a slot; a Claude error triggers
  `refundRun()`.

**Client-side:**

- `useRunLimit` — focused test for `refundRun()`: decrements, never below zero, syncs.
- The existing 558 tests stay green (base64/DOCX/TXT paths untouched).

**Manual verification (not unit-testable):** a real PDF upload end-to-end against a
throttled connection, confirming (a) the upload progress bar advances, (b) analysis
completes, (c) the storage object is gone afterward, (d) a deliberately-killed upload burns
no run. Driven via the `verify` skill / browser once built.

**Explicitly not tested:** Supabase Storage itself (mocked); DOCX/TXT flows beyond
confirming they're unchanged.

---

## Migration & deployment notes

- New migration: create `project-uploads` bucket + RLS policies. Run in Supabase SQL
  editor; verify zero `rowsecurity=false` afterward per the project's RLS discipline.
- No new Vercel serverless function (stays within the 12-function limit) — the reviewer
  endpoint gains a branch; no new endpoint, no new cron.
- No `vercel.json` CSP change: uploads go to `*.supabase.co`, already in `connect-src`.
- No new npm dependencies.
