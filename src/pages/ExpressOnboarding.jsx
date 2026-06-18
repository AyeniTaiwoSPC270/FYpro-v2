import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { usePaystackCheckout } from '../hooks/usePaystackCheckout'
import { usePaidFeatures } from '../hooks/usePaidFeatures'
import { createExpressProject, getExpressProject, updateProject, getUserProfile } from '../lib/db'
import { useUser } from '../hooks/useUser'
import { UNIVERSITIES, getFaculties } from '../data/universities'
import FyproLogo from '../components/FyproLogo'
import Spinner from '../components/Spinner'

const SHIELD_D = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

const METHODOLOGIES = ['Quantitative', 'Qualitative', 'Mixed Methods']
const LEVELS = ['300', '400', '500']

const EXPRESS_TRUST_LINES = [
  { icon: '🎓', text: 'Face 3 AI examiners — voice-enabled' },
  { icon: '📋', text: 'Defence Brief — personalised prep document' },
  { icon: '★', text: 'Certificate when you score 7+' },
]

function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

// ExpressOnboarding renders OUTSIDE the express provider stack, so its data must
// never touch the normal AppContext. It writes only to the express project row.
export default function ExpressOnboarding() {
  const navigate = useNavigate()
  const { handlePay, paying, verifying, payError, blockInfo } = usePaystackCheckout({ loginReturnUrl: '/express-onboarding' })
  const { features } = usePaidFeatures()
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
  const [formStep, setFormStep] = useState('form') // 'form' | 'payment'
  const [formError, setFormError] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [trustIdx, setTrustIdx] = useState(0)

  const faculties = university ? getFaculties(university) : []

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
    } else {
      await createExpressProject({
        title: topic.trim(),
        faculty,
        department,
        level,
      })
    }
    setSubmitting(false)

    // Already paid (resume / re-onboard) → straight into the express app.
    if (features.includes('express_defense')) {
      navigate('/express', { replace: true })
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
              {submitting ? <Spinner /> : 'Continue to Payment →'}
            </button>
          </form>
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
              onClick={() => setFormStep('form')}
              disabled={isProcessing}
            >
              ← Edit project details
            </button>
          </div>
        )}
        </div>
      </main>
    </div>
  )
}
