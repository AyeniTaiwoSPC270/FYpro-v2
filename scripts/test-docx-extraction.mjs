// Run with: node scripts/test-docx-extraction.mjs path/to/your/file.docx
// Tests the exact ZIP parsing logic used in ProjectReviewer.jsx.

import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

const filePath = process.argv[2];
if (!filePath) {
  console.error('Usage: node scripts/test-docx-extraction.mjs path/to/file.docx');
  process.exit(1);
}

const fileBuffer = readFileSync(filePath);
const buffer = fileBuffer.buffer.slice(
  fileBuffer.byteOffset,
  fileBuffer.byteOffset + fileBuffer.byteLength
);

async function extractDocumentXmlFromZip(buffer) {
  const bytes = new Uint8Array(buffer);
  const view  = new DataView(buffer);

  // Find EOCD signature PK\x05\x06 = 0x06054b50 (LE), scanning backwards.
  let eocdOffset = -1;
  const searchStart = Math.max(0, bytes.length - 22 - 65535);
  for (let i = bytes.length - 22; i >= searchStart; i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocdOffset = i; break; }
  }
  if (eocdOffset === -1) { console.error('[test] EOCD not found — not a valid ZIP'); return null; }
  console.log('[test] EOCD at offset', eocdOffset);

  const cdOffset = view.getUint32(eocdOffset + 16, true);
  if (cdOffset === 0xFFFFFFFF) { console.error('[test] Zip64 not supported'); return null; }
  console.log('[test] Central Directory at offset', cdOffset);

  // Walk Central Directory entries PK\x01\x02 = 0x02014b50 (LE).
  let pos = cdOffset;
  const entries = [];
  while (pos + 46 <= bytes.length) {
    if (view.getUint32(pos, true) !== 0x02014b50) break;

    const compression = view.getUint16(pos + 10, true);
    const cmpSize     = view.getUint32(pos + 20, true);
    const uncmpSize   = view.getUint32(pos + 24, true);
    const fileNameLen = view.getUint16(pos + 28, true);
    const extraLen    = view.getUint16(pos + 30, true);
    const commentLen  = view.getUint16(pos + 32, true);
    const lhOffset    = view.getUint32(pos + 42, true);
    const fileName    = new TextDecoder().decode(bytes.slice(pos + 46, pos + 46 + fileNameLen));

    entries.push({ fileName, compression, cmpSize, uncmpSize, lhOffset });

    if (fileName === 'word/document.xml') {
      console.log('[test] Found word/document.xml in CD:', { compression, cmpSize, uncmpSize, lhOffset });

      if (lhOffset + 30 > bytes.length) { console.error('[test] lhOffset out of bounds'); return null; }
      if (view.getUint32(lhOffset, true) !== 0x04034b50) { console.error('[test] Local header signature mismatch at', lhOffset); return null; }

      const lhFileNameLen = view.getUint16(lhOffset + 26, true);
      const lhExtraLen    = view.getUint16(lhOffset + 28, true);
      const dataStart     = lhOffset + 30 + lhFileNameLen + lhExtraLen;

      console.log('[test] Local header extra len:', lhExtraLen, '— data starts at', dataStart);

      const data = bytes.slice(dataStart, dataStart + cmpSize);
      console.log('[test] Compressed data length:', data.length, '(expected', cmpSize, ')');

      if (compression === 0) {
        return new TextDecoder('utf-8', { fatal: false }).decode(data);
      }

      if (compression === 8) {
        // Node 18+ has native DecompressionStream; fall back to zlib if not.
        if (typeof DecompressionStream !== 'undefined') {
          const ds     = new DecompressionStream('deflate-raw');
          const writer = ds.writable.getWriter();
          writer.write(data);
          writer.close();
          const chunks = [];
          const rdr = ds.readable.getReader();
          for (;;) { const { done, value } = await rdr.read(); if (done) break; chunks.push(value); }
          const total = chunks.reduce((s, c) => s + c.length, 0);
          const out   = new Uint8Array(total);
          let p = 0;
          for (const c of chunks) { out.set(c, p); p += c.length; }
          return new TextDecoder('utf-8', { fatal: false }).decode(out);
        } else {
          // Node zlib fallback for older runtimes
          const { inflateRawSync } = await import('node:zlib');
          const decompressed = inflateRawSync(Buffer.from(data));
          return decompressed.toString('utf-8');
        }
      }

      console.error('[test] Unsupported compression method:', compression);
      return null;
    }

    pos += 46 + fileNameLen + extraLen + commentLen;
  }

  console.log('[test] Central Directory entries found:', entries.map(e => e.fileName));
  console.error('[test] word/document.xml not found in Central Directory');
  return null;
}

async function main() {
  console.log(`\nTesting DOCX extraction on: ${filePath}`);
  console.log(`File size: ${buffer.byteLength} bytes\n`);

  // Check magic bytes
  const view = new DataView(buffer);
  const sig = view.getUint32(0, true);
  console.log(`ZIP signature: 0x${sig.toString(16).toUpperCase()} (expected 0x04034B50 for PK\\x03\\x04)\n`);

  const xmlText = await extractDocumentXmlFromZip(buffer);

  if (!xmlText) {
    console.error('\n[FAIL] extractDocumentXmlFromZip returned null');
    process.exit(1);
  }

  console.log('\n[OK] XML extracted, length:', xmlText.length, 'chars');
  console.log('[sample]', xmlText.slice(0, 200), '...\n');

  // Extract w:t text runs
  const wTMatches = xmlText.match(/<w:t[^>]*>[^<]*<\/w:t>/g) || [];
  const extracted = wTMatches
    .map(m => { const inner = m.match(/<w:t[^>]*>([^<]*)<\/w:t>/); return inner ? inner[1] : ''; })
    .filter(s => s.trim().length > 0)
    .join(' ');

  if (extracted.length >= 100) {
    console.log('[OK] w:t extraction succeeded, extracted text length:', extracted.length);
    console.log('[sample]', extracted.slice(0, 300));
  } else {
    console.warn('[WARN] w:t extraction too short (' + extracted.length + ' chars), trying XML strip...');
    const stripped = xmlText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
    if (stripped.length >= 100) {
      console.log('[OK] XML strip fallback succeeded, length:', stripped.length);
      console.log('[sample]', stripped.slice(0, 300));
    } else {
      console.error('[FAIL] Could not extract readable text from this docx');
      process.exit(1);
    }
  }
}

main().catch(err => { console.error('[FATAL]', err); process.exit(1); });
