import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { lazy, Suspense } from 'react'
import FyproLogo from '../../components/FyproLogo'
import ExpressBrief from './ExpressBrief'

const DefensePrep = lazy(() => import('../defensePrep/DefensePrep'))
const ProjectReviewer = lazy(() => import('../projectReviewer/ProjectReviewer'))

const STEPS = [
  { id: 'red-flag',  num: 1, name: 'Red Flag Scanner',  badge: 'optional' },
  { id: 'reviewer',  num: 2, name: 'Project Reviewer',  badge: 'optional' },
  { id: 'defense',   num: 3, name: 'Defence Simulator', badge: null },
]

export default function ExpressShell() {
  const [activeStep, setActiveStep] = useState('defense')
  const [done, setDone] = useState({})
  const navigate = useNavigate()

  function markDone(stepId) {
    setDone(prev => ({ ...prev, [stepId]: true }))
  }

  return (
    <div className="es-shell">
      <aside className="es-sidebar">
        <div className="es-sidebar__logo">
          <FyproLogo style={{ height: 36, width: 'auto' }} />
        </div>

        <ExpressBrief />

        <ul className="es-step-list" role="list">
          {STEPS.map(step => {
            const isActive = activeStep === step.id
            const isDone = done[step.id]
            return (
              <li key={step.id} className="es-step-list__item">
                <button
                  className={[
                    'es-step-btn',
                    isActive ? 'es-step-btn--active' : '',
                    isDone ? 'es-step-btn--done' : '',
                  ].filter(Boolean).join(' ')}
                  onClick={() => setActiveStep(step.id)}
                >
                  <span className="es-step-btn__num">
                    {isDone ? '✓' : step.num}
                  </span>
                  <span className="es-step-btn__name">{step.name}</span>
                  {step.badge && (
                    <span className="es-step-btn__badge">{step.badge}</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>

        <div className="es-sidebar__footer">
          <button
            className="es-sidebar__footer-text"
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'inherit', padding: 0 }}
            onClick={() => navigate('/dashboard')}
          >
            ← Dashboard
          </button>
        </div>
      </aside>

      <main className="es-main">
        <Suspense fallback={null}>
          {activeStep === 'defense' && (
            <DefensePrep onComplete={() => markDone('defense')} />
          )}
          {activeStep === 'reviewer' && (
            <ProjectReviewer onComplete={() => markDone('reviewer')} />
          )}
          {activeStep === 'red-flag' && (
            <DefensePrep redFlagOnly onComplete={() => { markDone('red-flag'); setActiveStep('reviewer') }} />
          )}
        </Suspense>
      </main>
    </div>
  )
}
