import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { useUser } from '../hooks/useUser'
import { usePaidFeatures } from '../hooks/usePaidFeatures'
import { useProjectState } from '../hooks/useProjectState'
import Footer from '../components/Footer'
import { DashboardPageSkeleton } from '../components/skeletons/PageSkeletons'
import { expressBuildSteps } from '../features/dashboard/_shared'
import DashSidebar from '../features/dashboard/DashSidebar'
import DashTopBar from '../features/dashboard/DashTopBar'
import DashStatCards from '../features/dashboard/DashStatCards'
import DashProgressJourney from '../features/dashboard/DashProgressJourney'
import AchievementsRow from '../components/badges/AchievementsRow'
import { EXPRESS_ACHIEVEMENTS } from '../lib/expressAchievements'

export default function ExpressDashboard() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { state } = useApp()
  const { user } = useUser()
  const { features } = usePaidFeatures()
  const { projectId, isLoading } = useProjectState()

  if (isLoading) return <DashboardPageSkeleton />

  // Express-only users have no standard project, and /dashboard would just
  // bounce them straight back here (ExpressDashboardRedirect). Only show the
  // "Main app" link to dual-pack users who actually have a real dashboard.
  const isExpressOnly =
    features.includes('express_defense') &&
    !features.includes('defense_pack') &&
    !features.includes('student_pack')

  const expressSteps = state.expressSteps || {}
  const STEPS = expressBuildSteps(expressSteps)
  const completedCount = STEPS.filter(s => s.status === 'completed').length
  const activeStepId = (STEPS.find(s => s.status === 'active')?.id) ?? STEPS.length

  const fullName = state.name || user?.user_metadata?.full_name || ''
  const initials = fullName
    ? fullName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
    : (user?.user_metadata?.full_name
        ? user.user_metadata.full_name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)
        : '?')

  const STUDENT = {
    name: fullName,
    initials,
    avatarUrl: user?.user_metadata?.avatar_url || state.avatarUrl || null,
    university: state.university || '',
    department: state.department || '',
    level: state.level || '',
    stepsCompleted: completedCount,
    totalSteps: STEPS.length,
    currentStepId: activeStepId,
  }

  return (
    <div className="flex h-dvh-screen overflow-hidden" style={{ background: 'var(--bg-base)' }}>
      {/* Mobile sidebar backdrop */}
      <div
        className={`db-sidebar-backdrop${sidebarOpen ? ' db-sidebar-backdrop--visible' : ''}`}
        onClick={() => setSidebarOpen(false)}
        aria-hidden="true"
      />

      <DashSidebar STUDENT={STUDENT} STEPS={STEPS} navTarget="/express/run" onNewSession={() => navigate('/express/run')} isOpen={sidebarOpen} />

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <DashTopBar STUDENT={STUDENT} onToggleSidebar={() => setSidebarOpen(v => !v)} />

        <main
          className="flex-1 overflow-y-auto p-4 pb-12 sm:px-6 sm:py-7 lg:px-10 lg:pt-9 lg:pb-14"
          style={{ backgroundColor: 'var(--bg-base)', backgroundImage: 'var(--dot-bg-image)', backgroundSize: '28px 28px' }}
        >
          {!isExpressOnly && (
            <button
              onClick={() => navigate('/dashboard')}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontFamily: "'Poppins', sans-serif", fontSize: '0.8rem', fontWeight: 500, padding: '0 0 20px' }}
            >
              ← Main app
            </button>
          )}

          <AchievementsRow projectId={projectId} catalog={EXPRESS_ACHIEVEMENTS} viewAllHref="/express/achievements" />
          <DashStatCards STUDENT={STUDENT} STEPS={STEPS} navTarget="/express/run" />
          <DashProgressJourney STEPS={STEPS} STUDENT={STUDENT} navTarget="/express/run" />

          <div style={{ maxWidth: 860, margin: '24px auto 0' }}>
            <button
              onClick={() => navigate('/express/run')}
              className="font-sans font-semibold text-white"
              style={{ background: '#16A34A', border: 'none', borderRadius: 12, padding: '14px 28px', fontSize: '0.95rem', cursor: 'pointer' }}
            >
              Enter Simulator →
            </button>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  )
}
