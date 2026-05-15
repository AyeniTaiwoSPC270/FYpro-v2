import { motion } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'
import { resolveLimit } from '../../hooks/useRunLimit'
import { useReveal, revealStyle } from './_shared'

const USAGE_FEATURE_LABELS = {
  topic_validator:     'Topic Validator',
  chapter_architect:   'Chapter Architect',
  methodology_advisor: 'Methodology Advisor',
  writing_planner:     'Writing Planner',
  literature_map:      'Literature Map',
  abstract_generator:  'Abstract Generator',
  instrument_builder:  'Instrument Builder',
  project_reviewer:    'Project Reviewer',
  defense_simulator:   'Defense Simulator',
}

const PLAN_FEATURES = {
  free:    ['topic_validator', 'chapter_architect', 'methodology_advisor'],
  student: ['topic_validator', 'chapter_architect', 'methodology_advisor', 'writing_planner', 'literature_map', 'abstract_generator', 'instrument_builder', 'project_reviewer'],
  defense: ['topic_validator', 'chapter_architect', 'methodology_advisor', 'writing_planner', 'literature_map', 'abstract_generator', 'instrument_builder', 'project_reviewer', 'defense_simulator'],
}

function usageBarColor(pct) {
  if (pct < 0.6) return '#16A34A'
  if (pct < 0.8) return '#F59E0B'
  return '#DC2626'
}

function UsageBar({ used, limit, visible = true, barIndex = 0 }) {
  const pct = limit !== null ? Math.min(1, used / Math.max(1, limit)) : null

  if (limit === null) {
    return (
      <div className="flex items-center gap-2 mt-[6px]">
        <div className="flex-1 h-[4px] rounded-full" style={{ background: 'var(--border-color)' }} />
        <span className="font-mono text-[0.58rem] text-green-400 tracking-[0.06em] uppercase flex-shrink-0" style={{ minWidth: 56, textAlign: 'right' }}>
          Unlimited
        </span>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2 mt-[6px]">
      <div className="flex-1 h-[4px] rounded-full overflow-hidden" style={{ background: 'var(--border-color)' }}>
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: visible ? `${pct * 100}%` : 0 }}
          transition={{ duration: 0.7, delay: barIndex * 0.05, ease: [0.22, 1, 0.36, 1] }}
          className={`h-full rounded-full${pct >= 0.8 ? ' db-bar-red-glow' : ''}`}
          style={{ background: usageBarColor(pct) }}
        />
      </div>
      <span className="font-mono text-[0.6rem] flex-shrink-0" style={{ color: usageBarColor(pct), minWidth: 48, textAlign: 'right' }}>
        {used} / {limit}
      </span>
    </div>
  )
}

export default function DashUsageSection({ features, runCounts, loading, onPaymentIssue }) {
  const [sectionRef, sectionVisible] = useReveal()
  const { theme: usageTheme } = useTheme()
  const isLightUsage = usageTheme === 'light'

  const isDefense = features.includes('defense_pack')
  const isStudent = !isDefense && features.includes('student_pack')
  const planKey   = isDefense ? 'defense' : isStudent ? 'student' : 'free'

  const planLabel = isDefense ? 'Defense Plan' : isStudent ? 'Student Plan' : 'Free Plan'
  const planBadgeBg = isDefense ? 'rgba(0,102,255,0.18)' : isStudent ? 'rgba(59,130,246,0.14)' : 'rgba(100,116,139,0.18)'
  const planBadgeColor = isDefense ? '#60A5FA' : isStudent ? '#93C5FD' : '#94A3B8'

  const featureKeys = PLAN_FEATURES[planKey]

  return (
    <section
      ref={sectionRef}
      aria-labelledby="usage-heading"
      className="rounded-2xl border border-slate-800/80 p-8 mb-7"
      style={{
        ...revealStyle(sectionVisible),
        background: 'linear-gradient(145deg, var(--bg-card) 0%, var(--bg-input) 100%)',
        boxShadow: '0 8px 40px rgba(59,130,246,0.06)',
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 id="usage-heading" className="font-serif text-[1.45rem] text-white leading-[1.2] mb-1">
            Your Usage
          </h2>
          <div className="font-sans text-[0.73rem] text-slate-500">Limits reset when you start a new project.</div>
        </div>
        <span
          className="font-mono text-[0.62rem] font-semibold tracking-[0.1em] uppercase px-3 py-[5px] rounded-full flex-shrink-0"
          style={{ background: planBadgeBg, color: planBadgeColor }}
        >
          {planLabel}
        </span>
      </div>

      <div className="flex flex-col gap-5">
        {featureKeys.map((key, barIndex) => {
          const used  = runCounts[key] ?? 0
          const limit = resolveLimit(key, features)
          return (
            <div key={key}>
              <div className="flex items-center justify-between">
                <span className="font-sans text-[0.82rem] font-medium text-white">{USAGE_FEATURE_LABELS[key]}</span>
                {limit !== null && (
                  <span className="font-mono text-[0.6rem] text-slate-500">{Math.max(0, limit - used)} remaining</span>
                )}
              </div>
              <UsageBar used={used} limit={limit} visible={sectionVisible} barIndex={barIndex} />
            </div>
          )
        })}
      </div>

      {planKey === 'free' && (
        <div
          className="mt-6 flex items-center gap-3 rounded-xl px-4 py-3"
          style={{ background: 'rgba(0,102,255,0.07)', border: '1px solid rgba(0,102,255,0.18)' }}
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#60A5FA" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
          </svg>
          <p className="font-sans text-[0.76rem] text-blue-400 flex-1">
            Upgrade to Student Plan to unlock Writing Planner and Project Reviewer.
          </p>
          <a href="/pricing" className="font-sans text-[0.74rem] font-semibold text-blue-400 hover:text-blue-300 no-underline flex-shrink-0 transition-colors duration-150">
            Upgrade →
          </a>
        </div>
      )}

      <button
        onClick={onPaymentIssue}
        style={{
          background: 'none', border: 'none', cursor: 'pointer',
          color: isLightUsage ? 'rgba(13,27,42,0.45)' : 'rgba(255,255,255,0.4)', fontSize: '0.72rem',
          fontFamily: "'Poppins', sans-serif", marginTop: 12,
          padding: 0, textDecoration: 'underline', display: 'block',
        }}
      >
        Paid but access not unlocked? Click here
      </button>
    </section>
  )
}
