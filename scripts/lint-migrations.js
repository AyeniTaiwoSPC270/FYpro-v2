#!/usr/bin/env node
// Fails the build when two files in migrations/ share a four-digit prefix.
// Duplicate numbering makes replay order ambiguous, which breaks the schema-drift
// check in W4 and makes "which migration ran first" unanswerable.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = join(HERE, '..', 'migrations');

/**
 * Groups migration filenames by their four-digit prefix and returns only the
 * prefixes claimed by more than one file.
 * @param {string[]} filenames - bare filenames, e.g. ['0029_a.sql', '0030_b.sql']
 * @returns {Array<{ prefix: string, files: string[] }>} sorted by prefix, files sorted
 */
export function findDuplicatePrefixes(filenames) {
  const byPrefix = new Map();

  for (const name of filenames) {
    const match = /^(\d{4})_/.exec(name);
    if (!match) continue;
    const prefix = match[1];
    if (!byPrefix.has(prefix)) byPrefix.set(prefix, []);
    byPrefix.get(prefix).push(name);
  }

  return [...byPrefix.entries()]
    .filter(([, files]) => files.length > 1)
    .map(([prefix, files]) => ({ prefix, files: [...files].sort() }))
    .sort((a, b) => a.prefix.localeCompare(b.prefix));
}

function main() {
  const filenames = readdirSync(MIGRATIONS_DIR).filter(n => n.endsWith('.sql'));
  const duplicates = findDuplicatePrefixes(filenames);

  if (duplicates.length === 0) {
    console.log(`✓ migrations: ${filenames.length} files, no duplicate prefixes`);
    return;
  }

  console.error('✗ migrations: duplicate numeric prefixes found\n');
  for (const { prefix, files } of duplicates) {
    console.error(`  ${prefix}: ${files.join(', ')}`);
  }
  console.error('\nRenumber the later-created file to the next free number at the end of the sequence.');
  process.exit(1);
}

// Run main() only when invoked directly, not when imported by tests.
if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
