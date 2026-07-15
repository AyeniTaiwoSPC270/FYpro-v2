// Tests for api/certificate.js — the certificate issuance + public verification
// endpoint. The security guarantees under test:
//   1. Score is read from defense_sessions.total_score, NEVER from the body.
//   2. A cert is only issued for a completed session scoring >= 7/10.
//   3. Cross-user access is blocked (ownership filter on the session fetch).
//   4. Public /verify strips user_id / defense_session_id / id before responding.
//
// The PDF drawing (jsPDF) and QR generation are mocked to no-ops — they carry no
// security logic and would just make the suite slow. We assert the gate + routing.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const h = vi.hoisted(() => ({
  getUser: null,
  config: {},          // per-table DB responses, set per test
  telegramAlert: null,
}));

// jsPDF: a Proxy whose every method is a no-op, except the few whose return
// value the drawing code actually consumes.
vi.mock('jspdf', () => ({
  jsPDF: class {
    constructor() {
      return new Proxy(this, {
        get(_t, prop) {
          if (prop === 'output')           return () => new ArrayBuffer(8);
          if (prop === 'splitTextToSize')  return (t) => [t];
          if (prop === 'getTextWidth')     return () => 10;
          return () => {};
        },
      });
    }
  },
}));
vi.mock('qrcode', () => ({ default: { toDataURL: vi.fn().mockResolvedValue('data:image/png;base64,AA') } }));
vi.mock('./_lib/sentry-server.js', () => ({ Sentry: { captureException: vi.fn() } }));
vi.mock('./_lib/telegram.js', () => ({
  sendTelegramAlert: (...a) => h.telegramAlert(...a),
  escapeTgHtml: (s) => String(s),
}));
vi.mock('./_lib/supabase-admin.js', () => ({
  supabaseAdmin: {
    auth: { getUser: (...a) => h.getUser(...a) },
    from: (table) => tableBuilder(h.config[table] || {}),
  },
}));

const { default: handler } = await import('./certificate.js');

// Per-table chainable stand-in. Terminals (maybeSingle/single/then) resolve the
// configured response; the same table can serve two chains via different
// terminals (e.g. defense_certificates: maybeSingle=existing, single=newCert).
function tableBuilder(cfg) {
  const b = {
    select: () => b,
    eq: () => b,
    insert: () => b,
    update: () => b,
    maybeSingle: () => Promise.resolve(cfg.maybeSingle ?? { data: null, error: null }),
    single:      () => Promise.resolve(cfg.single ?? { data: null, error: null }),
    then: (res, rej) => Promise.resolve(cfg.then ?? { data: null, error: null }).then(res, rej),
  };
  return b;
}

function makeReq({ method = 'POST', query = {}, headers = {}, body = {} } = {}) {
  return { method, query, headers, body };
}

function makeRes() {
  return {
    statusCode: null,
    body: null,
    headers: {},
    headersSent: false,
    ended: false,
    endPayload: null,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; this.headersSent = true; return this; },
    end(payload) { this.ended = true; this.endPayload = payload; this.headersSent = true; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
}

const authHeaders = { authorization: 'Bearer test-token' };

beforeEach(() => {
  h.getUser = vi.fn().mockResolvedValue({
    data: { user: { id: 'u1', email: 'jane@x.com', user_metadata: {} } },
    error: null,
  });
  h.config = {};
  h.telegramAlert = vi.fn().mockResolvedValue(undefined);
  // ensureFonts() fetches Google Fonts; make it fail so it falls back to core fonts.
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('no network in test')));
});

afterEach(() => vi.unstubAllGlobals());

// ─── public verification (GET ?action=verify) ───────────────────────────────

describe('GET verify', () => {
  it('returns 400 when the cert parameter is missing', async () => {
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { action: 'verify' } }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 404 valid:false when the certificate is not found', async () => {
    h.config = { defense_certificates: { maybeSingle: { data: null, error: null } } };
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { action: 'verify', cert: 'FYP-2026-000999' } }), res);
    expect(res.statusCode).toBe(404);
    expect(res.body).toMatchObject({ valid: false });
  });

  it('returns the cert but strips user_id / defense_session_id / id, and fills name from profile', async () => {
    h.config = {
      defense_certificates: { maybeSingle: { data: {
        id: 'c1', user_id: 'u1', defense_session_id: 's1',
        certificate_number: 'FYP-2026-000001', score: 8,
        recipient_name: 'Old Name', faculty: null, department: null,
      } } },
      users: { maybeSingle: { data: { full_name: 'Jane Doe', faculty: 'Science', department: 'CS' } } },
    };
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: { action: 'verify', cert: 'fyp-2026-000001' } }), res);
    expect(res.statusCode).toBe(200);
    expect(res.body.valid).toBe(true);
    const cert = res.body.certificate;
    expect(cert).not.toHaveProperty('user_id');
    expect(cert).not.toHaveProperty('defense_session_id');
    expect(cert).not.toHaveProperty('id');
    expect(cert.recipient_name).toBe('Jane Doe');   // profile overrides stored name
    expect(cert.faculty).toBe('Science');
  });
});

// ─── auth + input gates (POST) ──────────────────────────────────────────────

describe('POST auth + validation', () => {
  it('returns 401 without a bearer token', async () => {
    const res = makeRes();
    await handler(makeReq({ body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBe(401);
    expect(h.getUser).not.toHaveBeenCalled();
  });

  it('returns 503 when auth.getUser throws', async () => {
    h.getUser.mockRejectedValue(new Error('gotrue down'));
    const res = makeRes();
    await handler(makeReq({ headers: authHeaders, body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBe(503);
  });

  it('returns 401 when the token resolves to no user', async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad' } });
    const res = makeRes();
    await handler(makeReq({ headers: authHeaders, body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBe(401);
  });

  it('returns 400 when defense_session_id is missing', async () => {
    const res = makeRes();
    await handler(makeReq({ headers: authHeaders, body: {} }), res);
    expect(res.statusCode).toBe(400);
  });

  it('returns 403 when the session is not found or not owned by the caller', async () => {
    h.config = { defense_sessions: { maybeSingle: { data: null, error: null } } };
    const res = makeRes();
    await handler(makeReq({ headers: authHeaders, body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBe(403);
  });
});

// ─── the score gate (POST) ──────────────────────────────────────────────────

describe('POST score gate', () => {
  it('returns 422 when the session is not completed', async () => {
    h.config = { defense_sessions: { maybeSingle: { data: { id: 's1', user_id: 'u1', total_score: 9, status: 'in_progress', project_id: 'p1' } } } };
    const res = makeRes();
    await handler(makeReq({ headers: authHeaders, body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBe(422);
  });

  it('returns 422 when the stored score is below 7 — and ignores any score in the body', async () => {
    h.config = { defense_sessions: { maybeSingle: { data: { id: 's1', user_id: 'u1', total_score: 5, status: 'completed', project_id: 'p1' } } } };
    const res = makeRes();
    // Attacker supplies score:10 in the body; the handler must use total_score (5).
    await handler(makeReq({ headers: authHeaders, body: { defense_session_id: 's1', score: 10, total_score: 10 } }), res);
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toContain('does not meet');
  });
});

// ─── issuance (POST, score >= 7) ────────────────────────────────────────────

describe('POST issuance', () => {
  const completedSession = { id: 's1', user_id: 'u1', total_score: 8, status: 'completed', project_id: 'p1' };

  it('returns a PDF for an already-issued certificate (idempotent re-download)', async () => {
    h.config = {
      defense_sessions: { maybeSingle: { data: completedSession } },
      defense_certificates: { maybeSingle: { data: {
        certificate_number: 'FYP-2026-000001', score: 8, topic_title: 'A Topic',
        recipient_name: 'Jane Doe', faculty: 'Science', department: 'CS', issued_at: '2026-07-01T00:00:00Z',
      } } },
      users: { maybeSingle: { data: { full_name: 'Jane Doe', faculty: 'Science', department: 'CS' } } },
    };
    const res = makeRes();
    await handler(makeReq({ headers: authHeaders, body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBeNull();          // no json() error path taken
    expect(res.ended).toBe(true);               // PDF written via res.end()
    expect(res.headers['Content-Type']).toBe('application/pdf');
  });

  it('returns 422 NAME_REQUIRED when issuing a new cert but the profile has no name', async () => {
    h.config = {
      defense_sessions: { maybeSingle: { data: completedSession } },
      defense_certificates: { maybeSingle: { data: null } },   // no existing cert
      users: { maybeSingle: { data: { full_name: null } } },
    };
    const res = makeRes();
    await handler(makeReq({ headers: authHeaders, body: { defense_session_id: 's1' } }), res);
    expect(res.statusCode).toBe(422);
    expect(res.body.error).toBe('NAME_REQUIRED');
  });

  it('issues a new cert (PDF + telegram alert) when score >= 7 and a name exists', async () => {
    h.config = {
      defense_sessions: { maybeSingle: { data: completedSession } },
      defense_certificates: {
        maybeSingle: { data: null },  // no existing
        single:      { data: { certificate_number: 'FYP-2026-000002', score: 8, topic_title: 'A Topic', recipient_name: 'Jane Doe', faculty: 'Science', department: 'CS', issued_at: '2026-07-15T00:00:00Z' } },
      },
      users:    { maybeSingle: { data: { full_name: 'Jane Doe', faculty: 'Science', department: 'CS' } } },
      projects: { maybeSingle: { data: { title: 'A Topic' } } },
      notifications: { then: { error: null } },
    };
    const res = makeRes();
    await handler(makeReq({ headers: authHeaders, body: { defense_session_id: 's1' } }), res);
    expect(res.ended).toBe(true);
    expect(res.headers['Content-Type']).toBe('application/pdf');
    expect(h.telegramAlert).toHaveBeenCalledTimes(1);
    expect(h.telegramAlert.mock.calls[0][0]).toContain('Certificate issued');
  });
});

// ─── routing ────────────────────────────────────────────────────────────────

describe('routing', () => {
  it('returns 405 for a GET that is not the verify action', async () => {
    const res = makeRes();
    await handler(makeReq({ method: 'GET', query: {} }), res);
    expect(res.statusCode).toBe(405);
  });
});
