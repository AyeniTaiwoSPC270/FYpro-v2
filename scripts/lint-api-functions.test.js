import { describe, it, expect, afterEach } from 'vitest';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { countApiEntrypoints, collectApiPaths, MAX_FUNCTIONS } from './lint-api-functions.js';

describe('countApiEntrypoints', () => {
  it('counts .js and .ts files as entrypoints', () => {
    expect(countApiEntrypoints(['ai.js', 'send-nurture-email.ts'])).toEqual([
      'ai.js',
      'send-nurture-email.ts',
    ]);
  });

  it('excludes test files', () => {
    expect(countApiEntrypoints(['payments.js', 'payments.test.js', 'auth.test.js'])).toEqual([
      'payments.js',
    ]);
  });

  it('excludes non-JS/TS files', () => {
    expect(countApiEntrypoints(['ai.js', 'README.md', 'schema.sql'])).toEqual(['ai.js']);
  });

  it('returns results sorted', () => {
    expect(countApiEntrypoints(['speak.js', 'admin.js', 'notify.js'])).toEqual([
      'admin.js',
      'notify.js',
      'speak.js',
    ]);
  });

  it('exposes the Vercel Hobby ceiling as 12', () => {
    expect(MAX_FUNCTIONS).toBe(12);
  });

  it('counts .mjs and .cjs files as entrypoints, while still excluding their test files', () => {
    expect(countApiEntrypoints(['newthing.mjs', 'legacy.cjs', 'newthing.test.mjs'])).toEqual([
      'legacy.cjs',
      'newthing.mjs',
    ]);
  });
});

describe('collectApiPaths', () => {
  let dir;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  it('recurses into nested directories, matching Vercel counting a nested file as a function', () => {
    dir = mkdtempSync(join(tmpdir(), 'api-paths-'));
    writeFileSync(join(dir, 'ai.js'), '');
    mkdirSync(join(dir, 'v2'));
    writeFileSync(join(dir, 'v2', 'thing.js'), '');

    expect(countApiEntrypoints(collectApiPaths(dir)).sort()).toEqual(['ai.js', 'v2/thing.js']);
  });

  it('skips underscore-prefixed directories entirely, at any depth', () => {
    dir = mkdtempSync(join(tmpdir(), 'api-paths-'));
    writeFileSync(join(dir, 'ai.js'), '');
    mkdirSync(join(dir, '_lib'));
    writeFileSync(join(dir, '_lib', 'helper.js'), '');
    mkdirSync(join(dir, 'v2', '_internal'), { recursive: true });
    writeFileSync(join(dir, 'v2', '_internal', 'nested.js'), '');

    expect(countApiEntrypoints(collectApiPaths(dir))).toEqual(['ai.js']);
  });

  it('still excludes nested test files', () => {
    dir = mkdtempSync(join(tmpdir(), 'api-paths-'));
    mkdirSync(join(dir, 'v2'));
    writeFileSync(join(dir, 'v2', 'thing.js'), '');
    writeFileSync(join(dir, 'v2', 'thing.test.js'), '');

    expect(countApiEntrypoints(collectApiPaths(dir))).toEqual(['v2/thing.js']);
  });
});
