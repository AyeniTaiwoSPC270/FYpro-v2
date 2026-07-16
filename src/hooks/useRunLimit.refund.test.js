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
