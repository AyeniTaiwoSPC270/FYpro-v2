import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { UNIVERSITIES, getFaculties, getDepartments } from '../data/universities'


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
          <img
            src="/fypro-logo.png"
            alt="FYPro"
            className="splash__shield"
            width="120"
            height="120"
          />
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
          <img
            src="/fypro-logo.png"
            alt="FYPro"
            className="onboarding__shield"
            width="44"
            height="44"
          />
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
