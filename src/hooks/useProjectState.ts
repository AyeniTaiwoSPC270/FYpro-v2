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
} from '../lib/db'
import { enqueue, getStatus } from '../lib/sync-queue'
import {
  persistSnapshot,
  patchSnapshotStep,
  readSnapshot,
  clearSnapshot,
} from '../lib/offline-snapshot'
// AppContext is a plain-JS file (allowJs). TypeScript infers useApp() → null
// from createContext(null). Declare the subset this file actually uses so the
// compiler can check it correctly without requiring as any.
interface AppContextValue {
  state: {
    faculty: string
    department: string
    level: string
    validatedTopic: string
    roughTopic: string
    [key: string]: unknown
  }
  set: (partial: Record<string, unknown>) => void
  markOnboardingResolved: (opts?: { faculty?: string; department?: string; metaOnboarded?: boolean }) => void
}
import { useApp as _useApp } from '../context/AppContext'
const useApp = _useApp as unknown as () => AppContextValue
import { useUser } from './useUser'
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
  red_flag_detector:   'redFlags',
  defense_prep:        'defenseSummary',
}

// Steps whose result_json shape differs from the AppContext state value.
// red_flag_detector is saved as { flags: [...] } but state.redFlags is the array.
// project_reviewer is saved flat but AppContext expects { fileName, reviewData }.
function resolveStepResult(stepType: string, resultJson: Record<string, unknown>): unknown {
  if (stepType === 'red_flag_detector') {
    return Array.isArray(resultJson?.flags) ? resultJson.flags : null
  }
  if (stepType === 'project_reviewer') {
    if (resultJson?.skipped) return null
    // Support both the old nested format { reviewData, file_name } and the new flat format { fileName, grade, ... }
    const reviewData = (resultJson?.reviewData as Record<string, unknown>) ?? resultJson
    const fileName = (resultJson?.fileName as string)
      || (resultJson?.file_name as string)
      || 'Uploaded document'
    return { fileName, reviewData }
  }
  return resultJson
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

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('load_timeout')), ms)
    }),
  ]).finally(() => clearTimeout(timer))
}

// ─── Context ──────────────────────────────────────────────────────────────────

interface ProjectStateValue {
  projectId: string | null
  isLoading: boolean
  isOfflineMode: boolean
  showMigrationModal: boolean
  dismissMigrationModal: () => void
  confirmMigration: () => void
  saveStep: (stepType: string, resultJson: Record<string, unknown>, inputSummary?: string) => Promise<void>
  ensureProject: () => Promise<string | null>
  resetProject: () => Promise<void>
  selectProject: (projectId: string) => Promise<void>
}

const ProjectStateContext = createContext<ProjectStateValue | null>(null)

// ─── Provider ─────────────────────────────────────────────────────────────────

export function ProjectStateProvider({ children }: { children: ReactNode }) {
  const { set, state, markOnboardingResolved } = useApp()
  const { user, loading: authLoading } = useUser()
  const [projectId, setProjectId] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [showMigrationModal, setShowMigrationModal] = useState(false)
  const [isOfflineMode, setIsOfflineMode] = useState(false)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)
  const stateRef = useRef(state)
  const userRef = useRef(user)

  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => { userRef.current = user }, [user])

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
        if (stateKey) set({ [stateKey]: resolveStepResult(row.step_type as string, row.result_json as Record<string, unknown>) })
      }
    ).subscribe()
    channelRef.current = ch
  }

  // Initial load: triggered by AuthContext resolving the user identity.
  // No getSession() call here — user comes from the single auth context instance,
  // eliminating Web Lock contention with AuthProvider's own getSession() call.
  useEffect(() => {
    if (authLoading) return  // wait for AuthProvider to finish its single getSession()

    let cancelled = false

    async function load(userId: string | null) {
      if (!userId) {
        setProjectId(null)
        if (channelRef.current) {
          supabase.removeChannel(channelRef.current)
          channelRef.current = null
        }
        setIsLoading(false)
        markOnboardingResolved({})
        return
      }

      setIsLoading(true)
      try {
        const userState = await withTimeout(loadUserState(userId), 5000)
        if (cancelled) return

        // Persist snapshot for offline fallback before hydrating
        setIsOfflineMode(false)
        persistSnapshot(userId, userState)

        const hydration: Record<string, unknown> = {}

        if (userState.profile) {
          const name = userState.profile.full_name
            ?? (userRef.current?.user_metadata?.full_name as string | undefined)
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
        } else {
          setProjectId(null)
        }

        // Always derive stepsCompleted from Supabase for authenticated users —
        // prevents stale localStorage values bleeding through on refresh.
        const completed = [false, false, false, false, false, false]
        for (const step of userState.steps) {
          const key = STEP_TO_STATE[step.step_type]
          if (key) hydration[key] = resolveStepResult(step.step_type, step.result_json)
          const idx = STEP_TO_IDX[step.step_type]
          if (idx !== undefined) completed[idx] = true
        }
        hydration.stepsCompleted = completed
        const last = completed.lastIndexOf(true)
        hydration.currentStep = last !== -1 ? Math.min(last + 1, 5) : 0

        if (Object.keys(hydration).length > 0) set(hydration)

        markOnboardingResolved({
          faculty:       userState.profile?.faculty    ?? undefined,
          department:    userState.profile?.department ?? undefined,
          metaOnboarded: userRef.current?.user_metadata?.onboarding_completed === true,
        })

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

        // Supabase unreachable or timed out — attempt snapshot fallback
        const snapshot = readSnapshot(userId)
        if (snapshot) {
          const hydration: Record<string, unknown> = {}

          if (snapshot.profile) {
            const name = snapshot.profile.full_name
              ?? (userRef.current?.user_metadata?.full_name as string | undefined)
              ?? null
            if (name) hydration.name = name
            if (snapshot.profile.faculty)    hydration.faculty    = snapshot.profile.faculty
            if (snapshot.profile.department) hydration.department = snapshot.profile.department
            if (snapshot.profile.level)      hydration.level      = snapshot.profile.level
          }

          if (snapshot.project) {
            setProjectId(snapshot.project.id)
            if (snapshot.project.title) hydration.validatedTopic = snapshot.project.title
            // Do NOT call subscribeToProject — we are offline
          }

          const completed = [false, false, false, false, false, false]
          for (const step of snapshot.steps) {
            const key = STEP_TO_STATE[step.step_type]
            if (key) hydration[key] = resolveStepResult(step.step_type, step.result_json)
            const idx = STEP_TO_IDX[step.step_type]
            if (idx !== undefined) completed[idx] = true
          }
          hydration.stepsCompleted = completed
          const last = completed.lastIndexOf(true)
          hydration.currentStep = last !== -1 ? Math.min(last + 1, 5) : 0

          if (Object.keys(hydration).length > 0) set(hydration)

          markOnboardingResolved({
            faculty:       snapshot.profile?.faculty    ?? undefined,
            department:    snapshot.profile?.department ?? undefined,
            metaOnboarded: userRef.current?.user_metadata?.onboarding_completed === true,
          })

          setIsOfflineMode(true)
        } else {
          markOnboardingResolved({})  // fail open — unblock navigation
        }
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    load(user?.id ?? null)

    return () => {
      cancelled = true
      if (!user?.id && channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribeToProject and set are stable refs; authLoading only matters for the initial gate
  }, [user?.id, authLoading])

  const ensureProject = useCallback(async (): Promise<string | null> => {
    if (projectId) return projectId
    if (!userRef.current) return null

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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribeToProject and set are stable memoized refs; only projectId is a true dependency
  }, [projectId])

  const saveStep = useCallback(async (
    stepType: string,
    resultJson: Record<string, unknown>,
    inputSummary?: string
  ): Promise<void> => {
    const pid = projectId ?? await ensureProject()

    // Update offline snapshot immediately — result is available regardless of network
    if (userRef.current?.id) patchSnapshotStep(userRef.current.id, stepType, resultJson)

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
          const projectUpdates: Partial<Pick<import('../lib/db').Project, 'title' | 'current_step' | 'status'>> = {
            current_step: NEXT_STEP[stepType],
          }
          if (stepType === 'topic_validator' && resultJson.refined_topic) {
            projectUpdates.title = resultJson.refined_topic as string
          }
          updateProject(pid, projectUpdates).catch(() => {})
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
    if (userRef.current) {
      try {
        await deleteAllUserData(userRef.current.id)
      } catch (err) {
        console.error('[resetProject] delete failed', err)
      }
    }
    clearSnapshot()
    setProjectId(null)
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }
  }

  // Load a specific project by ID and hydrate AppContext.
  // Called when the user picks a project from the dashboard grid.
  const selectProject = useCallback(async (pid: string): Promise<void> => {
    const currentUser = userRef.current
    if (!currentUser) return

    const [projectRes, stepsRes] = await Promise.all([
      supabase.from('projects').select('*').eq('id', pid).eq('user_id', currentUser.id).single(),
      supabase.from('project_steps').select('*').eq('project_id', pid).eq('user_id', currentUser.id),
    ])
    if (projectRes.error || !projectRes.data) {
      console.error('[useProjectState] selectProject: project not found or unauthorized', pid)
      return
    }

    const project = projectRes.data as import('../lib/db').Project
    if (project.user_id !== currentUser.id) {
      console.error('[useProjectState] selectProject: ownership mismatch', pid)
      return
    }
    const steps = (stepsRes.data as import('../lib/db').ProjectStep[]) ?? []

    const hydration: Record<string, unknown> = {}
    if (project.title) hydration.validatedTopic = project.title

    const completed = [false, false, false, false, false, false]
    for (const step of steps) {
      const key = STEP_TO_STATE[step.step_type]
      if (key) hydration[key] = resolveStepResult(step.step_type, step.result_json)
      const idx = STEP_TO_IDX[step.step_type]
      if (idx !== undefined) completed[idx] = true
    }
    hydration.stepsCompleted = completed
    const last = completed.lastIndexOf(true)
    hydration.currentStep = last !== -1 ? Math.min(last + 1, 5) : 0

    set(hydration)
    setProjectId(pid)
    subscribeToProject(pid)
  // eslint-disable-next-line react-hooks/exhaustive-deps -- subscribeToProject and set are stable refs
  }, [])

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
    isOfflineMode,
    showMigrationModal,
    dismissMigrationModal,
    confirmMigration,
    saveStep,
    ensureProject,
    resetProject,
    selectProject,
  }

  return React.createElement(ProjectStateContext.Provider, { value }, children)
}

export function useProjectState(): ProjectStateValue {
  const ctx = useContext(ProjectStateContext)
  if (!ctx) throw new Error('useProjectState must be used inside ProjectStateProvider')
  return ctx
}
