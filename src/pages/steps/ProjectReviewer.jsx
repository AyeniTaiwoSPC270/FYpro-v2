import { useState, useRef } from 'react'
import { useApp } from '../../context/AppContext'
import { reviewProject, reviewProjectPDF } from '../../services/api'
import { handleApiError } from '../../services/api'
import { showToast } from '../../components/Toast'

const UPLOAD_SVG_PATH = 'M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-42.34-77.66a8,8,0,0,1-11.32,11.32L136,139.31V184a8,8,0,0,1-16,0V139.31l-10.34,10.35a8,8,0,0,1-11.32-11.32l24-24a8,8,0,0,1,11.32,0Z'

function extractTXT(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const content = e.target.result || ''
      if (content.trim().length < 20) return reject(new Error('The text file appears to be empty or too short to review.'))
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
      if (commaIdx === -1) return reject(new Error('Could not encode the PDF file. Please try again.'))
      const base64 = dataUrl.slice(commaIdx + 1)
      if (!base64) return reject(new Error('PDF appears to be empty. Please try a different file.'))
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
      const bytes = new Uint8Array(e.target.result)
      let rawText = ''
      try { rawText = new TextDecoder('utf-8', { fatal: false }).decode(bytes) }
      catch { for (let i = 0; i < Math.min(bytes.length, 200000); i++) rawText += String.fromCharCode(bytes[i]) }

      const wTMatches = rawText.match(/<w:t[^>]*>([^<]+)<\/w:t>/g) || []
      const extracted = wTMatches.map((m) => m.replace(/<[^>]+>/g, '')).filter((s) => s.trim()).join(' ')
      if (extracted.length >= 100) return resolve({ text: extracted })

      const stripped = rawText.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
      const printable = stripped.replace(/[^\x20-\x7E\n]/g, ' ').replace(/\s+/g, ' ').trim()
      if (printable.length >= 100) return resolve({ text: '[Extracted from Word file]\n\n' + printable })

      reject(new Error('Could not extract text from this Word file. Please save as PDF or .txt and re-upload.'))
    }
    reader.onerror = () => reject(new Error('Could not read the Word file. Please try again.'))
    reader.readAsArrayBuffer(file)
  })
}

async function extractTextFromFile(file) {
  const ext = (file.name || '').split('.').pop().toLowerCase()
  if (ext === 'pdf')  return extractPDF(file)
  if (ext === 'docx') return extractDOCX(file)
  return extractTXT(file)
}

export default function ProjectReviewer() {
  const { state, set, completeStep, navigateStep, studentContext } = useApp()

  const [section, setSection] = useState(
    state.uploadedProject?.reviewData ? 'result' : 'input'
  )
  const [selectedFile, setSelectedFile] = useState(null)
  const [dragOver, setDragOver] = useState(false)
  const [reviewData, setReviewData] = useState(state.uploadedProject?.reviewData || null)
  const [error, setError] = useState('')
  const [processing, setProcessing] = useState(false)

  const fileInputRef = useRef(null)

  function handleFileSelect(file) {
    setError('')
    const name = file.name || ''
    const ext = name.split('.').pop().toLowerCase()
    if (!['pdf', 'docx', 'txt'].includes(ext)) {
      setError('Unsupported file type. Please upload a PDF, Word (.docx), or plain text (.txt) file.')
      return
    }
    if (file.size > 4 * 1024 * 1024) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please upload a file under 4 MB.`)
      return
    }
    setSelectedFile(file)
  }

  function clearFile() {
    setSelectedFile(null)
    setError('')
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function handleReview() {
    if (processing || !selectedFile) return
    setProcessing(true)
    setError('')
    setSection('loading')

    try {
      const extracted = await extractTextFromFile(selectedFile)
      const data = extracted.pdf
        ? await reviewProjectPDF(studentContext, state.validatedTopic, extracted.pdf)
        : await reviewProject(studentContext, state.validatedTopic, extracted.text)

      if (!data?.grade || !data?.strengths || !data?.weaknesses || !data?.examiner_questions) {
        setSection('input')
        setError('The review returned an unexpected format. Please try again.')
        setProcessing(false)
        return
      }

      const projectInfo = {
        fileName: selectedFile.name,
        fileType: selectedFile.name.split('.').pop().toLowerCase(),
        reviewData: data,
      }
      set({ uploadedProject: projectInfo })
      setReviewData(data)
      setSection('result')
      showToast('Analysis complete', 'success')
    } catch (err) {
      setSection('input')
      if (err?.message) {
        setError(err.message)
      } else {
        handleApiError(err, (msg) => setError(msg || 'Something went wrong during the review. Please try again.'))
      }
    } finally {
      setProcessing(false)
    }
  }

  function handleConfirm() {
    completeStep(4)
    showToast('Step 6 unlocked', 'unlock')
  }

  const gradeSlug = (reviewData?.grade || '').toLowerCase()

  return (
    <div className="pr-card" id="pr-card">
      <span className="pr-watermark" aria-hidden="true">5</span>

      {/* ── Input Section ── */}
      <div
        id="pr-input-section"
        className={`pr-input-section${section === 'input' ? ' tv-section--visible' : ' tv-section--hidden'}`}
      >
        <button className="fy-back-btn" onClick={() => navigateStep(3)}>
          ← Back to Writing Planner
        </button>
        <p className="pr-step-label">Step 5: Project Reviewer</p>
        <p className="pr-description">
          Upload your full project or a single chapter. FYPro will grade it, identify 3 strengths and 3 weaknesses specific to your content, and generate the 5 most dangerous examiner questions from your actual work.
        </p>

        <div
          id="pr-upload-zone"
          className={`pr-upload-zone${dragOver ? ' pr-upload-zone--drag' : ''}`}
          tabIndex={0}
          role="button"
          aria-label="Click to upload your project file"
          onClick={() => fileInputRef.current?.click()}
          onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && fileInputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
          onDragLeave={() => setDragOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragOver(false)
            const files = e.dataTransfer?.files
            if (files?.length > 0) handleFileSelect(files[0])
          }}
        >
          <div className="pr-upload-icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="44" height="44" fill="currentColor" aria-hidden="true">
              <path d={UPLOAD_SVG_PATH} />
            </svg>
          </div>
          <p className="pr-upload-primary">
            Drop your file here or <span className="pr-upload-link">click to browse</span>
          </p>
          <p className="pr-upload-formats">PDF · Word (.docx) · Plain text (.txt) · Max 4 MB</p>
          <input
            id="pr-file-input"
            ref={fileInputRef}
            type="file"
            accept=".pdf,.docx,.txt"
            className="pr-file-hidden"
            aria-hidden="true"
            onChange={(e) => e.target.files?.length && handleFileSelect(e.target.files[0])}
          />
        </div>

        {selectedFile && (
          <div id="pr-file-chip" className="pr-file-chip tv-section--visible">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="16" height="16" fill="currentColor" className="pr-chip-icon" aria-hidden="true">
              <path d="M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z" />
            </svg>
            <span id="pr-file-name" className="pr-file-name-text">{selectedFile.name}</span>
            <button id="pr-btn-remove" className="pr-btn-remove" aria-label="Remove file" onClick={(e) => { e.stopPropagation(); clearFile() }}>&times;</button>
          </div>
        )}

        {error && <p id="pr-error-text" className="pr-error-text tv-section--visible">{error}</p>}

        <button
          id="pr-btn-review"
          className="pr-btn-review"
          disabled={!selectedFile || processing}
          onClick={handleReview}
        >
          Review My Project
        </button>
      </div>

      {/* ── Loading Section ── */}
      <div
        id="pr-loading-section"
        className={`pr-loading-section${section === 'loading' ? ' tv-section--visible' : ' tv-section--hidden'}`}
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

      {/* ── Result Section ── */}
      {reviewData && (
        <div
          id="pr-result-section"
          className={`pr-result-section${section === 'result' ? ' tv-section--visible' : ' tv-section--hidden'}`}
        >
          <div id="pr-grade-block" className="pr-grade-block">
            <div className="pr-grade-badge" data-grade={gradeSlug}>
              <span className="pr-grade-label">
                {reviewData.grade}{reviewData.score_estimate ? ` — ${reviewData.score_estimate}` : ''}
              </span>
            </div>
            {reviewData.grade_justification && (
              <p className="pr-grade-justification">{reviewData.grade_justification}</p>
            )}
          </div>

          <div className="pr-feedback-block">
            <p className="pr-feedback-heading pr-feedback-heading--strength">Strengths</p>
            <div id="pr-strengths-list" className="pr-feedback-list">
              {(reviewData.strengths || []).map((item, i) => (
                <div key={i} className="pr-feedback-item pr-feedback-item--strength pr-feedback-item--visible">
                  <p className="pr-feedback-title">{item.title}</p>
                  <p className="pr-feedback-detail">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>

          <div className="pr-feedback-block">
            <p className="pr-feedback-heading pr-feedback-heading--weakness">Weaknesses &amp; Gaps</p>
            <div id="pr-weaknesses-list" className="pr-feedback-list">
              {(reviewData.weaknesses || []).map((item, i) => (
                <div key={i} className="pr-feedback-item pr-feedback-item--weakness pr-feedback-item--visible">
                  <p className="pr-feedback-title">{item.title}</p>
                  <p className="pr-feedback-detail">{item.detail}</p>
                  {item.fix && (
                    <p className="pr-feedback-fix">
                      <span className="pr-fix-label">Fix:</span> {item.fix}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="pr-feedback-block">
            <p className="pr-feedback-heading pr-feedback-heading--questions">5 Examiner Questions From Your Content</p>
            <p className="pr-questions-context">These questions were generated from what you actually wrote. Prepare answers before entering Defence Prep.</p>
            <div id="pr-questions-list" className="pr-questions-list">
              {(reviewData.examiner_questions || []).map((q, i) => (
                <div key={i} className="pr-question-item pr-question-item--visible">
                  <div className="pr-question-number">{q.number || i + 1}</div>
                  <div className="pr-question-body">
                    <p className="pr-question-text">{q.question}</p>
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
        </div>
      )}
    </div>
  )
}
