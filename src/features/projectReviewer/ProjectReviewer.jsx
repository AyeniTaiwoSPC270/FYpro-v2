import { useState, useRef, useEffect } from 'react'
import { reviewProject, reviewProjectPDF, handleApiError } from '../../services/api'
import { useApp } from '../../context/AppContext'

const UPLOAD_D =
  'M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-42.34-77.66a8,8,0,0,1-11.32,11.32L136,139.31V184a8,8,0,0,1-16,0V139.31l-10.34,10.35a8,8,0,0,1-11.32-11.32l24-24a8,8,0,0,1,11.32,0Z'

const CHIP_D =
  'M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z'

const MAX_BYTES = 4 * 1024 * 1024

// ── File extractors (exact vanilla logic) ──────────────────────────────────────

function extractTXT(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target.result || ''
      if (content.trim().length < 20) {
        reject(new Error('The text file appears to be empty or too short to review.'))
        return
      }
      resolve({ text: content })
    }
    reader.onerror = () => reject(new Error('Could not read the text file. Please try again.'))
    reader.readAsText(file)
  })
}

function extractPDF(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result || ''
      const commaIdx = dataUrl.indexOf(',')
      if (commaIdx === -1) {
        reject(new Error('Could not encode the PDF file. Please try again.'))
        return
      }
      const base64 = dataUrl.slice(commaIdx + 1)
      if (!base64) {
        reject(new Error('PDF appears to be empty. Please try a different file.'))
        return
      }
      resolve({ pdf: base64 })
    }
    reader.onerror = () => reject(new Error('Could not read the PDF file. Please try again.'))
    reader.readAsDataURL(file)
  })
}

function extractDOCX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const buffer = e.target.result
      const bytes = new Uint8Array(buffer)
      let rawText = ''
      try {
        rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
      } catch {
        for (let i = 0; i < Math.min(bytes.length, 200000); i++) {
          rawText += String.fromCharCode(bytes[i])
        }
      }

      const wTMatches = rawText.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || []
      const extracted = wTMatches
        .map(m => m.replace(/<[^>]+>/g, ''))
        .filter(s => s.trim().length > 0)
        .join(' ')

      if (extracted.length >= 100) {
        resolve({ text: extracted })
        return
      }

      const stripped = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      // eslint-disable-next-line no-control-regex
      const printable = stripped.replace(/[^\x20-\x7E-ɏ\n]/g, ' ').replace(/\s+/g, ' ').trim()

      if (printable.length >= 100) {
        resolve({ text: '[Extracted from Word file — some formatting may be missing]\n\n' + printable })
        return
      }

      reject(new Error(
        'Could not extract text from this Word file (it may be compressed). ' +
        'Please save it as a PDF or .txt file and upload again.'
      ))
    }
    reader.onerror = () => reject(new Error('Could not read the Word file. Please try again.'))
    reader.readAsArrayBuffer(file)
  })
}

function extractTextFromFile(file) {
  const ext = (file.name || '').split('.').pop().toLowerCase()
  if (ext === 'pdf') return extractPDF(file)
  if (ext === 'docx') return extractDOCX(file)
  return extractTXT(file)
}

function stripScoreRange(raw) {
  if (!raw) return ''
  return String(raw).replace(/\s*[—-]\s*\S+\s*$/, '')
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProjectReviewer() {
  const { state, studentContext, navigateStep, completeStep } = useApp()

  const savedData = state.uploadedProject?.reviewData
  const [section, setSection]         = useState(savedData ? 'result' : 'input')
  const [reviewData, setReviewData]   = useState(savedData || null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [error, setError]             = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging]   = useState(false)

  // Staggered visibility for result items
  const [visibleStrengths, setVisibleStrengths]   = useState([])
  const [visibleWeaknesses, setVisibleWeaknesses] = useState([])
  const [visibleQuestions, setVisibleQuestions]   = useState([])

  const fileInputRef = useRef(null)

  // Trigger stagger-in whenever the result section becomes visible
  useEffect(() => {
    if (section !== 'result' || !reviewData) return
    setVisibleStrengths([])
    setVisibleWeaknesses([])
    setVisibleQuestions([])

    const timers = []
    reviewData.strengths?.forEach((_, idx) => {
      timers.push(setTimeout(() => setVisibleStrengths(prev => [...prev, idx]), idx * 80))
    })
    reviewData.weaknesses?.forEach((_, idx) => {
      timers.push(setTimeout(() => setVisibleWeaknesses(prev => [...prev, idx]), idx * 80))
    })
    reviewData.examiner_questions?.forEach((_, idx) => {
      timers.push(setTimeout(() => setVisibleQuestions(prev => [...prev, idx]), idx * 100))
    })
    return () => timers.forEach(clearTimeout)
  }, [section, reviewData])

  // ── File selection helpers ─────────────────────────────────────────────────

  function handleFileSelect(file) {
    setError(null)
    const ext = (file.name || '').split('.').pop().toLowerCase()
    if (!['pdf', 'docx', 'txt'].includes(ext)) {
      setError('Unsupported file type. Please upload a PDF, Word (.docx), or plain text (.txt) file.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please upload a file under 4 MB, or paste your content as a .txt file.`)
      return
    }
    setSelectedFile(file)
  }

  function clearFileSelection(e) {
    if (e) e.stopPropagation()
    setSelectedFile(null)
    setError(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  // ── Upload zone events ─────────────────────────────────────────────────────

  function handleZoneClick() {
    fileInputRef.current?.click()
  }

  function handleZoneKeyDown(e) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      fileInputRef.current?.click()
    }
  }

  function handleDragOver(e) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e) {
    e.preventDefault()
    setIsDragging(false)
    const files = e.dataTransfer?.files
    if (files && files.length > 0) handleFileSelect(files[0])
  }

  function handleInputChange(e) {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files[0])
    }
  }

  // ── Review handler ─────────────────────────────────────────────────────────

  async function handleReview() {
    if (isProcessing || !selectedFile) return
    setIsProcessing(true)
    setError(null)
    setSection('loading')

    let result
    try {
      result = await extractTextFromFile(selectedFile)
    } catch (err) {
      setIsProcessing(false)
      setSection('input')
      setError(err.message)
      return
    }

    try {
      const validatedTopic = state.validatedTopic || state.roughTopic
      const data = result.pdf
        ? await reviewProjectPDF(studentContext, validatedTopic, result.pdf)
        : await reviewProject(studentContext, validatedTopic, result.text)

      if (!data || !data.grade || !data.strengths || !data.weaknesses || !data.examiner_questions) {
        setSection('input')
        setError('The review returned an unexpected format. Please try again.')
        setIsProcessing(false)
        return
      }

      setReviewData(data)
      setSection('result')
      setIsProcessing(false)
    } catch (err) {
      setIsProcessing(false)
      setSection('input')
      handleApiError(err, msg => setError(msg || 'Something went wrong during the review. Please try again.'))
    }
  }

  // ── Confirm handler ────────────────────────────────────────────────────────

  function handleConfirm() {
    if (!reviewData) return
    completeStep(4, {
      uploadedProject: {
        fileName: selectedFile
          ? selectedFile.name
          : (state.uploadedProject?.fileName || 'uploaded-project'),
        fileType: selectedFile
          ? (selectedFile.name || '').split('.').pop().toLowerCase()
          : (state.uploadedProject?.fileType || 'unknown'),
        reviewData,
      },
    })
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const gradeSlug = (reviewData?.grade || '').toLowerCase()
  const score     = stripScoreRange(reviewData?.score_estimate)

  return (
    <div className="pr-card" id="pr-card">
      <span className="pr-watermark" aria-hidden="true">5</span>

      {/* ── Input Section ──────────────────────────────────────── */}
      <div
        id="pr-input-section"
        className={`pr-input-section ${section === 'input' ? 'tv-section--visible' : 'tv-section--hidden'}`}
      >
        <button className="fy-back-btn" onClick={() => navigateStep(3)}>
          ← Back to Writing Planner
        </button>
        <p className="pr-step-label">Step 5: Project Reviewer</p>
        <p className="pr-description">
          Upload your full project or a single chapter. FYPro will grade it, identify 3 strengths
          and 3 weaknesses specific to your content, and generate the 5 most dangerous examiner
          questions from your actual work.
        </p>

        <div
          id="pr-upload-zone"
          className={`pr-upload-zone${isDragging ? ' pr-upload-zone--drag' : ''}`}
          tabIndex={0}
          role="button"
          aria-label="Click to upload your project file"
          onClick={handleZoneClick}
          onKeyDown={handleZoneKeyDown}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="pr-upload-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="44" height="44" fill="currentColor" aria-hidden="true">
              <path d={UPLOAD_D} />
            </svg>
          </div>
          <p className="pr-upload-primary">
            Drop your file here or <span className="pr-upload-link">click to browse</span>
          </p>
          <p className="pr-upload-formats">PDF &middot; Word (.docx) &middot; Plain text (.txt) &middot; Max 4 MB</p>
          <input
            id="pr-file-input"
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="pr-file-hidden"
            aria-hidden="true"
            onChange={handleInputChange}
          />
        </div>

        {selectedFile && (
          <div id="pr-file-chip" className="pr-file-chip tv-section--visible">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="16" height="16" fill="currentColor" className="pr-chip-icon" aria-hidden="true">
              <path d={CHIP_D} />
            </svg>
            <span id="pr-file-name" className="pr-file-name-text">{selectedFile.name}</span>
            <button
              id="pr-btn-remove"
              className="pr-btn-remove"
              aria-label="Remove file"
              onClick={clearFileSelection}
            >
              &times;
            </button>
          </div>
        )}

        {error && (
          <p id="pr-error-text" className="pr-error-text tv-section--visible">{error}</p>
        )}

        <button
          id="pr-btn-review"
          className="pr-btn-review"
          disabled={!selectedFile || isProcessing}
          onClick={handleReview}
        >
          Review My Project
        </button>
      </div>

      {/* ── Loading Section ─────────────────────────────────────── */}
      <div
        id="pr-loading-section"
        className={`pr-loading-section ${section === 'loading' ? 'tv-section--visible' : 'tv-section--hidden'}`}
      >
        <div className="skeleton-loader">
          <div className="skeleton-bar" style={{ width: '100%' }} />
          <div className="skeleton-bar" style={{ width: '75%' }} />
          <div className="skeleton-bar" style={{ width: '90%' }} />
          <div className="skeleton-bar" style={{ width: '60%' }} />
        </div>
        <p className="tv-loading-text">Reviewing your project…</p>
        <p className="pr-loading-subtext">FYPro is reading your content and assessing academic quality</p>
      </div>

      {/* ── Result Section ──────────────────────────────────────── */}
      <div
        id="pr-result-section"
        className={`pr-result-section ${section === 'result' ? 'tv-section--visible' : 'tv-section--hidden'}`}
      >
        {reviewData && (
          <>
            {/* Grade block */}
            <div id="pr-grade-block" className="pr-grade-block">
              <div className="pr-grade-badge" data-grade={gradeSlug}>
                <span className="pr-grade-label">
                  {reviewData.grade}{score ? ` — ${score}` : ''}
                </span>
              </div>
              {reviewData.grade_justification && (
                <p className="pr-grade-justification">{reviewData.grade_justification}</p>
              )}
            </div>

            {/* Strengths */}
            <div className="pr-feedback-block">
              <p className="pr-feedback-heading pr-feedback-heading--strength">Strengths</p>
              <div id="pr-strengths-list" className="pr-feedback-list">
                {(reviewData.strengths || []).map((item, idx) => (
                  <div
                    key={idx}
                    className={[
                      'pr-feedback-item',
                      'pr-feedback-item--strength',
                      visibleStrengths.includes(idx) ? 'pr-feedback-item--visible' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <p className="pr-feedback-title">{item.title || ''}</p>
                    <p className="pr-feedback-detail">{item.detail || ''}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Weaknesses */}
            <div className="pr-feedback-block">
              <p className="pr-feedback-heading pr-feedback-heading--weakness">Weaknesses &amp; Gaps</p>
              <div id="pr-weaknesses-list" className="pr-feedback-list">
                {(reviewData.weaknesses || []).map((item, idx) => (
                  <div
                    key={idx}
                    className={[
                      'pr-feedback-item',
                      'pr-feedback-item--weakness',
                      visibleWeaknesses.includes(idx) ? 'pr-feedback-item--visible' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <p className="pr-feedback-title">{item.title || ''}</p>
                    <p className="pr-feedback-detail">{item.detail || ''}</p>
                    {item.fix && (
                      <p className="pr-feedback-fix">
                        <span className="pr-fix-label">Fix:</span> {item.fix}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Examiner questions */}
            <div className="pr-feedback-block">
              <p className="pr-feedback-heading pr-feedback-heading--questions">
                5 Examiner Questions From Your Content
              </p>
              <p className="pr-questions-context">
                These questions were generated from what you actually wrote. Prepare answers before entering Defence Prep.
              </p>
              <div id="pr-questions-list" className="pr-questions-list">
                {(reviewData.examiner_questions || []).map((q, idx) => (
                  <div
                    key={idx}
                    className={[
                      'pr-question-item',
                      visibleQuestions.includes(idx) ? 'pr-question-item--visible' : '',
                    ].filter(Boolean).join(' ')}
                  >
                    <div className="pr-question-number">{q.number || idx + 1}</div>
                    <div className="pr-question-body">
                      <p className="pr-question-text">{q.question || ''}</p>
                      {q.target && (
                        <p className="pr-question-target">
                          <span className="pr-target-label">Target:</span> {q.target}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <button id="pr-btn-confirm" className="pr-btn-confirm" onClick={handleConfirm}>
              Continue to Defence Prep
            </button>
          </>
        )}
      </div>
    </div>
  )
}
