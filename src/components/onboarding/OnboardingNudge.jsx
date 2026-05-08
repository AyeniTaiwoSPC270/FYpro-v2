import { useNavigate } from 'react-router-dom'

const XIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
)

const ArrowRightIcon = () => (
  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
)

const CompassIcon = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#0066FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
  </svg>
)

export default function OnboardingNudge({ onDismiss }) {
  const navigate = useNavigate()

  function handleOpen() {
    onDismiss()
    sessionStorage.setItem('intentional_app_entry', 'true')
    navigate('/app')
  }

  return (
    <section
      role="region"
      aria-label="Getting started"
      className="relative rounded-2xl flex items-start gap-4 mb-6"
      style={{
        padding: '20px 24px',
        background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-input) 100%)',
        border: '1px solid var(--border-subtle)',
        borderLeft: '4px solid #0066FF',
        boxShadow: '0 4px 24px rgba(0,0,0,0.08), 0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {/* ✕ dismiss — top-right corner */}
      <button
        onClick={onDismiss}
        aria-label="Dismiss getting started nudge"
        className="absolute top-3 right-3 flex items-center justify-center rounded-lg text-slate-500 hover:text-white transition-all duration-150"
        style={{
          width: 28,
          height: 28,
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
        }}
        tabIndex={0}
      >
        <XIcon />
      </button>

      {/* Icon */}
      <div
        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center mt-[2px]"
        style={{ background: 'rgba(0,102,255,0.12)' }}
      >
        <CompassIcon />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 pr-7">
        {/* "Start here" pill */}
        <span
          className="inline-block font-mono tracking-[0.12em] uppercase rounded-full mb-2"
          style={{
            fontSize: '0.58rem',
            padding: '3px 10px',
            background: 'rgba(0,102,255,0.12)',
            color: '#60A5FA',
          }}
        >
          Start here
        </span>

        <h2
          className="font-serif text-white leading-[1.25] mb-[6px]"
          style={{ fontSize: '1.05rem' }}
        >
          Validate your research topic before anything else.
        </h2>

        <p
          className="font-sans text-slate-500 leading-[1.55] mb-4"
          style={{ fontSize: '0.78rem', maxWidth: '58ch' }}
        >
          A weak topic is the most common reason final year projects fail — catch it here before you write a single chapter.
        </p>

        {/* Actions */}
        <div className="flex items-center gap-5 flex-wrap">
          <button
            onClick={handleOpen}
            className="inline-flex items-center gap-2 text-white rounded-xl font-sans font-semibold transition-all duration-200"
            style={{
              padding: '10px 20px',
              fontSize: '0.82rem',
              background: '#16A34A',
              border: 'none',
              cursor: 'pointer',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = '#15803D'
              e.currentTarget.style.boxShadow = '0 0 20px rgba(22,163,74,0.35)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = '#16A34A'
              e.currentTarget.style.boxShadow = 'none'
            }}
            tabIndex={0}
          >
            Open Topic Validator
            <ArrowRightIcon />
          </button>

          <button
            onClick={onDismiss}
            aria-label="Dismiss this nudge"
            className="font-sans text-slate-500 hover:text-slate-300 transition-colors duration-150"
            style={{
              fontSize: '0.78rem',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              textDecoration: 'underline',
              textUnderlineOffset: '3px',
            }}
            tabIndex={0}
          >
            Dismiss
          </button>
        </div>
      </div>
    </section>
  )
}
