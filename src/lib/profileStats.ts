// Account-level stats for /profile.
//
// Profile is rendered outside ExpressProviders, so it cannot read express progress
// from context — and the standard ProjectStateProvider only ever holds ONE project
// even when the user has several. Both facts make context the wrong source here, so
// we read the user's projects and steps straight from Supabase (RLS scopes them to
// the signed-in user) and derive everything in one pass.
//
// Pure derivation only — the query lives in db.ts, so this module stays importable
// without a Supabase client (and therefore unit-testable).

export const STANDARD_STEP_TYPES = [
  'topic_validator',
  'chapter_architect',
  'methodology_advisor',
  'writing_planner',
  'project_reviewer',
  'defense_prep',
] as const

export const EXPRESS_STEP_TYPES = [
  'project_reviewer',
  'defense_brief',
  'defense_prep',
] as const

export interface StepProgress {
  completed: number
  total: number
}

export interface ProfileStats {
  projectCount: number
  lastActiveAt: string | null
  standard: StepProgress | null
  express: StepProgress | null
}

export interface ProjectRow {
  id: string
  mode: string
  updated_at: string | null
}

export interface StepRow {
  project_id: string
  step_type: string
}

// project_reviewer and defense_prep exist in BOTH step sets, so a count is only
// meaningful scoped to one project. Distinct step types — a step re-run writes
// another row and must not count twice.
function countSteps(steps: StepRow[], projectId: string, types: readonly string[]): number {
  const done = new Set(
    steps
      .filter((s) => s.project_id === projectId && types.includes(s.step_type))
      .map((s) => s.step_type)
  )
  return done.size
}

export function computeProfileStats(projects: ProjectRow[], steps: StepRow[]): ProfileStats {
  // Most recently updated project of each mode — the one each dashboard opens into.
  const byRecency = [...projects].sort((a, b) =>
    (b.updated_at ?? '').localeCompare(a.updated_at ?? '')
  )
  const standardProject = byRecency.find((p) => p.mode === 'standard') ?? null
  const expressProject = byRecency.find((p) => p.mode === 'express') ?? null

  // An express-only user has no main project to report on. Everyone else — including
  // a brand-new user with no projects yet — is on the standard track, where 0 of 6 is
  // the honest number.
  const showStandard = !(expressProject && !standardProject)

  return {
    projectCount: projects.length,
    lastActiveAt: byRecency[0]?.updated_at ?? null,
    standard: showStandard
      ? {
          completed: standardProject
            ? countSteps(steps, standardProject.id, STANDARD_STEP_TYPES)
            : 0,
          total: STANDARD_STEP_TYPES.length,
        }
      : null,
    express: expressProject
      ? {
          completed: countSteps(steps, expressProject.id, EXPRESS_STEP_TYPES),
          total: EXPRESS_STEP_TYPES.length,
        }
      : null,
  }
}

export function formatLastActive(iso: string | null, now: Date = new Date()): string {
  if (!iso) return '—'
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return '—'

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((startOfDay(now) - startOfDay(then)) / 86_400_000)

  if (days <= 0) return 'Today'
  if (days === 1) return 'Yesterday'
  if (days < 7) return `${days} days ago`
  return then.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
