import { describe, it, expect } from 'vitest'
import { SubmitRatingSchema, validate } from './validate.js'

describe('SubmitRatingSchema', () => {
  const base = { stars: 4, trigger_type: 'defense_simulator', feature: 'Defense Simulator' }

  it('accepts a valid rating with no suggestions', () => {
    expect(validate(SubmitRatingSchema, base).ok).toBe(true)
  })

  it('accepts a rating with both suggestion fields', () => {
    const result = validate(SubmitRatingSchema, { ...base, suggestion_feature: 'PDF export', suggestion_ui: 'Sidebar narrow' })
    expect(result.ok).toBe(true)
  })

  it('accepts null suggestion fields', () => {
    expect(validate(SubmitRatingSchema, { ...base, suggestion_feature: null, suggestion_ui: null }).ok).toBe(true)
  })

  it('rejects stars out of range', () => {
    expect(validate(SubmitRatingSchema, { ...base, stars: 0 }).ok).toBe(false)
    expect(validate(SubmitRatingSchema, { ...base, stars: 6 }).ok).toBe(false)
  })

  it('rejects invalid trigger_type', () => {
    expect(validate(SubmitRatingSchema, { ...base, trigger_type: 'unknown' }).ok).toBe(false)
  })

  it('rejects suggestion_feature over 500 chars', () => {
    expect(validate(SubmitRatingSchema, { ...base, suggestion_feature: 'x'.repeat(501) }).ok).toBe(false)
  })

  it('rejects empty feature string', () => {
    expect(validate(SubmitRatingSchema, { ...base, feature: '' }).ok).toBe(false)
  })
})
