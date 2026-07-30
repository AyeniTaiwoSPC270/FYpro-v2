// Tests for resolveFailurePayload — the pure decision function usePaystackCheckout
// uses to turn a verify/check-status response into a failedPayment payload (or
// null if it isn't actually a failure yet).
//
// The hook itself isn't unit-tested (no React rendering/DOM harness exists in
// this project's vitest setup — see useRunLimit.test.js for the same pattern of
// testing only the pure logic a hook depends on). The rest of the wiring
// (onClose, the poll loop, retryFailedPayment) is covered by the manual/browser
// verification step in the final task of this plan.

import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({ supabase: { auth: {} } }))
vi.mock('../lib/analytics', () => ({ trackEvent: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => vi.fn() }))

const { resolveFailurePayload } = await import('./usePaystackCheckout')

describe('resolveFailurePayload', () => {
  const ctx = { tier: 'defense_pack', reference: 'FYP_user_1_1_a' }

  it('returns null for a successful verify response', () => {
    expect(resolveFailurePayload({ status: 'success' }, ctx)).toBeNull()
  })

  it('returns null for an already-processed verify response', () => {
    expect(resolveFailurePayload({ status: 'already_processed' }, ctx)).toBeNull()
  })

  it('returns null while a check-status poll is still pending', () => {
    expect(resolveFailurePayload({ status: 'pending' }, ctx)).toBeNull()
  })

  it('returns null when check-status reports the reference as not_found', () => {
    expect(resolveFailurePayload({ status: 'not_found' }, ctx)).toBeNull()
  })

  it('returns a failure payload when check-status reports failed', () => {
    expect(resolveFailurePayload({ status: 'failed' }, ctx))
      .toEqual({ tier: 'defense_pack', reference: 'FYP_user_1_1_a', reason: null })
  })

  it('returns a failure payload carrying the decline reason from a verify error response', () => {
    expect(resolveFailurePayload({ error: 'Payment could not be verified', reason: 'Insufficient Funds' }, ctx))
      .toEqual({ tier: 'defense_pack', reference: 'FYP_user_1_1_a', reason: 'Insufficient Funds' })
  })

  it('falls back to a null reason when the verify error response carries none', () => {
    expect(resolveFailurePayload({ error: 'Payment could not be verified' }, ctx))
      .toEqual({ tier: 'defense_pack', reference: 'FYP_user_1_1_a', reason: null })
  })

  it('returns null for a null response', () => {
    expect(resolveFailurePayload(null, ctx)).toBeNull()
  })

  it('returns null for an auth error (not a payment decline)', () => {
    expect(resolveFailurePayload({ error: 'Unauthorized' }, ctx)).toBeNull()
  })

  it('returns null for a rate-limit error (not a payment decline)', () => {
    expect(resolveFailurePayload({ error: 'Too many requests' }, ctx)).toBeNull()
  })

  it('returns null for a generic/infra error that is not the known-rejection shape', () => {
    expect(resolveFailurePayload({ error: 'Internal error' }, ctx)).toBeNull()
  })
})
