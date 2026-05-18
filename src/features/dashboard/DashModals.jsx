import { useRef } from 'react'

export function NewSessionModal({ onClose, onConfirm }) {
  const confirmedRef = useRef(false)

  function handleConfirm() {
    if (confirmedRef.current) return
    confirmedRef.current = true
    onConfirm()
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center">
      <div
        className="mt-[20vh] w-full max-w-md mx-4 rounded-2xl p-8"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', maxWidth: 'min(28rem, calc(100vw - 2rem))' }}
      >
        <h2 className="text-white font-semibold text-lg">Start a new project?</h2>
        <p className="text-slate-400 text-sm mt-2">
          Starting a new session will require a project payment. Your current project progress will be saved.
        </p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onClose}
            className="flex-1 rounded-xl px-6 py-2 font-sans text-sm font-medium text-slate-400 hover:border-slate-500 transition-colors duration-150"
            style={{ border: '1px solid var(--border-color)' }}
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 bg-blue-600 hover:bg-blue-500 text-white rounded-xl px-6 py-2 font-sans text-sm font-semibold transition-colors duration-150"
          >
            Continue to Payment
          </button>
        </div>
      </div>
    </div>
  )
}

export function DeleteProjectModal({ onCancel, onConfirm, deleting }) {
  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-start justify-center">
      <div
        className="mt-[20vh] w-full max-w-md mx-4 rounded-2xl p-8"
        style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', maxWidth: 'min(28rem, calc(100vw - 2rem))' }}
      >
        <h2 className="font-sans font-semibold text-lg" style={{ color: 'var(--text-primary)', margin: '0 0 8px' }}>
          Delete this project?
        </h2>
        <p className="font-sans text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          This cannot be undone. All your progress will be permanently lost.
        </p>
        <div className="flex gap-3 mt-6">
          <button
            onClick={onCancel}
            disabled={deleting}
            className="flex-1 rounded-xl px-6 py-2 font-sans text-sm font-medium transition-colors duration-150 disabled:opacity-50"
            style={{ border: '1px solid var(--border-color)', color: 'var(--text-muted)', background: 'none' }}
            onMouseEnter={e => { if (!deleting) e.currentTarget.style.borderColor = 'rgba(100,116,139,0.6)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)' }}
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={deleting}
            className="flex-1 rounded-xl px-6 py-2 font-sans text-sm font-semibold text-white transition-colors duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
            style={{ background: deleting ? '#991B1B' : '#DC2626', border: 'none', cursor: deleting ? 'not-allowed' : 'pointer' }}
            onMouseEnter={e => { if (!deleting) e.currentTarget.style.background = '#B91C1C' }}
            onMouseLeave={e => { if (!deleting) e.currentTarget.style.background = '#DC2626' }}
          >
            {deleting ? 'Deleting…' : 'Delete Forever'}
          </button>
        </div>
      </div>
    </div>
  )
}
