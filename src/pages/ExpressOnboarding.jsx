import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePaystackCheckout } from '../hooks/usePaystackCheckout'
import { usePaidFeatures } from '../hooks/usePaidFeatures'
import { useExpressBeta } from '../hooks/useExpressBeta'
import { createExpressProject, getExpressProject, updateProject, getUserProfile, saveStep, updateUserProfile } from '../lib/db'
import { useUser } from '../hooks/useUser'
import { UNIVERSITIES, getFaculties } from '../data/universities'
import FyproLogo from '../components/FyproLogo'
import Spinner from '../components/Spinner'
import TourCarousel from '../features/onboarding/TourCarousel'
import { saveOnboardingAnswers } from '../lib/onboarding'
import { supabase } from '../lib/supabase'

const SHIELD_D = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

const METHODOLOGIES = ['Quantitative', 'Qualitative', 'Mixed Methods']
const LEVELS = ['300', '400', '500']

const EXPRESS_TRUST_LINES = [
  { icon: '🎓', text: 'Face 3 AI examiners — voice-enabled' },
  { icon: '📋', text: 'Defence Brief — personalised prep document' },
  { icon: '★', text: 'Certificate when you score 7+' },
]

const REFERRAL_OPTIONS = [
  'Friend or colleague', 'Twitter / X', 'TikTok', 'Instagram',
  'WhatsApp', 'Lecturer', 'Google Search', 'Other',
]

const DEFENCE_OPTIONS = [
  { label: 'This week',         value: 'this_week' },
  { label: 'Within 2 weeks',    value: 'within_2w' },
  { label: '1 month away',      value: '1m_away' },
  { label: 'More than a month', value: '1-3m' },
]

const DEFENCE_BAND_DB_MAP = {
  this_week: '<1m',
  within_2w: '<1m',
  '1m_away':  '<1m',
  '1-3m':     '1-3m',
}

const EXPRESS_SURVEY_PHASES = ['attribution', 'defence-date', 'notifications']

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

function SurveyProgressBar({ stepNum, progressPct }) {
  if (stepNum === 0) return null
  return (
    <div className="oq-progress-wrap">
      <div className="oq-progress">
        <div className="oq-progress__fill" style={{ width: `${progressPct}%` }} />
      </div>
    </div>
  )
}

function ChipScreen({ eyebrow, heading, options, selected, onSelect, onSkip, onContinue, stepNum, progressPct }) {
  return (
    <motion.div
      className="oq-question"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <SurveyProgressBar stepNum={stepNum} progressPct={progressPct} />
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
        <button type="button" className="oq-continue" disabled={!selected} onClick={onContinue}>
          Continue
        </button>
      </div>
    </motion.div>
  )
}

function NotificationsScreen({ notifyEmail, setNotifyEmail, notifyPush, setNotifyPush, onContinue, stepNum, progressPct }) {
  return (
    <motion.div
      className="oq-question"
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
    >
      <SurveyProgressBar stepNum={stepNum} progressPct={progressPct} />
      <div className="oq-question__eyebrow">STAY ON TRACK</div>
      <h1 className="oq-question__heading">Want reminders?</h1>
      <div className="oq-toggles">
        <label className={`oq-toggle-row${notifyEmail ? ' oq-toggle-row--on' : ''}`}>
          <div className="oq-toggle-info">
            <div className="oq-toggle-label">Email nudges</div>
            <div className="oq-toggle-desc">Defence prep tips and countdown reminders by email</div>
          </div>
          <div className="oq-toggle-switch">
            <input type="checkbox" checked={notifyEmail} onChange={(e) => setNotifyEmail(e.target.checked)} />
            <div className="oq-toggle-track" />
          </div>
        </label>
        <label className={`oq-toggle-row${notifyPush ? ' oq-toggle-row--on' : ''}`}>
          <div className="oq-toggle-info">
            <div className="oq-toggle-label">Push reminders</div>
            <div className="oq-toggle-desc">Get nudges on this device as your defence approaches</div>
          </div>
          <div className="oq-toggle-switch">
            <input type="checkbox" checked={notifyPush} onChange={(e) => setNotifyPush(e.target.checked)} />
            <div className="oq-toggle-track" />
          </div>
        </label>
      </div>
      <div className="oq-actions">
        <button type="button" className="oq-skip" onClick={onContinue}>Skip</button>
        <button type="button" className="oq-continue" onClick={onContinue}>Continue</button>
      </div>
    </motion.div>
  )
}

// ExpressOnboarding renders OUTSIDE the express provider stack, so its data must
// never touch the normal AppContext. It writes only to the express project row.
export default function ExpressOnboarding() {
  const navigate = useNavigate()
  const { handlePay, paying, verifying, payError, blockInfo } = usePaystackCheckout({ loginReturnUrl: '/express-onboarding' })
  const { features } = usePaidFeatures()
  const { betaFree } = useExpressBeta()
  const { user } = useUser()

  const universities = Object.keys(UNIVERSITIES)

  const [university, setUniversity] = useState('')
  const [faculty, setFaculty] = useState('')
  const [department, setDepartment] = useState('')
  const [level, setLevel] = useState('400')
  const [topic, setTopic] = useState('')
  const [methodology, setMethodology] = useState('')
  const [chapterCount, setChapterCount] = useState(5)
  const [useCustomChapters, setUseCustomChapters] = useState(false)
  const [formStep, setFormStep] = useState('form') // 'form' | 'attribution' | 'defence-date' | 'notifications' | 'walkthrough' | 'payment'
  const [showTour, setShowTour] = useState(false)
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [trustIdx, setTrustIdx] = useState(0)

  // Survey answers
  const [referralSource, setReferralSource] = useState(null)
  const [defenceBand, setDefenceBand]       = useState(null)
  const [notifyEmail, setNotifyEmail]       = useState(false)
  const [notifyPush, setNotifyPush]         = useState(false)

  const faculties = university ? getFaculties(university) : []

  // Survey progress — active only during the 3 survey phases
  const surveyStepNum     = EXPRESS_SURVEY_PHASES.indexOf(formStep) + 1
  const surveyProgressPct = surveyStepNum > 0 ? (surveyStepNum / EXPRESS_SURVEY_PHASES.length) * 100 : 0

  // Rotating trust line in the rail (paused when reduced motion)
  useEffect(() => {
    if (prefersReducedMotion()) return
    const t = setInterval(() => {
      setTrustIdx((i) => (i + 1) % EXPRESS_TRUST_LINES.length)
    }, 3500)
    return () => clearInterval(t)
  }, [])

  // Prefill the form so the user only types what's genuinely new. Two sources,
  // express project taking precedence over the saved profile:
  //   - profile (users table): university/faculty/dept/level captured at signup +
  //     standard onboarding. University is profile-only — projects has no
  //     university column.
  //   - existing express project: faculty/dept/level/title from a prior visit
  //     (auto-created blank row or a previous onboarding attempt).
  useEffect(() => {
    if (!user?.id) return
    let cancelled = false
    Promise.all([getUserProfile(user.id), getExpressProject(user.id)]).then(([profile, p]) => {
      if (cancelled) return
      if (profile?.university) setUniversity(profile.university)
      if (profile?.faculty) setFaculty(profile.faculty)
      if (profile?.department) setDepartment(profile.department)
      if (profile?.level) setLevel(profile.level)
      // Express project overrides profile defaults where it has values.
      if (p?.faculty) setFaculty(p.faculty)
      if (p?.department) setDepartment(p.department)
      if (p?.level) setLevel(p.level)
      if (p?.title) setTopic(p.title)
    })
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  async function handleFormSubmit(e) {
    e.preventDefault()
    setFormError(null)
    if (!university || !faculty || !department || !level || !topic.trim() || !methodology) {
      setFormError('Please fill in all fields.')
      return
    }
    if (topic.trim().length < 10) {
      setFormError('Please enter your full project topic.')
      return
    }
    setSubmitting(true)
    // Create (or reuse) the express project row now. Access stays gated by the
    // express_defense entitlement (RequireExpress), so a pre-payment row is
    // invisible and harmless — the payment popup redirects to /payment-success,
    // so we cannot create it "after" payment on this page.
    const existing = user?.id ? await getExpressProject(user.id) : null
    let projectId = null
    if (existing) {
      // A blank project may already exist (auto-created on a prior /express
      // visit). Update it with the details from this form rather than leaving
      // it untitled.
      await updateProject(existing.id, {
        title: topic.trim(),
        faculty,
        department,
        level,
      })
      projectId = existing.id
    } else {
      const created = await createExpressProject({
        title: topic.trim(),
        faculty,
        department,
        level,
      })
      projectId = created?.id ?? null
    }

    // university, methodology, chapterCount have no column on the projects table.
    // Save university to the users profile; the other two go to an express_context step.
    if (user?.id) {
      updateUserProfile({ university, faculty, department, level }).catch(() => {})
    }
    if (projectId) {
      const finalChapterCount = useCustomChapters ? chapterCount : 5
      saveStep(projectId, 'express_context', { methodology, chapterCount: finalChapterCount }).catch(() => {})
    }

    setSubmitting(false)

    // Already paid (resume / re-onboard) → straight into the express app.
    if (features.includes('express_defense')) {
      navigate('/express', { replace: true })
      return
    }
    setFormStep('attribution')
  }

  async function handleSaveAndPay() {
    // Fire-and-forget — network failure must not block the payment flow
    const { data: { session } } = await supabase.auth.getSession()
    const userId = session?.user?.id
    if (userId) {
      saveOnboardingAnswers(userId, {
        referral_source:       referralSource,
        expected_defence_band: DEFENCE_BAND_DB_MAP[defenceBand] ?? defenceBand,
        primary_goal:          'defence_practice',
        notify_email:          notifyEmail || null,
        notify_push:           notifyPush  || null,
      })
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
          console.warn('[express-onboarding] push subscribe failed (non-fatal):', err)
        }
      }
    }
    // Already paid or beta bypass active → show tour instead of paywall.
    if (features.includes('express_defense') || betaFree) {
      setFormStep('walkthrough')
      return
    }
    setFormStep('payment')
  }

  const isProcessing = paying === 'express_defense' || verifying || submitting

  return (
    <div className="onb">
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
              <span className="onb__trust-ic">{EXPRESS_TRUST_LINES[trustIdx].icon}</span>
              {EXPRESS_TRUST_LINES[trustIdx].text}
            </motion.div>
          </AnimatePresence>
        </div>
      </aside>

      {/* Right interactive pane */}
      <main className="onb__pane">
        <div className="onb__pane-inner">
        {formStep === 'form' && (
          <form className="eo-form" onSubmit={handleFormSubmit}>
            <div className="eo-form__eyebrow">EXPRESS DEFENCE SETUP</div>
            <h1 className="eo-form__heading">Tell us about your project</h1>
            <p className="eo-form__sub">
              You already have your project — we just need the key details so
              the examiners can ask you the right questions.
            </p>

            <div className="eo-form__field">
              <label className="eo-form__label">University</label>
              <select
                className="eo-form__select"
                value={university}
                onChange={e => { setUniversity(e.target.value); setFaculty('') }}
                required
              >
                <option value="">Select university</option>
                {universities.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>

            <div className="eo-form__field">
              <label className="eo-form__label">Faculty</label>
              <select
                className="eo-form__select"
                value={faculty}
                onChange={e => setFaculty(e.target.value)}
                disabled={!university}
                required
              >
                <option value="">Select faculty</option>
                {faculties.map(f => <option key={f} value={f}>{f}</option>)}
              </select>
            </div>

            <div className="eo-form__field">
              <label className="eo-form__label">Department</label>
              <input
                className="eo-form__input"
                type="text"
                value={department}
                onChange={e => setDepartment(e.target.value)}
                placeholder="e.g. Computer Science"
                required
              />
            </div>

            <div className="eo-form__field">
              <label className="eo-form__label">Level</label>
              <div className="eo-form__radio-group">
                {LEVELS.map(l => (
                  <label key={l} className={`eo-form__radio ${level === l ? 'eo-form__radio--active' : ''}`}>
                    <input
                      type="radio"
                      name="level"
                      value={l}
                      checked={level === l}
                      onChange={() => setLevel(l)}
                    />
                    {l}L
                  </label>
                ))}
              </div>
            </div>

            <div className="eo-form__field">
              <label className="eo-form__label">Your Project Topic</label>
              <input
                className="eo-form__input"
                type="text"
                value={topic}
                onChange={e => setTopic(e.target.value)}
                placeholder="Enter your exact project title or topic"
                required
              />
            </div>

            <div className="eo-form__field">
              <label className="eo-form__label">Research Methodology</label>
              <div className="eo-form__radio-group">
                {METHODOLOGIES.map(m => (
                  <label key={m} className={`eo-form__radio ${methodology === m ? 'eo-form__radio--active' : ''}`}>
                    <input
                      type="radio"
                      name="methodology"
                      value={m}
                      checked={methodology === m}
                      onChange={() => setMethodology(m)}
                    />
                    {m}
                  </label>
                ))}
              </div>
            </div>

            <div className="eo-form__field">
              <label className="eo-form__label">Chapter Structure</label>
              <div className="eo-form__radio-group">
                <label className={`eo-form__radio ${!useCustomChapters ? 'eo-form__radio--active' : ''}`}>
                  <input
                    type="radio"
                    name="chapters"
                    checked={!useCustomChapters}
                    onChange={() => setUseCustomChapters(false)}
                  />
                  Standard 5 chapters
                </label>
                <label className={`eo-form__radio ${useCustomChapters ? 'eo-form__radio--active' : ''}`}>
                  <input
                    type="radio"
                    name="chapters"
                    checked={useCustomChapters}
                    onChange={() => setUseCustomChapters(true)}
                  />
                  Custom
                </label>
              </div>
              {useCustomChapters && (
                <input
                  className="eo-form__input"
                  type="number"
                  min={3}
                  max={10}
                  value={chapterCount}
                  onChange={e => setChapterCount(Number(e.target.value))}
                  style={{ marginTop: 8, width: 100 }}
                />
              )}
            </div>

            {formError && <p className="eo-form__error">{formError}</p>}

            <button type="submit" className="eo-form__submit" disabled={submitting}>
              {submitting ? <Spinner /> : 'Continue →'}
            </button>
          </form>
        )}

        {/* Survey screens — shown after form, before payment */}
        <AnimatePresence mode="wait">
          {formStep === 'attribution' && (
            <ChipScreen
              key="attribution"
              eyebrow="HOW DID YOU FIND EXPRESS DEFENCE?"
              heading="How did you hear about Express Defence?"
              options={REFERRAL_OPTIONS}
              selected={referralSource}
              onSelect={setReferralSource}
              onSkip={() => setFormStep('defence-date')}
              onContinue={() => setFormStep('defence-date')}
              stepNum={surveyStepNum}
              progressPct={surveyProgressPct}
            />
          )}
          {formStep === 'defence-date' && (
            <ChipScreen
              key="defence-date"
              eyebrow="HOW SOON IS YOUR DEFENCE?"
              heading="When are you walking in?"
              options={DEFENCE_OPTIONS}
              selected={defenceBand}
              onSelect={setDefenceBand}
              onSkip={() => setFormStep('notifications')}
              onContinue={() => setFormStep('notifications')}
              stepNum={surveyStepNum}
              progressPct={surveyProgressPct}
            />
          )}
          {formStep === 'notifications' && (
            <NotificationsScreen
              key="notifications"
              notifyEmail={notifyEmail}
              setNotifyEmail={setNotifyEmail}
              notifyPush={notifyPush}
              setNotifyPush={setNotifyPush}
              onContinue={handleSaveAndPay}
              stepNum={surveyStepNum}
              progressPct={surveyProgressPct}
            />
          )}
        </AnimatePresence>

        {formStep === 'walkthrough' && !showTour && (
          <div className="wt2-screen">
            <div className="wt2-modal" role="dialog" aria-modal="true" aria-labelledby="wt2-express-heading">
              <div className="wt2-inner">
                <div className="wt2-icon-block">
                  <div className="wt2-shield-wrap" aria-hidden="true">
                    <svg className="wt2-shield-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="#0066FF" aria-hidden="true">
                      <path d={SHIELD_D} />
                    </svg>
                  </div>
                </div>
                <div className="wt2-heading-block">
                  <div className="wt2-eyebrow">Express Defence awaits</div>
                  <h2 className="wt2-heading" id="wt2-express-heading">Quick look at how it works?</h2>
                </div>
                <div className="wt2-bullets" role="list">
                  {[
                    'Upload your project document for a full AI review',
                    'Get your personalised Defence Brief with model answers',
                    'Face 3 AI examiners in the Defence Simulator',
                  ].map((b) => (
                    <div key={b} className="wt2-bullet" role="listitem">
                      <div className="wt2-check" aria-hidden="true">
                        <svg viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" /></svg>
                      </div>
                      <span className="wt2-bullet-text">{b}</span>
                    </div>
                  ))}
                </div>
                <div className="wt2-btn-group">
                  <button
                    className="wt2-btn-primary"
                    onClick={() => setShowTour(true)}
                  >
                    Take the tour <span className="wt2-arrow" aria-hidden="true">→</span>
                  </button>
                  <button
                    className="wt2-btn-ghost"
                    onClick={() => {
                      localStorage.setItem('fypro_express_tour_seen', '1')
                      navigate('/express', { replace: true })
                    }}
                  >
                    Skip to my dashboard
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {formStep === 'walkthrough' && showTour && (
          <TourCarousel
            variant="express"
            onClose={() => {
              localStorage.setItem('fypro_express_tour_seen', '1')
              navigate('/express', { replace: true })
            }}
          />
        )}

        {formStep === 'payment' && (
          <div className="eo-payment">
            <div className="eo-payment__eyebrow">EXPRESS DEFENCE PACK</div>
            <h2 className="eo-payment__heading">You&apos;re one step away</h2>
            <ul className="eo-payment__features">
              <li>Defence Brief — personalised opening statement, model answers, and examiner Q&amp;A prep</li>
              <li>Project Reviewer — full AI review of your submitted document</li>
              <li>Defence Simulator — 3 AI examiners, voice-enabled, real hostile questions</li>
              <li>Defence certificate if you score 7+</li>
            </ul>
            <div className="eo-payment__price">₦2,000 <span>one-time payment</span></div>
            {blockInfo && <p className="eo-form__error">{blockInfo.message}</p>}
            {payError && <p className="eo-form__error">{payError}</p>}
            <button
              className="eo-payment__btn"
              onClick={() => handlePay('express_defense')}
              disabled={isProcessing}
              style={isProcessing ? { opacity: 0.7, cursor: 'not-allowed' } : {}}
            >
              {isProcessing ? <Spinner /> : 'Pay ₦2,000 with Paystack'}
            </button>
            <button
              className="eo-payment__back"
              onClick={() => setFormStep('notifications')}
              disabled={isProcessing}
            >
              ← Back
            </button>
          </div>
        )}
        </div>
      </main>
    </div>
  )
}
