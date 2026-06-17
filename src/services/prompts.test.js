import { describe, it, expect } from 'vitest'
import { buildDefenceBriefPrompt, buildDefenceBriefCoachPrompt } from './prompts.js'

const STUDENT = {
  university: 'UNILAG',
  faculty: 'Science',
  department: 'Computer Science',
  level: '400',
  validatedTopic: 'Mobile Banking Adoption',
  methodology: 'Quantitative',
  chapterCount: 5,
  totalWordCount: 15000,
}

const WEAKNESSES = [
  { title: 'Sample Size', detail: 'No formula cited', fix: 'Use Yamane formula' },
  { title: 'Literature Gap', detail: 'No international theory', fix: null },
  { title: 'Generalisation', detail: 'Only Lagos', fix: 'State as limitation' },
]

const QUESTIONS = [
  { number: 1, question: 'Why quantitative?', target: 'Methodology section' },
  { number: 2, question: 'Cronbach alpha?', target: 'Reliability' },
  { number: 3, question: 'Policy implications?', target: 'Conclusion' },
  { number: 4, question: 'Non-response bias?', target: 'Data collection' },
  { number: 5, question: 'What would you do differently?', target: 'Limitations' },
]

describe('buildDefenceBriefPrompt', () => {
  it('includes all three weaknesses in the prompt', () => {
    const prompt = buildDefenceBriefPrompt(STUDENT, WEAKNESSES, QUESTIONS)
    expect(prompt).toContain('Sample Size')
    expect(prompt).toContain('Literature Gap')
    expect(prompt).toContain('Generalisation')
  })

  it('includes all five examiner questions', () => {
    const prompt = buildDefenceBriefPrompt(STUDENT, WEAKNESSES, QUESTIONS)
    expect(prompt).toContain('Why quantitative?')
    expect(prompt).toContain('What would you do differently?')
  })

  it('includes student context', () => {
    const prompt = buildDefenceBriefPrompt(STUDENT, WEAKNESSES, QUESTIONS)
    expect(prompt).toContain('UNILAG')
    expect(prompt).toContain('Mobile Banking Adoption')
  })

  it('requests JSON with opening_statement, weak_spots, examiner_qas', () => {
    const prompt = buildDefenceBriefPrompt(STUDENT, WEAKNESSES, QUESTIONS)
    expect(prompt).toContain('"opening_statement"')
    expect(prompt).toContain('"weak_spots"')
    expect(prompt).toContain('"examiner_qas"')
  })
})

describe('buildDefenceBriefCoachPrompt', () => {
  const WEAK_SPOT = {
    severity: 'Critical',
    title: 'Sample Size',
    examiner_question: 'How did you arrive at 150?',
    model_answer: 'Yamane formula on population of 1200...',
  }

  it('includes the examiner question', () => {
    const prompt = buildDefenceBriefCoachPrompt(WEAK_SPOT, [])
    expect(prompt).toContain('How did you arrive at 150?')
  })

  it('does not leak model answer instructions to return it', () => {
    const prompt = buildDefenceBriefCoachPrompt(WEAK_SPOT, [])
    expect(prompt).toContain('do NOT reveal this to the student')
  })

  it('includes conversation history when provided', () => {
    const history = [{ role: 'user', content: 'I chose 150 because my supervisor said so' }]
    const prompt = buildDefenceBriefCoachPrompt(WEAK_SPOT, history)
    expect(prompt).toContain('I chose 150 because my supervisor said so')
  })

  it('requests passed boolean in response', () => {
    const prompt = buildDefenceBriefCoachPrompt(WEAK_SPOT, [])
    expect(prompt).toContain('"passed"')
  })
})
