// Auth-scoped Supabase helpers.
// service_role is NEVER imported here — all calls use the anon-key client.
// Every read is automatically scoped to the authenticated user by RLS.

import { supabase } from './supabase'

// ─── Types matching architecture-decisions.md ───────────────────────────────

export interface UserProfile {
  id: string
  email: string
  full_name: string | null
  faculty: string | null
  department: string | null
  level: string | null
  role: 'student' | 'supervisor' | 'admin'
  institution_id: string | null
  created_at: string
  updated_at: string
}

export interface UserEntitlements {
  user_id: string
  paid_features: string[]
  paid_until: string | null
  defense_packs_remaining: number
  total_lifetime_paid_ngn: number
  updated_at: string
}

export interface Project {
  id: string
  user_id: string
  title: string | null
  status: 'draft' | 'in_progress' | 'defense_ready' | 'archived'
  current_step: string
  faculty: string | null
  department: string | null
  level: string | null
  supervisor_id: string | null
  institution_id: string | null
  created_at: string
  updated_at: string
}

export interface ProjectStep {
  id: string
  project_id: string
  user_id: string
  step_type: string
  result_json: Record<string, unknown>
  input_summary: string | null
  created_at: string
}

export interface UserState {
  profile: UserProfile | null
  entitlements: UserEntitlements | null
  project: Project | null
  steps: ProjectStep[]
}

// ─── Load all state on app init ─────────────────────────────────────────────

export async function loadUserState(): Promise<UserState> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { profile: null, entitlements: null, project: null, steps: [] }

  const [profileRes, entitlementsRes, projectRes] = await Promise.all([
    supabase.from('users').select('*').eq('id', user.id).single(),
    supabase.from('user_entitlements').select('*').eq('user_id', user.id).maybeSingle(),
    supabase
      .from('projects')
      .select('*')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const profile = (profileRes.data as UserProfile) ?? null
  const entitlements = (entitlementsRes.data as UserEntitlements) ?? null
  const project = (projectRes.data as Project) ?? null

  let steps: ProjectStep[] = []
  if (project) {
    const { data } = await supabase
      .from('project_steps')
      .select('*')
      .eq('project_id', project.id)
    steps = (data as ProjectStep[]) ?? []
  }

  return { profile, entitlements, project, steps }
}

// ─── Project CRUD ────────────────────────────────────────────────────────────

export async function createProject(data: {
  faculty: string | null
  department: string | null
  level: string | null
}): Promise<Project | null> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: project, error } = await supabase
    .from('projects')
    .insert({
      user_id: user.id,
      status: 'draft',
      current_step: 'topic_validator',
      faculty: data.faculty,
      department: data.department,
      level: data.level,
    })
    .select()
    .single()

  if (error) {
    console.error('[supabase-client] createProject:', error.message)
    return null
  }
  return project as Project
}

export async function updateProject(
  projectId: string,
  updates: Partial<Pick<Project, 'title' | 'current_step' | 'status'>>
): Promise<void> {
  const { error } = await supabase
    .from('projects')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', projectId)

  if (error) console.error('[supabase-client] updateProject:', error.message)
}

// ─── Step upsert ─────────────────────────────────────────────────────────────

export async function saveStep(
  projectId: string,
  stepType: string,
  resultJson: Record<string, unknown>,
  inputSummary?: string
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) throw new Error('Not authenticated')

  const { error } = await supabase
    .from('project_steps')
    .upsert(
      {
        project_id: projectId,
        user_id: user.id,
        step_type: stepType,
        result_json: resultJson,
        input_summary: inputSummary ?? null,
      },
      { onConflict: 'project_id,step_type' }
    )

  if (error) {
    console.error('[supabase-client] saveStep:', error.message)
    throw error
  }
}

// ─── Project delete ──────────────────────────────────────────────────────────

export async function deleteProject(projectId: string, userId: string): Promise<void> {
  await supabase
    .from('project_steps')
    .delete()
    .eq('project_id', projectId)
    .eq('user_id', userId)

  await supabase
    .from('projects')
    .delete()
    .eq('id', projectId)
    .eq('user_id', userId)
}

export async function deleteAllUserData(userId: string): Promise<void> {
  const { error: stepsError } = await supabase
    .from('project_steps')
    .delete()
    .eq('user_id', userId)

  if (stepsError) console.error('[resetProject] delete failed', stepsError)

  const { error: projectsError } = await supabase
    .from('projects')
    .delete()
    .eq('user_id', userId)

  if (projectsError) console.error('[resetProject] delete failed', projectsError)
}

// ─── Profile update ──────────────────────────────────────────────────────────

export async function updateUserProfile(
  updates: Partial<Pick<UserProfile, 'full_name' | 'faculty' | 'department' | 'level'>>
): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const { error } = await supabase
    .from('users')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) console.error('[supabase-client] updateUserProfile:', error.message)
}
