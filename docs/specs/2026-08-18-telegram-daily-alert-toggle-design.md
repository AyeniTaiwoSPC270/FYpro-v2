# Telegram Daily Alert Toggle — Design

## Problem

The daily Telegram report (cron-job.org → `GET /api/admin?action=daily-report` at
20:00 UTC / 9PM WAT) always fires via `sendTelegramAlert()` in `handleDailyReport`
(`api/admin.js`). There's no way to mute it without editing code or removing the
cron job entirely. The admin wants a Telegram-native way — ideally a tappable
button — to turn it on/off.

## Scope

Only the daily 9PM report is affected. All other outbound Telegram alerts
(new signup, payment received/failed, spend cap warnings, generation failed,
defense completed, new project, payment issue, user report, credential
stuffing) are untouched and keep firing regardless of this toggle.

## Storage

New `app_config` key: `daily_report_enabled` (string `'true'`/`'false'`).
No migration needed — `app_config` (migration 0015) already exists as a
generic key/value table.

Default when no row exists: **enabled** (`true`) — preserves current behavior
for the existing deployment, which has always sent this report.

This differs from the existing `maintenance_mode` / `express_beta_free` flags,
which default to `false` (off) when unset — those are safe-by-default toggles
for gating destructive/free behavior; this one is a preference toggle that
should default to today's actual behavior.

## New file: `api/_lib/daily-report-pref.js`

Mirrors `api/_lib/maintenance.js` exactly (Redis-cached, 30s TTL, Supabase
fallback/source of truth):

```
export async function getDailyReportEnabled()       // returns boolean, defaults true if no row
export async function setDailyReportEnabled(enabled) // upserts app_config row + updates Redis cache
```

## Bot UX changes (`api/notify.js`)

- New `cmdAlerts(args)`:
  - If `args[0]` is `'on'` or `'off'`, calls `setDailyReportEnabled(...)` first.
  - Always returns current status: `🔔 ON — you will receive the daily 9PM WAT report`
    or `🔕 OFF — daily report is muted`.
  - Reachable via typed `/alerts`, `/alerts on`, `/alerts off` (consistent with
    the existing `/maintenance on|off` and `/beta on|off` commands).
- New `alertsKeyboard(enabled)` — a single-button inline keyboard whose label
  flips based on current state (`🔕 Turn OFF` when on, `🔔 Turn ON` when off),
  with `callback_data` of `alerts_on` / `alerts_off`.
- Main bot menu (`KEYBOARD` constant): add a `📊 Alerts` button
  (`callback_data: 'alerts'`) alongside the existing Maintenance/Express Beta
  row.
- `cmdHelp()`: add `/alerts [on|off] — toggle the daily 9PM report` under
  **🔧 Controls**.

### Callback routing

The `callback_query` handler currently always re-attaches the main `KEYBOARD`
after running a command. For the alerts flow specifically (`cq.data` is
`alerts`, `alerts_on`, or `alerts_off`), it instead re-attaches
`alertsKeyboard(currentState)` so the toggle button stays live and reflects
the new state after each tap. `alerts_on`/`alerts_off` map to
`cmdAlerts(['on'])`/`cmdAlerts(['off'])` internally — same code path as the
typed command.

The typed `/alerts` command gets the same treatment in the main message
handler: reply is sent with `alertsKeyboard(...)` instead of the main
`KEYBOARD`.

## Gate in `handleDailyReport` (`api/admin.js`)

Immediately before `await sendTelegramAlert(message)`:

```js
if (await getDailyReportEnabled()) {
  await sendTelegramAlert(message);
} else {
  console.log('[admin/daily-report] skipped — disabled via Telegram /alerts toggle');
}
```

The cleanup logic earlier in the handler (purging abandoned unpaid Express
projects) is unrelated to notification delivery and keeps running
unconditionally either way.

## Out of scope

- No changes to any other alert type.
- No admin dashboard UI — Telegram-only, per the request.
- No new Vercel serverless function — reuses `notify` and `admin` (currently
  at the 12-function Hobby-plan limit).
