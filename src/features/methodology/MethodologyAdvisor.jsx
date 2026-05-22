import { useState, useRef, useEffect } from 'react'
import { adviseMethodology, buildInstrument, handleApiError, logFailure } from '../../services/api'
import { checkAndRecord, useRunLimit } from '../../hooks/useRunLimit'
import { usePaidFeatures } from '../../hooks/usePaidFeatures'
import { useApp } from '../../context/AppContext'
import { showToast } from '../../components/Toast'
import ApiErrorBox from '../../components/ApiErrorBox'
import LoadingMessages from '../../components/LoadingMessages'
import { useProjectState } from '../../hooks/useProjectState'
import FeedbackThumbs from '../../components/feedback/FeedbackThumbs'
import { markStepComplete } from '../../lib/progress'
import { trackEvent } from '../../lib/analytics'

const MA_LOADING_MESSAGES = [
  'Evaluating research approaches...',
  'Matching methods to your topic...',
  'Almost done...',
]

const GENERIC_LOADING_MESSAGES = [
  'Generating your analysis...',
  'Reviewing the details...',
  'Almost done...',
]

export default function MethodologyAdvisor() {
  const { state, studentContext, navigateStep, set } = useApp()
  const { saveStep, projectId } = useProjectState()
  const { features } = usePaidFeatures()
  const hasPaid = features.includes('student_pack') || features.includes('defense_pack')
  const { isOverLimit } = useRunLimit(features)
  const maOverLimit = isOverLimit('methodology_advisor')
  const diOverLimit = isOverLimit('instrument_builder')

  // ── MA state — seed from persisted context on remount ─────────────────────
  const [maHasSubmitted, setMaHasSubmitted]           = useState(false)
  const [diHasSubmitted, setDiHasSubmitted]           = useState(false)
  const [maSection, setMaSection]                     = useState(state.methodology ? 'result' : 'input')
  const [maData, setMaData]                           = useState(state.methodology || null)
  const [maError, setMaError]                         = useState(null)
  const [maBtnDisabled, setMaBtnDisabled]             = useState(false)
  const [selectedMethodology, setSelectedMethodology] = useState(state.chosenMethodology || '')
  const [defenseRevealed, setDefenseRevealed]         = useState(false)

  // ── DI state ───────────────────────────────────────────────────────────────
  const [confirmDone, setConfirmDone]           = useState(state.stepsCompleted[2] || false)
  const [diVisible, setDiVisible]               = useState(state.stepsCompleted[2] || false)
  const [diSection, setDiSection]               = useState(() => state.instrumentBuilder ? 'result' : 'input')
  const [diData, setDiData]                     = useState(() => state.instrumentBuilder ?? null)

  // Late hydration: Supabase instrument data arrives after mount
  useEffect(() => {
    if (state.instrumentBuilder && !diData) {
      setDiData(state.instrumentBuilder)
      setDiSection('result')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.instrumentBuilder])
  const [diError, setDiError]                   = useState(null)
  const [diGenBtnDisabled, setDiGenBtnDisabled] = useState(false)
  const [instrumentCopied, setInstrumentCopied] = useState(false)
  const instrumentTextRef = useRef('')
  const diCardRef         = useRef(null)
  const maLoadingTimerRef = useRef(null)
  const diLoadingTimerRef = useRef(null)
  const maInflightRef     = useRef(false)
  const diInflightRef     = useRef(false)

  // Safety timeout: force-stop MA loading after 30s
  useEffect(() => {
    if (maSection === 'loading') {
      maLoadingTimerRef.current = setTimeout(() => {
        setMaSection('input')
        setMaBtnDisabled(false)
        setMaError('Request timed out. Please check your connection and try again.')
      }, 55000)
    } else {
      clearTimeout(maLoadingTimerRef.current)
    }
    return () => clearTimeout(maLoadingTimerRef.current)
  }, [maSection])

  // Safety timeout: force-stop DI loading after 30s
  useEffect(() => {
    if (diSection === 'loading') {
      diLoadingTimerRef.current = setTimeout(() => {
        setDiSection('input')
        setDiGenBtnDisabled(false)
        setDiError('Request timed out. Please check your connection and try again.')
      }, 55000)
    } else {
      clearTimeout(diLoadingTimerRef.current)
    }
    return () => clearTimeout(diLoadingTimerRef.current)
  }, [diSection])

  // ── MA handlers ────────────────────────────────────────────────────────────

  async function handleAnalyse() {
    if (maInflightRef.current) return
    setMaError(null)
    maInflightRef.current = true
    setMaBtnDisabled(true)

    const allowed = await checkAndRecord('methodology_advisor', features)
    if (!allowed) {
      maInflightRef.current = false
      setMaBtnDisabled(false)
      return
    }

    trackEvent('workflow_step_started', { step: 'methodology_advisor' })
    setMaHasSubmitted(true)
    setMaSection('loading')

    adviseMethodology(studentContext, state.validatedTopic, state.chapterStructure, features)
      .then(data => {
        maInflightRef.current = false
        setMaData(data)
        setMaSection('result')
        setMaBtnDisabled(false)
        saveStep('methodology_advisor', data)
      })
      .catch(err => {
        maInflightRef.current = false
        logFailure('Methodology Advisor', err, state.validatedTopic || '')
        setMaSection('input')
        if (!handleApiError(err, msg => {
          setMaError(msg)
          if (!msg) setMaBtnDisabled(false)
        })) {
          setMaBtnDisabled(false)
          setMaError('Something went wrong. Please check your connection and try again.')
        }
      })
  }

  function handleSelectMethodology(methodology) {
    setSelectedMethodology(methodology)
  }

  function handleRevealDefense() {
    setDefenseRevealed(true)
  }

  function handleConfirm() {
    if (!maData || !selectedMethodology) return
    const updatedStepsCompleted = [...state.stepsCompleted]
    updatedStepsCompleted[2] = true
    set({
      methodology: maData,
      chosenMethodology: selectedMethodology,
      stepsCompleted: updatedStepsCompleted,
    })
    saveStep('methodology_advisor', { ...maData, chosen_methodology: selectedMethodology })
    markStepComplete('methodology_advisor')
    showToast('Methodology confirmed ✓')
    setConfirmDone(true)
    setDiVisible(true)
    // Scroll DI card into view once it mounts
    setTimeout(() => {
      if (diCardRef.current) {
        diCardRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }, 50)
  }

  // ── DI handlers ────────────────────────────────────────────────────────────

  async function handleGenerateInstrument() {
    if (diInflightRef.current) return
    setDiError(null)
    diInflightRef.current = true
    setDiGenBtnDisabled(true)

    const allowed = await checkAndRecord('instrument_builder', features)
    if (!allowed) {
      diInflightRef.current = false
      setDiGenBtnDisabled(false)
      return
    }
    setDiHasSubmitted(true)
    setDiSection('loading')

    buildInstrument(studentContext, state.validatedTopic, selectedMethodology, state.chapterStructure)
      .then(data => {
        diInflightRef.current = false
        buildPlainText(data)
        setDiData(data)
        setDiSection('result')
        set({ instrumentBuilder: data })
        saveStep('instrument_builder', data)
      })
      .catch(err => {
        diInflightRef.current = false
        logFailure('Instrument Builder', err, selectedMethodology)
        setDiSection('input')
        if (!handleApiError(err, msg => {
          setDiError(msg)
          if (!msg) setDiGenBtnDisabled(false)
        })) {
          setDiGenBtnDisabled(false)
          setDiError('Something went wrong. Please check your connection and try again.')
        }
      })
  }

  function buildPlainText(data) {
    const lines = [
      data.instrument_title || 'Research Instrument',
      'Methodology: ' + (data.methodology || ''),
      'Topic: ' + (state.validatedTopic || ''),
      '',
    ]
    ;(data.sections || []).forEach(section => {
      lines.push((section.section_title || '').toUpperCase(), '')
      ;(section.questions || []).forEach(q => {
        let line = q.number + '. ' + (q.text || '')
        line += q.type === 'likert' && q.scale
          ? '  [SA] [A] [N] [D] [SD]'
          : '\n   _______________________________________________'
        lines.push(line, '')
      })
      lines.push('')
    })
    instrumentTextRef.current = lines.join('\n')
  }

  function handleCopyInstrument() {
    const text = instrumentTextRef.current

    function onSuccess() {
      setInstrumentCopied(true)
      setTimeout(() => setInstrumentCopied(false), 2000)
    }

    function onFail() {
      const ta = document.createElement('textarea')
      ta.value = text
      ta.style.cssText = 'position:fixed;opacity:0'
      document.body.appendChild(ta)
      ta.select()
      try { document.execCommand('copy'); onSuccess() } catch (_) {}
      document.body.removeChild(ta)
    }

    if (navigator.clipboard?.writeText) {
      navigator.clipboard.writeText(text).then(onSuccess).catch(onFail)
    } else {
      onFail()
    }
  }

  function handleInstrumentContinue() {
    document.dispatchEvent(new CustomEvent('step4:init'))
    navigateStep(3)
  }

  // ── Helpers ────────────────────────────────────────────────────────────────

  function normalizeFitKey(fitScore) {
    const k = (fitScore || 'moderate').toLowerCase()
    return (k === 'strong' || k === 'weak') ? k : 'moderate'
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const options        = maData?.options || []
  const confirmEnabled = !!selectedMethodology

  return (
    <>
      {/* ── Methodology Advisor card ────────────────────────────────────────── */}
      <div className="ma-card" id="ma-card">

        {/* Input section */}
        <div
          id="ma-input-section"
          className={`ma-input-section ${maSection === 'input' ? 'tv-section--visible' : 'tv-section--hidden'}`}
        >
          <button className="fy-back-btn" onClick={() => navigateStep(1)}>
            ← Back to Chapter Architect
          </button>
          <p className="ma-step-label">Step 3: Methodology Advisor</p>
          <p className="ma-description">
            FYPro will analyse all three research paradigms for your specific topic — Quantitative,
            Qualitative, and Mixed Methods — and explain the trade-offs of each. Claude will
            recommend one, but the final choice is yours.
          </p>
          <ApiErrorBox error={maError} onRetry={handleAnalyse} />
          <button
            id="btn-analyse"
            className="ma-btn-analyse"
            onClick={handleAnalyse}
            disabled={maBtnDisabled || maOverLimit}
            style={maOverLimit ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
          >
            {maBtnDisabled ? 'Working…' : 'Analyse Methodology'}
          </button>
          {maOverLimit && (
            <p className="ma-error-text" style={{ marginTop: 8 }}>
              You've reached your limit for this feature. Start a new project or upgrade your plan.
            </p>
          )}

          {/* Empty state — shown before first generation */}
          {!maData && (
            <p style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.8125rem',
              color: 'var(--color-text-muted)',
              marginTop: '20px',
              lineHeight: 1.6,
              textAlign: 'center',
            }}>
              Select your research methodology above. FYPro will recommend data collection approaches,
              sample size guidance, and analysis techniques tailored to your topic and discipline.
            </p>
          )}
        </div>

        {/* Loading section */}
        {maSection === 'loading' && maHasSubmitted && (
          <div id="ma-loading-section" className="ma-loading-section tv-section--visible">
            <div className="skeleton-loader">
              <div className="skeleton-bar" style={{ width: '100%' }} />
              <div className="skeleton-bar" style={{ width: '75%' }} />
              <div className="skeleton-bar" style={{ width: '90%' }} />
              <div className="skeleton-bar" style={{ width: '60%' }} />
            </div>
            <LoadingMessages messages={MA_LOADING_MESSAGES} />
          </div>
        )}

        {/* Result section */}
        <div
          id="ma-result-section"
          className={`ma-result-section ${maSection === 'result' ? 'tv-section--visible' : 'tv-section--hidden'}`}
        >
          {maData && (
            <>
              {/* CLAUDE RECOMMENDS banner */}
              <div id="ma-rec-banner" className="ma-rec-banner">
                <p className="ma-rec-label">Claude Recommends</p>
                <p id="ma-rec-name" className="ma-rec-name">{maData.recommended || ''}</p>
                <p id="ma-rec-reason" className="ma-rec-reason">{maData.recommended_reason || ''}</p>
              </div>

              {/* Methodology option cards — stacked vertically */}
              <div id="ma-options-list" className="ma-options-list">
                {options.map((option, idx) => {
                  const fitKey        = normalizeFitKey(option.fit_score)
                  const isRecommended = option.methodology === maData.recommended
                  const isSelected    = option.methodology === selectedMethodology
                  const isDimmed      = !!selectedMethodology && !isSelected

                  return (
                    <div
                      key={idx}
                      style={{ '--ma-card-delay': `${idx * 100}ms` }}
                      className={[
                        'ma-option-card',
                        isSelected ? 'ma-option-card--selected' : '',
                        isDimmed   ? 'ma-option-card--dimmed'   : '',
                      ].filter(Boolean).join(' ')}
                      data-methodology={option.methodology}
                    >
                      <div className="ma-option-header">
                        <p className="ma-option-name">{option.methodology}</p>
                        <span className={`ma-fit-badge ma-fit-badge--${fitKey}`}>
                          {option.fit_score}
                        </span>
                        {isRecommended && (
                          <span className="ma-recommended-tag">★ Recommended</span>
                        )}
                      </div>
                      <p className="ma-explanation">{option.explanation}</p>
                      <div>
                        <p className="ma-section-label">Data Collection</p>
                        <ul className="ma-data-list">
                          {(option.data_collection || []).map((method, mi) => (
                            <li key={mi}>{method}</li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="ma-section-label">Instruments</p>
                        <ul className="ma-instruments-list">
                          {(option.instruments || []).map((inst, ii) => (
                            <li key={ii} className="ma-instrument-item">
                              <p className="ma-instrument-name">{inst.name}</p>
                              <p className="ma-instrument-access">{inst.access}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                      <div>
                        <p className="ma-section-label">Trade-offs</p>
                        <p className="ma-trade-offs">{option.trade_offs}</p>
                      </div>
                      <button
                        className={`ma-btn-select${isSelected ? ' ma-btn-select--active' : ''}`}
                        onClick={() => handleSelectMethodology(option.methodology)}
                      >
                        {isSelected ? 'Selected ✓' : 'Select This Methodology'}
                      </button>
                    </div>
                  )
                })}
              </div>

              {/* Defense answer — below all option cards */}
              <div id="ma-defense-section" className="ma-defense-section">
                <p className="ma-bento-cell-label">Defense Answer</p>
                <p className="ma-defense-hint">
                  A word-for-word script to memorise and deliver if asked to justify your
                  methodology choice in your defense.
                </p>
                <div
                  id="ma-defense-body"
                  className={`ma-defense-body${defenseRevealed ? '' : ' ma-defense-body--blurred'}`}
                >
                  <p id="ma-defense-text" className="ma-defense-text">
                    {maData.defense_answer_template || ''}
                  </p>
                </div>
                {!defenseRevealed && (
                  <button
                    id="btn-reveal-defense"
                    className="ma-btn-reveal"
                    onClick={handleRevealDefense}
                  >
                    Reveal Defense Answer
                  </button>
                )}
              </div>

              {/* Watch Out — below defense */}
              <div id="ma-watch-out" className="ma-watch-out-box">
                <p className="ma-watch-out-label">⚠ Watch Out</p>
                <p id="ma-watch-out-text" className="ma-watch-out-text">
                  {maData.watch_out || ''}
                </p>
              </div>

              <button
                id="btn-confirm-method"
                className="ma-btn-confirm"
                onClick={handleConfirm}
                disabled={!confirmEnabled}
              >
                Confirm Methodology
              </button>

              {confirmDone && (
                <button
                  className="di-btn-continue"
                  style={{ marginTop: '12px' }}
                  onClick={() => navigateStep(3)}
                >
                  Continue to Writing Planner →
                </button>
              )}

              <FeedbackThumbs feature="methodology_advisor" contextId={projectId || undefined} />
            </>
          )}
        </div>

      </div>

      {/* ── Data Collection Instrument Builder card — student_pack only ──────── */}
      {diVisible && hasPaid && (
        <div className="di-card" id="di-card" ref={diCardRef}>

          {/* DI Input section */}
          <div
            id="di-input-section"
            className={`di-input-section ${diSection === 'input' ? 'tv-section--visible' : 'tv-section--hidden'}`}
          >
            <p className="di-step-label">Optional: Data Collection Instrument</p>
            <span className="di-methodology-badge">{selectedMethodology}</span>
            <p className="di-description">
              FYPro will draft a complete, topic-specific data collection instrument based on your
              confirmed methodology — structured questionnaire, interview guide, or both.
            </p>
            <ApiErrorBox error={diError} onRetry={handleGenerateInstrument} />
            <button
              id="btn-generate-instrument"
              className="di-btn-generate"
              onClick={handleGenerateInstrument}
              disabled={diGenBtnDisabled || diOverLimit}
              style={diOverLimit ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
            >
              {diGenBtnDisabled ? 'Working…' : 'Generate Instrument'}
            </button>
            {diOverLimit && (
              <p className="di-error-text" style={{ marginTop: 8 }}>
                You've reached your limit for this feature. Start a new project or upgrade your plan.
              </p>
            )}
          </div>

          {/* DI Loading section */}
          {diSection === 'loading' && diHasSubmitted && (
            <div id="di-loading-section" className="di-loading-section tv-section--visible">
              <div className="skeleton-loader">
                <div className="skeleton-bar" style={{ width: '100%' }} />
                <div className="skeleton-bar" style={{ width: '75%' }} />
                <div className="skeleton-bar" style={{ width: '90%' }} />
                <div className="skeleton-bar" style={{ width: '60%' }} />
              </div>
              <LoadingMessages messages={GENERIC_LOADING_MESSAGES} />
            </div>
          )}

          {/* DI Result section */}
          <div
            id="di-result-section"
            className={`di-result-section ${diSection === 'result' ? 'tv-section--visible' : 'tv-section--hidden'}`}
          >
            {diData && (
              <>
                <p id="di-instrument-title" className="di-instrument-title">
                  {diData.instrument_title || 'Research Instrument'}
                </p>
                <div id="di-instrument-body" className="di-instrument-body">
                  {(diData.sections || []).map((section, si) => (
                    <div key={si} className="di-section">
                      <p className="di-section-title">{section.section_title}</p>
                      {(section.questions || []).map((q, qi) => (
                        <div key={qi} className="di-question">
                          <span className="di-question-number">{q.number}.</span>
                          <div className="di-question-content">
                            <p className="di-question-text">{q.text}</p>
                            {q.type === 'likert' && q.scale ? (
                              <div className="di-likert-scale">
                                {q.scale.split('/').map((label, li) => (
                                  <span key={li} className="di-likert-option">{label.trim()}</span>
                                ))}
                              </div>
                            ) : (
                              <div className="di-open-line" />
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                <div className="di-actions">
                  <button
                    id="btn-copy-instrument"
                    className="di-btn-copy"
                    onClick={handleCopyInstrument}
                  >
                    {instrumentCopied ? 'Copied ✓' : 'Copy Instrument'}
                  </button>
                  <button
                    id="btn-instrument-continue"
                    className="di-btn-continue"
                    onClick={handleInstrumentContinue}
                  >
                    Continue — Writing Planner
                  </button>
                </div>

                <FeedbackThumbs feature="instrument_builder" contextId={projectId || undefined} />
              </>
            )}
          </div>

        </div>
      )}
    </>
  )
}
