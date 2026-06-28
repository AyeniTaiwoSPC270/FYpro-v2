import { useState, useEffect } from 'react'
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
import TourCarousel from '../features/onboarding/TourCarousel'

export default function ExpressDashboard() {
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [showTour, setShowTour] = useState(false)
  const [showPrompt, setShowPrompt] = useState(false)
  const { state } = useApp()
  const { user } = useUser()
  const { features } = usePaidFeatures()
  const { projectId, isLoading } = useProjectState()

  useEffect(() => {
    if (!user?.id) return
    const seen = localStorage.getItem('fypro_express_tour_seen')
    if (!seen) setShowPrompt(true)
  }, [user?.id])

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
    <>
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

    {showTour && (
      <TourCarousel
        variant="express"
        onClose={() => {
          setShowTour(false)
          localStorage.setItem('fypro_express_tour_seen', '1')
        }}
      />
    )}

    {showPrompt && !showTour && (
      <div className="wt2-screen">
        <div className="wt2-modal" role="dialog" aria-modal="true" aria-labelledby="wt2-express-heading">
          <div className="wt2-inner">
            <div className="wt2-icon-block">
              <div className="wt2-shield-wrap" aria-hidden="true">
                <svg className="wt2-shield-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="#0066FF" aria-hidden="true">
                  <path d="M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z" />
                </svg>
              </div>
            </div>
            <div className="wt2-heading-block">
              <div className="wt2-eyebrow">Express Defence awaits</div>
              <h2 className="wt2-heading" id="wt2-express-heading">Quick look at how it works?</h2>
            </div>
            <div className="wt2-bullets" role="list">
              {[
                'Upload your project document for a full AI review',
                'Get your personalised Defence Brief with model answers',
                'Face 3 AI examiners in the Defence Simulator',
              ].map((b) => (
                <div key={b} className="wt2-bullet" role="listitem">
                  <div className="wt2-check" aria-hidden="true">
                    <svg viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" /></svg>
                  </div>
                  <span className="wt2-bullet-text">{b}</span>
                </div>
              ))}
            </div>
            <div className="wt2-btn-group">
              <button
                className="wt2-btn-primary"
                onClick={() => {
                  localStorage.setItem('fypro_express_tour_seen', '1')
                  setShowPrompt(false)
                  setShowTour(true)
                }}
              >
                Take the tour <span className="wt2-arrow" aria-hidden="true">→</span>
              </button>
              <button
                className="wt2-btn-ghost"
                onClick={() => {
                  localStorage.setItem('fypro_express_tour_seen', '1')
                  setShowPrompt(false)
                }}
              >
                Skip to my dashboard
              </button>
            </div>
          </div>
        </div>
      </div>
    )}
    </>
  )
}
