import ApiErrorBox from './ApiErrorBox'

// Shown in place of a redirect or blank shell when a page can't load because a
// required fetch (project state, entitlements, project mode) failed — never guess
// a destination or render an empty page on a network blip.
export default function FullPageLoadError({
  message = "Couldn't load your data. Check your connection and try again.",
  onRetry,
  stepName,
}) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      background: 'var(--bg-base)',
      padding: '24px',
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        <ApiErrorBox error={message} onRetry={onRetry} stepName={stepName} />
      </div>
    </div>
  )
}
