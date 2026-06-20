# Rating Modal — Design Spec
_Date: 2026-06-20_

## Overview

A proactive rating modal that appears once per user after they reach a key milestone. Collects a contextual 1–5 star rating, an optional feature request, and an optional UI improvement suggestion. Results surface in the Telegram bot via `/ratings` and in a new Ratings tab on the admin dashboard (`/admin/health`).

---

## Decisions Made

| Question | Decision |
|---|---|
| Trigger | Primary: first Defense Simulator session completed. Secondary: 3 workflow steps completed |
| Frequency | Once ever per user |
| Star rating | Contextual — rates the specific feature/trigger that fired the modal |
| Text fields | Two: feature request + UI feedback, both optional |
| Layout | Two-step light modal (stars first → text fields second) |
| Admin | New "Ratings" tab in Mission Control |
| Telegram | `/ratings` command — summary stats + last 5 submissions |

---

## 1. Database

**New table: `user_ratings`** — migration `0034_user_ratings.sql`

```sql
CREATE TABLE public.user_ratings (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  stars             smallint    NOT NULL CHECK (stars BETWEEN 1 AND 5),
  trigger_type      text        NOT NULL CHECK (trigger_type IN ('defense_simulator', 'steps_milestone')),
  feature           text        NOT NULL,
  suggestion_feature text,
  suggestion_ui      text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_ratings_user_idx    ON public.user_ratings(user_id);
CREATE INDEX user_ratings_created_idx ON public.user_ratings(created_at DESC);

ALTER TABLE public.user_ratings ENABLE ROW LEVEL SECURITY;

-- Users INSERT own row only
CREATE POLICY "user inserts own rating"
  ON public.user_ratings FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Users SELECT own row only (for once-ever Supabase check)
CREATE POLICY "user reads own rating"
  ON public.user_ratings FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);
-- No UPDATE or DELETE from client. Admin reads via service_role.
```

**No changes to `feature_feedback`** — thumbs and star ratings remain cleanly separated.

---

## 2. Trigger Hook

**New file: `src/hooks/useRatingTrigger.ts`**

Mounted once in `AppShell.jsx`. Calls `setRatingPrompt` (state owned by AppShell) when a trigger fires.

### Once-ever guard (two layers)
1. `localStorage` key `fypro_rating_done` — instant check, no network round-trip
2. Supabase SELECT from `user_ratings` WHERE `user_id = me` LIMIT 1 — restores state after login on a new device

### Trigger 1 — Defense Simulator (primary)
- Watches `defenseSessions` array length from `AppContext`
- Fires when length transitions from 0 → 1 **during the current session** (useEffect with previous value ref — does NOT fire on initial mount if the user already has sessions)
- `triggerType: 'defense_simulator'`, `feature: 'Defense Simulator'`

### Trigger 2 — Steps milestone (secondary)
- Watches `stepsCompleted` count from `AppContext`
- Fires when count reaches 3 for the first time
- `triggerType: 'steps_milestone'`, `feature: 'FYPro Workflow'`
- Does NOT fire if Trigger 1 already fired (once-ever guard catches it)

### Output
Calls `setRatingPrompt({ show: true, triggerType, feature })`. State lives in `AppShell` and is passed as props to `RatingModal`.

---

## 3. RatingModal Component

**New file: `src/components/rating/RatingModal.jsx`**

Mounted in `AppShell.jsx` at the bottom of the shell, below everything else. Same pattern as `NotificationPanel`.

### State machine
```
'rating' → (stars picked + Next clicked) → 'suggestion' → (Submit / Skip) → 'thankyou' → (Resume clicked) → closed
```

### Step 1 — Rating
- Eyebrow: `QUICK FEEDBACK` (JetBrains Mono, blue, uppercase)
- Title (contextual):
  - defense_simulator: `"How was your Defense Simulator experience?"`
  - steps_milestone: `"How's FYPro working for you so far?"`
- 5 interactive star buttons — hover fills left-to-right, selected state persists
- Star label below: e.g. `"4 out of 5 — Very good"`
- Step indicator dots (● ○)
- `Next →` button (blue) — disabled until a star is selected
- `Skip` text link — marks `fypro_rating_done` in localStorage, closes modal, no insert

### Step 2 — Suggestion
- Step indicator dots (○ ●)
- Both fields clearly labelled **Optional**
- Field 1: "What feature would make FYPro more useful for your final year project?"
- Field 2: "Anything about the interface you'd like us to improve?"
- `Submit feedback` button (green `#16A34A`) — calls `api/admin?action=submit-rating`, then closes
- `Skip` text link — submits stars only (text fields null), then closes

### Thank you state
- 🎓 icon
- Title: "Thank you!"
- Body: "Your feedback helps us make FYPro better for every Nigerian student. Now back to crushing your defense."
- `Resume my work →` button (blue) — closes modal

### Overlay
- `#060E18` at 70% opacity
- Click-outside does nothing — student must consciously dismiss
- `z-index` above sidebar and content, below nothing

### Light/dark mode
Modal card is always white (`#FFFFFF`) — creates visual contrast in both modes. Overlay handles the dark backdrop.

---

## 4. API

Both actions added to existing `api/admin.js` (at the Vercel 12-function limit — no new files).

### `action=submit-rating` (authenticated users)

**Request body:**
```json
{
  "stars": 4,
  "trigger_type": "defense_simulator",
  "feature": "Defense Simulator",
  "suggestion_feature": "Export chapter outline to PDF",
  "suggestion_ui": "Sidebar feels cramped on laptop"
}
```

**Server steps:**
1. Authenticate: extract user from JWT (same pattern as other authed actions in admin.js — rejects with 401 if unauthenticated)
2. Validate with Zod: `stars` 1–5, `trigger_type` enum, `feature` non-empty string, optional text fields (max 500 chars each)
3. Insert into `user_ratings` via `supabaseAdmin` (service role — bypasses RLS for server-side insert)
3. Fire Telegram alert:
   ```
   ⭐ New Rating
   User: Taiwo A. (email)
   Feature: Defense Simulator
   Stars: ★★★★☆ (4/5)
   Feature request: "Export chapter outline to PDF"
   UI feedback: "Sidebar feels cramped on laptop"
   ```
4. Return `{ ok: true }`

**Rate limits:** 3 req/user/day, 10 req/IP/hour (prevents spam without blocking legitimate re-tries on network error)

### `action=get-ratings` (admin only)

Returns:
```json
{
  "stats": {
    "avg_stars": 4.1,
    "total": 47,
    "with_suggestions": 31,
    "this_week": 12,
    "by_trigger": {
      "defense_simulator": { "avg": 4.3, "count": 28 },
      "steps_milestone":   { "avg": 3.8, "count": 19 }
    },
    "distribution": { "5": 26, "4": 14, "3": 5, "2": 2, "1": 0 }
  },
  "recent": [
    {
      "user_name": "Taiwo A.",
      "user_email": "...",
      "stars": 4,
      "trigger_type": "defense_simulator",
      "suggestion_feature": "...",
      "suggestion_ui": "...",
      "created_at": "..."
    }
  ]
}
```

Used by both the admin dashboard Ratings tab and the Telegram `/ratings` handler in `api/notify.js`.

---

## 5. Admin Dashboard — Ratings Tab

**Modified file: `src/pages/admin/Health.jsx`**

New tab `"⭐ Ratings"` added to the Mission Control tab bar alongside Overview, Users, Payments, AI Usage, Reports, Feedback, Errors.

**New widget file: `src/pages/admin/widgets/RatingsWidget.jsx`**

Layout (top to bottom):

1. **Stats bar** — 4 cards: Avg Rating (stars display + number), Total Ratings, With Suggestions (count + %), This Week (count + delta)
2. **Breakdown row** — 2 cards side by side:
   - Star distribution: 5-row bar chart (5★ green, 3–4★ amber, 1–2★ red)
   - By trigger: Defense Simulator vs Steps Milestone, each showing avg + count
3. **Recent submissions table** — last 20 entries, each row shows:
   - Avatar (initials + gradient), name, email, trigger badge, stars, date
   - Two text field blocks below (or "No response" in muted italic if null)

Data fetched from `api/admin?action=get-ratings` on tab mount, same pattern as existing widgets.

---

## 6. Telegram `/ratings` Command

**Modified file: `api/notify.js`**

Adds `/ratings` to the bot command handler alongside existing commands. Calls `get-ratings` internally via `supabaseAdmin` and formats the reply:

```
⭐ Ratings Summary

Avg score:   ★★★★☆  4.1 / 5
Total:       47 ratings
With text:   31 (66%)
This week:   12  ↑4 vs last

By trigger:
🎓 Defense Simulator  — ★4.3  (28)
📋 Steps Milestone    — ★3.8  (19)

── Recent submissions ──

1. Taiwo A. · ★★★★★ · defense_simulator
   💡 "Export chapter outline to PDF"
   🎨 "Sidebar too cramped on laptop"

2. Chioma F. · ★★★★☆ · steps_milestone
   💡 "Grammar check on chapters"
   🎨 —

3. Adebayo O. · ★★★☆☆ · defense_simulator
   💡 —
   🎨 "Dark mode too dark on chapter cards"
```

Also added to the `/help` inline keyboard.

---

## Files Changed

| File | Change |
|---|---|
| `migrations/0034_user_ratings.sql` | New — `user_ratings` table + RLS |
| `src/hooks/useRatingTrigger.ts` | New — trigger hook |
| `src/components/rating/RatingModal.jsx` | New — two-step modal component |
| `src/pages/admin/Health.jsx` | Add Ratings tab + fetch |
| `src/pages/admin/widgets/RatingsWidget.jsx` | New — admin ratings widget |
| `api/admin.js` | Add `submit-rating` + `get-ratings` actions |
| `api/notify.js` | Add `/ratings` command handler |
| `api/_lib/validate.js` | Add Zod schema for submit-rating body |

---

## What This Does NOT Change

- `feature_feedback` table — unchanged, thumbs ratings stay separate
- `FeedbackThumbs` component — unchanged
- `FeatureFeedbackWidget` — unchanged (stays as its own "Feedback" tab)
- Vercel function count — stays at 12 (actions added to existing `admin.js`)
