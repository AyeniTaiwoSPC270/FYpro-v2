# Push Notifications — Design Spec
**Date:** 2026-06-03
**Status:** Approved, ready for implementation

---

## 1. Goal

Re-engage Nigerian final year students who have gone quiet on their FYPro project. Two trigger types:
- **Inactivity nudge** — 3-day gentle + 7-day stronger sequence, then silence until they return
- **Defense reminder** — fires when student has completed Steps 1–4 but has never started the Defense Simulator

---

## 2. Architecture Overview

```
[TopicValidator.jsx]  ──after Step 1──▶  [Custom permission card]
                                               │ user clicks "Yes"
                                               ▼
                                    pushManager.subscribe(VAPID_PUBLIC_KEY)
                                               │
                                    POST /api/notify?action=subscribe
                                               │
                                               ▼
                                    [push_subscriptions table]  ◀── RLS protected
                                               │
                                    [cron-job.org, daily 08:00 UTC / 09:00 WAT]
                                               │
                                    GET /api/notify?action=send-nudges&secret=CRON_SECRET
                                               │
                                    query inactive users ──▶ web-push ──▶ [Browser SW]
                                                                               │
                                                                    showNotification()
                                                                               │
                                                                    tap ──▶ /app
```

**No new Vercel function.** All backend logic merges into `notify.js`. Stays within the 12-function Hobby plan ceiling.

---

## 3. Environment Variables

Three new vars to add to Vercel:

| Var | Scope | Purpose |
|-----|-------|---------|
| `VAPID_PUBLIC_KEY` | Server | VAPID signing (web-push) |
| `VAPID_PRIVATE_KEY` | Server | VAPID signing (web-push) |
| `VITE_VAPID_PUBLIC_KEY` | Frontend | Passed to `pushManager.subscribe()` |

**One-time key generation (run locally, never commit output):**
```js
const webpush = require('web-push')
console.log(webpush.generateVAPIDKeys())
// → { publicKey: '...', privateKey: '...' }
```

---

## 4. Database — `push_subscriptions` Table

```sql
create table push_subscriptions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references users(id) on delete cascade,
  subscription    jsonb not null,
  last_nudged_at  timestamptz,
  created_at      timestamptz default now(),
  constraint push_subscriptions_user_id_key unique (user_id)
);

alter table push_subscriptions enable row level security;

create policy "users manage own subscription"
  on push_subscriptions
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- `unique (user_id)` — one active subscription per user; re-subscribing does an upsert
- `last_nudged_at` — deduplication guard; prevents same nudge re-firing the next day
- RLS: users can only touch their own row; `send-nudges` uses service_role to read all

---

## 5. Service Worker

Switch vite-plugin-pwa from implicit `generateSW` to `injectManifest` strategy. Workbox injects the precache manifest into our custom `src/sw.js` at build time.

### `vite.config.js` changes
```js
VitePWA({
  registerType: 'prompt',
  injectRegister: null,
  manifest: false,
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.js',
  // workbox: {} block removed — config moves into src/sw.js
})
```

### New `src/sw.js`
```js
import { precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// Workbox injects precache manifest here at build time
precacheAndRoute(self.__WB_MANIFEST)

// SPA navigation fallback — same behaviour as before
registerRoute(
  new NavigationRoute(new NetworkFirst(), {
    denylist: [/^\/api\//],
  })
)

// Google Fonts stylesheet
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' })
)

// Google Fonts files — cache 30 days
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 })],
  })
)

// Push: parse payload, show notification
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'FYPro', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/app' },
    })
  )
})

// Tap: focus existing window or open app at target URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/app'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(self.location.origin))
      return existing ? existing.focus() : clients.openWindow(url)
    })
  )
})
```

---

## 6. Permission Flow (Frontend)

### Trigger point
After Step 1 (Topic Validator) completes successfully — the permission card renders below the success state.

### localStorage flag
`fypro_push_asked` — set on accept or decline. Card never shown again once set.

### UX rule
`Notification.requestPermission()` only fires when the student clicks "Yes, remind me" — never on page load. The browser dialog appears only after explicit intent, maximising the accept rate.

### Permission card (in `TopicValidator.jsx`)
```jsx
{showPushCard && (
  <div className="tv-push-card">
    <div className="tv-push-card__icon">🔔</div>
    <div className="tv-push-card__text">
      <strong>Stay on track</strong>
      <p>Get a nudge if you go quiet for a few days. Research projects stall — we'll remind you.</p>
    </div>
    <div className="tv-push-card__actions">
      <button onClick={handlePushAccept}>Yes, remind me</button>
      <button onClick={handlePushDecline}>No thanks</button>
    </div>
  </div>
)}
```

### Accept handler flow
1. `await Notification.requestPermission()`
2. If granted → `pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: VITE_VAPID_PUBLIC_KEY })`
3. `POST /api/notify?action=subscribe` with subscription object + JWT
4. Set `fypro_push_asked` in localStorage

### Decline handler
Set `fypro_push_asked` in localStorage. Nothing else.

### Settings page escape hatch
A "Notifications" toggle in `Settings.jsx`. On mount, the toggle reads its initial state from `await navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription())` — if non-null, the student is subscribed. On toggle-off → `POST /api/notify?action=unsubscribe` with JWT → deletes row from `push_subscriptions` → call `subscription.unsubscribe()` in the browser to release the browser-side subscription too.

---

## 7. Backend — notify.js New Actions

### `subscribe` (POST, JWT required)
```
1. Verify JWT, extract user_id
2. Validate body.subscription has endpoint + keys
3. Upsert into push_subscriptions on conflict (user_id) → update subscription
4. Return 200
```

### `unsubscribe` (POST, JWT required)
```
1. Verify JWT, extract user_id
2. Delete from push_subscriptions where user_id = user_id
3. Return 200
```

### `send-nudges` (GET, CRON_SECRET required)

**Definition of "activity":** the most recent `project_steps.completed_at` for that user across all their projects. Opening the app without completing a step does not reset the inactivity clock — this is intentional; we want to nudge students who are browsing but not progressing.

```
1. Verify request secret matches CRON_SECRET
2. Fetch all rows from push_subscriptions (service_role)
3. For each subscription:
   a. Fetch user's most recent project_steps.completed_at (max across all projects)
   b. Compute days_inactive = now() - last_step_completed_at
   c. Compute days_since_nudged = now() - last_nudged_at (null = never)

   Inactivity nudge:
     - days_inactive >= 7 AND days_since_nudged > 7 (or null) → send 7-day nudge
     - days_inactive >= 3 AND days_since_nudged > 3 (or null) → send 3-day nudge
     - (7-day check runs first — takes priority if both thresholds crossed)

   Defense reminder (checked only if no inactivity nudge fired):
     - User has completed: topic_validator, chapter_architect,
       methodology_advisor, writing_planner in project_steps
     - User has zero rows in defense_sessions
     - days_inactive >= 2 since last step completed
     - days_since_nudged > 7
     → send defense reminder

4. On send success → update last_nudged_at
5. On 410 Gone → delete subscription row (expired/revoked)
6. Log send results to console
```

---

## 8. Notification Payloads

| Trigger | Title | Body | Tap URL |
|---------|-------|------|---------|
| 3-day inactivity | "FYPro" | "Your project is waiting — you haven't worked on it in 3 days. Keep going." | `/app` |
| 7-day inactivity | "FYPro" | "It's been a week. Your final year project needs you — don't let it drift." | `/app` |
| Defense reminder | "FYPro" | "You've done the research. Have you tried the AI defense panel yet?" | `/app` |

Short, direct, no emoji in body — consistent with the serious/purposeful design tone.

---

## 9. Cron Setup

Add a third cron-job.org job alongside the two existing ones:

| Job | Schedule | URL |
|-----|----------|-----|
| Daily report | 20:00 UTC | `GET /api/admin?action=daily-report&secret=CRON_SECRET` |
| Nurture emails | 09:00 UTC | (existing) |
| **Push nudges** | **08:00 UTC (09:00 WAT)** | `GET /api/notify?action=send-nudges&secret=CRON_SECRET` |

08:00 UTC / 09:00 WAT — students are starting their day, not mid-sleep. Fires once daily; logic inside decides who gets a notification.

---

## 10. Platform Support

| Platform | Support | Notes |
|----------|---------|-------|
| Android Chrome | Full | Best experience |
| Android Samsung Internet | Full | |
| Desktop Chrome/Edge | Full | |
| iOS Safari 16.4+ | Partial | PWA must be installed first (our install prompt handles this gate) |
| iOS Safari < 16.4 | None | Silently skipped — no error shown to user |
| Firefox | Full | |

---

## 11. Files Changed

| File | Change |
|------|--------|
| `vite.config.js` | Switch to `injectManifest`, add `srcDir`/`filename` |
| `src/sw.js` | New file — custom SW with push + notificationclick handlers |
| `src/features/topicValidator/TopicValidator.jsx` | Add permission card after Step 1 success state |
| `src/pages/Settings.jsx` | Add Notifications toggle → unsubscribe |
| `api/notify.js` | Add `subscribe`, `unsubscribe`, `send-nudges` action branches |
| `migrations/0015_push_subscriptions.sql` | New migration |
| `vercel.json` | No changes needed (no new CSP domains) |
| `.env.example` | Add `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VITE_VAPID_PUBLIC_KEY` |

---

## 12. Out of Scope

- Notification preferences beyond on/off (e.g. per-trigger toggles)
- Push analytics (delivery rate, tap-through rate) — PostHog can track taps via `notificationclick` in a follow-on
- Silent push / background sync
- Notification grouping or badge counts
