# Past Sessions History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Past Sessions" tab to the Defense Prep card so students can review past mock defense attempts — date, score, and full Q&A transcript.

**Architecture:** A new `PastSessions` component mounts lazily when the tab is clicked and fetches from `defense_sessions` + lazy-loads `defense_turns` per expansion. During live sessions, `DefensePrep` fire-and-forgets one `defense_turns` insert per answered question. The tab bar only appears once a completed session exists.

**Tech Stack:** React, Supabase JS client, Tailwind + custom CSS in `src/index.css`

---

## File Map

| Action | File |
|--------|------|
| Create | `migrations/0024_defense_turns_scores_column.sql` |
| Create | `src/features/defensePrep/PastSessions.jsx` |
| Modify | `src/features/defensePrep/DefensePrep.jsx` |
| Modify | `src/index.css` |

---

## Task 1: Add `scores` column to `defense_turns`

**Files:**
- Create: `migrations/0024_defense_turns_scores_column.sql`

- [ ] **Step 1: Create migration file**

```sql
-- migrations/0024_defense_turns_scores_column.sql
-- Adds scores column to defense_turns so per-examiner scores can be
-- stored alongside each Q&A turn for the Past Sessions history view.

ALTER TABLE public.defense_turns
  ADD COLUMN IF NOT EXISTS scores jsonb NOT NULL DEFAULT '[]'::jsonb;
```

- [ ] **Step 2: Apply the migration in Supabase SQL Editor**

Paste the SQL above into the Supabase SQL Editor for project `ayvunikgfwpylfrkpalj` and run it. Verify it returns "Success" with no errors.

- [ ] **Step 3: Verify column exists**

In the Supabase Table Editor, open `defense_turns` and confirm `scores` column appears with type `jsonb`. Or run:

```sql
SELECT column_name, data_type, column_default
FROM information_schema.columns
WHERE table_name = 'defense_turns' AND column_name = 'scores';
```

Expected: one row, `data_type = jsonb`, `column_default = '[]'::jsonb`.

- [ ] **Step 4: Verify RLS allows authenticated inserts and selects**

Run in SQL Editor:

```sql
SELECT policyname, cmd
FROM pg_policies
WHERE tablename = 'defense_turns';
```

You need policies for `INSERT` and `SELECT`. If they are missing, run:

```sql
ALTER TABLE public.defense_turns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own defense turns"
  ON public.defense_turns FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can select own defense turns"
  ON public.defense_turns FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
```

- [ ] **Step 5: Commit migration file**

```bash
git add migrations/0024_defense_turns_scores_column.sql
git commit -m "feat: add scores column to defense_turns"
```

---

## Task 2: Add `currentQuestionRef` and fire-and-forget turn writes to `DefensePrep`

**Files:**
- Modify: `src/features/defensePrep/DefensePrep.jsx`

- [ ] **Step 1: Add `currentQuestionRef` with the other refs (around line 551)**

Find this block:
```javascript
  const defenseSessionIdRef = useRef(null)
  const authUserRef    = useRef(authUser)
  const authSessionRef = useRef(authSession)
```

Add `currentQuestionRef` immediately after `defenseSessionIdRef`:
```javascript
  const defenseSessionIdRef = useRef(null)
  const currentQuestionRef  = useRef('')
  const authUserRef    = useRef(authUser)
  const authSessionRef = useRef(authSession)
```

- [ ] **Step 2: Update `addMsg` to capture the current examiner question**

Find:
```javascript
  function addMsg(msg) {
    setChatMessages(prev => [...prev, { id: msgIdRef.current++, ...msg }])
  }
```

Replace with:
```javascript
  function addMsg(msg) {
    if (msg.type === 'examiner' && msg.text) currentQuestionRef.current = msg.text
    setChatMessages(prev => [...prev, { id: msgIdRef.current++, ...msg }])
  }
```

- [ ] **Step 3: Add fire-and-forget turn insert in `handleStudentSubmit`**

Find this block (around line 1044):
```javascript
      // Inject scores into the student bubble we just rendered
      if (data.scores?.length) {
        patchMsg(studentMsgId, { scores: data.scores })
      }

      // Layer 2 — low score tracking
```

Insert the turn write between the patchMsg block and Layer 2:
```javascript
      // Inject scores into the student bubble we just rendered
      if (data.scores?.length) {
        patchMsg(studentMsgId, { scores: data.scores })
      }

      // Persist Q&A turn for session history — fire-and-forget
      if (defenseSessionIdRef.current && authUserRef.current?.id) {
        supabase
          .from('defense_turns')
          .insert({
            session_id:        defenseSessionIdRef.current,
            user_id:           authUserRef.current.id,
            turn_number:       qCount,
            examiner_question: currentQuestionRef.current,
            student_answer:    answer,
            scores:            data.scores ?? [],
          })
          .then(({ error: err }) => {
            if (err) console.warn('[defense_turns] insert failed:', err.message)
          })
      }

      // Layer 2 — low score tracking
```

- [ ] **Step 4: Verify in the browser**

Start a defense session, answer at least one question. Open Supabase Table Editor → `defense_turns`. Confirm a row appears with the correct `session_id`, `examiner_question`, `student_answer`, and `scores` array.

- [ ] **Step 5: Commit**

```bash
git add src/features/defensePrep/DefensePrep.jsx
git commit -m "feat: persist defense Q&A turns for session history"
```

---

## Task 3: Add `hasHistory` state, mount query, and tab state to `DefensePrep`

**Files:**
- Modify: `src/features/defensePrep/DefensePrep.jsx`

- [ ] **Step 1: Add `activeTab` and `hasHistory` state**

Find the state declarations block near the top of the component (around line 501):
```javascript
  const [hasSubmitted, setHasSubmitted]   = useState(false)
  const [section, setSection]             = useState(state.defenseSummary ? 'summary' : (state.redFlags ? 'flags' : 'input'))
```

Add two new state declarations immediately before `hasSubmitted`:
```javascript
  const [activeTab, setActiveTab]         = useState('session')
  const [hasHistory, setHasHistory]       = useState(false)
  const [hasSubmitted, setHasSubmitted]   = useState(false)
  const [section, setSection]             = useState(state.defenseSummary ? 'summary' : (state.redFlags ? 'flags' : 'input'))
```

- [ ] **Step 2: Add mount query to check for completed sessions**

Find the last `useEffect` before the TTS/voice section (around line 610). Add a new `useEffect` after it:

```javascript
  // Show "Past Sessions" tab if the user has completed at least one session for this project
  useEffect(() => {
    if (!projectId) return
    supabase
      .from('defense_sessions')
      .select('id', { count: 'exact', head: true })
      .eq('project_id', projectId)
      .eq('status', 'completed')
      .limit(1)
      .then(({ count }) => { if (count > 0) setHasHistory(true) })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])
```

- [ ] **Step 3: Set `hasHistory` to true at the end of `doEndSession`**

In `doEndSession`, find:
```javascript
      showToast('Defence session complete ✓')

      setVerdictLoading(false)
```

Add `setHasHistory(true)` between these two lines:
```javascript
      showToast('Defence session complete ✓')
      setHasHistory(true)

      setVerdictLoading(false)
```

- [ ] **Step 4: Commit**

```bash
git add src/features/defensePrep/DefensePrep.jsx
git commit -m "feat: add hasHistory check and tab state to DefensePrep"
```

---

## Task 4: Build the `PastSessions` component

**Files:**
- Create: `src/features/defensePrep/PastSessions.jsx`

- [ ] **Step 1: Create the component**

```jsx
import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

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
        <div className="skeleton-loader skeleton-loader--dark">
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
              </div>
              <div className="dp-history-item__right">
                <span className="dp-history-item__score">{session.total_score ?? '?'}/10</span>
                <span className={`dp-summary-score-badge dp-summary-score--${label}`}>
                  {label.toUpperCase()}
                </span>
                {certNumber && (
                  <span className="dp-history-cert-chip">🎓 {certNumber}</span>
                )}
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
                  <div className="skeleton-loader skeleton-loader--dark" style={{ margin: '4px 0' }}>
                    <div className="skeleton-bar" style={{ width: '100%' }} />
                    <div className="skeleton-bar" style={{ width: '75%' }} />
                  </div>
                ) : turns.length === 0 ? (
                  <p style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: '0.8rem',
                    color: 'rgba(255,255,255,0.35)',
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
                                className={`dp-score-badge dp-score-badge--${chipLabel}`}
                              >
                                {abbr} · {s.score ?? '?'}/10
                              </span>
                            )
                          })}
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
```

- [ ] **Step 2: Commit**

```bash
git add src/features/defensePrep/PastSessions.jsx
git commit -m "feat: add PastSessions component with lazy turn loading"
```

---

## Task 5: Wire tab bar and `PastSessions` into `DefensePrep` render

**Files:**
- Modify: `src/features/defensePrep/DefensePrep.jsx`

- [ ] **Step 1: Add the `PastSessions` import**

At the top of `DefensePrep.jsx`, after the existing local imports, add:
```javascript
import PastSessions from './PastSessions'
```

- [ ] **Step 2: Add tab bar and replace card contents**

Find the opening of the card in the render section:
```jsx
      {/* ── Card ─────────────────────────────────────────────────────────── */}
      <div className="dp-card" id="dp-card">

        {/* Input section */}
        <div
          id="dp-input-section"
```

Replace the entire `<div className="dp-card" id="dp-card">` contents (everything between the opening `<div className="dp-card" id="dp-card">` and its closing `</div>` tag, i.e. lines 1410–1595) with:

```jsx
      {/* ── Card ─────────────────────────────────────────────────────────── */}
      <div className="dp-card" id="dp-card">

        {/* Tab bar — only shown once the user has at least one completed session */}
        {hasHistory && (
          <div className="dp-tab-bar">
            <button
              className={`dp-tab${activeTab === 'session' ? ' dp-tab--active' : ''}`}
              onClick={() => setActiveTab('session')}
            >
              New Session
            </button>
            <button
              className={`dp-tab${activeTab === 'history' ? ' dp-tab--active' : ''}`}
              onClick={() => setActiveTab('history')}
            >
              Past Sessions
            </button>
          </div>
        )}

        {activeTab === 'session' ? (
          <>
            {/* Input section */}
            <div
              id="dp-input-section"
              className={`dp-input-section ${section === 'input' ? 'dp-section--visible' : 'dp-section--hidden'}`}
            >
              <button className="fy-back-btn" onClick={() => navigateStep(4)}>
                ← Back to Project Reviewer
              </button>

              {/* Pre-session empty state */}
              <div
                style={{
                  background: 'var(--color-bg-deep)',
                  minHeight: '400px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: '48px 32px',
                  textAlign: 'center',
                  borderRadius: '16px',
                  marginTop: '16px',
                }}
              >
                {/* Shield icon */}
                <div style={{ marginBottom: '24px', opacity: 0.9 }}>
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width={52} height={52} fill="#0066FF" aria-hidden="true" style={{ filter: 'drop-shadow(0 0 16px rgba(0,102,255,0.5))' }}>
                    <path d="M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z" />
                  </svg>
                </div>

                <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '1.75rem', color: 'var(--color-text-white)', marginBottom: '12px', lineHeight: 1.2 }}>
                  Defense Simulator
                </h2>
                <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.9rem', color: 'var(--color-text-white-dim)', maxWidth: '420px', lineHeight: 1.7, marginBottom: '32px' }}>
                  Face a three-examiner panel before the real thing. Each session adapts to your answers — exposing gaps before they cost you marks.
                </p>

                {/* Three examiner personas */}
                <div style={{ display: 'flex', gap: '12px', marginBottom: '36px', flexWrap: 'wrap', justifyContent: 'center' }}>
                  {[
                    { name: 'The Methodologist', desc: 'Challenges your research design' },
                    { name: 'The Subject Expert', desc: 'Tests your domain knowledge' },
                    { name: 'The External Examiner', desc: 'Questions originality & contribution' },
                  ].map((examiner) => (
                    <div
                      key={examiner.name}
                      style={{
                        background: 'rgba(0,102,255,0.08)',
                        border: '1px solid rgba(0,102,255,0.2)',
                        borderRadius: '10px',
                        padding: '12px 16px',
                        textAlign: 'left',
                        minWidth: '160px',
                      }}
                    >
                      <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.7rem', color: '#3B82F6', fontWeight: 600, marginBottom: '4px' }}>
                        {examiner.name}
                      </div>
                      <div style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.75rem', color: 'rgba(255,255,255,0.5)', lineHeight: 1.4 }}>
                        {examiner.desc}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Start button */}
                {scanError && (
                  <p style={{ fontFamily: 'Poppins, sans-serif', fontSize: '0.8rem', color: '#F87171', marginBottom: '16px', maxWidth: '380px', lineHeight: 1.5 }}>
                    {scanError}
                  </p>
                )}
                <button
                  onClick={startRedFlagScan}
                  disabled={isScanning || rfOverLimit}
                  style={{
                    background: rfOverLimit ? 'rgba(0,102,255,0.35)' : 'var(--color-blue-primary)',
                    color: 'var(--color-text-white)',
                    fontFamily: 'Poppins, sans-serif',
                    fontWeight: 600,
                    fontSize: '0.9rem',
                    border: 'none',
                    borderRadius: '12px',
                    padding: '14px 32px',
                    cursor: (isScanning || rfOverLimit) ? 'not-allowed' : 'pointer',
                    opacity: (isScanning || rfOverLimit) ? 0.6 : 1,
                    boxShadow: '0 0 24px rgba(0,102,255,0.35)',
                    transition: 'all 0.2s ease',
                  }}
                  onMouseEnter={e => {
                    if (!isScanning && !rfOverLimit) {
                      e.currentTarget.style.boxShadow = '0 0 32px rgba(0,102,255,0.55)'
                      e.currentTarget.style.transform = 'translateY(-2px)'
                    }
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = '0 0 24px rgba(0,102,255,0.35)'
                    e.currentTarget.style.transform = 'translateY(0)'
                  }}
                >
                  {isScanning ? 'Scanning for vulnerabilities…' : 'Start Simulation'}
                </button>
                {rfOverLimit && (
                  <p style={{ fontFamily: 'Poppins, sans-serif', color: '#F87171', fontSize: '0.78rem', marginTop: '12px' }}>
                    You've reached your limit for this feature. Start a new project or upgrade your plan.
                  </p>
                )}
              </div>
            </div>

            {/* Loading section */}
            {section === 'loading' && hasSubmitted && (
              <div id="dp-loading-section" className="dp-loading-section dp-section--visible">
                <div className="skeleton-loader">
                  <div className="skeleton-bar" style={{ width: '100%' }} />
                  <div className="skeleton-bar" style={{ width: '75%' }} />
                  <div className="skeleton-bar" style={{ width: '90%' }} />
                  <div className="skeleton-bar" style={{ width: '60%' }} />
                </div>
                <p className="dp-step-label">Step 6: Defence Prep</p>
                <LoadingMessages messages={GENERIC_LOADING_MESSAGES} />
              </div>
            )}

            {/* Flags section */}
            <div
              id="dp-flags-section"
              className={`dp-flags-section ${(section === 'flags' || (section === 'summary' && redFlags && redFlags.length > 0)) ? 'dp-section--visible' : 'dp-section--hidden'}`}
            >
              <p className="dp-flags-header">Project Vulnerabilities Detected</p>
              <div id="dp-flags-list">
                {(redFlags || []).map((flag, idx) => (
                  <FlagItem key={idx} flag={flag} visible={visibleFlags.includes(idx)} />
                ))}
              </div>
            </div>

            {/* Buttons section */}
            <div
              id="dp-buttons-section"
              className={`dp-buttons-section ${(section === 'flags' && buttonsVisible) ? 'dp-section--visible' : 'dp-section--hidden'}`}
            >
              <button
                id="dp-btn-enter-defense"
                className="dp-btn-enter-defense"
                onClick={enterDefenseMode}
                disabled={dsOverLimit}
                style={dsOverLimit ? { opacity: 0.5, cursor: 'not-allowed' } : {}}
              >
                Enter Defence Mode
              </button>
              {dsOverLimit && (
                <p style={{ color: '#DC2626', fontSize: '0.8rem', marginTop: 8 }}>
                  You've reached your limit for this feature. Start a new project or upgrade your plan.
                </p>
              )}
              <button
                id="dp-btn-go-back"
                className="dp-btn-go-back"
                onClick={handleGoBackAndRevise}
              >
                Go Back and Revise
              </button>
              <button className="fy-back-btn" onClick={() => navigateStep(4)}>
                ← Back to Project Reviewer
              </button>
            </div>

            {/* Persisted summary section */}
            <div
              id="dp-persisted-summary-section"
              className={section === 'summary' ? 'dp-section--visible' : 'dp-section--hidden'}
            >
              {summaryData && (
                <SummaryCard
                  data={summaryData}
                  onClose={handleCloseSummary}
                  projectId={projectId}
                  topic={state.validatedTopic || ''}
                  defenseSessionId={defenseSessionId}
                />
              )}
            </div>
          </>
        ) : (
          projectId && <PastSessions projectId={projectId} />
        )}
      </div>
```

- [ ] **Step 3: Start the dev server and verify the card renders correctly with no console errors**

```bash
npm run dev
```

Navigate to Step 6 in the app. Confirm:
- The card renders normally (no tab bar yet, since no completed sessions exist)
- The pre-session state, flags, and summary sections still work

- [ ] **Step 4: Commit**

```bash
git add src/features/defensePrep/DefensePrep.jsx
git commit -m "feat: wire Past Sessions tab into DefensePrep card"
```

---

## Task 6: Add CSS for tab bar and history list

**Files:**
- Modify: `src/index.css`

- [ ] **Step 1: Append new CSS block to the end of `src/index.css`**

Add the following at the very end of `src/index.css`:

```css
/* ── Past Sessions History (2026-06-03) ─────────────────────────────────────── */

/* Tab bar */
.dp-tab-bar {
  display: flex;
  gap: 4px;
  padding-bottom: 16px;
  border-bottom: 1px solid var(--color-border);
  margin-bottom: 20px;
  position: relative;
}

.dp-tab {
  font-family: 'Poppins', sans-serif;
  font-size: 0.82rem;
  font-weight: 600;
  padding: 8px 18px;
  border: none;
  border-radius: var(--radius-md);
  cursor: pointer;
  background: transparent;
  color: var(--color-text-muted);
  transition: color var(--transition-fast), background var(--transition-fast);
  position: relative;
}

.dp-tab::after {
  content: '';
  position: absolute;
  bottom: -17px;
  left: 0;
  width: 100%;
  height: 2px;
  background: transparent;
  border-radius: 2px 2px 0 0;
  transition: background var(--transition-fast);
}

.dp-tab--active {
  color: var(--color-blue-primary);
}

.dp-tab--active::after {
  background: var(--color-blue-primary);
}

.dp-tab:hover:not(.dp-tab--active) {
  color: var(--color-text-primary);
  background: var(--color-blue-glow);
}

/* Dark mode tab bar */
[data-theme="dark"] .dp-tab,
.dark .dp-tab {
  color: rgba(255, 255, 255, 0.4);
}

[data-theme="dark"] .dp-tab:hover:not(.dp-tab--active),
.dark .dp-tab:hover:not(.dp-tab--active) {
  color: rgba(255, 255, 255, 0.75);
  background: rgba(0, 102, 255, 0.08);
}

/* History list container */
.dp-history-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

/* Session item */
.dp-history-item {
  background: var(--color-bg-deep);
  border: 1px solid rgba(0, 102, 255, 0.12);
  border-radius: var(--radius-md);
  overflow: hidden;
  transition: border-color var(--transition-fast);
}

.dp-history-item--expanded {
  border-color: rgba(0, 102, 255, 0.3);
}

.dp-history-item__header {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 14px 18px;
  background: none;
  border: none;
  cursor: pointer;
  text-align: left;
  transition: background var(--transition-fast);
}

.dp-history-item__header:hover {
  background: rgba(0, 102, 255, 0.06);
}

.dp-history-item__meta {
  display: flex;
  flex-direction: column;
  gap: 2px;
  min-width: 0;
}

.dp-history-item__date {
  font-family: 'Poppins', sans-serif;
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--color-text-white);
}

.dp-history-item__count {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.68rem;
  color: rgba(255, 255, 255, 0.4);
  letter-spacing: 0.3px;
}

.dp-history-item__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  justify-content: flex-end;
  flex-shrink: 0;
}

.dp-history-item__score {
  font-family: 'JetBrains Mono', monospace;
  font-size: 1.05rem;
  font-weight: 700;
  color: var(--color-text-white);
}

.dp-history-cert-chip {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: var(--radius-pill);
  background: rgba(0, 102, 255, 0.12);
  color: #60A5FA;
  border: 1px solid rgba(0, 102, 255, 0.25);
  white-space: nowrap;
}

.dp-history-chevron {
  color: rgba(255, 255, 255, 0.35);
  transition: transform var(--transition-fast), color var(--transition-fast);
  flex-shrink: 0;
}

.dp-history-chevron--open {
  transform: rotate(180deg);
  color: var(--color-blue-primary);
}

/* Transcript */
.dp-history-item__transcript {
  padding: 16px 18px 18px;
  display: flex;
  flex-direction: column;
  gap: 20px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

/* Single Q&A turn */
.dp-history-turn {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.dp-history-turn__question,
.dp-history-turn__answer {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.dp-history-turn__label {
  font-family: 'JetBrains Mono', monospace;
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.8px;
  color: rgba(255, 255, 255, 0.3);
  text-transform: uppercase;
}

.dp-history-turn__question .dp-history-turn__text {
  font-family: 'Poppins', sans-serif;
  font-size: 0.82rem;
  color: #93c5fd;
  line-height: 1.6;
  padding: 10px 14px;
  background: rgba(59, 130, 246, 0.08);
  border-left: 2px solid rgba(59, 130, 246, 0.35);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  margin: 0;
}

.dp-history-turn__answer .dp-history-turn__text {
  font-family: 'Poppins', sans-serif;
  font-size: 0.82rem;
  color: rgba(255, 255, 255, 0.72);
  line-height: 1.6;
  padding: 10px 14px;
  background: rgba(255, 255, 255, 0.04);
  border-left: 2px solid rgba(255, 255, 255, 0.1);
  border-radius: 0 var(--radius-sm) var(--radius-sm) 0;
  margin: 0;
}

.dp-history-turn__scores {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  margin-top: 4px;
}

/* Empty state */
.dp-history-empty {
  font-family: 'Poppins', sans-serif;
  font-size: 0.85rem;
  color: rgba(255, 255, 255, 0.4);
  text-align: center;
  padding: 48px 20px;
  background: var(--color-bg-deep);
  border-radius: var(--radius-md);
  border: 1px solid rgba(255, 255, 255, 0.06);
  line-height: 1.6;
  margin: 0;
}
```

- [ ] **Step 2: Verify no existing `dp-tab-bar` or `dp-history-` classes already exist**

```bash
grep -n "dp-tab-bar\|dp-history-" src/index.css
```

Expected: only matches in the block you just added (at the end of the file).

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git commit -m "feat: add CSS for Past Sessions tab bar and history list"
```

---

## Task 7: End-to-end verification

- [ ] **Step 1: Complete a full defense session in the browser**

Run `npm run dev`, log in, navigate to Step 6. Complete a session (answer 5 questions). Confirm:
1. `defense_turns` table in Supabase has 5 rows for the session (check in Table Editor)
2. A "Past Sessions" tab appears on the dp-card after the session ends

- [ ] **Step 2: Open the Past Sessions tab**

Click "Past Sessions". Confirm:
1. The completed session appears in the list with correct date, score, and pass/fail badge
2. Certificate chip appears if score ≥ 7

- [ ] **Step 3: Expand a session**

Click the session row. Confirm:
1. A loading skeleton appears briefly, then the Q&A turns render
2. Each turn shows: examiner question (blue border), student answer (grey border), score chips
3. Collapsing and re-expanding the same session does NOT trigger another DB fetch (turns are cached)

- [ ] **Step 4: Verify light mode and dark mode**

Toggle the theme. Confirm:
1. Tab bar text is readable in both modes
2. Session items remain dark (they use `--color-bg-deep`) in both modes
3. No hardcoded colours break

- [ ] **Step 5: Verify new session flow is unaffected**

Switch back to "New Session" tab. Confirm:
1. The full defense flow (scan → flags → enter defense → session → summary) still works
2. The overlay and summary card are unaffected

- [ ] **Step 6: Final commit if any fixes were needed**

```bash
git add -p
git commit -m "fix: past sessions history — post-review corrections"
```
