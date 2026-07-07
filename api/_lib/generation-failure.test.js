// api/_lib/generation-failure.test.js
// Mirrors the mocking style of run-reservation.test.js: stub supabase-admin.js
// so each test programs its own insert() behavior.
import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ insert: null }));

vi.mock('./supabase-admin.js', () => ({
  supabaseAdmin: {
    from: () => ({ insert: (...a) => h.insert(...a) }),
  },
}));

const { logServerGenerationFailure } = await import('./generation-failure.js');

beforeEach(() => {
  h.insert = vi.fn().mockResolvedValue({ error: null });
});

describe('logServerGenerationFailure', () => {
  it('inserts a row with the expected shape', async () => {
    await logServerGenerationFailure({
      userId: 'u1',
      feature: 'chapter_architect',
      errorMessage: 'validation failed (truncated)',
    });
    expect(h.insert).toHaveBeenCalledWith({
      user_id: 'u1',
      feature: 'chapter_architect',
      error_type: 'validation',
      error_message: 'validation failed (truncated)',
    });
  });

  it('falls back to null user_id when none is given', async () => {
    await logServerGenerationFailure({ userId: null, feature: 'topic_validator', errorMessage: 'x' });
    const row = h.insert.mock.calls[0][0];
    expect(row.user_id).toBeNull();
  });

  it('clips an overly long error message to 500 chars', async () => {
    await logServerGenerationFailure({ userId: 'u1', feature: 'x', errorMessage: 'a'.repeat(600) });
    const row = h.insert.mock.calls[0][0];
    expect(row.error_message).toHaveLength(500);
  });

  it('never throws when the insert rejects', async () => {
    h.insert.mockRejectedValue(new Error('db down'));
    await expect(
      logServerGenerationFailure({ userId: 'u1', feature: 'x', errorMessage: 'y' })
    ).resolves.toBeUndefined();
  });
});
