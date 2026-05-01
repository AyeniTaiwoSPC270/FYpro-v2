import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { UNIVERSITIES, getFaculties, getDepartments } from '../data/universities'


const SHIELD_D = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

const LEVELS = ['300', '400']

export default function SplashOnboarding() {
  const navigate = useNavigate()
  const { set, state, isOnboarded } = useApp()

  // Phase: 'splash' | 'onboarding'
  const [phase, setPhase] = useState('splash')
  const [visible, setVisible] = useState(false)

  const [university, setUniversity] = useState(state.university || '')
  const [faculty, setFaculty] = useState(state.faculty || '')
  const [department, setDepartment] = useState(state.department || '')
  const [level, setLevel] = useState(state.level || '')
  const [topic, setTopic] = useState(state.roughTopic || '')

  const topicRef = useRef(null)

  // Resume existing session
  useEffect(() => {
    if (isOnboarded) {
      navigate('/app', { replace: true })
    }
  }, []) // eslint-disable-line

  // Splash → form after 1700ms
  useEffect(() => {
    const t = setTimeout(() => {
      setPhase('onboarding')
    }, 1700)
    return () => clearTimeout(t)
  }, [])

  // Staggered reveal after form phase starts
  useEffect(() => {
    if (phase === 'onboarding') {
      const t = setTimeout(() => setVisible(true), 50)
      return () => clearTimeout(t)
    }
  }, [phase])

  const universities = Object.keys(UNIVERSITIES)
  const faculties = university ? getFaculties(university) : []
  const departments = faculty ? getDepartments(university, faculty) : []

  const showFaculty = Boolean(university)
  const showDept = Boolean(faculty)
  const showLevel = Boolean(department)
  const showTopic = Boolean(level)

  const canSubmit = university && faculty && department && level && topic.trim().length >= 10

  function handleUniversityChange(e) {
    setUniversity(e.target.value)
    setFaculty('')
    setDepartment('')
    setLevel('')
    setTopic('')
  }

  function handleFacultyChange(e) {
    setFaculty(e.target.value)
    setDepartment('')
    setLevel('')
    setTopic('')
  }

  function handleDeptChange(e) {
    setDepartment(e.target.value)
    setLevel('')
    setTopic('')
  }

  function handleLevelClick(l) {
    setLevel(l)
    setTimeout(() => topicRef.current?.focus(), 50)
  }

  function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return
    set({ university, faculty, department, level, roughTopic: topic.trim() })
    navigate('/app')
  }

  if (phase === 'splash') {
    return (
      <div id="splash-screen">
        <div className="splash__content">
          <svg
            className="splash__shield"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width="120"
            height="120"
            fill="#0066FF"
            aria-hidden="true"
          >
            <path d={SHIELD_D} />
          </svg>
          <p className="splash__wordmark">
            <span>FY</span><span style={{ color: '#0066FF' }}>Pro</span>
          </p>
        </div>
      </div>
    )
  }

  return (
    <div id="onboarding-screen" className={visible ? '' : 'onboarding--hidden'}>
      <div className="onboarding__card">

        <div className={`onboarding__brand reveal-item${visible ? ' is-visible' : ''}`}>
          <svg
            className="onboarding__shield"
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 256 256"
            width="44"
            height="44"
            fill="#0066FF"
            aria-hidden="true"
          >
            <path d={SHIELD_D} />
          </svg>
          <span className="onboarding__wordmark">
            <span>FY</span><span style={{ color: '#0066FF' }}>Pro</span>
          </span>
        </div>

        <p className={`onboarding__tagline reveal-item${visible ? ' is-visible' : ''}`}>
          The Supervisor You Never Had.
        </p>

        <p className={`onboarding__intro reveal-item${visible ? ' is-visible' : ''}`}>
          Tell FYPro about your project and we will tell you if it is researchable.
        </p>

        <form
          onSubmit={handleSubmit}
          className={`onboarding__fields reveal-item${visible ? ' is-visible' : ''}`}
        >
          {/* University */}
          <div className="field-group">
            <label className="field-label" htmlFor="sel-university">University</label>
            <select
              id="sel-university"
              className="field-select"
              value={university}
              onChange={handleUniversityChange}
            >
              <option value="">Select university…</option>
              {universities.map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
          </div>

          {/* Faculty */}
          <div className={`field-group${!showFaculty ? ' field-group--locked' : ''}`}>
            <label className="field-label" htmlFor="sel-faculty">Faculty</label>
            <select
              id="sel-faculty"
              className="field-select"
              disabled={!showFaculty}
              value={faculty}
              onChange={handleFacultyChange}
            >
              <option value="">Select faculty…</option>
              {faculties.map((f) => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          {/* Department */}
          <div className={`field-group${!showDept ? ' field-group--locked' : ''}`}>
            <label className="field-label" htmlFor="sel-department">Department</label>
            <select
              id="sel-department"
              className="field-select"
              disabled={!showDept}
              value={department}
              onChange={handleDeptChange}
            >
              <option value="">Select department…</option>
              {departments.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Level */}
          <div className={`field-group${!showLevel ? ' field-group--locked' : ''}`}>
            <label className="field-label">Level</label>
            <div id="level-selector" className="level-selector">
              {LEVELS.map((l) => (
                <button
                  key={l}
                  type="button"
                  className={`level-btn${level === l ? ' is-selected' : ''}`}
                  data-level={l}
                  disabled={!showLevel}
                  onClick={() => handleLevelClick(l)}
                >
                  {l}
                </button>
              ))}
            </div>
          </div>

          {/* Topic */}
          <div className={`field-group${!showTopic ? ' field-group--locked' : ''}`}>
            <label className="field-label" htmlFor="inp-topic">Research Topic</label>
            <input
              id="inp-topic"
              ref={topicRef}
              className="field-input"
              type="text"
              disabled={!showTopic}
              placeholder="e.g. Impact of social media on academic performance among undergraduates"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
            />
          </div>

          <button
            id="btn-begin"
            type="submit"
            className={`begin-btn${canSubmit ? ' is-ready' : ''}`}
            disabled={!canSubmit}
          >
            Begin
          </button>
        </form>

      </div>
    </div>
  )
}
