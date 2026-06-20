// src/hooks/useRatingTrigger.ts
import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface RatingPrompt {
  show: boolean
  triggerType: 'defense_simulator' | 'steps_milestone'
  feature: string
}

const LS_KEY = 'fypro_rating_done'

export function useRatingTrigger(
  stepsCompleted: boolean[],
  setRatingPrompt: (p: RatingPrompt) => void,
): void {
  // firedRef prevents double-firing within a single session
  const firedRef     = useRef(false)
  const prevCountRef = useRef(stepsCompleted.filter(Boolean).length)

  const fireTrigger = useCallback(async (
    triggerType: 'defense_simulator' | 'steps_milestone',
    feature: string,
  ) => {
    if (firedRef.current) return
    if (localStorage.getItem(LS_KEY)) { firedRef.current = true; return }

    // Belt-and-braces Supabase check — restores state after login on a new device
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('user_ratings')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)
      if (data && data.length > 0) {
        localStorage.setItem(LS_KEY, '1')
        firedRef.current = true
        return
      }
    } catch {
      // Fail open — show the modal even if the Supabase check fails
    }

    firedRef.current = true
    setRatingPrompt({ show: true, triggerType, feature })
  }, [setRatingPrompt])

  // Trigger 1 — Defense Simulator (primary)
  // Fires on the fypro:defense-session-saved DOM event dispatched by DefensePrep.jsx.
  // Does NOT fire on initial mount — only when the event is received during this session.
  useEffect(() => {
    const handler = () => fireTrigger('defense_simulator', 'Defense Simulator')
    document.addEventListener('fypro:defense-session-saved', handler)
    return () => document.removeEventListener('fypro:defense-session-saved', handler)
  }, [fireTrigger])

  // Trigger 2 — Steps milestone (secondary)
  // Fires when stepsCompleted count transitions from <3 to >=3 during this session.
  // prevCountRef tracks the previous value so we only fire on the transition, not on mount.
  useEffect(() => {
    const count = stepsCompleted.filter(Boolean).length
    const prev  = prevCountRef.current
    prevCountRef.current = count
    if (prev < 3 && count >= 3) {
      fireTrigger('steps_milestone', 'FYPro Workflow')
    }
  }, [stepsCompleted, fireTrigger])
}
