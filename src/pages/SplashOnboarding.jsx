import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { UNIVERSITIES, getFaculties, getDepartments } from '../data/universities'
import { motion, AnimatePresence } from 'framer-motion'
import { updateUserProfile } from '../lib/db'
import { supabase } from '../lib/supabase'
import FyproLogo from '../components/FyproLogo'
import { saveOnboardingAnswers, markWalkthroughSeen } from '../lib/onboarding'
import TourCarousel from '../features/onboarding/TourCarousel'


const SHIELD_D = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

const LEVELS = ['400', '500']

const TRUST_LINES = [
  { icon: '🎓', text: 'Face 3 AI examiners before the real panel' },
  { icon: '★', text: 'Score 7/10+ to unlock your defence certificate' },
  { icon: '🇳🇬', text: 'Built for Nigerian final-year students' },
]

// Phases that are part of the post-profile question flow — the isOnboarded
// redirect guard must not fire during these phases.
const POST_PROFILE_PHASES = ['attribution', 'defence-date', 'goal', 'notifications', 'congrats', 'walkthrough']

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

export default function SplashOnboarding() {
  const navigate = useNavigate()
  const { set, state, isOnboarded } = useApp()

  const [phase, setPhase] = useState('splash')
  const [visible, setVisible] = useState(false)
  const [trustIdx, setTrustIdx] = useState(0)

  // Profile form fields
  const [university, setUniversity] = useState(state.university || '')
  const [faculty, setFaculty] = useState(state.faculty || '')
  const [department, setDepartment] = useState(state.department || '')
  const [level, setLevel] = useState(state.level || '')
  const [topic, setTopic] = useState(state.roughTopic || '')
  const [submitError, setSubmitError] = useState(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // New question answers
  const [referralSource, setReferralSource] = useState(null)
  const [defenceBand, setDefenceBand]       = useState(null)
  const [primaryGoal, setPrimaryGoal]       = useState(null)
  const [notifyEmail, setNotifyEmail]       = useState(false)
  const [notifyPush, setNotifyPush]         = useState(false)

  // Tour
  const [showTour, setShowTour] = useState(false)
  const [tourTransitioning, setTourTransitioning] = useState(false)

  const topicRef = useRef(null)

  // Resume existing session — only redirect on early phases so that the
  // post-profile question flow is not interrupted by onboarding_completed firing.
  useEffect(() => {
    if (isOnboarded && !POST_PROFILE_PHASES.includes(phase)) {
      sessionStorage.setItem('intentional_app_entry', 'true')
      navigate('/app', { replace: true })
    }
  }, [isOnboarded, phase]) // eslint-disable-line

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

  // Rotating trust line in the rail (paused during splash + when reduced motion)
  useEffect(() => {
    if (phase === 'splash') return
    if (prefersReducedMotion()) return
    const t = setInterval(() => {
      setTrustIdx((i) => (i + 1) % TRUST_LINES.length)
    }, 3500)
    return () => clearInterval(t)
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
    setIsSubmitting(false)
    // Advance to question flow — navigation to /app happens at the end of the flow
    setPhase('attribution')
  }

  async function handleSaveAndCongrats() {
    // Fire-and-forget — network failure must not block the user
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (userId) {
      if (notifyPush && 'serviceWorker' in navigator) {
        try {
          const reg = await navigator.serviceWorker.ready
          const existing = await reg.pushManager.getSubscription()
          if (!existing) {
            const sub = await reg.pushManager.subscribe({
              userVisibleOnly: true,
              applicationServerKey: import.meta.env.VITE_VAPID_PUBLIC_KEY,
            })
            fetch('/api/notify', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'subscribe', subscription: sub }),
            }).catch(() => {})
          }
        } catch (err) {
          console.warn('[onboarding] push subscribe failed (non-fatal):', err)
        }
      }

      saveOnboardingAnswers(userId, {
        referral_source:       referralSource,
        expected_defence_band: defenceBand,
        primary_goal:          primaryGoal,
        notify_email:          notifyEmail || null,
        notify_push:           notifyPush  || null,
      })
    }

    setPhase('congrats')
  }

  // Progress bar — steps 1–5 map to the 5 wizard screens
  const STEP_PHASES = ['onboarding', 'attribution', 'defence-date', 'goal', 'notifications']
  const stepNum     = STEP_PHASES.indexOf(phase) + 1
  const progressPct = stepNum > 0 ? (stepNum / 5) * 100 : 0
  const almostDone  = stepNum >= 4

  const REFERRAL_OPTIONS = [
    'Friend or colleague', 'Twitter / X', 'TikTok', 'Instagram',
    'WhatsApp', 'Lecturer', 'Google Search', 'Other',
  ]
  const DEFENCE_OPTIONS = [
    { label: 'Within 1 month', value: '<1m' },
    { label: '1–3 months',     value: '1-3m' },
    { label: '3–6 months',     value: '3-6m' },
    { label: 'Not sure yet',   value: 'unsure' },
  ]
  const GOAL_OPTIONS = [
    { label: 'Validate my topic',  value: 'validate_topic' },
    { label: 'Build my chapters',  value: 'build_chapters' },
    { label: 'Plan my writing',    value: 'plan_writing' },
    { label: 'Defence practice',   value: 'defence_practice' },
  ]

  const GOAL_SUBTITLES = {
    validate_topic:    "Start with Step 1 — let's check if your idea is researchable.",
    build_chapters:    'Head to Step 2 to generate your chapter structure.',
    plan_writing:      "Jump to Step 5 when you're ready to build your writing schedule.",
    defence_practice:  "Jump to Step 6 when you're ready to face the panel.",
  }
  const congratsSubtitle = primaryGoal
    ? GOAL_SUBTITLES[primaryGoal]
    : 'Your 6-step workflow is ready.'

  const firstName = (() => {
    const raw = state.fullName || ''
    return raw.split(' ')[0] || 'there'
  })()

  // ── Inner helper components (declared inside so they close over state) ────

  function ProgressBar() {
    if (stepNum === 0) return null
    return (
      <div className="oq-progress-wrap">
        {almostDone && <div className="oq-progress-label">Almost done.</div>}
        <div className="oq-progress">
          <div className="oq-progress__fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>
    )
  }

  function ChipScreen({ eyebrow, heading, options, selected, onSelect, onSkip, onContinue }) {
    return (
      <motion.div
        className="oq-question"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <ProgressBar />
        <div className="oq-question__eyebrow">{eyebrow}</div>
        <h1 className="oq-question__heading">{heading}</h1>
        <div className="oq-chips">
          {options.map((opt) => {
            const value = typeof opt === 'string' ? opt : opt.value
            const label = typeof opt === 'string' ? opt : opt.label
            return (
              <button
                key={value}
                type="button"
                className={`oq-chip${selected === value ? ' oq-chip--selected' : ''}`}
                onClick={() => onSelect(value)}
              >
                {label}
              </button>
            )
          })}
        </div>
        <div className="oq-actions">
          <button type="button" className="oq-skip" onClick={onSkip}>Skip</button>
          <button
            type="button"
            className="oq-continue"
            disabled={!selected}
            onClick={onContinue}
          >
            Continue
          </button>
        </div>
      </motion.div>
    )
  }

  function NotificationsScreen() {
    return (
      <motion.div
        className="oq-question"
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      >
        <ProgressBar />
        <div className="oq-question__eyebrow">STAY ON TRACK</div>
        <h1 className="oq-question__heading">Want reminders?</h1>
        <div className="oq-toggles">
          <label className={`oq-toggle-row${notifyEmail ? ' oq-toggle-row--on' : ''}`}>
            <div className="oq-toggle-info">
              <div className="oq-toggle-label">Email nudges</div>
              <div className="oq-toggle-desc">Writing reminders and defence tips by email</div>
            </div>
            <div className="oq-toggle-switch">
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={(e) => setNotifyEmail(e.target.checked)}
              />
              <div className="oq-toggle-track" />
            </div>
          </label>
          <label className={`oq-toggle-row${notifyPush ? ' oq-toggle-row--on' : ''}`}>
            <div className="oq-toggle-info">
              <div className="oq-toggle-label">Push reminders</div>
              <div className="oq-toggle-desc">Get nudges on this device</div>
            </div>
            <div className="oq-toggle-switch">
              <input
                type="checkbox"
                checked={notifyPush}
                onChange={(e) => setNotifyPush(e.target.checked)}
              />
              <div className="oq-toggle-track" />
            </div>
          </label>
        </div>
        <div className="oq-actions">
          <button type="button" className="oq-skip" onClick={handleSaveAndCongrats}>Skip</button>
          <button type="button" className="oq-continue" onClick={handleSaveAndCongrats}>
            Continue
          </button>
        </div>
      </motion.div>
    )
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <AnimatePresence mode="wait">
        {phase === 'splash' ? (
          <motion.div
            key="splash"
            id="splash-screen"
            initial={{ opacity: 1 }}
            exit={{ opacity: 0, scale: 0.7, x: -120, y: -90 }}
            transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
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

        ) : phase === 'congrats' ? (
          <motion.div
            key="congrats"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className="oq-congrats">
              <div className="oq-congrats__icon">
                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="80" height="80" fill="currentColor" style={{ color: 'var(--color-blue-primary)' }}>
                  <path d={SHIELD_D} />
                </svg>
              </div>
              <h1 className="oq-congrats__title">🎉 You&apos;re all set, {firstName}.</h1>
              <p className="oq-congrats__subtitle">{congratsSubtitle}</p>
              <p className="oq-congrats__plan">
                You&apos;re on the free plan —{' '}
                <a href="/pricing">unlock the 3-examiner defence panel</a>{' '}
                whenever you&apos;re ready.
              </p>
              <button className="oq-congrats__cta" onClick={() => setPhase('walkthrough')}>
                Enter FYPro
              </button>
            </div>
          </motion.div>

        ) : phase === 'walkthrough' ? (
          <motion.div
            key="walkthrough"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.4 }}
          >
            <div className={`oq-walkthrough${tourTransitioning ? ' oq-walkthrough--exiting' : ''}`}>
              <div className="oq-walkthrough__card">
                <div className="oq-walkthrough__icon">🛡️</div>
                <h2 className="oq-walkthrough__title">Quick look at FYPro?</h2>
                <ul className="oq-walkthrough__bullets">
                  {[
                    'Validate your topic with real research',
                    'Build chapters, methodology, and a writing schedule',
                    'Face 3 AI examiners before your real panel',
                  ].map((b) => (
                    <li key={b} className="oq-walkthrough__bullet">
                      <span className="oq-walkthrough__check">✓</span>
                      {b}
                    </li>
                  ))}
                </ul>
                <div className="oq-walkthrough__btns">
                  <button
                    className="oq-walkthrough__take"
                    onClick={async () => {
                      const { data: { session } } = await supabase.auth.getSession()
                      if (session?.user?.id) markWalkthroughSeen(session.user.id)
                      setTourTransitioning(true)
                      setTimeout(() => setShowTour(true), 320)
                    }}
                  >
                    Take the tour
                  </button>
                  <button
                    className="oq-walkthrough__skip-btn"
                    onClick={async () => {
                      const { data: { session } } = await supabase.auth.getSession()
                      if (session?.user?.id) markWalkthroughSeen(session.user.id)
                      sessionStorage.setItem('intentional_app_entry', 'true')
                      navigate('/app')
                    }}
                  >
                    Skip to my project
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

        ) : (
          /* .onb shell — covers persona, onboarding, attribution, defence-date, goal, notifications */
          <motion.div
            key="shell"
            className="onb"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
          >
            {/* Persistent left brand rail */}
            <aside className="onb__rail">
              <div className="onb__rail-top">
                <FyproLogo className="onb__logo" style={{ height: 40, width: 'auto' }} />
                <p className="onb__tagline">The supervisor you never had.</p>
              </div>

              <svg className="onb__watermark" viewBox="0 0 256 256" aria-hidden="true">
                <path d={SHIELD_D} />
              </svg>

              <div className="onb__trust">
                <AnimatePresence mode="wait">
                  <motion.div
                    key={trustIdx}
                    className="onb__trust-line"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.4 }}
                  >
                    <span className="onb__trust-ic">{TRUST_LINES[trustIdx].icon}</span>
                    {TRUST_LINES[trustIdx].text}
                  </motion.div>
                </AnimatePresence>
              </div>
            </aside>

            {/* Right interactive pane */}
            <main className="onb__pane">
              <div className="onb__pane-inner">
                <AnimatePresence mode="wait">
                  {phase === 'persona' ? (
                    <motion.div
                      key="persona"
                      className="so-persona"
                      initial={{ opacity: 0, y: 12 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: -8 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
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
                    </motion.div>

                  ) : phase === 'attribution' ? (
                    <ChipScreen
                      key="attribution"
                      eyebrow="HOW DID YOU HEAR ABOUT US?"
                      heading="How did you find FYPro?"
                      options={REFERRAL_OPTIONS}
                      selected={referralSource}
                      onSelect={setReferralSource}
                      onSkip={() => setPhase('defence-date')}
                      onContinue={() => setPhase('defence-date')}
                    />

                  ) : phase === 'defence-date' ? (
                    <ChipScreen
                      key="defence-date"
                      eyebrow="WHEN'S YOUR DEFENCE OR SUBMISSION?"
                      heading="When are you defending?"
                      options={DEFENCE_OPTIONS}
                      selected={defenceBand}
                      onSelect={setDefenceBand}
                      onSkip={() => setPhase('goal')}
                      onContinue={() => setPhase('goal')}
                    />

                  ) : phase === 'goal' ? (
                    <ChipScreen
                      key="goal"
                      eyebrow="WHAT DO YOU WANT MOST RIGHT NOW?"
                      heading="What&apos;s your main goal?"
                      options={GOAL_OPTIONS}
                      selected={primaryGoal}
                      onSelect={setPrimaryGoal}
                      onSkip={() => setPhase('notifications')}
                      onContinue={() => setPhase('notifications')}
                    />

                  ) : phase === 'notifications' ? (
                    <NotificationsScreen key="notifications" />

                  ) : (
                    /* phase === 'onboarding' — profile form */
                    <motion.div
                      key="form"
                      className="onb-form"
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                    >
                      <ProgressBar />
                      <div className={`onb-form__eyebrow reveal-item${visible ? ' is-visible' : ''}`}>
                        YOUR PROFILE
                      </div>
                      <h1 className={`onb-form__heading reveal-item${visible ? ' is-visible' : ''}`}>
                        Let&apos;s set up your project.
                      </h1>
                      <p className={`onb-form__intro reveal-item${visible ? ' is-visible' : ''}`}>
                        Tell FYPro about your project and we&apos;ll tell you if it&apos;s researchable.
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
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </main>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Tour carousel — mounted outside AnimatePresence so it layers above everything */}
      {showTour && (
        <TourCarousel
          onClose={() => {
            setShowTour(false)
            sessionStorage.setItem('intentional_app_entry', 'true')
            navigate('/app')
          }}
        />
      )}
    </>
  )
}
