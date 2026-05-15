import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'
import { AuthContext } from './AuthContext'

const AppContext = createContext(null)

const DEFAULT_STATE = {
  // Onboarding
  name:              '',
  university:        '',
  faculty:           '',
  department:        '',
  level:             '',
  roughTopic:        '',

  // Step 1 — Topic Validator
  topicValidation:   null,
  validatedTopic:    '',

  // Step 2 — Chapter Architect
  structureType:     'standard-5',
  totalWordCount:    0,
  chapterStructure:  null,

  // Step 3 — Methodology Advisor
  methodology:       null,
  chosenMethodology: '',

  // Step 4 — Writing Planner
  submissionDeadline: '',
  writingPlan:        null,

  // Companion cards (embedded in steps — saved separately from main step results)
  literatureMap:      null,
  abstractData:       null,
  instrumentBuilder:  null,

  // Step 5 — Project Reviewer
  uploadedProject:    null,   // { fileName, fileType, reviewData }

  // Step 6 — Defence Prep
  redFlags:           null,
  defenseMode:        'text',
  defenseStarted:     false,
  defenseApiMessages: [],
  defenseDisplayHistory: [],
  defenseSummary:     null,
  defenseQuestionCount: 0,

  // Progress — 6 steps
  stepsCompleted: [false, false, false, false, false, false],
  currentStep:    0,

  // Bookmarks
  bookmarks: [],

  // Cached step results (for back-navigation restore)
  stepResults: {},
}

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('fypro_session')
    if (!raw) return null
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function AppProvider({ children }) {
  const { session } = useContext(AuthContext)
  const [state, setState] = useState(() => {
    const saved = loadFromStorage()
    return saved ? { ...DEFAULT_STATE, ...saved } : DEFAULT_STATE
  })

  // Persist to localStorage on every state change
  useEffect(() => {
    try {
      localStorage.setItem('fypro_session', JSON.stringify(state))
    } catch {
      // Storage full — silent fail
    }
  }, [state])

  // Hydrate faculty/department/level from Supabase whenever the authenticated
  // user changes. Reads session from AuthContext — no direct getSession() call.
  useEffect(() => {
    if (!session?.user) return
    const user = session.user

    async function hydrateFromSupabase() {
      const { data: profile } = await supabase
        .from('users')
        .select('full_name, faculty, department, level')
        .eq('id', user.id)
        .single()

      if (!profile) return

      const metaOnboarded = user.user_metadata?.onboarding_completed === true
      if (metaOnboarded || (profile.faculty && profile.department)) {
        localStorage.setItem('isOnboarded', 'true')
        setOnboardedFlag(true)
      } else {
        localStorage.removeItem('isOnboarded')
        setOnboardedFlag(false)
      }

      setState(prev => ({
        ...prev,
        name:       profile.full_name  ?? prev.name,
        faculty:    profile.faculty    ?? prev.faculty,
        department: profile.department ?? prev.department,
        level:      profile.level      ?? prev.level,
      }))
    }
    hydrateFromSupabase()
  }, [session?.user?.id])

  // Partial merge — used by SplashOnboarding and any component needing a field update
  function set(partial) {
    setState(prev => ({ ...prev, ...partial }))
  }

  function clearState() {
    localStorage.removeItem('fypro_session')
    setState(DEFAULT_STATE)
  }

  // Resets project data only — preserves personal info (name, university, faculty,
  // department, level). Use this when starting a new project, not when signing out.
  function clearProjectData() {
    setState(prev => ({
      ...DEFAULT_STATE,
      name:       prev.name,
      university: prev.university,
      faculty:    prev.faculty,
      department: prev.department,
      level:      prev.level,
    }))
  }

  // Navigate to any accessible step by 0-based index
  function navigateStep(stepIndex) {
    setState(prev => ({ ...prev, currentStep: stepIndex }))
  }

  // Mark step complete, merge any extra fields (e.g. validatedTopic), advance currentStep
  function completeStep(stepIndex, extraFields = {}) {
    setState(prev => {
      const stepsCompleted = [...prev.stepsCompleted]
      stepsCompleted[stepIndex] = true
      return {
        ...prev,
        ...extraFields,
        stepsCompleted,
        currentStep: stepIndex + 1,
      }
    })
  }

  // Mirrors vanilla State.studentContext getter — passed to every API call
  const studentContext = useMemo(() => ({
    university:   state.university,
    faculty:      state.faculty,
    department:   state.department,
    level:        state.level,
    validatedTopic: state.validatedTopic || state.roughTopic,
    methodology:  state.chosenMethodology,
    chapterCount: state.chapterStructure?.total_chapters ?? null,
  }), [
    state.university, state.faculty, state.department, state.level,
    state.validatedTopic, state.roughTopic, state.chosenMethodology,
    state.chapterStructure,
  ])

  const [_onboardedFlag, setOnboardedFlag] = useState(() => localStorage.getItem('isOnboarded') === 'true')

  useEffect(() => {
    function syncOnboarded(e) {
      if (e.key === 'isOnboarded') setOnboardedFlag(e.newValue === 'true')
    }
    window.addEventListener('storage', syncOnboarded)
    return () => window.removeEventListener('storage', syncOnboarded)
  }, [])

  const isOnboarded = _onboardedFlag || Boolean(state.faculty && state.department)

  return (
    <AppContext.Provider value={{
      state,
      set,
      clearState,
      clearProjectData,
      navigateStep,
      completeStep,
      studentContext,
      isOnboarded,
    }}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
