import { useState } from 'react'
import { motion } from 'framer-motion'
import PaymentIssueModal from './PaymentIssueModal'

const TIER_LABELS = {
  student_pack:         'Student Plan',
  defense_pack:         'Defense Plan',
  defense_pack_upgrade: 'Defense Plan',
  express_defense:      'Express Defence',
  project_reset:        'Project Reset',
}

const TIER_PRICES = {
  student_pack:         '₦2,000',
  defense_pack:         '₦3,500',
  defense_pack_upgrade: '₦1,500',
  express_defense:      '₦2,000',
  project_reset:        '₦1,500',
}

const rowStagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.07, delayChildren: 0.2 } },
}

const rowVariant = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.35, ease: [0.22, 1, 0.36, 1] } },
}

export default function PaymentFailedBanner({ tier, reference, reason, onRetry, onDismiss }) {
  const [issueOpen, setIssueOpen] = useState(false)

  return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: '24px 16px', width: '100%' }}>
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.55, ease: [0.22, 1, 0.36, 1] }}
        style={{
          backgroundColor: 'var(--bg-card)',
          borderRadius: 16,
          border: '1px solid var(--border-color)',
          padding: '36px 32px 32px',
          maxWidth: 400,
          width: '100%',
          boxShadow: '0 8px 40px rgba(220,38,38,0.07)',
        }}
      >
        <motion.div
          style={{ display: 'flex', justifyContent: 'center' }}
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 0.15, type: 'spring', stiffness: 220, damping: 14 }}
        >
          <div style={{
            width: 72, height: 72, borderRadius: '50%',
            backgroundColor: 'var(--color-red-light)',
            border: '2px solid rgba(220,38,38,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="30" height="30" viewBox="0 0 30 30" fill="none">
              <motion.path
                d="M8 8 L22 22 M22 8 L8 22"
                stroke="var(--color-red)"
                strokeWidth="3"
                strokeLinecap="round"
                fill="none"
                initial={{ pathLength: 0, opacity: 0 }}
                animate={{ pathLength: 1, opacity: 1 }}
                transition={{ delay: 0.45, duration: 0.4, ease: 'easeOut' }}
              />
            </svg>
          </div>
        </motion.div>

        <motion.div variants={rowStagger} initial="hidden" animate="visible">
          <motion.h2
            variants={rowVariant}
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '1.5rem',
              color: 'var(--text-primary)',
              textAlign: 'center',
              marginTop: 20,
              marginBottom: 8,
              fontWeight: 400,
            }}
          >
            Payment Failed
          </motion.h2>

          <motion.p
            variants={rowVariant}
            style={{
              color: 'var(--text-secondary)',
              fontSize: '0.875rem',
              textAlign: 'center',
              lineHeight: 1.6,
              maxWidth: 280,
              marginLeft: 'auto',
              marginRight: 'auto',
              marginBottom: 24,
            }}
          >
            No charge was made — your card was not debited for this attempt.
          </motion.p>

          <motion.div
            variants={rowVariant}
            style={{
              backgroundColor: 'var(--bg-input)',
              borderRadius: 12,
              border: '1px solid var(--border-color)',
              padding: '18px 20px',
              marginBottom: 16,
            }}
          >
            {[
              { label: 'Plan',      value: TIER_LABELS[tier] || tier || 'Your Plan' },
              { label: 'Amount',    value: TIER_PRICES[tier] || '—' },
              { label: 'Reference', value: reference, mono: true },
            ].map((row) => (
              <div
                key={row.label}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  paddingBottom: 11, marginBottom: 11, borderBottom: '1px solid var(--border-color)',
                }}
              >
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{row.label}</span>
                <span style={{
                  color: 'var(--text-primary)',
                  fontSize: row.mono ? '0.72rem' : '0.875rem',
                  fontFamily: row.mono ? "'JetBrains Mono', monospace" : "'Poppins', sans-serif",
                }}>
                  {row.value}
                </span>
              </div>
            ))}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>Status</span>
              <span style={{
                backgroundColor: 'var(--color-red-light)',
                color: 'var(--color-red)',
                border: '1px solid rgba(220,38,38,0.3)',
                borderRadius: 999,
                padding: '3px 11px',
                fontSize: '0.68rem',
                fontWeight: 600,
                fontFamily: "'JetBrains Mono', monospace",
                letterSpacing: '0.04em',
              }}>
                Failed
              </span>
            </div>
          </motion.div>

          <motion.p
            variants={rowVariant}
            style={{
              color: 'var(--color-red)',
              fontSize: '0.78rem',
              textAlign: 'center',
              lineHeight: 1.5,
              marginBottom: 20,
            }}
          >
            {reason ? `Reason: ${reason}` : 'Your bank declined this transaction.'}
          </motion.p>

          <motion.button
            variants={rowVariant}
            onClick={onRetry}
            style={{
              display: 'block', width: '100%', padding: '15px 0',
              backgroundColor: 'var(--color-blue-primary)', color: '#fff',
              border: 'none', borderRadius: 12, fontFamily: "'Poppins', sans-serif",
              fontWeight: 600, fontSize: '0.9rem', cursor: 'pointer', marginBottom: 14,
            }}
          >
            Try Again
          </motion.button>

          <motion.div variants={rowVariant} style={{ display: 'flex', justifyContent: 'center', gap: 16 }}>
            <button
              onClick={() => setIssueOpen(true)}
              style={{
                background: 'none', border: 'none', color: 'var(--text-secondary)',
                fontSize: '0.8125rem', fontFamily: "'Poppins', sans-serif",
                cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px',
              }}
            >
              Report an issue
            </button>
            {onDismiss && (
              <button
                onClick={onDismiss}
                style={{
                  background: 'none', border: 'none', color: 'var(--text-secondary)',
                  fontSize: '0.8125rem', fontFamily: "'Poppins', sans-serif",
                  cursor: 'pointer', textDecoration: 'underline', textUnderlineOffset: '2px',
                }}
              >
                Dismiss
              </button>
            )}
          </motion.div>

          <motion.p
            variants={rowVariant}
            style={{
              color: 'var(--text-secondary)', fontSize: '0.72rem',
              textAlign: 'center', marginTop: 22, opacity: 0.7,
            }}
          >
            Need help? Contact us at hello@fypro.com.ng
          </motion.p>
        </motion.div>
      </motion.div>

      <PaymentIssueModal
        isOpen={issueOpen}
        onClose={() => setIssueOpen(false)}
        initialRef={reference}
      />
    </div>
  )
}
