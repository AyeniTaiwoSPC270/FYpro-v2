// The W2 drill (spec exit criterion 6): for every action api/ai.js exposes,
// confirm the handler enforces a fail-closed checkDailyCap result (blocks,
// never calls Anthropic) and proceeds through a fail-open rateLimitCheck
// result (doesn't block). usage-tracker.js/rate-limit.js's own internal
// fail-open/closed correctness is proven in their own unit tests (Tasks 2-3);
// this file proves the handler layer actually acts on what those functions
// return, across every action — see
// docs/architecture/2026-08-02-w2-failure-policy-decision-table.md.
//
// Deviations from the plan's literal test code (verified against the real
// api/ai.js — see task-6-report.md for the full trace):
//   - The general-action test cases use step 'writing-planner', not
//     'topic-validator'. api/_lib/ai-prompts.js's ALLOWED_GENERAL_STEPS set
//     does not include 'topic-validator' (Topic Validator is served by
//     api/research.js, not this handler's general proxy) — using it would
//     have 400'd on the step allowlist check before ever reaching the
//     checkDailyCap gate this test exists to exercise.
//   - The supervisor-prep case adds a `stage` field to the request body and
//     stubs ANTHROPIC_API_KEY. handleSupervisorPrep validates `stage` and
//     checks process.env.ANTHROPIC_API_KEY (unset in this test environment)
//     BEFORE reaching the checkDailyCap gate — both would 400/500 before the
//     gate under test without these.
//   - A defensive global fetch stub is added because handleSupervisorPrep
//     calls the Anthropic API directly via fetch() rather than through the
//     mocked callAnthropic() helper (every other action uses callAnthropic).
//     It's never expected to be invoked (checkDailyCap fails closed before
//     handleSupervisorPrep reaches its fetch call) — the stub just turns an
//     accidental real network call into a loud test failure instead of a
//     silent hang/flake.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({ getUser: null, rateLimit: null, dailyCap: null, userCap: null, config: {} }));

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
  checkDailyCap: (...a) => h.dailyCap(...a),
  checkUserCap:  (...a) => h.userCap(...a),
  trackUsage: vi.fn(), trackUserUsage: vi.fn(),
}));
vi.mock('./_lib/cache.js', () => ({
  getCached: vi.fn().mockResolvedValue(null), setCached: vi.fn(), buildCacheKey: () => 'k',
}));
vi.mock('./_lib/system-log.js', () => ({ writeSystemLog: vi.fn() }));
vi.mock('./_lib/anthropic-proxy.js', () => ({ callAnthropic: vi.fn() }));
vi.mock('./_lib/telegram.js', () => ({ sendTelegramAlert: vi.fn(), sendTelegramAlertOnce: vi.fn() }));
vi.mock('./_lib/sentry-server.js', () => ({ Sentry: { captureException: vi.fn(), captureMessage: vi.fn() } }));
vi.mock('./_lib/run-reservation.js', () => ({ reserveRun: vi.fn(), syncRunCount: vi.fn() }));
vi.mock('./_lib/express-beta.js', () => ({ getExpressBetaFree: vi.fn().mockResolvedValue(false) }));
vi.mock('./_lib/generation-failure.js', () => ({ logServerGenerationFailure: vi.fn() }));

const { default: handler } = await import('./ai.js');
const { callAnthropic } = await import('./_lib/anthropic-proxy.js');

function tableBuilder(cfg) {
  const b = {
    select: () => b, eq: () => b, insert: () => b, update: () => b,
    upsert:      () => Promise.resolve(cfg.upsert ?? { data: null, error: null }),
    maybeSingle: () => Promise.resolve(cfg.maybeSingle ?? { data: null, error: null }),
    single:      () => Promise.resolve(cfg.single ?? { data: null, error: null }),
    then: (res, rej) => Promise.resolve(cfg.then ?? { data: null, error: null }).then(res, rej),
  };
  return b;
}

function makeReq({ action, body = {} }) {
  return {
    method: 'POST',
    query: { action },
    headers: { authorization: 'Bearer test-token' },
    body,
  };
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

beforeEach(() => {
  h.getUser  = vi.fn().mockResolvedValue({ data: { user: { id: 'u1', email: 'e@x.com' } }, error: null });
  h.rateLimit = vi.fn().mockResolvedValue({ allowed: true, reason: '' });
  h.dailyCap  = vi.fn().mockResolvedValue({ allowed: true, spent: 0, cap: 10 });
  h.userCap   = vi.fn().mockResolvedValue({ allowed: true, spent: 0, cap: 10, isPaid: false });
  h.config = {};
  callAnthropic.mockReset();
  callAnthropic.mockResolvedValue({ response: { ok: true, status: 200 }, data: { content: [{ text: '{}' }] } });
  // handleSupervisorPrep checks process.env.ANTHROPIC_API_KEY before its own
  // gates — unset in this test env, so stub it to reach the code under test.
  vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
  // Defensive only — see file header. No test path here is expected to reach
  // a real fetch() call; this just fails loudly instead of hitting the network.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('unexpected real fetch() call in W2 drill test')));
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('W2 drill — fail-closed checkDailyCap blocks every gated action', () => {
  const cases = [
    { action: undefined, body: { step: 'writing-planner', messages: [{ role: 'user', content: 'hi' }] } }, // handleGeneral
    { action: 'defense',            body: { promptType: 'x', messages: [] } },
    { action: 'supervisor-prep',    body: { stage: 'Literature review', messages: [] } },
    { action: 'defence-brief',      body: {} },
    { action: 'defence-brief-coach',body: {} },
  ];

  for (const { action, body } of cases) {
    it(`blocks ${action || 'general'} with 503 and never calls Anthropic when checkDailyCap fails closed`, async () => {
      h.dailyCap = vi.fn().mockResolvedValue({ allowed: false, spent: 0, cap: 10 }); // simulated Supabase outage → fail-closed
      const res = makeRes();
      await handler(makeReq({ action, body }), res);
      expect(res.statusCode).toBe(503);
      expect(callAnthropic).not.toHaveBeenCalled();
    });
  }
});

describe('W2 drill — fail-open rateLimitCheck does not block requests', () => {
  it('handleGeneral proceeds past the rate-limit gate when rateLimitCheck fails open (simulated Redis outage)', async () => {
    // rateLimitCheck itself never throws post-Task-3 (guardedCheck catches
    // internally) — a Redis outage surfaces here as an allowed:true result,
    // exactly like a healthy check. Confirms the handler doesn't add its own
    // extra gate on top.
    h.rateLimit = vi.fn().mockResolvedValue({ allowed: true, reason: '' });
    h.config = { user_entitlements: { maybeSingle: { data: { paid_features: [], run_counts: {} }, error: null } } };
    const res = makeRes();
    await handler(makeReq({ action: undefined, body: { step: 'writing-planner', messages: [{ role: 'user', content: 'hi' }] } }), res);
    expect(res.statusCode).not.toBe(429);
  });
});
