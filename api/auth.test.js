// Tests for api/auth.js — the rate-limited proxy in front of Supabase GoTrue.
//
// The security-critical behaviour here is NOT the happy path — it's the guards:
//   • per-IP and per-email login rate limits (brute-force / credential stuffing)
//   • fail-OPEN when the limiter itself errors (a Redis outage must not lock
//     everyone out of login)
//   • the signup isNewUser guard: a re-signup attempt on an existing email must
//     NOT fire the "new signup" Telegram alert / welcome / nurture side-effects
//     (Supabase returns the existing user with identities:[] in that case)
//   • forgot-password must never reveal whether an email exists
//
// Strategy: mock the Upstash + Supabase clients and stub GoTrue fetch so we drive
// the real handler and assert routing + side-effects. Zod validation runs for real.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// Module reads these at import; set before importing the handler.
process.env.SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_ANON_KEY = 'test-anon-key';

const h = vi.hoisted(() => ({
  rlIp: null,        // () => { success } for the per-IP limiter
  rlEmail: null,     // () => { success } for the per-email login limiter
  signUp: null,
  telegramAlert: null,
  telegramAlertOnce: null,
}));

vi.mock('@upstash/redis', () => ({ Redis: class {} }));
vi.mock('@upstash/ratelimit', () => ({
  Ratelimit: class {
    static slidingWindow() { return { kind: 'sliding' }; }
    constructor(opts) { this.prefix = opts?.prefix || ''; }
    // Route by prefix so login tests can control IP and email limits separately.
    // `.then(fn())` turns a thrown fn() into a rejected promise (limiter outage).
    limit() {
      const fn = this.prefix.startsWith('rl:email') ? h.rlEmail : h.rlIp;
      return Promise.resolve().then(() => fn());
    }
  },
}));
vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { signUp: (...a) => h.signUp(...a) } }),
}));
vi.mock('./_lib/supabase-admin.js', () => ({
  supabaseAdmin: { from: () => adminBuilder() },
}));
vi.mock('./_lib/sentry-server.js', () => ({ Sentry: { captureException: vi.fn() } }));
vi.mock('./_lib/telegram.js', () => ({
  sendTelegramAlert:     (...a) => h.telegramAlert(...a),
  sendTelegramAlertOnce: (...a) => h.telegramAlertOnce(...a),
}));

const { default: handler } = await import('./auth.js');

// Permissive chainable stand-in for supabaseAdmin.from(...) — every DB write in
// auth.js is fire-and-forget, so this just needs to resolve without throwing.
function adminBuilder() {
  const result = { data: null, error: null, count: 0 };
  const b = {
    select: () => b,
    insert: () => b,
    update: () => b,
    eq: () => b,
    then: (resolve, reject) => Promise.resolve(result).then(resolve, reject),
  };
  return b;
}

function makeReq({ action, body = {}, method = 'POST', headers = {} } = {}) {
  return { method, query: { action }, headers, body };
}

function makeRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    headersSent: false,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; this.headersSent = true; return this; },
    end() { this.headersSent = true; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

beforeEach(() => {
  h.rlIp    = () => ({ success: true });
  h.rlEmail = () => ({ success: true });
  h.signUp  = vi.fn();
  h.telegramAlert     = vi.fn().mockResolvedValue(undefined);
  h.telegramAlertOnce = vi.fn().mockResolvedValue(undefined);
  // Default GoTrue token response = successful login.
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: true,
    json: async () => ({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600, token_type: 'bearer' }),
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── login ──────────────────────────────────────────────────────────────────

describe('login — validation + rate limits', () => {
  it('returns 400 and never calls GoTrue on an invalid body (missing password)', async () => {
    const res = makeRes();
    await handler(makeReq({ action: 'login', body: { email: 'a@b.com' } }), res);
    expect(res.statusCode).toBe(400);
    expect(globalThis.fetch).not.toHaveBeenCalled();
  });

  it('returns 400 on a malformed email', async () => {
    const res = makeRes();
    await handler(makeReq({ action: 'login', body: { email: 'not-an-email', password: 'x' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 429 and alerts when the per-IP limit trips, without hitting GoTrue', async () => {
    h.rlIp = () => ({ success: false });
    const res = makeRes();
    await handler(makeReq({ action: 'login', body: { email: 'a@b.com', password: 'pw' } }), res);
    expect(res.statusCode).toBe(429);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(h.telegramAlertOnce).toHaveBeenCalledTimes(1); // brute-force alert
  });

  it('returns 429 and alerts when the per-email limit trips (IP still ok)', async () => {
    h.rlEmail = () => ({ success: false });
    const res = makeRes();
    await handler(makeReq({ action: 'login', body: { email: 'target@b.com', password: 'pw' } }), res);
    expect(res.statusCode).toBe(429);
    expect(globalThis.fetch).not.toHaveBeenCalled();
    expect(h.telegramAlertOnce).toHaveBeenCalledTimes(1); // account-targeted alert
  });

  it('fails OPEN and still logs the user in when the limiter throws', async () => {
    h.rlIp = () => { throw new Error('redis down'); };
    const res = makeRes();
    await handler(makeReq({ action: 'login', body: { email: 'a@b.com', password: 'pw' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ access_token: 'tok' });
  });
});

describe('login — GoTrue outcomes', () => {
  it('returns 200 with tokens on a successful GoTrue response', async () => {
    const res = makeRes();
    await handler(makeReq({ action: 'login', body: { email: 'a@b.com', password: 'pw' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ access_token: 'tok', refresh_token: 'ref', expires_in: 3600, token_type: 'bearer' });
  });

  it('returns 401 with a generic message on bad credentials (no user enumeration)', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false, json: async () => ({ error: 'invalid_grant' }) }));
    const res = makeRes();
    await handler(makeReq({ action: 'login', body: { email: 'a@b.com', password: 'wrong' } }), res);
    expect(res.statusCode).toBe(401);
    expect(res.body).toEqual({ error: 'Invalid email or password' });
  });

  it('returns 503 when the GoTrue fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network')));
    const res = makeRes();
    await handler(makeReq({ action: 'login', body: { email: 'a@b.com', password: 'pw' } }), res);
    expect(res.statusCode).toBe(503);
  });
});

// ─── signup ───────────────────────────────────────────────────────────────────

describe('signup — isNewUser guard', () => {
  it('returns 400 on a too-short password without calling signUp', async () => {
    const res = makeRes();
    await handler(makeReq({ action: 'signup', body: { email: 'a@b.com', password: 'short' } }), res);
    expect(res.statusCode).toBe(400);
    expect(h.signUp).not.toHaveBeenCalled();
  });

  it('returns 429 when the signup IP limit trips', async () => {
    h.rlIp = () => ({ success: false });
    const res = makeRes();
    await handler(makeReq({ action: 'signup', body: { email: 'a@b.com', password: 'password123' } }), res);
    expect(res.statusCode).toBe(429);
    expect(h.signUp).not.toHaveBeenCalled();
  });

  it('fires the new-signup alert only for a genuinely new user (identities non-empty)', async () => {
    h.signUp.mockResolvedValue({ data: { user: { id: 'u1', identities: [{ id: 'x' }] } }, error: null });
    const res = makeRes();
    await handler(makeReq({ action: 'signup', body: { email: 'new@b.com', password: 'password123', full_name: 'A' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(h.telegramAlert).toHaveBeenCalledTimes(1);
    expect(h.telegramAlert.mock.calls[0][0]).toContain('New signup');
  });

  it('does NOT fire the new-signup alert on a re-signup of an existing email (identities [])', async () => {
    // Supabase returns the existing user with identities:[] and no error.
    h.signUp.mockResolvedValue({ data: { user: { id: 'u1', identities: [] } }, error: null });
    const res = makeRes();
    await handler(makeReq({ action: 'signup', body: { email: 'existing@b.com', password: 'password123' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
    expect(h.telegramAlert).not.toHaveBeenCalled();
  });

  it('returns 400 with the error message and no alert when signUp errors', async () => {
    h.signUp.mockResolvedValue({ data: { user: null }, error: { message: 'Password is too weak' } });
    const res = makeRes();
    await handler(makeReq({ action: 'signup', body: { email: 'a@b.com', password: 'password123' } }), res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Password is too weak' });
    expect(h.telegramAlert).not.toHaveBeenCalled();
  });
});

// ─── forgot-password ──────────────────────────────────────────────────────────

describe('forgot-password', () => {
  it('returns 400 on an invalid email', async () => {
    const res = makeRes();
    await handler(makeReq({ action: 'forgot-password', body: { email: 'nope' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 429 when the IP limit trips', async () => {
    h.rlIp = () => ({ success: false });
    const res = makeRes();
    await handler(makeReq({ action: 'forgot-password', body: { email: 'a@b.com' } }), res);
    expect(res.statusCode).toBe(429);
  });

  it('returns 200 {ok:true} for any valid email (no account enumeration)', async () => {
    const res = makeRes();
    await handler(makeReq({ action: 'forgot-password', body: { email: 'whoknows@b.com' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toEqual({ ok: true });
  });
});

// ─── router ─────────────────────────────────────────────────────────────────

describe('router', () => {
  it('rejects non-POST with 405', async () => {
    const res = makeRes();
    await handler(makeReq({ action: 'login', method: 'GET' }), res);
    expect(res.statusCode).toBe(405);
  });

  it('rejects an unknown action with 400', async () => {
    const res = makeRes();
    await handler(makeReq({ action: 'nonsense', body: {} }), res);
    expect(res.statusCode).toBe(400);
  });
});
