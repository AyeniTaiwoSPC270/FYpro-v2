import { useState, useRef, useEffect } from 'react'
import { generateLiteratureMap, handleApiError } from '../../services/api'
import { useApp } from '../../context/AppContext'
import { useProjectState } from '../../hooks/useProjectState'

export default function LiteratureMap({ chapters }) {
  const { state, studentContext } = useApp()
  const { saveStep } = useProjectState()

  const [section, setSection]         = useState('input')
  const [data, setData]               = useState(null)
  const [btnDisabled, setBtnDisabled] = useState(false)
  const [error, setError]             = useState(null)
  const [copied, setCopied]           = useState(false)
  const [copiedChip, setCopiedChip]   = useState(null)
  const chipTimers = useRef({})

  useEffect(() => {
    return () => { Object.values(chipTimers.current).forEach(clearTimeout) }
  }, [])

  function handleGenerate() {
    setBtnDisabled(true)
    setError(null)
    setSection('loading')

    const chaps = chapters?.length ? chapters : []

    generateLiteratureMap(studentContext, state.validatedTopic, chaps)
      .then(result => {
        let lmResult = result
        if (!Array.isArray(lmResult?.thematic_areas)) {
          const unwrapped = Object.values(lmResult || {}).find(
            v => v && typeof v === 'object' && Array.isArray(v.thematic_areas)
          )
          if (unwrapped) lmResult = unwrapped
        }
        setData(lmResult)
        setSection('result')
        saveStep('literature_map', lmResult)
      })
      .catch(err => {
        setSection('input')
        setBtnDisabled(false)
        if (!handleApiError(err, msg => setError(msg))) {
          setError('Something went wrong generating the literature map. Please try again.')
        }
      })
  }

  function copyChip(term) {
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(term).catch(() => {})
    setCopiedChip(term)
    if (chipTimers.current[term]) clearTimeout(chipTimers.current[term])
    chipTimers.current[term] = setTimeout(() => setCopiedChip(null), 1400)
  }

  function copyMap() {
    if (!data) return
    const lines = ['LITERATURE MAP', '', 'THEMATIC AREAS']
    ;(data.thematic_areas || []).forEach((area, i) => {
      lines.push('', `${i + 1}. ${area.theme || ''}`)
      ;(area.search_terms || []).forEach(t => lines.push(`   • ${t}`))
    })
    lines.push('', 'RECOMMENDED SOURCES')
    ;(data.source_types || []).forEach(st => {
      lines.push('', `${st.type || ''} — ${st.rationale || ''}`, `Access: ${st.access || ''}`)
    })
    lines.push('', 'SYNTHESIS GUIDE', data.synthesis_guide || '')
    if (Array.isArray(data.papers) && data.papers.length > 0) {
      lines.push('', 'CITATIONS')
      data.papers.forEach((p, i) => {
        const author = p.authors?.[0] || 'Unknown'
        const year   = p.year ? ` (${p.year})` : ''
        const doi    = p.doi ? ` doi:${p.doi}` : ''
        lines.push(`${i + 1}. ${author}${year}. ${p.title}.${doi}`)
      })
    }
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(lines.join('\n')).catch(() => {})
    setCopied(true)
    setTimeout(() => setCopied(false), 1800)
  }

  return (
    <div className="lm-card" id="lm-card">

      {section === 'input' && (
        <div id="lm-input-section" className="lm-input-section tv-section--visible">
          <p className="lm-step-label">Literature Map</p>
          <span className="lm-companion-badge">Companion Card</span>
          <p className="lm-description" style={error ? { color: '#DC2626' } : {}}>
            {error
              ? error
              : 'FYPro will map the intellectual territory of your topic using real published papers — ' +
                'thematic clusters with targeted search terms, recommended sources, and a ' +
                'synthesis guide for building an argument across papers, not just summarising them.'}
          </p>
          <button
            id="lm-btn-generate"
            className="lm-btn-generate"
            onClick={handleGenerate}
            disabled={btnDisabled}
          >
            Generate Literature Map
          </button>
        </div>
      )}

      {section === 'loading' && (
        <div id="lm-loading-section" className="lm-loading-section tv-section--visible">
          <div className="skeleton-loader">
            <div className="skeleton-bar" style={{ width: '100%' }} />
            <div className="skeleton-bar" style={{ width: '75%' }} />
            <div className="skeleton-bar" style={{ width: '90%' }} />
            <div className="skeleton-bar" style={{ width: '60%' }} />
          </div>
          <p className="tv-loading-text">Fetching real papers and mapping your literature…</p>
        </div>
      )}

      {section === 'result' && data && (
        <div id="lm-result-section" className="lm-result-section tv-section--visible">

          {/* Sparse literature amber note */}
          {data.sparse_literature && (
            <div className="lm-sparse-note">
              Limited published work found — this may indicate a research gap.
            </div>
          )}

          <p className="lm-section-heading">Thematic Areas</p>
          <div id="lm-themes-list" className="lm-themes-list">
            {(data.thematic_areas || []).map((area, idx) => (
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

                {/* Real papers belonging to this theme */}
                {Array.isArray(area.paper_indices) && area.paper_indices.length > 0 &&
                  Array.isArray(data.papers) && data.papers.length > 0 && (
                  <ul className="lm-theme-papers">
                    {area.paper_indices
                      .map(i => data.papers[i - 1])
                      .filter(Boolean)
                      .map((paper, pi) => (
                        <li key={pi} className="lm-theme-paper-item">
                          <span className="lm-paper-title">{paper.title}</span>
                          <span className="lm-paper-meta">
                            {paper.authors?.[0] || 'Unknown'}
                            {paper.year ? ` · ${paper.year}` : ''}
                            {typeof paper.citationCount === 'number' && paper.citationCount > 0
                              ? ` · ${paper.citationCount} citations`
                              : ''}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            ))}
          </div>

          <p className="lm-section-heading lm-section-heading--spaced">Recommended Sources</p>
          <div id="lm-sources-list" className="lm-sources-list">
            {(data.source_types || []).map((st, idx) => (
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
            <p className="lm-synthesis-text">{data.synthesis_guide || ''}</p>
          </div>

          {/* Citations section — all real papers with DOI links */}
          {Array.isArray(data.papers) && data.papers.length > 0 && (
            <div className="lm-citations-section">
              <p className="lm-section-heading lm-section-heading--spaced">Citations</p>
              <ol className="lm-citations-list">
                {data.papers.map((paper, idx) => (
                  <li key={idx} className="lm-citation-item">
                    <span className="lm-citation-author">{paper.authors?.[0] || 'Unknown'}</span>
                    {paper.year && (
                      <span className="lm-citation-year"> ({paper.year}). </span>
                    )}
                    <span className="lm-citation-title">{paper.title}.</span>
                    {paper.doi && (
                      <>
                        {' '}
                        <a
                          href={`https://doi.org/${paper.doi}`}
                          className="lm-citation-doi"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          doi:{paper.doi}
                        </a>
                      </>
                    )}
                  </li>
                ))}
              </ol>
            </div>
          )}

          <button
            id="lm-btn-copy"
            className={`lm-btn-copy${copied ? ' lm-btn-copy--copied' : ''}`}
            onClick={copyMap}
          >
            {copied ? 'Copied to clipboard' : 'Copy Literature Map'}
          </button>

        </div>
      )}

    </div>
  )
}
