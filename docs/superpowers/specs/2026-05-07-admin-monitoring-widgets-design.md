# Admin Dashboard — Four Monitoring Widgets
**Date:** 2026-05-07  
**Status:** Approved  
**Scope:** Additive — do not rebuild the dashboard, add new sections only.

---

## Overview

Add four monitoring widgets to `src/pages/admin/Health.jsx`. All widgets use the existing dark admin design tokens (BG, CARD, SURFACE, BORDER, GREEN, AMBER, RED, JetBrains Mono). No new dependencies.

---

## New Supabase Tables

### `generation_failures`
Client-writable (INSERT by authenticated users), admin-readable via service role only.

```sql
CREATE TABLE generation_failures (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email    text,
  feature       text NOT NULL,
  error_type    text NOT NULL,   -- 'rate_limit' | 'timeout' | 'generic'
  error_message text,
  input_preview text,
  created_at    timestamptz DEFAULT now(),
  resolved      boolean DEFAULT false
);
ALTER TABLE generation_failures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "insert own failures"
  ON generation_failures FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);
-- No SELECT/UPDATE/DELETE client policies — admin reads via service role
```

### `response_times`
Server-side only. Written by `api/claude.js` via service role. No client access.

```sql
CREATE TABLE response_times (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature     text NOT NULL,
  duration_ms integer NOT NULL,
  created_at  timestamptz DEFAULT now()
);
ALTER TABLE response_times ENABLE ROW LEVEL SECURITY;
-- No policies — service role only
```

---

## Files Modified

| File | Change |
|------|--------|
| `api/claude.js` | Record response time after each successful Anthropic call |
| `api/admin.js` | Add `vitals`, `failures`, `resolve-failure` actions; update `dashboard` |
| `src/services/api.js` | Add `logFailure(feature, err, inputPreview)` utility |
| `src/pages/admin/Health.jsx` | Add 4 widget sections + 2 new refresh intervals |
| `src/features/topicValidator/TopicValidator.jsx` | Call `logFailure` in catch block |
| `src/features/chapterArchitect/ChapterArchitect.jsx` | Call `logFailure` in catch blocks (Chapter Architect + Abstract Generator) |
| `src/features/methodology/MethodologyAdvisor.jsx` | Call `logFailure` in catch blocks (Methodology Advisor + Instrument Builder) |
| `src/features/writingPlanner/WritingPlanner.jsx` | Call `logFailure` in catch block |
| `src/features/projectReviewer/ProjectReviewer.jsx` | Call `logFailure` in catch block |
| `src/features/defensePrep/DefensePrep.jsx` | Call `logFailure` in catch block |
| `src/features/literatureMap/LiteratureMap.jsx` | Call `logFailure` in catch block |
| `src/features/supervisorPrep/SupervisorPrep.jsx` | Call `logFailure` in catch block |

**SQL migration files to create and run in Supabase SQL Editor:**
- `migrations/0003_generation_failures.sql`
- `migrations/0004_response_times.sql`

---

## API Changes

### `api/claude.js`
- Import `supabaseAdmin` from `./_lib/supabase-admin.js`
- Capture `const start = Date.now()` before the Anthropic fetch
- After successful response: fire-and-forget `supabaseAdmin.from('response_times').insert({ feature: prefix, duration_ms: Date.now() - start })`
- Do NOT record on errors (generation_failures covers that path)

### `api/admin.js` — `dashboard` action update
Add to the response:
- `revenue_today_ngn` — sum of `amount_kobo / 100` for payments with `status = 'success'` and `created_at >= todayStart`
- `paying_users_today` — count of distinct `user_id`s in those same payments
- `ngn_per_usd` — `parseFloat(process.env.NGN_PER_USD || '1600')`

Remove the small cache hit card from the overview `OverviewCard` row in `Health.jsx` (it becomes Widget 3).

### `api/admin.js` — new `vitals` action
Admin-gated (same JWT check as `dashboard`). Returns:

```json
{
  "avg_response_ms": 12400,
  "last_call_at": "2026-05-07T14:32:00Z",
  "failures_today": 3,
  "requests_today": 142,
  "active_sessions": 7
}
```

Queries:
- `response_times` ORDER BY `created_at DESC` LIMIT 10 → average `duration_ms`
- `response_times` ORDER BY `created_at DESC` LIMIT 1 → `last_call_at`
- `generation_failures` WHERE `created_at >= todayStart` → `failures_today`
- `daily_usage` WHERE `date = today` → `request_count` for `requests_today`
- `generation_failures` WHERE `created_at > NOW() - INTERVAL '10 minutes'` → `COUNT(DISTINCT user_id)` for `active_sessions`

### `api/admin.js` — new `failures` action
Admin-gated. Returns:

```json
{
  "rows": [...last 20 generation_failures newest-first...],
  "total_today": 5
}
```

### `api/admin.js` — new `resolve-failure` action (POST)
Admin-gated. Body: `{ id: uuid }`. Sets `resolved = true`. Returns `{ ok: true }`.

### `src/services/api.js` — `logFailure`
```javascript
export async function logFailure(feature, err, inputPreview = '') {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    await supabase.from('generation_failures').insert({
      user_id:       session?.user?.id   || null,
      user_email:    session?.user?.email || null,
      feature,
      error_type:    err.code === 'RATE_LIMIT'       ? 'rate_limit'
                   : err.code === 'GATEWAY_TIMEOUT'  ? 'timeout'
                   : 'generic',
      error_message: err.message || 'Unknown error',
      input_preview: String(inputPreview).substring(0, 100),
    })
  } catch {
    // silent — never affect UX
  }
}
```

---

## `Health.jsx` — New State

```javascript
// Vitals — 30s interval
const [vitals, setVitals]               = useState(null)
const [vitalsLoading, setVitalsLoading] = useState(true)
const vitalsTimerRef                    = useRef(null)

// Failures — 60s interval
const [failures, setFailures]               = useState(null)
const [failuresLoading, setFailuresLoading] = useState(true)
const failuresTimerRef                      = useRef(null)
const [resolvingId, setResolvingId]         = useState(null)
```

Both `useEffect` hooks follow the same pattern as the existing `timerRef` effect: load on mount, `setInterval` with cleanup, guard on `isAdmin && session`.

---

## Widget Designs

### Widget 4 — System Vitals (top of page, above overview row)

Four cards in a flex row. Each card:
```css
background: rgba(13,27,42,0.8);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 10px;
padding: 16px;
flex: 1 1 0;
```

Contents per card: coloured dot (12px circle) → label (Poppins 11px MUTED uppercase) → value (JetBrains Mono 20px WHITE).

**AI Engine** — dot GREEN if `last_call_at` within 5 minutes, RED otherwise. Value: "Operational" / "Degraded".  
**Avg Response** — dot GREEN < 15,000ms, AMBER 15,000–30,000ms, RED > 30,000ms or no data. Value: `Xs` (seconds, 1 decimal).  
**Error Rate** — dot GREEN < 2%, AMBER 2–5%, RED > 5%. Value: `X.X%`.  
**Active Now** — always BLUE dot. Value: count as integer.

Red dot gets `animation: pulse 1.5s ease-in-out infinite` keyframe (scale 1 → 1.3 → 1, opacity 1 → 0.6 → 1).

Skeleton: four grey placeholder cards (same dimensions, `background: rgba(255,255,255,0.05)`) while `vitalsLoading`.

### Widget 1 — Unit Economics (new card below overview row)

Single card (`background: CARD, borderTop: 3px solid AMBER`). Label: `UNIT ECONOMICS — TODAY` (Poppins 11px MUTED uppercase). Three stats side by side:

| Stat | Value | Colour rule |
|------|-------|-------------|
| Cost Per User | `(spent_usd × ngn_per_usd) / active_today` | GREEN < ₦200, AMBER ₦200–400, RED > ₦400 |
| Revenue Per User | `revenue_today_ngn / paying_users_today` | Always WHITE |
| Profit Margin Per User | `((rev_per_user - cost_per_user) / rev_per_user) × 100` | GREEN > 60%, AMBER 30–60%, RED < 30% |

All values in JetBrains Mono 26px. Guard for division-by-zero: show `—` when denominator is 0.

### Widget 3 — Cache Performance (new card below Unit Economics)

Single card (`borderTop: 3px solid BLUE`). Label: `CACHE PERFORMANCE`.

- Large stat: `XX%` hit rate (JetBrains Mono 32px). GREEN > 25%, AMBER 10–25%, RED < 10%.
- Two smaller stats side by side: `X cached today` (GREEN) · `X fresh calls today` (AMBER).
- Below: `Est. savings today: ₦XXX` — calculated as `hits_total × (spent_usd / Math.max(1, request_count - hits_total)) × ngn_per_usd`.

`cache_hit_rate` is already in the dashboard response. `request_count` comes from `daily_spend.request_count`. Remove the small cache `OverviewCard` from the overview row.

### Widget 2 — Failed Generation Log (new section below Cache Performance)

Section heading: `Failed Generations` with today's failure count badge — RED if > 0, GREEN if 0.

Table (last 20 failures, newest first, auto-refresh 60s):

| Column | Content |
|--------|---------|
| Time | Relative ("3 mins ago") using `Date.now() - new Date(created_at)` |
| Feature | `feature` text |
| Error | `error_type` badge |
| User | `user_email` truncated to 20 chars |
| Input Preview | First 50 chars of `input_preview`, MUTED colour |
| Action | "Mark Resolved" button (disabled + grey when `resolved`) |

Row styling: `borderLeft: resolved ? 'none' : '3px solid RED'`. Resolved rows: `opacity: 0.4`.

"Mark Resolved" calls `POST /api/admin?action=resolve-failure` with `{ id }`. Sets `resolvingId` while pending, optimistically updates the row on success.

Skeleton: five placeholder rows (`height: 44px, background: rgba(255,255,255,0.04)`) while `failuresLoading`.

---

## Render Order in `Health.jsx`

1. Header *(existing)*
2. Widget 4 — System Vitals *(new)*
3. Overview Cards row *(existing — cache OverviewCard removed)*
4. Widget 1 — Unit Economics *(new)*
5. Widget 3 — Cache Performance *(new)*
6. User Table *(existing)*
7. Most Active Today *(existing)*
8. Widget 2 — Failed Generation Log *(new)*
9. Charts, Feature Usage, Funnel, Never Converted *(existing)*

---

## Security Rules

- `generation_failures`: client INSERT allowed (authenticated users, own user_id or null). No client SELECT.
- `response_times`: no client policies at all. Service role only.
- Both admin actions (`vitals`, `failures`, `resolve-failure`) go through the existing `verifyAdmin` JWT gate.
- `logFailure` uses the anon-key client — the INSERT RLS policy is the enforcement layer.
- `SUPABASE_SERVICE_ROLE_KEY` stays server-side only. Not touched in any frontend file.

---

## Out of Scope

- No changes to `vercel.json`
- No changes to `api/claude.js` beyond timing instrumentation
- No mobile layout changes
- No new npm packages
