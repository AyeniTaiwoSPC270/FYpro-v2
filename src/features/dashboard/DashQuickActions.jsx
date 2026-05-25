import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import { useReveal, revealStyle, LockIcon, ArrowRightIcon, PlayIcon, ZapIcon, DownloadIcon } from './_shared'

const QUICK_ACTIONS_BASE = [
  {
    label: 'Continue where you left off',
    sub: 'Active Step',
    pathKey: 'active',
    lockable: false,
    iconBg: 'rgba(22,163,74,0.15)',
    iconColor: '#16A34A',
    cardBg: 'var(--bg-input)',
    border: 'rgba(22,163,74,0.28)',
    hoverBorder: 'rgba(22,163,74,0.55)',
    hoverGlow: '0 8px 36px rgba(0,0,0,0.5), 0 0 28px rgba(22,163,74,0.22)',
    ctaLabel: 'Continue',
    ctaBg: '#16A34A',
    ctaColor: '#fff',
    ctaBorder: 'none',
    Icon: PlayIcon,
    breathe: true,
  },
  {
    label: 'Jump to Defense Simulator',
    sub: 'Preview the three-examiner panel',
    lockable: true,
    iconBg: 'rgba(0,102,255,0.15)',
    iconColor: '#0066FF',
    cardBg: 'var(--bg-input)',
    border: 'rgba(0,102,255,0.24)',
    hoverBorder: 'rgba(0,102,255,0.5)',
    hoverGlow: '0 8px 36px rgba(0,0,0,0.5), 0 0 28px rgba(0,102,255,0.22)',
    ctaLabel: 'Preview',
    ctaBg: 'transparent',
    ctaColor: '#60A5FA',
    ctaBorder: '1.5px solid rgba(0,102,255,0.38)',
    Icon: ZapIcon,
    breathe: false,
    onClickKey: 'defense',
  },
  {
    label: 'Download Progress Report',
    sub: 'Export your research summary as PDF',
    lockable: false,
    onClickKey: 'download',
    iconBg: 'rgba(245,158,11,0.15)',
    iconColor: '#F59E0B',
    cardBg: 'var(--bg-input)',
    border: 'rgba(245,158,11,0.24)',
    hoverBorder: 'rgba(245,158,11,0.5)',
    hoverGlow: '0 8px 36px rgba(0,0,0,0.5), 0 0 24px rgba(245,158,11,0.2)',
    ctaLabel: 'Export PDF',
    ctaBg: 'transparent',
    ctaColor: '#FCD34D',
    ctaBorder: '1.5px solid rgba(245,158,11,0.38)',
    Icon: DownloadIcon,
    breathe: false,
  },
]

export default function DashQuickActions({ STEPS, allComplete, showToastMessage, onDownloadReport }) {
  const navigate = useNavigate()
  const { navigateStep } = useApp()
  const activeStep = STEPS.find((s) => s.status === 'active') ?? STEPS[STEPS.length - 1]
  const QUICK_ACTIONS = QUICK_ACTIONS_BASE.map((a) =>
    a.pathKey === 'active'
      ? { ...a, path: '/app', sub: `Step ${activeStep?.id} — ${activeStep?.name}` }
      : a
  )

  const [sectionRef, sectionVisible] = useReveal()
  const [r0, v0] = useReveal()
  const [r1, v1] = useReveal()
  const [r2, v2] = useReveal()
  const cardReveals = [[r0, v0], [r1, v1], [r2, v2]]

  return (
    <section ref={sectionRef} style={revealStyle(sectionVisible)} aria-labelledby="quick-actions-heading">
      <h2 id="quick-actions-heading" className="font-serif text-[1.45rem] text-white mb-4 leading-[1.2]">
        Quick Actions
      </h2>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {QUICK_ACTIONS.map((action, i) => {
          const isLockedAction = action.lockable && !allComplete
          const [cardRef, cardVisible] = cardReveals[i] || [null, true]

          return (
            <div key={action.label} ref={cardRef} style={revealStyle(cardVisible)}>
              <motion.button
                whileHover={!isLockedAction ? { y: -4, boxShadow: action.hoverGlow, borderColor: action.hoverBorder } : {}}
                whileTap={!isLockedAction ? { scale: 0.97 } : {}}
                aria-label={action.label}
                aria-disabled={isLockedAction}
                onClick={
                  isLockedAction
                    ? () => showToastMessage('Complete all 6 steps to unlock this feature')
                    : action.onClickKey === 'download'
                    ? onDownloadReport
                    : action.onClickKey === 'defense'
                    ? () => { sessionStorage.setItem('intentional_app_entry', 'true'); navigateStep(5); navigate('/app') }
                    : action.path
                    ? () => { if (action.path === '/app') sessionStorage.setItem('intentional_app_entry', 'true'); navigate(action.path) }
                    : undefined
                }
                className={`relative flex flex-col items-start gap-3 md:gap-4 p-4 md:p-6 rounded-2xl text-left transition-all duration-200 w-full db-quick-card ${
                  isLockedAction ? 'cursor-not-allowed' : 'cursor-pointer'
                }`}
                style={{
                  background: action.cardBg,
                  border: '1px solid',
                  borderColor: isLockedAction ? 'var(--border-color)' : action.border,
                  opacity: isLockedAction ? 0.6 : 1,
                }}
              >
                {isLockedAction && (
                  <div className="absolute top-4 right-4 text-slate-600">
                    <LockIcon size={15} />
                  </div>
                )}

                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center db-quick-icon"
                  style={{ background: action.iconBg, color: action.iconColor }}
                >
                  <action.Icon />
                </div>

                <div className="flex-1">
                  <div className="font-sans text-[0.88rem] font-semibold text-white mb-[5px] leading-[1.3]">{action.label}</div>
                  <div className="font-sans text-[0.72rem] text-slate-500 leading-[1.45]">{action.sub}</div>
                </div>

                {action.breathe ? (
                  <motion.span
                    animate={!isLockedAction ? { scale: [1, 1.03, 1] } : {}}
                    transition={{ duration: 0.6, repeat: Infinity, repeatDelay: 2.4, ease: 'easeInOut' }}
                    className="inline-flex items-center gap-1.5 px-4 py-[7px] rounded-lg font-sans text-[0.76rem] font-semibold"
                    style={{ background: action.ctaBg, color: action.ctaColor, border: action.ctaBorder, opacity: isLockedAction ? 0.5 : 1, cursor: isLockedAction ? 'not-allowed' : 'default' }}
                  >
                    {action.ctaLabel} <ArrowRightIcon size={11} />
                  </motion.span>
                ) : (
                  <span
                    className="inline-flex items-center gap-1.5 px-4 py-[7px] rounded-lg font-sans text-[0.76rem] font-semibold"
                    style={{ background: action.ctaBg, color: action.ctaColor, border: action.ctaBorder, opacity: isLockedAction ? 0.5 : 1, cursor: isLockedAction ? 'not-allowed' : 'default' }}
                  >
                    {action.ctaLabel} <ArrowRightIcon size={11} />
                  </span>
                )}
              </motion.button>
            </div>
          )
        })}
      </div>
    </section>
  )
}
