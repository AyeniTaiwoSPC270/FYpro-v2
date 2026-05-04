// Single source of truth for Supabase-backed project state.
// Exports ProjectStateProvider (add to App.jsx inside AppProvider + BrowserRouter)
// and useProjectState() (call from any step component to get saveStep).

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react'
import { supabase } from '../lib/supabase'
import {
  loadUserState,
  createProject,
  saveStep as supabaseSaveStep,
  updateProject,
  deleteAllUserData,
  Project,
} from '../lib/supabase-client'
import { enqueue, getStatus } from '../lib/sync-queue'
import { useApp } from '../context/AppContext'
import { showToast } from '../components/Toast'

// Maps step_type → AppContext state key (for hydration after Supabase load)
const STEP_TO_STATE: Record<string, string> = {
  topic_validator:     'topicValidation',
  chapter_architect:   'chapterStructure',
  methodology_advisor: 'methodology',
  instrument_builder:  'instrumentBuilder',
  writing_planner:     'writingPlan',
  literature_map:      'literatureMap',
  abstract_generator:  'abstractData',
  project_reviewer:    'uploadedProject',
}

// Maps step_type → stepsCompleted[] index
const STEP_TO_IDX: Record<string, number> = {
  topic_validator:     0,
  chapter_architect:   1,
  methodology_advisor: 2,
  writing_planner:     3,
  project_reviewer:    4,
  defense_prep:        5,
}

// Maps step_type → next current_step value for projects table
const NEXT_STEP: Record<string, string> = {
  topic_validator:     'chapter_architect',
  chapter_architect:   'methodology_advisor',
  methodology_advisor: 'writing_planner',
  writing_planner:     'project_reviewer',
  project_reviewer:    'defense_prep',
  defense_prep:        'defense_prep',
}

// ─── Retry helper ─────────────────────────────────────────────────────────────

async function withRetry<T>(fn: () => Promise<T>, delays = [1000, 3000]): Promise<T> {
  let lastErr: unknown
  for (let i = 0; i <= delays.length; i++) {
    try {
      return await fn()
    } catch (err) {
      lastErr = err
      if (i < delays.length) await new Promise(r => setTimeout(r, delays[i]))
    }
  }
  throw lastErr
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ProjectStateValue {
  projectId: string | null
  isLoading: boolean
  showMigrationModal: boolean
  dismissMigrationModal: () => void
  confirmMigration: () => void
  saveStep: (stepType: string, resultJson: Record<string, unknown>, inputSummary?: string) => Promise<void>
  ensureProject: () => Promise<string | null>
  resetProject: () => Promise<void>
}

const ProjectStateContext = createContext<ProjectStateValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProjectStateProvider({ children }: { children: ReactNode }) {
  const { set, state } = useApp()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const stateRef = useRef(state)
  // True after the first load() completes — used to skip the initial SIGNED_IN
  // emission that Supabase fires synchronously when subscribing to onAuthStateChange.
  const initializedRef = useRef(false)

  useEffect(() => { stateRef.current = state }, [state])

  // Subscribe to realtime project_steps updates for two-tab sync
  function subscribeToProject(pid: string) {
    if (channelRef.current) supabase.removeChannel(channelRef.current)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const ch = supabase.channel(`project_${pid}`) as any
    ch.on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'project_steps',
        filter: `project_id=eq.${pid}`,
      },
      (payload: { new?: Record<string, unknown> }) => {
        const row = payload.new
        if (!row || typeof row !== 'object') return
        const stateKey = STEP_TO_STATE[row.step_type as string]
        if (stateKey) set({ [stateKey]: row.result_json })
      }
    ).subscribe()
    channelRef.current = ch
  }

  // Initial load: fetch from Supabase and hydrate AppContext
  useEffect(() => {
    let cancelled = false

    async function load() {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) { setIsLoading(false); return }

        const userState = await loadUserState()
        if (cancelled) return

        const hydration: Record<string, unknown> = {}

        if (userState.profile) {
          const name = userState.profile.full_name
            ?? (user.user_metadata?.full_name as string | undefined)
            ?? null
          if (name) hydration.name = name
          if (userState.profile.faculty)    hydration.faculty    = userState.profile.faculty
          if (userState.profile.department) hydration.department = userState.profile.department
          if (userState.profile.level)      hydration.level      = userState.profile.level
        }

        if (userState.project) {
          setProjectId(userState.project.id)
          if (userState.project.title) hydration.validatedTopic = userState.project.title
          subscribeToProject(userState.project.id)
        }

        if (userState.steps.length > 0) {
          const completed = [false, false, false, false, false, false]
          for (const step of userState.steps) {
            const key = STEP_TO_STATE[step.step_type]
            if (key) hydration[key] = step.result_json
            const idx = STEP_TO_IDX[step.step_type]
            if (idx !== undefined) completed[idx] = true
          }
          hydration.stepsCompleted = completed
          const last = completed.lastIndexOf(true)
          if (last !== -1) hydration.currentStep = Math.min(last + 1, 5)
        }

        if (Object.keys(hydration).length > 0) set(hydration)

        // Check if anonymous localStorage session exists but no Supabase project
        if (!userState.project) {
          const raw = localStorage.getItem('fypro_session')
          if (raw) {
            try {
              const saved = JSON.parse(raw)
              const hasProgress = saved.roughTopic || saved.validatedTopic ||
                (saved.stepsCompleted || []).some(Boolean)
              if (hasProgress) setShowMigrationModal(true)
            } catch { /* malformed — ignore */ }
          }
        }
      } catch (err) {
        console.error('[useProjectState] load error:', err)
      } finally {
        if (!cancelled) {
          setIsLoading(false)
          initializedRef.current = true
        }
      }
    }

    load()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // Skip the SIGNED_IN that Supabase emits immediately on subscription setup
      // (it fires even before our async load() resolves). We only want to react
      // to genuine sign-in / sign-out transitions after initialization.
      if (!initializedRef.current) return

      if (event === 'SIGNED_IN' || event === 'SIGNED_OUT') {
        setIsLoading(true)
        setProjectId(null)
        load()
      }
    })

    return () => {
      cancelled = true
      subscription.unsubscribe()
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const ensureProject = useCallback(async (): Promise<string | null> => {
    if (projectId) return projectId
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return null

    const current = stateRef.current
    const project: Project | null = await createProject({
      faculty:    current.faculty    || null,
      department: current.department || null,
      level:      current.level      || null,
    })
    if (!project) return null

    setProjectId(project.id)
    if (current.validatedTopic) {
      await updateProject(project.id, { title: current.validatedTopic })
    }
    subscribeToProject(project.id)
    return project.id
  }, [projectId]) // eslint-disable-line react-hooks/exhaustive-deps

  const saveStep = useCallback(async (
    stepType: string,
    resultJson: Record<string, unknown>,
    inputSummary?: string
  ): Promise<void> => {
    const pid = projectId ?? await ensureProject()
    if (!pid) {
      enqueue({ projectId: '', stepType, resultJson, inputSummary: inputSummary ?? null })
      showToast('Saved locally — will sync when connected')
      return
    }

    const isOnline = getStatus() !== 'offline' && navigator.onLine

    if (isOnline) {
      try {
        await withRetry(() => supabaseSaveStep(pid, stepType, resultJson, inputSummary))
        if (NEXT_STEP[stepType]) {
          updateProject(pid, { current_step: NEXT_STEP[stepType] }).catch(() => {})
        }
        if (stepType === 'topic_validator' && resultJson.refined_topic) {
          updateProject(pid, { title: resultJson.refined_topic as string }).catch(() => {})
        }
      } catch {
        enqueue({ projectId: pid, stepType, resultJson, inputSummary: inputSummary ?? null })
        showToast('Saved locally — will sync when reconnected')
      }
    } else {
      enqueue({ projectId: pid, stepType, resultJson, inputSummary: inputSummary ?? null })
      showToast('Saved locally — will sync when reconnected')
    }
  }, [projectId, ensureProject])

  async function resetProject() {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      try {
        await deleteAllUserData(user.id)
      } catch (err) {
        console.error('[resetProject] delete failed', err)
      }
    }
    setProjectId(null)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }

  function dismissMigrationModal() {
    setShowMigrationModal(false)
  }

  async function confirmMigration() {
    setShowMigrationModal(false)
    const raw = localStorage.getItem('fypro_session')
    if (!raw) return

    let saved: Record<string, unknown>
    try { saved = JSON.parse(raw) } catch { return }

    const current = stateRef.current
    const project = await createProject({
      faculty:    (saved.faculty as string)    || current.faculty    || null,
      department: (saved.department as string) || current.department || null,
      level:      (saved.level as string)      || current.level      || null,
    })
    if (!project) { showToast('Migration failed — please try again'); return }

    setProjectId(project.id)
    subscribeToProject(project.id)

    const stepMap: Record<string, string> = {
      topicValidation:  'topic_validator',
      chapterStructure: 'chapter_architect',
      methodology:      'methodology_advisor',
      writingPlan:      'writing_planner',
      literatureMap:    'literature_map',
      abstractData:     'abstract_generator',
      instrumentBuilder:'instrument_builder',
    }

    for (const [key, stepType] of Object.entries(stepMap)) {
      const result = saved[key]
      if (result && typeof result === 'object') {
        try {
          await supabaseSaveStep(project.id, stepType, result as Record<string, unknown>)
        } catch { /* skip failed steps — partial migration is acceptable */ }
      }
    }

    if (saved.validatedTopic) {
      await updateProject(project.id, { title: saved.validatedTopic as string })
    }

    showToast('Progress migrated to your account ✓')
  }

  const value: ProjectStateValue = {
    projectId,
    isLoading,
    showMigrationModal,
    dismissMigrationModal,
    confirmMigration,
    saveStep,
    ensureProject,
    resetProject,
  }

  return React.createElement(ProjectStateContext.Provider, { value }, children)
}

export function useProjectState(): ProjectStateValue {
  const ctx = useContext(ProjectStateContext)
  if (!ctx) throw new Error('useProjectState must be used inside ProjectStateProvider')
  return ctx
}
