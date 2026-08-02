#!/usr/bin/env node
// Guards the Vercel Hobby 12-serverless-function ceiling.
// api/ is at exactly 12; a 13th entrypoint fails the deploy, so catch it in CI.
// Underscore-prefixed directories (api/_lib, api/_emails) are shared modules,
// not routes, and are never counted — but Vercel's zero-config detection turns
// ANY other file under api/ into a function, at any depth (api/v2/thing.js
// becomes /api/v2/thing), so the walk must recurse, not just read the top level.

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const API_DIR = join(HERE, '..', 'api');

export const MAX_FUNCTIONS = 12;

/**
 * Recursively lists paths (relative to `dir`, '/'-joined) under `dir`,
 * skipping underscore-prefixed directories/files the same way Vercel's
 * zero-config API detection does.
 * @param {string} dir - absolute path to walk
 * @param {string} [prefix] - internal: relative-path prefix for recursion
 * @returns {string[]} relative file paths, e.g. ["ai.js", "v2/thing.js"]
 */
export function collectApiPaths(dir, prefix = '') {
  return readdirSync(dir, { withFileTypes: true })
    .filter(entry => !entry.name.startsWith('_'))
    .flatMap(entry => {
      const relPath = `${prefix}${entry.name}`;
      return entry.isDirectory()
        ? collectApiPaths(join(dir, entry.name), `${relPath}/`)
        : [relPath];
    });
}

/**
 * Filters a list of relative file paths down to Vercel serverless entrypoints.
 * @param {string[]} filenames - relative paths under api/ (any depth)
 * @returns {string[]} sorted entrypoint paths
 */
export function countApiEntrypoints(filenames) {
  return filenames
    .filter(name => /\.(js|ts|mjs|cjs)$/.test(name))
    .filter(name => !name.includes('.test.'))
    .sort();
}

function main() {
  const allPaths = collectApiPaths(API_DIR);
  const entrypoints = countApiEntrypoints(allPaths);

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
