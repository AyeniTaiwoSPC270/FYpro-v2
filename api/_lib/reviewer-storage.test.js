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
