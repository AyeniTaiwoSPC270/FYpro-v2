import { useState, useRef, useEffect } from 'react'
import { motion } from 'framer-motion'
import { STEP_NAME_TO_NUM, DotsHorizontalIcon, LockIcon, PlusIcon, TrashIcon, ArrowRightIcon } from './_shared'

function ProjectCard({ project, onContinue, onDelete, isLoading }) {
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef(null)

  const title = project.title || 'Untitled Project'
  const truncatedTitle = title.length > 60 ? title.slice(0, 60) + '…' : title
  const lastActive = new Date(project.updated_at || project.created_at).toLocaleDateString('en-NG', {
    year: 'numeric', month: 'short', day: 'numeric',
  })
  const stepNum = STEP_NAME_TO_NUM[project.current_step] ?? 1

  useEffect(() => {
    function handleOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false)
    }
    if (menuOpen) document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [menuOpen])

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      style={{
        background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-input) 100%)',
        border: '1px solid var(--border-color)',
        borderRadius: 16,
        padding: '24px 24px 20px',
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
        boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        position: 'relative',
      }}
      whileHover={{ boxShadow: '0 8px 32px rgba(0,0,0,0.14)' }}
    >
      {/* Faculty + options menu */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--text-muted)' }}>
          {project.faculty || '—'}
        </span>
        <div style={{ position: 'relative' }} ref={menuRef}>
          <button
            onClick={(e) => { e.stopPropagation(); setMenuOpen(v => !v) }}
            aria-label="Project options"
            aria-expanded={menuOpen}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', padding: '4px 6px', borderRadius: 6, display: 'flex', alignItems: 'center', transition: 'color 0.15s ease' }}
            onMouseEnter={e => { e.currentTarget.style.color = 'var(--text-primary)' }}
            onMouseLeave={e => { e.currentTarget.style.color = 'var(--text-muted)' }}
          >
            <DotsHorizontalIcon />
          </button>
          {menuOpen && (
            <div style={{ position: 'absolute', right: 0, top: 'calc(100% + 4px)', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, overflow: 'hidden', zIndex: 20, boxShadow: '0 8px 24px rgba(0,0,0,0.25)', minWidth: 130 }}>
              <button
                onClick={(e) => { e.stopPropagation(); setMenuOpen(false); onDelete(project.id) }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', background: 'none', border: 'none', cursor: 'pointer', padding: '10px 14px', fontFamily: "'Poppins', sans-serif", fontSize: '0.8rem', color: '#DC2626', textAlign: 'left', transition: 'background 0.15s ease' }}
                onMouseEnter={e => { e.currentTarget.style.background = 'rgba(220,38,38,0.06)' }}
                onMouseLeave={e => { e.currentTarget.style.background = 'none' }}
              >
                <TrashIcon size={13} /> Delete
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Topic title */}
      <h3 className="font-serif" style={{ fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.35, margin: 0 }}>
        {truncatedTitle}
      </h3>

      {/* Last active + step progress */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.64rem', color: 'var(--text-muted)' }}>
          {lastActive}
        </span>
        <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.61rem', fontWeight: 600, color: '#3B82F6', background: 'rgba(59,130,246,0.10)', border: '1px solid rgba(59,130,246,0.22)', borderRadius: 999, padding: '2px 9px', whiteSpace: 'nowrap' }}>
          Step {stepNum} of 6
        </span>
      </div>

      {/* Continue button */}
      <motion.button
        whileHover={!isLoading ? { y: -1, boxShadow: '0 0 20px rgba(22,163,74,0.35)' } : {}}
        whileTap={!isLoading ? { scale: 0.97 } : {}}
        onClick={() => { if (!isLoading) onContinue(project.id) }}
        disabled={isLoading}
        style={{ width: '100%', background: '#16A34A', color: '#fff', border: 'none', borderRadius: 10, padding: '11px 20px', fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.85rem', cursor: isLoading ? 'default' : 'pointer', transition: 'background 0.15s ease, opacity 0.15s ease', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: 4, opacity: isLoading ? 0.65 : 1 }}
        onMouseEnter={e => { if (!isLoading) e.currentTarget.style.background = '#15803D' }}
        onMouseLeave={e => { e.currentTarget.style.background = '#16A34A' }}
      >
        {isLoading ? (
          <>
            <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
            Loading…
          </>
        ) : (
          <>Continue <ArrowRightIcon size={13} /></>
        )}
      </motion.button>
    </motion.div>
  )
}

function NewProjectCard({ features, featuresLoading, projects, onStartNew, onPay, isStarting }) {
  const hasProjectReset = !featuresLoading && Array.isArray(features) && features.includes('project_reset')
  const isDefense = Array.isArray(features) && features.includes('defense_pack')
  const hasDefenseFreeSlot = !featuresLoading && isDefense && Array.isArray(projects) && projects.length === 0
  const canStartNew = hasProjectReset || hasDefenseFreeSlot

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1], delay: 0.05 }}
      onClick={canStartNew ? undefined : onPay}
      style={{
        background: canStartNew
          ? 'linear-gradient(145deg, rgba(22,163,74,0.06) 0%, rgba(22,163,74,0.02) 100%)'
          : 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-input) 100%)',
        border: canStartNew ? '1.5px dashed rgba(22,163,74,0.4)' : '1.5px dashed var(--border-color)',
        borderRadius: 16,
        padding: '28px 28px 24px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        minHeight: 160,
        cursor: canStartNew ? 'default' : 'pointer',
        transition: 'border-color 0.2s ease, box-shadow 0.2s ease',
      }}
      whileHover={!canStartNew ? { boxShadow: '0 4px 20px rgba(0,0,0,0.1)' } : {}}
    >
      {canStartNew ? (
        <>
          <div style={{ width: 40, height: 40, borderRadius: '50%', background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(22,163,74,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <PlusIcon />
          </div>
          <p className="font-sans" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            New Project
          </p>
          <motion.button
            whileHover={!isStarting ? { y: -1, boxShadow: '0 0 20px rgba(22,163,74,0.35)' } : {}}
            whileTap={!isStarting ? { scale: 0.97 } : {}}
            onClick={() => { if (!isStarting) onStartNew() }}
            disabled={isStarting}
            style={{ background: '#16A34A', color: '#fff', border: 'none', borderRadius: 10, padding: '9px 20px', fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.82rem', cursor: isStarting ? 'default' : 'pointer', transition: 'background 0.15s ease, opacity 0.15s ease', opacity: isStarting ? 0.65 : 1, display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            {isStarting ? (
              <>
                <svg className="animate-spin" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
                Starting…
              </>
            ) : (
              'Start New Project'
            )}
          </motion.button>
        </>
      ) : (
        <>
          <LockIcon size={20} />
          <p className="font-sans" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>
            New Project
          </p>
          <p className="font-mono" style={{ fontSize: '0.72rem', color: 'var(--text-muted)', margin: 0 }}>
            ₦1,500 to unlock
          </p>
        </>
      )}
    </motion.div>
  )
}

export default function ProjectsGrid({ projects, features, featuresLoading, onContinue, onStartNew, onPay, onDelete, isStartingProject, continuingProjectId }) {
  return (
    <div style={{ maxWidth: 860, margin: '0 auto' }}>
      <div style={{ marginBottom: 28 }}>
        <h1 className="font-serif" style={{ fontSize: '1.6rem', color: 'var(--text-primary)', margin: '0 0 6px' }}>
          My Projects
        </h1>
        <p className="font-sans" style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>
          {projects.length} project{projects.length !== 1 ? 's' : ''}
        </p>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(min(280px, 100%), 1fr))', gap: 16 }}>
        {projects.map(p => (
          <ProjectCard key={p.id} project={p} onContinue={onContinue} onDelete={onDelete} isLoading={continuingProjectId === p.id} />
        ))}
        <NewProjectCard features={features} featuresLoading={featuresLoading} projects={projects} onStartNew={onStartNew} onPay={onPay} isStarting={isStartingProject} />
      </div>
    </div>
  )
}
