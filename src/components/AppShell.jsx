import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import TopicValidator from '../pages/steps/TopicValidator'
import ChapterArchitect from '../pages/steps/ChapterArchitect'
import MethodologyAdvisor from '../pages/steps/MethodologyAdvisor'
import WritingPlanner from '../pages/steps/WritingPlanner'
import ProjectReviewer from '../pages/steps/ProjectReviewer'
import DefensePrep from '../pages/steps/DefensePrep'
import SupervisorEmail from './SupervisorEmail'

const SHIELD_D =
  'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

const CHECK_PATH =
  'M229.66,77.66l-128,128a8,8,0,0,1-11.32,0l-56-56a8,8,0,0,1,11.32-11.32L96,188.69,218.34,66.34a8,8,0,0,1,11.32,11.32Z'

const LOCK_PATH =
  'M208,80H168V56a40,40,0,0,0-80,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM104,56a24,24,0,0,1,48,0V80H104Zm104,152H48V96H208V208Zm-80-48a8,8,0,1,1-8-8A8,8,0,0,1,136,160Z'

const STEPS = [
  'Topic Validator',
  'Chapter Architect',
  'Methodology Advisor',
  'Writing Planner',
  'Project Reviewer',
  'Defence Prep',
]

const STEP_COMPONENTS = [
  TopicValidator,
  ChapterArchitect,
  MethodologyAdvisor,
  WritingPlanner,
  ProjectReviewer,
  DefensePrep,
]

export default function AppShell() {
  const { state, navigateStep } = useApp()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showEmail, setShowEmail] = useState(false)

  const { stepsCompleted, currentStep, university, faculty, department, level, validatedTopic, roughTopic } = state

  const completedCount = stepsCompleted.filter(Boolean).length
  const furthestAccessible = Math.min(completedCount, STEPS.length - 1)

  function handleStepClick(i) {
    const isAccessible = i <= furthestAccessible
    if (!isAccessible) return
    navigateStep(i)
  }

  const allCoreDone = stepsCompleted[0] && stepsCompleted[1] && stepsCompleted[2] && stepsCompleted[3]

  const StepComponent = STEP_COMPONENTS[currentStep] || TopicValidator

  return (
    <div id="app-shell">

      {/* Sidebar overlay (mobile) */}
      <div
        className={`sidebar-overlay${sidebarOpen ? ' is-visible' : ''}`}
        id="sidebar-overlay"
        onClick={() => setSidebarOpen(false)}
      />

      {/* Mobile sidebar toggle */}
      <button
        className={`sidebar-toggle-btn${sidebarOpen ? ' is-open' : ''}`}
        id="sidebar-toggle-btn"
        aria-label="Toggle sidebar"
        onClick={() => setSidebarOpen((v) => !v)}
      >
        <span /><span /><span />
      </button>

      {/* LEFT SIDEBAR */}
      <aside className={`sidebar${sidebarOpen ? ' is-open' : ''}`} id="app-sidebar">

        <div className="sidebar__brand">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width="36"
            height="36"
            fill="#0066FF"
            aria-hidden="true"
            style={{ filter: 'drop-shadow(0 0 8px rgba(0,102,255,0.45))' }}
          >
            <path d={SHIELD_D} />
          </svg>
          <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.3rem', color: '#fff', marginLeft: 8 }}>
            FY<span style={{ color: '#0066FF' }}>Pro</span>
          </span>
        </div>

        <div className="sidebar__context-card">
          <p className="context-card__item context-card__item--university" id="ctx-university">{university}</p>
          <p className="context-card__item context-card__item--faculty"    id="ctx-faculty">{faculty}</p>
          <p className="context-card__item context-card__item--department" id="ctx-department">{department}</p>
          <p className="context-card__item context-card__item--level"      id="ctx-level">{level ? `Level ${level}` : ''}</p>
          <p className="context-card__item context-card__item--topic"      id="ctx-topic">{validatedTopic || roughTopic}</p>
        </div>

        <nav className="sidebar__steps" aria-label="Project steps">
          <ul className="step-list" id="sidebar-step-list">
            {STEPS.map((name, i) => {
              const isCompleted  = stepsCompleted[i]
              const isCurrent    = i === currentStep
              const isAccessible = i <= furthestAccessible
              const isLocked     = !isAccessible

              return (
                <li
                  key={i}
                  className={[
                    'step-list__item',
                    isCurrent   ? 'step-list__item--current'   : '',
                    isCompleted ? 'step-list__item--completed' : '',
                    isLocked    ? 'step-list__item--locked'    : '',
                  ].join(' ').trim()}
                  style={isAccessible ? { cursor: 'pointer' } : undefined}
                  title={isAccessible ? `Go to ${name}` : undefined}
                  onClick={() => handleStepClick(i)}
                >
                  <div className="step-list__badge">
                    {isCompleted ? (
                      <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                        <path d={CHECK_PATH} />
                      </svg>
                    ) : String(i + 1)}
                  </div>
                  <span className="step-list__name">{name}</span>
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

        <div id="sidebar-bonus" className="sidebar__bonus">
          {allCoreDone && (
            <>
              <div className="sidebar__bonus-divider" />
              <button
                id="btn-open-email"
                className="sidebar__bonus-btn"
                onClick={() => setShowEmail(true)}
              >
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
                  <path d="M224,48H32a8,8,0,0,0-8,8V192a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V56A8,8,0,0,0,224,48ZM203.43,64,128,133.15,52.57,64ZM216,192H40V74.19l82.59,75.71a8,8,0,0,0,10.82,0L216,74.19V192Z" />
                </svg>
                Draft Supervisor Email
              </button>
            </>
          )}
        </div>

      </aside>

      {/* RIGHT CONTENT AREA */}
      <main className="app-content">

        <div
          className="step-navigator"
          id="step-navigator"
          role="navigation"
          aria-label="Step progress"
        >
          <div className="nav-track">
            {STEPS.map((name, i) => {
              const isCompleted  = stepsCompleted[i]
              const isCurrent    = i === currentStep
              const isAccessible = i <= furthestAccessible

              return (
                <div key={i} style={{ display: 'contents' }}>
                  <div
                    className={[
                      'nav-pill',
                      isCompleted ? 'nav-pill--completed' : '',
                      isCurrent   ? 'nav-pill--current'   : '',
                    ].join(' ').trim()}
                    style={isAccessible ? { cursor: 'pointer' } : undefined}
                    title={name}
                    onClick={() => isAccessible && handleStepClick(i)}
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
                </div>
              )
            })}
          </div>
        </div>

        <div className="app-content__scroll">
          <StepComponent key={currentStep} />
        </div>

      </main>

      {showEmail && <SupervisorEmail onClose={() => setShowEmail(false)} />}

    </div>
  )
}
