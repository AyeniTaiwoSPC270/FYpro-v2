import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import FyproLogo from '../../components/FyproLogo'
import ExpressBrief from './ExpressBrief'
import DefenceBrief from './DefenceBrief'
import { useApp } from '../../context/AppContext'

const DefensePrep    = lazy(() => import('../defensePrep/DefensePrep'))
const ProjectReviewer = lazy(() => import('../projectReviewer/ProjectReviewer'))

const STEPS = [
  { id: 'reviewer', num: 1, name: 'Project Reviewer',  key: 'project_reviewer', lockedBy: null },
  { id: 'brief',    num: 2, name: 'Defence Brief',     key: 'defense_brief',    lockedBy: 'project_reviewer' },
  { id: 'defense',  num: 3, name: 'Defence Simulator', key: 'defense',          lockedBy: 'defense_brief' },
]

export default function ExpressShell() {
  const [activeStep, setActiveStep] = useState(() => {
    // Read without deleting — we want this to survive refreshes within the same tab.
    // The sessionStorage entry is also updated on every step change below.
    return sessionStorage.getItem('express_active_step') || 'reviewer'
  })
  const navigate = useNavigate()
  const { state } = useApp()
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

  function handleStepClick(step) {
    const isLocked = step.lockedBy ? !expressSteps[step.lockedBy] : false
    if (isLocked) return
    setActiveStep(step.id)
  }

  return (
    <div className="es-shell">
      <aside className="es-sidebar">
        <div className="es-sidebar__logo">
          <FyproLogo style={{ height: 36, width: 'auto' }} />
        </div>

        <button
          className="es-sidebar__mobile-back"
          onClick={() => navigate('/express')}
          aria-label="Back to Express Dashboard"
        >
          ←
        </button>

        <ExpressBrief />

        <ul className="es-step-list" role="list">
          {STEPS.map(step => {
            const isActive  = activeStep === step.id
            const isDone    = !!expressSteps[step.key]
            const isLocked  = step.lockedBy ? !expressSteps[step.lockedBy] : false
            return (
              <li key={step.id} className="es-step-list__item">
                <button
                  className={[
                    'es-step-btn',
                    isActive  ? 'es-step-btn--active' : '',
                    isDone    ? 'es-step-btn--done'   : '',
                    isLocked  ? 'es-step-btn--locked' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => handleStepClick(step)}
                >
                  <span className="es-step-btn__num">
                    {isDone ? '✓' : isLocked ? '🔒' : step.num}
                  </span>
                  <span className="es-step-btn__name">{step.name}</span>
                </button>
              </li>
            )
          })}
        </ul>

        <div className="es-sidebar__footer">
          <button
            className="es-sidebar__footer-text"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
            onClick={() => navigate('/express')}
          >
            ← Express Dashboard
          </button>
        </div>
      </aside>

      <main className="es-main">
        <Suspense fallback={null}>
          {activeStep === 'reviewer' && <ProjectReviewer />}
          {activeStep === 'brief'    && <DefenceBrief />}
          {activeStep === 'defense'  && <DefensePrep />}
        </Suspense>
      </main>
    </div>
  )
}
