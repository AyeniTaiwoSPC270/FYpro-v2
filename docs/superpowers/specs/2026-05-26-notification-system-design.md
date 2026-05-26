# Notification System Design

**Date:** 2026-05-26
**Status:** Approved
**Scope:** Dashboard-only notification bell with Supabase-backed persistence

---

## Overview

Add a persistent notification system to FYPro's Dashboard. Users see a bell icon in `DashTopBar` with an unread badge count. Clicking opens a dropdown panel listing recent notifications. Users can mark all as read. Notifications are stored in Supabase and persist across devices and sessions.

---

## Scope

**In scope:**
- `notifications` Supabase table + RLS policies + index
- `useNotifications` hook
- `NotificationPanel` dropdown component
- Bell integration in `DashTopBar` (replacing the current placeholder)
- Server-side notification writes in `auth.js`, `payments.js`, `certificate.js`, `referral.js`
- Client-side notification write on step completion (in each step component)

**Out of scope:**
- Notifications in AppShell (`/app` workflow area) — Dashboard only
- Individual notification deletion
- Supabase Realtime subscription
- Push notifications / email notifications

---

## Notification Types

| Type | `type` value | Title | Trigger |
|---|---|---|---|
| Welcome | `welcome` | "Welcome to FYPro" | New user created in `auth.js` |
| Step completed | `step_completed` | "Step completed" | Frontend, after step result saved |
| Payment confirmed | `payment_confirmed` | "Payment confirmed" | `payments.js` after HMAC + entitlement grant |
| Certificate unlocked | `certificate_unlocked` | "Defense certificate unlocked" | `certificate.js` after cert row created |
| Referral join | `referral_join` | "Referral joined" | `referral.js` when referred user signs up |
| Referral credit | `referral_credit` | "Referral credit earned" | `referral.js` when referred user pays |

---

## Database Schema

```sql
CREATE TABLE notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type       text NOT NULL,
  title      text NOT NULL,
  message    text NOT NULL,
  read       boolean DEFAULT false NOT NULL,
  metadata   jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX ON notifications(user_id, created_at DESC);
```

**Metadata examples:**
- `certificate_unlocked`: `{ "certificate_number": "FYP-2026-003421", "score": 8 }`
- `step_completed`: `{ "step_name": "chapter_architect", "step_index": 1 }`
- `payment_confirmed`: `{ "tier": "defense_pack", "amount_ngn": 3500 }`
- `referral_join` / `referral_credit`: `{ "referred_name": "Temi" }`

### RLS Policies

```sql
-- Users read own rows
CREATE POLICY "users_read_own_notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

-- Users insert own rows (for step_completed)
CREATE POLICY "users_insert_own_notifications"
  ON notifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

-- Users update own rows (mark all as read)
CREATE POLICY "users_update_own_notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- No client DELETE
```

Service role bypasses all RLS for server-side writes.

---

## Architecture

### `useNotifications.js` — `src/hooks/`

```
useNotifications(userId)
  → { notifications, unreadCount, markAllRead, loading, error, refetch }
```

- Fetches `SELECT * FROM notifications WHERE user_id = $1 ORDER BY created_at DESC LIMIT 50` on mount
- `refetch()` called again when panel opens (bell clicked)
- `markAllRead()` runs `UPDATE notifications SET read = true WHERE user_id = me AND read = false`; optimistically updates local state before the query settles
- Returns `error` so the panel can show a retry state

### `NotificationPanel.jsx` — `src/components/`

Props: `{ notifications, loading, error, unreadCount, onMarkAllRead, onRetry, onClose }`

- Rendered inside `DashTopBar` when `panelOpen === true`
- Positioned `absolute`, right-aligned below the bell button, `z-index: 50`
- Outside-click handler closes the panel (same `useRef` + `mousedown` pattern as the avatar dropdown)
- Framer Motion: fade + slide down on enter, fade + slide up on exit (matches existing dropdown animations in `DashTopBar`)
- States: loading skeleton → notification list → empty state → error state

**Notification item anatomy:**
- Icon (colored background per type)
- Title (bold, white)
- Message (muted, smaller)
- Timestamp (relative, monospace) + unread blue dot (hidden when `read = true`)

**Header:** "Notifications" title + unread count badge + "Mark all read" link (hidden when `unreadCount === 0`)

**Empty state:** Bell icon + "You're all caught up" + "New activity will show up here"

**Error state:** "Couldn't load notifications" + Retry button

**Footer:** "Showing last 50 notifications" (static label)

### `DashTopBar.jsx` — modifications

- Remove `const [notifications] = useState([])`
- Add `const { user } = useUser()` (DashTopBar already manages its own hooks; no prop needed from Dashboard)
- Add `const { notifications, unreadCount, markAllRead, loading, error, refetch } = useNotifications(user?.id)`
- Add `const [panelOpen, setPanelOpen] = useState(false)`
- Bell `onClick`: `setPanelOpen(v => !v); if (!panelOpen) refetch()`
- Render `<NotificationPanel />` inside a `relative` wrapper around the bell button

---

## Server-Side Writes

Each function uses `supabaseAdmin` (service role) to insert into `notifications`. Notification creation is **best-effort** — a failed insert is logged but never blocks the main operation.

### `api/auth.js` — Welcome notification
After new user row inserted in `users`:
```js
// Guard: check no welcome notification exists yet
const { count } = await supabaseAdmin
  .from('notifications')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', userId)
  .eq('type', 'welcome')

if (count === 0) {
  await supabaseAdmin.from('notifications').insert({
    user_id: userId,
    type: 'welcome',
    title: 'Welcome to FYPro',
    message: 'Your research journey starts here. Let\'s go.',
  })
}
```

### `api/payments.js` — Payment confirmed
After entitlement granted:
```js
await supabaseAdmin.from('notifications').insert({
  user_id: userId,
  type: 'payment_confirmed',
  title: 'Payment confirmed',
  message: `${tierLabel} activated on your account.`,
  metadata: { tier, amount_ngn: amountKobo / 100 },
})
```

### `api/certificate.js` — Certificate unlocked
After certificate row created:
```js
await supabaseAdmin.from('notifications').insert({
  user_id: userId,
  type: 'certificate_unlocked',
  title: 'Defense certificate unlocked',
  message: `You scored ${score}/10 — ${certificateNumber} is ready.`,
  metadata: { certificate_number: certificateNumber, score },
})
```

### `api/referral.js` — Referral join + credit
```js
// On referral join (referred user signs up):
await supabaseAdmin.from('notifications').insert({
  user_id: referrerId,
  type: 'referral_join',
  title: 'Referral joined',
  message: `${referredName} signed up using your referral link.`,
  metadata: { referred_name: referredName },
})

// On referral credit (referred user pays):
await supabaseAdmin.from('notifications').insert({
  user_id: referrerId,
  type: 'referral_credit',
  title: 'Referral credit earned',
  message: `${referredName} paid — you've earned 1 defense credit.`,
  metadata: { referred_name: referredName },
})
```

---

## Client-Side Write — Step Completed

Each step component (TopicValidator, ChapterArchitect, etc.) calls a shared helper after saving its result and marking the step complete:

```js
// src/lib/notifications.js — new shared helper
export async function notifyStepCompleted(userId, stepName, stepIndex) {
  const labels = {
    topic_validator:     'Topic Validator',
    chapter_architect:   'Chapter Architect',
    methodology_advisor: 'Methodology Advisor',
    writing_planner:     'Writing Planner',
    project_reviewer:    'Project Reviewer',
    defense_prep:        'Defence Prep',
  }
  const next = labels[Object.keys(labels)[stepIndex + 1]] ?? null
  await supabase.from('notifications').insert({
    user_id: userId,
    type: 'step_completed',
    title: 'Step completed',
    message: next
      ? `${labels[stepName]} done — on to ${next}.`
      : 'All steps complete — you\'re defense ready.',
    metadata: { step_name: stepName, step_index: stepIndex },
  })
}
```

This helper is called best-effort (fire-and-forget) inside each step component after step completion.

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Fetch fails | Panel shows error state with Retry button; bell badge shows nothing |
| Mark all read fails | Toast: "Couldn't update notifications — try again"; unread state preserved |
| Server notification write fails | Log error, do not block main operation (payment/cert still succeeds) |
| Client step-completed write fails | Silent — step completion is the important event |
| Duplicate welcome notification | Guarded by count check in `auth.js` before insert |

---

## Files Created / Modified

| Action | File |
|---|---|
| Create | `src/hooks/useNotifications.js` |
| Create | `src/components/NotificationPanel.jsx` |
| Create | `src/lib/notifications.js` |
| Modify | `src/features/shell/DashTopBar.jsx` |
| Modify | `src/pages/Dashboard.jsx` (pass `user.id` to DashTopBar) |
| Modify | `api/auth.js` |
| Modify | `api/payments.js` |
| Modify | `api/certificate.js` |
| Modify | `api/referral.js` |
| Modify | `src/features/topicValidator/TopicValidator.jsx` |
| Modify | `src/features/chapterArchitect/ChapterArchitect.jsx` |
| Modify | `src/features/methodology/MethodologyAdvisor.jsx` |
| Modify | `src/features/writingPlanner/WritingPlanner.jsx` |
| Modify | `src/features/projectReviewer/ProjectReviewer.jsx` |
| Modify | `src/features/defensePrep/DefensePrep.jsx` |
| Migration | `migrations/0015_notifications.sql` |
