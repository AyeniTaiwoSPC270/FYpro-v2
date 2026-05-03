import { useNavigate } from 'react-router-dom'
import { usePaidFeatures } from '../hooks/usePaidFeatures'

const FEATURE_META = {
  defense_pack: {
    label: 'Defense Pack',
    description:
      'Project Reviewer and Defence Simulator are part of the Defense Pack. ' +
      'Get your project graded by AI and walk into your viva prepared.',
    price: '₦3,500',
    tier: 'defense_pack',
  },
}

const LOCK_PATH =
  'M208,80H168V56a40,40,0,0,0-80,0V80H48A16,16,0,0,0,32,96V208a16,16,0,0,0,16,16H216a16,16,0,0,0,16-16V96A16,16,0,0,0,208,80ZM104,56a24,24,0,0,1,48,0V80H104Zm104,152H48V96H208V208Zm-80-48a8,8,0,1,1-8-8A8,8,0,0,1,136,160Z'

function UpgradeCard({ feature }) {
  const navigate = useNavigate()
  const meta = FEATURE_META[feature] ?? {
    label: feature,
    description: 'This feature requires a paid upgrade.',
    price: '₦3,500',
  }

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
      padding: '32px 16px',
    }}>
      <div style={{
        background: 'linear-gradient(145deg, #ffffff 0%, #f8fafc 100%)',
        borderRadius: '16px',
        border: '1px solid rgba(13, 27, 42, 0.1)',
        borderLeft: '4px solid #0066FF',
        boxShadow: '0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 4px rgba(0, 0, 0, 0.04)',
        padding: '40px',
        maxWidth: '480px',
        width: '100%',
        textAlign: 'center',
        animation: 'pfg-enter 0.4s ease forwards',
      }}>
        <div style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: 'rgba(0, 102, 255, 0.08)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          margin: '0 auto 20px',
        }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 256 256"
            fill="#0066FF"
            aria-hidden="true"
          >
            <path d={LOCK_PATH} />
          </svg>
        </div>

        <p style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: '1.5rem',
          color: '#0D1B2A',
          marginBottom: '12px',
          lineHeight: 1.3,
        }}>
          {meta.label} Required
        </p>

        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.875rem',
          color: 'rgba(13, 27, 42, 0.6)',
          lineHeight: 1.6,
          marginBottom: '24px',
        }}>
          {meta.description}
        </p>

        <div style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          background: 'rgba(0, 102, 255, 0.06)',
          border: '1px solid rgba(0, 102, 255, 0.2)',
          borderRadius: '999px',
          padding: '6px 16px',
          marginBottom: '24px',
        }}>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.75rem',
            color: 'rgba(13, 27, 42, 0.5)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
          }}>
            One-time
          </span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '1rem',
            fontWeight: 600,
            color: '#0D1B2A',
          }}>
            {meta.price}
          </span>
        </div>

        <button
          onClick={() => navigate('/pricing')}
          style={{
            display: 'block',
            width: '100%',
            padding: '14px 24px',
            background: '#16A34A',
            color: '#ffffff',
            border: 'none',
            borderRadius: '12px',
            fontFamily: "'Poppins', sans-serif",
            fontWeight: 600,
            fontSize: '0.9375rem',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
          onMouseOver={e => {
            e.currentTarget.style.background = '#15803d'
            e.currentTarget.style.boxShadow = '0 0 20px rgba(22, 163, 74, 0.35)'
          }}
          onMouseOut={e => {
            e.currentTarget.style.background = '#16A34A'
            e.currentTarget.style.boxShadow = 'none'
          }}
        >
          Unlock Now
        </button>
      </div>

      <style>{`
        @keyframes pfg-enter {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function Spinner() {
  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '60vh',
    }}>
      <div style={{
        width: 32,
        height: 32,
        border: '3px solid rgba(0, 102, 255, 0.2)',
        borderTopColor: '#0066FF',
        borderRadius: '50%',
        animation: 'pfg-spin 0.7s linear infinite',
      }} />
      <style>{`@keyframes pfg-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}

export default function PaidFeatureGate({ feature, children, fallback }) {
  const { hasPaidFeature, loading } = usePaidFeatures()

  if (loading) return <Spinner />

  if (!hasPaidFeature(feature)) {
    return fallback ?? <UpgradeCard feature={feature} />
  }

  return children
}
