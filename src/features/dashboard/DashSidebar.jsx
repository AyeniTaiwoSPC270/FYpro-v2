import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import { CheckIcon, LockIcon } from './_shared'

export default function DashSidebar({ STUDENT, STEPS, onNewSession, isOpen }) {
  const navigate = useNavigate()
  const { navigateStep } = useApp()

  return (
    <aside
      className={`flex flex-col flex-shrink-0 border-r border-slate-800/60 db-sidebar${isOpen ? ' db-sidebar--open' : ''}`}
      style={{
        width: 260,
        minHeight: '100vh',
        background: 'linear-gradient(180deg, var(--bg-sidebar) 0%, var(--sidebar-gradient-end) 100%)',
      }}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 border-b border-slate-800/60 px-[22px] py-[26px]">
        <img src="/fypro-logo.png" alt="FYPro" className="h-9 w-auto" />
      </div>

      {/* Navigation label */}
      <div className="px-5 pt-5 pb-2.5 font-mono text-[0.58rem] tracking-[0.14em] uppercase text-slate-600">
        Research Steps
      </div>

      {/* Step list */}
      <nav className="flex-1 pb-4">
        {STEPS.map((step, i) => {
          const isCompleted = step.status === 'completed'
          const isActive    = step.status === 'active'
          const isLocked    = step.status === 'locked'

          return (
            <motion.div
              key={step.id}
              initial={{ opacity: 0, x: -14 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.06 + 0.08, duration: 0.38, ease: [0.22, 1, 0.36, 1] }}
              role="button"
              tabIndex={isLocked ? -1 : 0}
              aria-disabled={isLocked}
              onClick={!isLocked ? () => { sessionStorage.setItem('intentional_app_entry', 'true'); navigateStep(i); navigate('/app') } : undefined}
              onKeyDown={!isLocked ? (e) => { if (e.key === 'Enter' || e.key === ' ') { sessionStorage.setItem('intentional_app_entry', 'true'); navigateStep(i); navigate('/app') } } : undefined}
              className={`db-sidebar-item flex items-center gap-[11px] pl-3 pr-4 py-[10px] mb-0.5 outline-none transition-all duration-200 ${
                isActive ? 'db-sidebar-active' : ''
              } ${isLocked ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Step badge */}
              <div
                className={`w-[27px] h-[27px] rounded-full flex items-center justify-center flex-shrink-0 font-mono text-[0.62rem] font-bold ${
                  isCompleted ? 'bg-green-600 text-white' : isActive ? 'text-white' : 'text-slate-500'
                }`}
                style={
                  isActive
                    ? { background: '#0066FF' }
                    : !isCompleted
                    ? { background: 'var(--badge-inactive-bg)', border: '1.5px solid var(--badge-inactive-border)' }
                    : {}
                }
              >
                {isCompleted ? (
                  <motion.span
                    initial={{ scale: 0, rotate: -15 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 420, delay: i * 0.06 + 0.25 }}
                  >
                    <CheckIcon size={12} />
                  </motion.span>
                ) : isLocked ? (
                  <LockIcon size={10} />
                ) : (
                  step.id
                )}
              </div>

              {/* Step name */}
              <span
                className={`font-sans text-[0.78rem] flex-1 leading-[1.3] ${
                  isCompleted ? 'text-blue-400 font-medium' : isActive ? 'text-white font-semibold' : 'text-slate-500 font-medium'
                }`}
              >
                {step.name}
              </span>

              {/* Active pulse dot */}
              {isActive && (
                <motion.span
                  animate={{ opacity: [1, 0.35, 1], boxShadow: ['0 0 8px rgba(0,102,255,0.9)', '0 0 2px rgba(0,102,255,0.15)', '0 0 8px rgba(0,102,255,0.9)'] }}
                  transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                  className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                  style={{ background: '#0066FF' }}
                />
              )}
            </motion.div>
          )
        })}
      </nav>

      {/* Student context card */}
      <div
        className="mx-3.5 mb-6 p-4 rounded-xl"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
          borderLeft: '3px solid rgba(0,102,255,0.5)',
        }}
      >
        <div className="font-mono text-[0.56rem] tracking-[0.12em] uppercase text-blue-400 mb-2">
          Active Project
        </div>
        <div className="font-sans text-[0.74rem] font-semibold text-white mb-[3px] leading-[1.3]">
          {STUDENT.university || '—'}
        </div>
        <div className="font-sans text-[0.68rem] text-slate-500 mb-1.5">
          {STUDENT.department || '—'}
        </div>
        <div
          className="inline-block font-mono text-[0.58rem] text-slate-600 px-2 py-[2px] rounded-full"
          style={{ background: 'var(--badge-inactive-bg)' }}
        >
          {STUDENT.level || '—'}
        </div>
      </div>
    </aside>
  )
}
