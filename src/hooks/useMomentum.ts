// src/hooks/useMomentum.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from './useUser'

export interface MomentumAction {
  label: string
  timestamp: string
  type: 'step' | 'defense' | 'referral'
}

export interface MomentumData {
  pct: number          // 0, 25, 50, 75, or 100
  state: 'cold' | 'warming' | 'on_track' | 'peak'
  label: string
  color: string
  actions: MomentumAction[]
  loading: boolean
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function classifyPct(pct: number): Pick<MomentumData, 'state' | 'label' | 'color'> {
  if (pct === 0)   return { state: 'cold',     label: 'Start your research journey', color: '#6B7280' }
  if (pct <= 25)   return { state: 'warming',  label: 'Building momentum',           color: '#F59E0B' }
  if (pct <= 75)   return { state: 'on_track', label: 'Strong focus',                color: '#3B82F6' }
  return               { state: 'peak',     label: "You're unstoppable 🔥",        color: '#16A34A' }
}

const STEP_LABEL: Record<string, string> = {
  topic_validator:    'Completed Topic Validator',
  chapter_architect:  'Completed Chapter Architect',
  methodology_advisor:'Completed Methodology Advisor',
  writing_planner:    'Completed Writing Planner',
  project_reviewer:   'Completed Project Reviewer',
  defense_prep:       'Completed Defense Prep',
}

export function useMomentum(): MomentumData {
  const { user } = useUser()
  const [data, setData] = useState<MomentumData>({
    pct: 0, ...classifyPct(0), actions: [], loading: true,
  })

  useEffect(() => {
    if (!user?.id) { setData(d => ({ ...d, loading: false })); return }

    const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()

    async function load() {
      const [{ data: steps }, { data: defSessions }, { data: referrals }] = await Promise.all([
        supabase
          .from('project_steps')
          .select('step_name, completed_at')
          .eq('user_id', user!.id)
          .gte('completed_at', since)
          .order('completed_at', { ascending: false }),
        supabase
          .from('defense_sessions')
          .select('completed_at')
          .eq('user_id', user!.id)
          .gte('completed_at', since)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false }),
        supabase
          .from('referrals')
          .select('created_at')
          .eq('referrer_user_id', user!.id)
          .in('status', ['qualified', 'rewarded'])
          .gte('created_at', since)
          .order('created_at', { ascending: false }),
      ])

      const actions: MomentumAction[] = []

      for (const s of (steps ?? [])) {
        actions.push({
          label: STEP_LABEL[s.step_name] ?? `Completed ${s.step_name}`,
          timestamp: s.completed_at,
          type: 'step',
        })
      }
      for (const d of (defSessions ?? [])) {
        actions.push({ label: 'Ran Defense Simulator', timestamp: d.completed_at!, type: 'defense' })
      }
      for (const r of (referrals ?? [])) {
        actions.push({ label: 'Referral qualified', timestamp: r.created_at, type: 'referral' })
      }

      actions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      const actionCount = Math.min(actions.length, 4)
      const pct = actionCount * 25

      setData({ pct, ...classifyPct(pct), actions: actions.slice(0, 4), loading: false })
    }

    load().catch(() => setData(d => ({ ...d, loading: false })))

    const channel = supabase
      .channel(`momentum_steps_${user.id}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'project_steps',
        filter: `user_id=eq.${user.id}`,
      }, () => { load().catch(() => {}) })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [user?.id])

  return data
}
