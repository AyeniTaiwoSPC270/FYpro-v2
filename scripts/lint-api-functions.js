#!/usr/bin/env node
// Guards the Vercel Hobby 12-serverless-function ceiling.
// api/ is at exactly 12; a 13th entrypoint fails the deploy, so catch it in CI.
// Underscore-prefixed directories (api/_lib, api/_emails) are shared modules,
// not routes, and are never counted — only top-level files in api/.

import { readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const API_DIR = join(HERE, '..', 'api');

export const MAX_FUNCTIONS = 12;

/**
 * Filters a list of bare filenames down to Vercel serverless entrypoints.
 * @param {string[]} filenames - bare filenames from the top level of api/
 * @returns {string[]} sorted entrypoint filenames
 */
export function countApiEntrypoints(filenames) {
  return filenames
    .filter(name => /\.(js|ts|mjs|cjs)$/.test(name))
    .filter(name => !name.includes('.test.'))
    .sort();
}

function main() {
  const topLevel = readdirSync(API_DIR).filter(name =>
    statSync(join(API_DIR, name)).isFile()
  );
  const entrypoints = countApiEntrypoints(topLevel);

  if (entrypoints.length <= MAX_FUNCTIONS) {
    console.log(`✓ api: ${entrypoints.length}/${MAX_FUNCTIONS} serverless functions`);
    return;
  }

  console.error(
    `✗ api: ${entrypoints.length} serverless functions exceeds the Vercel Hobby limit of ${MAX_FUNCTIONS}\n`
  );
  for (const name of entrypoints) console.error(`  ${name}`);
  console.error('\nMerge an existing endpoint before adding a new one (see CLAUDE.md section 12).');
  process.exit(1);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main();
}
