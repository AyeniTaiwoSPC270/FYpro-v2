import { createContext, useContext, useReducer, useCallback, useMemo } from 'react'

const LS_KEY = 'fypro_session'

const DEFAULT_STATE = {
  university: '',
  faculty: '',
  department: '',
  level: '',
  roughTopic: '',
  topicValidation: null,
  validatedTopic: '',
  structureType: 'standard-5',
  totalWordCount: 0,
  chapterStructure: null,
  methodology: null,
  chosenMethodology: '',
  submissionDeadline: '',
  writingPlan: null,
  uploadedProject: null,
  redFlags: null,
  defenseMode: 'text',
  defenseStarted: false,
  defenseApiMessages: [],
  defenseDisplayHistory: [],
  defenseSummary: null,
  defenseQuestionCount: 0,
  stepsCompleted: [false, false, false, false, false, false],
  currentStep: 0,
  bookmarks: [],
  stepResults: {},
}

function loadState() {
  try {
    const raw = localStorage.getItem(LS_KEY)
    if (!raw) return DEFAULT_STATE
    return { ...DEFAULT_STATE, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_STATE
  }
}

function saveState(state) {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(state))
  } catch {}
}

function reducer(state, action) {
  switch (action.type) {
    case 'SET': {
      const next = { ...state, ...action.payload }
      saveState(next)
      return next
    }
    case 'COMPLETE_STEP': {
      const completed = [...state.stepsCompleted]
      completed[action.index] = true
      const next = { ...state, stepsCompleted: completed, currentStep: action.index + 1 }
      saveState(next)
      return next
    }
    case 'NAVIGATE_STEP': {
      const next = { ...state, currentStep: action.index }
      saveState(next)
      return next
    }
    case 'CLEAR': {
      localStorage.removeItem(LS_KEY)
      return { ...DEFAULT_STATE }
    }
    default:
      return state
  }
}

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, undefined, loadState)

  const set = useCallback((payload) => dispatch({ type: 'SET', payload }), [])
  const completeStep = useCallback((index) => dispatch({ type: 'COMPLETE_STEP', index }), [])
  const navigateStep = useCallback((index) => dispatch({ type: 'NAVIGATE_STEP', index }), [])
  const clearState = useCallback(() => dispatch({ type: 'CLEAR' }), [])

  const isOnboarded = Boolean(
    state.university && state.faculty && state.department && state.level
  )

  const studentContext = useMemo(() => ({
    university: state.university,
    faculty: state.faculty,
    department: state.department,
    level: state.level,
    roughTopic: state.roughTopic,
    validatedTopic: state.validatedTopic,
    methodology: state.chosenMethodology,
    chapterCount: state.chapterStructure?.chapters?.length ?? 0,
  }), [state.university, state.faculty, state.department, state.level, state.roughTopic, state.validatedTopic, state.chosenMethodology, state.chapterStructure])

  const value = useMemo(() => ({
    state,
    set,
    completeStep,
    navigateStep,
    clearState,
    isOnboarded,
    studentContext,
  }), [state, set, completeStep, navigateStep, clearState, isOnboarded, studentContext])

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
