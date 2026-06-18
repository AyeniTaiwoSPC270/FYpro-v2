import { useEffect, useState, useRef, useCallback } from 'react'
import { useNavigate, useSearchParams, Navigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'
import { useUser } from '../hooks/useUser'
import { useProjectState } from '../hooks/useProjectState'
import { usePaidFeatures } from '../hooks/usePaidFeatures'
import { useRunLimit } from '../hooks/useRunLimit'
import { usePaystackCheckout } from '../hooks/usePaystackCheckout'
import { supabase } from '../lib/supabase'
import { getAllUserProjects, createProject, archiveAllActiveProjects, updateProject, deleteProject } from '../lib/db'
import { downloadProgressReport } from '../lib/generateReport'
import { showToast } from '../components/Toast'
import AnnouncementBanner from '../components/changelog/AnnouncementBanner'
import PaymentIssueModal from '../components/PaymentIssueModal'
import Spinner from '../components/Spinner'
import BadgeRow from '../components/badges/BadgeRow'
import MomentumRing from '../components/momentum/MomentumRing'
import AchievementsRow from '../components/badges/AchievementsRow'
import Footer from '../components/Footer'
import { DashboardPageSkeleton } from '../components/skeletons/PageSkeletons'

import { buildSteps, ShieldIcon, ArrowRightIcon } from '../features/dashboard/_shared'
import DashSidebar from '../features/dashboard/DashSidebar'
import DashTopBar from '../features/dashboard/DashTopBar'
import DashStatCards from '../features/dashboard/DashStatCards'
import DashProgressJourney from '../features/dashboard/DashProgressJourney'
import DashQuickActions from '../features/dashboard/DashQuickActions'
import DashUsageSection from '../features/dashboard/DashUsageSection'
import ProjectsGrid from '../features/dashboard/ProjectsGrid'
import { NewSessionModal, DeleteProjectModal } from '../features/dashboard/DashModals'

function DashboardSkeleton() {
  return (
    <div style={{ padding: '4px 0 48px' }}>
      {/* Stat cards row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginBottom: 28 }}>
        {[0, 1, 2].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ height: 96, borderRadius: 12 }} />
        ))}
      </div>
      {/* Section heading placeholder */}
      <div className="skeleton-shimmer" style={{ height: 22, width: 160, marginBottom: 16, borderRadius: 6 }} />
      {/* Project cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 16 }}>
        {[0, 1].map(i => (
          <div key={i} className="skeleton-shimmer" style={{ height: 140, borderRadius: 16 }} />
        ))}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const navigate = useNavigate()
  const { state, clearProjectData, isOnboarded, onboardingResolved } = useApp()
  const { selectProject, projectId: activeProjectId, isLoading: projectStateLoading } = useProjectState()

  // Kept as a safety net in case the render-path guard below is bypassed.
  useEffect(() => {
    if (projectStateLoading || !onboardingResolved) return
    if (!isOnboarded) navigate('/start', { replace: true })
  }, [isOnboarded, onboardingResolved, navigate, projectStateLoading])

  const { user } = useUser()
  const [projects, setProjects] = useState([])
  const [projectsLoading, setProjectsLoading] = useState(true)
  const [projectsError, setProjectsError] = useState(null)

  useEffect(() => {
    if (!user?.id) { setProjectsLoading(false); return }
    let cancelled = false
    setProjectsLoading(true)
    setProjectsError(null)
    getAllUserProjects(user.id)
      .then(p => { if (!cancelled) { setProjects(p); setProjectsLoading(false) } })
      .catch(err => { if (!cancelled) { setProjectsError(err?.message || 'Failed to load projects'); setProjectsLoading(false) } })
    return () => { cancelled = true }
  }, [user?.id])

  const [searchParams, setSearchParams] = useSearchParams()
  const projectParam = searchParams.get('project')
  const [selectingProject, setSelectingProject] = useState(false)

  useEffect(() => {
    if (!projectParam) return
    let cancelled = false
    setSelectingProject(true)
    selectProject(projectParam).finally(() => { if (!cancelled) setSelectingProject(false) })
    return () => { cancelled = true }
  }, [projectParam]) // eslint-disable-line react-hooks/exhaustive-deps

  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const close = (e) => { if (e.matches) setSidebarOpen(false) }
    mq.addEventListener('change', close)
    return () => mq.removeEventListener('change', close)
  }, [])

  const [showNewSessionModal, setShowNewSessionModal] = useState(false)
  const [showPaymentIssueModal, setShowPaymentIssueModal] = useState(false)

  const [toastMsg, setToastMsg] = useState('')
  const [toastVisible, setToastVisible] = useState(false)
  const toastTimer = useRef(null)
  const mountedRef = useRef(true)
  useEffect(() => () => { mountedRef.current = false }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  function showToastMessage(msg) {
    setToastMsg(msg)
    setToastVisible(true)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToastVisible(false), 3000)
  }

  const { features, loading: featuresLoading } = usePaidFeatures()
  const { runCounts } = useRunLimit(features)

  const [hasExpressProject, setHasExpressProject] = useState(false)
  useEffect(() => {
    if (!user?.id) return
    if (!features.includes('express_defense')) { setHasExpressProject(false); return }
    import('../lib/db').then(({ getExpressProject }) =>
      getExpressProject(user.id).then(p => setHasExpressProject(!!p))
    )
  }, [user?.id, features])
  const { handlePay, payError } = usePaystackCheckout({ loginReturnUrl: '/dashboard' })

  useEffect(() => { if (payError) showToastMessage(payError) }, [payError])

  const completedCount = state.stepsCompleted.filter(Boolean).length
  const activeStepId = Math.min(6, (state.currentStep ?? 0) + 1)
  const STEPS = buildSteps(state.stepsCompleted, activeStepId)
  const allComplete = state.stepsCompleted.every(Boolean)

  const fullName = state.name || ''
  const initials = fullName
    ? fullName.split(' ').map((n) => n[0]).join('').toUpperCase().slice(0, 2)
    : 'ST'

  const STUDENT = {
    name:          fullName,
    initials,
    avatarUrl:     user?.user_metadata?.avatar_url || state.avatarUrl || null,
    university:    state.university  || '',
    department:    state.department  || '',
    level:         state.level       || '',
    stepsCompleted: completedCount,
    totalSteps:    6,
    currentStepId: activeStepId,
  }

  const handleNewSession = useCallback(() => setShowNewSessionModal(true), [])
  const handleToggleSidebar = useCallback(() => setSidebarOpen(o => !o), [])
  function handleModalClose() { setShowNewSessionModal(false) }
  function handleModalConfirm() { setShowNewSessionModal(false); handlePay('project_reset') }

  const [continuingProjectId, setContinuingProjectId] = useState(null)

  async function handleContinueProject(projectId) {
    setContinuingProjectId(projectId)
    try {
      await updateProject(projectId, { status: 'active' })
      setSearchParams({ project: projectId })
    } finally {
      setContinuingProjectId(null)
    }
  }

  const [isStartingProject, setIsStartingProject] = useState(false)

  async function handleStartNewProject() {
    if (isStartingProjectRef.current) return
    isStartingProjectRef.current = true
    setIsStartingProject(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return

      const isDefenseFreeSlot = Array.isArray(features) && features.includes('defense_pack') && Array.isArray(projects) && projects.length === 0

      if (!isDefenseFreeSlot) {
        const consumeRes = await fetch('/api/payments?action=consume-reset', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        })
        if (!consumeRes.ok) {
          const err = await consumeRes.json().catch(() => ({}))
          showToastMessage(err.error || 'Could not start new project. Please try again.')
          return
        }
        window.dispatchEvent(new Event('fypro_entitlements_updated'))
      }

      await archiveAllActiveProjects()
      const newProject = await createProject({ faculty: state.faculty || null, department: state.department || null, level: state.level || null })
      if (!newProject) { showToastMessage('Failed to create project. Please try again.'); return }
      clearProjectData()
      sessionStorage.setItem('intentional_app_entry', 'true')
      navigate('/app')
    } finally {
      isStartingProjectRef.current = false
      setIsStartingProject(false)
    }
  }

  const isStartingProjectRef = useRef(false)
  const [deleteConfirmId, setDeleteConfirmId] = useState(null)
  const [deleting, setDeleting] = useState(false)

  function handleDeleteProject(projectId) {
    if (projectId === activeProjectId) { showToastMessage('Switch projects before deleting this one.'); return }
    setDeleteConfirmId(projectId)
  }

  async function handleConfirmDelete() {
    if (!deleteConfirmId) return
    const { data: { user: authUser } } = await supabase.auth.getUser()
    if (!authUser) return
    setDeleting(true)
    try {
      await deleteProject(deleteConfirmId, authUser.id)
      setProjects(prev => prev.filter(p => p.id !== deleteConfirmId))
      setDeleteConfirmId(null)
    } catch {
      showToastMessage('Failed to delete project. Please try again.')
    } finally {
      setDeleting(false)
    }
  }

  // Hold the skeleton until Supabase has confirmed onboarding status —
  // prevents the dashboard from rendering and flashing before the /start redirect.
  if (projectStateLoading || projectsLoading || !onboardingResolved) return <DashboardPageSkeleton />

  // Render-path guard: redirect immediately without painting any dashboard content.
  if (!isOnboarded) return <Navigate to="/start" replace />

  return (
    <div className="flex h-dvh-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Mobile sidebar backdrop */}
      <div
        className={`db-sidebar-backdrop${sidebarOpen ? ' db-sidebar-backdrop--visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <DashSidebar STUDENT={STUDENT} STEPS={STEPS} onNewSession={handleNewSession} isOpen={sidebarOpen} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <DashTopBar STUDENT={STUDENT} onNewSession={handleNewSession} onToggleSidebar={handleToggleSidebar} />
        <AnnouncementBanner />

        {!projectsLoading && !projectStateLoading && projects.length > 0 && !state.stepsCompleted[0] && (
          <div
            className="flex-shrink-0 flex items-center flex-wrap justify-between gap-2 px-4 md:px-8"
            style={{ background: 'rgba(245,158,11,0.06)', borderBottom: '1px solid rgba(245,158,11,0.18)', paddingTop: 10, paddingBottom: 10 }}
          >
            <p className="font-sans" style={{ fontSize: '0.85rem', color: 'var(--text-primary)', margin: 0 }}>
              You haven't validated your topic yet. That's the most important first step.
            </p>
            <button
              onClick={() => { sessionStorage.setItem('intentional_app_entry', 'true'); navigate('/app') }}
              className="font-sans font-semibold cursor-pointer"
              style={{ background: 'none', border: 'none', color: '#F59E0B', fontSize: '0.82rem', whiteSpace: 'nowrap', padding: '6px 0', transition: 'color 0.15s ease' }}
              onMouseEnter={e => { e.currentTarget.style.color = '#D97706' }}
              onMouseLeave={e => { e.currentTarget.style.color = '#F59E0B' }}
            >
              Validate my topic →
            </button>
          </div>
        )}

        <main
          className="flex-1 overflow-y-auto p-4 pb-12 sm:px-6 sm:py-7 lg:px-10 lg:pt-9 lg:pb-14"
          style={{ backgroundColor: 'var(--bg-base)', backgroundImage: 'var(--dot-bg-image)', backgroundSize: '28px 28px' }}
        >
          {projectsLoading ? (
            <DashboardSkeleton />
          ) : projectsError ? (
            <div className="flex flex-col items-center justify-center min-h-dvh-offset" style={{ padding: '48px 24px' }}>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.25)', borderRadius: 16, padding: '32px 40px', textAlign: 'center', maxWidth: 440 }}
              >
                <p className="font-sans font-semibold" style={{ color: 'var(--color-red, #DC2626)', fontSize: '1rem', margin: '0 0 8px' }}>Failed to load projects</p>
                <p className="font-sans" style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: '0 0 20px' }}>{projectsError}</p>
                <button
                  onClick={() => {
                    setProjectsError(null)
                    setProjectsLoading(true)
                    getAllUserProjects(user.id)
                      .then(p => { if (mountedRef.current) { setProjects(p); setProjectsLoading(false) } })
                      .catch(err => { if (mountedRef.current) { setProjectsError(err?.message || 'Failed to load projects'); setProjectsLoading(false) } })
                  }}
                  disabled={projectsLoading}
                  className="font-sans font-semibold text-white rounded-xl px-5 py-2.5 cursor-pointer border-0 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                  style={{ background: '#DC2626', fontSize: '0.875rem' }}
                >
                  {projectsLoading ? <><Spinner size={13} /> Retrying…</> : 'Try Again'}
                </button>
              </motion.div>
            </div>
          ) : projects.length === 0 ? (
            <div className="flex flex-col items-center justify-center min-h-dvh-offset" style={{ padding: '48px 24px' }}>
              <motion.div
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
                style={{ background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-input) 100%)', border: '1px solid var(--border-color)', borderRadius: 20, padding: 'clamp(28px, 6vw, 56px) clamp(20px, 5vw, 48px) clamp(24px, 5vw, 48px)', width: '100%', maxWidth: 480, textAlign: 'center', boxShadow: '0 8px 48px rgba(0,0,0,0.18)' }}
              >
                <motion.div animate={{ y: [0, -9, 0] }} transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut' }} className="flex justify-center mb-7">
                  <ShieldIcon size={64} color="#0066FF" />
                </motion.div>
                <h1 className="font-serif text-white mb-3" style={{ fontSize: 'clamp(1.4rem, 5vw, 1.85rem)', lineHeight: 1.2 }}>
                  Let's start your FYP journey
                </h1>
                <p className="font-sans text-slate-400 leading-relaxed" style={{ fontSize: '0.9rem', maxWidth: '38ch', margin: '0 auto 32px' }}>
                  Most students spend weeks on a topic their supervisor rejects. FYPro helps you validate yours in 2 minutes.
                </p>
                <motion.button
                  whileHover={{ y: -2, boxShadow: '0 0 28px rgba(22,163,74,0.45)' }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => { sessionStorage.setItem('intentional_app_entry', 'true'); navigate('/app') }}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-green-600 hover:bg-green-500 text-white border-0 rounded-xl font-sans font-semibold cursor-pointer transition-all duration-200"
                  style={{ fontSize: '0.95rem' }}
                >
                  Validate My Topic <ArrowRightIcon size={14} />
                </motion.button>
              </motion.div>
            </div>
          ) : projectParam ? (
            selectingProject ? (
              <div className="flex items-center justify-center min-h-dvh-offset">
                <div style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: '#0066FF', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
                <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
              </div>
            ) : (
              <>
                <button
                  onClick={() => navigate('/dashboard')}
                  style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: "'Poppins', sans-serif", fontSize: '0.8rem', fontWeight: 500, padding: '0 0 20px', transition: 'color 0.15s ease' }}
                  onMouseEnter={e => e.currentTarget.style.color = 'var(--text-primary)'}
                  onMouseLeave={e => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <line x1="19" y1="12" x2="5" y2="12" /><polyline points="12 19 5 12 12 5" />
                  </svg>
                  My Projects
                </button>
                <BadgeRow />
                <AchievementsRow />
                <MomentumRing />
                <DashStatCards STUDENT={STUDENT} STEPS={STEPS} />
                <DashProgressJourney STEPS={STEPS} STUDENT={STUDENT} />
                <DashUsageSection features={features} runCounts={runCounts} loading={featuresLoading} onPaymentIssue={() => setShowPaymentIssueModal(true)} />
                <DashQuickActions STEPS={STEPS} allComplete={allComplete} showToastMessage={showToastMessage} onDownloadReport={() => downloadProgressReport(state)} />
              </>
            )
          ) : (
            <ProjectsGrid
              projects={projects}
              features={features}
              featuresLoading={featuresLoading}
              onContinue={handleContinueProject}
              onStartNew={handleStartNewProject}
              onPay={() => handlePay('project_reset')}
              onDelete={handleDeleteProject}
              isStartingProject={isStartingProject}
              continuingProjectId={continuingProjectId}
              hasExpress={hasExpressProject}
              onOpenExpress={() => navigate('/express')}
            />
          )}
        </main>
        <Footer />
      </div>

      <AnimatePresence>
        {showNewSessionModal && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <NewSessionModal onClose={handleModalClose} onConfirm={handleModalConfirm} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {deleteConfirmId && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2 }}>
            <DeleteProjectModal onCancel={() => { if (!deleting) setDeleteConfirmId(null) }} onConfirm={handleConfirmDelete} deleting={deleting} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {toastVisible && (
          <div className="fixed bottom-6 left-0 right-0 flex justify-center z-50 pointer-events-none">
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              transition={{ duration: 0.22 }}
              className="pointer-events-auto font-sans text-sm text-white px-5 py-3 rounded-xl border border-slate-700"
              style={{ background: 'var(--bg-card)', boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}
            >
              {toastMsg}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <PaymentIssueModal isOpen={showPaymentIssueModal} onClose={() => setShowPaymentIssueModal(false)} />
    </div>
  )
}
