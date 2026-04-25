import { useState, useEffect } from 'react'
import { generateEmail } from '../services/api'
import { handleApiError } from '../services/api'
import { useApp } from '../context/AppContext'

const SHIELD_PATH =
  'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

function parseEmailParts(data) {
  const rawLines = (data.body || '').split('\n')
  const paragraphs = []
  let current = []
  rawLines.forEach((line) => {
    if (line.trim() === '') {
      if (current.length) { paragraphs.push(current.join('\n')); current = [] }
    } else {
      current.push(line)
    }
  })
  if (current.length) paragraphs.push(current.join('\n'))

  return {
    subject:  data.subject || '',
    greeting: paragraphs[0] || '',
    body:     paragraphs.length > 2 ? paragraphs.slice(1, -1).join('\n\n') : '',
    signoff:  paragraphs.length > 1 ? paragraphs[paragraphs.length - 1] : '',
  }
}

export default function SupervisorEmail({ onClose }) {
  const { state, studentContext } = useApp()

  const [section, setSection] = useState('input')
  const [emailParts, setEmailParts] = useState(null)
  const [rawData, setRawData] = useState(null)
  const [error, setError] = useState('')
  const [revealed, setRevealed] = useState([false, false, false, false])
  const [copied, setCopied] = useState(false)

  // Staggered reveal
  useEffect(() => {
    if (section === 'result') {
      const delays = [0, 400, 800, 1200]
      delays.forEach((d, i) => {
        setTimeout(() => setRevealed((prev) => {
          const next = [...prev]; next[i] = true; return next
        }), d)
      })
    }
  }, [section])

  async function handleGenerate() {
    setError('')
    setSection('loading')
    setRevealed([false, false, false, false])
    try {
      const data = await generateEmail(studentContext, state.validatedTopic, state.chapterStructure, state.chosenMethodology)
      setRawData(data)
      setEmailParts(parseEmailParts(data))
      setSection('result')
    } catch (err) {
      setSection('input')
      handleApiError(err, (msg) => setError(msg || 'Something went wrong. Please check your connection and try again.'))
    }
  }

  function handleCopy() {
    if (!rawData) return
    const text = `Subject: ${rawData.subject}\n\n${rawData.body}`
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }).catch(() => {})
  }

  return (
    <div className="se-card" id="se-card">

      {/* ── Input Section ── */}
      <div
        id="se-input-section"
        className={`se-input-section${section === 'input' ? ' tv-section--visible' : ' tv-section--hidden'}`}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <p className="se-step-label">Supervisor Email</p>
          {onClose && (
            <button
              onClick={onClose}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--color-text-secondary)', fontSize: '1.2rem', lineHeight: 1 }}
              aria-label="Close"
            >
              ✕
            </button>
          )}
        </div>
        <p className="se-description">
          Generate a formal email to send your supervisor introducing your project — topic, objectives, methodology, and a meeting request. All in one.
        </p>
        {error && <p id="se-error-text" className="se-error-text tv-section--visible">{error}</p>}
        <button id="btn-generate-email" className="se-btn-generate" onClick={handleGenerate}>
          Generate Email
        </button>
      </div>

      {/* ── Loading Section ── */}
      <div
        id="se-loading-section"
        className={`se-loading-section${section === 'loading' ? ' tv-section--visible' : ' tv-section--hidden'}`}
      >
        <svg
          id="se-loading-shield"
          className="tv-loading-shield tv-shield--spinning"
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 256 256"
          width="72"
          height="72"
          fill="#0066FF"
          aria-hidden="true"
        >
          <path d={SHIELD_PATH} />
        </svg>
        <p className="tv-loading-text">Drafting your email…</p>
      </div>

      {/* ── Result Section ── */}
      {emailParts && (
        <div
          id="se-result-section"
          className={`se-result-section${section === 'result' ? ' tv-section--visible' : ' tv-section--hidden'}`}
        >
          <div className="se-email-preview">
            <div
              id="se-part-subject"
              className={`se-email-part${revealed[0] ? ' se-email-part--revealed' : ' se-email-part--hidden'}`}
            >
              <span className="se-part-label">Subject</span>
              <p id="se-subject-text" className="se-subject-text">{emailParts.subject}</p>
            </div>

            <div className="se-email-divider" />

            <div
              id="se-part-greeting"
              className={`se-email-part se-body-text${revealed[1] ? ' se-email-part--revealed' : ' se-email-part--hidden'}`}
            >
              {emailParts.greeting}
            </div>

            <div
              id="se-part-body"
              className={`se-email-part se-body-text${revealed[2] ? ' se-email-part--revealed' : ' se-email-part--hidden'}`}
            >
              {emailParts.body}
            </div>

            <div
              id="se-part-signoff"
              className={`se-email-part se-body-text${revealed[3] ? ' se-email-part--revealed' : ' se-email-part--hidden'}`}
            >
              {emailParts.signoff}
            </div>
          </div>

          <div className="se-actions">
            <button id="btn-copy-email" className="se-btn-copy" onClick={handleCopy}>
              {copied ? '✓ Copied' : 'Copy Email'}
            </button>
            {onClose && (
              <button
                onClick={handleGenerate}
                className="se-btn-generate"
                style={{ marginLeft: 8 }}
              >
                Regenerate
              </button>
            )}
          </div>

          <p className="se-note">Remember to replace [Supervisor Name] before sending.</p>
        </div>
      )}
    </div>
  )
}
