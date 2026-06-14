import { describe, it, expect } from 'vitest'
import { EXPRESS_STEP_DEFS, expressBuildSteps } from './_shared'

describe('EXPRESS_STEP_DEFS', () => {
  it('has 3 steps in order', () => {
    expect(EXPRESS_STEP_DEFS.map(s => s.name)).toEqual([
      'Red Flag Scanner', 'Project Reviewer', 'Defence Simulator',
    ])
  })
  it('each step has id, key, desc', () => {
    EXPRESS_STEP_DEFS.forEach(s => {
      expect(s.id).toBeTypeOf('number')
      expect(s.key).toBeTruthy()
      expect(s.desc).toBeTruthy()
    })
  })
})

describe('expressBuildSteps', () => {
  it('marks completed and active from the express step model', () => {
    const steps = expressBuildSteps({ red_flag: true, project_reviewer: false, defense: false })
    expect(steps[0].status).toBe('completed')
    expect(steps[1].status).toBe('active')
    expect(steps[2].status).toBe('locked')
  })
  it('all locked except first when nothing done', () => {
    const steps = expressBuildSteps({})
    expect(steps[0].status).toBe('active')
    expect(steps[1].status).toBe('locked')
    expect(steps[2].status).toBe('locked')
  })
  it('all completed when all done', () => {
    const steps = expressBuildSteps({ red_flag: true, project_reviewer: true, defense: true })
    expect(steps.every(s => s.status === 'completed')).toBe(true)
  })
})
