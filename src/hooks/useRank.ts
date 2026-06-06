// src/hooks/useRank.ts
import { useEffect, useMemo, useState } from 'react'
import { useUserProgress } from './useUserProgress'
import { supabase } from '../lib/supabase'
import { useUser } from './useUser'

export interface RankInfo {
  index: number
  key: string
  label: string
  emoji: string
  color: string
  nextLabel: string | null
  progressPct: number // 0-100, overall steps progress
}

export const RANKS: RankInfo[] = [
  { index: 0, key: 'recruit',    label: 'Research Recruit',      emoji: '🌱', color: '#6B7280', nextLabel: 'Topic Explorer',         progressPct: 0   },
  { index: 1, key: 'explorer',   label: 'Topic Explorer',         emoji: '🔍', color: '#3B82F6', nextLabel: 'Chapter Architect',      progressPct: 17  },
  { index: 2, key: 'architect',  label: 'Chapter Architect',      emoji: '📐', color: '#8B5CF6', nextLabel: 'Methodology Strategist', progressPct: 33  },
  { index: 3, key: 'strategist', label: 'Methodology Strategist', emoji: '⚗️',  color: '#06B6D4', nextLabel: 'Research Scholar',       progressPct: 50  },
  { index: 4, key: 'scholar',    label: 'Research Scholar',       emoji: '📝', color: '#F59E0B', nextLabel: 'Defense Candidate',      progressPct: 67  },
  { index: 5, key: 'candidate',  label: 'Defense Candidate',      emoji: '📄', color: '#10B981', nextLabel: 'Certified Researcher',   progressPct: 83  },
  { index: 6, key: 'certified',  label: 'Certified Researcher',   emoji: '🎓', color: '#0066FF', nextLabel: null,                     progressPct: 100 },
]

const STEP_KEYS = [
  'topic_validator_completed_at',
  'chapter_architect_completed_at',
  'methodology_advisor_completed_at',
  'writing_planner_completed_at',
  'project_reviewer_completed_at',
  'defense_prep_completed_at',
] as const

export function useRank() {
  const { progress, loading: progressLoading } = useUserProgress()
  const { user } = useUser()
  const [hasCertificate, setHasCertificate] = useState(false)
  const [certLoading, setCertLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) { setCertLoading(false); return }
    ;(async () => {
      try {
        const { data } = await supabase
          .from('defense_certificates')
          .select('id')
          .eq('user_id', user.id)
          .limit(1)
        setHasCertificate((data ?? []).length > 0)
      } catch {
        // silently fall back to no certificate
      } finally {
        setCertLoading(false)
      }
    })()
  }, [user?.id])

  const rank = useMemo((): RankInfo => {
    const completedCount = STEP_KEYS.filter(k => Boolean(progress[k])).length
    // Certified Researcher requires all 6 steps + a passing certificate
    let index = completedCount
    if (index === 6 && !hasCertificate) index = 5
    index = Math.min(index, 6)
    return RANKS[index]
  }, [progress, hasCertificate])

  return { rank, loading: progressLoading || certLoading }
}
