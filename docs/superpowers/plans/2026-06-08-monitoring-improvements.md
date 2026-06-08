# Monitoring Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add external uptime monitoring, error spike Telegram alerts, and PostHog paywall conversion tracking to raise monitoring coverage from 8.5/10 to 9.5/10.

**Architecture:** Two new action handlers added to the existing `api/admin.js` router (preserving the 12-function limit); one `useEffect` added to `PaidFeatureGate.jsx` to fire a `paywall_shown` PostHog event on mount.

**Tech Stack:** Vercel serverless (Node.js), Upstash Redis (`@upstash/redis` client already wired), Supabase admin client, Telegram bot API, PostHog (via existing `trackEvent` helper), UptimeRobot (external — config only, no code).

**Spec:** `docs/superpowers/specs/2026-06-08-monitoring-improvements-design.md`

---

## Files Changed

| File | Change |
|------|--------|
| `api/admin.js` | Add `handlePing` and `handleErrorCheck` functions; register both in the router |
| `src/components/PaidFeatureGate.jsx` | Add `useEffect` + `trackEvent` imports; fire `paywall_shown` inside `UpgradeCard` |

---

## Task 1: Add `handlePing` to `api/admin.js`

**Files:**
- Modify: `api/admin.js`

- [ ] **Step 1: Add the handler function**

  In `api/admin.js`, add this function just before the `export default async function handler` line (around line 1880):

  ```js
  // action: "ping" — public health check for UptimeRobot and other external monitors.
  // No auth required. Returns 200 as long as the function is reachable.
  async function handlePing(req, res) {
    return res.status(200).json({ ok: true, service: 'fypro', ts: Date.now() });
  }
  ```

- [ ] **Step 2: Register the action in the router**

  In the `export default async function handler` block, after the line:
  ```js
  if (action === 'sentry_webhook') return handleSentryWebhook(req, res, rawBody);
  ```
  Add:
  ```js
  if (action === 'ping') return handlePing(req, res);
  ```

  The `ping` action must be registered **before** `rawBody` is parsed as JSON, so it works correctly for GET requests with no body. Place it alongside the existing early-dispatch for `sentry_webhook`:

  ```js
  if (action === 'sentry_webhook') return handleSentryWebhook(req, res, rawBody);
  if (action === 'ping')           return handlePing(req, res);
  ```

- [ ] **Step 3: Verify locally**

  Run the dev server:
  ```
  npm run dev
  ```
  In a second terminal:
  ```
  curl -s http://localhost:3000/api/admin?action=ping
  ```
  Expected output:
  ```json
  {"ok":true,"service":"fypro","ts":1717891200000}
  ```
  The `ts` value will be the current epoch timestamp — any number is correct.

- [ ] **Step 4: Commit**

  ```bash
  git add api/admin.js
  git commit -m "feat: add /api/admin?action=ping health check for UptimeRobot"
  ```

---

## Task 2: Add `handleErrorCheck` to `api/admin.js`

**Files:**
- Modify: `api/admin.js`

The error-check handler counts unresolved errors from `system_logs` in the last 24 hours. If count exceeds a threshold (5), it sends a Telegram alert — but only once per UTC day, deduplicated via a Redis key.

- [ ] **Step 1: Add the constant and handler function**

  In `api/admin.js`, add this block just before the `handlePing` function added in Task 1:

  ```js
  const ERROR_SPIKE_THRESHOLD = 5;

  // action: "error-check" — cron-triggered (every 4 hours via cron-job.org).
  // Fires a Telegram alert if unresolved errors in the last 24h exceed the threshold.
  // Deduplicated via Redis so at most one alert fires per UTC day.
  async function handleErrorCheck(req, res) {
    if (!verifyCronSecret(req, res)) return;

    const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const today    = new Date().toISOString().slice(0, 10);

    let errorCount = 0;
    try {
      const { count, error } = await supabaseAdmin
        .from('system_logs')
        .select('*', { count: 'exact', head: true })
        .eq('severity', 'error')
        .eq('resolved', false)
        .gte('created_at', since24h);

      if (error) throw error;
      errorCount = count || 0;
    } catch (err) {
      console.error('[admin/error-check] DB query failed:', err.message);
      return res.status(500).json({ error: 'DB query failed' });
    }

    if (errorCount <= ERROR_SPIKE_THRESHOLD) {
      return res.status(200).json({ ok: true, error_count: errorCount, alert_sent: false });
    }

    // Deduplicate: only fire once per UTC day
    let alertSent = false;
    try {
      const redis     = getAdminRedis();
      const dedupeKey = `alert:error-spike:${today}`;
      const result    = await redis.set(dedupeKey, '1', { nx: true, ex: 90000 });
      // result is 'OK' when the key was freshly set (first alert of the day)
      // result is null when the key already existed (alert already sent today)
      if (result === 'OK') {
        await sendTelegramAlert(
          `🚨 Error spike: <b>${errorCount}</b> unresolved errors in the last 24h\nCheck /errors in the admin bot.`
        );
        alertSent = true;
      }
    } catch (err) {
      console.error('[admin/error-check] Redis/Telegram failed:', err.message);
      // Non-fatal — still return success so cron doesn't retry aggressively
    }

    return res.status(200).json({ ok: true, error_count: errorCount, alert_sent: alertSent });
  }
  ```

- [ ] **Step 2: Register the action in the router**

  In the router block (around line 1930), add alongside the other cron-guarded actions:
  ```js
  if (action === 'error-check') return handleErrorCheck(req, res);
  ```

  Place it near the `daily-report` line for logical grouping:
  ```js
  if (action === 'daily-report')   return handleDailyReport(req, res);
  if (action === 'error-check')    return handleErrorCheck(req, res);
  ```

- [ ] **Step 3: Verify the handler rejects unauthenticated requests**

  Run the dev server (`npm run dev`), then:
  ```
  curl -s http://localhost:3000/api/admin?action=error-check
  ```
  Expected output:
  ```json
  {"error":"Unauthorized"}
  ```
  HTTP status must be 401. If it returns 400 ("Unknown action"), the routing line was not added.

- [ ] **Step 4: Verify the handler accepts authenticated requests**

  With `CRON_SECRET` from your `.env.local`:
  ```
  curl -s -H "x-cron-secret: YOUR_CRON_SECRET" http://localhost:3000/api/admin?action=error-check
  ```
  Expected output (assuming fewer than 5 unresolved errors locally):
  ```json
  {"ok":true,"error_count":0,"alert_sent":false}
  ```
  The exact `error_count` value will vary; what matters is `ok: true` and no 500 error.

- [ ] **Step 5: Commit**

  ```bash
  git add api/admin.js
  git commit -m "feat: add error-check cron endpoint with Telegram spike alert"
  ```

---

## Task 3: Add `paywall_shown` event to `PaidFeatureGate.jsx`

**Files:**
- Modify: `src/components/PaidFeatureGate.jsx`

The `UpgradeCard` component renders when a user hits a paywall gate. We fire `paywall_shown` once on mount with the pack name and current pathname so PostHog can build the conversion funnel.

- [ ] **Step 1: Add `useEffect` to the React import**

  The file currently has no React import (it uses JSX transform). Add a new import at line 1, before the existing imports:

  ```js
  import { useEffect } from 'react'
  import { useLocation } from 'react-router-dom'
  import { usePaidFeatures } from '../hooks/usePaidFeatures'
  import { usePaystackCheckout } from '../hooks/usePaystackCheckout'
  import { trackEvent } from '../lib/analytics'
  ```

  The existing first line is `import { useLocation } from 'react-router-dom'` — replace the top of the file's import block with the five lines above.

- [ ] **Step 2: Add `useLocation` call and `useEffect` inside `UpgradeCard`**

  The `UpgradeCard` function currently begins:
  ```js
  function UpgradeCard({ requiredPack, isUpgrader, handlePay, paying, verifying, payError, blockInfo, setBlockInfo }) {
    const upgradeMeta = isUpgrader ? UPGRADE_META[requiredPack] : null
  ```

  Replace this opening with:
  ```js
  function UpgradeCard({ requiredPack, isUpgrader, handlePay, paying, verifying, payError, blockInfo, setBlockInfo }) {
    const { pathname } = useLocation()

    useEffect(() => {
      trackEvent('paywall_shown', { pack: requiredPack, location: pathname })
    }, [])

    const upgradeMeta = isUpgrader ? UPGRADE_META[requiredPack] : null
  ```

  The `useEffect` empty dependency array `[]` ensures the event fires exactly once when the component mounts. It fires regardless of whether `blockInfo` is set — both states represent the user being blocked from a paid feature. Note: `useLocation()` is also called in the parent `PaidFeatureGate` component — calling it again here in the child is fine and idiomatic (React hooks can be called in any component in the tree).

- [ ] **Step 3: Verify the build passes**

  ```
  npm run build
  ```
  Expected: build completes with no errors. If there are TypeScript/ESLint errors about `useEffect` dependencies, the empty array `[]` is intentional (fire-once-on-mount) — suppress the lint warning with `// eslint-disable-next-line react-hooks/exhaustive-deps` on the line before `}, [])` if your config enforces it.

- [ ] **Step 4: Verify the event fires in the browser**

  Run:
  ```
  npm run dev
  ```
  Open `http://localhost:5173`, sign in as a free user, navigate to a paid feature (e.g., Defense Simulator). Open browser DevTools → Console. You should see a PostHog event fired. To confirm, open the PostHog Live Events view in your PostHog dashboard — you should see `paywall_shown` appear within seconds with `{ pack: "defense_pack", location: "/app/..." }`.

- [ ] **Step 5: Commit**

  ```bash
  git add src/components/PaidFeatureGate.jsx
  git commit -m "feat: track paywall_shown event in PaidFeatureGate for PostHog funnel"
  ```

---

## Task 4: Deploy to Production

- [ ] **Step 1: Push to main**

  ```bash
  git push origin main
  ```
  Vercel will auto-deploy. Wait for the deployment to complete (check Vercel dashboard or watch the build logs).

- [ ] **Step 2: Verify ping endpoint on production**

  ```
  curl -s https://www.fypro.com.ng/api/admin?action=ping
  ```
  Expected:
  ```json
  {"ok":true,"service":"fypro","ts":1717891200000}
  ```

- [ ] **Step 3: Verify error-check endpoint on production**

  ```
  curl -s -H "x-cron-secret: YOUR_CRON_SECRET" https://www.fypro.com.ng/api/admin?action=error-check
  ```
  Expected:
  ```json
  {"ok":true,"error_count":0,"alert_sent":false}
  ```
  (or a non-zero count if real errors exist in production)

---

## Task 5: External Configuration (No Code)

These steps are done manually in external dashboards after deploying.

### 5a — UptimeRobot

- [ ] Go to [uptimerobot.com](https://uptimerobot.com) and create a free account
- [ ] Click **Add New Monitor**
- [ ] Settings:
  - Monitor Type: **HTTPS**
  - Friendly Name: `FYPro Production`
  - URL: `https://www.fypro.com.ng/api/admin?action=ping`
  - Monitoring Interval: **5 minutes**
- [ ] Under **Alert Contacts**, click **Add Alert Contact**:
  - Type: **Email** → enter `hello@fypro.com.ng` → Save
- [ ] Add a second alert contact:
  - Type: **Telegram** → click **Connect Telegram** → you will be prompted to message the UptimeRobot bot your Bot Token and Chat ID
  - Alternatively: go to **My Settings → Integrations → Telegram** and enter:
    - Bot Token: value of `TELEGRAM_BOT_TOKEN` from `.env.local`
    - Chat ID: value of `TELEGRAM_CHAT_ID` from `.env.local`
- [ ] Enable both **Down** and **Up (Recovery)** alert events
- [ ] Save the monitor

### 5b — cron-job.org (second job)

- [ ] Go to [cron-job.org](https://cron-job.org) and log in to your existing account
- [ ] Click **Create cronjob**
- [ ] Settings:
  - Title: `FYPro Error Check`
  - URL: `https://www.fypro.com.ng/api/admin?action=error-check`
  - Schedule: **Every 4 hours** (select "Custom" → cron expression `0 */4 * * *`)
- [ ] Under **Advanced → Request Headers**, add:
  - Header name: `x-cron-secret`
  - Header value: the value of `CRON_SECRET` from your Vercel environment variables
- [ ] Save and enable the job
- [ ] Click **Run now** to test immediately — check your Vercel logs to confirm the endpoint was called and returned 200

### 5c — Sentry Alert Rule

- [ ] Open [sentry.io](https://sentry.io) → your FYPro project → **Alerts** → **Create Alert**
- [ ] Alert type: **Issues**
- [ ] Settings:
  - Environment: `production`
  - Trigger: **Number of events** `is more than` `10` `in 1 hour`
  - Action: **Send an email** → `hello@fypro.com.ng`
  - Alert name: `Error Rate Spike`
- [ ] Save the rule

### 5d — PostHog Conversion Funnel

- [ ] Open your PostHog project → **Insights** → **New Insight** → **Funnels**
- [ ] Add steps in order:
  1. Event: `signed_up`
  2. Event: `workflow_step_started` → filter: Property `step` = `topic_validator`
  3. Event: `paywall_shown`
  4. Event: `payment_initiated`
  5. Event: `payment_completed`
- [ ] Set **Conversion window**: 7 days
- [ ] Click **Save** → name it: `Signup → Payment Conversion`
- [ ] Note: `paywall_shown` data only accumulates from the deploy date forward — the funnel will show meaningful data within 48–72 hours of deploying Task 3

---

## Verification Checklist

After completing all tasks, confirm:

- [ ] `curl https://www.fypro.com.ng/api/admin?action=ping` returns `{"ok":true,...}`
- [ ] UptimeRobot shows the monitor as **Up**
- [ ] `curl -H "x-cron-secret: ..." https://www.fypro.com.ng/api/admin?action=error-check` returns `{"ok":true,...}`
- [ ] cron-job.org last run shows HTTP 200
- [ ] PostHog Live Events shows `paywall_shown` events when hitting a paywall gate
- [ ] Sentry alert rule is active (green dot in Alerts list)
