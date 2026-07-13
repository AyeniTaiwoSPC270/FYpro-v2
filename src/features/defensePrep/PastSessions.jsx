import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useTheme } from '../../context/ThemeContext'

function sessionScoreLabel(score) {
  if (score >= 9) return 'distinction'
  if (score >= 7) return 'merit'
  if (score >= 5) return 'pass'
  return 'fail'
}

function turnScoreLabel(score) {
  if (score >= 7) return 'distinction'
  if (score >= 5) return 'merit'
  if (score >= 3) return 'pass'
  return 'fail'
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric',
  })
}

export default function PastSessions({ projectId }) {
  const { theme } = useTheme()
  const skeletonClass = `skeleton-loader${theme === 'dark' ? ' skeleton-loader--dark' : ''}`

  const [sessions, setSessions]           = useState([])
  const [loading, setLoading]             = useState(true)
  const [error, setError]                 = useState(null)
  const [expandedId, setExpandedId]       = useState(null)
  const [turnsCache, setTurnsCache]       = useState({})
  const [turnsLoadingId, setTurnsLoadingId] = useState(null)

  useEffect(() => { fetchSessions() }, [projectId])

  async function fetchSessions() {
    setLoading(true)
    setError(null)
    try {
      const { data, error: err } = await supabase
        .from('defense_sessions')
        .select('id, completed_at, total_score, turns_count, defense_certificates(certificate_number)')
        .eq('project_id', projectId)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false })
      if (err) throw err
      setSessions(data || [])
    } catch {
      setError('Failed to load session history.')
    } finally {
      setLoading(false)
    }
  }

  async function handleExpand(sessionId) {
    if (expandedId === sessionId) { setExpandedId(null); return }
    setExpandedId(sessionId)
    if (turnsCache[sessionId]) return
    setTurnsLoadingId(sessionId)
    try {
      const { data, error: err } = await supabase
        .from('defense_turns')
        .select('turn_number, examiner_question, student_answer, scores')
        .eq('session_id', sessionId)
        .order('turn_number', { ascending: true })
      if (err) throw err
      setTurnsCache(prev => ({ ...prev, [sessionId]: data || [] }))
    } catch {
      setTurnsCache(prev => ({ ...prev, [sessionId]: [] }))
    } finally {
      setTurnsLoadingId(null)
    }
  }

  if (loading) {
    return (
      <div className="dp-history-list">
        <div className={skeletonClass}>
          <div className="skeleton-bar" style={{ width: '100%' }} />
          <div className="skeleton-bar" style={{ width: '80%' }} />
          <div className="skeleton-bar" style={{ width: '90%' }} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="dp-history-list">
        <p className="dp-history-empty">{error}</p>
        <button
          className="dp-btn-go-back"
          onClick={fetchSessions}
          style={{ marginTop: 12, alignSelf: 'center' }}
        >
          Try Again
        </button>
      </div>
    )
  }

  if (sessions.length === 0) {
    return (
      <p className="dp-history-empty">
        No completed sessions yet. Start a simulation to see your history here.
      </p>
    )
  }

  return (
    <div className="dp-history-list">
      {sessions.map(session => {
        const label      = sessionScoreLabel(session.total_score ?? 0)
        const certNumber = session.defense_certificates?.[0]?.certificate_number
        const isExpanded = expandedId === session.id
        const turns      = turnsCache[session.id] || []
        const isTurnsLoading = turnsLoadingId === session.id

        return (
          <div
            key={session.id}
            className={`dp-history-item${isExpanded ? ' dp-history-item--expanded' : ''}`}
          >
            <button
              className="dp-history-item__header"
              onClick={() => handleExpand(session.id)}
              aria-expanded={isExpanded}
            >
              <div className="dp-history-item__meta">
                <span className="dp-history-item__date">{formatDate(session.completed_at)}</span>
                <span className="dp-history-item__count">
                  {session.turns_count || 0} question{session.turns_count !== 1 ? 's' : ''}
                </span>
                {certNumber && (
                  <span className="dp-history-cert-chip">🎓 {certNumber}</span>
                )}
              </div>
              <div className="dp-history-item__right">
                <span className="dp-history-item__score">{session.total_score ?? '?'}/10</span>
                <span className={`dp-summary-score-badge dp-summary-score--${label}`}>
                  {label.toUpperCase()}
                </span>
                <svg
                  className={`dp-history-chevron${isExpanded ? ' dp-history-chevron--open' : ''}`}
                  width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="currentColor" strokeWidth="2"
                  strokeLinecap="round" strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <polyline points="6 9 12 15 18 9" />
                </svg>
              </div>
            </button>

            {isExpanded && (
              <div className="dp-history-item__transcript">
                {isTurnsLoading ? (
                  <div className={skeletonClass} style={{ margin: '4px 0' }}>
                    <div className="skeleton-bar" style={{ width: '100%' }} />
                    <div className="skeleton-bar" style={{ width: '75%' }} />
                  </div>
                ) : turns.length === 0 ? (
                  <p style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: '0.8rem',
                    color: theme === 'dark' ? 'rgba(255,255,255,0.35)' : 'var(--color-text-muted)',
                    margin: 0,
                  }}>
                    Transcript not available for this session.
                  </p>
                ) : turns.map(turn => (
                  <div key={turn.turn_number} className="dp-history-turn">
                    <div className="dp-history-turn__question">
                      <span className="dp-history-turn__label">Q{turn.turn_number}</span>
                      <p className="dp-history-turn__text">{turn.examiner_question}</p>
                    </div>
                    <div className="dp-history-turn__answer">
                      <span className="dp-history-turn__label">Your Answer</span>
                      <p className="dp-history-turn__text">{turn.student_answer}</p>
                      {(turn.scores || []).length > 0 && (
                        <div className="dp-history-turn__scores">
                          {turn.scores.map((s, i) => {
                            const chipLabel = s.score_label
                              ? s.score_label.toLowerCase()
                              : turnScoreLabel(s.score ?? 0)
                            const abbr = (s.examiner || '').replace(/^The\s+/i, '').toUpperCase()
                            return (
                              <span
                                key={i}
                                className={`dp-score-badge dp-score-badge--${chipLabel} dp-score--visible`}
                              >
                                {abbr} · {chipLabel.toUpperCase()} · {s.score ?? '?'}/10
                              </span>
                            )
                          })}
                        </div>
                      )}
                      {/* Sessions defended before score_reasoning was persisted have no
                          reasoning to show — the badges stand alone for those. */}
                      {(turn.scores || []).some(s => s.score_reasoning) && (
                        <div className="dp-history-turn__reasonings">
                          {turn.scores.map((s, i) => (
                            s.score_reasoning ? (
                              <p key={i} className="dp-history-turn__reasoning">
                                <span className="dp-history-turn__reasoning-examiner">
                                  {(s.examiner || '').replace(/^The\s+/i, '')}
                                </span>
                                {s.score_reasoning}
                              </p>
                            ) : null
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
