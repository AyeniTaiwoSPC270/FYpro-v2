import { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react'
import { AuthContext } from './AuthContext'
import { USER_STORAGE_KEYS, clearUserLocalStorage } from '../lib/storage'

export const AppContext = createContext(null)

const DEFAULT_STATE = {
  // Onboarding
  name:              '',
  avatarUrl:         null,
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

  // Express — Defence Brief
  defenseBrief:       null,   // { openingStatement, weakSpots, examinerQas } | null

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


// Reads the Supabase-managed session user ID synchronously from localStorage.
// Used to guard fypro_session on mount before async auth resolves.
function getCurrentAuthUserId() {
  try {
    const sbKey = Object.keys(localStorage).find(
      k => k.startsWith('sb-') && k.endsWith('-auth-token')
    )
    if (!sbKey) return null
    const parsed = JSON.parse(localStorage.getItem(sbKey) ?? 'null')
    return parsed?.user?.id ?? null
  } catch {
    return null
  }
}

function loadFromStorage(storageKey) {
  try {
    const ownerKey = `${storageKey}_owner`
    const raw = localStorage.getItem(storageKey)
    if (!raw) return null
    const storedOwner     = localStorage.getItem(ownerKey)
    const currentAuthUser = getCurrentAuthUserId()
    // Reject the saved session when we know who is logged in and either:
    // - the session belongs to a different user, OR
    // - the session has no owner tag (could be stale from a pre-fix deployment).
    // Both cases are cleared to prevent one user seeing another's data.
    if (currentAuthUser && (!storedOwner || currentAuthUser !== storedOwner)) {
      localStorage.removeItem(storageKey)
      localStorage.removeItem(ownerKey)
      return null
    }
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function AppProvider({ children, storageKey = 'fypro_session', isExpress = false }) {
  const { session } = useContext(AuthContext)
  const [state, setState] = useState(() => {
    // Skip localStorage for authenticated users — ProjectStateProvider will populate real data.
    if (getCurrentAuthUserId()) return DEFAULT_STATE
    const saved = loadFromStorage(storageKey)
    return saved ? { ...DEFAULT_STATE, ...saved } : DEFAULT_STATE
  })
  // Persist to localStorage on every state change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(state))
    } catch {
      // Storage full — silent fail
    }
  }, [state, storageKey])

  // Stamp the session owner so loadFromStorage() can reject it for a different user
  useEffect(() => {
    if (session?.user?.id) {
      try { localStorage.setItem(`${storageKey}_owner`, session.user.id) } catch {}
    }
  }, [session?.user?.id, storageKey])

  // Partial merge — used by SplashOnboarding and any component needing a field update
  const set = useCallback((partial) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])

  const clearState = useCallback(() => {
    clearUserLocalStorage()
    setState(DEFAULT_STATE)
  }, [])

  // Resets project data only — preserves personal info (name, university, faculty,
  // department, level). Use this when starting a new project, not when signing out.
  const clearProjectData = useCallback(() => {
    setState(prev => ({
      ...DEFAULT_STATE,
      name:       prev.name,
      university: prev.university,
      faculty:    prev.faculty,
      department: prev.department,
      level:      prev.level,
    }))
  }, [])

  // Navigate to any accessible step by 0-based index
  const navigateStep = useCallback((stepIndex) => {
    setState(prev => ({ ...prev, currentStep: stepIndex }))
  }, [])

  // Mark step complete, merge any extra fields (e.g. validatedTopic), advance currentStep
  const completeStep = useCallback((stepIndex, extraFields = {}) => {
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
  }, [])

  const markOnboardingResolved = useCallback(({
    faculty,
    department,
    metaOnboarded = false,
  } = {}) => {
    const shouldMark = metaOnboarded === true || Boolean(faculty && department)
    if (shouldMark) {
      try { localStorage.setItem('isOnboarded', 'true') } catch {}
      setOnboardedFlag(true)
    } else {
      try { localStorage.removeItem('isOnboarded') } catch {}
      setOnboardedFlag(false)
    }
    setOnboardingResolved(true)
  }, [])

  // Mirrors vanilla State.studentContext getter — passed to every API call
  const studentContext = useMemo(() => ({
    university:     state.university,
    faculty:        state.faculty,
    department:     state.department,
    level:          state.level,
    validatedTopic: state.validatedTopic || state.roughTopic,
    methodology:    state.chosenMethodology,
    chapterCount:   state.chapterStructure?.total_chapters ?? null,
    totalWordCount: state.chapterStructure?.total_word_count ?? state.totalWordCount ?? null,
  }), [
    state.university, state.faculty, state.department, state.level,
    state.validatedTopic, state.roughTopic, state.chosenMethodology,
    state.chapterStructure, state.totalWordCount,
  ])

  const [_onboardedFlag, setOnboardedFlag] = useState(() => localStorage.getItem('isOnboarded') === 'true')

  // True once hydrateFromSupabase() has completed (success or error) for the
  // current session. Starts false when a Supabase session exists in localStorage
  // so that redirect guards wait for the authoritative server value instead of
  // acting on a stale (or absent) localStorage cache.
  const [onboardingResolved, setOnboardingResolved] = useState(() => !getCurrentAuthUserId())

  useEffect(() => {
    function syncOnboarded(e) {
      if (e.key === 'isOnboarded') setOnboardedFlag(e.newValue === 'true')
    }
    window.addEventListener('storage', syncOnboarded)
    return () => window.removeEventListener('storage', syncOnboarded)
  }, [])

  const isOnboarded = _onboardedFlag || Boolean(state.faculty && state.department)

  const contextValue = useMemo(() => ({
    state,
    set,
    clearState,
    clearProjectData,
    navigateStep,
    completeStep,
    studentContext,
    isOnboarded,
    onboardingResolved,
    markOnboardingResolved,
    isExpress,
  }), [state, set, clearState, clearProjectData, navigateStep, completeStep, studentContext, isOnboarded, onboardingResolved, markOnboardingResolved, isExpress])

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
