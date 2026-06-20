import { useEffect, useRef, useState, useCallback } from 'react'
import { ProjectStateContext } from '../../hooks/useProjectState'
import { useApp } from '../../context/AppContext'
import { useUser } from '../../hooks/useUser'
import { getExpressProject, createExpressProject, saveStep as supabaseSaveStep, updateProject } from '../../lib/db'
import { supabase } from '../../lib/supabase'

// Lean ProjectState provider for the Express app. Loads the single express
// project (mode='express') and routes saveStep to it. No 6-step machinery,
// no migration modal — Express tracks its own 3-step model in AppContext state.
export default function ExpressProjectStateProvider({ children }) {
  const { set } = useApp()
  const { user, loading: authLoading } = useUser()
  const [projectId, setProjectId] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const userRef = useRef(user)
  useEffect(() => { userRef.current = user }, [user])

  useEffect(() => {
    if (authLoading) return
    let cancelled = false
    async function load() {
      if (!user?.id) { setProjectId(null); setIsLoading(false); return }
      setIsLoading(true)
      let project = await getExpressProject(user.id)
      // Entitled user landed on /express with no express project (e.g. granted
      // access via admin, or arrived without going through onboarding). The
      // provider only mounts under RequireExpress, so reaching here means the
      // user is entitled — create a blank express project so projectId exists
      // and saveStep works. Details get filled in via /express-onboarding.
      if (!project && !cancelled) {
        project = await createExpressProject({ title: null, faculty: null, department: null, level: null })
      }
      if (cancelled) return
      if (project) {
        setProjectId(project.id)
        const hydration = {}
        if (project.title) hydration.validatedTopic = project.title
        if (project.faculty) hydration.faculty = project.faculty
        if (project.department) hydration.department = project.department
        if (project.level) hydration.level = project.level

        const { data: steps } = await supabase
          .from('project_steps')
          .select('step_type, result_json')
          .eq('project_id', project.id)
          .eq('user_id', user.id)

        const expressSteps = { red_flag: false, project_reviewer: false, defense_brief: false, defense: false }
        for (const s of steps ?? []) {
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
  }, [user?.id, authLoading])

  const saveStep = useCallback(async (stepType, resultJson, inputSummary) => {
    if (!projectId) return
    try {
      await supabaseSaveStep(projectId, stepType, resultJson, inputSummary)
      await updateProject(projectId, {}) // bumps updated_at for resume ordering
    } catch (err) {
      console.error('[ExpressProjectState] saveStep:', err)
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
