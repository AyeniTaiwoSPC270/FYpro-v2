// Offline indicator — shown at the top of the app when connectivity is lost.
// Does NOT block the UI. Students in Nigerian universities lose connectivity routinely.
// isOfflineMode = true means the app loaded from the offline snapshot (Supabase unreachable).

import { useEffect, useState } from 'react'
import { onStatusChange, getStatus, drain } from '../lib/sync-queue'

interface Props {
  isOfflineMode?: boolean
}

export default function OfflineBanner({ isOfflineMode = false }: Props) {
  const [status, setStatus] = useState(getStatus())

  useEffect(() => {
    const unsub = onStatusChange(setStatus)
    return unsub
  }, [])

  const isVisible = isOfflineMode || status !== 'online'
  if (!isVisible) return null

  // isOfflineMode: Supabase unreachable at load — showing cached data (amber, non-critical)
  if (isOfflineMode) {
    return (
      <div
        role="status"
        aria-live="polite"
        className="w-full flex items-center justify-between px-4 py-2 font-sans text-[0.78rem] font-medium"
        style={{
          background: 'rgba(245,158,11,0.12)',
          borderBottom: '1px solid rgba(245,158,11,0.25)',
          color: '#F59E0B',
        }}
      >
        <span>Viewing your last saved project — connect to generate new content.</span>
      </div>
    )
  }

  // Write-side queue states: reconnecting or offline
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
