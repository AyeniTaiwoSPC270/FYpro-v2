import { useState, useEffect } from 'react'
import { generateEmail, handleApiError } from '../../services/api'
import { useApp } from '../../context/AppContext'

export default function SupervisorEmail({ onClose }) {
  const { state, studentContext } = useApp()

  const [section, setSection]     = useState('input')  // 'input' | 'loading' | 'result'
  const [emailData, setEmailData] = useState(null)
  const [error, setError]         = useState(null)
  const [copied, setCopied]       = useState(false)

  // Staggered reveal state for the 4 email parts
  const [revealedParts, setRevealedParts] = useState([])

  useEffect(() => {
    if (section !== 'result' || !emailData) return
    setRevealedParts([])
    const DELAY = 400
    const ids = ['subject', 'greeting', 'body', 'signoff']
    const timers = ids.map((id, i) =>
      setTimeout(() => setRevealedParts(prev => [...prev, id]), i * DELAY)
    )
    return () => timers.forEach(clearTimeout)
  }, [section, emailData])

  // ── Derive chapter summary string from context ─────────────────────────────
  function buildChapterSummary() {
    const cs = state.chapterStructure
    if (cs?.chapters?.length) {
      return cs.chapters.map(c => `${c.number}. ${c.title}`).join('; ')
    }
    return state.validatedTopic || state.roughTopic || ''
  }

  // ── Split raw body into paragraph groups ──────────────────────────────────
  function parseEmailBody(body) {
    const raw = (body || '').split('\n')
    const paragraphs = []
    let current = []
    for (const line of raw) {
      if (line.trim() === '') {
        if (current.length) { paragraphs.push(current.join('\n')); current = [] }
      } else {
        current.push(line)
      }
    }
    if (current.length) paragraphs.push(current.join('\n'))
    return {
      greeting: paragraphs[0] || '',
      body:     paragraphs.length > 2 ? paragraphs.slice(1, -1).join('\n\n') : '',
      signoff:  paragraphs.length > 1 ? paragraphs[paragraphs.length - 1] : '',
    }
  }

  // ── Generate handler ────────────────────────────────────────────────────────
  async function handleGenerate() {
    setError(null)
    setSection('loading')

    try {
      const data = await generateEmail(
        studentContext,
        state.validatedTopic || state.roughTopic || '',
        state.chapterStructure,
        state.chosenMethodology
      )
      setEmailData(data)
      setSection('result')
    } catch (err) {
      setSection('input')
      handleApiError(err, msg => setError(msg || 'Something went wrong. Please try again.'))
    }
  }

  // ── Copy handler ─────────────────────────────────────────────────────────
  function handleCopy() {
    if (!emailData) return
    const fullText = `Subject: ${emailData.subject || ''}\n\n${emailData.body || ''}`
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  const parsed = emailData ? parseEmailBody(emailData.body) : {}

  return (
    <div className="se-card" id="se-card">

      {/* ── Input Section ──────────────────────────────────── */}
      <div
        id="se-input-section"
        className={`se-input-section ${section === 'input' ? 'tv-section--visible' : 'tv-section--hidden'}`}
      >
        {onClose && (
          <button className="fy-back-btn" onClick={onClose}>
            ← Back to steps
          </button>
        )}
        <p className="se-step-label">Supervisor Email</p>
        <p className="se-description">
          Generate a formal email to send your supervisor introducing your project — topic,
          objectives, methodology, and a meeting request. All in one.
        </p>
        {error && <p className="se-error-text tv-section--visible">{error}</p>}
        <button className="se-btn-generate" onClick={handleGenerate}>
          Generate Email
        </button>
      </div>

      {/* ── Loading Section ─────────────────────────────────── */}
      <div
        id="se-loading-section"
        className={`se-loading-section ${section === 'loading' ? 'tv-section--visible' : 'tv-section--hidden'}`}
      >
        <p className="tv-loading-text">Drafting your email&hellip;</p>
      </div>

      {/* ── Result Section ──────────────────────────────────── */}
      <div
        id="se-result-section"
        className={`se-result-section ${section === 'result' ? 'tv-section--visible' : 'tv-section--hidden'}`}
      >
        {emailData && (
          <>
            <div className="se-email-preview">

              {/* Subject */}
              <div
                id="se-part-subject"
                className={`se-email-part ${revealedParts.includes('subject') ? 'se-email-part--revealed' : 'se-email-part--hidden'}`}
              >
                <span className="se-part-label">Subject</span>
                <p className="se-subject-text">{emailData.subject || ''}</p>
              </div>

              <div className="se-email-divider" />

              {/* Greeting */}
              <div
                id="se-part-greeting"
                className={`se-email-part se-body-text ${revealedParts.includes('greeting') ? 'se-email-part--revealed' : 'se-email-part--hidden'}`}
              >
                {parsed.greeting}
              </div>

              {/* Body */}
              <div
                id="se-part-body"
                className={`se-email-part se-body-text ${revealedParts.includes('body') ? 'se-email-part--revealed' : 'se-email-part--hidden'}`}
              >
                {parsed.body}
              </div>

              {/* Signoff */}
              <div
                id="se-part-signoff"
                className={`se-email-part se-body-text ${revealedParts.includes('signoff') ? 'se-email-part--revealed' : 'se-email-part--hidden'}`}
              >
                {parsed.signoff}
              </div>

            </div>

            <div className="se-actions">
              <button className="se-btn-copy" onClick={handleCopy}>
                {copied ? '✓ Copied' : 'Copy Email'}
              </button>
              <button
                className="se-btn-generate"
                style={{ marginLeft: 8, width: 'auto', padding: '11px 20px' }}
                onClick={handleGenerate}
              >
                Regenerate
              </button>
            </div>

            <p className="se-note">Remember to replace [Supervisor Name] before sending.</p>
          </>
        )}
      </div>

    </div>
  )
}
