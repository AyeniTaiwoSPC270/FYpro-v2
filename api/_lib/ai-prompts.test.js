// Tests for the server-side reviewer prompt registry — specifically the merged
// relevance-gate promptType that lets one Anthropic call both validate document
// relevance and produce the full review (halves PDF token cost).

import { describe, it, expect } from 'vitest'
import { getReviewerSystemPrompt } from './ai-prompts.js'

describe('getReviewerSystemPrompt — review-with-relevance', () => {
  it('prepends the relevance gate to the full reviewer prompt', () => {
    const sys = getReviewerSystemPrompt('review-with-relevance', {})
    expect(sys).toContain('"relevant": false')
    expect(sys).toContain('strict external examiner')
    expect(sys.indexOf('RELEVANCE GATE')).toBeGreaterThanOrEqual(0)
    expect(sys.indexOf('RELEVANCE GATE')).toBeLessThan(sys.indexOf('strict external examiner'))
  })

  it('puts previous-steps context before the gate when provided', () => {
    const sys = getReviewerSystemPrompt('review-with-relevance', {
      previousSteps: { validatedTopic: 'Solar micro-grid adoption in Lagos' },
    })
    expect(sys.indexOf('Solar micro-grid adoption in Lagos')).toBeLessThan(sys.indexOf('RELEVANCE GATE'))
  })

  it('leaves the legacy promptTypes untouched', () => {
    expect(getReviewerSystemPrompt('review', {})).toContain('strict external examiner')
    expect(getReviewerSystemPrompt('review', {})).not.toContain('RELEVANCE GATE')
    expect(getReviewerSystemPrompt('relevance-check')).toContain('document validator')
    expect(getReviewerSystemPrompt('unknown-type')).toBeNull()
  })
})
