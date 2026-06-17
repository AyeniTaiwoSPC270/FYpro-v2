import { describe, it, expect } from 'vitest';
import { FREE_STEP_LIMITS } from './free-limits.js';

// Locks the canonical free-tier limits. api/ai.js enforces these and
// src/hooks/useRunLimit.js mirrors them for the UI — a single source of truth.
// If a quota changes, update it here (and confirm both consumers still read it).
describe('FREE_STEP_LIMITS', () => {
  it('defines exactly the three server-enforced free steps', () => {
    expect(Object.keys(FREE_STEP_LIMITS).sort()).toEqual([
      'chapter_architect',
      'methodology_advisor',
      'topic_validator',
    ]);
  });

  it('grants 3 free runs per step', () => {
    expect(FREE_STEP_LIMITS.topic_validator).toBe(3);
    expect(FREE_STEP_LIMITS.chapter_architect).toBe(3);
    expect(FREE_STEP_LIMITS.methodology_advisor).toBe(3);
  });

  it('uses snake_case keys matching the run_counts JSON column', () => {
    for (const key of Object.keys(FREE_STEP_LIMITS)) {
      expect(key).toMatch(/^[a-z]+(_[a-z]+)*$/);
    }
  });
});
