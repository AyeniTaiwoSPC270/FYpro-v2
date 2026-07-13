import { describe, it, expect } from 'vitest'
import { computeProfileStats, formatLastActive } from './profileStats'

const std = { id: 'p-std', mode: 'standard', updated_at: '2026-07-10T10:00:00Z' }
const exp = { id: 'p-exp', mode: 'express', updated_at: '2026-07-12T10:00:00Z' }

const step = (project_id, step_type) => ({ project_id, step_type })

describe('computeProfileStats', () => {
  it('reports express progress out of 3 for an express-only user', () => {
    const stats = computeProfileStats(
      [exp],
      [step('p-exp', 'project_reviewer'), step('p-exp', 'defense_brief')]
    )
    expect(stats.express).toEqual({ completed: 2, total: 3 })
    // No main project exists, so there is nothing to report "of 6" about.
    expect(stats.standard).toBeNull()
    expect(stats.projectCount).toBe(1)
  })

  it('reports both tracks for a user with a project in each mode', () => {
    const stats = computeProfileStats(
      [std, exp],
      [
        step('p-std', 'topic_validator'),
        step('p-std', 'chapter_architect'),
        step('p-exp', 'project_reviewer'),
      ]
    )
    expect(stats.standard).toEqual({ completed: 2, total: 6 })
    expect(stats.express).toEqual({ completed: 1, total: 3 })
    expect(stats.projectCount).toBe(2)
  })

  it('counts express and standard projects alike', () => {
    const stats = computeProfileStats(
      [std, exp, { id: 'p-std2', mode: 'standard', updated_at: '2026-07-01T10:00:00Z' }],
      []
    )
    expect(stats.projectCount).toBe(3)
  })

  it('shows an empty main track for a user with no projects yet', () => {
    const stats = computeProfileStats([], [])
    expect(stats.standard).toEqual({ completed: 0, total: 6 })
    expect(stats.express).toBeNull()
    expect(stats.projectCount).toBe(0)
    expect(stats.lastActiveAt).toBeNull()
  })

  it('scopes the main count to the most recently updated standard project', () => {
    const older = { id: 'p-old', mode: 'standard', updated_at: '2026-01-01T10:00:00Z' }
    const stats = computeProfileStats(
      [older, std],
      [
        step('p-old', 'topic_validator'),
        step('p-old', 'chapter_architect'),
        step('p-old', 'methodology_advisor'),
        step('p-std', 'topic_validator'),
      ]
    )
    // The dashboard opens into the most recent project — the stat must agree with it.
    expect(stats.standard).toEqual({ completed: 1, total: 6 })
  })

  it('does not let a step type shared by both modes leak across projects', () => {
    // project_reviewer and defense_prep exist in both step sets.
    const stats = computeProfileStats(
      [std, exp],
      [step('p-exp', 'project_reviewer'), step('p-exp', 'defense_prep')]
    )
    expect(stats.standard).toEqual({ completed: 0, total: 6 })
    expect(stats.express).toEqual({ completed: 2, total: 3 })
  })

  it('counts a re-run step only once', () => {
    const stats = computeProfileStats(
      [std],
      [step('p-std', 'topic_validator'), step('p-std', 'topic_validator')]
    )
    expect(stats.standard).toEqual({ completed: 1, total: 6 })
  })

  it('ignores step types outside the tracked sets', () => {
    const stats = computeProfileStats(
      [exp],
      [step('p-exp', 'express_context'), step('p-exp', 'red_flag_detector')]
    )
    expect(stats.express).toEqual({ completed: 0, total: 3 })
  })

  it('takes last active from the most recently updated project of any mode', () => {
    const stats = computeProfileStats([std, exp], [])
    expect(stats.lastActiveAt).toBe(exp.updated_at)
  })
})

describe('formatLastActive', () => {
  const now = new Date(2026, 6, 13, 9, 0) // 13 July 2026, local

  it('says Today for activity earlier the same day', () => {
    expect(formatLastActive(new Date(2026, 6, 13, 1, 0).toISOString(), now)).toBe('Today')
  })

  it('says Yesterday for the previous calendar day', () => {
    expect(formatLastActive(new Date(2026, 6, 12, 23, 0).toISOString(), now)).toBe('Yesterday')
  })

  it('counts days within the last week', () => {
    expect(formatLastActive(new Date(2026, 6, 10, 12, 0).toISOString(), now)).toBe('3 days ago')
  })

  it('falls back to a date beyond a week', () => {
    expect(formatLastActive(new Date(2026, 5, 20, 12, 0).toISOString(), now)).toBe('20 Jun')
  })

  it('renders a dash when there is no activity', () => {
    expect(formatLastActive(null, now)).toBe('—')
  })
})
