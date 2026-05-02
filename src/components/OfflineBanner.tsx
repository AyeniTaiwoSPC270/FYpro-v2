// Offline indicator — shown at the top of the app when connectivity is lost.
// Does NOT block the UI. Students in Nigerian universities lose connectivity routinely.

import { useEffect, useState } from 'react'
import { onStatusChange, getStatus, drain } from '../lib/sync-queue'

export default function OfflineBanner() {
  const [status, setStatus] = useState(getStatus())

  useEffect(() => {
    const unsub = onStatusChange(setStatus)
    return unsub
  }, [])

  if (status === 'online') return null

  return (
    <div
      role="status"
      aria-live="polite"
      className="w-full flex items-center justify-between px-4 py-2 font-sans text-[0.78rem] font-medium"
      style={{
        background: status === 'reconnecting'
          ? 'rgba(245,158,11,0.12)'
          : 'rgba(220,38,38,0.10)',
        borderBottom: `1px solid ${status === 'reconnecting'
          ? 'rgba(245,158,11,0.25)'
          : 'rgba(220,38,38,0.2)'}`,
        color: status === 'reconnecting' ? '#F59E0B' : '#EF4444',
      }}
    >
      <span>
        {status === 'reconnecting'
          ? 'Syncing saved changes…'
          : 'You\'re offline. Changes will sync when you reconnect.'}
      </span>

      {status === 'offline' && (
        <button
          onClick={() => drain()}
          className="font-mono text-[0.72rem] underline underline-offset-2 cursor-pointer bg-transparent border-0 p-0"
          style={{ color: 'inherit' }}
        >
          Retry
        </button>
      )}
    </div>
  )
}
