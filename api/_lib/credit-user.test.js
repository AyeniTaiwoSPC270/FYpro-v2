// Tests for the payment-credit money path: api/_lib/credit-user.js
//
// This is the function that turns a verified Paystack payment into a granted
// entitlement. A silent regression here = lost revenue or free premium, and it
// had zero automated coverage before this suite.
//
// Strategy: mock ONLY supabase-admin.js (it throws at import without env vars,
// and we need to control DB responses). pricing.js is exercised for real so the
// amount-lock is genuinely tested, not stubbed.

import { describe, it, expect, beforeEach, vi } from 'vitest'
import { PRICING_KOBO } from './pricing.js'

// vi.hoisted gives the mock factory a stable handle to mutable per-test state.
const h = vi.hoisted(() => ({ db: null }))

vi.mock('./supabase-admin.js', () => ({
  // creditUser only ever touches supabaseAdmin.from(...) — delegate to the
  // per-test mock so each test can program its own DB responses.
  supabaseAdmin: { from: (...args) => h.db.from(...args) },
}))

const { creditUser } = await import('./credit-user.js')

// ─── Fluent Supabase mock ───────────────────────────────────────────────────
//
// Supabase's query builder is chainable with several terminals:
//   .single() / .maybeSingle()  → return a Promise
//   await builder               → update/upsert without .select() are awaited
//   .select(...) then awaited   → update ... select('id')
//   .then(cb)                   → notifications insert (fire-and-forget)
//
// Each terminal consumes one queued response from that table's queue, so a test
// just lines up responses in call order. Every chained call is recorded in
// `calls` so tests can assert WHICH writes happened (e.g. entitlement upsert).
function makeSupabaseMock(queues = {}) {
  const calls = []
  const q = { payments: [], user_entitlements: [], notifications: [], ...queues }

  function nextFor(table) {
    const arr = q[table] || []
    return arr.length ? arr.shift() : { data: null, error: null }
  }

  function builder(table) {
    const b = {
      select(...a) { calls.push({ table, method: 'select', args: a }); return b },
      insert(...a) { calls.push({ table, method: 'insert', args: a }); return b },
      update(...a) { calls.push({ table, method: 'update', args: a }); return b },
      upsert(...a) { calls.push({ table, method: 'upsert', args: a }); return b },
      eq(...a)       { calls.push({ table, method: 'eq', args: a }); return b },
      contains(...a) { return b },
      order(...a)    { return b },
      limit(...a)    { return b },
      single()      { return Promise.resolve(nextFor(table)) },
      maybeSingle() { return Promise.resolve(nextFor(table)) },
      // Makes the builder a thenable so `await builder` and `.then(cb)` resolve
      // to the next queued response for this table.
      then(resolve, reject) {
        return Promise.resolve(nextFor(table)).then(resolve, reject)
      },
    }
    return b
  }

  return {
    from(table) { calls.push({ table, method: 'from', args: [] }); return builder(table) },
    calls,
  }
}

// A valid, unprocessed payment row as returned by the lookup select.
function pendingPayment(overrides = {}) {
  return {
    id: 'pay_1',
    user_id: 'user_1',
    project_id: null,
    tier: 'student_pack',
    amount_kobo: PRICING_KOBO.student_pack,
    status: 'pending',
    webhook_verified_at: null,
    ...overrides,
  }
}

// Standard valid Paystack params matching a student_pack pending row.
function validParams(overrides = {}) {
  return {
    reference: 'FYP_user_1_123_abcd',
    paystackAmountKobo: PRICING_KOBO.student_pack,
    paystackStatus: 'success',
    paystackCurrency: 'NGN',
    source: 'webhook',
    ...overrides,
  }
}

function findCall(method, table) {
  return h.db.calls.find(c => c.method === method && c.table === table)
}

// ─── Lookup + rejection paths ───────────────────────────────────────────────

describe('creditUser — rejection paths', () => {
  it('throws KNOWN_REJECTION when the reference is unknown', async () => {
    h.db = makeSupabaseMock({ payments: [{ data: null, error: { message: 'no rows' } }] })
    await expect(creditUser(validParams())).rejects.toMatchObject({ code: 'KNOWN_REJECTION' })
    // never grants when the payment row can't be found
    expect(findCall('upsert', 'user_entitlements')).toBeUndefined()
  })

  it('rejects (and marks failed) when Paystack status is not success', async () => {
    h.db = makeSupabaseMock({
      payments: [{ data: pendingPayment() }, { data: null }], // lookup, then the "failed" update
    })
    await expect(creditUser(validParams({ paystackStatus: 'failed' })))
      .rejects.toMatchObject({ code: 'KNOWN_REJECTION' })
    expect(findCall('update', 'payments')).toBeDefined()        // status set to failed
    expect(findCall('upsert', 'user_entitlements')).toBeUndefined()
  })

  it('rejects when currency is not NGN', async () => {
    h.db = makeSupabaseMock({ payments: [{ data: pendingPayment() }] })
    await expect(creditUser(validParams({ paystackCurrency: 'USD' })))
      .rejects.toMatchObject({ code: 'KNOWN_REJECTION' })
    expect(findCall('upsert', 'user_entitlements')).toBeUndefined()
  })

  it('rejects (and marks failed) when the amount does not match the tier price', async () => {
    h.db = makeSupabaseMock({
      payments: [{ data: pendingPayment() }, { data: null }],
    })
    await expect(creditUser(validParams({ paystackAmountKobo: PRICING_KOBO.student_pack - 1 })))
      .rejects.toMatchObject({ code: 'KNOWN_REJECTION' })
    expect(findCall('update', 'payments')).toBeDefined()
    expect(findCall('upsert', 'user_entitlements')).toBeUndefined()
  })

  it('rejects an underpayment that uses the wrong tier price (e.g. paying defense_pack price for nothing)', async () => {
    // tier on the row is defense_pack (₦3,500) but only the student price was paid
    h.db = makeSupabaseMock({
      payments: [{ data: pendingPayment({ tier: 'defense_pack', amount_kobo: PRICING_KOBO.defense_pack }) }, { data: null }],
    })
    await expect(creditUser(validParams({ paystackAmountKobo: PRICING_KOBO.student_pack })))
      .rejects.toMatchObject({ code: 'KNOWN_REJECTION' })
    expect(findCall('upsert', 'user_entitlements')).toBeUndefined()
  })
})

// ─── Idempotency / race safety ──────────────────────────────────────────────

describe('creditUser — idempotency', () => {
  it('returns already_processed without re-granting when payment is already success + verified', async () => {
    h.db = makeSupabaseMock({
      payments: [{ data: pendingPayment({ status: 'success', webhook_verified_at: '2026-01-01T00:00:00Z' }) }],
    })
    const res = await creditUser(validParams())
    expect(res).toEqual({ status: 'already_processed', reference: validParams().reference, tier: 'student_pack' })
    expect(findCall('upsert', 'user_entitlements')).toBeUndefined()
    expect(findCall('update', 'payments')).toBeUndefined()
  })

  it('does NOT grant when the pending→success update matches zero rows (lost the concurrent race)', async () => {
    h.db = makeSupabaseMock({
      payments: [
        { data: pendingPayment() }, // lookup: looks unprocessed
        { data: [] },               // update ... .eq('status','pending').select('id') → another call won the race
      ],
    })
    const res = await creditUser(validParams())
    expect(res).toMatchObject({ status: 'already_processed' })
    expect(findCall('upsert', 'user_entitlements')).toBeUndefined()
  })

  it('processes exactly once when two concurrent calls share one mock DB (only one wins pending)', async () => {
    // First call sees pending and wins the update; second sees the now-success row.
    h.db = makeSupabaseMock({
      payments: [
        { data: pendingPayment() },               // call A lookup
        { data: [{ id: 'pay_1' }] },              // call A update → wins
        { data: pendingPayment({ status: 'success', webhook_verified_at: '2026-01-01T00:00:00Z' }) }, // call B lookup → already processed
      ],
      user_entitlements: [{ data: null }, { data: null }],
      notifications: [{ error: null }],
    })
    const a = await creditUser(validParams())
    const b = await creditUser(validParams())
    const statuses = [a.status, b.status].sort()
    expect(statuses).toEqual(['already_processed', 'success'])
    // entitlement granted exactly once
    const grants = h.db.calls.filter(c => c.method === 'upsert' && c.table === 'user_entitlements')
    expect(grants).toHaveLength(1)
  })
})

// ─── Happy path + entitlement grant logic ───────────────────────────────────

function happyMockFor(payment, existingEntitlements = null) {
  return makeSupabaseMock({
    payments: [{ data: payment }, { data: [{ id: payment.id }] }],
    user_entitlements: [{ data: existingEntitlements }, { data: null }],
    notifications: [{ error: null }],
  })
}

function grantedPayload() {
  const call = findCall('upsert', 'user_entitlements')
  expect(call, 'expected an entitlement upsert').toBeDefined()
  return call.args[0]
}

describe('creditUser — successful grant', () => {
  it('student_pack: grants student_pack, no defense pack, records lifetime spend', async () => {
    const p = pendingPayment({ tier: 'student_pack', amount_kobo: PRICING_KOBO.student_pack })
    h.db = happyMockFor(p)
    const res = await creditUser(validParams())
    expect(res).toMatchObject({ status: 'success', tier: 'student_pack' })

    const payload = grantedPayload()
    expect(payload.paid_features).toContain('student_pack')
    expect(payload.paid_features).not.toContain('defense_pack')
    expect(payload.defense_packs_remaining).toBe(0)
    expect(payload.total_lifetime_paid_ngn).toBe(2000)
  })

  it('defense_pack: grants defense_pack + bundled project_reset + 1 defense pack credit', async () => {
    const p = pendingPayment({ tier: 'defense_pack', amount_kobo: PRICING_KOBO.defense_pack })
    h.db = happyMockFor(p)
    await creditUser(validParams({ paystackAmountKobo: PRICING_KOBO.defense_pack }))

    const payload = grantedPayload()
    expect(payload.paid_features).toEqual(expect.arrayContaining(['defense_pack', 'project_reset']))
    expect(payload.defense_packs_remaining).toBe(1)
    expect(payload.total_lifetime_paid_ngn).toBe(3500)
  })

  it('defense_pack_upgrade: priced at ₦1,500 but grants the same defense_pack entitlement', async () => {
    const p = pendingPayment({ tier: 'defense_pack_upgrade', amount_kobo: PRICING_KOBO.defense_pack_upgrade })
    h.db = happyMockFor(p)
    const res = await creditUser(validParams({ paystackAmountKobo: PRICING_KOBO.defense_pack_upgrade }))
    expect(res.status).toBe('success')

    const payload = grantedPayload()
    expect(payload.paid_features).toEqual(expect.arrayContaining(['defense_pack', 'project_reset']))
    expect(payload.defense_packs_remaining).toBe(1)
    expect(payload.total_lifetime_paid_ngn).toBe(1500)
  })

  it('express_defense: grants express_defense, no defense pack credits', async () => {
    const p = pendingPayment({ tier: 'express_defense', amount_kobo: PRICING_KOBO.express_defense })
    h.db = happyMockFor(p)
    const res = await creditUser(validParams({ paystackAmountKobo: PRICING_KOBO.express_defense }))
    expect(res).toMatchObject({ status: 'success', tier: 'express_defense' })

    const payload = grantedPayload()
    expect(payload.paid_features).toContain('express_defense')
    expect(payload.paid_features).not.toContain('defense_pack')
    expect(payload.paid_features).not.toContain('project_reset')
    expect(payload.defense_packs_remaining).toBe(0)
    expect(payload.total_lifetime_paid_ngn).toBe(2000)
  })

  it('project_reset: grants only project_reset', async () => {
    const p = pendingPayment({ tier: 'project_reset', amount_kobo: PRICING_KOBO.project_reset })
    h.db = happyMockFor(p)
    await creditUser(validParams({ paystackAmountKobo: PRICING_KOBO.project_reset }))

    const payload = grantedPayload()
    expect(payload.paid_features).toContain('project_reset')
    expect(payload.paid_features).not.toContain('defense_pack')
    expect(payload.defense_packs_remaining).toBe(0)
  })

  it('merges onto existing entitlements without dropping prior features, and accumulates lifetime spend', async () => {
    const p = pendingPayment({ tier: 'defense_pack', amount_kobo: PRICING_KOBO.defense_pack })
    h.db = happyMockFor(p, {
      paid_features: ['student_pack'],
      defense_packs_remaining: 0,
      total_lifetime_paid_ngn: 2000,
    })
    await creditUser(validParams({ paystackAmountKobo: PRICING_KOBO.defense_pack }))

    const payload = grantedPayload()
    expect(payload.paid_features).toEqual(expect.arrayContaining(['student_pack', 'defense_pack', 'project_reset']))
    // no duplicate student_pack
    expect(payload.paid_features.filter(f => f === 'student_pack')).toHaveLength(1)
    expect(payload.defense_packs_remaining).toBe(1)
    expect(payload.total_lifetime_paid_ngn).toBe(5500) // 2000 existing + 3500
  })

  it('marks the payment row success before granting (verified_at set)', async () => {
    const p = pendingPayment()
    h.db = happyMockFor(p)
    await creditUser(validParams())
    const update = findCall('update', 'payments')
    expect(update).toBeDefined()
    expect(update.args[0]).toMatchObject({ status: 'success' })
    expect(update.args[0].webhook_verified_at).toBeTruthy()
  })
})
