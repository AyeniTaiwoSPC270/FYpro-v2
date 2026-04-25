import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { adviseMethodology, buildInstrument } from '../../services/api'
import { handleApiError } from '../../services/api'
import { showToast } from '../../components/Toast'

function InstrumentBuilder({ methodology, studentContext, validatedTopic, chapterStructure, onContinue }) {
  const [section, setSection] = useState('input')
  const [instrumentData, setInstrumentData] = useState(null)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  async function handleGenerate() {
    setError('')
    setSection('loading')
    try {
      const data = await buildInstrument(studentContext, validatedTopic, methodology, chapterStructure)
      setInstrumentData(data)
      setSection('result')
    } catch (err) {
      setSection('input')
      handleApiError(err, (msg) => setError(msg || 'Something went wrong. Try again.'))
    }
  }

  function handleCopy() {
    if (!instrumentData) return
    const text = [
      instrumentData.title || '',
      '',
      ...(instrumentData.sections || []).map((s) => [
        s.heading || '',
        ...(s.questions || []).map((q, i) => `${i + 1}. ${q}`),
        '',
      ].join('\n')),
    ].join('\n')
    navigator.clipboard.writeText(text)
    setCopied(true)
    showToast('Instrument copied!', 'success')
    setTimeout(() => setCopied(false), 2500)
  }

  return (
    <div className="di-card" id="di-card">
      <div className={`di-input-section${section === 'input' ? ' tv-section--visible' : ' tv-section--hidden'}`}>
        <p className="di-step-label">Step 4: Data Collection Instrument</p>
        <span className="di-methodology-badge">{methodology}</span>
        <p className="di-description">
          FYPro will draft a complete, topic-specific data collection instrument based on your confirmed methodology — structured questionnaire, interview guide, or both.
        </p>
        {error && <p className="di-error-text tv-section--visible">{error}</p>}
        <button className="di-btn-generate" onClick={handleGenerate}>Generate Instrument</button>
      </div>

      <div className={`di-loading-section${section === 'loading' ? ' tv-section--visible' : ' tv-section--hidden'}`}>
        <div className="skeleton-loader">
          <div className="skeleton-bar" style={{ width: '100%' }} />
          <div className="skeleton-bar" style={{ width: '75%' }} />
          <div className="skeleton-bar" style={{ width: '90%' }} />
          <div className="skeleton-bar" style={{ width: '60%' }} />
        </div>
        <p className="tv-loading-text">Drafting your research instrument…</p>
      </div>

      {instrumentData && (
        <div className={`di-result-section${section === 'result' ? ' tv-section--visible' : ' tv-section--hidden'}`}>
          <p className="di-instrument-title">{instrumentData.title}</p>
          <div className="di-instrument-body">
            {(instrumentData.sections || []).map((s, i) => (
              <div key={i} className="di-instrument-section">
                {s.heading && <p className="di-section-heading">{s.heading}</p>}
                {s.instruction && <p className="di-section-instruction">{s.instruction}</p>}
                <ol className="di-questions-list">
                  {(s.questions || []).map((q, j) => (
                    <li key={j} className="di-question-item">{q}</li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
          <div className="di-actions">
            <button className="di-btn-copy" onClick={handleCopy}>
              {copied ? 'Copied ✓' : 'Copy Instrument'}
            </button>
            <button className="di-btn-continue" onClick={onContinue}>
              Continue — Writing Planner
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

export default function MethodologyAdvisor() {
  const { state, set, completeStep, navigateStep, studentContext } = useApp()

  const [section, setSection] = useState(
    state.stepsCompleted[2] ? 'result' : 'input'
  )
  const [methodData, setMethodData] = useState(state.methodology || null)
  const [selected, setSelected] = useState(state.chosenMethodology || '')
  const [defenseRevealed, setDefenseRevealed] = useState(false)
  const [error, setError] = useState('')
  const [showInstrument, setShowInstrument] = useState(Boolean(state.chosenMethodology))

  useEffect(() => {
    if (state.methodology) {
      setMethodData(state.methodology)
      if (state.stepsCompleted[2]) {
        setSection('result')
        setShowInstrument(true)
      }
    }
  }, []) // eslint-disable-line

  async function handleAnalyse() {
    setError('')
    setSection('loading')
    try {
      const data = await adviseMethodology(studentContext, state.validatedTopic, state.chapterStructure)
      setMethodData(data)
      set({ methodology: data })
      setSection('result')
      showToast('Analysis complete', 'success')
    } catch (err) {
      setSection('input')
      handleApiError(err, (msg) => {
        setError(msg || 'Something went wrong. Please check your connection and try again.')
        showToast('Something went wrong. Try again.', 'error')
      })
    }
  }

  function handleSelectMethodology(name) {
    setSelected(name)
  }

  function handleConfirm() {
    if (!methodData || !selected) return
    set({ chosenMethodology: selected })
    completeStep(2)
    showToast('Step 4 unlocked', 'unlock')
    setShowInstrument(true)
  }

  function handleInstrumentContinue() {
    completeStep(2)
    navigateStep(3)
  }

  const fitKey = (score) => {
    const k = (score || 'moderate').toLowerCase()
    return ['strong', 'moderate', 'weak'].includes(k) ? k : 'moderate'
  }

  return (
    <>
      <div className="ma-card" id="ma-card">

        {/* ── Input Section ── */}
        <div
          id="ma-input-section"
          className={`ma-input-section${section === 'input' ? ' tv-section--visible' : ' tv-section--hidden'}`}
        >
          <button className="fy-back-btn" onClick={() => navigateStep(1)}>
            ← Back to Chapter Architect
          </button>
          <p className="ma-step-label">Step 3: Methodology Advisor</p>
          <p className="ma-description">
            FYPro will analyse all three research paradigms for your specific topic — Quantitative, Qualitative, and Mixed Methods — and explain the trade-offs of each. Claude will recommend one, but the final choice is yours.
          </p>
          {error && <p id="ma-error-text" className="ma-error-text tv-section--visible">{error}</p>}
          <button id="btn-analyse" className="ma-btn-analyse" onClick={handleAnalyse}>
            Analyse Methodology
          </button>
        </div>

        {/* ── Loading Section ── */}
        <div
          id="ma-loading-section"
          className={`ma-loading-section${section === 'loading' ? ' tv-section--visible' : ' tv-section--hidden'}`}
        >
          <div className="skeleton-loader">
            <div className="skeleton-bar" style={{ width: '100%' }} />
            <div className="skeleton-bar" style={{ width: '75%' }} />
            <div className="skeleton-bar" style={{ width: '90%' }} />
            <div className="skeleton-bar" style={{ width: '60%' }} />
          </div>
          <p className="tv-loading-text">Weighing your methodology options…</p>
        </div>

        {/* ── Result Section ── */}
        {methodData && (
          <div
            id="ma-result-section"
            className={`ma-result-section${section === 'result' ? ' tv-section--visible' : ' tv-section--hidden'}`}
          >
            <div className="ma-bento-grid">

              {/* Row 1: Claude Recommends */}
              <div id="ma-rec-banner" className="ma-bento-rec">
                <p className="ma-rec-label">Claude Recommends</p>
                <p id="ma-rec-name" className="ma-rec-name">{methodData.recommended}</p>
              </div>

              {/* Row 2: Justification | Defense Answer */}
              <div className="ma-bento-row2">
                <div className="ma-bento-justification">
                  <p className="ma-bento-cell-label">Justification</p>
                  <p id="ma-rec-reason" className="ma-bento-cell-body">{methodData.recommended_reason}</p>
                </div>
                <div className="ma-bento-defense" id="ma-defense-section">
                  <p className="ma-bento-cell-label">Defense Answer</p>
                  <p className="ma-defense-hint">
                    A word-for-word script to memorise and deliver if asked to justify your methodology choice in your defense.
                  </p>
                  <div className={`ma-defense-body${defenseRevealed ? '' : ' ma-defense-body--blurred'}`}>
                    <p id="ma-defense-text" className="ma-defense-text">
                      {methodData.defense_answer_template}
                    </p>
                  </div>
                  {!defenseRevealed && (
                    <button
                      id="btn-reveal-defense"
                      className="ma-btn-reveal"
                      onClick={() => setDefenseRevealed(true)}
                    >
                      Reveal Defense Answer
                    </button>
                  )}
                </div>
              </div>

              {/* Row 3: Watch Out */}
              {methodData.watch_out && (
                <div id="ma-watch-out" className="ma-bento-watchout">
                  <p className="ma-watch-out-label">⚠ Watch Out</p>
                  <p id="ma-watch-out-text" className="ma-bento-cell-body">{methodData.watch_out}</p>
                </div>
              )}
            </div>

            {/* Option cards */}
            <div id="ma-options-list" className="ma-options-list">
              {(methodData.options || []).map((option, i) => {
                const isSelected = selected === option.methodology
                const isDimmed = selected && !isSelected
                return (
                  <div
                    key={i}
                    className={[
                      'ma-option-card',
                      isSelected ? 'ma-option-card--selected' : '',
                      isDimmed   ? 'ma-option-card--dimmed'   : '',
                    ].join(' ').trim()}
                    data-methodology={option.methodology}
                  >
                    <div className="ma-option-header">
                      <p className="ma-option-name">{option.methodology}</p>
                      <span className={`ma-fit-badge ma-fit-badge--${fitKey(option.fit_score)}`}>
                        {option.fit_score}
                      </span>
                      {option.methodology === methodData.recommended && (
                        <span className="ma-recommended-tag">★ Recommended</span>
                      )}
                    </div>
                    <p className="ma-explanation">{option.explanation}</p>
                    {option.data_collection?.length > 0 && (
                      <div>
                        <p className="ma-section-label">Data Collection</p>
                        <ul className="ma-data-list">
                          {option.data_collection.map((m, j) => <li key={j}>{m}</li>)}
                        </ul>
                      </div>
                    )}
                    {option.instruments?.length > 0 && (
                      <div>
                        <p className="ma-section-label">Instruments</p>
                        <ul className="ma-instruments-list">
                          {option.instruments.map((inst, j) => (
                            <li key={j} className="ma-instrument-item">
                              <p className="ma-instrument-name">{inst.name}</p>
                              <p className="ma-instrument-access">{inst.access}</p>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {option.trade_offs && (
                      <div>
                        <p className="ma-section-label">Trade-offs</p>
                        <p className="ma-trade-offs">{option.trade_offs}</p>
                      </div>
                    )}
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

            <button
              id="btn-confirm-method"
              className="ma-btn-confirm"
              disabled={!selected}
              onClick={handleConfirm}
            >
              Confirm Methodology — Continue
            </button>
          </div>
        )}
      </div>

      {/* Instrument Builder appears after methodology confirmed */}
      {showInstrument && (
        <InstrumentBuilder
          methodology={state.chosenMethodology || selected}
          studentContext={studentContext}
          validatedTopic={state.validatedTopic}
          chapterStructure={state.chapterStructure}
          onContinue={handleInstrumentContinue}
        />
      )}
    </>
  )
}
