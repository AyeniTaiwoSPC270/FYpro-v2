import { describe, it, expect } from 'vitest'
import { isExpressOnlyUser } from './expressRouting'

const base = {
  features: [] as string[],
  betaFree: false,
  hasExpressProject: false,
  hasStandardProject: false,
}

describe('isExpressOnlyUser', () => {
  it('does NOT treat a brand-new free user as express just because the beta is free', () => {
    // The bug: express_beta_free is a global pricing flag, not a per-user signal.
    // A user who just finished standard onboarding has no entitlements and no
    // projects yet — they must land on /dashboard, not /express.
    expect(isExpressOnlyUser({ ...base, betaFree: true })).toBe(false)
  })

  it('does NOT redirect a standard user who has a standard project', () => {
    expect(
      isExpressOnlyUser({ ...base, betaFree: true, hasStandardProject: true }),
    ).toBe(false)
  })

  it('routes a beta user who actually went through express onboarding', () => {
    expect(
      isExpressOnlyUser({ ...base, betaFree: true, hasExpressProject: true }),
    ).toBe(true)
  })

  it('does NOT redirect a beta user who has both an express and a standard project', () => {
    expect(
      isExpressOnlyUser({
        ...base,
        betaFree: true,
        hasExpressProject: true,
        hasStandardProject: true,
      }),
    ).toBe(false)
  })

  it('routes a paid express-only user even before their project exists', () => {
    expect(isExpressOnlyUser({ ...base, features: ['express_defense'] })).toBe(true)
  })

  it('keeps a user who owns a standard pack on the full workflow', () => {
    expect(
      isExpressOnlyUser({ ...base, features: ['express_defense', 'student_pack'] }),
    ).toBe(false)
    expect(
      isExpressOnlyUser({ ...base, features: ['express_defense', 'defense_pack'] }),
    ).toBe(false)
  })

  it('does not route anyone to express when the beta is off and nothing is owned', () => {
    expect(isExpressOnlyUser({ ...base, hasExpressProject: true })).toBe(false)
  })
})
