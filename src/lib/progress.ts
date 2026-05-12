import { supabase } from './supabase'

async function sessionUser() {
  const { data: { session } } = await supabase.auth.getSession()
  return session?.user ?? null
}

export type StepKey =
  | 'topic_validator'
  | 'chapter_architect'
  | 'methodology_advisor'
  | 'writing_planner'
  | 'project_reviewer'
  | 'defense_prep'

const STEP_COLUMN: Record<StepKey, string> = {
  topic_validator:     'topic_validator_completed_at',
  chapter_architect:   'chapter_architect_completed_at',
  methodology_advisor: 'methodology_advisor_completed_at',
  writing_planner:     'writing_planner_completed_at',
  project_reviewer:    'project_reviewer_completed_at',
  defense_prep:        'defense_prep_completed_at',
}

function emitProgressUpdated() {
  window.dispatchEvent(new CustomEvent('fypro:progress-updated'))
}

export async function markStepComplete(step: StepKey): Promise<void> {
  const user = await sessionUser()
  if (!user) return

  const col = STEP_COLUMN[step]
  const now = new Date().toISOString()

  const { error } = await supabase
    .from('user_progress')
    .upsert(
      { user_id: user.id, [col]: now, updated_at: now },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('[progress] markStepComplete failed:', error.message)
    return
  }

  emitProgressUpdated()
}

export async function markDefenseSimulatorRun(): Promise<void> {
  const user = await sessionUser()
  if (!user) return

  const now = new Date().toISOString()

  // Fetch current row to check if first_run is already set
  const { data: existing } = await supabase
    .from('user_progress')
    .select('defense_simulator_first_run_at')
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing?.defense_simulator_first_run_at) {
    // Already set — just bump updated_at
    await supabase
      .from('user_progress')
      .update({ updated_at: now })
      .eq('user_id', user.id)
    emitProgressUpdated()
    return
  }

  const { error } = await supabase
    .from('user_progress')
    .upsert(
      { user_id: user.id, defense_simulator_first_run_at: now, updated_at: now },
      { onConflict: 'user_id' }
    )

  if (error) {
    console.error('[progress] markDefenseSimulatorRun failed:', error.message)
    return
  }

  emitProgressUpdated()
}

export async function tryAwardDefenseReady(): Promise<boolean> {
  const user = await sessionUser()
  if (!user) return false

  const { data: progress } = await supabase
    .from('user_progress')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  if (!progress || progress.defense_ready_awarded_at) return false

  const allConditionsMet =
    progress.topic_validator_completed_at &&
    progress.chapter_architect_completed_at &&
    progress.methodology_advisor_completed_at &&
    progress.writing_planner_completed_at &&
    progress.project_reviewer_completed_at &&
    progress.defense_prep_completed_at &&
    progress.defense_simulator_first_run_at

  if (!allConditionsMet) return false

  const { error } = await supabase
    .from('user_progress')
    .update({
      defense_ready_awarded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('user_id', user.id)

  if (error) {
    // DB trigger will reject if conditions aren't met server-side
    console.error('[progress] tryAwardDefenseReady failed:', error.message)
    return false
  }

  emitProgressUpdated()
  return true
}
