// Tests for the server-side reviewer prompt registry — specifically the merged
// relevance-gate promptType that lets one Anthropic call both validate document
// relevance and produce the full review (halves PDF token cost).

import { describe, it, expect } from 'vitest'
import { getReviewerSystemPrompt, buildPdfReviewerUserTextBlock } from './ai-prompts.js'

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

describe('getReviewerSystemPrompt — weakness count', () => {
  it('instructs 1 to 3 genuine weaknesses, never fabricated to fill 3', () => {
    const sys = getReviewerSystemPrompt('review', {})
    expect(sys).toContain('1 to 3 genuine weaknesses')
    expect(sys).toContain('Never invent a weakness just to reach 3')
    expect(sys).not.toContain('Exactly 3 weaknesses')
  })

  it('leaves strengths and examiner questions at their fixed counts', () => {
    const sys = getReviewerSystemPrompt('review', {})
    expect(sys).toContain('Exactly 3 specific strengths')
    expect(sys).toContain('Exactly 5 examiner questions')
  })
})

describe('buildPdfReviewerUserTextBlock', () => {
  it('includes the student faculty/department and asks for the review JSON', () => {
    const text = buildPdfReviewerUserTextBlock({
      faculty: 'Science', department: 'Computer Science',
      level: '400', university: 'UNILAG',
    });
    expect(text).toContain('Computer Science');
    expect(text).toContain('examiner_questions');
    expect(text).toContain('Return only the JSON');
  });

  it('tolerates a missing student context object', () => {
    expect(() => buildPdfReviewerUserTextBlock(undefined)).not.toThrow();
  });
})
