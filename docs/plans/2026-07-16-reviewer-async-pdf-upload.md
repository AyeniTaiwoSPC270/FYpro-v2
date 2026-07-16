# Reviewer Async PDF Upload — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stop Project Reviewer PDF uploads from failing on slow networks by uploading the PDF directly to Supabase Storage (off the 60s-capped serverless function) and passing the endpoint a storage reference instead of a base64 body.

**Architecture:** The browser uploads the PDF to a private `project-uploads` bucket via the user's Supabase session (transfer never touches our functions). It then calls the existing reviewer streaming endpoint with a `pdf_storage_path`. The server verifies ownership, downloads the bytes via the service-role client, runs the existing magic-byte + 4 MB validation, builds the same Claude `document` block, and streams the review exactly as today. The object is deleted after every outcome. Storage handling is isolated in a new, unit-tested `api/_lib/reviewer-storage.js`; the handler just calls it.

**Tech Stack:** Vercel serverless (Node), Supabase Storage + RLS, supabase-js, React (Vite), vitest.

**Spec:** `docs/specs/2026-07-16-reviewer-async-pdf-upload-design.md`

---

## Prerequisite state

Two fixes are already made in the working tree (uncommitted) and are assumed by this plan:

- `api/notify.js` + `src/services/api.js`: `logFailure()` relays to a new `generation_failed` action that fires a deduped Telegram alert.
- `src/hooks/useRunLimit.js`: `refundRun(stepKey)` helper, wired into every non-success exit path of `src/features/projectReviewer/ProjectReviewer.jsx`.

Task 1 commits these onto the branch so later tasks build on a clean base.

## File Structure

- **Create** `migrations/0039_project_uploads_bucket.sql` — bucket + RLS.
- **Create** `api/_lib/reviewer-storage.js` — ownership check, download+validate, delete, sweep. The isolated, testable unit.
- **Create** `api/_lib/reviewer-storage.test.js` — unit tests for the above.
- **Modify** `api/_lib/ai-prompts.js` — add `buildPdfReviewerUserTextBlock(studentContext)` (server-side PDF user-message text, mirroring `buildDocxReviewerUserMessage`).
- **Modify** `api/_lib/ai-prompts.test.js` — cover the new builder.
- **Modify** `api/project-reviewer.js` — accept `pdf_storage_path`, call the storage module, delete after every outcome.
- **Modify** `src/services/api.js` — add `uploadReviewerPdf()`, change `reviewProjectPDFStream()` to send a storage path.
- **Modify** `src/features/projectReviewer/ProjectReviewer.jsx` — PDF branch uploads first, two-phase loading UI.
- **Create** `src/hooks/useRunLimit.refund.test.js` — unit test for `refundRun()`.

---

## Task 1: Commit prerequisite fixes onto the branch

**Files:**
- Modify (already changed, uncommitted): `api/notify.js`, `src/services/api.js`, `src/hooks/useRunLimit.js`, `src/features/projectReviewer/ProjectReviewer.jsx`

- [ ] **Step 1: Confirm typecheck + tests are green**

Run: `npm run typecheck && npm run test`
Expected: tsc clean; `Tests  558 passed (558)`.

- [ ] **Step 2: Commit the two prerequisite fixes as one commit**

```bash
git add api/notify.js src/services/api.js src/hooks/useRunLimit.js src/features/projectReviewer/ProjectReviewer.jsx
git commit -m "fix(reviewer): alert Telegram on client-detected failures and refund runs on failure

logFailure now relays to a new generation_failed notify action (deduped
Telegram alert) so slow-network timeouts/drops are visible. Adds
refundRun() and wires it into every non-success exit path so a failed
review never burns a paid run.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 2: Storage bucket + RLS migration

**Files:**
- Create: `migrations/0039_project_uploads_bucket.sql`

- [ ] **Step 1: Write the migration**

Create `migrations/0039_project_uploads_bucket.sql`:

```sql
-- Migration 0039: project-uploads bucket for async Project Reviewer PDF uploads.
-- The browser uploads a student's draft PDF here directly (off our 60s-capped
-- serverless functions); the reviewer endpoint downloads it via service role,
-- reviews it, then deletes it. Objects are transient — one per review.
--
-- Path convention: {user_id}/{uuid}.pdf  — RLS keys on the user_id prefix.
-- Mirrors the scoped-ownership pattern from the avatar bucket policy
-- (20260518110004_medium_fix_avatar_bucket_policy.sql). Private bucket: no
-- public read policy — these are unpublished drafts.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('project-uploads', 'project-uploads', false, 5242880)
ON CONFLICT (id) DO NOTHING;

-- INSERT: a user may write only into their own {user_id}/... prefix.
CREATE POLICY "Users can upload own reviewer PDFs"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'project-uploads'
    AND (storage.foldername(name))[1] = (auth.uid())::text
  );

-- SELECT: owner only (service role bypasses RLS for the server download).
CREATE POLICY "Users can read own reviewer PDFs"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'project-uploads'
    AND owner_id = (auth.uid())::text
  );

-- DELETE: owner only (server cleanup runs via service role).
CREATE POLICY "Users can delete own reviewer PDFs"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'project-uploads'
    AND owner_id = (auth.uid())::text
  );

-- ── Verification ──────────────────────────────────────────────────────────────
-- SELECT policyname, cmd FROM pg_policies
-- WHERE schemaname='storage' AND tablename='objects'
--   AND policyname LIKE '%reviewer PDFs%';
-- Expected: three rows (INSERT, SELECT, DELETE).
```

- [ ] **Step 2: Apply the migration to the dev/staging Supabase project**

Run it in the Supabase SQL editor (or via the Supabase MCP `apply_migration`).
Expected: no error; the verification query returns the three policies.

- [ ] **Step 3: Confirm RLS discipline still holds**

Run in SQL editor: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;`
Expected: zero rows (unchanged — this migration only touches `storage`).

- [ ] **Step 4: Commit**

```bash
git add migrations/0039_project_uploads_bucket.sql
git commit -m "feat(reviewer): add project-uploads storage bucket + RLS (migration 0039)

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 3: Server-side PDF user-message builder

The storage path means the server must build the PDF user-message text (as it already does for DOCX via `buildDocxReviewerUserMessage`). The system prompt stays `review-with-relevance` (unchanged).

**Files:**
- Modify: `api/_lib/ai-prompts.js` (add export after `buildDocxReviewerUserMessage`, ~line 509)
- Test: `api/_lib/ai-prompts.test.js`

- [ ] **Step 1: Write the failing test**

Add to `api/_lib/ai-prompts.test.js`:

```javascript
import { buildPdfReviewerUserTextBlock } from './ai-prompts.js';

describe('buildPdfReviewerUserTextBlock', () => {
  it('includes the student faculty/department and asks for the review JSON', () => {
    const text = buildPdfReviewerUserTextBlock({
      faculty: 'Science', department: 'Computer Science',
      level: '400', university: 'UNILAG',
    });
    expect(text).toContain('Computer Science');
    expect(text).toContain('examiner_questions');
    expect(text).toContain('Return only the JSON');
  });

  it('tolerates a missing student context object', () => {
    expect(() => buildPdfReviewerUserTextBlock(undefined)).not.toThrow();
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `npx vitest run api/_lib/ai-prompts.test.js -t buildPdfReviewerUserTextBlock`
Expected: FAIL — `buildPdfReviewerUserTextBlock is not a function`.

- [ ] **Step 3: Implement the builder**

In `api/_lib/ai-prompts.js`, immediately after `buildDocxReviewerUserMessage` (after line 509), add. Reuse the existing `buildStudentContextForDocx` helper already in this file for the context header:

```javascript
/**
 * PDF Project Reviewer user-message text block. Pairs with the downloaded PDF
 * document block (attached separately by the handler) and the
 * 'review-with-relevance' system prompt. Server-side mirror of the client's
 * buildProjectReviewerPDFPrompt — used when the PDF arrives via storage
 * reference rather than an inline base64 body.
 * @param {object} studentContext
 * @returns {string}
 */
export function buildPdfReviewerUserTextBlock(studentContext) {
  const student = studentContext || {};
  return `
${buildStudentContextForDocx(student)}

The student has uploaded their project as a PDF document (see the attached document above).

Review the entire PDF content carefully. Every strength, weakness, and examiner question MUST reference specific content, arguments, or claims from the PDF — not generic academic advice.

Return ONLY this exact JSON structure:

{
  "grade": "Distinction | Merit | Pass | Fail",
  "grade_justification": "One sentence explaining the grade — must reference specific aspects of the PDF content",
  "score_estimate": "Numeric estimate e.g. '68% — Merit'",
  "strengths": [
    {"title": "Short name (5 words or fewer)","detail": "What exactly was done well — must reference actual content"},
    {"title": "Short name","detail": "What exactly was done well"},
    {"title": "Short name","detail": "What exactly was done well"}
  ],
  "weaknesses": [
    {"title": "Short name (5 words or fewer)","detail": "What exactly needs improvement — must reference actual content","fix": "One-sentence actionable instruction"},
    {"title": "Short name","detail": "What exactly needs improvement","fix": "One-sentence actionable instruction"},
    {"title": "Short name","detail": "What exactly needs improvement","fix": "One-sentence actionable instruction"}
  ],
  "examiner_questions": [
    {"number": 1,"question": "Specific question from actual PDF content","target": "The specific section or gap"},
    {"number": 2,"question": "...","target": "..."},
    {"number": 3,"question": "...","target": "..."},
    {"number": 4,"question": "...","target": "..."},
    {"number": 5,"question": "...","target": "..."}
  ]
}

Return only the JSON. Nothing else.
`.trim();
}
```

Note: the relevance gate lives in the `review-with-relevance` system prompt, so the text block does not repeat it (unlike the old client prompt).

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run api/_lib/ai-prompts.test.js -t buildPdfReviewerUserTextBlock`
Expected: PASS (both cases).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/ai-prompts.js api/_lib/ai-prompts.test.js
git commit -m "feat(reviewer): server-side PDF reviewer user-message builder

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 4: Storage module — ownership, download, validate, delete, sweep

The isolated, testable unit. Pure logic + an injected storage client (so tests pass a fake).

**Files:**
- Create: `api/_lib/reviewer-storage.js`
- Test: `api/_lib/reviewer-storage.test.js`

- [ ] **Step 1: Write the failing tests**

Create `api/_lib/reviewer-storage.test.js`:

```javascript
import { describe, it, expect, vi } from 'vitest';
import {
  assertOwnedPath,
  loadPdfFromStorage,
  MAX_PDF_BYTES,
} from './reviewer-storage.js';

// A minimal %PDF-prefixed buffer over/under size, as a Blob-like with arrayBuffer().
function pdfBlob(bytes) {
  return { arrayBuffer: async () => bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) };
}
function pdfBytes(size) {
  const b = new Uint8Array(size);
  b.set([0x25, 0x50, 0x44, 0x46], 0); // %PDF
  return b;
}

describe('assertOwnedPath', () => {
  it('accepts a path under the user prefix', () => {
    expect(() => assertOwnedPath('user-1', 'user-1/abc.pdf')).not.toThrow();
  });
  it('rejects a path under another user prefix', () => {
    expect(() => assertOwnedPath('user-1', 'user-2/abc.pdf')).toThrow(/ownership/i);
  });
  it('rejects a traversal / bare path', () => {
    expect(() => assertOwnedPath('user-1', 'abc.pdf')).toThrow(/ownership/i);
  });
});

describe('loadPdfFromStorage', () => {
  const okClient = (blob) => ({
    storage: { from: () => ({ download: vi.fn().mockResolvedValue({ data: blob, error: null }) }) },
  });

  it('returns base64 for a valid owned PDF', async () => {
    const client = okClient(pdfBlob(pdfBytes(1000)));
    const b64 = await loadPdfFromStorage({ storageClient: client, userId: 'u1', storagePath: 'u1/x.pdf' });
    expect(typeof b64).toBe('string');
    expect(Buffer.from(b64, 'base64').slice(0, 4).toString('ascii')).toBe('%PDF');
  });

  it('throws on a non-PDF magic byte', async () => {
    const notPdf = new Uint8Array([0x50, 0x4b, 0x03, 0x04, 0, 0]); // PK.. (zip/docx)
    const client = okClient(pdfBlob(notPdf));
    await expect(loadPdfFromStorage({ storageClient: client, userId: 'u1', storagePath: 'u1/x.pdf' }))
      .rejects.toThrow(/only pdf/i);
  });

  it('throws when the object exceeds the size cap', async () => {
    const client = okClient(pdfBlob(pdfBytes(MAX_PDF_BYTES + 1)));
    await expect(loadPdfFromStorage({ storageClient: client, userId: 'u1', storagePath: 'u1/x.pdf' }))
      .rejects.toThrow(/too large/i);
  });

  it('throws a 403-ish ownership error before downloading a foreign path', async () => {
    const download = vi.fn();
    const client = { storage: { from: () => ({ download }) } };
    await expect(loadPdfFromStorage({ storageClient: client, userId: 'u1', storagePath: 'u2/x.pdf' }))
      .rejects.toThrow(/ownership/i);
    expect(download).not.toHaveBeenCalled();
  });

  it('throws when storage returns an error', async () => {
    const client = { storage: { from: () => ({ download: vi.fn().mockResolvedValue({ data: null, error: { message: 'not found' } }) }) } };
    await expect(loadPdfFromStorage({ storageClient: client, userId: 'u1', storagePath: 'u1/x.pdf' }))
      .rejects.toThrow(/could not read/i);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run api/_lib/reviewer-storage.test.js`
Expected: FAIL — module not found / exports undefined.

- [ ] **Step 3: Implement the module**

Create `api/_lib/reviewer-storage.js`:

```javascript
// Storage helpers for the async Project Reviewer PDF path.
//
// The browser uploads the PDF straight to the private `project-uploads` bucket;
// the handler passes the resulting {user_id}/{uuid}.pdf path here. This module
// is the single place that (a) proves the path belongs to the caller, (b)
// downloads + validates the bytes, (c) deletes the object, and (d) sweeps a
// user's stale orphans. Kept free of handler/Express concerns so it is unit
// testable with a fake storage client.

const BUCKET = 'project-uploads';
export const MAX_PDF_BYTES = 4 * 1024 * 1024; // 4 MB decoded — matches client + old body cap

class OwnershipError extends Error {}
class ValidationError extends Error {}

/**
 * Throw unless `storagePath` is under the caller's `{userId}/` prefix.
 * Defense-in-depth on top of the bucket RLS.
 */
export function assertOwnedPath(userId, storagePath) {
  const prefix = `${userId}/`;
  if (typeof storagePath !== 'string' || !storagePath.startsWith(prefix) || storagePath.includes('..')) {
    const e = new OwnershipError('Storage path failed ownership check.');
    e.code = 'OWNERSHIP';
    throw e;
  }
}

/**
 * Download + validate the owned PDF, returning base64 for the Claude document block.
 * @param {{ storageClient: object, userId: string, storagePath: string }} args
 * @returns {Promise<string>} base64 of the PDF
 * @throws OwnershipError | ValidationError | Error
 */
export async function loadPdfFromStorage({ storageClient, userId, storagePath }) {
  assertOwnedPath(userId, storagePath);

  const { data, error } = await storageClient.storage.from(BUCKET).download(storagePath);
  if (error || !data) {
    const e = new Error('Could not read the uploaded file. Please try again.');
    e.code = 'DOWNLOAD_FAILED';
    throw e;
  }

  const buffer = Buffer.from(await data.arrayBuffer());

  if (buffer.length > MAX_PDF_BYTES) {
    const e = new ValidationError('File too large. Maximum size is 4 MB.');
    e.code = 'TOO_LARGE';
    throw e;
  }
  if (buffer.slice(0, 4).toString('ascii') !== '%PDF') {
    const e = new ValidationError('Invalid file type. Only PDF files are accepted.');
    e.code = 'NOT_PDF';
    throw e;
  }

  return buffer.toString('base64');
}

/**
 * Best-effort delete of a single object. Never throws.
 */
export async function deleteReviewerUpload(storageClient, storagePath) {
  try {
    if (storagePath) await storageClient.storage.from(BUCKET).remove([storagePath]);
  } catch (err) {
    console.error('[reviewer-storage] delete failed:', err?.message);
  }
}

/**
 * Opportunistic sweep: remove objects in the caller's own folder older than
 * ~1 hour. Runs best-effort on each review invocation so a user's orphaned
 * uploads self-clean without a dedicated cron. Never throws.
 */
export async function sweepStaleUploads(storageClient, userId, maxAgeMs = 3600_000) {
  try {
    const { data, error } = await storageClient.storage.from(BUCKET).list(userId, { limit: 100 });
    if (error || !Array.isArray(data)) return;
    const cutoff = Date.now() - maxAgeMs;
    const stale = data
      .filter(o => o?.created_at && new Date(o.created_at).getTime() < cutoff)
      .map(o => `${userId}/${o.name}`);
    if (stale.length) await storageClient.storage.from(BUCKET).remove(stale);
  } catch (err) {
    console.error('[reviewer-storage] sweep failed:', err?.message);
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run api/_lib/reviewer-storage.test.js`
Expected: PASS (all cases, including that the foreign-path case never calls download).

- [ ] **Step 5: Commit**

```bash
git add api/_lib/reviewer-storage.js api/_lib/reviewer-storage.test.js
git commit -m "feat(reviewer): storage module for owned PDF download/validate/cleanup

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 5: Wire the storage path into the reviewer endpoint

**Files:**
- Modify: `api/project-reviewer.js`

- [ ] **Step 1: Import the storage helpers + PDF text builder**

At the top of `api/project-reviewer.js`, extend the existing imports:

```javascript
import { getReviewerSystemPrompt, buildDocxReviewerUserMessage, buildPdfReviewerUserTextBlock } from './_lib/ai-prompts.js';
import { loadPdfFromStorage, deleteReviewerUpload, sweepStaleUploads } from './_lib/reviewer-storage.js';
```

- [ ] **Step 2: Destructure the new field**

In the request-body destructure (currently `project-reviewer.js:111-119`), add `pdf_storage_path`:

```javascript
    const {
      promptType,
      previousSteps,
      messages: clientMessages,
      max_tokens: rawMaxTokens = 2000,
      model: rawModel = 'claude-sonnet-4-6',
      docx_base64,
      student_context,
      pdf_storage_path,
    } = req.body || {};
```

- [ ] **Step 3: Declare `uploadedPath` in the handler's outer scope**

So the outer `catch` (Step 5) can clean up, declare it alongside `refundRun`/`reservedCount` at `project-reviewer.js:107-108`, just before the inner `try {` at line 110:

```javascript
  let refundRun = () => {};
  let reservedCount = null;
  let uploadedPath = null;   // set if this request used the PDF-via-storage path

  try {
```

- [ ] **Step 4: Build messages from storage when a path is supplied**

Immediately AFTER the DOCX block (after `project-reviewer.js:193`, the line setting `messages = [{ role: 'user', content: buildDocxReviewerUserMessage(...) }]`) and BEFORE the express reservation block (`if (expressOnly && ...`), insert:

```javascript
    // PDF-via-storage path: the browser uploaded the PDF directly to the
    // project-uploads bucket (off this 60s-capped function) and sent only a
    // reference. Download + validate here, then build the same document block
    // the inline-base64 path used. Cleanup is scheduled for every exit below.
    if (pdf_storage_path) {
      if (typeof pdf_storage_path !== 'string' || !pdf_storage_path) {
        return res.status(400).json({ error: 'Invalid upload reference.' });
      }
      uploadedPath = pdf_storage_path;
      // Opportunistic orphan cleanup for this user — best-effort, never blocks.
      sweepStaleUploads(supabaseAdmin, user.id).catch(() => {});
      let pdfBase64;
      try {
        pdfBase64 = await loadPdfFromStorage({ storageClient: supabaseAdmin, userId: user.id, storagePath: pdf_storage_path });
      } catch (err) {
        await deleteReviewerUpload(supabaseAdmin, uploadedPath);
        const status = err.code === 'OWNERSHIP' ? 403
          : err.code === 'DOWNLOAD_FAILED' ? 502 : 400;
        return res.status(status).json({ error: err.code === 'OWNERSHIP'
          ? 'You do not have access to that upload.'
          : err.message });
      }
      messages = [{
        role: 'user',
        content: [
          { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: pdfBase64 } },
          { type: 'text', text: buildPdfReviewerUserTextBlock(student_context) },
        ],
      }];
    }
```

- [ ] **Step 5: Delete the object on the streaming success + every streaming failure**

The streaming block spans `project-reviewer.js:220-364`. Add `await deleteReviewerUpload(supabaseAdmin, uploadedPath);` (guarded — it no-ops when `uploadedPath` is null, i.e. DOCX/TXT/base64) at each terminal point in the streaming path:

- In the `catch (err)` after the Anthropic fetch (currently line 240-247): before `res.end()`.
- In the `!anthropicRes.ok` block (line 249-264): before `res.end()`.
- In the SSE read `catch` (line 298-308): before `return`.
- In the `stopReason === 'max_tokens'` block (line 315-320): before `res.end()`.
- In the JSON-parse `catch` (line 327-332): before `res.end()`.
- Just before the final `send({ type: 'done', result: parsed }); res.end();` (line 361-362).

Each insertion is literally:

```javascript
      await deleteReviewerUpload(supabaseAdmin, uploadedPath);
```

- [ ] **Step 6: Delete the object on the non-streaming + outer-catch paths**

The non-streaming path and error tail span `project-reviewer.js:367-474`. Add the same `await deleteReviewerUpload(supabaseAdmin, uploadedPath);` line (`uploadedPath` is already in scope from Step 3):

- Before `return res.status(200).json(data);` (line 434).
- Before the `return res.status(status).json({ error: userMsg });` in the non-ok Anthropic block (line 449).
- At the top of the outer `catch (err)` block (line 450), as the first statement after `refundRun();` — guarded so it also runs when headers were already sent:

```javascript
  } catch (err) {
    refundRun(); // request never produced a result — don't charge the run
    await deleteReviewerUpload(supabaseAdmin, uploadedPath); // no-op for non-storage paths
```

- [ ] **Step 7: Typecheck + full test suite**

Run: `npm run typecheck && npm run test`
Expected: tsc clean; all existing tests still pass (base64/DOCX/TXT untouched).

- [ ] **Step 8: Commit**

```bash
git add api/project-reviewer.js
git commit -m "feat(reviewer): accept pdf_storage_path, download from storage, clean up

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 6: Client upload helper + storage-path stream call

**Files:**
- Modify: `src/services/api.js`

- [ ] **Step 1: Add the upload helper**

In `src/services/api.js`, near the other reviewer helpers (before `reviewProjectPDFStream`, ~line 565), add. This uses a direct `XMLHttpRequest` PUT to the Storage REST endpoint so we get real `upload.onprogress` (plain `supabase.storage.upload()` exposes none). It authenticates with the user's access token and still uploads browser → Supabase, off our functions:

```javascript
// Uploads a PDF straight to the private project-uploads bucket and returns its
// storage path. Uses XHR (not supabase.storage.upload) so onProgress reports a
// real percentage. The transfer goes browser → Supabase, so it is not bound by
// our 60s serverless budget — the fix for slow-network review failures.
export async function uploadReviewerPdf(file, onProgress) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) { const e = new Error('Session expired'); e.code = 'UNAUTHORIZED'; throw e; }

  const userId = session.user.id;
  const path   = `${userId}/${crypto.randomUUID()}.pdf`;
  const base   = import.meta.env.VITE_SUPABASE_URL;
  const url     = `${base}/storage/v1/object/project-uploads/${path}`;

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('POST', url);
    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    xhr.setRequestHeader('x-upsert', 'false');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else { const e = new Error(`Upload failed (${xhr.status})`); e.code = 'UPLOAD_FAILED'; reject(e); }
    };
    xhr.onerror = () => { const e = new Error('Upload failed. Check your connection and try again.'); e.code = 'UPLOAD_FAILED'; reject(e); };
    xhr.ontimeout = () => { const e = new Error('Upload timed out. Try a smaller file or a faster connection.'); e.code = 'UPLOAD_TIMEOUT'; reject(e); };
    xhr.timeout = 180000; // generous — this is only the transfer, no 60s pressure
    xhr.send(file);
  });

  return path;
}
```

- [ ] **Step 2: Change `reviewProjectPDFStream` to send the storage path**

Replace the existing `reviewProjectPDFStream` (`src/services/api.js:565-576`) with a version that takes a storage path and student context, and sends no base64 body:

```javascript
export async function reviewProjectPDFStream(studentCtx, pdfStoragePath, previousSteps = {}, onChunk) {
  return callClaudeAuthStream(
    REVIEWER_ENDPOINT + '?stream=1',
    [],
    3000,
    { promptType: 'review-with-relevance', previousSteps, pdf_storage_path: pdfStoragePath, student_context: studentCtx },
    onChunk
  );
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: tsc clean. (Callers updated in Task 7; if tsc flags the changed signature in `.jsx` it won't — JS. Proceed.)

- [ ] **Step 4: Commit**

```bash
git add src/services/api.js
git commit -m "feat(reviewer): direct-to-storage PDF upload helper + storage-path stream call

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 7: ProjectReviewer PDF branch + two-phase loading UI

**Files:**
- Modify: `src/features/projectReviewer/ProjectReviewer.jsx`

- [ ] **Step 1: Import the upload helper**

Extend the api import at `ProjectReviewer.jsx:2`:

```javascript
import { reviewProjectStream, reviewProjectDOCXStream, reviewProjectPDFStream, uploadReviewerPdf, checkDocumentRelevance, handleApiError, logFailure } from '../../services/api'
```

- [ ] **Step 2: Add upload-phase state**

Near the other `useState` declarations (after `chunkCount`, ~`ProjectReviewer.jsx:139`):

```javascript
  const [uploadPct, setUploadPct] = useState(null) // null = not uploading; 0-100 = uploading
```

- [ ] **Step 3: Upload the PDF before the review call**

In `handleReview`, the extraction currently produces `result.pdf` (base64) via `extractTextFromFile`. For PDFs we no longer need base64 in the body — we upload the raw file and pass a path. Replace the review-call block (`ProjectReviewer.jsx:344-358`, the `try { const validatedTopic... const data = result.pdf ? reviewProjectPDFStream(... result.pdf ...) : ...`) so the PDF branch uploads first:

```javascript
    try {
      const validatedTopic = state.validatedTopic || state.roughTopic
      const previousSteps = {
        validatedTopic:    state.validatedTopic,
        chapterStructure:  state.chapterStructure,
        chosenMethodology: state.chosenMethodology,
        methodology:       state.methodology,
        writingPlan:       state.writingPlan,
      }
      const onChunk = (n) => setChunkCount(n)

      let data
      if (result.pdf !== undefined || (selectedFile?.name || '').toLowerCase().endsWith('.pdf')) {
        // Upload the raw PDF straight to storage (off the 60s function budget),
        // then review by reference. Two-phase UI: upload % then analysis spinner.
        setUploadPct(0)
        const storagePath = await uploadReviewerPdf(selectedFile, (pct) => setUploadPct(pct))
        setUploadPct(null)
        data = await reviewProjectPDFStream(studentContext, storagePath, previousSteps, onChunk)
      } else if (result.docx) {
        data = await reviewProjectDOCXStream(studentContext, result.docx, previousSteps, onChunk)
      } else {
        data = await reviewProjectStream(studentContext, validatedTopic, result.text, previousSteps, onChunk)
      }
```

Note: for the PDF branch we now upload `selectedFile` directly, so `extractTextFromFile`'s PDF base64 (`result.pdf`) is unused for the body — but leaving `extractPDF` in place is harmless (it validates the file is readable). Keep it; do not remove.

- [ ] **Step 4: Reset upload state on the failure paths**

In the `catch (err)` of `handleReview` (`ProjectReviewer.jsx:410`, after the Task 1 changes), add `setUploadPct(null)` so a failed upload clears the progress UI. The existing `refundRun('project_reviewer')` + `logFailure` there already cover credit + alerting:

```javascript
    } catch (err) {
      inflightRef.current = false
      setUploadPct(null)
      if (!timedOutRef.current) {
        logFailure('Project Reviewer', err, processingFileNameRef.current)
        refundRun('project_reviewer')
      }
      if (timedOutRef.current) return
      setIsProcessing(false)
      setSection('input')
      handleApiError(err, msg => setError(msg || 'Something went wrong during the review. Please try again.'))
    }
```

- [ ] **Step 5: Show the upload phase in the loading UI**

The loading render is at `ProjectReviewer.jsx:645-685`. When `uploadPct !== null` we're in the upload phase — show a progress bar instead of the analysis skeleton. Insert this block immediately AFTER the opening `<div id="pr-loading-section" …>` (line 646) and BEFORE the amber `⏱` notice `<div>` (line 647), and gate the existing analysis content so it only shows once upload is done:

Insert right after line 646:

```jsx
          {uploadPct !== null ? (
            <div className="pr-upload-progress">
              <p className="pr-upload-progress__label" style={{
                fontFamily: "'Poppins', sans-serif", fontSize: '0.9rem',
                color: 'var(--color-text-primary)', marginBottom: 10, textAlign: 'center',
              }}>
                Uploading your project… {uploadPct}%
              </p>
              <div className="pr-upload-bar" style={{
                height: 8, borderRadius: 999, background: 'var(--color-border)', overflow: 'hidden',
              }}>
                <div className="pr-upload-bar__fill" style={{
                  width: `${uploadPct}%`, height: '100%',
                  background: 'var(--color-blue-primary)', transition: 'width 0.2s ease',
                }} />
              </div>
              <p style={{
                fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem',
                color: 'var(--color-text-muted)', marginTop: 10, textAlign: 'center',
              }}>
                Large files take longer on a slow connection — this won't time out.
              </p>
            </div>
          ) : (
```

Then, immediately BEFORE the closing `</div>` of `pr-loading-section` (line 684), close the ternary's else branch. The existing children (the amber notice, `skeleton-loader`, `LoadingMessages`, chunk count) become the `: ( … )` branch. So the final structure is:

```jsx
      {section === 'loading' && hasSubmitted && (
        <div id="pr-loading-section" className="pr-loading-section tv-section--visible">
          {uploadPct !== null ? (
            /* upload-progress block from above */
          ) : (
            <>
              {/* existing amber notice + skeleton-loader + LoadingMessages + chunkCount — unchanged */}
            </>
          )}
        </div>
      )}
```

Wrap the existing analysis children in a `<>…</>` fragment inside the else branch. Styles are inline (matching this file's existing inline-style convention), so no CSS-file change is needed.

- [ ] **Step 6: Typecheck + full test suite**

Run: `npm run typecheck && npm run test`
Expected: tsc clean; `Tests  558 passed` (plus any new ones from Tasks 3/4/8).

- [ ] **Step 7: Commit**

```bash
git add src/features/projectReviewer/ProjectReviewer.jsx
git commit -m "feat(reviewer): upload PDF to storage before review; two-phase loading UI

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 8: Unit test for `refundRun`

`refundRun` (shipped in Task 1) is untested. The module has top-level React/supabase side effects and uses `localStorage` + `window` at call time; the test env is `node`, so stub those globals.

**Files:**
- Create: `src/hooks/useRunLimit.refund.test.js`

- [ ] **Step 1: Write the failing test**

Create `src/hooks/useRunLimit.refund.test.js`:

```javascript
// refundRun reverses a previously-recorded run. It must decrement, never go
// below zero, and persist to localStorage. Sync-to-Supabase is stubbed.

import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub the module's import-time side effects + call-time globals.
vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: {
      onAuthStateChange: () => ({ data: { subscription: {} } }),
      getSession: () => Promise.resolve({ data: { session: null } }),
    },
  },
}));
vi.mock('../lib/entitlements-cache', () => ({
  getCachedEntitlements: vi.fn().mockResolvedValue(null),
  invalidateCachedEntitlements: vi.fn(),
}));

const store = {};
beforeEach(() => {
  for (const k of Object.keys(store)) delete store[k];
  globalThis.localStorage = {
    getItem: (k) => (k in store ? store[k] : null),
    setItem: (k, v) => { store[k] = String(v); },
    removeItem: (k) => { delete store[k]; },
  };
  globalThis.window = { dispatchEvent: () => {}, addEventListener: () => {}, removeEventListener: () => {} };
});

const { refundRun } = await import('./useRunLimit');

describe('refundRun', () => {
  it('decrements the stored count for the step', () => {
    store['fypro_run_counts'] = JSON.stringify({ project_reviewer: 2 });
    refundRun('project_reviewer');
    expect(JSON.parse(store['fypro_run_counts']).project_reviewer).toBe(1);
  });

  it('never goes below zero', () => {
    store['fypro_run_counts'] = JSON.stringify({ project_reviewer: 0 });
    refundRun('project_reviewer');
    expect(JSON.parse(store['fypro_run_counts']).project_reviewer).toBe(0);
  });

  it('is a no-op when the step has no recorded runs', () => {
    store['fypro_run_counts'] = JSON.stringify({});
    refundRun('project_reviewer');
    const counts = JSON.parse(store['fypro_run_counts']);
    expect(counts.project_reviewer ?? 0).toBe(0);
  });
});
```

- [ ] **Step 2: Run to verify it fails, then passes**

Run: `npx vitest run src/hooks/useRunLimit.refund.test.js`
Expected: PASS (if `refundRun` from Task 1 is correct). If it FAILs on below-zero, fix `refundRun` in `src/hooks/useRunLimit.js` to guard `current <= 0`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRunLimit.refund.test.js
git commit -m "test(reviewer): cover refundRun decrement + floor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Task 9: Full verification

**Files:** none (verification only)

- [ ] **Step 1: Typecheck + full suite**

Run: `npm run typecheck && npm run test`
Expected: tsc clean; all tests pass (558 + new).

- [ ] **Step 2: Manual end-to-end via the `verify` skill / browser**

Drive a real PDF review (Defense Pack or Express user) against a throttled connection (Chrome DevTools → Network → Slow 3G):
- The "Uploading… X%" phase advances and does **not** time out at 60s.
- The "Analysing…" phase then streams and completes.
- Confirm in Supabase Storage that the `project-uploads/{user_id}/…` object is **gone** after completion.
- Deliberately kill the upload mid-transfer (offline toggle): the run count does **not** decrease permanently (no run burned), a Telegram `🔴 Generation failed (client-detected)` alert fires, and the object is swept within the hour.

- [ ] **Step 3: RLS re-verification**

Supabase SQL editor: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;`
Expected: zero rows.

---

## Notes for the implementer

- **Credit integrity — how it actually works here.** `handleReview` calls
  `checkAndRecord('project_reviewer', features)` at the very start (before extraction and
  before upload), which both *enforces the limit* and *records the run*. We deliberately
  keep the check there so an over-limit user is rejected before wasting an upload. Integrity
  on failure comes from `refundRun('project_reviewer')` on every non-success exit
  (Task 1) — including the upload-failure catch (Task 7 Step 4). Net effect matches the
  spec's intent ("no failure burns a run"); the mechanism is refund-on-failure, not
  deferring the record until after upload. Do not move `checkAndRecord` later — it would
  let an over-limit user upload first and be rejected second.
- **CSP:** no change — uploads target `*.supabase.co`, already in `connect-src`.
- **Vercel function count:** unchanged (12) — no new endpoint, no new cron.
- **DOCX/TXT untouched:** only the PDF streaming call moved to a storage reference. Do not alter `reviewProjectStream` / `reviewProjectDOCXStream` or their server branches.
- **Bucket must exist before deploy:** Task 2's migration runs in Supabase first, or uploads 404.
