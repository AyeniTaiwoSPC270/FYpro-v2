import { describe, it, expect } from 'vitest'
import { scoreColor, truncate } from './cardHelpers'

describe('scoreColor', () => {
  it('returns blue for a null score',   () => expect(scoreColor(null)).toBe('#3B82F6'))
  it('returns green for score 8',       () => expect(scoreColor(8)).toBe('#16A34A'))
  it('returns green for score 10',      () => expect(scoreColor(10)).toBe('#16A34A'))
  it('returns amber for score 5',       () => expect(scoreColor(5)).toBe('#F59E0B'))
  it('returns amber for score 7',       () => expect(scoreColor(7)).toBe('#F59E0B'))
  it('returns red for score 4',         () => expect(scoreColor(4)).toBe('#DC2626'))
  it('returns red for score 0',         () => expect(scoreColor(0)).toBe('#DC2626'))
})

describe('truncate', () => {
  it('returns empty string for null',      () => expect(truncate(null, 10)).toBe(''))
  it('returns empty string for undefined', () => expect(truncate(undefined, 10)).toBe(''))
  it('returns the string unchanged when under max', () => expect(truncate('short', 10)).toBe('short'))
  it('truncates and appends an ellipsis when over max', () => {
    expect(truncate('this is a long topic title', 10)).toBe('this is a…')
  })
})
