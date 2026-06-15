import { useState, useEffect, useCallback, useRef } from 'react'
import FyproLogo from '../../components/FyproLogo'

const TOTAL = 4
// Glow X-position as % of viewport width: slides 0,2 phone right (72%), slides 1,3 phone left (28%)
const GLOW_X_PCT = [72, 28, 72, 28]

export default function TourCarousel({ onClose }) {
  const [current, setCurrent] = useState(0)
  const [ready, setReady] = useState(false)
  const [exiting, setExiting] = useState(false)

  // Delay first-slide activation so the CSS transition actually fires on mount
  useEffect(() => {
    const t = setTimeout(() => setReady(true), 120)
    return () => clearTimeout(t)
  }, [])

  function handleClose() {
    if (exiting) return
    setExiting(true)
    setTimeout(onClose, 420)
  }

  const goTo = useCallback((idx) => {
    if (idx < 0 || idx >= TOTAL) return
    setCurrent(idx)
  }, [])

  const next = useCallback(() => {
    if (current < TOTAL - 1) goTo(current + 1)
    else handleClose()
  }, [current, goTo, exiting]) // eslint-disable-line

  // Keyboard navigation
  useEffect(() => {
    function onKey(e) {
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); next() }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goTo(current - 1) }
      if (e.key === 'Escape') handleClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [current, next, goTo, exiting]) // eslint-disable-line

  // Touch swipe
  const touchX = useRef(0)
  function onTouchStart(e) { touchX.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    const dx = touchX.current - e.changedTouches[0].clientX
    if (Math.abs(dx) > 44) dx > 0 ? next() : goTo(current - 1)
  }

  return (
    <div className={`oq-tour-overlay${exiting ? ' oq-tour-overlay--exiting' : ''}`}>
      <div className="oq-tour-stage">
        <div
          className="oq-tour-canvas"
          onTouchStart={onTouchStart}
          onTouchEnd={onTouchEnd}
        >
          <div className="oq-tour-bg" />

          {/* Blue glow follows phone position */}
          <div
            className="oq-tour-glow"
            style={{ left: `${GLOW_X_PCT[current]}%`, top: '50%' }}
          />

          {/* Header */}
          <div className="oq-tour-header">
            <FyproLogo className="oq-tour-logo" />
            <button className="oq-tour-skip" onClick={handleClose}>Skip tour</button>
          </div>

          {/* Slide 1 — Topic Validator — phone RIGHT */}
          <section className={`oq-tour-slide oq-tour-slide--phone-right${ready && current === 0 ? ' oq-tour-slide--active' : ''}`}>
            <div className="oq-tour-text">
              <div className="oq-tour-eyebrow">STEP 1 · TOPIC VALIDATOR</div>
              <h2 className="oq-tour-headline">Validate your topic before you commit</h2>
              <div className="oq-tour-steps">
                {[
                  'Paste your rough project idea',
                  'Get a researchability verdict + score, checked against real papers',
                  'See the gaps you can turn into originality',
                ].map((s, i) => (
                  <div className="oq-tour-step" key={i}>
                    <div className="oq-tour-chip">{i + 1}</div>
                    <div className="oq-tour-step-text">{s}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="oq-tour-phone-col">
              <Phone>
                <div style={{ padding: '42px 8px 5px', background: '#0D1B2A', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 2, marginBottom: 3 }}>
                    {['#0066FF','#F59E0B','#16A34A','#0891B2','#8B5CF6','#DC2626'].map((c, i) => (
                      <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                        <div style={{ width: 13, height: 13, borderRadius: '50%', background: c, opacity: i === 0 ? 1 : 0.5 + (i * 0.1), display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 6, color: '#fff', fontWeight: 700 }}>{i === 0 ? '✓' : ''}</div>
                        {i < 5 && <div style={{ width: 10, height: 1, background: 'rgba(255,255,255,0.1)' }} />}
                      </span>
                    ))}
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'center', gap: 7, marginTop: 3 }}>
                    {['Topic','Chapter','Method','Writing','Defence'].map((l, i) => (
                      <span key={l} style={{ font: `${i === 0 ? 600 : 400} 5.5px/1 Poppins,sans-serif`, color: i === 0 ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.3)' }}>{l}</span>
                    ))}
                  </div>
                </div>
                <div style={{ padding: '9px 9px 0', overflow: 'hidden', height: 'calc(100% - 76px)' }}>
                  <div style={{ font: "700 12px/1.2 'DM Serif Display',serif", color: '#fff', marginBottom: 7 }}>Step 1: Topic Validator</div>
                  <div style={{ background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 5, padding: '6px 7px', marginBottom: 6 }}>
                    <div style={{ font: "600 7px/1 'JetBrains Mono',monospace", color: '#F59E0B', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>NEEDS REFINEMENT</div>
                    <div style={{ font: '400 6.5px/1.5 Poppins,sans-serif', color: 'rgba(255,255,255,0.6)' }}>Topic is technically sound but over-scoped for a 5,000-word undergraduate project.</div>
                  </div>
                  <div style={{ font: "500 6px/1 'JetBrains Mono',monospace", color: '#0066FF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>RELATED RESEARCH FOUND</div>
                  {[
                    ['Design and FEA Analysis of Boiler Chimney against Fouling', 'Priyanka Thigale · 2019'],
                    ['Monitoring kraft recovery boiler fouling using PCA', 'Peter Verstee · 2009'],
                    ['Heat recovery boiler', '· 1992'],
                  ].map(([t, a]) => (
                    <div key={t} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 4, padding: '5px 6px', marginBottom: 3 }}>
                      <div style={{ font: '500 7px/1.3 Poppins,sans-serif', color: '#fff' }}>{t}</div>
                      <div style={{ font: '400 5.5px/1 Poppins,sans-serif', color: 'rgba(255,255,255,0.38)', marginTop: 2 }}>{a}</div>
                    </div>
                  ))}
                  <div style={{ font: "500 6px/1 'JetBrains Mono',monospace", color: '#0066FF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4, marginTop: 6 }}>REFINED TOPIC</div>
                  <div style={{ font: '600 7.5px/1.45 Poppins,sans-serif', color: '#fff', marginBottom: 6 }}>FEA-Based Thermal Stress Analysis of a Boiler Chimney Under Fouling-Induced Gradients Using ANSYS Mechanical</div>
                  <div style={{ background: '#16A34A', borderRadius: 5, padding: 7, textAlign: 'center' }}>
                    <span style={{ font: '600 8px/1 Poppins,sans-serif', color: '#fff' }}>Use This Topic</span>
                  </div>
                </div>
              </Phone>
            </div>
          </section>

          {/* Slide 2 — Chapter Architect — phone LEFT */}
          <section className={`oq-tour-slide oq-tour-slide--phone-left${ready && current === 1 ? ' oq-tour-slide--active' : ''}`}>
            <div className="oq-tour-phone-col">
              <Phone>
                <div style={{ padding: '42px 9px 6px', background: '#0D1B2A', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ font: '400 6.5px/1 Poppins,sans-serif', color: 'rgba(255,255,255,0.45)' }}>← Back to Topic Validator</div>
                </div>
                <div style={{ padding: '9px', overflow: 'hidden', height: 'calc(100% - 60px)' }}>
                  <div style={{ font: "700 12px/1.2 'DM Serif Display',serif", color: '#fff', marginBottom: 6 }}>Step 2: Chapter Architect</div>
                  <div style={{ display: 'flex', gap: 3, marginBottom: 7 }}>
                    <div style={{ flex: 1, background: '#0066FF', borderRadius: 4, padding: '5px 4px', textAlign: 'center' }}><span style={{ font: '600 7px/1 Poppins,sans-serif', color: '#fff' }}>Standard 5-Chapter</span></div>
                    <div style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: 4, padding: '5px 4px', textAlign: 'center' }}><span style={{ font: '500 7px/1 Poppins,sans-serif', color: 'rgba(255,255,255,0.45)' }}>Custom</span></div>
                  </div>
                  {[
                    ['Introduction to Thermal Stress Analysis of Boiler Chimney Heat Recovery Units', '01'],
                    ['Literature Review on Fouling Mechanisms, Heat Recovery Thermal Behaviour and FEA', '02'],
                    ['Methodology: Geometric Modelling, Boundary Conditions, and ANSYS FEA Setup', '03'],
                    ['Results: Temperature Distribution, Thermal Stress Contours, Fouling Severity', '04'],
                    ['Conclusion and Recommendations for Fouling Management and Structural Design', '05'],
                  ].map(([t, n]) => (
                    <div key={n} style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 5, padding: '6px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, marginBottom: 3 }}>
                      <div style={{ font: '500 7px/1.35 Poppins,sans-serif', color: '#fff', flex: 1 }}>{t}</div>
                      <div style={{ font: "700 11px/1 'JetBrains Mono',monospace", color: 'rgba(0,102,255,0.5)', flexShrink: 0 }}>{n}</div>
                    </div>
                  ))}
                  <div style={{ background: '#16A34A', borderRadius: 5, padding: 7, textAlign: 'center', marginTop: 4 }}>
                    <span style={{ font: '600 7.5px/1 Poppins,sans-serif', color: '#fff' }}>I am satisfied with this structure — Continue</span>
                  </div>
                </div>
              </Phone>
            </div>
            <div className="oq-tour-text">
              <div className="oq-tour-eyebrow">STEPS 2–3 · STRUCTURE &amp; METHOD</div>
              <h2 className="oq-tour-headline">Build your chapters and methodology</h2>
              <div className="oq-tour-steps">
                {[
                  'Generate a full chapter-by-chapter structure for your project',
                  'Get a literature map of real papers, clustered by theme',
                  'Pick the right methodology with guidance, not guesswork',
                ].map((s, i) => (
                  <div className="oq-tour-step" key={i}>
                    <div className="oq-tour-chip">{i + 1}</div>
                    <div className="oq-tour-step-text">{s}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Slide 3 — Writing Planner — phone RIGHT */}
          <section className={`oq-tour-slide oq-tour-slide--phone-right${ready && current === 2 ? ' oq-tour-slide--active' : ''}`}>
            <div className="oq-tour-text">
              <div className="oq-tour-eyebrow">STEP 5 · WRITING PLANNER</div>
              <h2 className="oq-tour-headline">A week-by-week plan to actually finish</h2>
              <div className="oq-tour-steps">
                {[
                  'Tell FYPro your defence / submission date',
                  'Get a realistic week-by-week writing schedule with buffer weeks',
                  'Track each chapter so you never fall behind',
                ].map((s, i) => (
                  <div className="oq-tour-step" key={i}>
                    <div className="oq-tour-chip">{i + 1}</div>
                    <div className="oq-tour-step-text">{s}</div>
                  </div>
                ))}
              </div>
            </div>
            <div className="oq-tour-phone-col">
              <Phone>
                <div style={{ padding: '42px 9px 6px', background: '#0D1B2A', borderBottom: '1px solid rgba(255,255,255,0.07)' }}>
                  <div style={{ font: '400 6.5px/1 Poppins,sans-serif', color: 'rgba(255,255,255,0.45)' }}>← Back to Methodology Advisor</div>
                </div>
                <div style={{ padding: '9px', overflow: 'hidden', height: 'calc(100% - 60px)' }}>
                  <div style={{ font: "700 12px/1.2 'DM Serif Display',serif", color: '#fff', marginBottom: 2 }}>Step 4: Writing Planner</div>
                  <div style={{ font: '400 6.5px/1.4 Poppins,sans-serif', color: 'rgba(255,255,255,0.45)', marginBottom: 7 }}>Week-by-week schedule, weighted by chapter complexity.</div>
                  <div style={{ background: '#0066FF', borderRadius: 5, padding: '6px 8px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', marginBottom: 7 }}>
                    {[['6','Total Weeks'],['3000','Words/Wk Avg'],['18000','Total Words']].map(([v, l]) => (
                      <span key={l} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                        <span style={{ font: "700 13px/1 'JetBrains Mono',monospace", color: '#fff' }}>{v}</span>
                        <span style={{ font: '400 5.5px/1 Poppins,sans-serif', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{l}</span>
                      </span>
                    ))}
                  </div>
                  {[
                    { wk: 'WEEK 1', dates: 'May 11 – May 17', text: 'Writing Chapter 1: Introduction — boiler chimney background, fouling problem, ANSYS scope.', words: '2500 words', active: true },
                    { wk: 'WEEK 2', dates: 'May 18 – May 24', text: 'Writing Chapter 2: Literature Review — fouling mechanisms, heat recovery thermal behaviour.', words: '4000 words', active: false },
                    { wk: 'WEEK 3', dates: 'May 25 – May 31', text: 'Writing Chapter 3: Methodology — ANSYS FEA geometry, boundary conditions, mesh setup.', words: '4500 words', active: false, holiday: true },
                  ].map(({ wk, dates, text, words, active, holiday }) => (
                    <div key={wk} style={{ background: active ? 'rgba(0,102,255,0.1)' : 'rgba(255,255,255,0.03)', border: `1px solid ${active ? 'rgba(0,102,255,0.28)' : 'rgba(255,255,255,0.07)'}`, borderRadius: 5, padding: '6px 8px', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginBottom: 3 }}>
                        <div style={{ width: 6, height: 6, borderRadius: '50%', background: active ? '#0066FF' : 'rgba(255,255,255,0.18)', flexShrink: 0 }} />
                        <span style={{ font: "500 6px/1 'JetBrains Mono',monospace", color: 'rgba(255,255,255,0.4)' }}>{wk}</span>
                        <span style={{ font: '600 6.5px/1 Poppins,sans-serif', color: '#fff', marginLeft: 2 }}>{dates}</span>
                        {active && <div style={{ background: '#0066FF', borderRadius: 2, padding: '1px 4px', marginLeft: 'auto', flexShrink: 0 }}><span style={{ font: '700 5px/1 Poppins,sans-serif', color: '#fff' }}>YOU ARE HERE</span></div>}
                      </div>
                      <div style={{ font: '400 7px/1.45 Poppins,sans-serif', color: 'rgba(255,255,255,0.65)' }}>{text}</div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 3 }}>
                        {holiday && <div style={{ background: 'rgba(245,158,11,0.18)', border: '1px solid rgba(245,158,11,0.35)', borderRadius: 3, padding: '1px 5px' }}><span style={{ font: '600 5.5px/1 Poppins,sans-serif', color: '#F59E0B' }}>HOLIDAY WEEK</span></div>}
                        <span style={{ font: '500 6px/1 Poppins,sans-serif', color: 'rgba(255,255,255,0.28)' }}>{words}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </Phone>
            </div>
          </section>

          {/* Slide 4 — Defence Simulator — phone LEFT */}
          <section className={`oq-tour-slide oq-tour-slide--phone-left${ready && current === 3 ? ' oq-tour-slide--active' : ''}`}>
            <div className="oq-tour-phone-col">
              <Phone bg="#030812">
                <div style={{ padding: '42px 10px 8px', background: '#060E18', borderBottom: '1px solid rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ width: 16, height: 16, background: '#0066FF', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><span style={{ font: '700 9px/1 sans-serif', color: '#fff' }}>★</span></div>
                  <div style={{ font: "500 6.5px/1 'JetBrains Mono',monospace", color: 'rgba(255,255,255,0.5)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>DEFENCE EXAMINATION PANEL</div>
                  <div style={{ font: '500 6.5px/1 Poppins,sans-serif', color: '#DC2626' }}>End Session</div>
                </div>
                <div style={{ padding: '8px 10px', overflow: 'hidden', height: 'calc(100% - 70px)' }}>
                  <div style={{ textAlign: 'center', marginBottom: 6 }}>
                    <div style={{ font: "500 6.5px/1 'JetBrains Mono',monospace", color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 4 }}>QUESTION 1 OF 5</div>
                    <div style={{ display: 'flex', justifyContent: 'center', gap: 3 }}>
                      {[true,false,false,false,false].map((on, i) => (
                        <div key={i} style={{ width: 14, height: 3, borderRadius: 2, background: on ? '#0066FF' : 'rgba(255,255,255,0.14)' }} />
                      ))}
                    </div>
                  </div>
                  <div style={{ background: 'rgba(0,102,255,0.07)', border: '1px solid rgba(0,102,255,0.18)', borderRadius: 5, padding: '7px 8px', marginBottom: 7, font: '400 6.5px/1.55 Poppins,sans-serif', color: 'rgba(255,255,255,0.55)', fontStyle: 'italic', textAlign: 'center' }}>
                    The defence panel at UNILAG consists of three examiners: Dr. Adaeze Okonkwo (The Methodologist), Prof. Babatunde Fashola (The Subject Expert), and Dr. Emeka Nwosu (The External Examiner).
                  </div>
                  <div style={{ font: "600 6.5px/1 'JetBrains Mono',monospace", color: '#0066FF', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: 5 }}>THE METHODOLOGIST:</div>
                  <div style={{ background: 'rgba(0,102,255,0.1)', borderLeft: '2px solid #0066FF', borderRadius: '0 5px 5px 0', padding: '8px 10px', marginBottom: 8 }}>
                    <div style={{ font: "700 11px/1.35 'DM Serif Display',serif", color: '#fff' }}>Why did you choose this topic?</div>
                  </div>
                  <div style={{ font: "500 6px/1 'JetBrains Mono',monospace", color: 'rgba(255,255,255,0.38)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>YOUR RESPONSE</div>
                  <div style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', borderRadius: 5, padding: 8, height: 54, marginBottom: 4 }}>
                    <span style={{ font: '400 7px/1 Poppins,sans-serif', color: 'rgba(255,255,255,0.22)' }}>Type your answer here...</span>
                  </div>
                  <div style={{ textAlign: 'right', font: '400 6px/1 Poppins,sans-serif', color: 'rgba(255,255,255,0.25)', marginBottom: 7 }}>0 / 300 words</div>
                  <div style={{ background: '#0066FF', borderRadius: 5, padding: 8, textAlign: 'center' }}>
                    <span style={{ font: '700 8.5px/1 Poppins,sans-serif', color: '#fff', letterSpacing: '0.06em' }}>SEND ANSWER</span>
                  </div>
                </div>
              </Phone>
            </div>
            <div className="oq-tour-text">
              <div className="oq-tour-eyebrow">STEP 6 · DEFENCE SIMULATOR</div>
              <h2 className="oq-tour-headline">Face 3 AI examiners before the real panel</h2>
              <div className="oq-tour-steps">
                {[
                  'Answer live questions from three examiner personas, by voice or text',
                  'Get scored on every turn as they probe your gaps',
                  'Hit 7/10+ to unlock your downloadable defence certificate',
                ].map((s, i) => (
                  <div className="oq-tour-step" key={i}>
                    <div className="oq-tour-chip">{i + 1}</div>
                    <div className="oq-tour-step-text">{s}</div>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* Footer */}
          <div className="oq-tour-footer">
            <div className="oq-tour-dots">
              {Array.from({ length: TOTAL }).map((_, i) => (
                <div
                  key={i}
                  className={`oq-tour-dot${current === i ? ' oq-tour-dot--active' : ''}`}
                  onClick={() => goTo(i)}
                  style={{ cursor: 'pointer' }}
                />
              ))}
            </div>
            <button
              className={`oq-tour-next${current === TOTAL - 1 ? ' oq-tour-next--finish' : ''}`}
              onClick={next}
            >
              {current === TOTAL - 1 ? 'Finish ✓' : 'Next →'}
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}

function Phone({ children, bg }) {
  return (
    <div className="oq-tour-phone">
      <div className="oq-pbtn oq-pbtn-l1" />
      <div className="oq-pbtn oq-pbtn-l2" />
      <div className="oq-pbtn oq-pbtn-l3" />
      <div className="oq-pbtn oq-pbtn-r" />
      <div className="oq-usbc" />
      <div className="oq-tour-screen" style={bg ? { background: bg } : undefined}>
        <div className="oq-tour-di" />
        <div className="oq-app-screen" style={bg ? { background: bg } : undefined}>
          {children}
        </div>
        <div className="oq-tour-glare" />
      </div>
    </div>
  )
}
