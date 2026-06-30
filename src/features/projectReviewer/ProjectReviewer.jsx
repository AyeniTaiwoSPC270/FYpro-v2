import { useState, useRef, useEffect } from 'react'
import { reviewProjectStream, reviewProjectPDFStream, reviewProjectDOCXStream, checkDocumentRelevance, checkDocumentRelevancePDF, handleApiError, logFailure } from '../../services/api'
import { checkAndRecord, recordStepRun, useRunLimit } from '../../hooks/useRunLimit'
import { usePaidFeatures } from '../../hooks/usePaidFeatures'
import { useApp } from '../../context/AppContext'
import { showToast } from '../../components/Toast'
import ApiErrorBox from '../../components/ApiErrorBox'
import LoadingMessages from '../../components/LoadingMessages'
import Spinner from '../../components/Spinner'
import { useProjectState } from '../../hooks/useProjectState'
import FeedbackThumbs from '../../components/feedback/FeedbackThumbs'
import { markStepComplete } from '../../lib/progress'
import { trackEvent } from '../../lib/analytics'
import { useUser } from '../../hooks/useUser'
import { notifyStepCompleted } from '../../lib/notifications'
import { checkAchievements } from '../../lib/checkAchievements'
import { shouldShowCelebration } from '../../lib/celebrations'
import CelebrationModal from '../../components/celebration/CelebrationModal'
import { useAchievements } from '../../hooks/useAchievements'

const LOADING_MESSAGES = [
  'Generating your analysis...',
  'Reviewing the details...',
  'Almost done...',
]

const UPLOAD_D =
  'M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Zm-42.34-77.66a8,8,0,0,1-11.32,11.32L136,139.31V184a8,8,0,0,1-16,0V139.31l-10.34,10.35a8,8,0,0,1-11.32-11.32l24-24a8,8,0,0,1,11.32,0Z'

const CHIP_D =
  'M213.66,82.34l-56-56A8,8,0,0,0,152,24H56A16,16,0,0,0,40,40V216a16,16,0,0,0,16,16H200a16,16,0,0,0,16-16V88A8,8,0,0,0,213.66,82.34ZM160,51.31,188.69,80H160ZM200,216H56V40h88V88a8,8,0,0,0,8,8h48V216Z'

const MAX_BYTES = 4 * 1024 * 1024

// ── File extractors ────────────────────────────────────────────────────────────

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

// DOCX files are sent as raw base64 to the server where mammoth extracts the
// full text — no client-side truncation. extractPDF and extractTXT remain
// client-side; only DOCX moves server-side.
function encodeDOCX(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      const dataUrl = e.target.result || ''
      const commaIdx = dataUrl.indexOf(',')
      if (commaIdx === -1) { reject(new Error('Could not encode the Word file. Please try again.')); return }
      const base64 = dataUrl.slice(commaIdx + 1)
      if (!base64) { reject(new Error('Word file appears to be empty. Please try a different file.')); return }
      resolve({ docx: base64 })
    }
    reader.onerror = () => reject(new Error('Could not read the Word file. Please try again.'))
    reader.readAsDataURL(file)
  })
}

function extractTextFromFile(file) {
  const ext = (file.name || '').split('.').pop().toLowerCase()
  if (ext === 'pdf') return extractPDF(file)
  if (ext === 'docx') return encodeDOCX(file)
  return extractTXT(file)
}

function stripScoreRange(raw) {
  if (!raw) return ''
  return String(raw).replace(/\s*[—-]\s*\S+\s*$/, '')
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function ProjectReviewer() {
  const { state, set, studentContext, navigateStep, completeStep, isExpress } = useApp()
  const { saveStep, projectId } = useProjectState()
  const { features, loading: featuresLoading } = usePaidFeatures()
  const { user } = useUser()
  const CELEBRATION_KEY = 'step_5_complete'
  const STEP_EMOJI = '📄'
  const STEP_BODY = "Project reviewed. You're ready to enter the Defense Simulator."

  const [celebration, setCelebration] = useState(null)
  const { refetch: refetchAchievements } = useAchievements()

  // Express-only users have a lifetime cap (server-enforced); standard users use
  // the project_reviewer key (unlimited for Defense Pack). The counter + soft gate
  // below read the matching key; the server is the authoritative gate either way.
  const reviewerKey = isExpress ? 'express_reviewer' : 'project_reviewer'
  const { isOverLimit, getRemainingRuns } = useRunLimit(features, featuresLoading)
  const overLimit = isOverLimit(reviewerKey)
  const remainingReviews = getRemainingRuns(reviewerKey)

  const savedData = state.uploadedProject?.reviewData ??
    (state.uploadedProject?.grade ? state.uploadedProject : null)
  const [hasSubmitted, setHasSubmitted] = useState(false)
  const [section, setSection]         = useState(savedData ? 'result' : 'input')
  const [reviewData, setReviewData]   = useState(savedData || null)
  const [selectedFile, setSelectedFile] = useState(null)
  const [largeFileWarning, setLargeFileWarning] = useState(null)
  const [error, setError]             = useState(null)
  const [truncationWarning, setTruncationWarning] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [isDragging, setIsDragging]   = useState(false)
  const [chunkCount, setChunkCount]   = useState(0)

  // Staggered visibility for result items
  const [visibleStrengths, setVisibleStrengths]   = useState([])
  const [visibleWeaknesses, setVisibleWeaknesses] = useState([])
  const [visibleQuestions, setVisibleQuestions]   = useState([])

  const fileInputRef          = useRef(null)
  const loadingTimerRef       = useRef(null)
  const slowTimerRef          = useRef(null)
  const inflightRef           = useRef(false)
  const timedOutRef           = useRef(false)
  const processingFileNameRef = useRef('')

  const [slowNetworkMessage, setSlowNetworkMessage] = useState(false)

  // Safety timeout — extended to 120s for poor network conditions.
  // On slow connections, uploading a 4MB PDF as base64 alone can take 40-60s before
  // Anthropic even starts. A 35s slow-network reassurance fires first.
  useEffect(() => {
    if (section === 'loading') {
      timedOutRef.current = false
      setSlowNetworkMessage(false)
      slowTimerRef.current = setTimeout(() => setSlowNetworkMessage(true), 35000)
      loadingTimerRef.current = setTimeout(() => {
        timedOutRef.current = true
        setSection('input')
        setSlowNetworkMessage(false)
        setIsProcessing(false)
        setError('This is taking too long on your connection. Try uploading a smaller file or a .txt version of your project.')
        logFailure('Project Reviewer', { message: 'Client timeout (120s)', code: 'GATEWAY_TIMEOUT' }, processingFileNameRef.current)
      }, 120000)
    } else {
      clearTimeout(loadingTimerRef.current)
      clearTimeout(slowTimerRef.current)
      setSlowNetworkMessage(false)
    }
    return () => {
      clearTimeout(loadingTimerRef.current)
      clearTimeout(slowTimerRef.current)
    }
  }, [section])

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

  // Hydration race guard: mirrors the same pattern in DefenceBrief.
  // If this component mounted before ExpressProjectStateProvider finished loading,
  // savedData was null at init time so section='input'/reviewData=null got frozen in.
  // This effect fires when hydration arrives and restores the result view.
  useEffect(() => {
    const restored = state.uploadedProject?.reviewData ??
      (state.uploadedProject?.grade ? state.uploadedProject : null)
    if (restored && !reviewData && !isProcessing) {
      setReviewData(restored)
      setSection('result')
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.uploadedProject])

  // ── File selection helpers ─────────────────────────────────────────────────

  function handleFileSelect(file) {
    setError(null)
    setTruncationWarning(null)
    const ext = (file.name || '').split('.').pop().toLowerCase()
    if (!['pdf', 'docx', 'txt'].includes(ext)) {
      setError('Unsupported file type. Please upload a PDF, Word (.docx), or plain text (.txt) file.')
      return
    }
    if (file.size > MAX_BYTES) {
      setError(`File is too large (${(file.size / 1024 / 1024).toFixed(1)} MB). Please upload a file under 4 MB, or paste your content as a .txt file.`)
      return
    }
    const isPdf = ext === 'pdf'
    const sizeMB = (file.size / 1024 / 1024).toFixed(1)
    setLargeFileWarning(isPdf && file.size > 2 * 1024 * 1024
      ? `Large PDF (${sizeMB} MB). On a slow connection this can take up to 2 minutes. For faster results, copy your project text into a .txt file and upload that instead.`
      : null
    )
    setSelectedFile(file)
  }

  function clearFileSelection(e) {
    if (e) e.stopPropagation()
    setSelectedFile(null)
    setError(null)
    setLargeFileWarning(null)
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
    if (inflightRef.current || isProcessing || !selectedFile) return
    setError(null)
    inflightRef.current = true
    setIsProcessing(true)

    let allowed
    try {
      allowed = await checkAndRecord('project_reviewer', features)
    } catch {
      inflightRef.current = false
      setIsProcessing(false)
      return
    }
    if (!allowed) {
      inflightRef.current = false
      setIsProcessing(false)
      return
    }
    trackEvent('workflow_step_started', { step: 'project_reviewer' })
    processingFileNameRef.current = selectedFile?.name || ''
    setHasSubmitted(true)
    setChunkCount(0)
    setSection('loading')

    let result
    try {
      result = await extractTextFromFile(selectedFile)
    } catch (err) {
      inflightRef.current = false
      setIsProcessing(false)
      setSection('input')
      setError(err.message)
      return
    }

    // Relevance pre-check before committing to the full review.
    // DOCX skips this — text is only available after server-side mammoth extraction,
    // which happens during the full review call itself.
    try {
      const relevanceCheck = result.pdf
        ? await checkDocumentRelevancePDF(studentContext, result.pdf)
        : result.docx
          ? null
          : await checkDocumentRelevance(studentContext, result.text)

      if (relevanceCheck && relevanceCheck.relevant === false) {
        inflightRef.current = false
        setIsProcessing(false)
        setSection('input')
        setError(
          `This document does not appear to be a ${studentContext.department} project. ` +
          `${relevanceCheck.reason} Please upload the correct file.`
        )
        return
      }
    } catch {
      // Relevance check failure is non-fatal — proceed to full review
    }

    try {
      const validatedTopic = state.validatedTopic || state.roughTopic
      const previousSteps = {
        validatedTopic:    state.validatedTopic,
        chapterStructure:  state.chapterStructure,
        chosenMethodology: state.chosenMethodology,
        methodology:       state.methodology,
        writingPlan:       state.writingPlan,
      }
      const onChunk = (n) => setChunkCount(n)
      const data = result.pdf
        ? await reviewProjectPDFStream(studentContext, validatedTopic, result.pdf, 'application/pdf', previousSteps, onChunk)
        : result.docx
          ? await reviewProjectDOCXStream(studentContext, result.docx, previousSteps, onChunk)
          : await reviewProjectStream(studentContext, validatedTopic, result.text, previousSteps, onChunk)

      if (timedOutRef.current) return
      if (!data || !data.grade || !data.strengths || !data.weaknesses || !data.examiner_questions) {
        inflightRef.current = false
        setSection('input')
        setError('The review returned an unexpected format. Please try again.')
        setIsProcessing(false)
        return
      }

      inflightRef.current = false
      setTruncationWarning(data._truncationWarning || null)
      setReviewData(data)
      setSection('result')
      setIsProcessing(false)
      // Decrement the express lifetime counter for display only — the server already
      // reserved the slot authoritatively. Fired AFTER success so a failed call never
      // burns a count, and never before the request (which would double-count the
      // server-side reservation seed).
      if (isExpress) recordStepRun('express_reviewer')
      set({ uploadedProject: {
        fileName: selectedFile?.name || 'Uploaded document',
        fileType: (selectedFile?.name || '').split('.').pop().toLowerCase() || 'unknown',
        reviewData: data,
      } })
      saveStep('project_reviewer', { reviewData: data })
      setTimeout(() => {
        document.getElementById('pr-result-section')
          ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 80)
    } catch (err) {
      inflightRef.current = false
      // If the 120s timer already fired it called logFailure itself — don't double-log.
      // If we get here first, log now so the failure record is always written.
      if (!timedOutRef.current) {
        logFailure('Project Reviewer', err, processingFileNameRef.current)
      }
      if (timedOutRef.current) return
      setIsProcessing(false)
      setSection('input')
      handleApiError(err, msg => setError(msg || 'Something went wrong during the review. Please try again.'))
    }
  }

  // ── Confirm handler ────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!reviewData) return
    const isFirstReviewerCompletion = isExpress
      ? !(state.expressSteps && state.expressSteps.project_reviewer)
      : !state.stepsCompleted[4]
    const fileName = selectedFile
      ? selectedFile.name
      : (state.uploadedProject?.fileName || 'uploaded-project')
    const fileType = selectedFile
      ? (selectedFile.name || '').split('.').pop().toLowerCase()
      : (state.uploadedProject?.fileType || 'unknown')
    if (isExpress) {
      set({
        uploadedProject: { fileName, fileType, reviewData },
        expressSteps: { ...(state.expressSteps || {}), project_reviewer: true },
      })
    } else {
      completeStep(4, { uploadedProject: { fileName, fileType, reviewData } })
    }
    await saveStep('project_reviewer', {
      fileName,
      grade:               reviewData.grade,
      score_estimate:      reviewData.score_estimate,
      grade_justification: reviewData.grade_justification,
      strengths:           reviewData.strengths,
      weaknesses:          reviewData.weaknesses,
      examiner_questions:  reviewData.examiner_questions,
    })
    // Express is isolated — never write the user-keyed user_progress table.
    if (!isExpress) {
      markStepComplete('project_reviewer')
      if (isFirstReviewerCompletion) notifyStepCompleted(user?.id, 'project_reviewer', 4).catch(() => {})
    }
    showToast('Project reviewed ✓')
    if (isExpress) {
      document.dispatchEvent(new CustomEvent('express:navigate', { detail: { step: 'brief' } }))
    }

    // Check achievements after step completion
    if (isFirstReviewerCompletion) {
      checkAchievements(isExpress ? { projectId } : {}).then(newKeys => {
        if (newKeys.length > 0) {
          showToast(`Achievement unlocked 🏅`, 'success')
          refetchAchievements()
        }
        if (shouldShowCelebration(CELEBRATION_KEY)) {
          setCelebration({
            emoji: STEP_EMOJI,
            headline: 'Step Complete!',
            body: STEP_BODY,
          })
        }
      })
    }
  }

  // ── Skip handler ───────────────────────────────────────────────────────────

  function handleSkip() {
    if (isExpress) {
      set({ expressSteps: { ...(state.expressSteps || {}), project_reviewer: true } })
    } else {
      completeStep(4)
    }
    saveStep('project_reviewer', { skipped: true })
    if (!isExpress) markStepComplete('project_reviewer')
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const gradeSlug = (reviewData?.grade || '').toLowerCase()
  const score     = stripScoreRange(reviewData?.score_estimate)

  return (
    <div className="pr-card" id="pr-card">

      {/* ── Input Section ──────────────────────────────────────── */}
      <div
        id="pr-input-section"
        className={`pr-input-section ${section === 'input' ? 'tv-section--visible' : 'tv-section--hidden'}`}
      >
        <button className="fy-back-btn" onClick={() => { if (isExpress) { window.location.assign('/express') } else { navigateStep(3) } }}>
          {isExpress ? '← Express Dashboard' : '← Back to Writing Planner'}
        </button>
        <p className="pr-step-label">{isExpress ? 'Step 1: Project Reviewer' : 'Step 5: Project Reviewer'}</p>
        <p className="pr-description">
          Upload your full project or a single chapter. FYPro will grade it, identify 3 strengths
          and 3 weaknesses specific to your content, and generate the 5 most dangerous examiner
          questions from your actual work.
        </p>

        {/* Empty state — shown before any file is selected */}
        {!selectedFile && (
          <p style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.8125rem',
            color: 'var(--color-text-muted)',
            marginBottom: '16px',
            lineHeight: 1.6,
            textAlign: 'center',
          }}>
            Upload your draft chapter or full project document. FYPro will review it for structural
            gaps, argument clarity, and common examiner red flags — giving you targeted feedback
            before your defense.
          </p>
        )}

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
          <p className="pr-upload-formats" style={{ marginTop: 4, color: 'var(--color-blue-primary)', opacity: 0.85 }}>
            Tip: For projects 80+ pages, upload as Word (.docx) for best results.
          </p>
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

        {largeFileWarning && (
          <div style={{
            display: 'flex',
            alignItems: 'flex-start',
            gap: 8,
            background: 'var(--color-amber-light)',
            border: '1px solid var(--color-amber)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: 12,
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.78rem',
            color: '#92400e',
            lineHeight: 1.5,
          }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>⚠️</span>
            <span>{largeFileWarning}</span>
          </div>
        )}

        <ApiErrorBox error={error} onRetry={handleReview} />

        {selectedFile && (
          <p style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.75rem',
            color: 'var(--color-text-muted)',
            textAlign: 'center',
            marginBottom: 8,
          }}>
            Review takes 30–60 s — keep this tab open while it runs.
          </p>
        )}

        <button
          id="pr-btn-review"
          className="pr-btn-review"
          disabled={!selectedFile || isProcessing || overLimit}
          onClick={handleReview}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, ...(overLimit ? { opacity: 0.5, cursor: 'not-allowed' } : {}) }}
        >
          {isProcessing ? <><Spinner /> Working…</> : 'Review My Project'}
        </button>
        {isExpress && remainingReviews !== null && !overLimit && (
          <p className="font-mono" style={{ marginTop: 8, fontSize: '0.7rem', color: 'var(--color-text-secondary)', textAlign: 'center' }}>
            {remainingReviews} {remainingReviews === 1 ? 'review' : 'reviews'} left
          </p>
        )}
        {overLimit && (
          <p className="pr-error-text tv-section--visible" style={{ marginTop: 8 }}>
            {isExpress
              ? "You've used all your Express project reviews."
              : "You've reached your limit for this feature. Start a new project or upgrade your plan."}
          </p>
        )}
      </div>

      {/* ── Loading Section ─────────────────────────────────────── */}
      {section === 'loading' && hasSubmitted && (
        <div id="pr-loading-section" className="pr-loading-section tv-section--visible">
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            background: 'var(--color-amber-light)',
            border: '1px solid var(--color-amber)',
            borderRadius: 'var(--radius-sm)',
            padding: '10px 14px',
            marginBottom: 20,
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.8rem',
            color: '#92400e',
          }}>
            <span style={{ fontSize: '1rem' }}>⏱</span>
            <span>{slowNetworkMessage
              ? 'Still uploading on your connection — please keep this tab open. This may take up to 2 minutes on a slow network.'
              : 'This takes 30–60 seconds for large files. Keep this tab open — your review is on the way.'
            }</span>
          </div>
          <div className="skeleton-loader">
            <div className="skeleton-bar" style={{ width: '100%' }} />
            <div className="skeleton-bar" style={{ width: '75%' }} />
            <div className="skeleton-bar" style={{ width: '90%' }} />
            <div className="skeleton-bar" style={{ width: '60%' }} />
          </div>
          <LoadingMessages messages={LOADING_MESSAGES} />
          {chunkCount > 0 && (
            <p style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.7rem',
              color: 'var(--color-text-muted)',
              textAlign: 'center',
              marginTop: 8,
            }}>
              receiving analysis… {chunkCount} chunks
            </p>
          )}
        </div>
      )}

      {/* ── Result Section ──────────────────────────────────────── */}
      <div
        id="pr-result-section"
        className={`pr-result-section ${section === 'result' ? 'tv-section--visible' : 'tv-section--hidden'}`}
      >
        {reviewData && (
          <>
            {/* Truncation warning — shown when the uploaded document was trimmed server-side */}
            {truncationWarning && (
              <div className="pr-truncation-warning" role="note">
                <span className="pr-truncation-icon" aria-hidden="true">⚠</span>
                {truncationWarning}
              </div>
            )}

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
              {isExpress ? 'Save Review & Continue to Defence Brief →' : 'Continue to Defence Prep'}
            </button>

            <FeedbackThumbs feature="project_reviewer" contextId={projectId || undefined} />
          </>
        )}
      </div>

      <CelebrationModal
        open={celebration !== null}
        onClose={() => setCelebration(null)}
        emoji={celebration?.emoji ?? '🎉'}
        headline={celebration?.headline ?? ''}
        body={celebration?.body ?? ''}
        rankLabel={null}
        ctaLabel="Continue"
        onCta={() => setCelebration(null)}
      />

    </div>
  )
}
