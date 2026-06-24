# Rating Modal Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a proactive 1–5 star rating modal with two suggestion fields, triggered once per user after their first Defense Simulator session or 3 workflow steps, surfacing results in Telegram `/ratings` and a new admin dashboard tab.

**Architecture:** New `user_ratings` Supabase table (isolated from existing `feature_feedback`). A `useRatingTrigger` hook mounted in `AppShell` watches for both triggers via a DOM event (defense) and `stepsCompleted` value change (milestone). `RatingModal` renders as a two-step overlay. Submission goes through `api/admin?action=submit-rating` which fires a Telegram alert server-side. Admin data served by `api/admin?action=get-ratings` (admin-gated).

**Tech Stack:** React (Vite), Supabase PostgreSQL, Vercel serverless (api/admin.js), Telegram Bot API via api/notify.js, Zod validation, Upstash Redis rate limiting, vitest for tests.

## Global Constraints

- Never hardcode hex colours — always use CSS variables from the design system
- Never add a new Vercel function — stay at 12/12 (add to existing api/admin.js and api/notify.js)
- `fypro_rating_done` is the localStorage key for the once-ever guard
- `fypro:defense-session-saved` is the custom DOM event dispatched by DefensePrep on session completion
- RLS must be enabled on the new table — verify with `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;` after applying migration
- Run `npm run typecheck` and `npm run test` before committing non-trivial changes
- Light/dark mode: modal card is always white (`#FFFFFF`) — overlay handles dark backdrop
- CSS prefix for rating modal: `rm-` — append to `src/styles/` as a new file only if inline styles are insufficient

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `migrations/0034_user_ratings.sql` | Create | Table DDL + RLS policies |
| `api/_lib/validate.js` | Modify | Add `SubmitRatingSchema` |
| `api/admin.js` | Modify | Add `handleSubmitRating` + `handleGetRatings` + dispatch entries |
| `api/notify.js` | Modify | Add `cmdRatings()` + keyboard entry + runCommand entry + help text |
| `src/features/defensePrep/DefensePrep.jsx` | Modify | Dispatch `fypro:defense-session-saved` after session saved |
| `src/hooks/useRatingTrigger.ts` | Create | Once-ever guard + two trigger useEffects |
| `src/components/rating/RatingModal.jsx` | Create | Two-step modal UI (rating → suggestion → thankyou) |
| `src/features/shell/AppShell.jsx` | Modify | Add `ratingPrompt` state, mount `<RatingModal>`, call hook |
| `src/pages/admin/widgets/RatingsWidget.jsx` | Create | Stats bar + distribution + recent submissions table |
| `src/pages/admin/Health.jsx` | Modify | Add Ratings tab + `loadRatings` + tab switch handler |

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/0034_user_ratings.sql`

- [ ] **Step 1: Write migration file**

```sql
-- Migration 0034: user_ratings
-- Stores proactive star ratings + open-ended suggestions from the rating modal.
-- Separate from feature_feedback (thumbs) — different schema and purpose.
-- Run in Supabase SQL Editor. Verify RLS check at the bottom.

CREATE TABLE public.user_ratings (
  id                 uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id            uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars              smallint    NOT NULL CHECK (stars BETWEEN 1 AND 5),
  trigger_type       text        NOT NULL CHECK (trigger_type IN ('defense_simulator', 'steps_milestone')),
  feature            text        NOT NULL,
  suggestion_feature text,
  suggestion_ui      text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_ratings_user_idx    ON public.user_ratings(user_id);
CREATE INDEX user_ratings_created_idx ON public.user_ratings(created_at DESC);

ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user inserts own rating"
  ON public.user_ratings FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "user reads own rating"
  ON public.user_ratings FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- Verify: must return zero rows
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
```

- [ ] **Step 2: Apply in Supabase SQL Editor**

Open Supabase dashboard → SQL Editor → paste migration → Run.
Then run the verification query and confirm zero rows returned.

- [ ] **Step 3: Commit**

```bash
git add migrations/0034_user_ratings.sql
git commit -m "feat(ratings): add user_ratings table with RLS"
```

---

## Task 2: API — Zod Schema + `submit-rating` + `get-ratings`

**Files:**
- Modify: `api/_lib/validate.js`
- Modify: `api/admin.js`

**Interfaces:**
- Produces: `POST /api/admin?action=submit-rating` (authenticated, returns `{ ok: true }`)
- Produces: `GET /api/admin?action=get-ratings` (admin-only, returns `{ stats, recent }`)

- [ ] **Step 1: Add `SubmitRatingSchema` to validate.js**

Add after the existing `AiMessagesSchema` export (around line 33):

```javascript
export const SubmitRatingSchema = z.object({
  stars:              z.number().int().min(1).max(5),
  trigger_type:       z.enum(['defense_simulator', 'steps_milestone']),
  feature:            z.string().min(1).max(100),
  suggestion_feature: z.string().max(500).nullable().optional(),
  suggestion_ui:      z.string().max(500).nullable().optional(),
});
```

- [ ] **Step 2: Write test for the new schema**

Create `api/_lib/validate.rating.test.js`:

```javascript
import { describe, it, expect } from 'vitest'
import { SubmitRatingSchema, validate } from './validate.js'

describe('SubmitRatingSchema', () => {
  const base = { stars: 4, trigger_type: 'defense_simulator', feature: 'Defense Simulator' }

  it('accepts a valid rating with no suggestions', () => {
    expect(validate(SubmitRatingSchema, base).ok).toBe(true)
  })

  it('accepts a rating with both suggestion fields', () => {
    const result = validate(SubmitRatingSchema, { ...base, suggestion_feature: 'PDF export', suggestion_ui: 'Sidebar narrow' })
    expect(result.ok).toBe(true)
  })

  it('accepts null suggestion fields', () => {
    expect(validate(SubmitRatingSchema, { ...base, suggestion_feature: null, suggestion_ui: null }).ok).toBe(true)
  })

  it('rejects stars out of range', () => {
    expect(validate(SubmitRatingSchema, { ...base, stars: 0 }).ok).toBe(false)
    expect(validate(SubmitRatingSchema, { ...base, stars: 6 }).ok).toBe(false)
  })

  it('rejects invalid trigger_type', () => {
    expect(validate(SubmitRatingSchema, { ...base, trigger_type: 'unknown' }).ok).toBe(false)
  })

  it('rejects suggestion_feature over 500 chars', () => {
    expect(validate(SubmitRatingSchema, { ...base, suggestion_feature: 'x'.repeat(501) }).ok).toBe(false)
  })

  it('rejects empty feature string', () => {
    expect(validate(SubmitRatingSchema, { ...base, feature: '' }).ok).toBe(false)
  })
})
```

- [ ] **Step 3: Run tests to confirm the schema test passes**

```bash
npm run test -- validate.rating
```

Expected: 7 passing tests.

- [ ] **Step 4: Add `handleSubmitRating` to admin.js**

Add this function before the `export default async function handler` block (e.g., after `handleFeedbackSummary`). Import `SubmitRatingSchema` and `validate` at the top of admin.js by adding to the existing validate import:

```javascript
import { validate, SubmitRatingSchema } from './_lib/validate.js';
```

Then add the handler function:

```javascript
// action: "submit-rating" — authenticated users only (no admin gate)
async function handleSubmitRating(req, res) {
  // Rate limit: 3 req/user/day, 10 req/IP/hour
  const rl = await rateLimitCheck(req, { userDay: 3, ipHour: 10, prefix: 'rating' });
  if (!rl.allowed) return res.status(429).json({ error: 'Too many requests. Please try again tomorrow.' });

  const token = req.headers.authorization?.replace('Bearer ', '');
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  let user;
  try {
    const { data, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !data?.user) return res.status(401).json({ error: 'Unauthorized' });
    user = data.user;
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const v = validate(SubmitRatingSchema, req.body);
  if (!v.ok) return res.status(400).json({ error: v.error });

  const { stars, trigger_type, feature, suggestion_feature, suggestion_ui } = req.body;

  const { error: insertErr } = await supabaseAdmin.from('user_ratings').insert({
    user_id:            user.id,
    stars,
    trigger_type,
    feature,
    suggestion_feature: suggestion_feature ?? null,
    suggestion_ui:      suggestion_ui ?? null,
  });
  if (insertErr) {
    console.error('[admin/submit-rating] insert error:', insertErr.message);
    return res.status(500).json({ error: 'Failed to save rating' });
  }

  const starStr   = '★'.repeat(stars) + '☆'.repeat(5 - stars);
  const featLine  = suggestion_feature ? `\n💡 Feature request: "${suggestion_feature.slice(0, 120)}"` : '';
  const uiLine    = suggestion_ui      ? `\n🎨 UI feedback: "${suggestion_ui.slice(0, 120)}"` : '';

  await sendTelegramAlert(
    `⭐ <b>New Rating</b>\n` +
    `👤 ${user.email}\n` +
    `📋 Feature: ${feature}\n` +
    `⭐ Stars: ${starStr} (${stars}/5)` +
    featLine +
    uiLine
  ).catch(err => console.error('[admin/submit-rating] Telegram error:', err.message));

  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 5: Add `handleGetRatings` to admin.js**

Add after `handleSubmitRating`:

```javascript
// action: "get-ratings" — admin only
async function handleGetRatings(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const { data: rows, error: fetchErr } = await supabaseAdmin
      .from('user_ratings')
      .select('id, user_id, stars, trigger_type, feature, suggestion_feature, suggestion_ui, created_at')
      .order('created_at', { ascending: false })
      .limit(200);

    if (fetchErr) throw fetchErr;

    const allRows = rows || [];
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const total          = allRows.length;
    const withSuggestions = allRows.filter(r => r.suggestion_feature || r.suggestion_ui).length;
    const thisWeek       = allRows.filter(r => r.created_at >= weekAgo).length;
    const avgStars       = total > 0
      ? parseFloat((allRows.reduce((s, r) => s + r.stars, 0) / total).toFixed(1))
      : 0;

    const distribution = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0 };
    const byTriggerAcc = {};
    for (const r of allRows) {
      distribution[String(r.stars)] = (distribution[String(r.stars)] || 0) + 1;
      if (!byTriggerAcc[r.trigger_type]) byTriggerAcc[r.trigger_type] = { sum: 0, count: 0 };
      byTriggerAcc[r.trigger_type].sum += r.stars;
      byTriggerAcc[r.trigger_type].count++;
    }
    const by_trigger = {};
    for (const [k, v] of Object.entries(byTriggerAcc)) {
      by_trigger[k] = { avg: parseFloat((v.sum / v.count).toFixed(1)), count: v.count };
    }

    const recent = allRows.slice(0, 20);
    const emailMap = {};
    await Promise.all(
      [...new Set(recent.map(r => r.user_id))].map(async uid => {
        try {
          const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(uid);
          if (user) emailMap[uid] = user.email;
        } catch {}
      })
    );

    return res.status(200).json({
      stats: { avg_stars: avgStars, total, with_suggestions: withSuggestions, this_week: thisWeek, by_trigger, distribution },
      recent: recent.map(r => ({ ...r, user_email: emailMap[r.user_id] || '—' })),
    });
  } catch (err) {
    console.error('[admin/get-ratings] error:', err.message);
    return res.status(500).json({ error: 'Internal server error' });
  }
}
```

- [ ] **Step 6: Register both actions in the dispatch block**

In `api/admin.js`, find the dispatch block (around line 2034–2035, near `feedback-summary` and `report-payment-issue`) and add two lines:

```javascript
  if (action === 'submit-rating')   return handleSubmitRating(req, res);
  if (action === 'get-ratings')     return handleGetRatings(req, res);
```

Add them after the `feedback-summary` line.

- [ ] **Step 7: Commit**

```bash
git add api/_lib/validate.js api/_lib/validate.rating.test.js api/admin.js
git commit -m "feat(ratings): add submit-rating and get-ratings API actions"
```

---

## Task 3: Telegram `/ratings` Command

**Files:**
- Modify: `api/notify.js`

**Interfaces:**
- Produces: Telegram `/ratings` command that returns summary stats + last 5 submissions

- [ ] **Step 1: Add `cmdRatings` function to notify.js**

Add after `cmdReports` (around line 701):

```javascript
async function cmdRatings() {
  const { data: rows } = await supabaseAdmin
    .from('user_ratings')
    .select('user_id, stars, trigger_type, suggestion_feature, suggestion_ui, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (!rows || rows.length === 0) return '⭐ <b>No ratings yet</b>'

  const weekAgo    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twoWksAgo  = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const total      = rows.length
  const avg        = rows.reduce((s, r) => s + r.stars, 0) / total
  const withText   = rows.filter(r => r.suggestion_feature || r.suggestion_ui).length
  const thisWeek   = rows.filter(r => r.created_at >= weekAgo).length
  const lastWeek   = rows.filter(r => r.created_at < weekAgo && r.created_at >= twoWksAgo).length
  const delta      = thisWeek - lastWeek
  const deltaStr   = delta >= 0 ? `↑${delta}` : `↓${Math.abs(delta)}`
  const starStr    = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg))

  const dsRows = rows.filter(r => r.trigger_type === 'defense_simulator')
  const smRows = rows.filter(r => r.trigger_type === 'steps_milestone')
  const dsAvg  = dsRows.length ? (dsRows.reduce((s,r) => s+r.stars, 0) / dsRows.length).toFixed(1) : '—'
  const smAvg  = smRows.length ? (smRows.reduce((s,r) => s+r.stars, 0) / smRows.length).toFixed(1) : '—'

  const recent5  = rows.slice(0, 5)
  const emailMap = {}
  await Promise.all(
    [...new Set(recent5.map(r => r.user_id))].map(async uid => {
      try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(uid)
        if (user) emailMap[uid] = (user.email || '').split('@')[0]
      } catch {}
    })
  )

  const lines = recent5.map((r, i) => {
    const name    = escapeTgHtml(emailMap[r.user_id] || '—')
    const stars   = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars)
    const feat    = r.suggestion_feature
      ? `\n   💡 "${escapeTgHtml(r.suggestion_feature.slice(0, 80))}"`
      : '\n   💡 —'
    const ui      = r.suggestion_ui
      ? `\n   🎨 "${escapeTgHtml(r.suggestion_ui.slice(0, 80))}"`
      : '\n   🎨 —'
    return `${i + 1}. ${name} · ${stars} · ${r.trigger_type}${feat}${ui}`
  }).join('\n\n')

  return (
    `⭐ <b>Ratings Summary</b>\n\n` +
    `Avg score:   ${starStr}  ${avg.toFixed(1)} / 5\n` +
    `Total:       ${total} ratings\n` +
    `With text:   ${withText} (${Math.round((withText/total)*100)}%)\n` +
    `This week:   ${thisWeek}  ${deltaStr} vs last\n\n` +
    `By trigger:\n` +
    `🎓 Defense Simulator  — ★${dsAvg}  (${dsRows.length})\n` +
    `📋 Steps Milestone    — ★${smAvg}  (${smRows.length})\n\n` +
    `── Recent submissions ──\n\n` +
    lines
  )
}
```

- [ ] **Step 2: Register in `runCommand`**

Find the `runCommand` function (around line 788). Add before `else if (key === 'help')`:

```javascript
  else if (key === 'ratings'      ) return cmdRatings()
```

- [ ] **Step 3: Add to `KEYBOARD`**

Find the `KEYBOARD` constant (around line 754). The current last entry is `[{ text: '📋 Reports', callback_data: 'reports' }]`. Add a new row:

```javascript
    [
      { text: '📋 Reports',   callback_data: 'reports'   },
      { text: '⭐ Ratings',   callback_data: 'ratings'   },
    ],
```

(Replace the single-item Reports row with a two-item row.)

- [ ] **Step 4: Add to help text**

Find the help text string (around line 735). Add `/ratings — star rating summary` in the Data section:

```
/ratings — star rating summary
```

Add it after `/reports — open user reports`.

- [ ] **Step 5: Commit**

```bash
git add api/notify.js
git commit -m "feat(ratings): add /ratings Telegram command"
```

---

## Task 4: Dispatch `fypro:defense-session-saved` in DefensePrep.jsx

**Files:**
- Modify: `src/features/defensePrep/DefensePrep.jsx`

**Interfaces:**
- Produces: DOM event `fypro:defense-session-saved` dispatched after defense session is written to Supabase

- [ ] **Step 1: Find the dispatch location**

Search in DefensePrep.jsx for `showToast('Defence session complete ✓')` (around line 1318). The event should be dispatched right after this line, once both the session write and the toast are done:

```javascript
      showToast('Defence session complete ✓')
      // NEW: signal the rating trigger hook that a defense session just completed
      document.dispatchEvent(new CustomEvent('fypro:defense-session-saved'))
      setHasHistory(true)
```

Add the `document.dispatchEvent` line between `showToast` and `setHasHistory`.

- [ ] **Step 2: Verify the event fires at the right moment**

Confirm the line is inside the `try` block that handles the session write (both the update path and the fallback insert path converge before `showToast`). The event fires after either path succeeds, which is correct.

- [ ] **Step 3: Commit**

```bash
git add src/features/defensePrep/DefensePrep.jsx
git commit -m "feat(ratings): dispatch fypro:defense-session-saved event on session complete"
```

---

## Task 5: `useRatingTrigger` Hook

**Files:**
- Create: `src/hooks/useRatingTrigger.ts`

**Interfaces:**
- Consumes: `stepsCompleted: boolean[]` from `AppContext` state; `setRatingPrompt: (p: RatingPrompt) => void` from AppShell
- Produces: calls `setRatingPrompt({ show: true, triggerType, feature })` when a trigger fires

- [ ] **Step 1: Create the hook file**

```typescript
// src/hooks/useRatingTrigger.ts
import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export interface RatingPrompt {
  show: boolean
  triggerType: 'defense_simulator' | 'steps_milestone'
  feature: string
}

const LS_KEY = 'fypro_rating_done'

export function useRatingTrigger(
  stepsCompleted: boolean[],
  setRatingPrompt: (p: RatingPrompt) => void,
): void {
  // firedRef prevents double-firing within a single session
  const firedRef     = useRef(false)
  const prevCountRef = useRef(stepsCompleted.filter(Boolean).length)

  const fireTrigger = useCallback(async (
    triggerType: 'defense_simulator' | 'steps_milestone',
    feature: string,
  ) => {
    if (firedRef.current) return
    if (localStorage.getItem(LS_KEY)) { firedRef.current = true; return }

    // Belt-and-braces Supabase check — restores state after login on a new device
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) return
      const { data } = await supabase
        .from('user_ratings')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)
      if (data && data.length > 0) {
        localStorage.setItem(LS_KEY, '1')
        firedRef.current = true
        return
      }
    } catch {
      // Fail open — show the modal even if the Supabase check fails
    }

    firedRef.current = true
    setRatingPrompt({ show: true, triggerType, feature })
  }, [setRatingPrompt])

  // Trigger 1 — Defense Simulator (primary)
  // Fires on the fypro:defense-session-saved DOM event dispatched by DefensePrep.jsx.
  // Does NOT fire on initial mount — only when the event is received during this session.
  useEffect(() => {
    const handler = () => fireTrigger('defense_simulator', 'Defense Simulator')
    document.addEventListener('fypro:defense-session-saved', handler)
    return () => document.removeEventListener('fypro:defense-session-saved', handler)
  }, [fireTrigger])

  // Trigger 2 — Steps milestone (secondary)
  // Fires when stepsCompleted count transitions from <3 to >=3 during this session.
  // prevCountRef tracks the previous value so we only fire on the transition, not on mount.
  useEffect(() => {
    const count = stepsCompleted.filter(Boolean).length
    const prev  = prevCountRef.current
    prevCountRef.current = count
    if (prev < 3 && count >= 3) {
      fireTrigger('steps_milestone', 'FYPro Workflow')
    }
  }, [stepsCompleted, fireTrigger])
}
```

- [ ] **Step 2: Verify typecheck passes**

```bash
npm run typecheck
```

Expected: no errors in `useRatingTrigger.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRatingTrigger.ts
git commit -m "feat(ratings): add useRatingTrigger hook"
```

---

## Task 6: `RatingModal` Component

**Files:**
- Create: `src/components/rating/RatingModal.jsx`

**Interfaces:**
- Consumes: `prompt: RatingPrompt` (show, triggerType, feature); `onClose: () => void`
- Produces: renders two-step overlay modal; calls `POST /api/admin?action=submit-rating`; sets `fypro_rating_done` in localStorage on dismiss/submit

- [ ] **Step 1: Create the component**

```jsx
// src/components/rating/RatingModal.jsx
import { useState } from 'react'
import { supabase } from '../../lib/supabase'

const STAR_LABELS = {
  1: '1 out of 5 — Poor',
  2: '2 out of 5 — Fair',
  3: '3 out of 5 — Good',
  4: '4 out of 5 — Very good',
  5: '5 out of 5 — Excellent',
}

const TITLES = {
  defense_simulator: 'How was your Defense Simulator experience?',
  steps_milestone:   "How's FYPro working for you so far?",
}

const LS_KEY = 'fypro_rating_done'

export default function RatingModal({ prompt, onClose }) {
  const { show, triggerType, feature } = prompt

  const [section, setSection]             = useState('rating')
  const [hoveredStar, setHoveredStar]     = useState(0)
  const [selectedStars, setSelectedStars] = useState(null)
  const [suggFeature, setSuggFeature]     = useState('')
  const [suggUi, setSuggUi]               = useState('')
  const [submitting, setSubmitting]       = useState(false)
  const [error, setError]                 = useState('')

  if (!show) return null

  function handleSkipRating() {
    localStorage.setItem(LS_KEY, '1')
    onClose()
  }

  async function submitRating(suggestionFeature, suggestionUi) {
    setSubmitting(true)
    setError('')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Not authenticated')
      const res = await fetch('/api/admin?action=submit-rating', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          stars:              selectedStars,
          trigger_type:       triggerType,
          feature,
          suggestion_feature: suggestionFeature || null,
          suggestion_ui:      suggestionUi || null,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error || 'Failed to submit')
      }
      localStorage.setItem(LS_KEY, '1')
      setSection('thankyou')
    } catch (err) {
      setError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const fillCount = hoveredStar || selectedStars || 0

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Rate your FYPro experience"
      style={{
        position:   'fixed', inset: 0,
        background: 'rgba(6,14,24,0.72)',
        display:    'flex', alignItems: 'center', justifyContent: 'center',
        zIndex:     9999, padding: '24px 16px',
      }}
    >
      <div style={{
        background:   '#FFFFFF',
        borderRadius: 'var(--radius-lg)',
        width:        '100%', maxWidth: 420,
        boxShadow:    'var(--shadow-card-hover)',
        overflow:     'hidden',
        fontFamily:   "'Poppins', sans-serif",
      }}>

        {/* ── STEP 1: RATING ──────────────────────────────────── */}
        {section === 'rating' && (
          <>
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{
                fontFamily:    "'JetBrains Mono', monospace",
                fontSize:      '0.65rem', fontWeight: 600,
                color:         'var(--color-blue-primary)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom:  6,
              }}>
                Quick Feedback
              </div>
              <h2 style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize:   '1.125rem', fontWeight: 400,
                color:      'var(--color-text-primary)',
                margin:     0, lineHeight: 1.35,
              }}>
                {TITLES[triggerType] || 'How are you finding FYPro?'}
              </h2>

              {/* Step dots */}
              <div style={{ display: 'flex', gap: 5, margin: '14px 0 0', justifyContent: 'center' }}>
                <div style={{ width: 18, height: 6, borderRadius: 3, background: 'var(--color-blue-primary)' }} />
                <div style={{ width: 6,  height: 6, borderRadius: '50%', background: 'rgba(13,27,42,0.15)' }} />
              </div>

              {/* Stars */}
              <div
                style={{ display: 'flex', gap: 6, margin: '16px 0 6px', justifyContent: 'center' }}
                onMouseLeave={() => setHoveredStar(0)}
                aria-label="Star rating"
              >
                {[1, 2, 3, 4, 5].map(n => (
                  <button
                    key={n}
                    aria-label={`${n} star${n !== 1 ? 's' : ''}`}
                    onClick={() => setSelectedStars(n)}
                    onMouseEnter={() => setHoveredStar(n)}
                    style={{
                      background: 'none', border: 'none', padding: 2, cursor: 'pointer',
                      fontSize: '2rem', lineHeight: 1,
                      color: n <= fillCount ? '#F59E0B' : 'rgba(13,27,42,0.15)',
                      transition: 'color var(--transition-fast)',
                    }}
                  >
                    ★
                  </button>
                ))}
              </div>
              <p style={{
                textAlign: 'center', fontSize: '0.75rem',
                color:     'var(--color-text-muted)', marginBottom: 20,
                minHeight: '1.2em',
              }}>
                {selectedStars ? STAR_LABELS[selectedStars] : 'Tap a star to rate'}
              </p>
            </div>

            <div style={{
              display:       'flex', alignItems: 'center', justifyContent: 'space-between',
              padding:       '14px 24px',
              borderTop:     '1px solid var(--color-border)',
              background:    '#FAFBFC',
            }}>
              <button onClick={handleSkipRating} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.8125rem', color: 'var(--color-text-muted)',
                fontFamily: "'Poppins', sans-serif",
              }}>
                Skip
              </button>
              <button
                onClick={() => setSection('suggestion')}
                disabled={!selectedStars}
                style={{
                  background:    selectedStars ? 'var(--color-blue-primary)' : 'rgba(13,27,42,0.1)',
                  color:         selectedStars ? '#fff' : 'var(--color-text-muted)',
                  border:        'none', borderRadius: 'var(--radius-sm)',
                  padding:       '9px 20px',
                  fontFamily:    "'Poppins', sans-serif",
                  fontSize:      '0.8125rem', fontWeight: 600,
                  cursor:        selectedStars ? 'pointer' : 'not-allowed',
                  transition:    'background var(--transition-fast)',
                }}
              >
                Next →
              </button>
            </div>
          </>
        )}

        {/* ── STEP 2: SUGGESTION ──────────────────────────────── */}
        {section === 'suggestion' && (
          <>
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{
                fontFamily:    "'JetBrains Mono', monospace",
                fontSize:      '0.65rem', fontWeight: 600,
                color:         'var(--color-blue-primary)',
                textTransform: 'uppercase', letterSpacing: '0.1em',
                marginBottom:  6,
              }}>
                Quick Feedback · Step 2
              </div>
              <h2 style={{
                fontFamily: "'DM Serif Display', serif",
                fontSize:   '1.125rem', fontWeight: 400,
                color:      'var(--color-text-primary)',
                margin:     0,
              }}>
                Any suggestions? <span style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem', fontFamily: "'Poppins',sans-serif" }}>(Optional)</span>
              </h2>

              {/* Step dots */}
              <div style={{ display: 'flex', gap: 5, margin: '14px 0 16px', justifyContent: 'center' }}>
                <div style={{ width: 6,  height: 6, borderRadius: '50%', background: 'rgba(13,27,42,0.15)' }} />
                <div style={{ width: 18, height: 6, borderRadius: 3,     background: 'var(--color-blue-primary)' }} />
              </div>

              {/* Field 1 */}
              <label style={{ display: 'block', marginBottom: 12 }}>
                <div style={{
                  fontSize:      '0.6875rem', fontWeight: 600,
                  color:         'var(--color-text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom:  5,
                }}>
                  What feature would make FYPro more useful for your final year project?
                </div>
                <textarea
                  value={suggFeature}
                  onChange={e => setSuggFeature(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. A way to export my chapter outline to PDF…"
                  rows={3}
                  style={{
                    width: '100%', resize: 'none',
                    background: 'var(--color-bg-surface)',
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '9px 12px',
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: '0.8125rem', color: 'var(--color-text-primary)',
                    lineHeight: 1.5,
                  }}
                />
              </label>

              {/* Field 2 */}
              <label style={{ display: 'block', marginBottom: 4 }}>
                <div style={{
                  fontSize:      '0.6875rem', fontWeight: 600,
                  color:         'var(--color-text-muted)',
                  textTransform: 'uppercase', letterSpacing: '0.05em',
                  marginBottom:  5,
                }}>
                  Anything about the interface you'd like us to improve?
                </div>
                <textarea
                  value={suggUi}
                  onChange={e => setSuggUi(e.target.value)}
                  maxLength={500}
                  placeholder="e.g. The sidebar feels cramped on my laptop…"
                  rows={3}
                  style={{
                    width: '100%', resize: 'none',
                    background: 'var(--color-bg-surface)',
                    border: '1.5px solid var(--color-border)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '9px 12px',
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: '0.8125rem', color: 'var(--color-text-primary)',
                    lineHeight: 1.5,
                  }}
                />
              </label>

              {error && (
                <p style={{ fontSize: '0.75rem', color: 'var(--color-red)', margin: '8px 0 0' }}>{error}</p>
              )}
            </div>

            <div style={{
              display:       'flex', alignItems: 'center', justifyContent: 'space-between',
              padding:       '14px 24px',
              borderTop:     '1px solid var(--color-border)',
              background:    '#FAFBFC',
              marginTop:     16,
            }}>
              <button
                onClick={() => submitRating(null, null)}
                disabled={submitting}
                style={{
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.8125rem', color: 'var(--color-text-muted)',
                  fontFamily: "'Poppins', sans-serif",
                }}
              >
                Skip
              </button>
              <button
                onClick={() => submitRating(suggFeature.trim() || null, suggUi.trim() || null)}
                disabled={submitting}
                style={{
                  background:  submitting ? 'rgba(22,163,74,0.6)' : 'var(--color-green)',
                  color:       '#fff', border: 'none',
                  borderRadius: 'var(--radius-sm)',
                  padding:     '9px 20px',
                  fontFamily:  "'Poppins', sans-serif",
                  fontSize:    '0.8125rem', fontWeight: 600,
                  cursor:      submitting ? 'not-allowed' : 'pointer',
                  transition:  'background var(--transition-fast)',
                }}
              >
                {submitting ? 'Submitting…' : 'Submit feedback'}
              </button>
            </div>
          </>
        )}

        {/* ── THANK YOU STATE ──────────────────────────────────── */}
        {section === 'thankyou' && (
          <div style={{ padding: '32px 24px', textAlign: 'center' }}>
            <div style={{ fontSize: '2.5rem', marginBottom: 10 }} role="img" aria-label="Graduation cap">🎓</div>
            <h2 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize:   '1.375rem', fontWeight: 400,
              color:      'var(--color-text-primary)', margin: '0 0 8px',
            }}>
              Thank you!
            </h2>
            <p style={{
              fontSize:    '0.875rem', color: 'var(--color-text-secondary)',
              lineHeight:  1.6, margin: '0 0 24px',
            }}>
              Your feedback helps us make FYPro better for every Nigerian student.
              Now back to crushing your defense.
            </p>
            <button
              onClick={onClose}
              style={{
                background:   'var(--color-blue-primary)',
                color:        '#fff', border: 'none',
                borderRadius: 'var(--radius-sm)',
                padding:      '11px 28px', width: '100%',
                fontFamily:   "'Poppins', sans-serif",
                fontSize:     '0.9375rem', fontWeight: 600,
                cursor:       'pointer',
              }}
            >
              Resume my work →
            </button>
          </div>
        )}

      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/rating/RatingModal.jsx
git commit -m "feat(ratings): add RatingModal two-step component"
```

---

## Task 7: Wire Up in AppShell.jsx

**Files:**
- Modify: `src/features/shell/AppShell.jsx`

**Interfaces:**
- Consumes: `useRatingTrigger` hook (Task 5); `RatingModal` component (Task 6)
- Consumes: `state.stepsCompleted` from `useApp()`

- [ ] **Step 1: Add imports at top of AppShell.jsx**

Add after the existing imports:

```javascript
import RatingModal from '../../components/rating/RatingModal'
import { useRatingTrigger } from '../../hooks/useRatingTrigger'
```

- [ ] **Step 2: Add `ratingPrompt` state**

Inside the `AppShell` function, after the `showSupervisorEmail` state declaration (around line 150):

```javascript
const [ratingPrompt, setRatingPrompt] = useState({
  show: false, triggerType: 'defense_simulator', feature: '',
})
```

- [ ] **Step 3: Call the hook**

After the `ratingPrompt` state, add:

```javascript
useRatingTrigger(state.stepsCompleted, setRatingPrompt)
```

- [ ] **Step 4: Mount `<RatingModal>` in the render**

Find the closing `</div>` of the `id="app-shell"` wrapper at the very bottom of the JSX. Add `<RatingModal>` just before it, after the `AnonymousMigrationModal` `AnimatePresence` block and the `PaidFeatureGate` (if any), at the same level as the main `<div style={{ display: 'flex', flex: 1 }}>`:

```jsx
      {/* ── Rating modal ──────────────────────────────────────────────────── */}
      <RatingModal
        prompt={ratingPrompt}
        onClose={() => setRatingPrompt(p => ({ ...p, show: false }))}
      />

    </div>  {/* end #app-shell */}
```

- [ ] **Step 5: Verify typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add src/features/shell/AppShell.jsx
git commit -m "feat(ratings): wire RatingModal and useRatingTrigger into AppShell"
```

---

## Task 8: Admin Dashboard Ratings Tab

**Files:**
- Create: `src/pages/admin/widgets/RatingsWidget.jsx`
- Modify: `src/pages/admin/Health.jsx`

**Interfaces:**
- Consumes: `{ stats, recent, loading, error }` props from Health.jsx
- `stats` shape: `{ avg_stars, total, with_suggestions, this_week, by_trigger, distribution }`
- `recent` shape: array of `{ user_email, stars, trigger_type, suggestion_feature, suggestion_ui, created_at }`

- [ ] **Step 1: Create `RatingsWidget.jsx`**

```jsx
// src/pages/admin/widgets/RatingsWidget.jsx

const BG     = '#060E18'
const CARD   = '#0F2235'
const BORDER = 'rgba(255,255,255,0.08)'
const WHITE  = '#FFFFFF'
const DIM    = 'rgba(255,255,255,0.7)'
const MUTED  = 'rgba(255,255,255,0.4)'
const BLUE   = '#0066FF'
const GREEN  = '#16A34A'
const AMBER  = '#F59E0B'
const RED    = '#DC2626'

function timeAgo(iso) {
  if (!iso) return '—'
  const ms = Date.now() - new Date(iso).getTime()
  const m  = Math.floor(ms / 60000)
  if (m < 60)  return `${m}m ago`
  const h  = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  return `${Math.floor(h / 24)}d ago`
}

function starStr(n) {
  const v = Math.round(n || 0)
  return '★'.repeat(v) + '☆'.repeat(5 - v)
}

function barColor(star) {
  if (star >= 4) return GREEN
  if (star >= 3) return AMBER
  return RED
}

function StatCard({ label, value, sub }) {
  return (
    <div style={{
      background: CARD, border: `1px solid ${BORDER}`,
      borderRadius: 12, padding: 16, flex: '1 1 0', minWidth: 0,
    }}>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 9, fontWeight: 600,
        color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em',
        marginBottom: 8,
      }}>{label}</div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 26, fontWeight: 600, color: WHITE, lineHeight: 1, marginBottom: 4,
      }}>{value}</div>
      {sub && <div style={{ fontSize: 10, color: MUTED }}>{sub}</div>}
    </div>
  )
}

export default function RatingsWidget({ stats, recent, loading, error }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 24 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{ height: 48, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div style={{
        background: 'rgba(220,38,38,0.1)', border: '1px solid rgba(220,38,38,0.25)',
        borderRadius: 10, padding: '12px 16px', marginTop: 24,
        fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: '#F87171',
      }}>
        Ratings — {error}
      </div>
    )
  }

  if (!stats) return null

  const dist = stats.distribution || {}
  const maxDist = Math.max(...Object.values(dist), 1)

  const ds = stats.by_trigger?.defense_simulator
  const sm = stats.by_trigger?.steps_milestone

  return (
    <div style={{ marginTop: 24 }}>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
        <StatCard
          label="Avg Rating"
          value={stats.avg_stars?.toFixed(1) || '—'}
          sub={stats.avg_stars ? `${starStr(stats.avg_stars)} out of 5` : 'No ratings yet'}
        />
        <StatCard label="Total Ratings"   value={stats.total || 0}             sub="all time" />
        <StatCard
          label="With Suggestions"
          value={stats.with_suggestions || 0}
          sub={stats.total ? `${Math.round(((stats.with_suggestions||0)/stats.total)*100)}% response rate` : ''}
        />
        <StatCard label="This Week"       value={stats.this_week || 0}         sub="last 7 days" />
      </div>

      {/* Breakdown row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>

        {/* Star distribution */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: MUTED,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12,
          }}>Star Distribution</div>
          {[5,4,3,2,1].map(star => (
            <div key={star} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, color: MUTED, width: 14, textAlign: 'right',
              }}>{star}</span>
              <div style={{ flex: 1, height: 5, background: 'rgba(255,255,255,0.07)', borderRadius: 999 }}>
                <div style={{
                  height: 5, borderRadius: 999,
                  width: `${((dist[String(star)] || 0) / maxDist) * 100}%`,
                  background: barColor(star),
                  transition: 'width 0.4s ease',
                }} />
              </div>
              <span style={{
                fontFamily: "'JetBrains Mono', monospace",
                fontSize: 10, color: MUTED, width: 20,
              }}>{dist[String(star)] || 0}</span>
            </div>
          ))}
        </div>

        {/* By trigger */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 16 }}>
          <div style={{
            fontSize: 11, fontWeight: 600, color: MUTED,
            textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 12,
          }}>By Trigger</div>
          {[
            { emoji: '🎓', label: 'Defense Simulator', data: ds },
            { emoji: '📋', label: 'Steps Milestone',   data: sm },
          ].map(({ emoji, label, data }) => (
            <div key={label} style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(255,255,255,0.04)', border: `1px solid ${BORDER}`,
              borderRadius: 8, padding: '10px 12px', marginBottom: 8,
            }}>
              <span>{emoji}</span>
              <span style={{ fontSize: 12, color: DIM, flex: 1 }}>{label}</span>
              {data ? (
                <>
                  <span style={{ color: AMBER, fontSize: 11 }}>★ {data.avg}</span>
                  <span style={{
                    fontFamily: "'JetBrains Mono', monospace",
                    fontSize: 10, color: MUTED, marginLeft: 6,
                  }}>{data.count}</span>
                </>
              ) : (
                <span style={{ fontSize: 11, color: MUTED }}>—</span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent submissions */}
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, overflow: 'hidden' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '14px 18px', borderBottom: `1px solid ${BORDER}`,
        }}>
          <span style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: 15, color: WHITE,
          }}>Recent Submissions</span>
          <span style={{
            fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: MUTED,
            background: 'rgba(255,255,255,0.05)', border: `1px solid rgba(255,255,255,0.08)`,
            borderRadius: 999, padding: '2px 10px',
          }}>last 20</span>
        </div>

        {(!recent || recent.length === 0) ? (
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED, padding: '16px 18px', margin: 0 }}>
            No ratings yet.
          </p>
        ) : recent.map((row, i) => {
          const initials = (row.user_email || '—').slice(0, 2).toUpperCase()
          return (
            <div key={row.id || i} style={{ padding: '14px 18px', borderBottom: i < recent.length - 1 ? `1px solid rgba(255,255,255,0.04)` : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <div style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: 'linear-gradient(135deg, #0066FF 0%, #3B82F6 100%)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, fontWeight: 600, color: WHITE, flexShrink: 0,
                }}>{initials}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 500, color: WHITE, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {row.user_email || '—'}
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace", fontSize: 9, color: BLUE,
                      background: 'rgba(0,102,255,0.1)', border: '1px solid rgba(0,102,255,0.2)',
                      borderRadius: 4, padding: '2px 6px', marginLeft: 8,
                    }}>{row.trigger_type}</span>
                  </div>
                  <div style={{ fontSize: 10, color: MUTED }}>{timeAgo(row.created_at)}</div>
                </div>
                <div style={{ color: AMBER, fontSize: 13, flexShrink: 0 }}>
                  {'★'.repeat(row.stars)}{'☆'.repeat(5 - row.stars)}
                </div>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                {[
                  { label: 'Feature request', text: row.suggestion_feature },
                  { label: 'UI feedback',     text: row.suggestion_ui },
                ].map(({ label, text }) => (
                  <div key={label} style={{
                    background: 'rgba(255,255,255,0.03)', borderRadius: 7,
                    padding: '8px 10px', borderLeft: `2px solid rgba(255,255,255,0.08)`,
                  }}>
                    <div style={{
                      fontSize: 9, fontWeight: 600, color: MUTED,
                      textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 3,
                    }}>{label}</div>
                    {text ? (
                      <div style={{ fontSize: 11, color: DIM, lineHeight: 1.4 }}>"{text}"</div>
                    ) : (
                      <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.2)', fontStyle: 'italic' }}>No response</div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Import `RatingsWidget` in Health.jsx**

At the top of Health.jsx, add alongside the existing widget import:

```javascript
import RatingsWidget from './widgets/RatingsWidget'
```

- [ ] **Step 3: Add ratings state to Health.jsx**

Find where `reports` and `reportsLoading` are declared (around line 632). Add after them:

```javascript
  const [ratingsData, setRatingsData]       = useState(null)
  const [ratingsLoading, setRatingsLoading] = useState(false)
  const [ratingsError, setRatingsError]     = useState(null)
```

- [ ] **Step 4: Add `loadRatings` callback to Health.jsx**

Add after `loadReports` (around line 746):

```javascript
  const loadRatings = useCallback(async () => {
    if (!session?.access_token) return
    setRatingsLoading(true)
    setRatingsError(null)
    try {
      const res = await fetch('/api/admin?action=get-ratings', {
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = await res.json()
      setRatingsData(data)
    } catch (err) {
      console.error('[Health/loadRatings]', err)
      setRatingsError(err.message || 'Failed to load')
    } finally {
      setRatingsLoading(false)
    }
  }, [session?.access_token])
```

- [ ] **Step 5: Add the initial load effect for ratings**

After the existing `useEffect` that calls `loadReports()` on mount (around line 999), add:

```javascript
  useEffect(() => {
    if (!isAdmin || !session) return
    loadRatings()
  }, [isAdmin, session, loadRatings])
```

- [ ] **Step 6: Add `ratings` to the TABS array**

Find the TABS array (around line 1606). Add after the `reports` entry:

```javascript
    { id: 'ratings', label: '⭐ Ratings' },
```

- [ ] **Step 7: Add ratings to the `handleTabChange` function**

Find `handleTabChange` (around line 1655). Add after the `reports` branch:

```javascript
    else if (id === 'ratings') loadRatings()
```

- [ ] **Step 8: Add the Ratings tab panel to the render**

In the JSX, find where the Reports tab content is rendered (it's inside a conditional like `{activeTab === 'reports' && ...}`). Add after it:

```jsx
          {activeTab === 'ratings' && (
            <RatingsWidget
              stats={ratingsData?.stats}
              recent={ratingsData?.recent}
              loading={ratingsLoading}
              error={ratingsError}
            />
          )}
```

- [ ] **Step 9: Commit**

```bash
git add src/pages/admin/widgets/RatingsWidget.jsx src/pages/admin/Health.jsx
git commit -m "feat(ratings): add Ratings tab to Mission Control admin dashboard"
```

---

## Manual Test Checklist

After all tasks are complete, verify in the browser:

**Rating modal trigger — steps milestone:**
- [ ] Complete 3 workflow steps in a fresh session (clear `fypro_rating_done` from localStorage first)
- [ ] Rating modal appears after the 3rd step completes
- [ ] Step 1 shows the correct title: "How's FYPro working for you so far?"
- [ ] Stars are interactive (hover fills left-to-right, click selects)
- [ ] "Next →" is disabled until a star is selected
- [ ] Clicking "Next →" moves to step 2 (suggestion fields)
- [ ] Submitting goes to thank you state, then "Resume my work →" closes the modal
- [ ] `fypro_rating_done` is set in localStorage after submit
- [ ] Re-triggering (another step complete) does NOT show the modal again

**Rating modal trigger — defense simulator:**
- [ ] Complete a Defense Simulator session
- [ ] Modal appears with title "How was your Defense Simulator experience?"
- [ ] "Skip" on step 1 closes the modal and sets `fypro_rating_done` without making an API call
- [ ] "Skip" on step 2 submits stars only (text fields null) then shows thank you

**API:**
- [ ] Check Supabase → `user_ratings` table → row inserted with correct data
- [ ] Telegram alert received: `⭐ New Rating` with correct user, stars, feature, and text fields

**Telegram `/ratings` command:**
- [ ] Send `/ratings` in Telegram → receives summary + recent submissions in correct format

**Admin dashboard:**
- [ ] Open `/admin/health` → "⭐ Ratings" tab visible
- [ ] Tab shows stats bar, star distribution, by-trigger breakdown, and recent submissions table
- [ ] "No ratings yet" shows when table is empty
