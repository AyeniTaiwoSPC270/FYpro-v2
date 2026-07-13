import { useState, useEffect, Fragment } from 'react'
import { useNavigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import FyproLogo from '../../components/FyproLogo'
import DefenceBrief from './DefenceBrief'
import { useApp } from '../../context/AppContext'
import { useProjectState } from '../../hooks/useProjectState'

const DefensePrep    = lazy(() => import('../defensePrep/DefensePrep'))
const ProjectReviewer = lazy(() => import('../projectReviewer/ProjectReviewer'))

const STEPS = [
  { id: 'reviewer', num: 1, name: 'Project Reviewer',  short: 'Reviewer',  key: 'project_reviewer', lockedBy: null },
  { id: 'brief',    num: 2, name: 'Defence Brief',     short: 'Brief',     key: 'defense_brief',    lockedBy: 'project_reviewer' },
  { id: 'defense',  num: 3, name: 'Defence Simulator', short: 'Simulator', key: 'defense',          lockedBy: 'defense_brief' },
]

const CHECK_PATH = 'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z'
const LOCK_PATH  = 'M208,80H168V56a40,40,0,0,0-80,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM104,56a24,24,0,0,1,48,0V80H104Zm104,152H48V96H208V208Zm-80-48a8,8,0,1,1-8-8A8,8,0,0,1,136,160Z'

export default function ExpressShell() {
  const [activeStep, setActiveStep] = useState(() => {
    // Read without deleting — we want this to survive refreshes within the same tab.
    // The sessionStorage entry is also updated on every step change below.
    return sessionStorage.getItem('express_active_step') || 'reviewer'
  })
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const navigate = useNavigate()
  const { state } = useApp()
  const { isLoading } = useProjectState()
  const expressSteps = state.expressSteps || {}

  // Keep sessionStorage in sync so the active step survives page refreshes.
  useEffect(() => {
    sessionStorage.setItem('express_active_step', activeStep)
  }, [activeStep])

  useEffect(() => {
    function onNav(e) { setActiveStep(e.detail.step) }
    document.addEventListener('express:navigate', onNav)
    return () => document.removeEventListener('express:navigate', onNav)
  }, [])

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const close = (e) => { if (e.matches) setSidebarOpen(false) }
    mq.addEventListener('change', close)
    return () => mq.removeEventListener('change', close)
  }, [])

  function isStepLocked(step) {
    return step.lockedBy ? !expressSteps[step.lockedBy] : false
  }

  function handleStepClick(step) {
    if (isStepLocked(step)) return
    setActiveStep(step.id)
    setSidebarOpen(false)
  }

  return (
    <div id="app-shell" style={{ display: 'flex', overflow: 'hidden', flexDirection: 'column' }}>

      <a href="#main-content" className="skip-to-content">Skip to main content</a>

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── Mobile sidebar overlay ─────────────────────────────────────────── */}
        <div
          className={`sidebar-overlay${sidebarOpen ? ' is-visible' : ''}`}
          onClick={() => setSidebarOpen(false)}
          aria-hidden="true"
        />

        {/* ── Sidebar ────────────────────────────────────────────────────────── */}
        <aside className={`sidebar${sidebarOpen ? ' is-open' : ''}`} id="app-sidebar">

          <div className="sidebar__brand">
            <FyproLogo style={{ height: '38px', width: '100%', objectFit: 'contain', objectPosition: 'left center' }} />
          </div>

          {/* Student context card */}
          <div className="sidebar__context-card">
            <p className="context-card__item context-card__item--university">{state.university}</p>
            <p className="context-card__item context-card__item--faculty">{state.faculty}</p>
            <p className="context-card__item context-card__item--department">{state.department}</p>
            {state.level && <p className="context-card__item context-card__item--level">Level {state.level}</p>}
            <p className="context-card__item context-card__item--topic">
              {state.validatedTopic || state.roughTopic}
            </p>
          </div>

          {/* Step list */}
          <nav className="sidebar__steps" aria-label="Express Defence steps">
            <ul className="step-list" id="sidebar-step-list">
              {STEPS.map((step, i) => {
                const isCurrent   = activeStep === step.id
                const isCompleted = !!expressSteps[step.key]
                const isLocked    = isStepLocked(step)

                return (
                  <li
                    key={step.id}
                    className={[
                      'step-list__item',
                      isCurrent   ? 'step-list__item--current'   : '',
                      isCompleted ? 'step-list__item--completed' : '',
                      isLocked    ? 'step-list__item--locked'    : '',
                    ].filter(Boolean).join(' ')}
                    style={!isLocked ? { cursor: 'pointer' } : undefined}
                    role={!isLocked ? 'button' : undefined}
                    tabIndex={!isLocked ? 0 : undefined}
                    aria-disabled={isLocked || undefined}
                    aria-current={isCurrent ? 'step' : undefined}
                    onClick={!isLocked ? () => handleStepClick(step) : undefined}
                    onKeyDown={!isLocked ? (e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        handleStepClick(step)
                      }
                    } : undefined}
                    title={!isLocked ? `Go to ${step.name}` : undefined}
                  >
                    <div className="step-list__badge">
                      {isCompleted ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                          <path d={CHECK_PATH} />
                        </svg>
                      ) : String(i + 1)}
                    </div>
                    <span className="step-list__name">{step.name}</span>
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

          {/* My Certificates — visible once a defense session is done */}
          {expressSteps.defense && (
            <div className="sidebar__bonus" style={{ marginTop: 8 }}>
              <button
                className="sidebar__bonus-btn"
                onClick={() => navigate('/account/certificates')}
              >
                🏆 My Certificates
              </button>
            </div>
          )}

          {/* Achievements — express-scoped */}
          <div className="sidebar__bonus" style={{ marginTop: 8 }}>
            <button
              className="sidebar__bonus-btn"
              onClick={() => navigate('/express/achievements')}
            >
              🏅 Achievements
            </button>
          </div>

          {/* Back to Express Dashboard */}
          <button
            className="sidebar__back-dashboard"
            onClick={() => navigate('/express')}
          >
            ← Express Dashboard
          </button>

        </aside>

        {/* ── Main content ───────────────────────────────────────────────────── */}
        <main className="es-main" id="main-content">

          {/* Top step navigator */}
          <div className="step-navigator" id="step-navigator" role="navigation" aria-label="Step progress">
            {/* Mobile hamburger — inline within nav bar on mobile, hidden on desktop */}
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
            <div className="nav-track">
              {STEPS.map((step, i) => {
                const isCurrent   = activeStep === step.id
                const isCompleted = !!expressSteps[step.key]
                const isLocked    = isStepLocked(step)

                return (
                  <Fragment key={step.id}>
                    <div
                      className={[
                        'nav-pill',
                        isCompleted ? 'nav-pill--completed' : '',
                        isCurrent   ? 'nav-pill--current'   : '',
                      ].filter(Boolean).join(' ')}
                      data-step={String(i + 1)}
                      style={!isLocked ? { cursor: 'pointer' } : undefined}
                      onClick={!isLocked ? () => handleStepClick(step) : undefined}
                      title={step.name}
                    >
                      {isCompleted ? (
                        <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                          <path d={CHECK_PATH} />
                        </svg>
                      ) : String(i + 1)}
                      <span className="nav-pill__label">{step.short}</span>
                    </div>
                    {i < STEPS.length - 1 && (
                      <div className={`nav-connector${isCompleted ? ' nav-connector--completed' : ''}`} />
                    )}
                  </Fragment>
                )
              })}
            </div>
          </div>

          {/* Active step */}
          <div className="es-main__scroll">
            {isLoading ? (
              <div className="es-main__loading" aria-label="Loading…">
                <div className="es-main__loading-spinner" />
              </div>
            ) : (
              <Suspense fallback={null}>
                {activeStep === 'reviewer' && <ProjectReviewer />}
                {activeStep === 'brief'    && <DefenceBrief />}
                {activeStep === 'defense'  && <DefensePrep />}
              </Suspense>
            )}
          </div>

        </main>
      </div>
    </div>
  )
}
