// src/hooks/useAchievements.ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from './useUser'

export interface Achievement {
  key: string
  earned_at: string | null
}

export function useAchievements() {
  const { user } = useUser()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_achievements')
      .select('achievement_key, earned_at')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })

    setAchievements((data ?? []).map(r => ({ key: r.achievement_key, earned_at: r.earned_at })))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    refresh(user.id)

    const channel = supabase
      .channel(`user_achievements_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'user_achievements',
        filter: `user_id=eq.${user.id}`,
      }, () => { refresh(user.id) })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id, refresh])

  const refetch = useCallback(() => {
    if (user?.id) refresh(user.id)
  }, [user?.id, refresh])

  const earnedKeys = new Set(achievements.map(a => a.key))

  return { achievements, earnedKeys, loading, refetch }
}
