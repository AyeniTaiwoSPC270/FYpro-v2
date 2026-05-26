import { supabase } from './supabase'

const STEP_LABELS = {
  topic_validator:     'Topic Validator',
  chapter_architect:   'Chapter Architect',
  methodology_advisor: 'Methodology Advisor',
  writing_planner:     'Writing Planner',
  project_reviewer:    'Project Reviewer',
  defense_prep:        'Defence Prep',
}

const STEP_KEYS = Object.keys(STEP_LABELS)

export async function notifyStepCompleted(userId, stepName, stepIndex) {
  if (!userId) return
  const currentLabel = STEP_LABELS[stepName] ?? stepName
  const nextLabel    = STEP_LABELS[STEP_KEYS[stepIndex + 1]] ?? null
  const message = nextLabel
    ? `${currentLabel} done — on to ${nextLabel}.`
    : "All steps complete — you're defense ready."

  await supabase.from('notifications').insert({
    user_id:  userId,
    type:     'step_completed',
    title:    'Step completed',
    message,
    metadata: { step_name: stepName, step_index: stepIndex },
  })
}
