import { useRef, useEffect, useState } from 'react'

function formatDate(isoDate) {
  const d = new Date(isoDate + 'T00:00:00')
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

const BORDER_COLOR = {
  done: '#16A34A',
  in_progress: '#0066FF',
  coming_soon: 'rgba(255,255,255,0.18)',
}

export default function RoadmapCard({ item }) {
  const ref                     = useRef(null)
  const [visible, setVisible]   = useState(false)
  const [hovered, setHovered]   = useState(false)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    if (prefersReduced) { setVisible(true); return }

    const observer = new IntersectionObserver(
      ([io]) => {
        if (io.isIntersecting) {
          setVisible(true)
          observer.unobserve(el)
        }
      },
      { threshold: 0.08 }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  const glowShadow = hovered && item.status === 'in_progress'
    ? '0 8px 32px rgba(0,102,255,0.18), 0 2px 8px rgba(0,102,255,0.1)'
    : undefined

  return (
    <article
      ref={ref}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'linear-gradient(145deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.015) 100%)',
        border: '1px solid rgba(255,255,255,0.07)',
        borderLeft: `4px solid ${BORDER_COLOR[item.status]}`,
        borderRadius: 12,
        padding: '18px 20px',
        position: 'relative',
        opacity: visible ? 1 : 0,
        transform: hovered ? 'translateY(-4px)' : visible ? 'translateY(0)' : 'translateY(20px)',
        transition: 'opacity 0.5s ease, transform 0.2s ease, box-shadow 0.2s ease',
        boxShadow: glowShadow,
      }}
    >
      <h3
        style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: '1rem',
          fontWeight: 400,
          color: '#FFFFFF',
          margin: '0 0 8px',
          lineHeight: 1.3,
        }}
      >
        {item.title}
      </h3>

      <p
        style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.82rem',
          color: 'rgba(255,255,255,0.5)',
          lineHeight: 1.65,
          margin: 0,
        }}
      >
        {item.description}
      </p>

      {item.status === 'in_progress' && (
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 5,
            marginTop: 12,
            padding: '3px 10px',
            borderRadius: 999,
            background: 'rgba(0,102,255,0.12)',
            border: '1px solid rgba(0,102,255,0.28)',
          }}
          aria-label="Currently building"
        >
          <span
            style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.62rem',
              color: '#3B82F6',
              letterSpacing: '0.06em',
            }}
          >
            🔨 BUILDING NOW
          </span>
        </div>
      )}

      {item.status === 'done' && item.shippedDate && (
        <time
          dateTime={item.shippedDate}
          style={{
            display: 'block',
            marginTop: 12,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.62rem',
            color: 'rgba(22,163,74,0.65)',
            letterSpacing: '0.04em',
          }}
        >
          Shipped {formatDate(item.shippedDate)}
        </time>
      )}

      {item.status === 'coming_soon' && item.targetWindow && (
        <div
          style={{
            display: 'inline-block',
            marginTop: 12,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.62rem',
            color: 'rgba(255,255,255,0.28)',
            letterSpacing: '0.04em',
          }}
        >
          Target: {item.targetWindow}
        </div>
      )}
    </article>
  )
}
