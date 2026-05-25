import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useUser } from '../../hooks/useUser'
import { showToast } from '../../components/Toast'

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange, disabled = false, ariaLabel }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 border-0 p-0 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${checked && !disabled ? 'bg-blue-600' : 'bg-slate-700'}`}
    >
      <span
        className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  )
}

function ToggleRow({ title, desc, checked, onChange, disabled = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="font-sans text-sm font-medium" style={{ color: '#FFFFFF' }}>
          {title}
        </div>
        <div className="font-sans text-xs mt-0.5 leading-relaxed" style={{ color: 'rgba(255,255,255,0.4)' }}>
          {desc}
        </div>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={title} />
    </div>
  )
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header
      className="h-[68px] flex items-center justify-between px-4 sm:px-8 sticky top-0 z-30 flex-shrink-0"
      style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-subtle)' }}
    >
      <Link to="/dashboard" className="flex items-center gap-2.5 no-underline">
        <img src="/fypro-logo.png" alt="FYPro" className="h-9 w-auto" />
      </Link>
      <Link
        to="/settings"
        className="font-sans text-sm no-underline transition-opacity hover:opacity-80"
        style={{ color: 'rgba(255,255,255,0.4)' }}
      >
        ← Back to Settings
      </Link>
    </header>
  )
}

// ─── EmailPreferences ─────────────────────────────────────────────────────────

const DEFAULTS = {
  welcome_enabled:          true,
  defense_nudge_enabled:    true,
  urgency_reminder_enabled: true,
  unsubscribed_all:         false,
}

const cardStyle = {
  background:   '#0d1f35',
  borderRadius: '1rem',
  border:       '1px solid rgba(255,255,255,0.08)',
  boxShadow:    '0 4px 20px rgba(0,0,0,0.35)',
}

export default function EmailPreferences() {
  const { user } = useUser()
  const [prefs,   setPrefs]   = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [hasRow,  setHasRow]  = useState(false)

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }

    async function load() {
      const { data } = await supabase
        .from('email_preferences')
        .select('welcome_enabled, defense_nudge_enabled, urgency_reminder_enabled, unsubscribed_all')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        setPrefs({
          welcome_enabled:          data.welcome_enabled,
          defense_nudge_enabled:    data.defense_nudge_enabled,
          urgency_reminder_enabled: data.urgency_reminder_enabled,
          unsubscribed_all:         data.unsubscribed_all,
        })
        setHasRow(true)
      }
      setLoading(false)
    }
    load()
  }, [user?.id])

  async function persist(updated, previous) {
    if (!user?.id) return
    setSaving(true)

    const payload = { ...updated, updated_at: new Date().toISOString() }

    let error
    if (hasRow) {
      ;({ error } = await supabase
        .from('email_preferences')
        .update(payload)
        .eq('user_id', user.id))
    } else {
      ;({ error } = await supabase
        .from('email_preferences')
        .insert({ user_id: user.id, ...payload }))
      if (!error) setHasRow(true)
    }

    if (error) {
      showToast('Failed to save. Please try again.', 'error')
      setPrefs(previous)
    } else {
      showToast('Preferences saved')
    }
    setSaving(false)
  }

  function toggle(field) {
    const previous = prefs
    const updated = { ...prefs, [field]: !prefs[field] }
    setPrefs(updated)   // optimistic
    persist(updated, previous)
  }

  const isUnsubscribed = prefs.unsubscribed_all

  return (
    <div
      className="min-h-screen"
      style={{
        background:          '#060E18',
        backgroundImage:     'radial-gradient(circle, rgba(0,102,255,0.05) 1px, transparent 1px)',
        backgroundSize:      '28px 28px',
      }}
    >
      <Navbar />

      <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8 sm:py-12">

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="font-serif text-3xl leading-none" style={{ color: '#FFFFFF' }}>
            Email Preferences
          </h1>
          <p className="font-sans text-sm mt-1" style={{ color: 'rgba(255,255,255,0.6)' }}>
            Control which emails FYPro sends you.
          </p>
        </motion.div>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* Per-type toggles */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 p-5 sm:p-8"
              style={cardStyle}
            >
              <div
                className="font-mono text-xs font-semibold uppercase tracking-wider mb-6"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                Email Types
              </div>

              <div className="flex flex-col gap-5">
                <ToggleRow
                  title="Welcome email"
                  desc="Sent immediately after you verify your email — directs you to validate your topic"
                  checked={prefs.welcome_enabled && !isUnsubscribed}
                  onChange={() => toggle('welcome_enabled')}
                  disabled={isUnsubscribed}
                />
                <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                <ToggleRow
                  title="Defense Simulator nudge"
                  desc="Sent 3 days after signup — introduces the three-examiner Defense Simulator"
                  checked={prefs.defense_nudge_enabled && !isUnsubscribed}
                  onChange={() => toggle('defense_nudge_enabled')}
                  disabled={isUnsubscribed}
                />
                <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.08)' }} />
                <ToggleRow
                  title="Urgency reminder"
                  desc="Sent 7 days after signup — defense checklist and dashboard link"
                  checked={prefs.urgency_reminder_enabled && !isUnsubscribed}
                  onChange={() => toggle('urgency_reminder_enabled')}
                  disabled={isUnsubscribed}
                />
              </div>
            </motion.div>

            {/* Master unsubscribe */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 p-5 sm:p-8"
              style={{
                ...cardStyle,
                border: isUnsubscribed
                  ? '1px solid rgba(239,68,68,0.3)'
                  : '1px solid rgba(255,255,255,0.08)',
              }}
            >
              <div
                className="font-mono text-xs font-semibold uppercase tracking-wider mb-6"
                style={{ color: 'rgba(255,255,255,0.4)' }}
              >
                Global Opt-Out
              </div>
              <ToggleRow
                title="Unsubscribe from all FYPro emails"
                desc="Turns off every email type above. You can re-enable individual emails at any time."
                checked={prefs.unsubscribed_all}
                onChange={() => toggle('unsubscribed_all')}
              />
            </motion.div>

            {saving && (
              <div className="mt-4 flex items-center gap-2 justify-center">
                <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <span className="font-sans text-xs" style={{ color: 'rgba(255,255,255,0.4)' }}>
                  Saving…
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
