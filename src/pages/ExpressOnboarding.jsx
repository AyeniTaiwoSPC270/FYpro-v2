import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { usePaystackCheckout } from '../hooks/usePaystackCheckout'
import { UNIVERSITIES, getFaculties } from '../data/universities'
import FyproLogo from '../components/FyproLogo'
import Spinner from '../components/Spinner'

const METHODOLOGIES = ['Quantitative', 'Qualitative', 'Mixed Methods']
const LEVELS = ['300', '400', '500']

export default function ExpressOnboarding() {
  const navigate = useNavigate()
  const { set, state } = useApp()
  const { handlePay, paying, verifying, payError, blockInfo } = usePaystackCheckout({ loginReturnUrl: '/express-onboarding' })

  const universities = Object.keys(UNIVERSITIES)

  const [university, setUniversity] = useState(state.university || '')
  const [faculty, setFaculty] = useState(state.faculty || '')
  const [department, setDepartment] = useState(state.department || '')
  const [level, setLevel] = useState(state.level || '400')
  const [topic, setTopic] = useState('')
  const [methodology, setMethodology] = useState('')
  const [chapterCount, setChapterCount] = useState(5)
  const [useCustomChapters, setUseCustomChapters] = useState(false)
  const [formStep, setFormStep] = useState('form') // 'form' | 'payment'
  const [formError, setFormError] = useState(null)

  const faculties = university ? getFaculties(university) : []

  function handleFormSubmit(e) {
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
    set({
      university,
      faculty,
      department,
      level,
      validatedTopic: topic.trim(),
      chosenMethodology: methodology,
      chapterStructure: {
        total_chapters: useCustomChapters ? chapterCount : 5,
        total_word_count: null,
        chapters: [],
      },
    })
    setFormStep('payment')
  }

  const isProcessing = paying === 'express_defense' || verifying

  return (
    <div className="eo-page">
      <header className="eo-header">
        <FyproLogo />
      </header>

      <main className="eo-main">
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

            <button type="submit" className="eo-form__submit">
              Continue to Payment →
            </button>
          </form>
        )}

        {formStep === 'payment' && (
          <div className="eo-payment">
            <div className="eo-payment__eyebrow">EXPRESS DEFENCE PACK</div>
            <h2 className="eo-payment__heading">You&apos;re one step away</h2>
            <ul className="eo-payment__features">
              <li>Red Flag Scanner — find your project&apos;s weaknesses before the panel does</li>
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
            {/* TEST ONLY — remove before final demo */}
            <button
              className="eo-payment__back"
              onClick={() => navigate('/express')}
              style={{ color: 'var(--color-amber)', marginTop: 4 }}
            >
              [TEST] Skip payment → enter
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
      </main>
    </div>
  )
}
