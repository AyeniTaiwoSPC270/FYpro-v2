import { useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'

function formatDate(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
}

function isExternalUrl(href) {
  return href.startsWith('http://') || href.startsWith('https://')
}

export default function ChangelogEntry({ entry }) {
  const ref = useRef(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) { el.style.opacity = '1'; el.style.transform = 'none'; return }

    const observer = new IntersectionObserver(
      ([io]) => {
        if (io.isIntersecting) {
          el.style.opacity = '1'
          el.style.transform = 'translateY(0)'
          observer.unobserve(el)
        }
      },
      { threshold: 0.08 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <article
      ref={ref}
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-color)',
        borderLeft: '3px solid #0066FF',
        borderRadius: 12,
        padding: '22px 24px',
        position: 'relative',
        overflow: 'hidden',
        opacity: 0,
        transform: 'translateY(20px)',
        transition: 'opacity 0.5s ease, transform 0.5s ease, border-left-color 0.2s ease',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        {/* Emoji */}
        <span
          style={{ fontSize: '1.4rem', lineHeight: 1.2, flexShrink: 0, marginTop: 2 }}
          aria-hidden="true"
        >
          {entry.emoji}
        </span>

        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Title + date */}
          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: 12,
              marginBottom: 8,
              flexWrap: 'wrap',
            }}
          >
            <h2
              style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize: '1.05rem',
                fontWeight: 400,
                color: 'var(--color-text-primary)',
                margin: 0,
                lineHeight: 1.3,
              }}
            >
              {entry.title}
            </h2>
            <time
              dateTime={entry.date}
              style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: '0.62rem',
                color: 'var(--color-text-muted)',
                flexShrink: 0,
                letterSpacing: '0.02em',
              }}
            >
              {formatDate(entry.date)}
            </time>
          </div>

          {/* Body */}
          <p
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.84rem',
              color: 'var(--color-text-secondary)',
              lineHeight: 1.65,
              margin: 0,
              maxWidth: '65ch',
            }}
          >
            {entry.body}
          </p>

          {/* Optional CTA */}
          {entry.ctaLabel && entry.ctaHref && (
            isExternalUrl(entry.ctaHref) ? (
              <a
                href={entry.ctaHref}
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'inline-block',
                  marginTop: 12,
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '0.77rem',
                  fontWeight: 600,
                  color: '#60A5FA',
                  textDecoration: 'none',
                }}
              >
                {entry.ctaLabel} →
              </a>
            ) : (
              <Link
                to={entry.ctaHref}
                style={{
                  display: 'inline-block',
                  marginTop: 12,
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: '0.77rem',
                  fontWeight: 600,
                  color: '#60A5FA',
                  textDecoration: 'none',
                }}
              >
                {entry.ctaLabel} →
              </Link>
            )
          )}
        </div>
      </div>
    </article>
  )
}
