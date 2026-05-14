import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from './useUser'

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
  const { user } = useUser()
  const [progress, setProgress] = useState<UserProgress>(EMPTY)
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_progress')
      .select('*')
      .eq('user_id', userId)
      .maybeSingle()

    setProgress(data ? (data as UserProgress) : EMPTY)
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    refresh(user.id)
  }, [user?.id, refresh])

  useEffect(() => {
    if (!user?.id) return
    const handler = () => refresh(user.id)
    window.addEventListener('fypro:progress-updated', handler)
    return () => window.removeEventListener('fypro:progress-updated', handler)
  }, [user?.id, refresh])

  return { progress, loading, refresh: () => user?.id && refresh(user.id) }
}
