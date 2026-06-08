# Monitoring Improvements — Design Spec
Date: 2026-06-08
Status: Approved

---

## Goal

Raise monitoring from 8.5/10 to 9.5/10 by adding three capabilities that are currently missing:
1. External uptime monitoring with Telegram + email alerting
2. Real-time error spike alerts via Telegram
3. PostHog conversion funnel with `paywall_shown` event

---

## 1. Ping Endpoint (Uptime Monitor Health Check)

### What
Add `action=ping` to the existing GET handler in `api/admin.js`.

### Response
```json
{ "ok": true, "service": "fypro", "ts": 1717891200000 }
```
HTTP 200. No authentication required — this is a public endpoint intentionally.

### Why admin.js
Already handles GET requests (`daily-report`, `test-all-alerts`). Adding here costs zero serverless functions, keeping the project within Vercel Hobby's 12-function limit.

### UptimeRobot Setup (external, no code)
- **Monitor type:** HTTPS
- **URL:** `https://www.fypro.com.ng/api/admin?action=ping`
- **Interval:** 5 minutes (free plan maximum)
- **Alert contacts:**
  - Email: `hello@fypro.com.ng` (native UptimeRobot feature)
  - Telegram: UptimeRobot built-in integration — provide `TELEGRAM_BOT_TOKEN` and `TELEGRAM_CHAT_ID` from `.env.local`
- **Alert on:** Down events and recovery events both enabled

---

## 2. Error Rate Alerts

### What
Add `action=error-check` to the GET handler in `api/admin.js`.

### Logic
1. Query `system_logs` for rows where `severity = 'error'` AND `resolved = false` AND `created_at >= NOW() - INTERVAL '24 hours'`
2. If count > 5, send a Telegram alert: `🚨 Error spike: {N} unresolved errors in last 24h — check /errors`
3. Deduplicate: set Redis key `alert:error-spike:{UTC-date}` with 90,000s TTL (25h). Only fire if key did not already exist.

### Auth
Uses existing `verifyCronSecret()` already in `admin.js` — no new auth code.

### Threshold
5 unresolved errors in 24h. Hardcoded constant at top of the handler for easy adjustment.

### cron-job.org — second job
- **URL:** `https://www.fypro.com.ng/api/admin?action=error-check`
- **Header:** `x-cron-secret: <CRON_SECRET>`
- **Schedule:** Every 4 hours (`0 */4 * * *`)
- **Effect:** At most one Telegram alert per UTC day per spike

### Sentry Alert Rule (external, no code)
In Sentry dashboard → Alerts → Create Alert → Issues:
- **Condition:** Number of events > 10 in 1 hour
- **Action:** Email `hello@fypro.com.ng`
- **Purpose:** Real-time spike detection; the cron check handles Telegram summary

---

## 3. PostHog Conversion Funnel

### Code Change — `src/components/PaidFeatureGate.jsx`
Add a `useEffect` inside `UpgradeCard` that fires once on mount:

```js
// Add to existing React import:
import { useEffect } from 'react'
// Add new import (not currently in this file):
import { trackEvent } from '../lib/analytics'

// Inside UpgradeCard, after existing hooks:
useEffect(() => {
  trackEvent('paywall_shown', { pack: requiredPack, location: pathname })
}, [])
```

- `pathname` from `useLocation()` — `useLocation` is already imported in the file
- `requiredPack` is already a prop passed to `UpgradeCard`
- `useEffect` and `trackEvent` are NOT currently imported in `PaidFeatureGate.jsx` — both must be added
- Fires once per mount (not on every render)

### PostHog Funnel Configuration (external, no code)
In PostHog: **Insights → Funnels → New Funnel**

| Step | Event | Filter |
|------|-------|--------|
| 1 | `signed_up` | — |
| 2 | `workflow_step_started` | `step = topic_validator` |
| 3 | `paywall_shown` | — |
| 4 | `payment_initiated` | — |
| 5 | `payment_completed` | — |

- **Conversion window:** 7 days
- **Save as:** "Signup → Payment Conversion"

This reveals drop-off between: (a) reaching the paywall without initiating payment, (b) initiating without completing.

---

## Files Changed

| File | Change |
|------|--------|
| `api/admin.js` | Add `action=ping` and `action=error-check` to GET handler |
| `src/components/PaidFeatureGate.jsx` | Add `paywall_shown` event in `UpgradeCard` on mount |

## External Setup Steps (post-implementation)

1. **UptimeRobot:** Create account → New Monitor → HTTPS → ping URL → add Email + Telegram contacts
2. **cron-job.org:** Add second job for `error-check` every 4 hours with `x-cron-secret` header
3. **Sentry:** Alerts → Create Alert → Issues → > 10 events/hour → email action
4. **PostHog:** Insights → Funnels → configure 5-step funnel → save

---

## What This Does NOT Change
- No new Vercel serverless functions (12-function limit maintained)
- No schema changes (no new Supabase tables or migrations)
- No changes to CSP headers in `vercel.json`
- No changes to rate limiting or caching logic
