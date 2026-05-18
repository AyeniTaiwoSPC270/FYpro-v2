import { createContext, useContext, useState, useEffect, useMemo, useRef, useCallback } from 'react'
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

// Every localStorage key the app writes for a specific user.
// cookie_consent and fypro_theme are intentionally excluded — they're device preferences, not user data.
const USER_STORAGE_KEYS = [
  'fypro_session',
  'fypro_session_owner',
  'isOnboarded',
  'fypro_run_counts',
  'fypro_autosave_topic_validator',
  'fypro_autosave_chapter_architect',
  'fypro_autosave_supervisor_prep',
  'fypro_autosave_writing_planner',
  'fypro_routing_v1',
  'fypro_sync_queue',
  'fypro_feedback_given',
  'fypro_ref_code',
  'fypro_ref_expiry',
]

export function clearUserLocalStorage() {
  USER_STORAGE_KEYS.forEach(key => {
    try { localStorage.removeItem(key) } catch {}
  })
  try { sessionStorage.clear() } catch {}
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

function loadFromStorage() {
  try {
    const raw = localStorage.getItem('fypro_session')
    if (!raw) return null
    const storedOwner     = localStorage.getItem('fypro_session_owner')
    const currentAuthUser = getCurrentAuthUserId()
    // Reject the saved session when we know who is logged in and either:
    // - the session belongs to a different user, OR
    // - the session has no owner tag (could be stale from a pre-fix deployment).
    // Both cases are cleared to prevent one user seeing another's data.
    if (currentAuthUser && (!storedOwner || currentAuthUser !== storedOwner)) {
      localStorage.removeItem('fypro_session')
      localStorage.removeItem('fypro_session_owner')
      return null
    }
    return JSON.parse(raw)
  } catch {
    return null
  }
}

export function AppProvider({ children }) {
  const { session } = useContext(AuthContext)
  const [state, setState] = useState(() => {
    // Skip localStorage for authenticated users — Supabase hydration will populate real data.
    // Prevents a flash of stale session data before hydrateFromSupabase() runs.
    if (getCurrentAuthUserId()) return DEFAULT_STATE
    const saved = loadFromStorage()
    return saved ? { ...DEFAULT_STATE, ...saved } : DEFAULT_STATE
  })
  const [hydrateError, setHydrateError] = useState(false)
  const [_hydrateRetryCount, setHydrateRetryCount] = useState(0)

  // Persist to localStorage on every state change
  useEffect(() => {
    try {
      localStorage.setItem('fypro_session', JSON.stringify(state))
    } catch {
      // Storage full — silent fail
    }
  }, [state])

  // Stamp the session owner so loadFromStorage() can reject it for a different user
  useEffect(() => {
    if (session?.user?.id) {
      try { localStorage.setItem('fypro_session_owner', session.user.id) } catch {}
    }
  }, [session?.user?.id])

  // Tracks the user ID from the previous render to detect mid-session user switches
  // (e.g. User A signs out and User B signs in without a page reload).
  const prevUserIdRef = useRef(null)

  // Hydrate faculty/department/level from Supabase whenever the authenticated
  // user changes. Reads session from AuthContext — no direct getSession() call.
  // _hydrateRetryCount in the dep array lets retryHydrate() force a re-run.
  useEffect(() => {
    if (!session?.user) {
      prevUserIdRef.current = null
      return
    }
    const user = session.user

    setHydrateError(false)

    // Mid-session user switch: clear all stale data before loading the new user.
    // The page-reload case is handled by loadFromStorage() rejecting the stale
    // fypro_session when its fypro_session_owner doesn't match the auth user.
    if (prevUserIdRef.current !== null && prevUserIdRef.current !== user.id) {
      clearUserLocalStorage()
      setState(DEFAULT_STATE)
      setOnboardedFlag(false)
    }
    prevUserIdRef.current = user.id

    async function hydrateFromSupabase() {
      const { data: profile } = await supabase
        .from('users')
        .select('full_name, faculty, department, level')
        .eq('id', user.id)
        .maybeSingle()

      if (!profile) {
        setOnboardingResolved(true)
        return
      }

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
        // Prefer DB name; fall back to Google/OAuth metadata; never inherit a previous user's name
        name:       profile.full_name ?? user.user_metadata?.full_name ?? '',
        faculty:    profile.faculty    ?? prev.faculty,
        department: profile.department ?? prev.department,
        level:      profile.level      ?? prev.level,
      }))

      setOnboardingResolved(true)
    }
    hydrateFromSupabase().catch(err => {
      console.error('[AppContext] hydrateFromSupabase failed:', err?.message)
      setHydrateError(true)
      setOnboardingResolved(true) // unblock on error — localStorage cache is the fallback
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user?.id, _hydrateRetryCount])

  const retryHydrate = useCallback(() => {
    setHydrateRetryCount(c => c + 1)
  }, [])

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
    hydrateError,
    retryHydrate,
  }), [state, set, clearState, clearProjectData, navigateStep, completeStep, studentContext, isOnboarded, onboardingResolved, hydrateError, retryHydrate])

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  return useContext(AppContext)
}
