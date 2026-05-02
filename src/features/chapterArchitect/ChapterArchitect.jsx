import { useState, useRef, useEffect } from 'react'
import { buildChapters, generateAbstract, generateLiteratureMap, handleApiError } from '../../services/api'
import { useApp } from '../../context/AppContext'
import { showToast } from '../../components/Toast'
import { useProjectState } from '../../hooks/useProjectState'

const CHEVRON_PATH = 'M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z'

const AG_COMPONENTS = [
  { key: 'background',            label: 'Background' },
  { key: 'problem_statement',     label: 'Problem Statement' },
  { key: 'objectives',            label: 'Objectives' },
  { key: 'methodology',           label: 'Methodology' },
  { key: 'expected_contribution', label: 'Expected Contribution' },
]

function ProgressRing({ pct }) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct / 100)
  return (
    <svg className="ca-chapter-ring" width="44" height="44" viewBox="0 0 44 44"
      aria-label={`${pct}% of total word count`} role="img">
      <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="3.5" />
      <circle cx="22" cy="22" r={radius} fill="none" stroke="#0066FF" strokeWidth="3.5"
        strokeDasharray={circumference.toFixed(2)}
        strokeDashoffset={offset.toFixed(2)}
        strokeLinecap="round"
        transform="rotate(-90 22 22)" />
      <text x="22" y="26" textAnchor="middle" fontFamily="JetBrains Mono, monospace"
        fontSize="8" fontWeight="500" fill="#0D1B2A">{pct}%</text>
    </svg>
  )
}

function ChapterRow({ chapter, idx, isOpen, isEditing, editDraft, setBodyRef, onToggle, onEdit, onSave, onDraftChange }) {
  const numStr = String(chapter.number).padStart(2, '0')
  const pct    = chapter.word_count_percentage || 0

  function handleHeaderClick(e) {
    if (e.target.closest('.ca-btn-edit-chapter, .ca-btn-save-chapter')) return
    onToggle(idx)
  }

  return (
    <div className={`ca-chapter-row${isOpen ? ' ca-chapter-row--open' : ''}`}>

      <div className="ca-chapter-header" onClick={handleHeaderClick}>
        <span className="ca-chapter-num-bg" aria-hidden="true">{numStr}</span>

        {isEditing ? (
          <input
            type="text"
            className="ca-edit-input ca-edit-title"
            value={editDraft.title || ''}
            onChange={e => onDraftChange(idx, 'title', e.target.value)}
            onClick={e => e.stopPropagation()}
          />
        ) : (
          <p className="ca-chapter-title-text" data-field="title">{chapter.title}</p>
        )}

        <ProgressRing pct={pct} />

        <svg className="ca-chevron" xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 256 256" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d={CHEVRON_PATH} />
        </svg>
      </div>

      <div className="ca-chapter-body" ref={setBodyRef}>
        <div className="ca-chapter-body-inner">

          <p className="ca-body-label">Core Question</p>
          {isEditing ? (
            <textarea
              className="ca-edit-textarea"
              rows={3}
              value={editDraft.core_question || ''}
              onChange={e => onDraftChange(idx, 'core_question', e.target.value)}
            />
          ) : (
            <p className="ca-body-text" data-field="core_question">{chapter.core_question}</p>
          )}

          <p className="ca-body-label" style={{ marginTop: '14px' }}>Key Content</p>
          <ul className="ca-key-content-list" data-field="key_content">
            {isEditing
              ? (editDraft.key_content || []).map((point, ki) => (
                  <li key={ki} className="ca-content-item">
                    <input
                      type="text"
                      className="ca-edit-input"
                      value={point}
                      onChange={e => onDraftChange(idx, 'key_content', e.target.value, ki)}
                    />
                  </li>
                ))
              : (chapter.key_content || []).map((point, ki) => (
                  <li key={ki} className="ca-content-item">{point}</li>
                ))
            }
          </ul>

          <p className="ca-word-target">
            <span className="ca-word-count-val">{(chapter.word_count_target || 0).toLocaleString()}</span>
            {' words · '}
            <span className="ca-pct-val">{pct}%</span> of total
          </p>

          {isEditing
            ? (
              <button
                className="ca-btn-save-chapter"
                onClick={e => { e.stopPropagation(); onSave(idx) }}
              >
                Save Chapter
              </button>
            ) : (
              <button
                className="ca-btn-edit-chapter"
                onClick={e => { e.stopPropagation(); onEdit(idx) }}
              >
                Edit Chapter
              </button>
            )
          }

        </div>
      </div>
    </div>
  )
}

export default function ChapterArchitect() {
  const { state, studentContext, completeStep, navigateStep } = useApp()
  const { saveStep } = useProjectState()

  const restored = Boolean(state.stepsCompleted[1] && state.chapterStructure)

  // ── Main card state ───────────────────────────────────────────────────────
  const [section, setSection]               = useState(restored ? 'result' : 'input')
  const [structureType, setStructureType]   = useState(state.structureType || 'standard-5')
  const [wordCount, setWordCount]           = useState(state.totalWordCount ? String(state.totalWordCount) : '')
  const [wordCountShaking, setWordCountShaking] = useState(false)
  const [error, setError]                   = useState(null)
  const [resultError, setResultError]       = useState(null)
  const [btnDisabled, setBtnDisabled]       = useState(false)
  const [data, setData]                     = useState(restored ? state.chapterStructure : null)
  const [chapters, setChapters]             = useState(restored ? (state.chapterStructure?.chapters || []) : [])

  // ── Chapter accordion state ───────────────────────────────────────────────
  const [openChapters, setOpenChapters]   = useState({})
  const [editingChapter, setEditingChapter] = useState(null)
  const [editDrafts, setEditDrafts]       = useState({})
  const bodyRefs = useRef([])

  // ── Abstract Generator state ──────────────────────────────────────────────
  const [agSection, setAgSection]         = useState('input')
  const [agData, setAgData]               = useState(null)
  const [agBtnDisabled, setAgBtnDisabled] = useState(false)
  const [agError, setAgError]             = useState(null)
  const [agCopied, setAgCopied]           = useState(false)
  const [agVisible, setAgVisible]         = useState([])
  const agTimers = useRef([])

  // ── Literature Map state ──────────────────────────────────────────────────
  const [lmSection, setLmSection]         = useState('input')
  const [lmData, setLmData]               = useState(null)
  const [lmBtnDisabled, setLmBtnDisabled] = useState(false)
  const [lmError, setLmError]             = useState(null)
  const [lmCopied, setLmCopied]           = useState(false)
  const [copiedChip, setCopiedChip]       = useState(null)
  const chipTimers = useRef({})

  // Cleanup timers on unmount
  useEffect(() => {
    return () => {
      agTimers.current.forEach(clearTimeout)
      Object.values(chipTimers.current).forEach(clearTimeout)
    }
  }, [])

  // After editing starts/stops, adjust maxHeight so animation stays smooth
  useEffect(() => {
    if (editingChapter !== null) {
      const el = bodyRefs.current[editingChapter]
      if (el) requestAnimationFrame(() => { el.style.maxHeight = el.scrollHeight + 'px' })
    }
  }, [editingChapter])

  // ── Accordion ─────────────────────────────────────────────────────────────

  function toggleChapter(idx) {
    const el = bodyRefs.current[idx]
    if (!el) return
    const isOpen = !!openChapters[idx]
    if (isOpen) {
      el.style.maxHeight = el.scrollHeight + 'px'
      el.getBoundingClientRect()
      el.style.maxHeight = '0'
    } else {
      el.style.maxHeight = el.scrollHeight + 'px'
    }
    setOpenChapters(prev => ({ ...prev, [idx]: !isOpen }))
  }

  function handleEditChapter(idx) {
    if (!openChapters[idx]) {
      const el = bodyRefs.current[idx]
      if (el) el.style.maxHeight = el.scrollHeight + 'px'
      setOpenChapters(prev => ({ ...prev, [idx]: true }))
    }
    setEditDrafts(prev => ({
      ...prev,
      [idx]: {
        title:         chapters[idx].title,
        core_question: chapters[idx].core_question,
        key_content:   [...(chapters[idx].key_content || [])],
      },
    }))
    setEditingChapter(idx)
  }

  function handleSaveChapter(idx) {
    const draft = editDrafts[idx]
    if (!draft) return
    setChapters(prev => prev.map((ch, i) => {
      if (i !== idx) return ch
      return {
        ...ch,
        title:         draft.title.trim()         || ch.title,
        core_question: draft.core_question.trim() || ch.core_question,
        key_content:   (draft.key_content || []).map((kc, ki) => kc.trim() || (ch.key_content[ki] || '')),
      }
    }))
    setEditingChapter(null)
    requestAnimationFrame(() => {
      const el = bodyRefs.current[idx]
      if (el) el.style.maxHeight = el.scrollHeight + 'px'
    })
  }

  function handleDraftChange(idx, field, value, keyIdx) {
    setEditDrafts(prev => {
      const draft = { ...prev[idx] }
      if (field === 'key_content') {
        const kc = [...(draft.key_content || [])]
        kc[keyIdx] = value
        draft.key_content = kc
      } else {
        draft[field] = value
      }
      return { ...prev, [idx]: draft }
    })
  }

  // ── Reset companion cards (called after every generate/regenerate) ─────────

  function resetCompanions() {
    agTimers.current.forEach(clearTimeout)
    agTimers.current = []
    setAgSection('input')
    setAgData(null)
    setAgVisible([])
    setAgError(null)
    setAgBtnDisabled(false)
    setLmSection('input')
    setLmData(null)
    setLmError(null)
    setLmBtnDisabled(false)
  }

  // ── Generate chapters ─────────────────────────────────────────────────────

  function handleGenerate() {
    const wc = parseInt(wordCount, 10)
    if (!wc || wc < 5000) {
      setWordCountShaking(true)
      setError('Please enter a word count of at least 5,000 before generating.')
      return
    }
    setError(null)
    setBtnDisabled(true)
    setSection('loading')

    buildChapters(studentContext, state.validatedTopic, structureType, wc)
      .then(result => {
        setData(result)
        setChapters(result.chapters || [])
        setOpenChapters({})
        setEditingChapter(null)
        setEditDrafts({})
        setResultError(null)
        resetCompanions()
        setSection('result')
        setBtnDisabled(false)
      })
      .catch(err => {
        setSection('input')
        if (!handleApiError(err, msg => {
          setError(msg)
          if (!msg) setBtnDisabled(false)
        })) {
          setBtnDisabled(false)
          setError('Something went wrong. Please check your connection and try again.')
        }
      })
  }

  function handleRegenerate() {
    const wc = parseInt(wordCount, 10) || 0
    setResultError(null)
    setSection('loading')

    buildChapters(studentContext, state.validatedTopic, structureType, wc)
      .then(result => {
        setData(result)
        setChapters(result.chapters || [])
        setOpenChapters({})
        setEditingChapter(null)
        setEditDrafts({})
        resetCompanions()
        setSection('result')
      })
      .catch(err => {
        setSection('result')
        if (!handleApiError(err, msg => setResultError(msg))) {
          setResultError('Regeneration failed. Your previous structure is still displayed.')
        }
      })
  }

  // ── Confirm ───────────────────────────────────────────────────────────────

  function handleConfirm() {
    if (!data) return
    const wc = parseInt(wordCount, 10) || 0
    const structure = { ...data, chapters }
    completeStep(1, { chapterStructure: structure, structureType, totalWordCount: wc })
    saveStep('chapter_architect', structure)
    showToast('Chapter structure confirmed ✓')
  }

  // ── Abstract Generator ────────────────────────────────────────────────────

  function handleGenerateAbstract() {
    setAgBtnDisabled(true)
    setAgError(null)
    setAgSection('loading')

    const chaps = chapters.length ? chapters : (data?.chapters || [])

    generateAbstract(studentContext, state.validatedTopic, chaps)
      .then(result => {
        // Normalize: Claude sometimes wraps the response under a key like "abstract"
        let agResult = result
        if (!agResult?.background) {
          const unwrapped = Object.values(agResult || {}).find(
            v => v && typeof v === 'object' && v.background
          )
          if (unwrapped) agResult = unwrapped
        }
        setAgData(agResult)
        setAgSection('result')
        agTimers.current.forEach(clearTimeout)
        setAgVisible([])
        const timers = AG_COMPONENTS.map((_, i) =>
          setTimeout(() => setAgVisible(prev => [...prev, i]), i * 350)
        )
        agTimers.current = timers
        saveStep('abstract_generator', agResult)
      })
      .catch(err => {
        setAgSection('input')
        if (!handleApiError(err, msg => {
          setAgError(msg)
          if (!msg) setAgBtnDisabled(false)
        })) {
          setAgBtnDisabled(false)
          setAgError('Something went wrong generating the abstract. Please try again.')
        }
      })
  }

  function copyAbstract() {
    if (!agData) return
    const text = [
      'ABSTRACT SCAFFOLD — NOT FINAL ABSTRACT', '',
      'Background',            agData.background || '', '',
      'Problem Statement',     agData.problem_statement || '', '',
      'Objectives',            agData.objectives || '', '',
      'Methodology',           agData.methodology || '', '',
      'Expected Contribution', agData.expected_contribution || '',
    ].join('\n')
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => {})
    setAgCopied(true)
    setTimeout(() => setAgCopied(false), 1800)
  }

  // ── Literature Map ────────────────────────────────────────────────────────

  function handleGenerateLiteratureMap() {
    setLmBtnDisabled(true)
    setLmError(null)
    setLmSection('loading')

    const chaps = chapters.length ? chapters : (data?.chapters || [])

    generateLiteratureMap(studentContext, state.validatedTopic, chaps)
      .then(result => {
        // Normalize: Claude sometimes wraps the response under a key like "literature_map"
        let lmResult = result
        if (!Array.isArray(lmResult?.thematic_areas)) {
          const unwrapped = Object.values(lmResult || {}).find(
            v => v && typeof v === 'object' && Array.isArray(v.thematic_areas)
          )
          if (unwrapped) lmResult = unwrapped
        }
        setLmData(lmResult)
        setLmSection('result')
        saveStep('literature_map', lmResult)
      })
      .catch(err => {
        setLmSection('input')
        if (!handleApiError(err, msg => {
          setLmError(msg)
          if (!msg) setLmBtnDisabled(false)
        })) {
          setLmBtnDisabled(false)
          setLmError('Something went wrong generating the literature map. Please try again.')
        }
      })
  }

  function copyChip(term) {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(term).catch(() => {})
    setCopiedChip(term)
    if (chipTimers.current[term]) clearTimeout(chipTimers.current[term])
    chipTimers.current[term] = setTimeout(() => setCopiedChip(null), 1400)
  }

  function copyLiteratureMap() {
    if (!lmData) return
    const lines = ['LITERATURE MAP', '', 'THEMATIC AREAS']
    ;(lmData.thematic_areas || []).forEach((area, i) => {
      lines.push('', `${i + 1}. ${area.theme || ''}`)
      ;(area.search_terms || []).forEach(t => lines.push(`   • ${t}`))
    })
    lines.push('', 'RECOMMENDED SOURCES')
    ;(lmData.source_types || []).forEach(st => {
      lines.push('', `${st.type || ''} — ${st.rationale || ''}`, `Access: ${st.access || ''}`)
    })
    lines.push('', 'SYNTHESIS GUIDE', lmData.synthesis_guide || '')
    const text = lines.join('\n')
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).catch(() => {})
    setLmCopied(true)
    setTimeout(() => setLmCopied(false), 1800)
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const showCompanions = section === 'result'

  return (
    <>
      {/* ── Chapter Architect card ──────────────────────────────────────────── */}
      <div className="ca-card" id="ca-card">

        {/* Input section */}
        <div id="ca-input-section" className={`ca-input-section ${section === 'input' ? 'tv-section--visible' : 'tv-section--hidden'}`}>
          <button className="fy-back-btn" onClick={() => navigateStep(0)}>
            ← Back to Topic Validator
          </button>
          <p className="ca-step-label">Step 2: Chapter Architect</p>
          <p className="ca-description">
            Choose a structure type, enter your total word count target, then let FYPro map out
            your chapters — each with a core question, content outline, and word allocation.
          </p>

          <div className="ca-form-group">
            <p className="ca-form-label">Structure Type</p>
            <div className="ca-structure-toggle" id="ca-structure-toggle">
              <button
                className={`ca-toggle-btn${structureType === 'standard-5' ? ' ca-toggle-btn--active' : ''}`}
                onClick={() => setStructureType('standard-5')}
              >
                Standard 5-Chapter
              </button>
              <button
                className={`ca-toggle-btn${structureType === 'custom' ? ' ca-toggle-btn--active' : ''}`}
                onClick={() => setStructureType('custom')}
              >
                Custom
              </button>
            </div>
            {structureType === 'standard-5' && (
              <p className="ca-toggle-hint" id="ca-toggle-hint">
                Intro → Literature Review → Methodology → Results &amp; Discussion → Conclusion
              </p>
            )}
          </div>

          <div className="ca-form-group">
            <p className="ca-form-label">Total Word Count Target</p>
            <input
              id="ca-word-count"
              className={`ca-word-count-input${wordCountShaking ? ' ca-input--shake' : ''}`}
              type="number"
              min="5000"
              placeholder="e.g. 15000"
              value={wordCount}
              onChange={e => setWordCount(e.target.value)}
              onAnimationEnd={() => setWordCountShaking(false)}
            />
          </div>

          {error && <p id="ca-error-text" className="ca-error-text">{error}</p>}

          <button
            id="btn-generate"
            className="ca-btn-generate"
            onClick={handleGenerate}
            disabled={btnDisabled}
          >
            Generate Chapters
          </button>
        </div>

        {/* Loading section */}
        <div id="ca-loading-section" className={`ca-loading-section ${section === 'loading' ? 'tv-section--visible' : 'tv-section--hidden'}`}>
          <div className="skeleton-loader">
            <div className="skeleton-bar" style={{ width: '100%' }} />
            <div className="skeleton-bar" style={{ width: '75%' }} />
            <div className="skeleton-bar" style={{ width: '90%' }} />
            <div className="skeleton-bar" style={{ width: '60%' }} />
          </div>
          <p className="tv-loading-text">Mapping your chapters…</p>
        </div>

        {/* Result section */}
        <div id="ca-result-section" className={`ca-result-section ${section === 'result' ? 'tv-section--visible' : 'tv-section--hidden'}`}>
          {data && (
            <>
              <p id="ca-structure-note" className="ca-structure-note">{data.structure_note || ''}</p>
              {resultError && <p className="ca-error-text">{resultError}</p>}

              <div id="ca-chapters-list" className="ca-chapters-list">
                {chapters.map((chapter, idx) => (
                  <ChapterRow
                    key={idx}
                    chapter={chapter}
                    idx={idx}
                    isOpen={!!openChapters[idx]}
                    isEditing={editingChapter === idx}
                    editDraft={editDrafts[idx] || {}}
                    setBodyRef={el => { bodyRefs.current[idx] = el }}
                    onToggle={toggleChapter}
                    onEdit={handleEditChapter}
                    onSave={handleSaveChapter}
                    onDraftChange={handleDraftChange}
                  />
                ))}
              </div>

              <button id="btn-regenerate" className="ca-btn-regenerate" onClick={handleRegenerate}>
                Regenerate
              </button>
              <button id="btn-confirm" className="ca-btn-confirm" onClick={handleConfirm}>
                I am satisfied with this structure — Continue
              </button>
            </>
          )}
        </div>

      </div>

      {/* ── Abstract Generator companion card ───────────────────────────────── */}
      {showCompanions && (
        <div className="ag-card" id="ag-card">

          {agSection === 'input' && (
            <div id="ag-input-section" className="ag-input-section tv-section--visible">
              <p className="ag-step-label">Abstract Generator</p>
              <span className="ag-companion-badge">Companion Card</span>
              <p className="ag-description" style={agError ? { color: '#DC2626' } : {}}>
                {agError
                  ? agError
                  : 'FYPro will draft a structured abstract scaffold for your project — five labelled ' +
                    'components for you to refine. This is not a finished abstract; it is a starting ' +
                    'point calibrated to your topic and chapter structure.'}
              </p>
              <button
                id="ag-btn-generate"
                className="ag-btn-generate"
                onClick={handleGenerateAbstract}
                disabled={agBtnDisabled}
              >
                Generate Abstract
              </button>
            </div>
          )}

          {agSection === 'loading' && (
            <div id="ag-loading-section" className="ag-loading-section tv-section--visible">
              <div className="skeleton-loader">
                <div className="skeleton-bar" style={{ width: '100%' }} />
                <div className="skeleton-bar" style={{ width: '75%' }} />
                <div className="skeleton-bar" style={{ width: '90%' }} />
                <div className="skeleton-bar" style={{ width: '60%' }} />
              </div>
              <p className="tv-loading-text">Drafting your abstract scaffold…</p>
            </div>
          )}

          {agSection === 'result' && agData && (
            <div id="ag-result-section" className="ag-result-section tv-section--visible">
              <div className="ag-scaffold-notice">⚠ Scaffold — Not Final Abstract</div>
              <div id="ag-components-list" className="ag-components-list">
                {AG_COMPONENTS.map((comp, i) => (
                  <div
                    key={comp.key}
                    className={`ag-component${agVisible.includes(i) ? ' ag-component--visible' : ''}`}
                  >
                    <p className="ag-component-label">{comp.label}</p>
                    <p className="ag-component-text">{agData[comp.key] || ''}</p>
                  </div>
                ))}
              </div>
              <button
                id="ag-btn-copy"
                className={`ag-btn-copy${agCopied ? ' ag-btn-copy--copied' : ''}`}
                onClick={copyAbstract}
              >
                {agCopied ? 'Copied to clipboard' : 'Copy Scaffold'}
              </button>
            </div>
          )}

        </div>
      )}

      {/* ── Literature Map companion card ───────────────────────────────────── */}
      {showCompanions && (
        <div className="lm-card" id="lm-card">

          {lmSection === 'input' && (
            <div id="lm-input-section" className="lm-input-section tv-section--visible">
              <p className="lm-step-label">Literature Map</p>
              <span className="lm-companion-badge">Companion Card</span>
              <p className="lm-description" style={lmError ? { color: '#DC2626' } : {}}>
                {lmError
                  ? lmError
                  : 'FYPro will map the intellectual territory of your topic — thematic areas with ' +
                    'targeted search terms, the most useful source types for your field, and a ' +
                    'synthesis guide explaining how to build an argument across papers, not just summarise them.'}
              </p>
              <button
                id="lm-btn-generate"
                className="lm-btn-generate"
                onClick={handleGenerateLiteratureMap}
                disabled={lmBtnDisabled}
              >
                Generate Literature Map
              </button>
            </div>
          )}

          {lmSection === 'loading' && (
            <div id="lm-loading-section" className="lm-loading-section tv-section--visible">
              <div className="skeleton-loader">
                <div className="skeleton-bar" style={{ width: '100%' }} />
                <div className="skeleton-bar" style={{ width: '75%' }} />
                <div className="skeleton-bar" style={{ width: '90%' }} />
                <div className="skeleton-bar" style={{ width: '60%' }} />
              </div>
              <p className="tv-loading-text">Mapping your literature…</p>
            </div>
          )}

          {lmSection === 'result' && lmData && (
            <div id="lm-result-section" className="lm-result-section tv-section--visible">

              <p className="lm-section-heading">Thematic Areas</p>
              <div id="lm-themes-list" className="lm-themes-list">
                {(lmData.thematic_areas || []).map((area, idx) => (
                  <div key={idx} className="lm-theme-card">
                    <span className="lm-theme-num-bg" aria-hidden="true">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <p className="lm-theme-name">{area.theme || ''}</p>
                    <div className="lm-chips">
                      {(area.search_terms || []).map((term, ti) => (
                        <button
                          key={ti}
                          className={`lm-search-chip${copiedChip === term ? ' lm-search-chip--copied' : ''}`}
                          title="Click to copy"
                          onClick={() => copyChip(term)}
                        >
                          {term}
                          <span className="lm-chip-icon" aria-hidden="true">&#x2398;</span>
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              <p className="lm-section-heading lm-section-heading--spaced">Recommended Sources</p>
              <div id="lm-sources-list" className="lm-sources-list">
                {(lmData.source_types || []).map((st, idx) => (
                  <div key={idx} className="lm-source-row">
                    <p className="lm-source-type">{st.type || ''}</p>
                    <p className="lm-source-rationale">{st.rationale || ''}</p>
                    <p className="lm-source-access">
                      <span className="lm-access-label">Access:</span> {st.access || ''}
                    </p>
                  </div>
                ))}
              </div>

              <p className="lm-section-heading lm-section-heading--spaced">Synthesis Guide</p>
              <div id="lm-synthesis-block" className="lm-synthesis-block">
                <p className="lm-synthesis-text">{lmData.synthesis_guide || ''}</p>
              </div>

              <button
                id="lm-btn-copy"
                className={`lm-btn-copy${lmCopied ? ' lm-btn-copy--copied' : ''}`}
                onClick={copyLiteratureMap}
              >
                {lmCopied ? 'Copied to clipboard' : 'Copy Literature Map'}
              </button>

            </div>
          )}

        </div>
      )}
    </>
  )
}
