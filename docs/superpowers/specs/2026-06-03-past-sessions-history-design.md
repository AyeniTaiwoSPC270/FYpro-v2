# Past Sessions History — Design Spec
**Date:** 2026-06-03
**Feature:** Past Sessions tab inside Defense Prep (Step 6)

---

## Overview

Add a "Past Sessions" tab to the Defense Prep card so students can review their previous mock defense attempts — date, score, pass/fail, and the full Q&A transcript. Students who run multiple sessions need to study their weak answers and track improvement over time.

---

## Data Layer

### Writing turns during a live session

After each answer is submitted and the `panelFollowUp` response resolves, insert one row to `defense_turns`. This is fire-and-forget — failure must never block the UI.

**Columns written:**
- `session_id` — `defenseSessionIdRef.current`
- `user_id` — `authUserRef.current.id`
- `turn_number` — `questionCountRef.current` at time of submission
- `examiner_question` — `currentQuestionRef.current` (new ref, updated whenever an examiner message is added via `addMsg`)
- `student_answer` — the submitted answer string
- `scores` — jsonb, the per-examiner score array returned by `panelFollowUp`

Insert happens in `handleStudentSubmit`, after `patchMsg` updates the student bubble with scores. Wrapped in try/catch, silently swallowed on failure.

**Guard:** Only insert if `defenseSessionIdRef.current` is set. If the session row was never created (edge case), skip silently.

### Fetching past sessions

Query triggered when the Past Sessions tab is first clicked (lazy mount of `PastSessions` component).

```sql
SELECT
  ds.id, ds.completed_at, ds.total_score, ds.turns_count, ds.status,
  dc.certificate_number
FROM defense_sessions ds
LEFT JOIN defense_certificates dc ON dc.session_id = ds.id
WHERE ds.project_id = :projectId
  AND ds.status = 'completed'
ORDER BY ds.completed_at DESC
```

Fetch turns per-session only when the user expands a session row (lazy):

```sql
SELECT turn_number, examiner_question, student_answer, scores
FROM defense_turns
WHERE session_id = :sessionId
ORDER BY turn_number ASC
```

---

## Component Structure

### New component: `PastSessions`
**File:** `src/features/defensePrep/PastSessions.jsx`

Props: `projectId` (string)  
Note: `userId` is not needed — Supabase RLS ensures users only see their own sessions; `projectId` alone is sufficient for the query.

Responsibilities:
- Fetch and display list of completed sessions
- Handle per-session turn lazy-load on expand
- Render loading skeleton, empty state, error state

Internal state:
- `sessions` — array of session rows
- `loading` — boolean
- `error` — string | null
- `expandedId` — string | null (only one session open at a time)
- `turnsCache` — `{ [sessionId]: turn[] }` — avoids re-fetching turns on collapse/expand

### Changes to `DefensePrep`

1. Add `activeTab` state: `'session' | 'history'`, default `'session'`
2. Add `hasHistory` state: boolean, set after a one-time lightweight query on mount (`SELECT COUNT(*) FROM defense_sessions WHERE project_id = ? AND status = 'completed' LIMIT 1`) — controls tab bar visibility
3. Add `currentQuestionRef` ref — updated to the current examiner question text whenever `addMsg` adds an examiner message
4. Render tab bar at top of `dp-card` when `hasHistory` is true
5. When `activeTab === 'history'`, render `<PastSessions projectId={projectId} />` in place of the existing sections
6. In `handleStudentSubmit`: add fire-and-forget turn insert after `patchMsg` scores update
7. At the end of `doEndSession` (after `showToast`): set `hasHistory(true)` so the tab appears immediately after the first completed session without requiring a remount

---

## UI Design

### Tab bar
- Rendered inside `dp-card`, above the existing sections
- Only shown when `hasHistory === true`
- Two tabs: **New Session** | **Past Sessions**
- Active tab: blue bottom border (`var(--color-blue-primary)`), full-opacity text
- Inactive tab: no border, `var(--color-text-muted)` text
- CSS class: `dp-tab-bar`, `dp-tab`, `dp-tab--active`

### Session list card
Each completed session is a `dp-history-item` row:
- Left: date (`completed_at` formatted as "3 Jun 2026"), question count ("5 questions")
- Centre: score (`total_score/10`) in `JetBrains Mono`
- Right: pass/fail badge (green ≥7, amber 5–6, red <5), certificate chip if `certificate_number` is set
- Full row is clickable to expand/collapse transcript
- Expand indicator: chevron icon, rotates 180° when open

### Transcript view (expanded)
Rendered inline below the session row header.

Each turn:
```
[turn_number] EXAMINER NAME:
  Examiner question text (blue left border)

YOUR ANSWER:
  Student answer text (grey left border)

  [EXAMINER ABBR · SCORE/10]  (score chips, colour-coded)
```

Styling mirrors the live session chat layout — `dp-examiner-bubble` visual language, `dp-score-badge` chips — so it feels continuous with what the student remembers from the session.

### Loading state
3 `skeleton-bar` elements inside `skeleton-loader--dark` while sessions fetch.

### Empty state
Shown when `sessions.length === 0` after fetch resolves:
> "No completed sessions yet. Start a simulation to see your history here."

### Error state
Inline error message with a "Try again" button that re-triggers the fetch.

---

## CSS

All new classes use `dp-` prefix. Appended at the bottom of `style.css` in a clearly delimited block: `/* ── Past Sessions History (2026-06-03) ── */`

Key new classes:
- `dp-tab-bar` — flex row, border-bottom separator
- `dp-tab` — tab button base
- `dp-tab--active` — active tab state
- `dp-history-list` — session list container
- `dp-history-item` — single session row
- `dp-history-item--expanded` — expanded state modifier
- `dp-history-item__header` — clickable header row
- `dp-history-item__transcript` — collapsible transcript body
- `dp-history-turn` — single Q&A turn
- `dp-history-score-badge` — score chip (reuses badge colour logic from `dp-score-badge`)
- `dp-history-empty` — empty state
- `dp-history-cert-chip` — certificate number badge

Light and dark mode: all colours via CSS variables. No hardcoded hex.

---

## What Is NOT in Scope

- Deleting individual sessions from history
- Filtering/sorting sessions
- Paginating sessions (students rarely exceed 10 sessions on a single project)
- Writing turns for sessions that completed before this feature shipped (historical backfill)
