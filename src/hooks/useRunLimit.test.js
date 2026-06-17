// Tests for resolveLimit — the client mirror of server-side run caps.
//
// resolveLimit is a pure function but lives in a module with React + supabase
// top-level side effects (an onAuthStateChange subscription registered at import).
// We stub those deps so the module imports cleanly, then exercise the pure logic.
//
// What must not regress: express-only users get the lifetime caps; Defense Pack
// holders stay exempt (express features unlimited for them); standard keys are
// unaffected for express users.

import { describe, it, expect, vi } from 'vitest'

vi.mock('../lib/supabase', () => ({
  supabase: {
    auth: { onAuthStateChange: () => ({ data: { subscription: {} } }) },
    from: () => ({ select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: null, error: null }) }) }) }),
  },
}))
vi.mock('../lib/entitlements-cache', () => ({
  getCachedEntitlements: vi.fn().mockResolvedValue(null),
  invalidateCachedEntitlements: vi.fn(),
}))
vi.mock('./useUser', () => ({ useUser: () => ({ user: null }) }))

const { resolveLimit } = await import('./useRunLimit')

describe('resolveLimit — express-only lifetime caps', () => {
  const EXPRESS = ['express_defense']

  it('caps the three express features for express-only users', () => {
    expect(resolveLimit('express_reviewer', EXPRESS)).toBe(5)
    expect(resolveLimit('express_defence_brief', EXPRESS)).toBe(5)
    expect(resolveLimit('express_simulator', EXPRESS)).toBe(10)
  })

  it('does not leak express caps onto standard keys (falls through to free tier)', () => {
    // Express users never run the standard workflow, but the resolver must not
    // apply express caps to non-express keys. project_reviewer is in no free table
    // → unlimited; topic_validator falls through to the free per-step limit (3),
    // since express_defense does not grant student_pack.
    expect(resolveLimit('project_reviewer', EXPRESS)).toBeNull()
    expect(resolveLimit('topic_validator', EXPRESS)).toBe(3)
  })

  it('exempts Defense Pack holders — express features stay unlimited', () => {
    const both = ['express_defense', 'defense_pack']
    expect(resolveLimit('express_reviewer', both)).toBeNull()
    expect(resolveLimit('express_defence_brief', both)).toBeNull()
    expect(resolveLimit('express_simulator', both)).toBeNull()
  })

  it('does not grant express caps to users without express_defense', () => {
    expect(resolveLimit('express_reviewer', ['student_pack'])).toBeNull()
    expect(resolveLimit('express_reviewer', [])).toBeNull()
  })
})

describe('resolveLimit — existing tiers unchanged', () => {
  it('free users get the free per-step limits', () => {
    expect(resolveLimit('topic_validator', [])).toBe(3)
    expect(resolveLimit('chapter_architect', [])).toBe(3)
  })

  it('student pack raises the standard limits', () => {
    expect(resolveLimit('topic_validator', ['student_pack'])).toBe(20)
    expect(resolveLimit('project_reviewer', ['student_pack'])).toBe(10)
  })

  it('defense pack caps the simulator and red flag detector', () => {
    expect(resolveLimit('defense_simulator', ['defense_pack'])).toBe(5)
    expect(resolveLimit('project_reviewer', ['defense_pack'])).toBeNull()
  })
})
