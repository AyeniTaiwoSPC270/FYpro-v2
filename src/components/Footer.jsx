import { Link } from 'react-router-dom'

export default function Footer() {
  return (
    <footer
      className="py-8 px-6 border-t"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-sidebar)' }}
    >
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
          FYPro · Lagos, Nigeria
        </span>

        <nav className="flex flex-wrap items-center gap-4">
          <Link
            to="/roadmap"
            className="font-sans text-xs no-underline hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            Public roadmap
          </Link>
          <Link
            to="/privacy"
            className="font-sans text-xs no-underline hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            Privacy
          </Link>
          <Link
            to="/terms"
            className="font-sans text-xs no-underline hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            Terms
          </Link>
          <Link
            to="/cookie-policy"
            className="font-sans text-xs no-underline hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            Cookie Policy
          </Link>
        </nav>
      </div>
    </footer>
  )
}
