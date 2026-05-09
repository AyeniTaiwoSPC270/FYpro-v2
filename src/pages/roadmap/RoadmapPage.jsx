import { Link } from 'react-router-dom'
import { roadmap } from '../../data/roadmap'
import RoadmapColumn from './RoadmapColumn'

const STATUSES = ['done', 'in_progress', 'coming_soon']

export default function RoadmapPage() {
  const itemsByStatus = STATUSES.reduce((acc, s) => {
    acc[s] = roadmap.filter((item) => item.status === s)
    return acc
  }, {})

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
            onMouseEnter={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.8)' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.45)' }}
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
            onMouseEnter={(e) => { e.currentTarget.style.color = '#93C5FD' }}
            onMouseLeave={(e) => { e.currentTarget.style.color = '#60A5FA' }}
          >
            Launch App →
          </Link>
        </nav>
      </header>

      {/* ── Main ────────────────────────────────────────────── */}
      <main
        style={{
          flex: 1,
          width: '100%',
          maxWidth: 1120,
          margin: '0 auto',
          padding: '56px 24px 80px',
          boxSizing: 'border-box',
        }}
      >
        {/* Page header */}
        <div style={{ marginBottom: 48 }}>
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
            Public Roadmap
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
            What we're building
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
            Here's what we've shipped, what we're building, and what's next.
          </p>
        </div>

        {/* Three-column grid — stacks to 1 column below 768px */}
        <div
          className="roadmap-grid"
          style={{
            display: 'grid',
            gap: 24,
            alignItems: 'start',
          }}
        >
          {STATUSES.map((status) => (
            <RoadmapColumn key={status} status={status} items={itemsByStatus[status]} />
          ))}
        </div>
      </main>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer
        style={{
          borderTop: '1px solid rgba(255,255,255,0.05)',
          padding: '24px',
          textAlign: 'center',
          flexShrink: 0,
        }}
      >
        <p
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.82rem',
            color: 'rgba(255,255,255,0.35)',
            margin: 0,
          }}
        >
          Have a feature request?{' '}
          <a
            href="mailto:hello@fypro.com.ng"
            style={{
              color: '#60A5FA',
              textDecoration: 'none',
            }}
          >
            Email hello@fypro.com.ng
          </a>
        </p>
      </footer>

      {/* Responsive: collapse grid to single column on mobile */}
      <style>{`
        @media (max-width: 767px) {
          .roadmap-grid {
            grid-template-columns: 1fr !important;
          }
        }
      `}</style>
    </div>
  )
}
