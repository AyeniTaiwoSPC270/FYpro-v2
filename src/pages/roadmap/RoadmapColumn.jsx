import RoadmapCard from './RoadmapCard'

const COLUMN_META = {
  done: {
    emoji: '✅',
    label: 'Done',
    labelColor: '#16A34A',
    badgeBg: 'rgba(22,163,74,0.12)',
    badgeBorder: 'rgba(22,163,74,0.28)',
    badgeColor: '#16A34A',
  },
  in_progress: {
    emoji: '🔨',
    label: 'In Progress',
    labelColor: '#3B82F6',
    badgeBg: 'rgba(0,102,255,0.12)',
    badgeBorder: 'rgba(0,102,255,0.28)',
    badgeColor: '#3B82F6',
  },
  coming_soon: {
    emoji: '🔜',
    label: 'Coming Soon',
    labelColor: 'rgba(255,255,255,0.45)',
    badgeBg: 'rgba(255,255,255,0.06)',
    badgeBorder: 'rgba(255,255,255,0.12)',
    badgeColor: 'rgba(255,255,255,0.4)',
  },
}

export default function RoadmapColumn({ status, items }) {
  const meta = COLUMN_META[status]
  const headingId = `roadmap-col-${status}`

  return (
    <section aria-labelledby={headingId}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 10,
          marginBottom: 20,
          paddingBottom: 16,
          borderBottom: '1px solid rgba(255,255,255,0.06)',
        }}
      >
        <span style={{ fontSize: '1.05rem', lineHeight: 1 }} aria-hidden="true">
          {meta.emoji}
        </span>

        <h2
          id={headingId}
          style={{
            fontFamily: "'Poppins', sans-serif",
            fontSize: '0.875rem',
            fontWeight: 600,
            color: meta.labelColor,
            margin: 0,
            lineHeight: 1,
          }}
        >
          {meta.label}
        </h2>

        <span
          style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.62rem',
            color: meta.badgeColor,
            background: meta.badgeBg,
            border: `1px solid ${meta.badgeBorder}`,
            borderRadius: 999,
            padding: '2px 8px',
            letterSpacing: '0.04em',
            lineHeight: 1.6,
          }}
          aria-label={`${items.length} ${items.length === 1 ? 'item' : 'items'}`}
        >
          {items.length}
        </span>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {items.map((item) => (
          <RoadmapCard key={item.id} item={item} />
        ))}

        {items.length === 0 && (
          <p
            style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.82rem',
              color: 'rgba(255,255,255,0.2)',
              textAlign: 'center',
              padding: '28px 0',
              margin: 0,
            }}
          >
            Nothing here yet.
          </p>
        )}
      </div>
    </section>
  )
}
