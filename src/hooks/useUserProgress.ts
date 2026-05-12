import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export interface UserProgress {
  topic_validator_completed_at:     string | null
  chapter_architect_completed_at:   string | null
  methodology_advisor_completed_at: string | null
  writing_planner_completed_at:     string | null
  project_reviewer_completed_at:    string | null
  defense_prep_completed_at:        string | null
  defense_simulator_first_run_at:   string | null
  defense_ready_awarded_at:         string | null
}

const EMPTY: UserProgress = {
  topic_validator_completed_at:     null,
  chapter_architect_completed_at:   null,
  methodology_advisor_completed_at: null,
  writing_planner_completed_at:     null,
  project_reviewer_completed_at:    null,
  defense_prep_completed_at:        null,
  defense_simulator_first_run_at:   null,
  defense_ready_awarded_at:         null,
}

export function useUserProgress() {
  const [progress, setProgress] = useState<UserProgress>(EMPTY)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user ?? null
    if (!user) { setLoading(false); return }

    const { data } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', user.id)
      .maybeSingle()

    setProgress(data ? (data as UserProgress) : EMPTY)
    setLoading(false)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  // Re-fetch whenever a step is marked complete in the same tab
  useEffect(() => {
    const handler = () => refresh()
    window.addEventListener('fypro:progress-updated', handler)
    return () => window.removeEventListener('fypro:progress-updated', handler)
  }, [refresh])

  return { progress, loading, refresh }
}
