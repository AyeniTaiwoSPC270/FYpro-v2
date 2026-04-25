import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'

// ── Internal store (singleton, no React needed for triggering) ─────────────────
let _listeners = []
let _nextId = 1

export function showToast(message, type = 'success') {
  const id = _nextId++
  _listeners.forEach((fn) => fn({ id, message, type }))
  return id
}

// ── Provider ───────────────────────────────────────────────────────────────────
export function ToastProvider() {
  const [toasts, setToasts] = useState([])
  const timers = useRef({})

  const remove = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
    clearTimeout(timers.current[id])
    delete timers.current[id]
  }, [])

  useEffect(() => {
    const handler = (toast) => {
      setToasts((prev) => [...prev, toast])
      timers.current[toast.id] = setTimeout(() => remove(toast.id), 3500)
    }
    _listeners.push(handler)
    return () => {
      _listeners = _listeners.filter((fn) => fn !== handler)
    }
  }, [remove])

  useEffect(() => {
    return () => { Object.values(timers.current).forEach(clearTimeout) }
  }, [])

  const ICONS = { success: '✓', error: '⚠', unlock: '→' }

  return createPortal(
    <div id="fy-toast-container">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={`fy-toast fy-toast--${t.type || 'success'} fy-toast--visible`}
          role="status"
        >
          <span className="fy-toast-icon">{ICONS[t.type] || '✓'}</span>
          <span>{t.message}</span>
          <button
            onClick={() => remove(t.id)}
            aria-label="Dismiss"
            style={{ marginLeft: 8, background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, fontSize: '0.8rem', color: 'inherit' }}
          >
            ✕
          </button>
        </div>
      ))}
    </div>,
    document.body
  )
}
