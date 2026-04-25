import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { buildChapters, generateAbstract, generateLiteratureMap } from '../../services/api'
import { handleApiError } from '../../services/api'
import { showToast } from '../../components/Toast'

const CHEVRON_PATH =
  'M213.66,101.66l-80,80a8,8,0,0,1-11.32,0l-80-80A8,8,0,0,1,53.66,90.34L128,164.69l74.34-74.35a8,8,0,0,1,11.32,11.32Z'

function ProgressRing({ pct }) {
  const radius = 18
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct / 100)
  return (
    <svg className="ca-chapter-ring" width="44" height="44" viewBox="0 0 44 44" aria-label={`${pct}% of total word count`} role="img">
      <circle cx="22" cy="22" r={radius} fill="none" stroke="rgba(0,0,0,0.08)" strokeWidth="3.5" />
      <circle cx="22" cy="22" r={radius} fill="none" stroke="#0066FF" strokeWidth="3.5"
        strokeDasharray={circumference.toFixed(2)}
        strokeDashoffset={offset.toFixed(2)}
        strokeLinecap="round"
        transform="rotate(-90 22 22)"
      />
      <text x="22" y="26" textAnchor="middle" fontFamily="JetBrains Mono, monospace" fontSize="8" fontWeight="500" fill="#0D1B2A">
        {pct}%
      </text>
    </svg>
  )
}

function ChapterRow({ chapter }) {
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const [editCoreQ, setEditCoreQ] = useState(chapter.core_question || '')
  const [editContent, setEditContent] = useState((chapter.key_content || []).join('\n'))

  return (
    <div className={`ca-chapter-row${open ? ' ca-chapter-row--open' : ''}`}>
      <div className="ca-chapter-header" onClick={() => !editing && setOpen((v) => !v)}>
        <span className="ca-chapter-num-bg" aria-hidden="true">{String(chapter.number).padStart(2, '0')}</span>
        <p className="ca-chapter-title-text">{chapter.title}</p>
        <ProgressRing pct={chapter.word_count_percentage || 0} />
        <svg className="ca-chevron" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="16" height="16" fill="currentColor" aria-hidden="true">
          <path d={CHEVRON_PATH} />
        </svg>
      </div>
      <div className="ca-chapter-body">
        <div className="ca-chapter-body-inner">
          <p className="ca-body-label">Core Question</p>
          {editing ? (
            <textarea className="ca-edit-textarea" rows={2} value={editCoreQ} onChange={(e) => setEditCoreQ(e.target.value)} />
          ) : (
            <p className="ca-body-text">{chapter.core_question}</p>
          )}
          <p className="ca-body-label" style={{ marginTop: 14 }}>Key Content</p>
          {editing ? (
            <textarea className="ca-edit-textarea" rows={3} value={editContent} onChange={(e) => setEditContent(e.target.value)} />
          ) : (
            <ul className="ca-key-content-list">
              {(chapter.key_content || []).map((point, i) => (
                <li key={i} className="ca-content-item">{point}</li>
              ))}
            </ul>
          )}
          <p className="ca-word-target">
            <span className="ca-word-count-val">{(chapter.word_count_target || 0).toLocaleString()}</span>
            {' words · '}
            <span className="ca-pct-val">{chapter.word_count_percentage || 0}%</span> of total
          </p>
          {editing ? (
            <button className="ca-btn-save-chapter" onClick={(e) => { e.stopPropagation(); setEditing(false) }}>Save Chapter</button>
          ) : (
            <button className="ca-btn-edit-chapter" onClick={(e) => { e.stopPropagation(); setEditing(true) }}>Edit Chapter</button>
          )}
        </div>
      </div>
    </div>
  )
}

function AbstractCard({ studentContext, validatedTopic, chapterStructure }) {
  const [section, setSection] = useState('input')
  const [abstractData, setAbstractData] = useState(null)
  const [error, setError] = useState('')

  async function handleGenerate() {
    setError('')
    setSection('loading')
    try {
      const data = await generateAbstract(studentContext, validatedTopic, chapterStructure)
      setAbstractData(data)
      setSection('result')
    } catch (err) {
      setSection('input')
      handleApiError(err, (msg) => setError(msg || 'Something went wrong.'))
    }
  }

  return (
    <div className="ag-card" id="ag-card">
      <p className="ag-step-label">Bonus: Abstract Generator</p>
      <p className="ag-description">Generate a structured abstract based on your chapter structure.</p>
      <div className={`ag-input-section${section === 'input' ? ' tv-section--visible' : ' tv-section--hidden'}`}>
        {error && <p className="ag-error-text">{error}</p>}
        <button className="ag-btn-generate" onClick={handleGenerate}>Generate Abstract</button>
      </div>
      <div className={`ag-loading-section${section === 'loading' ? ' tv-section--visible' : ' tv-section--hidden'}`}>
        <div className="skeleton-loader">
          <div className="skeleton-bar" style={{ width: '100%' }} />
          <div className="skeleton-bar" style={{ width: '80%' }} />
          <div className="skeleton-bar" style={{ width: '90%' }} />
        </div>
        <p className="tv-loading-text">Crafting abstract…</p>
      </div>
      {abstractData && section === 'result' && (
        <div className="ag-result-section tv-section--visible">
          {['background', 'objectives', 'methodology', 'findings', 'conclusion'].map((field) =>
            abstractData[field] ? (
              <div key={field} className="ag-result-block">
                <p className="ag-block-label" style={{ textTransform: 'capitalize' }}>{field}</p>
                <p className="ag-block-text">{abstractData[field]}</p>
              </div>
            ) : null
          )}
          <button className="ag-btn-generate" onClick={handleGenerate}>Regenerate</button>
        </div>
      )}
    </div>
  )
}

function LiteratureMapCard({ studentContext, validatedTopic, chapterStructure }) {
  const [section, setSection] = useState('input')
  const [mapData, setMapData] = useState(null)
  const [error, setError] = useState('')

  async function handleGenerate() {
    setError('')
    setSection('loading')
    try {
      const data = await generateLiteratureMap(studentContext, validatedTopic, chapterStructure)
      setMapData(data)
      setSection('result')
    } catch (err) {
      setSection('input')
      handleApiError(err, (msg) => setError(msg || 'Something went wrong.'))
    }
  }

  return (
    <div className="lm-card" id="lm-card">
      <p className="lm-step-label">Bonus: Literature Map</p>
      <p className="lm-description">Map key literature themes and search terms for your research topic.</p>
      <div className={`lm-input-section${section === 'input' ? ' tv-section--visible' : ' tv-section--hidden'}`}>
        {error && <p className="lm-error-text">{error}</p>}
        <button className="lm-btn-generate" onClick={handleGenerate}>Generate Literature Map</button>
      </div>
      <div className={`lm-loading-section${section === 'loading' ? ' tv-section--visible' : ' tv-section--hidden'}`}>
        <div className="skeleton-loader">
          <div className="skeleton-bar" style={{ width: '100%' }} />
          <div className="skeleton-bar" style={{ width: '80%' }} />
        </div>
        <p className="tv-loading-text">Mapping literature…</p>
      </div>
      {mapData && section === 'result' && (
        <div className="lm-result-section tv-section--visible">
          {(mapData.themes || []).map((theme, i) => (
            <div key={i} className="lm-theme-block">
              <p className="lm-theme-title">{theme.theme || theme.area}</p>
              {theme.description && <p className="lm-theme-description">{theme.description}</p>}
              {(theme.key_authors || theme.search_terms) && (
                <p className="lm-theme-authors">
                  <span className="lm-authors-label">{theme.key_authors ? 'Key Authors: ' : 'Search Terms: '}</span>
                  {(theme.key_authors || theme.search_terms || []).join(', ')}
                </p>
              )}
            </div>
          ))}
          <button className="lm-btn-generate" onClick={handleGenerate}>Regenerate</button>
        </div>
      )}
    </div>
  )
}

export default function ChapterArchitect() {
  const { state, set, completeStep, navigateStep, studentContext } = useApp()

  const [section, setSection] = useState(
    state.stepsCompleted[1] ? 'result' : 'input'
  )
  const [structureType, setStructureType] = useState(state.structureType || 'standard-5')
  const [wordCount, setWordCount] = useState(state.totalWordCount || '')
  const [chapterData, setChapterData] = useState(state.chapterStructure || null)
  const [error, setError] = useState('')
  const [showCompanions, setShowCompanions] = useState(Boolean(state.chapterStructure))

  useEffect(() => {
    if (state.chapterStructure) {
      setChapterData(state.chapterStructure)
      setShowCompanions(true)
      if (state.stepsCompleted[1]) setSection('result')
    }
  }, []) // eslint-disable-line

  async function handleGenerate() {
    const wc = parseInt(wordCount, 10)
    if (!wc || wc < 5000) {
      setError('Please enter a word count of at least 5,000 before generating.')
      return
    }
    setError('')
    setSection('loading')
    try {
      const data = await buildChapters(studentContext, state.validatedTopic, structureType, wc)
      setChapterData(data)
      set({ chapterStructure: data, structureType, totalWordCount: wc })
      setSection('result')
      setShowCompanions(true)
      showToast('Analysis complete', 'success')
    } catch (err) {
      setSection('input')
      handleApiError(err, (msg) => {
        setError(msg || 'Something went wrong. Please check your connection and try again.')
        showToast('Something went wrong. Try again.', 'error')
      })
    }
  }

  function handleRegenerate() { setSection('input') }

  function handleConfirm() {
    completeStep(1)
    showToast('Step 3 unlocked', 'unlock')
  }

  return (
    <>
      <div className="ca-card" id="ca-card">

        {/* ── Input Section ── */}
        <div
          id="ca-input-section"
          className={`ca-input-section${section === 'input' ? ' tv-section--visible' : ' tv-section--hidden'}`}
        >
          <button className="fy-back-btn" onClick={() => navigateStep(0)}>
            ← Back to Topic Validator
          </button>
          <p className="ca-step-label">Step 2: Chapter Architect</p>
          <p className="ca-description">
            Choose a structure type, enter your total word count target, then let FYPro map out your chapters — each with a core question, content outline, and word allocation.
          </p>

          <div className="ca-form-group">
            <p className="ca-form-label">Structure Type</p>
            <div className="ca-structure-toggle" id="ca-structure-toggle">
              <button
                type="button"
                className={`ca-toggle-btn${structureType === 'standard-5' ? ' ca-toggle-btn--active' : ''}`}
                onClick={() => setStructureType('standard-5')}
              >
                Standard 5-Chapter
              </button>
              <button
                type="button"
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
              className="ca-word-count-input"
              type="number"
              min={5000}
              placeholder="e.g. 15000"
              value={wordCount}
              onChange={(e) => setWordCount(e.target.value)}
            />
          </div>

          {error && (
            <p id="ca-error-text" className="ca-error-text tv-section--visible">{error}</p>
          )}
          <button id="btn-generate" className="ca-btn-generate" onClick={handleGenerate}>
            Generate Chapters
          </button>
        </div>

        {/* ── Loading Section ── */}
        <div
          id="ca-loading-section"
          className={`ca-loading-section${section === 'loading' ? ' tv-section--visible' : ' tv-section--hidden'}`}
        >
          <div className="skeleton-loader">
            <div className="skeleton-bar" style={{ width: '100%' }} />
            <div className="skeleton-bar" style={{ width: '75%' }} />
            <div className="skeleton-bar" style={{ width: '90%' }} />
            <div className="skeleton-bar" style={{ width: '60%' }} />
          </div>
          <p className="tv-loading-text">Mapping your chapters…</p>
        </div>

        {/* ── Result Section ── */}
        {chapterData && (
          <div
            id="ca-result-section"
            className={`ca-result-section${section === 'result' ? ' tv-section--visible' : ' tv-section--hidden'}`}
          >
            <p id="ca-structure-note" className="ca-structure-note">
              {chapterData.structure_note}
            </p>
            <div id="ca-chapters-list" className="ca-chapters-list">
              {(chapterData.chapters || []).map((ch, i) => (
                <ChapterRow key={i} chapter={ch} />
              ))}
            </div>
            <button id="btn-regenerate" className="ca-btn-regenerate" onClick={handleRegenerate}>
              Regenerate
            </button>
            <button id="btn-confirm" className="ca-btn-confirm" onClick={handleConfirm}>
              I am satisfied with this structure — Continue
            </button>
          </div>
        )}
      </div>

      {showCompanions && (
        <>
          <AbstractCard studentContext={studentContext} validatedTopic={state.validatedTopic} chapterStructure={chapterData} />
          <LiteratureMapCard studentContext={studentContext} validatedTopic={state.validatedTopic} chapterStructure={chapterData} />
        </>
      )}
    </>
  )
}
