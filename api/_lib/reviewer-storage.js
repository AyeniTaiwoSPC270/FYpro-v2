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
