// Tests for handleFinalizeDefense in api/ai.js — the server-authoritative
// defense score path.
//
// Integrity guarantees under test (migration 0037 + this handler):
//   • total_score is computed ONLY from server-written defense_turns.scores —
//     never from the request body.
//   • ownership is enforced (eq user_id) on both the session and turns reads.
//   • it is idempotent: a completed session returns its stored score without
//     recomputing or re-writing.
//
// ai.js has a heavy import graph (Redis/Supabase/Anthropic clients), so every
// side-effecting _lib module is mocked; only supabase-admin + rate-limit carry
// behaviour for this path.

import { describe, it, expect, beforeEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ getUser: null, rateLimit: null, config: {} }));

vi.mock('./_lib/supabase-admin.js', () => ({
  supabaseAdmin: {
    auth: { getUser: (...a) => h.getUser(...a) },
    from: (table) => tableBuilder(h.config[table] || {}),
  },
}));
vi.mock('./_lib/rate-limit.js', () => ({
  rateLimitCheck: (...a) => h.rateLimit(...a),
  extractUserId: () => 'anon',
  redis: { set: vi.fn(), incr: vi.fn(), decr: vi.fn() },
  freeRunKey: () => 'k',
}));
vi.mock('./_lib/usage-tracker.js', () => ({
  checkDailyCap: vi.fn().mockResolvedValue({ allowed: true, spent: 0, cap: 10 }),
  trackUsage: vi.fn(), trackUserUsage: vi.fn(),
  checkUserCap: vi.fn().mockResolvedValue({ allowed: true, spent: 0, cap: 10 }),
}));
vi.mock('./_lib/cache.js', () => ({
  getCached: vi.fn().mockResolvedValue(null), setCached: vi.fn(), buildCacheKey: () => 'k',
}));
vi.mock('./_lib/system-log.js', () => ({ writeSystemLog: vi.fn() }));
vi.mock('./_lib/anthropic-proxy.js', () => ({ callAnthropic: vi.fn() }));
vi.mock('./_lib/telegram.js', () => ({ sendTelegramAlert: vi.fn(), sendTelegramAlertOnce: vi.fn() }));
vi.mock('./_lib/sentry-server.js', () => ({ Sentry: { captureException: vi.fn() } }));
vi.mock('./_lib/run-reservation.js', () => ({ reserveRun: vi.fn(), syncRunCount: vi.fn() }));
vi.mock('./_lib/express-beta.js', () => ({ getExpressBetaFree: vi.fn().mockResolvedValue(false) }));
vi.mock('./_lib/generation-failure.js', () => ({ logServerGenerationFailure: vi.fn() }));

const { default: handler } = await import('./ai.js');

function tableBuilder(cfg) {
  const b = {
    select: () => b, eq: () => b, insert: () => b, update: () => b,
    maybeSingle: () => Promise.resolve(cfg.maybeSingle ?? { data: null, error: null }),
    single:      () => Promise.resolve(cfg.single ?? { data: null, error: null }),
    then: (res, rej) => Promise.resolve(cfg.then ?? { data: null, error: null }).then(res, rej),
  };
  return b;
}

function makeReq({ body = {}, headers = { authorization: 'Bearer test-token' }, query = { action: 'finalize-defense' }, method = 'POST' } = {}) {
  return { method, query, headers, body };
}

function makeRes() {
  return {
    statusCode: null, body: null, headers: {}, headersSent: false,
    status(c) { this.statusCode = c; return this; },
    json(p) { this.body = p; this.headersSent = true; return this; },
    end() { this.headersSent = true; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

// scores column is an array of examiner score objects, as server-parsed.
const turnsRows = (...arrs) => ({ then: { data: arrs.map(scores => ({ scores })), error: null } });

beforeEach(() => {
  h.getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'e@x.com' } }, error: null });
  h.rateLimit = vi.fn().mockResolvedValue({ allowed: true, reason: '' });
  h.config = {};
});

describe('finalize-defense — auth + input', () => {
  it('returns 401 without a token', async () => {
    const res = makeRes();
    await handler(makeReq({ headers: {} }), res);
    expect(res.statusCode).toBe(401);
    expect(h.getUser).not.toHaveBeenCalled();
  });

  it('returns 503 when auth.getUser throws', async () => {
    h.getUser.mockRejectedValue(new Error('gotrue down'));
    const res = makeRes();
    await handler(makeReq(), res);
    expect(res.statusCode).toBe(503);
  });

  it('returns 401 when the token resolves to no user', async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
    const res = makeRes();
    await handler(makeReq({ body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 429 when rate limited', async () => {
    h.rateLimit.mockResolvedValue({ allowed: false, reason: 'slow down' });
    const res = makeRes();
    await handler(makeReq({ body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBe(429);
  });

  it('returns 400 when defense_session_id is missing', async () => {
    const res = makeRes();
    await handler(makeReq({ body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 when the session is not found or not owned', async () => {
    h.config = { defense_sessions: { maybeSingle: { data: null, error: null } } };
    const res = makeRes();
    await handler(makeReq({ body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBe(404);
  });

  it('returns 503 when the session lookup errors', async () => {
    h.config = { defense_sessions: { maybeSingle: { data: null, error: { message: 'db' } } } };
    const res = makeRes();
    await handler(makeReq({ body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBe(503);
  });
});

describe('finalize-defense — score authority', () => {
  it('is idempotent: a completed session returns its stored score without recomputing', async () => {
    h.config = {
      defense_sessions: { maybeSingle: { data: { id: 's1', user_id: 'u1', status: 'completed', total_score: 8 } } },
      // Turns that would average to ~3 — must be ignored on the idempotent path.
      defense_turns: turnsRows([{ score: 3 }, { score: 3 }]),
    };
    const res = makeRes();
    await handler(makeReq({ body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ score: 8, status: 'completed' });
  });

  it('computes total_score as the rounded mean of server-written turn scores', async () => {
    h.config = {
      defense_sessions: { maybeSingle: { data: { id: 's1', user_id: 'u1', status: 'in_progress', total_score: null } }, then: { error: null } },
      defense_turns: turnsRows([{ score: 8 }, { score: 6 }], [{ score: 10 }]), // mean 8
    };
    const res = makeRes();
    await handler(makeReq({ body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ score: 8, status: 'completed' });
  });

  it('IGNORES any score supplied in the request body — uses only turn scores', async () => {
    h.config = {
      defense_sessions: { maybeSingle: { data: { id: 's1', user_id: 'u1', status: 'in_progress', total_score: null } }, then: { error: null } },
      defense_turns: turnsRows([{ score: 3 }, { score: 3 }]), // mean 3
    };
    const res = makeRes();
    // Attacker tries to inject a passing score via the body.
    await handler(makeReq({ body: { defense_session_id: 's1', total_score: 10, score: 10 } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.score).toBe(3);
  });

  it('rounds a fractional mean and skips non-numeric scores', async () => {
    h.config = {
      defense_sessions: { maybeSingle: { data: { id: 's1', user_id: 'u1', status: 'in_progress', total_score: null } }, then: { error: null } },
      defense_turns: turnsRows([{ score: 'x' }, { score: 9 }, { score: 8 }]), // finite: 9,8 → mean 8.5 → 9
    };
    const res = makeRes();
    await handler(makeReq({ body: { defense_session_id: 's1' } }), res);
    expect(res.body.score).toBe(9);
  });

  it('returns score 0 when there are no turn scores', async () => {
    h.config = {
      defense_sessions: { maybeSingle: { data: { id: 's1', user_id: 'u1', status: 'in_progress', total_score: null } }, then: { error: null } },
      defense_turns: { then: { data: [], error: null } },
    };
    const res = makeRes();
    await handler(makeReq({ body: { defense_session_id: 's1' } }), res);
    expect(res.body).toEqual({ score: 0, status: 'completed' });
  });

  it('returns 503 when the turns lookup errors', async () => {
    h.config = {
      defense_sessions: { maybeSingle: { data: { id: 's1', user_id: 'u1', status: 'in_progress', total_score: null } } },
      defense_turns: { then: { data: null, error: { message: 'db' } } },
    };
    const res = makeRes();
    await handler(makeReq({ body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBe(503);
  });

  it('returns 500 when the finalizing update fails', async () => {
    h.config = {
      defense_sessions: { maybeSingle: { data: { id: 's1', user_id: 'u1', status: 'in_progress', total_score: null } }, then: { error: { message: 'update failed' } } },
      defense_turns: turnsRows([{ score: 8 }]),
    };
    const res = makeRes();
    await handler(makeReq({ body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBe(500);
  });
});
