import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { ProjectStateContext } from '../../hooks/useProjectState'
import { useApp } from '../../context/AppContext'
import { useUser } from '../../hooks/useUser'
import { usePaidFeatures } from '../../hooks/usePaidFeatures'
import { getExpressProject, createExpressProject, saveStep as supabaseSaveStep, updateProject, getUserProfile } from '../../lib/db'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'

async function withRetry(fn, delays = [1000, 3000]) {
  let lastErr
  for (let i = 0; i <= delays.length; i++) {
    try { return await fn() } catch (err) {
      lastErr = err
      if (i < delays.length) await new Promise(r => setTimeout(r, delays[i]))
    }
  }
  throw lastErr
}

// Two provider mounts racing (e.g. /express → /express/run) both saw "no project" and
// both inserted one, leaving users with duplicate blank express projects. Share the
// lookup-or-create across concurrent callers.
const ensureInFlight = new Map()

function ensureExpressProject(userId) {
  let pending = ensureInFlight.get(userId)
  if (!pending) {
    pending = (async () => {
      const existing = await getExpressProject(userId)
      if (existing) return existing
      return createExpressProject({ title: null, faculty: null, department: null, level: null })
    })()
    ensureInFlight.set(userId, pending)
    pending.finally(() => ensureInFlight.delete(userId))
  }
  return pending
}

// Lean ProjectState provider for the Express app. Loads the single express
// project (mode='express') and routes saveStep to it. No 6-step machinery,
// no migration modal — Express tracks its own 3-step model in AppContext state.
export default function ExpressProjectStateProvider({ children }) {
  const { set } = useApp()
  const { user, loading: authLoading } = useUser()
  const { features, loading: featuresLoading } = usePaidFeatures()
  const navigate = useNavigate()
  const isEntitled = features.includes('express_defense')
  const [projectId, setProjectId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])

  useEffect(() => {
    if (authLoading || featuresLoading) return
    let cancelled = false
    async function load() {
      if (!user?.id) { setProjectId(null); setIsLoading(false); return }
      setIsLoading(true)
      let project = await getExpressProject(user.id)
      if (!project && !cancelled) {
        // RequireExpress lets EVERY user through while the free beta is on, so landing
        // here without an express project no longer implies the user wants Express —
        // it used to, and auto-creating turned standard users into express users.
        // Only a user holding the entitlement gets a project made for them (e.g. an
        // admin grant); everyone else is sent to onboarding, which is where an express
        // project is legitimately created.
        if (!isEntitled) {
          navigate('/express-onboarding', { replace: true })
          return
        }
        project = await ensureExpressProject(user.id)
      }
      if (cancelled) return
      const profile = await getUserProfile(user.id)
      if (project) {
        setProjectId(project.id)
        const hydration = {}
        if (project.title) hydration.validatedTopic = project.title
        if (project.faculty) hydration.faculty = project.faculty
        if (project.department) hydration.department = project.department
        if (project.level) hydration.level = project.level
        if (profile?.full_name)   hydration.name       = profile.full_name
        if (profile?.university)  hydration.university = profile.university
        hydration.avatarUrl = profile?.avatar_url ?? null
        // Profile fields override project row — users update these via /profile, not project settings
        if (profile?.faculty)     hydration.faculty    = profile.faculty
        if (profile?.department)  hydration.department = profile.department
        if (profile?.level)       hydration.level      = profile.level

        const { data: steps } = await supabase
          .from('project_steps')
          .select('step_type, result_json')
          .eq('project_id', project.id)
          .eq('user_id', user.id)

        const expressSteps = { red_flag: false, project_reviewer: false, defense_brief: false, defense: false }
        for (const s of steps ?? []) {
          if (s.step_type === 'express_context') {
            if (s.result_json?.methodology) hydration.chosenMethodology = s.result_json.methodology
            if (s.result_json?.chapterCount) hydration.chapterStructure = { total_chapters: s.result_json.chapterCount }
          }
          if (s.step_type === 'red_flag_detector') {
            expressSteps.red_flag = true
            hydration.redFlags = Array.isArray(s.result_json?.flags) ? s.result_json.flags : null
          }
          if (s.step_type === 'project_reviewer') {
            expressSteps.project_reviewer = true
            hydration.uploadedProject = {
              fileName: s.result_json?.fileName || s.result_json?.file_name || 'Uploaded document',
              reviewData: s.result_json?.reviewData ?? s.result_json,
            }
          }
          if (s.step_type === 'defense_brief') {
            expressSteps.defense_brief = true
            if (!s.result_json?.skipped) {
              hydration.defenseBrief = s.result_json
            }
          }
          if (s.step_type === 'defense_prep') {
            expressSteps.defense = true
            hydration.defenseSummary = s.result_json
          }
        }
        hydration.expressSteps = expressSteps
        set(hydration)
      } else {
        setProjectId(null)
      }
      setIsLoading(false)
    }
    load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id, authLoading, featuresLoading, isEntitled])

  const saveStep = useCallback(async (stepType, resultJson, inputSummary) => {
    if (!projectId) return
    try {
      await withRetry(() => supabaseSaveStep(projectId, stepType, resultJson, inputSummary))
      updateProject(projectId, {}).catch(() => {})
    } catch (err) {
      console.error('[ExpressProjectState] saveStep:', err)
      showToast('Failed to save — check your connection and try again', 'error')
    }
  }, [projectId])

  const noop = useCallback(async () => {}, [])

  const value = {
    projectId,
    isLoading,
    isOfflineMode: false,
    showMigrationModal: false,
    dismissMigrationModal: () => {},
    confirmMigration: noop,
    saveStep,
    ensureProject: async () => projectId,
    resetProject: noop,
    selectProject: noop,
  }

  return <ProjectStateContext.Provider value={value}>{children}</ProjectStateContext.Provider>
}
