// Tests for the Paystack webhook security boundary in api/payments.js.
//
// This is the ONE place where money enters the system from an untrusted network
// caller. Everything downstream (creditUser, entitlement grants) is already
// covered by credit-user.test.js. What was untested — and is the actual attack
// surface — is signature verification: an attacker who can forge a valid
// charge.success body would grant themselves free premium. These tests lock the
// HMAC SHA512 + timing-safe comparison + event routing.
//
// Strategy: drive the real default handler with a fake req/res. creditUser and
// all notify side-effects are mocked so we assert routing, not their internals.

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import crypto from 'crypto';

const TEST_SECRET = 'sk_test_webhook_secret_abc123';

// The module throws at import if PAYSTACK_SECRET_KEY is unset, and constructs a
// Resend client + Upstash-backed helpers. Set the secret and mock the heavy deps
// BEFORE importing the handler.
process.env.PAYSTACK_SECRET_KEY = TEST_SECRET;
process.env.PAYSTACK_PUBLIC_KEY = 'pk_test_public';

// Mutable handles so each test can program dependency behaviour.
const h = vi.hoisted(() => ({
  creditUser: null,
  telegramAlert: null,
  telegramAlertOnce: null,
  receiptSend: null,
  getUser: null,
  from: null,
  rateLimit: null,
}));

vi.mock('./_lib/supabase-admin.js', () => ({
  supabaseAdmin: {
    auth: { getUser: (...a) => h.getUser(...a) },
    from: (...a) => h.from(...a),
  },
}));
vi.mock('./_lib/sentry-server.js', () => ({
  Sentry: { captureException: vi.fn() },
}));
vi.mock('./_lib/rate-limit.js', () => ({
  rateLimitCheck: (...a) => h.rateLimit(...a),
}));
vi.mock('./_lib/telegram.js', () => ({
  sendTelegramAlert:     (...a) => h.telegramAlert(...a),
  sendTelegramAlertOnce: (...a) => h.telegramAlertOnce(...a),
}));
vi.mock('./_lib/credit-user.js', () => ({
  creditUser: (...a) => h.creditUser(...a),
}));
vi.mock('resend', () => ({
  Resend: class {
    constructor() {
      this.emails = { send: (...a) => h.receiptSend(...a) };
    }
  },
}));

const { default: handler } = await import('./payments.js');

// ─── Fake req / res ─────────────────────────────────────────────────────────

function sign(rawBody) {
  return crypto.createHmac('sha512', TEST_SECRET).update(rawBody).digest('hex');
}

// req must be an async-iterable (getRawBody does `for await (const chunk of req)`).
function makeReq({ method = 'POST', headers = {}, body = '', query = {} } = {}) {
  const buf = Buffer.isBuffer(body) ? body : Buffer.from(body, 'utf8');
  return {
    method,
    headers,
    query,
    async *[Symbol.asyncIterator]() {
      yield buf;
    },
  };
}

function makeRes() {
  const res = {
    statusCode: null,
    body: null,
    headers: {},
    headersSent: false,
    ended: false,
    status(code) { this.statusCode = code; return this; },
    json(payload) { this.body = payload; this.headersSent = true; return this; },
    end() { this.ended = true; this.headersSent = true; return this; },
    setHeader(k, v) { this.headers[k] = v; },
  };
  return res;
}

// Build a signed webhook request for a given event object.
function webhookReq(event, { method = 'POST', signature, headers = {} } = {}) {
  const raw = JSON.stringify(event);
  return makeReq({
    method,
    body: raw,
    headers: {
      'x-paystack-signature': signature ?? sign(raw),
      ...headers,
    },
  });
}

function chargeSuccess(overrides = {}) {
  return {
    event: 'charge.success',
    data: {
      reference: 'FYP_user_1_123_abcd',
      amount: 200000,
      status: 'success',
      currency: 'NGN',
      customer: { email: 'student@example.com' },
      ...overrides,
    },
  };
}

beforeEach(() => {
  h.creditUser        = vi.fn();
  h.telegramAlert     = vi.fn().mockResolvedValue(undefined);
  h.telegramAlertOnce = vi.fn().mockResolvedValue(undefined);
  h.receiptSend       = vi.fn().mockResolvedValue({});
  // Defaults for the action handlers (verify): authed user, limit allowed, and a
  // payments-row lookup for the post-success receipt. Tests override as needed.
  h.getUser   = vi.fn().mockResolvedValue({ data: { user: { id: 'user_1', email: 'student@example.com' } }, error: null });
  h.rateLimit = vi.fn().mockResolvedValue({ allowed: true, reason: '' });
  h.from      = vi.fn(() => paymentLookupBuilder({ amount_kobo: 200000, tier: 'student_pack' }));
});

afterEach(() => {
  vi.unstubAllGlobals();
});

// ─── Signature verification (the security boundary) ─────────────────────────

describe('webhook — signature verification', () => {
  it('rejects with 400 when the signature header is missing', async () => {
    // No x-paystack-signature → not even routed as a webhook; falls through to
    // action parsing and is rejected. Either way, creditUser must never run.
    const raw = JSON.stringify(chargeSuccess());
    const req = makeReq({ body: raw, headers: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(h.creditUser).not.toHaveBeenCalled();
  });

  it('rejects with 400 "Invalid signature" when the signature is forged (wrong secret)', async () => {
    const event = chargeSuccess();
    const forged = crypto.createHmac('sha512', 'attacker-guess').update(JSON.stringify(event)).digest('hex');
    const req = webhookReq(event, { signature: forged });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid signature' });
    expect(h.creditUser).not.toHaveBeenCalled();
  });

  it('rejects with 400 when the signature length does not match (guards timingSafeEqual)', async () => {
    // A too-short hex string produces a Buffer of the wrong length; the length
    // check must short-circuit before crypto.timingSafeEqual (which throws on
    // unequal lengths).
    const req = webhookReq(chargeSuccess(), { signature: 'abcd' });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid signature' });
    expect(h.creditUser).not.toHaveBeenCalled();
  });

  it('rejects a body tampered after signing (signature no longer matches)', async () => {
    // Sign the legit body, then swap the amount to a higher tier. Signature was
    // computed over the original bytes, so verification must fail.
    const original = chargeSuccess({ amount: 200000 });
    const goodSig  = sign(JSON.stringify(original));
    const tampered = JSON.stringify(chargeSuccess({ amount: 999999 }));
    const req = makeReq({
      body: tampered,
      headers: { 'x-paystack-signature': goodSig },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid signature' });
    expect(h.creditUser).not.toHaveBeenCalled();
  });

  it('rejects with 400 when the signature is valid but the JSON body is malformed', async () => {
    const raw = '{ not valid json';
    const req = makeReq({
      body: raw,
      headers: { 'x-paystack-signature': sign(raw) },
    });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Invalid request body' });
    expect(h.creditUser).not.toHaveBeenCalled();
  });

  it('rejects a non-POST webhook request with 405', async () => {
    const req = webhookReq(chargeSuccess(), { method: 'GET' });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(405);
    expect(h.creditUser).not.toHaveBeenCalled();
  });
});

// ─── Event routing after a valid signature ──────────────────────────────────

describe('webhook — event routing', () => {
  it('credits the user and returns 200 on a valid charge.success', async () => {
    h.creditUser.mockResolvedValue({ status: 'success', tier: 'student_pack', reference: 'FYP_user_1_123_abcd' });
    const req = webhookReq(chargeSuccess());
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ received: true, status: 'success' });
    expect(h.creditUser).toHaveBeenCalledTimes(1);
    // Fields are mapped straight from the verified event payload with source=webhook.
    expect(h.creditUser).toHaveBeenCalledWith({
      reference:          'FYP_user_1_123_abcd',
      paystackAmountKobo: 200000,
      paystackStatus:     'success',
      paystackCurrency:   'NGN',
      source:             'webhook',
    });
  });

  it('fires the receipt + telegram alert exactly once when creditUser returns success', async () => {
    h.creditUser.mockResolvedValue({ status: 'success', tier: 'student_pack' });
    const req = webhookReq(chargeSuccess());
    const res = makeRes();
    await handler(req, res);
    expect(h.telegramAlertOnce).toHaveBeenCalledTimes(1);
    expect(h.receiptSend).toHaveBeenCalledTimes(1);
  });

  it('does NOT re-send receipt/alert when creditUser reports already_processed (idempotent replay)', async () => {
    h.creditUser.mockResolvedValue({ status: 'already_processed', tier: 'student_pack' });
    const req = webhookReq(chargeSuccess());
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ received: true, status: 'already_processed' });
    expect(h.telegramAlertOnce).not.toHaveBeenCalled();
    expect(h.receiptSend).not.toHaveBeenCalled();
  });

  it('returns 200 (acknowledged) with a ❌ alert on a KNOWN_REJECTION, without 500ing', async () => {
    // 200 so Paystack does not retry a payment we deliberately refused.
    h.creditUser.mockRejectedValue(Object.assign(new Error('amount mismatch'), { code: 'KNOWN_REJECTION' }));
    const req = webhookReq(chargeSuccess());
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ received: true, rejected: 'amount mismatch' });
    expect(h.telegramAlert).toHaveBeenCalledTimes(1);
  });

  it('returns 500 and a 🚨 alert on an unexpected creditUser failure (so Paystack retries)', async () => {
    h.creditUser.mockRejectedValue(new Error('database exploded'));
    const req = webhookReq(chargeSuccess());
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
    expect(h.telegramAlert).toHaveBeenCalledTimes(1);
  });

  it('ignores non-charge.success events with 200 and never credits', async () => {
    const req = webhookReq({ event: 'charge.failed', data: { reference: 'x' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ received: true, ignored: 'charge.failed' });
    expect(h.creditUser).not.toHaveBeenCalled();
  });
});

// ─── verify handler (the browser-initiated credit path) ─────────────────────
//
// Same creditUser sink as the webhook, but reached via ?action=verify with a
// user JWT instead of a signature. It re-verifies the reference against
// Paystack's API before crediting. These lock the auth gate, the Paystack
// re-verification, and the same reject/error routing as the webhook.

// A chainable stand-in for supabaseAdmin.from('payments').select(...).eq(...).single().
function paymentLookupBuilder(row) {
  const b = {
    select() { return b; },
    eq() { return b; },
    single() { return Promise.resolve({ data: row, error: null }); },
  };
  return b;
}

// Non-webhook request: ?action=..., JWT header, no x-paystack-signature.
function actionReq({ action = 'verify', body = {}, method = 'POST', auth = true } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (auth) headers['authorization'] = 'Bearer test-token';
  return makeReq({ method, headers, body: JSON.stringify(body), query: { action } });
}

// Stub Paystack's GET /transaction/verify/:ref response.
function stubVerifyFetch(data, { ok = true, status = 200 } = {}) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok, status, json: async () => ({ data }) }));
}

describe('verify — auth + rate-limit gate', () => {
  it('returns 401 when no bearer token is present, without verifying anything', async () => {
    const req = actionReq({ body: { reference: 'FYP_x' }, auth: false });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(h.getUser).not.toHaveBeenCalled();
    expect(h.creditUser).not.toHaveBeenCalled();
  });

  it('returns 401 when the token does not resolve to a user', async () => {
    h.getUser.mockResolvedValue({ data: { user: null }, error: { message: 'bad jwt' } });
    const req = actionReq({ body: { reference: 'FYP_x' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(401);
    expect(h.creditUser).not.toHaveBeenCalled();
  });

  it('returns 429 when the caller is rate limited', async () => {
    h.rateLimit.mockResolvedValue({ allowed: false, reason: 'Too many attempts' });
    const req = actionReq({ body: { reference: 'FYP_x' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(429);
    expect(h.creditUser).not.toHaveBeenCalled();
  });

  it('returns 400 when the reference is missing', async () => {
    const req = actionReq({ body: {} });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(h.creditUser).not.toHaveBeenCalled();
  });
});

describe('verify — Paystack re-verification', () => {
  it('returns 400 and never credits when Paystack verify responds non-ok', async () => {
    stubVerifyFetch(null, { ok: false, status: 400 });
    const req = actionReq({ body: { reference: 'FYP_x' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Payment could not be verified' });
    expect(h.creditUser).not.toHaveBeenCalled();
  });

  it('returns 400 and never credits when the Paystack fetch throws', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('network down')));
    const req = actionReq({ body: { reference: 'FYP_x' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Payment could not be verified' });
    expect(h.creditUser).not.toHaveBeenCalled();
  });
});

describe('verify — credit routing', () => {
  it('credits with source=verify using the values Paystack returned, then 200', async () => {
    stubVerifyFetch({ amount: 200000, status: 'success', currency: 'NGN' });
    h.creditUser.mockResolvedValue({ status: 'success', tier: 'student_pack' });
    const req = actionReq({ body: { reference: 'FYP_user_1_1_a' } });
    const res = makeRes();
    await handler(req, res);

    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: 'success', tier: 'student_pack' });
    expect(h.creditUser).toHaveBeenCalledWith({
      reference:          'FYP_user_1_1_a',
      paystackAmountKobo: 200000,
      paystackStatus:     'success',
      paystackCurrency:   'NGN',
      source:             'verify',
    });
    // receipt + alert fire on the winning success path
    expect(h.receiptSend).toHaveBeenCalledTimes(1);
    expect(h.telegramAlertOnce).toHaveBeenCalledTimes(1);
  });

  it('does not send a receipt when creditUser reports already_processed', async () => {
    stubVerifyFetch({ amount: 200000, status: 'success', currency: 'NGN' });
    h.creditUser.mockResolvedValue({ status: 'already_processed', tier: 'student_pack' });
    const req = actionReq({ body: { reference: 'FYP_x' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(200);
    expect(res.body).toMatchObject({ status: 'already_processed' });
    expect(h.receiptSend).not.toHaveBeenCalled();
  });

  it('returns 400 with a ❌ alert on a KNOWN_REJECTION', async () => {
    stubVerifyFetch({ amount: 199999, status: 'success', currency: 'NGN' });
    h.creditUser.mockRejectedValue(Object.assign(new Error('amount mismatch'), { code: 'KNOWN_REJECTION' }));
    const req = actionReq({ body: { reference: 'FYP_x' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(400);
    expect(res.body).toEqual({ error: 'Payment could not be verified' });
    expect(h.telegramAlert).toHaveBeenCalledTimes(1);
  });

  it('returns 500 on an unexpected creditUser failure', async () => {
    stubVerifyFetch({ amount: 200000, status: 'success', currency: 'NGN' });
    h.creditUser.mockRejectedValue(new Error('db exploded'));
    const req = actionReq({ body: { reference: 'FYP_x' } });
    const res = makeRes();
    await handler(req, res);
    expect(res.statusCode).toBe(500);
  });
});
