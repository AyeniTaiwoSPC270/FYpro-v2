# Push Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add re-engagement push notifications to FYPro — a 3-day inactivity nudge, a 7-day inactivity nudge, and a defense reminder for students who completed Steps 1–4 but never started the Defense Simulator.

**Architecture:** VAPID-based Web Push merged into `notify.js` (no new Vercel function). A custom `src/sw.js` handles push display and tap routing. A daily cron-job.org hit fires the nudge logic. One new Supabase table stores subscriptions.

**Tech Stack:** `web-push` (npm, server-side), `workbox-precaching/routing/strategies/expiration` (bundled into SW by Vite), `vite-plugin-pwa` injectManifest mode, Supabase `push_subscriptions` table.

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `migrations/0025_push_subscriptions.sql` | Create | New table + RLS |
| `vite.config.js` | Modify | Switch to `injectManifest` strategy |
| `src/sw.js` | Create | Custom SW: precache + push + notificationclick |
| `src/services/api.js` | Modify | Add `subscribePush()` and `unsubscribePush()` |
| `src/features/topicValidator/TopicValidator.jsx` | Modify | Permission card after Step 1 success |
| `src/index.css` | Modify | CSS for `.tv-push-card` and related classes |
| `api/notify.js` | Modify | Router: GET handler + subscribe + unsubscribe + send-nudges actions |
| `src/pages/Settings.jsx` | Modify | Push toggle in Notifications section |
| `.env.example` | Modify | Add three VAPID vars |

---

## Task 1: Generate VAPID Keys and Update Env

**Files:**
- Modify: `.env.local`
- Modify: `.env.example`

- [ ] **Step 1: Install web-push temporarily to generate keys**

```bash
npm install web-push
```

- [ ] **Step 2: Generate VAPID keys**

Run in a Node REPL (never commit the output):

```bash
node -e "const w=require('web-push'); const k=w.generateVAPIDKeys(); console.log('PUBLIC:', k.publicKey); console.log('PRIVATE:', k.privateKey)"
```

Copy both values — you will use them in the next steps.

- [ ] **Step 3: Add keys to .env.local**

Open `.env.local` and append these three lines (replace placeholders with your generated values):

```
VAPID_PUBLIC_KEY=<your-generated-public-key>
VAPID_PRIVATE_KEY=<your-generated-private-key>
VITE_VAPID_PUBLIC_KEY=<same-public-key-as-above>
```

`VITE_VAPID_PUBLIC_KEY` equals `VAPID_PUBLIC_KEY` — it's the same key exposed to the frontend.

- [ ] **Step 4: Document in .env.example**

Open `.env.example`. Add after the last existing entry:

```
VAPID_PUBLIC_KEY=
VAPID_PRIVATE_KEY=
VITE_VAPID_PUBLIC_KEY=
```

- [ ] **Step 5: Add all three vars to Vercel**

Go to your Vercel project → Settings → Environment Variables. Add:
- `VAPID_PUBLIC_KEY` → server only
- `VAPID_PRIVATE_KEY` → server only
- `VITE_VAPID_PUBLIC_KEY` → all environments (Vercel exposes `VITE_*` vars to the frontend build)

- [ ] **Step 6: Commit env.example**

```bash
git add .env.example
git commit -m "chore: add VAPID env vars to .env.example"
```

---

## Task 2: Database Migration

**Files:**
- Create: `migrations/0025_push_subscriptions.sql`

- [ ] **Step 1: Create the migration file**

Create `migrations/0025_push_subscriptions.sql` with this content:

```sql
-- push_subscriptions: stores browser Web Push subscriptions for nudge delivery
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
  using  (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Go to your Supabase project → SQL Editor → paste the entire file content → Run.

Expected output: `Success. No rows returned.`

- [ ] **Step 3: Verify RLS**

Run this in the same SQL Editor:

```sql
select tablename
from pg_tables
where schemaname = 'public' and rowsecurity = false;
```

Expected output: zero rows. If `push_subscriptions` appears here, the migration didn't apply RLS correctly — re-run the `alter table` statement.

- [ ] **Step 4: Commit migration**

```bash
git add migrations/0025_push_subscriptions.sql
git commit -m "feat: add push_subscriptions table with RLS"
```

---

## Task 3: Install Dependencies

**Files:** `package.json`

- [ ] **Step 1: Install server-side push library**

```bash
npm install web-push
```

`web-push` handles VAPID authentication and encrypted payload delivery. It goes in `dependencies` because Vercel serverless functions resolve from `package.json`.

- [ ] **Step 2: Install Workbox runtime packages**

```bash
npm install --save-dev workbox-precaching workbox-routing workbox-strategies workbox-expiration
```

These are needed so `src/sw.js` can import Workbox modules. Vite bundles them into the SW at build time.

- [ ] **Step 3: Verify**

```bash
node -e "require('web-push'); console.log('web-push ok')"
```

Expected: `web-push ok`

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add web-push and workbox runtime deps"
```

---

## Task 4: Service Worker — injectManifest Mode

**Files:**
- Modify: `vite.config.js`
- Create: `src/sw.js`

The current `vite.config.js` uses Workbox's `generateSW` mode (implicit default). Switching to `injectManifest` lets us write our own `src/sw.js` with push handlers while keeping all existing caching behaviour.

- [ ] **Step 1: Update vite.config.js**

Replace the entire `VitePWA({...})` block. The current block starts at line 8. The new block:

```js
VitePWA({
  registerType: 'prompt',
  injectRegister: null,
  manifest: false,
  strategies: 'injectManifest',
  srcDir: 'src',
  filename: 'sw.js',
  injectManifest: {
    // Precache all built assets — same scope as before
    globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
  },
}),
```

- [ ] **Step 2: Create src/sw.js**

Create `src/sw.js` with this content:

```js
import { precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// Workbox injects the precache manifest array here at build time
precacheAndRoute(self.__WB_MANIFEST)

// Serve index.html for all navigation requests — never intercept /api/
registerRoute(
  new NavigationRoute(new NetworkFirst(), {
    denylist: [/^\/api\//],
  })
)

// Google Fonts stylesheet — stale-while-revalidate (fast + stays fresh)
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' })
)

// Google Fonts files — cache for 30 days (they are immutable)
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
)

// Push event: parse the JSON payload and show a system notification
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

// Notification tap: focus an existing window or open the app at the target URL
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

- [ ] **Step 3: Build and verify**

```bash
npm run build
```

Expected: build succeeds. Check that `dist/sw.js` exists and contains `self.__WB_MANIFEST` replaced with an array of precache entries. If build fails with a Workbox import error, confirm the workbox packages from Task 3 are installed.

- [ ] **Step 4: Commit**

```bash
git add vite.config.js src/sw.js
git commit -m "feat: switch SW to injectManifest mode with push event handler"
```

---

## Task 5: Frontend API Helpers

**Files:**
- Modify: `src/services/api.js`

- [ ] **Step 1: Add subscribePush and unsubscribePush to api.js**

Open `src/services/api.js`. After the existing imports block (after line 18, the last `import` line), add:

```js
export async function subscribePush(subscriptionJson) {
  const token = await getAccessToken()
  if (!token) return
  await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'subscribe', subscription: subscriptionJson }),
  })
}

export async function unsubscribePush() {
  const token = await getAccessToken()
  if (!token) return
  await fetch('/api/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ action: 'unsubscribe' }),
  })
}
```

- [ ] **Step 2: Commit**

```bash
git add src/services/api.js
git commit -m "feat: add subscribePush and unsubscribePush API helpers"
```

---

## Task 6: Permission Card in TopicValidator.jsx

**Files:**
- Modify: `src/features/topicValidator/TopicValidator.jsx`
- Modify: `src/index.css`

The card appears once — after Step 1 completes for the first time — and never again once the student answers either way.

- [ ] **Step 1: Add subscribePush import to TopicValidator.jsx**

In `src/features/topicValidator/TopicValidator.jsx`, add to the existing import from `../../services/api`:

```js
import { validateTopic, handleApiError, logFailure, subscribePush } from '../../services/api'
```

- [ ] **Step 2: Add urlBase64ToUint8Array helper**

After the `countWords` function (after line 28), add:

```js
function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; i++) output[i] = rawData.charCodeAt(i)
  return output
}
```

- [ ] **Step 3: Add pushAsked state**

In the `TopicValidator` function body, after the existing `useState` declarations (after line 52, the `typewriterActive` line), add:

```js
const [pushAsked, setPushAsked] = useState(() => !!localStorage.getItem('fypro_push_asked'))
```

- [ ] **Step 4: Add push handlers**

After the `handleSelectAlternative` function (after line 231), add:

```js
// ── Push permission ───────────────────────────────────────────────────────
async function handlePushAccept() {
  setPushAsked(true)
  localStorage.setItem('fypro_push_asked', '1')
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(import.meta.env.VITE_VAPID_PUBLIC_KEY),
    })
    await subscribePush(sub.toJSON())
  } catch (err) {
    console.error('[push] subscribe failed:', err)
  }
}

function handlePushDecline() {
  setPushAsked(true)
  localStorage.setItem('fypro_push_asked', '1')
}
```

- [ ] **Step 5: Add push card derivation**

After the `verdictLabelClass` block (after the `diffKeyFor` function, around line 249), add:

```js
const showPushCard =
  section === 'result' &&
  !restored &&
  !pushAsked &&
  typeof window !== 'undefined' &&
  'Notification' in window &&
  'serviceWorker' in navigator
```

- [ ] **Step 6: Render the push card in JSX**

In the result section JSX, after the `<FeedbackThumbs ... />` element (around line 427), add:

```jsx
{showPushCard && (
  <div className="tv-push-card">
    <div className="tv-push-card__icon">🔔</div>
    <div className="tv-push-card__text">
      <strong>Stay on track</strong>
      <p>Get a nudge if you go quiet for a few days. Research projects stall — we'll remind you.</p>
    </div>
    <div className="tv-push-card__actions">
      <button className="tv-push-card__btn--yes" onClick={handlePushAccept}>
        Yes, remind me
      </button>
      <button className="tv-push-card__btn--no" onClick={handlePushDecline}>
        No thanks
      </button>
    </div>
  </div>
)}
```

- [ ] **Step 7: Add CSS for the push card**

Open `src/index.css`. Scroll to the end of the `/* ── Topic Validator ── */` section (search for the last `.tv-` rule). Append these rules immediately after the last `.tv-` rule:

```css
/* push permission card */
.tv-push-card {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 20px;
  padding: 16px 20px;
  background: var(--color-blue-subtle);
  border: 1px solid var(--color-border-blue);
  border-left: 3px solid var(--color-blue-primary);
  border-radius: var(--radius-md);
  animation: card-enter 0.3s ease forwards;
}

.tv-push-card__icon {
  font-size: 1.4rem;
  flex-shrink: 0;
  line-height: 1;
}

.tv-push-card__text {
  flex: 1;
  min-width: 0;
}

.tv-push-card__text strong {
  display: block;
  font-family: 'Poppins', sans-serif;
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--color-text-primary);
  margin-bottom: 2px;
}

.tv-push-card__text p {
  font-family: 'Poppins', sans-serif;
  font-size: 0.8rem;
  color: var(--color-text-secondary);
  margin: 0;
  line-height: 1.5;
}

.tv-push-card__actions {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex-shrink: 0;
}

.tv-push-card__btn--yes {
  padding: 7px 14px;
  background: var(--color-blue-primary);
  color: #fff;
  border: none;
  border-radius: var(--radius-sm);
  font-family: 'Poppins', sans-serif;
  font-size: 0.78rem;
  font-weight: 600;
  cursor: pointer;
  transition: opacity var(--transition-fast);
  white-space: nowrap;
}

.tv-push-card__btn--yes:hover { opacity: 0.85; }

.tv-push-card__btn--no {
  padding: 7px 14px;
  background: transparent;
  color: var(--color-text-secondary);
  border: 1px solid var(--color-border);
  border-radius: var(--radius-sm);
  font-family: 'Poppins', sans-serif;
  font-size: 0.78rem;
  cursor: pointer;
  transition: background var(--transition-fast);
  white-space: nowrap;
}

.tv-push-card__btn--no:hover { background: rgba(13,27,42,0.06); }
```

- [ ] **Step 8: Commit**

```bash
git add src/features/topicValidator/TopicValidator.jsx src/index.css
git commit -m "feat: add push permission card after Step 1 completion"
```

---

## Task 7: notify.js — Router Extension + Subscribe + Unsubscribe

**Files:**
- Modify: `api/notify.js`

- [ ] **Step 1: Add web-push import at the top of notify.js**

Open `api/notify.js`. After the existing imports block (after the `import { setMaintenanceMode }` line, around line 6), add:

```js
import webpush from 'web-push'

webpush.setVapidDetails(
  'mailto:hello@fypro.com.ng',
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)
```

- [ ] **Step 2: Add handleSubscribe function**

Before the `// ─── Router ───` comment (around line 943), add:

```js
// ─── Push subscription management ────────────────────────────────────────────

async function handleSubscribe(req, res) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { subscription } = req.body || {}
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription object' })
  }

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert({ user_id: user.id, subscription }, { onConflict: 'user_id' })

  if (error) {
    console.error('[notify/subscribe] upsert error:', error.message)
    return res.status(500).json({ error: 'Failed to save subscription' })
  }

  return res.status(200).json({ ok: true })
}

async function handleUnsubscribe(req, res) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)

  return res.status(200).json({ ok: true })
}
```

- [ ] **Step 3: Extend the router to handle GET and new POST actions**

Find the `export default async function handler(req, res)` block (around line 945). Replace the entire handler function with:

```js
export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  // GET: cron-triggered actions
  if (req.method === 'GET') {
    const action = req.query?.action
    if (action === 'send-nudges') return handleSendNudges(req, res)
    return res.status(405).end()
  }

  if (req.method !== 'POST') return res.status(405).end()

  // Telegram updates always carry update_id; our notify calls never do.
  if (req.body?.update_id !== undefined) return handleTelegramBot(req, res)

  // Contact form — public, no JWT required
  if (req.body?.action === 'contact') return handleContact(req, res)

  // Push subscription management — JWT required
  if (req.body?.action === 'subscribe')   return handleSubscribe(req, res)
  if (req.body?.action === 'unsubscribe') return handleUnsubscribe(req, res)

  return handleNotify(req, res)
}
```

- [ ] **Step 4: Commit**

```bash
git add api/notify.js
git commit -m "feat: add push subscribe/unsubscribe actions to notify.js"
```

---

## Task 8: notify.js — send-nudges Action

**Files:**
- Modify: `api/notify.js`

This function runs once per day via cron. For each subscriber it decides which nudge to send (if any), delivers it via Web Push, and updates `last_nudged_at`.

- [ ] **Step 1: Add handleSendNudges function**

Before the `// ─── Push subscription management ───` comment added in Task 7, add this function:

```js
// ─── Push nudge delivery (cron) ───────────────────────────────────────────────

const NUDGE_PAYLOADS = {
  inactive_3: {
    title: 'FYPro',
    body: "Your project is waiting — you haven't worked on it in 3 days. Keep going.",
    url: '/app',
  },
  inactive_7: {
    title: 'FYPro',
    body: "It's been a week. Your final year project needs you — don't let it drift.",
    url: '/app',
  },
  defense_reminder: {
    title: 'FYPro',
    body: "You've done the research. Have you tried the AI defense panel yet?",
    url: '/app',
  },
}

const REQUIRED_STEPS_FOR_DEFENSE = [
  'topic_validator',
  'chapter_architect',
  'methodology_advisor',
  'writing_planner',
]

async function handleSendNudges(req, res) {
  if (req.query?.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Fetch all current subscriptions
  const { data: subs, error: subErr } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')

  if (subErr) {
    console.error('[nudges] failed to fetch subscriptions:', subErr.message)
    return res.status(500).json({ error: 'DB error' })
  }

  const now = Date.now()
  const DAY_MS = 86_400_000
  const results = { sent: 0, skipped: 0, cleaned: 0, errors: 0 }

  for (const sub of subs) {
    try {
      // Last activity = most recent project_steps.completed_at for this user
      const { data: lastStepRows } = await supabaseAdmin
        .from('project_steps')
        .select('completed_at')
        .eq('user_id', sub.user_id)
        .order('completed_at', { ascending: false })
        .limit(1)

      const lastStepAt = lastStepRows?.[0]?.completed_at
      if (!lastStepAt) { results.skipped++; continue } // no activity yet

      const daysInactive    = (now - new Date(lastStepAt).getTime()) / DAY_MS
      const daysSinceNudged = sub.last_nudged_at
        ? (now - new Date(sub.last_nudged_at).getTime()) / DAY_MS
        : Infinity

      let nudgeKey = null

      // Inactivity nudges — 7-day check takes priority
      if (daysInactive >= 7 && daysSinceNudged > 7) {
        nudgeKey = 'inactive_7'
      } else if (daysInactive >= 3 && daysSinceNudged > 3) {
        nudgeKey = 'inactive_3'
      }

      // Defense reminder — only if no inactivity nudge fired
      if (!nudgeKey && daysSinceNudged > 7 && daysInactive >= 2) {
        const { data: steps } = await supabaseAdmin
          .from('project_steps')
          .select('step_name')
          .eq('user_id', sub.user_id)

        const completedNames = steps?.map((s) => s.step_name) ?? []
        const hasAllSteps = REQUIRED_STEPS_FOR_DEFENSE.every((s) => completedNames.includes(s))

        if (hasAllSteps) {
          const { count: defenseCount } = await supabaseAdmin
            .from('defense_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', sub.user_id)

          if (defenseCount === 0) nudgeKey = 'defense_reminder'
        }
      }

      if (!nudgeKey) { results.skipped++; continue }

      // Send the push notification
      await webpush.sendNotification(
        sub.subscription,
        JSON.stringify(NUDGE_PAYLOADS[nudgeKey])
      )

      // Update last_nudged_at
      await supabaseAdmin
        .from('push_subscriptions')
        .update({ last_nudged_at: new Date().toISOString() })
        .eq('user_id', sub.user_id)

      results.sent++
      console.log(`[nudges] sent ${nudgeKey} to ${sub.user_id}`)
    } catch (err) {
      if (err.statusCode === 410) {
        // Subscription expired or revoked — clean up
        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .eq('user_id', sub.user_id)
        results.cleaned++
        console.log(`[nudges] cleaned expired subscription for ${sub.user_id}`)
      } else {
        results.errors++
        console.error(`[nudges] error for ${sub.user_id}:`, err.message)
      }
    }
  }

  console.log('[nudges] run complete:', results)
  return res.status(200).json({ ok: true, ...results })
}
```

- [ ] **Step 2: Commit**

```bash
git add api/notify.js
git commit -m "feat: add send-nudges cron action to notify.js"
```

---

## Task 9: Settings.jsx — Push Notifications Toggle

**Files:**
- Modify: `src/pages/Settings.jsx`

The Notifications section already exists at line ~650 with email/updates/defense toggles. We add a push toggle as the first item — it's the most prominent.

- [ ] **Step 1: Add unsubscribePush import**

In `src/pages/Settings.jsx`, find the existing imports. Add `unsubscribePush` to the api import (there is no api import currently — add a new import line after the last import):

```js
import { unsubscribePush } from '../services/api'
```

- [ ] **Step 2: Add push state in the Settings component**

In the main `Settings` component (the large exported default function that starts around line 445), find where `const [notifs, setNotifs] = useState(...)` or similar state declarations are. After those, add:

```js
const [pushEnabled, setPushEnabled] = useState(false)
const [savingPush, setSavingPush]   = useState(false)

useEffect(() => {
  if (!('serviceWorker' in navigator)) return
  navigator.serviceWorker.ready
    .then((reg) => reg.pushManager.getSubscription())
    .then((sub) => setPushEnabled(!!sub))
    .catch(() => {})
}, [])

async function handlePushToggle() {
  if (!pushEnabled) return // opt-in only via Step 1 — can't subscribe from Settings
  setSavingPush(true)
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (sub) {
      await sub.unsubscribe()
      await unsubscribePush()
    }
    setPushEnabled(false)
  } catch (err) {
    console.error('[push] unsubscribe failed:', err)
    showToast('Failed to update notification settings')
  } finally {
    setSavingPush(false)
  }
}
```

- [ ] **Step 3: Add push toggle row to the Notifications section**

Find the Notifications section JSX (around line 650 — `<SectionLabel>Notifications</SectionLabel>`). Add a new `ToggleRow` as the first item inside the `<div className="flex flex-col gap-5">`:

```jsx
<ToggleRow
  title="Push notifications"
  desc={
    pushEnabled
      ? 'Nudges sent if you go quiet on your project for 3+ days'
      : 'Enable from Step 1 after validating your topic'
  }
  checked={pushEnabled}
  onChange={handlePushToggle}
  disabled={savingPush || !pushEnabled}
/>
<div className="border-t" style={{ borderColor: 'var(--border-color)' }} />
```

The `disabled={!pushEnabled}` prevents the toggle from being clicked to subscribe (subscription requires browser permission — that flow lives in TopicValidator). Students who aren't subscribed see the toggle grayed out with the explanation text.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Settings.jsx
git commit -m "feat: add push notifications toggle to Settings page"
```

---

## Task 10: Cron Setup and Deploy

**Files:** No code changes — external configuration.

- [ ] **Step 1: Add the cron job at cron-job.org**

Log in to cron-job.org. Create a new cron job:

| Field | Value |
|-------|-------|
| Title | FYPro — Push Nudges |
| URL | `https://www.fypro.com.ng/api/notify?action=send-nudges&secret=<your-CRON_SECRET>` |
| Schedule | Daily at 08:00 UTC |
| Request method | GET |
| Timeout | 30 seconds |

Use the same `CRON_SECRET` value that's already in your Vercel env vars.

- [ ] **Step 2: Deploy to Vercel**

```bash
git push origin main
```

Wait for the Vercel deployment to complete (check Vercel dashboard or run `vercel ls` if CLI installed).

- [ ] **Step 3: Smoke test — subscribe flow**

1. Open `https://www.fypro.com.ng` in Chrome on Android (best push support)
2. Sign in, start a new project, complete Topic Validator (click "Use This Topic")
3. Confirm the push permission card appears below the result
4. Click "Yes, remind me" — browser permission dialog should appear
5. Accept — no error should appear in the console
6. Open Supabase → Table Editor → `push_subscriptions` — confirm a row exists for your user

- [ ] **Step 4: Smoke test — manual nudge trigger**

Hit the cron endpoint manually to confirm it runs without errors:

```
GET https://www.fypro.com.ng/api/notify?action=send-nudges&secret=<CRON_SECRET>
```

Expected response:
```json
{ "ok": true, "sent": 0, "skipped": 1, "cleaned": 0, "errors": 0 }
```

`skipped` means your subscription exists but you've been active recently — correct.

- [ ] **Step 5: Smoke test — Settings toggle**

1. Open Settings page
2. Notifications section — "Push notifications" toggle should appear checked (blue)
3. Toggle it off — row should become unchecked + grayed
4. Check Supabase `push_subscriptions` — your row should be gone

- [ ] **Step 6: Final commit (if any cleanup needed)**

```bash
git add -A
git commit -m "chore: final push notifications cleanup"
```
