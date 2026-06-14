import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { UNIVERSITIES, getFaculties, getDepartments } from '../data/universities'
import { motion, AnimatePresence } from 'framer-motion'
import { updateUserProfile } from '../lib/db'
import { supabase } from '../lib/supabase'
import FyproLogo from '../components/FyproLogo'


const SHIELD_D = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

const LEVELS = ['400', '500']

export default function SplashOnboarding() {
  const navigate = useNavigate()
  const { set, state, isOnboarded } = useApp()

  // Phase: 'splash' | 'persona' | 'onboarding'
  const [phase, setPhase] = useState('splash')
  const [visible, setVisible] = useState(false)

  const [university, setUniversity] = useState(state.university || '')
  const [faculty, setFaculty] = useState(state.faculty || '')
  const [department, setDepartment] = useState(state.department || '')
  const [level, setLevel] = useState(state.level || '')
  const [topic, setTopic] = useState(state.roughTopic || '')
  const [submitError, setSubmitError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const topicRef = useRef(null)

  // Resume existing session — runs whenever isOnboarded changes so that a
  // returning user loading in incognito (no localStorage) still gets redirected
  // after Supabase hydrates their profile.
  useEffect(() => {
    if (isOnboarded) {
      sessionStorage.setItem('intentional_app_entry', 'true')
      navigate('/app', { replace: true })
    }
  }, [isOnboarded]) // eslint-disable-line

  // Splash → persona after 1700ms
  useEffect(() => {
    const t = setTimeout(() => {
      setPhase('persona')
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

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit || isSubmitting) return

    setSubmitError(null)
    setIsSubmitting(true)

    try {
      await updateUserProfile({ faculty, department, level })
    } catch (err) {
      console.error('[onboarding] Supabase profile update failed:', err)
      setSubmitError('Could not save your profile. Please check your connection and try again.')
      setIsSubmitting(false)
      return
    }

    // Persist onboarding completion to user_metadata so new devices / incognito
    // sessions can skip onboarding without relying on localStorage alone.
    // updateUser returns { data, error } — it does not throw on API errors.
    const { error: authUpdateError } = await supabase.auth.updateUser({
      data: { onboarding_completed: true },
    })
    if (authUpdateError) {
      console.error('[onboarding] user_metadata update failed:', authUpdateError)
      setSubmitError('Setup could not complete. Please check your connection and try again.')
      setIsSubmitting(false)
      return
    }

    set({ university, faculty, department, level, roughTopic: topic.trim() })
    sessionStorage.setItem('intentional_app_entry', 'true')
    navigate('/app')
  }

  return (
    <AnimatePresence mode="wait">
      {phase === 'splash' ? (
        <motion.div
          key="splash"
          id="splash-screen"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="splash__content">
            <motion.svg
              className="splash__shield"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 256 256"
              width="120"
              height="120"
              fill="#0066FF"
              aria-hidden="true"
              animate={{ y: [0, -10, 0], filter: ['drop-shadow(0 0 12px rgba(0,102,255,0.4))', 'drop-shadow(0 0 24px rgba(0,102,255,0.7))', 'drop-shadow(0 0 12px rgba(0,102,255,0.4))'] }}
              transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
            >
              <path d={SHIELD_D} />
            </motion.svg>
            <p className="splash__wordmark">
              <span>FY</span><span style={{ color: '#0066FF' }}>Pro</span>
            </p>
          </div>
        </motion.div>
      ) : phase === 'persona' ? (
        <motion.div
          key="persona"
          id="persona-screen"
          className="persona-screen"
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="so-persona">
            <div className="so-persona__eyebrow">WELCOME TO FYPRO</div>
            <h1 className="so-persona__heading">What stage are you at?</h1>
            <p className="so-persona__sub">
              This helps us route you to the right experience.
            </p>
            <div className="so-persona__options">
              <button
                className="so-persona__option"
                onClick={() => setPhase('onboarding')}
              >
                <div className="so-persona__option-icon">📚</div>
                <div className="so-persona__option-title">I&apos;m starting my final year project</div>
                <div className="so-persona__option-desc">
                  I need help choosing a topic, building my chapters, and planning my research from scratch.
                </div>
              </button>
              <button
                className="so-persona__option"
                onClick={() => navigate('/express-onboarding')}
              >
                <div className="so-persona__option-icon">🎯</div>
                <div className="so-persona__option-title">I already have a project — I need defence practice</div>
                <div className="so-persona__option-desc">
                  My project is done (or nearly done). I want to face the AI examiners and get my readiness score.
                </div>
              </button>
            </div>
          </div>
        </motion.div>
      ) : (
        <motion.div
          key="onboarding"
          id="onboarding-screen"
          className={visible ? '' : 'onboarding--hidden'}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        >
          <div className="onboarding__card">

            <div className={`onboarding__brand reveal-item${visible ? ' is-visible' : ''}`}>
              <FyproLogo style={{ height: 44, width: 'auto' }} />
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
                    <motion.button
                      key={l}
                      type="button"
                      className={`level-btn${level === l ? ' is-selected' : ''}`}
                      data-level={l}
                      disabled={!showLevel}
                      onClick={() => handleLevelClick(l)}
                      whileTap={showLevel ? { scale: 0.95 } : {}}
                    >
                      {l}
                    </motion.button>
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

              {submitError && (
                <div
                  role="alert"
                  style={{
                    marginBottom: 12,
                    padding: '10px 14px',
                    background: 'rgba(220, 38, 38, 0.1)',
                    border: '1px solid rgba(220, 38, 38, 0.3)',
                    borderRadius: 8,
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: '0.8rem',
                    color: '#FCA5A5',
                    lineHeight: 1.5,
                  }}
                >
                  {submitError}
                </div>
              )}

              <motion.button
                id="btn-begin"
                type="submit"
                className={`begin-btn${canSubmit && !isSubmitting ? ' is-ready' : ''}`}
                disabled={!canSubmit || isSubmitting}
                whileHover={canSubmit && !isSubmitting ? { scale: 1.02, boxShadow: '0 8px 24px rgba(0,102,255,0.4)' } : {}}
                whileTap={canSubmit && !isSubmitting ? { scale: 0.97 } : {}}
                transition={{ duration: 0.15 }}
              >
                {isSubmitting ? 'Saving…' : 'Begin'}
              </motion.button>
            </form>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
