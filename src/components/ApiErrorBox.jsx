export default function ApiErrorBox({ error, onRetry }) {
  if (!error) return null
  return (
    <div className="api-error-box">
      <p className="api-error-box__message">{error}</p>
      {onRetry && (
        <button className="api-error-box__retry" onClick={onRetry}>
          Try Again
        </button>
      )}
    </div>
  )
}
