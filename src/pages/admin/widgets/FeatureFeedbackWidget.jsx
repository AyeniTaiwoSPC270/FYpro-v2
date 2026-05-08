const BG     = '#060E18'
const CARD   = '#0F2235'
const BORDER = 'rgba(255,255,255,0.08)'
const WHITE  = '#FFFFFF'
const DIM    = 'rgba(255,255,255,0.7)'
const MUTED  = 'rgba(255,255,255,0.4)'
const BLUE   = '#0066FF'
const GREEN  = '#16A34A'
const RED    = '#DC2626'
const AMBER  = '#F59E0B'

const FEATURE_LABELS = {
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

function scoreColor(score) {
  if (score === null || score === undefined) return MUTED
  if (score > 0.3)  return GREEN
  if (score > -0.3) return AMBER
  return RED
}

function ScoreBar({ score }) {
  const pct   = score === null ? 0 : Math.round(((score + 1) / 2) * 100)
  const color = scoreColor(score)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div style={{
        flex: 1, height: 4,
        background: 'rgba(255,255,255,0.08)', borderRadius: 999,
      }}>
        <div style={{
          height: 4, background: color, borderRadius: 999,
          width: `${pct}%`, transition: 'width 0.4s ease',
        }} />
      </div>
      <span style={{
        fontFamily:  "'JetBrains Mono', monospace",
        fontSize:    11, fontWeight: 600,
        color:       color,
        width:       40,
        textAlign:   'right',
        flexShrink:  0,
      }}>
        {score !== null ? (score >= 0 ? '+' : '') + score.toFixed(2) : '—'}
      </span>
    </div>
  )
}

export default function FeatureFeedbackWidget({ data, loading, error }) {
  const td = {
    fontFamily: "'Poppins', sans-serif",
    fontSize: 13, color: DIM,
    padding: '10px 12px',
    borderTop: `1px solid ${BORDER}`,
  }
  const tdMono = {
    fontFamily: "'JetBrains Mono', monospace",
    fontSize: 12, color: WHITE,
    padding: '10px 12px',
    borderTop: `1px solid ${BORDER}`,
  }

  return (
    <div style={{ marginTop: 40, marginBottom: 40 }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12,
        marginBottom: 16, paddingBottom: 12,
        borderBottom: `1px solid ${BORDER}`,
      }}>
        <h2 style={{
          fontFamily: "'DM Serif Display', serif",
          fontSize: 22, fontWeight: 400,
          color: WHITE, margin: 0,
        }}>
          Feature Feedback
        </h2>
        {!loading && data && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600,
            background: 'rgba(255,255,255,0.07)',
            color: MUTED,
            border: `1px solid rgba(255,255,255,0.1)`,
            borderRadius: 999, padding: '2px 10px',
          }}>
            last 30 days
          </span>
        )}
      </div>

      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24 }}>
        {loading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{ height: 40, background: 'rgba(255,255,255,0.04)', borderRadius: 6 }} />
            ))}
          </div>
        ) : error ? (
          <div style={{
            background: 'rgba(220,38,38,0.1)',
            border: '1px solid rgba(220,38,38,0.25)',
            borderRadius: 10, padding: '12px 16px',
            fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#F87171',
          }}>
            Feature Feedback — {error}
          </div>
        ) : !data || data.length === 0 ? (
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED, margin: 0 }}>
            No feedback submitted yet.
          </p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 560 }}>
              <thead>
                <tr>
                  {['Feature', '👍', '👎', 'Score (30d)', 'Total'].map(h => (
                    <th key={h} style={{
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: 11, fontWeight: 600,
                      color: MUTED,
                      textTransform: 'uppercase', letterSpacing: '0.06em',
                      padding: '10px 12px', textAlign: 'left',
                      background: '#091420',
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row, i) => (
                  <tr key={row.feature} style={{ background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)' }}>
                    <td style={{ ...td, color: WHITE, fontWeight: 500 }}>
                      {FEATURE_LABELS[row.feature] || row.feature}
                    </td>
                    <td style={{ ...tdMono, color: GREEN }}>{row.up}</td>
                    <td style={{ ...tdMono, color: RED }}>{row.down}</td>
                    <td style={{ ...td, minWidth: 160 }}>
                      <ScoreBar score={row.score} />
                    </td>
                    <td style={tdMono}>{row.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
