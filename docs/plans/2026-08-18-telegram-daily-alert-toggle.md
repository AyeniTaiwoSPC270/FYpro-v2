# Telegram Daily Alert Toggle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the admin mute/unmute the daily 9PM WAT Telegram report via a tappable inline-keyboard button (and a matching `/alerts on|off` typed command), without affecting any other Telegram alert type.

**Architecture:** A new `app_config`-backed, Redis-cached preference (`daily_report_enabled`, default `true`) mirrors the existing `maintenance_mode` pattern. `api/notify.js` gets a new bot command (`/alerts`) with a self-updating toggle button. `api/admin.js`'s `handleDailyReport` checks the flag right before sending the report and skips the send when disabled.

**Tech Stack:** Vercel serverless functions (`api/notify.js`, `api/admin.js`, `api/_lib/`), Supabase (`app_config` table, no migration needed), Upstash Redis (30s cache), Telegram Bot API (inline keyboards, `editMessageText`, `answerCallbackQuery`).

Spec: `docs/specs/2026-08-18-telegram-daily-alert-toggle-design.md`

---

## File Structure

- **Create:** `api/_lib/daily-report-pref.js` — `getDailyReportEnabled()` / `setDailyReportEnabled(enabled)`, same shape as `api/_lib/maintenance.js`.
- **Modify:** `api/notify.js` — import the new helper; add `cmdAlerts()` + `alertsKeyboard()`; wire `alerts` into `runCommand`; add the button to the main `KEYBOARD`; update `cmdHelp()`; branch the callback-query and typed-command reply paths to use `alertsKeyboard()` for the alerts flow.
- **Modify:** `api/admin.js` — import `getDailyReportEnabled`; gate the `sendTelegramAlert(message)` call in `handleDailyReport`.

No new migration (`app_config` already exists). No new Vercel function (stays within the 12-function Hobby-plan limit — see `CLAUDE.md` §12).

There is no existing test suite for Telegram-bot command handlers or for `api/_lib/maintenance.js` / `api/_lib/express-beta.js` (verified: no matching `*.test.*` files) — this codebase's established pattern for this class of file is manual/production verification, not unit tests. This plan follows that pattern: each task is verified with `node --check` (syntax) plus a final live-bot smoke test, and the full suite (`npm run typecheck && npm run test`) is run once at the end to catch any regression elsewhere.

---

### Task 1: Create the `daily_report_enabled` preference helper

**Files:**
- Create: `api/_lib/daily-report-pref.js`

- [ ] **Step 1: Write the file**

```js
// Daily report alert preference — used by api/admin.js (handleDailyReport) and
// the Telegram bot's /alerts command (api/notify.js).
// Unlike maintenance_mode / express_beta_free, this defaults to ENABLED when
// no app_config row exists yet, preserving the existing always-on behavior.

import { Redis } from '@upstash/redis';
import { supabaseAdmin } from './supabase-admin.js';

const REDIS_KEY = 'app:daily_report_enabled';
const REDIS_TTL = 30; // seconds

const redis = new Redis({
  url:   process.env.UPSTASH_REDIS_REST_URL,
  token: process.env.UPSTASH_REDIS_REST_TOKEN,
});

export async function getDailyReportEnabled() {
  try {
    const cached = await redis.get(REDIS_KEY);
    if (cached !== null && cached !== undefined) {
      return cached === 'true' || cached === true;
    }
  } catch {
    // Redis unavailable — fall through to Supabase
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('app_config')
      .select('value')
      .eq('key', 'daily_report_enabled')
      .maybeSingle();

    if (error) return true;

    // No row yet = never toggled = preserve the existing always-on default
    const enabled = data ? data.value !== 'false' : true;

    redis.set(REDIS_KEY, String(enabled), { ex: REDIS_TTL }).catch(() => {});

    return enabled;
  } catch {
    return true;
  }
}

export async function setDailyReportEnabled(enabled) {
  const { error } = await supabaseAdmin
    .from('app_config')
    .upsert({
      key:        'daily_report_enabled',
      value:      String(enabled),
      updated_at: new Date().toISOString(),
    });

  if (error) throw error;

  await redis.set(REDIS_KEY, String(enabled), { ex: REDIS_TTL }).catch(() => {});
}
```

- [ ] **Step 2: Syntax-check the file**

Run: `node --check "api/_lib/daily-report-pref.js"`
Expected: no output, exit code 0.

- [ ] **Step 3: Commit**

```bash
git add api/_lib/daily-report-pref.js
git commit -m "feat: add daily_report_enabled preference helper"
```

---

### Task 2: Add the `/alerts` bot command and toggle keyboard to `api/notify.js`

**Files:**
- Modify: `api/notify.js:13` (imports)
- Modify: `api/notify.js:622` (after `cmdMaintenance`, before `cmdBroadcast`)
- Modify: `api/notify.js:1001-1032` (`cmdHelp`)
- Modify: `api/notify.js:1034-1069` (`KEYBOARD`)
- Modify: `api/notify.js:1073-1095` (`runCommand`)

- [ ] **Step 1: Add the import**

In `api/notify.js`, find this existing import (currently line 13):

```js
import { setMaintenanceMode } from './_lib/maintenance.js'
```

Add a new import directly after it:

```js
import { setMaintenanceMode } from './_lib/maintenance.js'
import { getDailyReportEnabled, setDailyReportEnabled } from './_lib/daily-report-pref.js'
```

- [ ] **Step 2: Add `cmdAlerts`**

Find the end of `cmdMaintenance` (currently ends at line 622):

```js
async function cmdMaintenance(args) {
  const onOff = args[0]?.toLowerCase()
  if (onOff !== 'on' && onOff !== 'off') {
    return '❌ Usage: /maintenance on | /maintenance off'
  }

  const enabled = onOff === 'on'

  try {
    await setMaintenanceMode(enabled)
    const status = enabled ? '🔴 ENABLED' : '🟢 DISABLED'
    return `🔧 Maintenance mode ${status}`
  } catch (err) {
    return `❌ Failed to toggle maintenance mode: ${err.message}`
  }
}
```

Add a new function directly after it:

```js
async function cmdAlerts(args) {
  const onOff = args[0]?.toLowerCase()
  if (onOff === 'on' || onOff === 'off') {
    try {
      await setDailyReportEnabled(onOff === 'on')
    } catch (err) {
      return `❌ Failed to toggle daily report alerts: ${err.message}`
    }
  }

  const enabled = await getDailyReportEnabled()
  const status = enabled
    ? '🔔 <b>ON</b> — you will receive the daily 9PM WAT report'
    : '🔕 <b>OFF</b> — daily report is muted'
  return `📊 <b>Daily Report Alerts</b>\n\nStatus: ${status}`
}

function alertsKeyboard(enabled) {
  return {
    inline_keyboard: [[
      enabled
        ? { text: '🔕 Turn OFF', callback_data: 'alerts_off' }
        : { text: '🔔 Turn ON',  callback_data: 'alerts_on'  },
    ]],
  }
}
```

- [ ] **Step 3: Wire `alerts` into `runCommand`**

Find (currently line ~1090-1091):

```js
  else if (key === 'maintenance'     ) return cmdMaintenance(args)
  else if (key === 'beta'            ) return cmdBeta(args)
```

Replace with:

```js
  else if (key === 'maintenance'     ) return cmdMaintenance(args)
  else if (key === 'beta'            ) return cmdBeta(args)
  else if (key === 'alerts'          ) return cmdAlerts(args)
```

- [ ] **Step 4: Add the button to the main `KEYBOARD`**

Find (currently lines 1064-1067):

```js
    [
      { text: '🔧 Maintenance', callback_data: 'maintenance' },
      { text: '🎓 Express Beta', callback_data: 'beta'       },
    ],
  ],
}
```

Replace with:

```js
    [
      { text: '🔧 Maintenance', callback_data: 'maintenance' },
      { text: '🎓 Express Beta', callback_data: 'beta'       },
    ],
    [
      { text: '📊 Alerts', callback_data: 'alerts' },
    ],
  ],
}
```

- [ ] **Step 5: Document it in `cmdHelp()`**

Find (currently lines 1020-1023):

```js
<b>🔧 Controls</b>
/maintenance on|off — toggle maintenance mode (blocks all AI generation)
/beta on|off — toggle Express Defence beta (makes Express free for all users)
```

Replace with:

```js
<b>🔧 Controls</b>
/maintenance on|off — toggle maintenance mode (blocks all AI generation)
/beta on|off — toggle Express Defence beta (makes Express free for all users)
/alerts on|off — toggle the daily 9PM WAT report
```

- [ ] **Step 6: Syntax-check the file**

Run: `node --check "api/notify.js"`
Expected: no output, exit code 0.

- [ ] **Step 7: Commit**

```bash
git add api/notify.js
git commit -m "feat: add /alerts bot command to toggle the daily report"
```

---

### Task 3: Make the toggle button actually toggle in place (callback + typed-command routing)

**Files:**
- Modify: `api/notify.js:1097-1138` (`handleTelegramBot` — `callback_query` branch)
- Modify: `api/notify.js:1212-1228` (`handleTelegramBot` — typed-command reply)

Without this task, tapping "Turn OFF"/"Turn ON" would hit `runCommand('alerts_on', [])` (no matching case → `null` reply) and, on the typed-command side, `/alerts` would still work but keep re-attaching the main menu `KEYBOARD` instead of the toggle button — the admin would have to retype `/alerts` after every tap.

- [ ] **Step 1: Update the callback_query branch**

Find (currently lines 1116-1138):

```js
  if (body?.callback_query) {
    const cq      = body.callback_query
    const chatId  = cq.message?.chat?.id
    const msgId   = cq.message?.message_id
    const admId   = String(process.env.TELEGRAM_CHAT_ID)

    if (String(chatId) !== admId) return res.status(200).end()

    try {
      const reply = await runCommand(cq.data, [])
      if (reply) {
        const edited = await editMessage(chatId, msgId, reply, KEYBOARD)
        if (!edited) await sendReply(chatId, reply, KEYBOARD)
      }
      await answerCallbackQuery(cq.id)
    } catch (err) {
      console.error('[notify/bot] callback error:', err.message)
      await answerCallbackQuery(cq.id)
      await sendReply(chatId, `❌ Command failed — check server logs`, KEYBOARD)
    }

    return res.status(200).end()
  }
```

Replace with:

```js
  if (body?.callback_query) {
    const cq      = body.callback_query
    const chatId  = cq.message?.chat?.id
    const msgId   = cq.message?.message_id
    const admId   = String(process.env.TELEGRAM_CHAT_ID)

    if (String(chatId) !== admId) return res.status(200).end()

    let cbKey  = cq.data
    let cbArgs = []
    if (cbKey === 'alerts_on')  { cbKey = 'alerts'; cbArgs = ['on'] }
    if (cbKey === 'alerts_off') { cbKey = 'alerts'; cbArgs = ['off'] }
    const isAlertsFlow = cbKey === 'alerts'

    try {
      const reply = await runCommand(cbKey, cbArgs)
      if (reply) {
        const kb     = isAlertsFlow ? alertsKeyboard(await getDailyReportEnabled()) : KEYBOARD
        const edited = await editMessage(chatId, msgId, reply, kb)
        if (!edited) await sendReply(chatId, reply, kb)
      }
      await answerCallbackQuery(cq.id)
    } catch (err) {
      console.error('[notify/bot] callback error:', err.message)
      await answerCallbackQuery(cq.id)
      await sendReply(chatId, `❌ Command failed — check server logs`, KEYBOARD)
    }

    return res.status(200).end()
  }
```

- [ ] **Step 2: Update the typed-command reply**

Find (currently lines 1212-1228):

```js
  const raw    = msgText.toLowerCase().split('@')[0]

  if (!raw.startsWith('/')) return res.status(200).end()

  const parts  = raw.slice(1).split(' ')
  const key    = parts[0]
  const args   = parts.slice(1)
  const cmdKey = key === 'start' ? 'help' : key

  try {
    const reply = await runCommand(cmdKey, args)
    if (!reply) return res.status(200).end()
    await sendReply(chatId, reply, KEYBOARD)
  } catch (err) {
    console.error('[notify/bot] command error:', err.message)
    await sendReply(chatId, `❌ Command failed — check server logs`, KEYBOARD)
  }
```

Replace with:

```js
  const raw    = msgText.toLowerCase().split('@')[0]

  if (!raw.startsWith('/')) return res.status(200).end()

  const parts  = raw.slice(1).split(' ')
  const key    = parts[0]
  const args   = parts.slice(1)
  const cmdKey = key === 'start' ? 'help' : key

  try {
    const reply = await runCommand(cmdKey, args)
    if (!reply) return res.status(200).end()
    const kb = cmdKey === 'alerts' ? alertsKeyboard(await getDailyReportEnabled()) : KEYBOARD
    await sendReply(chatId, reply, kb)
  } catch (err) {
    console.error('[notify/bot] command error:', err.message)
    await sendReply(chatId, `❌ Command failed — check server logs`, KEYBOARD)
  }
```

- [ ] **Step 3: Syntax-check the file**

Run: `node --check "api/notify.js"`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add api/notify.js
git commit -m "feat: route /alerts taps and typed commands to the toggle keyboard"
```

---

### Task 4: Gate the daily report send on the preference

**Files:**
- Modify: `api/admin.js:10` (imports)
- Modify: `api/admin.js` — inside `handleDailyReport`, the `sendTelegramAlert(message)` call (currently line 1864)

- [ ] **Step 1: Add the import**

Find (currently line 10):

```js
import { setMaintenanceMode as setMaintenanceModeLib } from './_lib/maintenance.js';
```

Add directly after it:

```js
import { setMaintenanceMode as setMaintenanceModeLib } from './_lib/maintenance.js';
import { getDailyReportEnabled } from './_lib/daily-report-pref.js';
```

- [ ] **Step 2: Gate the send**

Find, inside `handleDailyReport` (currently lines 1864-1865):

```js
    await sendTelegramAlert(message);
    return res.status(200).json({ ok: true });
```

Replace with:

```js
    if (await getDailyReportEnabled()) {
      await sendTelegramAlert(message);
    } else {
      console.log('[admin/daily-report] skipped — disabled via Telegram /alerts toggle');
    }
    return res.status(200).json({ ok: true });
```

- [ ] **Step 3: Syntax-check the file**

Run: `node --check "api/admin.js"`
Expected: no output, exit code 0.

- [ ] **Step 4: Commit**

```bash
git add api/admin.js
git commit -m "feat: skip the daily Telegram report when disabled via /alerts"
```

---

### Task 5: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Typecheck**

Run: `npm run typecheck`
Expected: exits 0, no new errors. (These are plain `.js` files under `api/`, so this mainly confirms nothing elsewhere broke.)

- [ ] **Step 2: Run the test suite**

Run: `npm run test`
Expected: exits 0, same pass count as before this change (no test file targets `api/notify.js`, `api/admin.js`, or `api/_lib/daily-report-pref.js`, so no new tests are expected to appear — this just confirms no regression).

- [ ] **Step 3: Run the API function/structure linters**

Run: `npm run lint:api`
Expected: exits 0 — confirms the function count is still within the 12-function Hobby-plan limit (no new `api/*.js` top-level file was added) and no other structural rule was broken.

- [ ] **Step 4: Post-deploy live smoke test (manual, after this branch ships to production)**

In Telegram, message `@fypro_admin_bot`:
1. Send `/alerts` → expect a message showing `🔔 ON — you will receive the daily 9PM WAT report` with a single `🔕 Turn OFF` button.
2. Tap `🔕 Turn OFF` → the same message should update in place to `🔕 OFF — daily report is muted` with a `🔔 Turn ON` button.
3. Send `/start` (or tap any other menu button) → confirm the main menu still shows all existing buttons plus a new `📊 Alerts` button, and that tapping it opens the same toggle screen from step 1/2.
4. Tap `🔔 Turn ON` to restore the default (report enabled) before the next scheduled 20:00 UTC run, unless muting it was intentional.

- [ ] **Step 5: Confirm the design spec and plan stay in sync (no code change)**

Re-read `docs/specs/2026-08-18-telegram-daily-alert-toggle-design.md` against the final diff (`git diff main...HEAD -- api/`) and confirm every section of the spec is reflected: scope (daily report only), storage (`app_config` key `daily_report_enabled`, default enabled), the `/alerts` command + toggle button, and the gate in `handleDailyReport`. No action needed if it matches — this is a final consistency check, not a new task.
