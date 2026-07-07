// src/services/api.test.js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../lib/supabase', () => ({
  supabase: { auth: { getSession: () => Promise.resolve({ data: { session: { access_token: 'tok' } } }) } },
}));
vi.mock('../lib/sentry', () => ({ setTraceId: vi.fn() }));

const { buildChapters, handleApiError } = await import('./api.js');

beforeEach(() => {
  vi.stubGlobal('navigator', { onLine: true });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('callClaude 422 handling', () => {
  it('throws AI_INVALID_RESPONSE with the server message on a 422', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: false,
      status: 422,
      headers: { get: () => null },
      json: async () => ({ error: "This attempt didn't use one of your free generations." }),
    }));

    await expect(buildChapters({}, 'topic', 'linear', 8000, [])).rejects.toMatchObject({
      code: 'AI_INVALID_RESPONSE',
      message: "This attempt didn't use one of your free generations.",
    });
  });
});

describe('handleApiError AI_INVALID_RESPONSE', () => {
  it('shows the invalid_response message', () => {
    const showError = vi.fn();
    const handled = handleApiError({ code: 'AI_INVALID_RESPONSE' }, showError);
    expect(handled).toBe(true);
    expect(showError).toHaveBeenCalledWith(
      "FYPro's AI returned an unusable response. This attempt didn't use one of your free generations — please try again."
    );
  });
});
