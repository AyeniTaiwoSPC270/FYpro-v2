import { useState, useEffect } from 'react'
import { hasFeedbackGiven, fetchFeedbackGiven, submitFeedback } from '../../lib/feedback'

const THUMB_UP = (
  <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
    <path d="M234,80.12A24,24,0,0,0,216,72H160V56a40,40,0,0,0-40-40,8,8,0,0,0-7.16,4.42L75.06,96H32a16,16,0,0,0-16,16v88a16,16,0,0,0,16,16H204a24,24,0,0,0,23.82-21l12-96A24,24,0,0,0,234,80.12ZM32,112H72v88H32Zm191.93,1.72-12,96A8,8,0,0,1,204,216H88V107.58l36.71-73.43A24,24,0,0,1,144,56V80a8,8,0,0,0,8,8h64a8,8,0,0,1,7.93,9.12Z"/>
  </svg>
)

const THUMB_DOWN = (
  <svg width="16" height="16" viewBox="0 0 256 256" fill="currentColor" aria-hidden="true">
    <path d="M239.82,157l-12-96A24,24,0,0,0,204,40H32A16,16,0,0,0,16,56v88a16,16,0,0,0,16,16H75.06l37.78,75.58A8,8,0,0,0,120,240a40,40,0,0,0,40-40V184h56a24,24,0,0,0,23.82-27ZM72,144H32V56H72Zm150,21.13A7.93,7.93,0,0,1,216,168H152a8,8,0,0,0-8,8v24a24,24,0,0,1-19.29,23.43L88,148.42V56H204a8,8,0,0,1,7.93,7l12,96A7.94,7.94,0,0,1,222,165.13Z"/>
  </svg>
)

export default function FeedbackThumbs({ feature, contextId }) {
  const [status, setStatus]   = useState('idle')   // 'idle' | 'confirmed' | 'error'
  const [errMsg, setErrMsg]   = useState('')

  useEffect(() => {
    // Instant localStorage check — no flash for same-session users
    if (hasFeedbackGiven(feature, contextId)) {
      setStatus('confirmed')
      return
    }
    // Supabase check — restores state after logout/login or on a new device
    fetchFeedbackGiven(feature, contextId)
      .then(given => { if (given) setStatus('confirmed') })
      .catch(() => {}) // non-fatal — stays idle on network error
  }, [feature, contextId])

  async function handleRate(rating) {
    if (status !== 'idle') return
    setStatus('confirmed')
    setErrMsg('')
    try {
      await submitFeedback(feature, rating, contextId)
    } catch {
      setStatus('idle')
      setErrMsg("Couldn't save — try again")
    }
  }

  if (status === 'confirmed') {
    return (
      <p style={{
        fontFamily:  "'Poppins', sans-serif",
        fontSize:    '0.75rem',
        color:       'var(--text-secondary)',
        margin:      '12px 0 0',
        userSelect:  'none',
      }}>
        Thanks for the feedback ✓
      </p>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '12px 0 0' }}>
      <span style={{
        fontFamily: "'Poppins', sans-serif",
        fontSize:   '0.75rem',
        color:      'var(--text-secondary)',
        marginRight: 2,
      }}>
        Was this helpful?
      </span>

      <button
        onClick={() => handleRate(1)}
        aria-label="This was helpful"
        title="This was helpful"
        style={btnStyle(false)}
        onMouseEnter={e => Object.assign(e.currentTarget.style, btnStyle(true))}
        onMouseLeave={e => Object.assign(e.currentTarget.style, btnStyle(false))}
      >
        {THUMB_UP}
      </button>

      <button
        onClick={() => handleRate(-1)}
        aria-label="This was not helpful"
        title="This was not helpful"
        style={btnStyle(false)}
        onMouseEnter={e => Object.assign(e.currentTarget.style, btnStyle(true))}
        onMouseLeave={e => Object.assign(e.currentTarget.style, btnStyle(false))}
      >
        {THUMB_DOWN}
      </button>

      {errMsg && (
        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize:   '0.7rem',
          color:      '#DC2626',
          marginLeft: 4,
        }}>
          {errMsg}
        </span>
      )}
    </div>
  )
}

function btnStyle(hovered) {
  return {
    display:         'inline-flex',
    alignItems:      'center',
    justifyContent:  'center',
    width:           '30px',
    height:          '30px',
    borderRadius:    '8px',
    border:          `1.5px solid ${hovered ? 'rgba(13,27,42,0.3)' : 'rgba(13,27,42,0.12)'}`,
    background:      hovered ? 'rgba(13,27,42,0.06)' : 'transparent',
    color:           hovered ? 'var(--text-primary)' : 'var(--text-muted)',
    cursor:          'pointer',
    transition:      'all 0.15s ease',
    padding:         0,
    flexShrink:      0,
  }
}
