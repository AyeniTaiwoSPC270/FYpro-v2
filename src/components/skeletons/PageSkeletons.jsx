// Pure shimmer skeletons — one per page-layout group.
// All use .skeleton-shimmer (defined in index.css) so dark/light mode works via CSS vars.
// Sidebar + grid layout lives in .page-skel__* classes (touch-targets.css) so the
// sidebar follows the theme and collapses on mobile like the real shell does.
// No props, no state, no hooks — these are static layout placeholders only.

export function AuthPageSkeleton() {
  return (
    <div aria-hidden="true" style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      gap: '12px',
    }}>
      <div className="skeleton-shimmer" style={{ width: 48, height: 48, borderRadius: '50%' }} />
      <div className="skeleton-shimmer" style={{ width: 120, height: 12, borderRadius: 6 }} />
      <div style={{
        width: '100%',
        maxWidth: 400,
        background: 'var(--bg-card, #0D1425)',
        border: '1px solid var(--border-color)',
        borderRadius: 16,
        padding: '32px 28px',
        marginTop: 8,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}>
        <div className="skeleton-shimmer" style={{ width: '55%', height: 22, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: '80%', height: 12, borderRadius: 6 }} />
        <div style={{ height: 8 }} />
        <div className="skeleton-shimmer" style={{ width: '100%', height: 44, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: '100%', height: 44, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: '100%', height: 44, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: '100%', height: 44, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 140, height: 12, borderRadius: 6, alignSelf: 'center' }} />
      </div>
    </div>
  )
}

export function PublicPageSkeleton() {
  return (
    <div aria-hidden="true" style={{ minHeight: '100vh', background: 'var(--bg-base)' }}>
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '16px 32px',
        borderBottom: '1px solid var(--border-color)',
      }}>
        <div className="skeleton-shimmer" style={{ width: 80, height: 18, borderRadius: 6 }} />
        <div style={{ display: 'flex', gap: 24 }}>
          <div className="skeleton-shimmer" style={{ width: 44, height: 12, borderRadius: 6 }} />
          <div className="skeleton-shimmer" style={{ width: 44, height: 12, borderRadius: 6 }} />
          <div className="skeleton-shimmer" style={{ width: 44, height: 12, borderRadius: 6 }} />
        </div>
        <div className="skeleton-shimmer" style={{ width: 80, height: 36, borderRadius: 8 }} />
      </div>
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '80px 24px 48px',
        gap: 16,
      }}>
        <div className="skeleton-shimmer" style={{ width: 120, height: 16, borderRadius: 99 }} />
        <div className="skeleton-shimmer" style={{ width: 'min(55%, 480px)', height: 40, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 'min(40%, 360px)', height: 40, borderRadius: 8 }} />
        <div className="skeleton-shimmer" style={{ width: 'min(45%, 400px)', height: 14, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: 'min(35%, 320px)', height: 14, borderRadius: 6 }} />
        <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
          <div className="skeleton-shimmer" style={{ width: 140, height: 48, borderRadius: 10 }} />
          <div className="skeleton-shimmer" style={{ width: 120, height: 48, borderRadius: 10 }} />
        </div>
      </div>
      <div className="page-skel__grid-3" style={{
        gap: 20,
        padding: '0 24px 48px',
        maxWidth: 960,
        margin: '0 auto',
      }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ height: 100, borderRadius: 14 }} />
        ))}
      </div>
    </div>
  )
}

export function DashboardPageSkeleton() {
  return (
    <div aria-hidden="true" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <div className="page-skel__sidebar">
        <div className="skeleton-shimmer" style={{ width: '70%', height: 20, borderRadius: 8, marginBottom: 16 }} />
        {[0, 1, 2, 3, 4].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ width: '100%', height: 36, borderRadius: 8 }} />
        ))}
      </div>
      <div className="page-skel__content">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div className="skeleton-shimmer" style={{ width: 160, height: 22, borderRadius: 6 }} />
          <div className="skeleton-shimmer" style={{ width: 100, height: 36, borderRadius: 8 }} />
        </div>
        <div className="page-skel__grid-3">
          {[0, 1, 2].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 96, borderRadius: 12 }} />
          ))}
        </div>
        <div className="skeleton-shimmer" style={{ width: 140, height: 16, borderRadius: 6 }} />
        <div className="page-skel__grid-2">
          {[0, 1].map(i => (
            <div key={i} className="skeleton-shimmer" style={{ height: 140, borderRadius: 16 }} />
          ))}
        </div>
      </div>
    </div>
  )
}

export function AppShellSkeleton() {
  return (
    <div aria-hidden="true" style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg-base)' }}>
      <div className="page-skel__sidebar">
        <div className="skeleton-shimmer" style={{ width: '70%', height: 20, borderRadius: 8, marginBottom: 16 }} />
        {[0, 1, 2, 3, 4, 5].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ width: '100%', height: 36, borderRadius: 8 }} />
        ))}
      </div>
      <div className="page-skel__content" style={{ alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {[0, 1, 2, 3, 4, 5].map(i => (
            <div
              key={i}
              style={{ width: 10, height: 10, borderRadius: '50%', background: i === 0 ? '#0066FF' : undefined }}
              className={i === 0 ? undefined : 'skeleton-shimmer'}
            />
          ))}
        </div>
        <div className="skeleton-shimmer" style={{ width: 180, height: 16, borderRadius: 6 }} />
        <div className="skeleton-shimmer" style={{ width: '100%', maxWidth: 660, height: 360, borderRadius: 16 }} />
      </div>
    </div>
  )
}
