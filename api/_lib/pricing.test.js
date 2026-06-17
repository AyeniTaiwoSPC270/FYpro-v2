// Tests for api/_lib/pricing.js — the single source of truth for what each
// tier costs in kobo. creditUser's amount-lock depends entirely on these values,
// so an accidental edit here would silently change what users are charged.

import { describe, it, expect } from 'vitest'
import { PRICING_KOBO, expectedAmountKobo } from './pricing.js'

describe('PRICING_KOBO', () => {
  it('matches the documented Naira prices (kobo = ₦ × 100)', () => {
    expect(PRICING_KOBO).toEqual({
      student_pack:         200000, // ₦2,000
      defense_pack:         350000, // ₦3,500
      defense_pack_upgrade: 150000, // ₦1,500
      express_defense:      200000, // ₦2,000
      project_reset:        150000, // ₦1,500
    })
  })

  it('every price is a positive integer number of kobo', () => {
    for (const [tier, kobo] of Object.entries(PRICING_KOBO)) {
      expect(Number.isInteger(kobo), `${tier} must be integer kobo`).toBe(true)
      expect(kobo, `${tier} must be > 0`).toBeGreaterThan(0)
    }
  })
})

describe('expectedAmountKobo', () => {
  it('returns the kobo amount for each known tier', () => {
    for (const [tier, kobo] of Object.entries(PRICING_KOBO)) {
      expect(expectedAmountKobo(tier)).toBe(kobo)
    }
  })

  it('throws for an unknown tier (no silent zero-price grant)', () => {
    expect(() => expectedAmountKobo('free_lunch')).toThrow(/Unknown tier/)
    expect(() => expectedAmountKobo(undefined)).toThrow(/Unknown tier/)
    expect(() => expectedAmountKobo('')).toThrow(/Unknown tier/)
  })
})
