import { useEffect, useState, Fragment } from 'react'
import { AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { useProjectState } from '../../hooks/useProjectState'
import OfflineBanner from '../../components/OfflineBanner'
import AnonymousMigrationModal from '../../components/AnonymousMigrationModal'
import TopicValidator from '../topicValidator/TopicValidator'
import ChapterArchitect from '../chapterArchitect/ChapterArchitect'
import MethodologyAdvisor from '../methodology/MethodologyAdvisor'
import WritingPlanner from '../writingPlanner/WritingPlanner'
import ProjectReviewer from '../projectReviewer/ProjectReviewer'
import DefensePrep from '../defensePrep/DefensePrep'
import SupervisorEmail from '../supervisorEmail/SupervisorEmail'

const STEPS = [
  'Topic Validator',
  'Chapter Architect',
  'Methodology Advisor',
  'Writing Planner',
  'Project Reviewer',
  'Defence Prep',
]

// Placeholder for steps not yet converted to React
function StepPlaceholder({ stepIndex }) {
  return (
    <div className="placeholder-card">
      <p className="placeholder-card__step-label">
        Step {stepIndex + 1}: {STEPS[stepIndex]}
      </p>
      <p className="placeholder-card__subtitle">Coming soon.</p>
    </div>
  )
}

const STEP_COMPONENTS = [
  TopicValidator,
  ChapterArchitect,
  MethodologyAdvisor,
  WritingPlanner,
  ProjectReviewer,
  DefensePrep,
]

const CHECK_PATH = 'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z'
const LOCK_PATH  = 'M208,80H168V56a40,40,0,0,0-80,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM104,56a24,24,0,0,1,48,0V80H104Zm104,152H48V96H208V208Zm-80-48a8,8,0,1,1-8-8A8,8,0,0,1,136,160Z'


export default function AppShell() {
  const navigate = useNavigate()
  const { state, navigateStep, isOnboarded } = useApp()
  const { isLoading, showMigrationModal, dismissMigrationModal, confirmMigration } = useProjectState()

  useEffect(() => {
    if (isLoading) return
    if (!isOnboarded) {
      navigate('/start', { replace: true })
      return
    }
    const flag = sessionStorage.getItem('intentional_app_entry')
    if (flag) {
      sessionStorage.removeItem('intentional_app_entry')
    } else if (!document.referrer.includes('/app')) {
      navigate('/dashboard', { replace: true })
    }
  }, [isLoading]) // eslint-disable-line

  const [sidebarOpen, setSidebarOpen]           = useState(false)
  const [showSupervisorEmail, setShowSupervisorEmail] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const close = (e) => { if (e.matches) setSidebarOpen(false) }
    mq.addEventListener('change', close)
    return () => mq.removeEventListener('change', close)
  }, [])

  const completedCount     = state.stepsCompleted.filter(Boolean).length
  const furthestAccessible = Math.min(completedCount, STEPS.length - 1)

  const CurrentStep = STEP_COMPONENTS[state.currentStep] ?? STEP_COMPONENTS[0]

  // Show a minimal loading veil while Supabase state hydrates (first paint only)
  if (isLoading) {
    return (
      <div id="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}>
        <div className="skeleton-loader" style={{ width: 320 }}>
          <div className="skeleton-bar" style={{ width: '100%' }} />
          <div className="skeleton-bar" style={{ width: '75%' }} />
          <div className="skeleton-bar" style={{ width: '55%' }} />
        </div>
      </div>
    )
  }

  return (
    <div id="app-shell" style={{ display: 'flex', height: '100vh', overflow: 'hidden', flexDirection: 'column' }}>

      {/* ── Offline / sync indicator ────────────────────────────────────────── */}
      <OfflineBanner />

      {/* ── Anonymous session migration modal ───────────────────────────────── */}
      <AnimatePresence>
        {showMigrationModal && (
          <AnonymousMigrationModal
            onBringOver={confirmMigration}
            onStartFresh={() => { localStorage.removeItem('fypro_session'); dismissMigrationModal() }}
          />
        )}
      </AnimatePresence>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* ── Mobile sidebar overlay ──────────────────────────────────────────── */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' is-visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      {/* ── Mobile hamburger toggle ─────────────────────────────────────────── */}
      <button
        className={`sidebar-toggle-btn${sidebarOpen ? ' is-open' : ''}`}
        onClick={() => setSidebarOpen(o => !o)}
        aria-label={sidebarOpen ? 'Close navigation' : 'Open navigation'}
        aria-expanded={sidebarOpen}
      >
        <span />
        <span />
        <span />
      </button>

      {/* ── Sidebar ──────────────────────────────────────────────────────────── */}
      <aside className={`sidebar${sidebarOpen ? ' is-open' : ''}`} id="app-sidebar">

        <div className="sidebar__brand">
          <img src="/fypro-logo.png" alt="FYPro" height="24" style={{ objectFit: 'contain' }} />
        </div>

        {/* Student context card */}
        <div className="sidebar__context-card">
          <p className="context-card__item context-card__item--university">{state.university}</p>
          <p className="context-card__item context-card__item--faculty">{state.faculty}</p>
          <p className="context-card__item context-card__item--department">{state.department}</p>
          <p className="context-card__item context-card__item--level">Level {state.level}</p>
          <p className="context-card__item context-card__item--topic">
            {state.validatedTopic || state.roughTopic}
          </p>
        </div>

        {/* Step list */}
        <nav className="sidebar__steps" aria-label="Project steps">
          <ul className="step-list" id="sidebar-step-list">
            {STEPS.map((name, i) => {
              const isCompleted  = state.stepsCompleted[i]
              const isCurrent    = i === state.currentStep
              const isAccessible = i <= furthestAccessible
              const isLocked     = !isAccessible

              return (
                <li
                  key={i}
                  className={[
                    'step-list__item',
                    isCurrent   ? 'step-list__item--current'   : '',
                    isCompleted ? 'step-list__item--completed'  : '',
                    isLocked    ? 'step-list__item--locked'     : '',
                  ].filter(Boolean).join(' ')}
                  style={isAccessible ? { cursor: 'pointer' } : undefined}
                  onClick={isAccessible ? () => { setShowSupervisorEmail(false); navigateStep(i) } : undefined}
                  title={isAccessible ? `Go to ${name}` : undefined}
                >
                  <div className="step-list__badge">
                    {isCompleted ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                        <path d={CHECK_PATH} />
                      </svg>
                    ) : String(i + 1)}
                  </div>
                  <span className="step-list__name">
                    {name}{i === 4 ? ' (optional)' : ''}
                  </span>
                  {(isLocked || isCompleted) && (
                    <span className="step-list__icon">
                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" fill={isCompleted ? '#0066FF' : 'currentColor'} aria-hidden="true">
                        <path d={isLocked ? LOCK_PATH : CHECK_PATH} />
                      </svg>
                    </span>
                  )}
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Bonus feature — Supervisor Email — appears after all 6 steps complete */}
        {state.stepsCompleted.every(Boolean) && (
          <div id="sidebar-bonus" className="sidebar__bonus" style={{ marginTop: 8 }}>
            <button
              className="sidebar__bonus-btn"
              onClick={() => setShowSupervisorEmail(v => !v)}
            >
              ✉ Supervisor Email
            </button>
          </div>
        )}

        {/* Back to Dashboard */}
        <button
          className="sidebar__back-dashboard"
          onClick={() => navigate('/dashboard')}
        >
          ← Dashboard
        </button>

      </aside>

      {/* ── Main content ─────────────────────────────────────────────────────── */}
      <main className="app-content">

        {/* Top step navigator */}
        <div className="step-navigator" id="step-navigator" role="navigation" aria-label="Step progress">
          <div className="nav-track">
            {STEPS.map((name, i) => {
              const isCompleted  = state.stepsCompleted[i]
              const isCurrent    = i === state.currentStep
              const isAccessible = i <= furthestAccessible

              return (
                <Fragment key={i}>
                  <div
                    className={[
                      'nav-pill',
                      isCompleted ? 'nav-pill--completed' : '',
                      isCurrent   ? 'nav-pill--current'   : '',
                    ].filter(Boolean).join(' ')}
                    style={isAccessible ? { cursor: 'pointer' } : undefined}
                    onClick={isAccessible ? () => navigateStep(i) : undefined}
                    title={name}
                  >
                    {isCompleted ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                        <path d={CHECK_PATH} />
                      </svg>
                    ) : String(i + 1)}
                    <span className="nav-pill__label">{name.split(' ')[0]}</span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div className={`nav-connector${isCompleted ? ' nav-connector--completed' : ''}`} />
                  )}
                </Fragment>
              )
            })}
          </div>
        </div>

        {/* Current step or bonus feature */}
        <div className="app-content__scroll">
          {showSupervisorEmail ? (
            <SupervisorEmail onClose={() => setShowSupervisorEmail(false)} />
          ) : (
            <CurrentStep />
          )}
        </div>

      </main>
      </div>{/* end flex row wrapper */}
    </div>
  )
}
