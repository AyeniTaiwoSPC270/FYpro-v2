# Notification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Supabase-backed notification system to the Dashboard — bell icon with unread badge, dropdown panel, mark-all-as-read, and 6 notification types triggered by app events.

**Architecture:** Mixed write strategy — server functions (auth, payments, certificate, referral) write notifications via service_role; step components write step_completed notifications via the anon client. `useNotifications` hook fetches on mount and on bell open. `NotificationPanel` renders as a dropdown anchored to the existing bell button in `DashTopBar`.

**Tech Stack:** Supabase (PostgreSQL + RLS), React hooks, Framer Motion (existing), Tailwind (existing), `supabase` anon client (frontend), `supabaseAdmin` service-role (server).

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `migrations/0015_notifications.sql` | Table DDL, RLS policies, index |
| Create | `src/lib/notifications.js` | `notifyStepCompleted()` client-side helper |
| Create | `src/hooks/useNotifications.js` | Fetch, unreadCount, markAllRead, refetch |
| Create | `src/components/NotificationPanel.jsx` | Dropdown UI — all 4 states |
| Modify | `src/features/shell/DashTopBar.jsx` | Replace placeholder, wire panel |
| Modify | `api/auth.js` | Welcome notification on signup |
| Modify | `api/_lib/credit-user.js` | Payment confirmed notification |
| Modify | `api/certificate.js` | Certificate unlocked notification |
| Modify | `api/referral.js` | Referral join + credit notifications |
| Modify | `src/features/topicValidator/TopicValidator.jsx` | Step completed notification |
| Modify | `src/features/chapterArchitect/ChapterArchitect.jsx` | Step completed notification |
| Modify | `src/features/methodology/MethodologyAdvisor.jsx` | Step completed notification |
| Modify | `src/features/writingPlanner/WritingPlanner.jsx` | Step completed notification |
| Modify | `src/features/projectReviewer/ProjectReviewer.jsx` | Step completed notification |
| Modify | `src/features/defensePrep/DefensePrep.jsx` | Step completed notification |

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/0015_notifications.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- migrations/0015_notifications.sql
-- Notification system: persistent, user-scoped notifications

CREATE TABLE IF NOT EXISTS notifications (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  type       text NOT NULL,
  title      text NOT NULL,
  message    text NOT NULL,
  read       boolean DEFAULT false NOT NULL,
  metadata   jsonb DEFAULT '{}',
  created_at timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS notifications_user_created_idx
  ON notifications(user_id, created_at DESC);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_read_own_notifications"
  ON notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "users_insert_own_notifications"
  ON notifications FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "users_update_own_notifications"
  ON notifications FOR UPDATE
  USING (user_id = auth.uid());

-- Verify RLS is on (must return zero rows after running this):
-- SELECT tablename FROM pg_tables
-- WHERE schemaname = 'public' AND rowsecurity = false;
```

- [ ] **Step 2: Apply the migration to Supabase**

Run the SQL above in the Supabase SQL Editor for project `ayvunikgfwpylfrkpalj`.
Or use the MCP tool: `mcp__supabase__apply_migration` with the SQL above.

- [ ] **Step 3: Verify RLS is enabled**

In the Supabase SQL Editor, run:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
```
Expected: zero rows returned.

- [ ] **Step 4: Commit the migration file**

```bash
git add migrations/0015_notifications.sql
git commit -m "feat(db): add notifications table with RLS policies"
```

---

## Task 2: Client-side notifications helper

**Files:**
- Create: `src/lib/notifications.js`

- [ ] **Step 1: Create the file**

```js
// src/lib/notifications.js
import { supabase } from './supabase'

const STEP_LABELS = {
  topic_validator:     'Topic Validator',
  chapter_architect:   'Chapter Architect',
  methodology_advisor: 'Methodology Advisor',
  writing_planner:     'Writing Planner',
  project_reviewer:    'Project Reviewer',
  defense_prep:        'Defence Prep',
}

const STEP_KEYS = Object.keys(STEP_LABELS)

export async function notifyStepCompleted(userId, stepName, stepIndex) {
  if (!userId) return
  const currentLabel = STEP_LABELS[stepName] ?? stepName
  const nextLabel    = STEP_LABELS[STEP_KEYS[stepIndex + 1]] ?? null
  const message = nextLabel
    ? `${currentLabel} done — on to ${nextLabel}.`
    : "All steps complete — you're defense ready."

  await supabase.from('notifications').insert({
    user_id:  userId,
    type:     'step_completed',
    title:    'Step completed',
    message,
    metadata: { step_name: stepName, step_index: stepIndex },
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/notifications.js
git commit -m "feat(notifications): add notifyStepCompleted client helper"
```

---

## Task 3: useNotifications hook

**Files:**
- Create: `src/hooks/useNotifications.js`

- [ ] **Step 1: Create the hook**

```js
// src/hooks/useNotifications.js
import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'
import { showToast } from '../components/Toast'

export function useNotifications(userId) {
  const [notifications, setNotifications] = useState([])
  const [loading, setLoading]             = useState(false)
  const [error, setError]                 = useState(null)

  const fetch = useCallback(async () => {
    if (!userId) return
    setLoading(true)
    setError(null)
    const { data, error: fetchErr } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)
    setLoading(false)
    if (fetchErr) {
      setError(fetchErr.message)
    } else {
      setNotifications(data ?? [])
    }
  }, [userId])

  useEffect(() => {
    fetch()
  }, [fetch])

  const unreadCount = notifications.filter(n => !n.read).length

  const markAllRead = useCallback(async () => {
    if (unreadCount === 0) return
    // Optimistic update
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    const { error: updateErr } = await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', userId)
      .eq('read', false)
    if (updateErr) {
      // Rollback optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, read: false })))
      showToast("Couldn't update notifications — try again")
    }
  }, [userId, unreadCount])

  return { notifications, unreadCount, loading, error, refetch: fetch, markAllRead }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/hooks/useNotifications.js
git commit -m "feat(notifications): add useNotifications hook"
```

---

## Task 4: NotificationPanel component

**Files:**
- Create: `src/components/NotificationPanel.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/NotificationPanel.jsx
import { useRef, useEffect } from 'react'
import { motion } from 'framer-motion'

const TYPE_ICONS = {
  welcome:               '👋',
  step_completed:        '✅',
  payment_confirmed:     '💳',
  certificate_unlocked:  '🏆',
  referral_join:         '🔗',
  referral_credit:       '👥',
}

const TYPE_ICON_BG = {
  welcome:               'rgba(59,130,246,0.15)',
  step_completed:        'rgba(6,182,212,0.15)',
  payment_confirmed:     'rgba(22,163,74,0.15)',
  certificate_unlocked:  'rgba(245,158,11,0.15)',
  referral_join:         'rgba(139,92,246,0.15)',
  referral_credit:       'rgba(139,92,246,0.15)',
}

function relativeTime(dateStr) {
  try {
    const diff = Date.now() - new Date(dateStr).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hrs = Math.floor(mins / 60)
    if (hrs < 24)  return `${hrs}h ago`
    const days = Math.floor(hrs / 24)
    return `${days}d ago`
  } catch { return '' }
}

export default function NotificationPanel({
  notifications,
  loading,
  error,
  unreadCount,
  onMarkAllRead,
  onRetry,
  onClose,
}) {
  const panelRef = useRef(null)

  useEffect(() => {
    function handleOutside(e) {
      if (panelRef.current && !panelRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [onClose])

  return (
    <motion.div
      ref={panelRef}
      initial={{ opacity: 0, y: -6, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -6, scale: 0.97 }}
      transition={{ duration: 0.15, ease: 'easeOut' }}
      style={{
        position: 'absolute',
        top: 'calc(100% + 8px)',
        right: 0,
        width: '320px',
        background: 'var(--bg-card)',
        border: '1px solid rgba(0,102,255,0.2)',
        borderRadius: '14px',
        boxShadow: '0 24px 64px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.04)',
        overflow: 'hidden',
        zIndex: 50,
      }}
    >
      {/* Header */}
      <div style={{
        padding: '14px 16px 12px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        background: 'rgba(0,102,255,0.04)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{
            fontFamily: "'DM Serif Display', serif",
            fontSize: '0.9rem',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}>
            Notifications
          </span>
          {unreadCount > 0 && (
            <span style={{
              background: '#0066FF',
              color: '#fff',
              padding: '1px 7px',
              borderRadius: '999px',
              fontSize: '0.6rem',
              fontWeight: 800,
              fontFamily: "'JetBrains Mono', monospace",
            }}>
              {unreadCount} new
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            onClick={onMarkAllRead}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '0.7rem',
              fontWeight: 500,
              color: '#3B82F6',
              cursor: 'pointer',
              padding: '4px 8px',
              borderRadius: '6px',
              fontFamily: "'Poppins', sans-serif",
            }}
          >
            Mark all read
          </button>
        )}
      </div>

      {/* Body */}
      <div style={{ maxHeight: '360px', overflowY: 'auto' }}>
        {loading && (
          <div style={{ padding: '24px 16px' }}>
            {[1, 2, 3].map(i => (
              <div key={i} style={{
                display: 'flex', gap: '12px', alignItems: 'flex-start',
                marginBottom: i < 3 ? '16px' : 0,
              }}>
                <div style={{
                  width: '32px', height: '32px', borderRadius: '8px',
                  background: 'rgba(255,255,255,0.06)', flexShrink: 0,
                }} />
                <div style={{ flex: 1 }}>
                  <div style={{
                    height: '12px', borderRadius: '4px', marginBottom: '6px',
                    background: 'rgba(255,255,255,0.06)', width: '70%',
                  }} />
                  <div style={{
                    height: '10px', borderRadius: '4px',
                    background: 'rgba(255,255,255,0.04)', width: '90%',
                  }} />
                </div>
              </div>
            ))}
          </div>
        )}

        {!loading && error && (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.4)', marginBottom: '12px' }}>
              Couldn't load notifications
            </div>
            <button
              onClick={onRetry}
              style={{
                background: 'rgba(0,102,255,0.15)',
                border: '1px solid rgba(0,102,255,0.3)',
                borderRadius: '8px',
                padding: '6px 16px',
                fontSize: '0.75rem',
                fontWeight: 600,
                color: '#3B82F6',
                cursor: 'pointer',
                fontFamily: "'Poppins', sans-serif",
              }}
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && notifications.length === 0 && (
          <div style={{ padding: '32px 16px', textAlign: 'center' }}>
            <div style={{ fontSize: '1.8rem', marginBottom: '8px' }}>🔔</div>
            <div style={{
              fontSize: '0.82rem', fontWeight: 600,
              color: 'rgba(255,255,255,0.4)',
              fontFamily: "'Poppins', sans-serif",
            }}>
              You're all caught up
            </div>
            <div style={{
              fontSize: '0.7rem',
              color: 'rgba(255,255,255,0.2)',
              marginTop: '4px',
              fontFamily: "'Poppins', sans-serif",
            }}>
              New activity will show up here
            </div>
          </div>
        )}

        {!loading && !error && notifications.map(n => (
          <div
            key={n.id}
            style={{
              padding: '12px 16px',
              display: 'flex',
              gap: '12px',
              alignItems: 'flex-start',
              borderBottom: '1px solid rgba(255,255,255,0.04)',
              background: n.read ? 'transparent' : 'rgba(0,102,255,0.04)',
            }}
          >
            <div style={{
              width: '32px',
              height: '32px',
              borderRadius: '8px',
              background: TYPE_ICON_BG[n.type] ?? 'rgba(255,255,255,0.08)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '0.9rem',
              flexShrink: 0,
            }}>
              {TYPE_ICONS[n.type] ?? '🔔'}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{
                fontSize: '0.78rem',
                fontWeight: 600,
                color: 'var(--text-primary)',
                lineHeight: 1.3,
                marginBottom: '2px',
                fontFamily: "'Poppins', sans-serif",
              }}>
                {n.title}
              </div>
              <div style={{
                fontSize: '0.7rem',
                color: 'var(--text-secondary)',
                lineHeight: 1.4,
                fontFamily: "'Poppins', sans-serif",
              }}>
                {n.message}
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                {!n.read && (
                  <div style={{
                    width: '6px', height: '6px', borderRadius: '50%',
                    background: '#0066FF', flexShrink: 0,
                  }} />
                )}
                <span style={{
                  fontSize: '0.62rem',
                  color: 'rgba(255,255,255,0.25)',
                  fontFamily: "'JetBrains Mono', monospace",
                }}>
                  {relativeTime(n.created_at)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Footer */}
      {!loading && !error && notifications.length > 0 && (
        <div style={{
          padding: '10px 16px',
          borderTop: '1px solid rgba(255,255,255,0.05)',
          textAlign: 'center',
          background: 'rgba(0,0,0,0.15)',
        }}>
          <span style={{
            fontSize: '0.65rem',
            color: 'rgba(255,255,255,0.2)',
            fontFamily: "'Poppins', sans-serif",
          }}>
            Showing last 50 notifications
          </span>
        </div>
      )}
    </motion.div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/NotificationPanel.jsx
git commit -m "feat(notifications): add NotificationPanel dropdown component"
```

---

## Task 5: Wire DashTopBar

**Files:**
- Modify: `src/features/shell/DashTopBar.jsx`

Current state: `const [notifications] = useState([])` with onClick showing a toast. No real data.

- [ ] **Step 1: Add imports at the top of DashTopBar.jsx**

Add after the existing imports (after line 10 — `import { showToast } from '../../components/Toast'`):

```js
import { useUser } from '../../hooks/useUser'
import { useNotifications } from '../../hooks/useNotifications'
import NotificationPanel from '../../components/NotificationPanel'
// AnimatePresence is already imported from 'framer-motion' on line 3 — do not re-import
```

Note: `AnimatePresence` is already imported from `framer-motion`. Only add the three new imports.

- [ ] **Step 2: Replace the notification placeholder inside the component body**

Find and replace this existing line (line 23):
```js
const [notifications] = useState([])
```

Replace with:
```js
const { user } = useUser()
const { notifications, unreadCount, loading, error, refetch, markAllRead } = useNotifications(user?.id)
const [panelOpen, setPanelOpen] = useState(false)
```

- [ ] **Step 3: Update the bell button and add NotificationPanel**

Find the bell button block (starts with `<motion.button` with `aria-label="Notifications"`). Replace the entire block (from `<motion.button` to its closing `</motion.button>`) with:

```jsx
<div style={{ position: 'relative' }}>
  <motion.button
    whileHover={{ scale: 1.09 }}
    whileTap={{ scale: 0.94 }}
    aria-label="Notifications"
    onClick={() => {
      if (!panelOpen) refetch()
      setPanelOpen(v => !v)
    }}
    className="db-header__icon-btn relative w-[30px] h-[30px] sm:w-[38px] sm:h-[38px] flex items-center justify-center rounded-xl cursor-pointer text-slate-400 hover:text-white transition-all duration-200"
    style={{ background: 'var(--header-btn-bg)', border: '1px solid var(--header-btn-border)' }}
  >
    <BellIcon />
    {unreadCount > 0 && (
      <span
        aria-label={`${unreadCount} unread notifications`}
        className="absolute top-0 right-0 flex items-center justify-center font-bold text-white rounded-full"
        style={{
          width: '16px', height: '16px',
          background: '#DC2626',
          fontSize: '0.55rem',
          fontFamily: "'JetBrains Mono', monospace",
          top: '-4px', right: '-4px',
          border: '2px solid var(--bg-sidebar)',
        }}
      >
        {unreadCount > 9 ? '9+' : unreadCount}
      </span>
    )}
  </motion.button>

  <AnimatePresence>
    {panelOpen && (
      <NotificationPanel
        notifications={notifications}
        loading={loading}
        error={error}
        unreadCount={unreadCount}
        onMarkAllRead={markAllRead}
        onRetry={refetch}
        onClose={() => setPanelOpen(false)}
      />
    )}
  </AnimatePresence>
</div>
```

- [ ] **Step 4: Commit**

```bash
git add src/features/shell/DashTopBar.jsx
git commit -m "feat(notifications): wire bell button and panel in DashTopBar"
```

---

## Task 6: Welcome notification in auth.js

**Files:**
- Modify: `api/auth.js`

Target: `handleSignup` function, after the `success` check and Telegram alert (around line 138).

- [ ] **Step 1: Add welcome notification after the Telegram alert in handleSignup**

Find this block in `handleSignup` (around line 137–147):
```js
if (success) {
  sendTelegramAlert(`👤 New signup: ${email} (free)`);
  // Fire welcome email immediately — don't wait for cron (up to 24h delay)
  if (process.env.CRON_SECRET) {
    fetch(`${APP_URL}/api/send-nurture-email`, {
```

Add the welcome notification **inside the `if (success)` block**, after the `sendTelegramAlert` call:

```js
if (success) {
  sendTelegramAlert(`👤 New signup: ${email} (free)`);

  // Welcome notification — fire-and-forget, best-effort
  supabaseAdmin
    .from('notifications')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .eq('type', 'welcome')
    .then(({ count }) => {
      if (count === 0) {
        return supabaseAdmin.from('notifications').insert({
          user_id: userId,
          type:    'welcome',
          title:   'Welcome to FYPro',
          message: "Your research journey starts here. Let's go.",
        })
      }
    })
    .catch(e => console.error('[auth/signup] welcome notification failed:', e.message));

  // Fire welcome email immediately — don't wait for cron (up to 24h delay)
  if (process.env.CRON_SECRET) {
```

- [ ] **Step 2: Commit**

```bash
git add api/auth.js
git commit -m "feat(notifications): send welcome notification on signup"
```

---

## Task 7: Payment confirmed notification in credit-user.js

**Files:**
- Modify: `api/_lib/credit-user.js`

Target: after `grantEntitlement` is called on line 77, before `return { status: 'success', ... }`.

- [ ] **Step 1: Add the notification after grantEntitlement**

Find this block in `creditUser` (lines 75–79):
```js
  // 7. Grant entitlement
  await grantEntitlement(payment.user_id, payment.tier, payment.amount_kobo);

  return { status: 'success', reference, tier: payment.tier };
```

Replace with:
```js
  // 7. Grant entitlement
  await grantEntitlement(payment.user_id, payment.tier, payment.amount_kobo);

  // 8. Notify user — best-effort
  const TIER_LABELS = {
    student_pack:         'Student Pack',
    defense_pack:         'Defense Pack',
    defense_pack_upgrade: 'Defense Pack',
    project_reset:        'Project Reset',
  };
  const tierLabel = TIER_LABELS[payment.tier] || payment.tier;
  supabaseAdmin
    .from('notifications')
    .insert({
      user_id:  payment.user_id,
      type:     'payment_confirmed',
      title:    'Payment confirmed',
      message:  `${tierLabel} activated on your account.`,
      metadata: { tier: payment.tier, amount_ngn: Math.floor(payment.amount_kobo / 100) },
    })
    .catch(e => console.error('[creditUser] notification insert failed:', e.message));

  return { status: 'success', reference, tier: payment.tier };
```

- [ ] **Step 2: Commit**

```bash
git add api/_lib/credit-user.js
git commit -m "feat(notifications): send payment confirmed notification after entitlement grant"
```

---

## Task 8: Certificate unlocked notification in certificate.js

**Files:**
- Modify: `api/certificate.js`

Target: after `cert = newCert` is assigned and `sendTelegramAlert` fires (around line 334–335).

- [ ] **Step 1: Add notification after certificate is created**

Find this block (around lines 333–336):
```js
    cert = newCert;
    sendTelegramAlert(`🏆 Certificate issued: ${fullName} (${user.email}) scored ${sessionScore}/10\n<code>${newCert.certificate_number}</code>`).catch(() => null);
  }
```

Replace with:
```js
    cert = newCert;
    sendTelegramAlert(`🏆 Certificate issued: ${fullName} (${user.email}) scored ${sessionScore}/10\n<code>${newCert.certificate_number}</code>`).catch(() => null);

    // Notify user — best-effort
    supabaseAdmin
      .from('notifications')
      .insert({
        user_id:  user.id,
        type:     'certificate_unlocked',
        title:    'Defense certificate unlocked',
        message:  `You scored ${sessionScore}/10 — ${newCert.certificate_number} is ready.`,
        metadata: { certificate_number: newCert.certificate_number, score: sessionScore },
      })
      .catch(e => console.error('[certificate] notification insert failed:', e.message));
  }
```

- [ ] **Step 2: Commit**

```bash
git add api/certificate.js
git commit -m "feat(notifications): send certificate unlocked notification after cert creation"
```

---

## Task 9: Referral notifications in referral.js

**Files:**
- Modify: `api/referral.js`

Two insertion points:
- `handleTrack` → referral_join notification to the referrer when a referred user signs up
- `awardMilestoneCredit` → referral_credit notification to the referrer when milestone is awarded

- [ ] **Step 1: Add referral_join notification in handleTrack**

Find this block in `handleTrack` (around lines 119–121):
```js
  sendTelegramAlert(`🔗 Referral signup: ${normalEmail} used code <code>${code}</code>`).catch(() => null);

  return res.status(200).json({ tracked: true });
```

Replace with:
```js
  sendTelegramAlert(`🔗 Referral signup: ${normalEmail} used code <code>${code}</code>`).catch(() => null);

  // Notify the referrer — best-effort
  supabaseAdmin
    .from('users')
    .select('full_name')
    .eq('id', newUser.id)
    .maybeSingle()
    .then(({ data: profile }) => {
      const referredName = profile?.full_name || normalEmail
      return supabaseAdmin.from('notifications').insert({
        user_id:  referrer.id,
        type:     'referral_join',
        title:    'Referral joined',
        message:  `${referredName} signed up using your referral link.`,
        metadata: { referred_name: referredName },
      })
    })
    .catch(e => console.error('[referral/track] notification insert failed:', e.message));

  return res.status(200).json({ tracked: true });
```

- [ ] **Step 2: Add referral_credit notification in awardMilestoneCredit**

Find this block in `awardMilestoneCredit` (around lines 200–207):
```js
  supabaseAdmin.auth.admin.getUserById(referrerId)
    .then(({ data }) => {
      const email = data?.user?.email || referrerId;
      return sendTelegramAlert(`🎯 Referral milestone: ${email} earned a free defense credit (3 qualified referrals)`);
    })
    .catch(() => null);
```

Replace with:
```js
  supabaseAdmin.auth.admin.getUserById(referrerId)
    .then(({ data }) => {
      const email = data?.user?.email || referrerId;
      return sendTelegramAlert(`🎯 Referral milestone: ${email} earned a free defense credit (3 qualified referrals)`);
    })
    .catch(() => null);

  // Notify the referrer — best-effort
  supabaseAdmin
    .from('notifications')
    .insert({
      user_id:  referrerId,
      type:     'referral_credit',
      title:    'Referral credit earned',
      message:  "You've earned a defense credit — 3 referrals qualified.",
      metadata: {},
    })
    .catch(e => console.error('[referral/credit] notification insert failed:', e.message));
```

- [ ] **Step 3: Commit**

```bash
git add api/referral.js
git commit -m "feat(notifications): send referral join and credit notifications"
```

---

## Task 10: Step completion notifications in step components

**Files:**
- Modify: `src/features/topicValidator/TopicValidator.jsx`
- Modify: `src/features/chapterArchitect/ChapterArchitect.jsx`
- Modify: `src/features/methodology/MethodologyAdvisor.jsx`
- Modify: `src/features/writingPlanner/WritingPlanner.jsx`
- Modify: `src/features/projectReviewer/ProjectReviewer.jsx`
- Modify: `src/features/defensePrep/DefensePrep.jsx`

Pattern for each: add `useUser` import + `notifyStepCompleted` import, call the helper fire-and-forget after `markStepComplete`.

---

### 10a — TopicValidator.jsx

- [ ] **Step 1: Add imports** (after existing imports, around line 13)

```js
import { useUser } from '../../hooks/useUser'
import { notifyStepCompleted } from '../../lib/notifications'
```

- [ ] **Step 2: Destructure user inside the component** (after the existing `useApp()` call, around line 28)

```js
const { user } = useUser()
```

- [ ] **Step 3: Call notifyStepCompleted in handleUseThisTopic**

Find (around line 206–209):
```js
    markStepComplete('topic_validator').then(() => {
      if (isFirstCompletion) callCreditReferral().catch(() => {})
    })
    showToast('Topic validated ✓')
```

Replace with:
```js
    markStepComplete('topic_validator').then(() => {
      if (isFirstCompletion) callCreditReferral().catch(() => {})
    })
    if (isFirstCompletion) notifyStepCompleted(user?.id, 'topic_validator', 0).catch(() => {})
    showToast('Topic validated ✓')
```

---

### 10b — ChapterArchitect.jsx

- [ ] **Step 1: Add imports** (after existing imports)

```js
import { useUser } from '../../hooks/useUser'
import { notifyStepCompleted } from '../../lib/notifications'
```

- [ ] **Step 2: Destructure user inside the component** (after the `useApp()` call, around line 156)

```js
const { user } = useUser()
```

- [ ] **Step 3: Call notifyStepCompleted after markStepComplete**

Find (around line 441–444):
```js
    completeStep(1, { chapterStructure: structure, structureType, totalWordCount: wc })
    saveStep('chapter_architect', structure)
    markStepComplete('chapter_architect')
    showToast('Chapter structure confirmed ✓')
```

Replace with:
```js
    const isFirstChapterCompletion = !state.stepsCompleted[1]
    completeStep(1, { chapterStructure: structure, structureType, totalWordCount: wc })
    saveStep('chapter_architect', structure)
    markStepComplete('chapter_architect')
    if (isFirstChapterCompletion) notifyStepCompleted(user?.id, 'chapter_architect', 1).catch(() => {})
    showToast('Chapter structure confirmed ✓')
```

---

### 10c — MethodologyAdvisor.jsx

- [ ] **Step 1: Add imports** (after existing imports)

```js
import { useUser } from '../../hooks/useUser'
import { notifyStepCompleted } from '../../lib/notifications'
```

- [ ] **Step 2: Destructure user inside the component** (after the `useApp()` call)

The component body uses `set()` not `completeStep()` directly. Find where `const { state, set, ... } = useApp()` is and add below it:
```js
const { user } = useUser()
```

- [ ] **Step 3: Call notifyStepCompleted after markStepComplete**

Find (around line 154–157):
```js
    saveStep('methodology_advisor', { ...maData, chosen_methodology: selectedMethodology })
    markStepComplete('methodology_advisor')
    showToast('Methodology confirmed ✓')
```

Replace with:
```js
    const isFirstMethodologyCompletion = !state.stepsCompleted[2]
    saveStep('methodology_advisor', { ...maData, chosen_methodology: selectedMethodology })
    markStepComplete('methodology_advisor')
    if (isFirstMethodologyCompletion) notifyStepCompleted(user?.id, 'methodology_advisor', 2).catch(() => {})
    showToast('Methodology confirmed ✓')
```

---

### 10d — WritingPlanner.jsx

- [ ] **Step 1: Add imports** (after existing imports)

```js
import { useUser } from '../../hooks/useUser'
import { notifyStepCompleted } from '../../lib/notifications'
```

- [ ] **Step 2: Destructure user inside the component** (after `useApp()` call, around line 33)

```js
const { user } = useUser()
```

- [ ] **Step 3: Call notifyStepCompleted in handleConfirm**

Find (around line 155–160):
```js
  function handleConfirm() {
    if (!data) return
    completeStep(3, { writingPlan: data, submissionDeadline: dateValue })
    saveStep('writing_planner', { ...data, submission_deadline: dateValue }, dateValue)
    markStepComplete('writing_planner')
    showToast('Writing plan created ✓')
  }
```

Replace with:
```js
  function handleConfirm() {
    if (!data) return
    const isFirstWritingCompletion = !state.stepsCompleted[3]
    completeStep(3, { writingPlan: data, submissionDeadline: dateValue })
    saveStep('writing_planner', { ...data, submission_deadline: dateValue }, dateValue)
    markStepComplete('writing_planner')
    if (isFirstWritingCompletion) notifyStepCompleted(user?.id, 'writing_planner', 3).catch(() => {})
    showToast('Writing plan created ✓')
  }
```

---

### 10e — ProjectReviewer.jsx

- [ ] **Step 1: Add imports** (after existing imports)

```js
import { useUser } from '../../hooks/useUser'
import { notifyStepCompleted } from '../../lib/notifications'
```

- [ ] **Step 2: Destructure user inside the component** (after `useApp()` call, around line 223)

```js
const { user } = useUser()
```

- [ ] **Step 3: Call notifyStepCompleted in the review success path only (not skip)**

Find (around line 446–457):
```js
    completeStep(4, { uploadedProject: { fileName, fileType, reviewData } })
    saveStep('project_reviewer', {
      fileName,
      grade:               reviewData.grade,
      score_estimate:      reviewData.score_estimate,
      grade_justification: reviewData.grade_justification,
      strengths:           reviewData.strengths,
      weaknesses:          reviewData.weaknesses,
      examiner_questions:  reviewData.examiner_questions,
    })
    markStepComplete('project_reviewer')
    showToast('Project reviewed ✓')
```

Replace with:
```js
    const isFirstReviewerCompletion = !state.stepsCompleted[4]
    completeStep(4, { uploadedProject: { fileName, fileType, reviewData } })
    saveStep('project_reviewer', {
      fileName,
      grade:               reviewData.grade,
      score_estimate:      reviewData.score_estimate,
      grade_justification: reviewData.grade_justification,
      strengths:           reviewData.strengths,
      weaknesses:          reviewData.weaknesses,
      examiner_questions:  reviewData.examiner_questions,
    })
    markStepComplete('project_reviewer')
    if (isFirstReviewerCompletion) notifyStepCompleted(user?.id, 'project_reviewer', 4).catch(() => {})
    showToast('Project reviewed ✓')
```

Note: Do **not** add `notifyStepCompleted` to `handleSkip` — skipping is not a meaningful completion event.

---

### 10f — DefensePrep.jsx

`useUser` is already imported. The user object is called `authUser`.

- [ ] **Step 1: Add notifications import** (after existing imports)

```js
import { notifyStepCompleted } from '../../lib/notifications'
```

- [ ] **Step 2: Call notifyStepCompleted after markStepComplete chain**

Find (around line 1128–1132):
```js
      markStepComplete('defense_prep')
        .then(() => markDefenseSimulatorRun())
        .then(() => tryAwardDefenseReady())
```

Replace with:
```js
      const isFirstDefenseCompletion = !state.stepsCompleted[5]
      markStepComplete('defense_prep')
        .then(() => markDefenseSimulatorRun())
        .then(() => tryAwardDefenseReady())
      if (isFirstDefenseCompletion) notifyStepCompleted(authUser?.id, 'defense_prep', 5).catch(() => {})
```

- [ ] **Step 3: Commit all step component changes together**

```bash
git add src/features/topicValidator/TopicValidator.jsx \
        src/features/chapterArchitect/ChapterArchitect.jsx \
        src/features/methodology/MethodologyAdvisor.jsx \
        src/features/writingPlanner/WritingPlanner.jsx \
        src/features/projectReviewer/ProjectReviewer.jsx \
        src/features/defensePrep/DefensePrep.jsx
git commit -m "feat(notifications): fire step completion notifications from all 6 step components"
```

---

## Task 11: Smoke test

- [ ] **Step 1: Start dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test bell on Dashboard**

1. Log in and open `/dashboard`
2. Bell icon should appear in top bar with no badge (no unread)
3. Click bell → panel opens showing "You're all caught up"

- [ ] **Step 3: Test unread badge**

In Supabase SQL Editor, insert a test notification for your user:
```sql
INSERT INTO notifications (user_id, type, title, message)
VALUES (
  '<your-user-id>',
  'welcome',
  'Welcome to FYPro',
  'Your research journey starts here. Let''s go.'
);
```
Refresh the page. Bell should show a red badge with "1". Click bell → notification appears with unread blue dot.

- [ ] **Step 4: Test mark all read**

Click "Mark all read" → blue dot disappears, badge clears, "Mark all read" link hides.

- [ ] **Step 5: Verify welcome notification fires on new signup**

Create a test account → check the notifications table in Supabase:
```sql
SELECT * FROM notifications WHERE type = 'welcome' ORDER BY created_at DESC LIMIT 5;
```
Expected: one row for the new user.

- [ ] **Step 6: Final commit**

```bash
git add -A
git commit -m "feat(notifications): notification system complete — Supabase-backed bell and dropdown"
```
