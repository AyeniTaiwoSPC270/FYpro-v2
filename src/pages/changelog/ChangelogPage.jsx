import { Link } from 'react-router-dom'
import { changelog } from '../../data/changelog'
import ChangelogEntry from '../../components/changelog/ChangelogEntry'

export default function ChangelogPage() {
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#0D1B2A',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Nav ─────────────────────────────────────────────── */}
      <header
        style={{
          borderBottom: '1px solid rgba(255,255,255,0.06)',
          padding: '0 24px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}
      >
        <Link
          to="/"
          style={{ display: 'flex', alignItems: 'center', gap: 8, textDecoration: 'none' }}
        >
          <img src="/fypro-logo.png" alt="FYPro" style={{ height: 24, width: 'auto' }} />
        </Link>

        <nav style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
          <Link
            to="/"
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.82rem',
              color: 'rgba(255,255,255,0.45)',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
          >
            Home
          </Link>
          <Link
            to="/login"
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.82rem',
              fontWeight: 600,
              color: '#60A5FA',
              textDecoration: 'none',
              transition: 'color 0.15s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.color = '#93C5FD' }}
            onMouseLeave={e => { e.currentTarget.style.color = '#60A5FA' }}
          >
            Launch App →
          </Link>
        </nav>
      </header>

      {/* ── Main content ────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          maxWidth: 720,
          width: '100%',
          margin: '0 auto',
          padding: '56px 24px 80px',
          boxSizing: 'border-box',
        }}
      >
        {/* Page header */}
        <div style={{ marginBottom: 44 }}>
          <div
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.62rem',
              color: '#3B82F6',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
              marginBottom: 14,
            }}
          >
            Release Notes
          </div>
          <h1
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '2rem',
              fontWeight: 400,
              color: '#FFFFFF',
              lineHeight: 1.2,
              margin: '0 0 12px',
            }}
          >
            What's new in FYPro
          </h1>
          <p
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.88rem',
              color: 'rgba(255,255,255,0.4)',
              lineHeight: 1.65,
              margin: 0,
              maxWidth: '52ch',
            }}
          >
            Every improvement, fix, and new feature — newest first.
          </p>
        </div>

        {/* Entry list */}
        <div
          style={{ display: 'flex', flexDirection: 'column', gap: 14 }}
          role="feed"
          aria-label="Changelog entries"
        >
          {changelog.map((entry) => (
            <ChangelogEntry key={entry.id} entry={entry} />
          ))}
        </div>

        {changelog.length === 0 && (
          <p
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.85rem',
              color: 'rgba(255,255,255,0.3)',
              textAlign: 'center',
              marginTop: 48,
            }}
          >
            No entries yet. Check back soon.
          </p>
        )}
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          padding: '20px 24px',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        <span
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.72rem',
            color: 'rgba(255,255,255,0.18)',
          }}
        >
          © 2026 FYPro. Built for African students.
        </span>
      </footer>
    </div>
  )
}
