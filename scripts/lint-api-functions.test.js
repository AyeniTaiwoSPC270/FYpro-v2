import { describe, it, expect } from 'vitest';
import { countApiEntrypoints, MAX_FUNCTIONS } from './lint-api-functions.js';

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
