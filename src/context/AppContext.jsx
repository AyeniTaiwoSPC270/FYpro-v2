import { createContext, useContext, useState, useEffect, useMemo } from 'react'
import { supabase } from '../lib/supabase'

const AppContext = createContext(null)

const DEFAULT_STATE = {
  // Onboarding
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

  // Hydrate faculty/department/level from Supabase on mount — falls back to localStorage values if null
  useEffect(() => {
    async function hydrateFromSupabase() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data: profile } = await supabase
        .from('users')
        .select('faculty, department, level')
        .eq('id', user.id)
        .single()

      if (!profile) return

      if (profile.faculty && profile.department) {
        localStorage.setItem('isOnboarded', 'true')
      } else {
        localStorage.removeItem('isOnboarded')
      }

      setState(prev => ({
        ...prev,
        faculty:    profile.faculty    ?? prev.faculty,
        department: profile.department ?? prev.department,
        level:      profile.level      ?? prev.level,
      }))
    }
    hydrateFromSupabase()
  }, [])

  // Partial merge — used by SplashOnboarding and any component needing a field update
  function set(partial) {
    setState(prev => ({ ...prev, ...partial }))
  }

  function clearState() {
    localStorage.removeItem('fypro_session')
    setState(DEFAULT_STATE)
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

  const isOnboarded = localStorage.getItem('isOnboarded') === 'true' || Boolean(state.faculty && state.department)

  return (
    <AppContext.Provider value={{
      state,
      set,
      clearState,
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
