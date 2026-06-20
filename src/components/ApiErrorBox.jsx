import { useState, useEffect } from 'react'
import ReportButton from './ReportButton'

export default function ApiErrorBox({ error, onRetry, stepName }) {
  const [retryCount, setRetryCount] = useState(0)

  // Reset counter when error clears (successful retry)
  useEffect(() => {
    if (!error) setRetryCount(0)
  }, [error])

  if (!error) return null

  function handleRetry() {
    setRetryCount(c => c + 1)
    onRetry?.()
  }

  return (
    <div className="api-error-box">
      <p className="api-error-box__message">{error}</p>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
        {onRetry && (
          <button className="api-error-box__retry" onClick={handleRetry}>
            Try Again
          </button>
        )}
        {retryCount >= 2 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
            <span style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-muted)',
              fontFamily: "'Poppins', sans-serif",
            }}>
              Still not working?
            </span>
            <ReportButton
              type="error"
              context={{
                url: window.location.pathname,
                ...(stepName && { step_name: stepName }),
                error_message: error,
              }}
              label="Let us know and we'll fix it."
            />
          </div>
        )}
      </div>
    </div>
  )
}
