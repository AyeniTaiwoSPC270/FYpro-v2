# Login Notifications — Design

Date: 2026-07-24
Status: Approved for planning

## Problem

Logging in currently produces no signal for the user or the admin. Signups,
payments, defense completions, and project creation all fire a Telegram alert
(`api/_lib/telegram.js`) — logins do not. There is also no user-facing
confirmation that a login happened, which is a common lightweight security
signal (banks, Google, etc. all send this).

## Scope

- Fire a Telegram alert **and** a user-facing email on every successful login.
- Cover both login paths: email/password (`api/auth.js`) and Google OAuth
  (`src/pages/auth/AuthConfirm.jsx`).
- No new Vercel serverless function — the project is at the 12-function Hobby
  plan limit (see CLAUDE.md §12). Everything routes through three existing
  endpoints: `api/auth.js`, `api/notify.js`, `api/send-nurture-email.ts`.
- Out of scope (explicitly deferred, not blocking this change): new-device/new-IP
  detection, geo-IP lookup, per-user opt-out of login alerts specifically,
  alerting on failed login attempts (already covered by the existing
  brute-force Telegram alerts in `handleLogin`).

## Architecture

### Path 1 — Email/password login (`api/auth.js`)

In `handleLogin`, immediately after the existing `success` check (currently
around line 104-110, right after `logAttempt(email, ip, 'login', success)` and
before the `200` response), add two fire-and-forget calls — not awaited, each
with `.catch(() => null)`, matching the existing style used for the brute-force
alerts a few lines above in the same function. This keeps login latency for
the user completely unaffected:

1. `sendTelegramAlert(...)` — see Telegram format below.
2. `fetch('${APP_URL}/api/send-nurture-email', { emailType: 'login_alert', ... })`
   — same call shape `handleSignup` already uses to trigger the welcome email,
   authenticated with `CRON_SECRET` as bearer token.

Only fires on `success === true`. Failed logins are unaffected (already
covered by existing rate-limit/brute-force alerting).

### Path 2 — Google OAuth login (`src/pages/auth/AuthConfirm.jsx`)

OAuth logins never touch `api/auth.js` — the client calls
`supabase.auth.exchangeCodeForSession(code)` directly. This file already has
a precedent for exactly this problem: when `isNewGoogleSignup` is `true`
(account age < 2 minutes), it fires:

```js
fetch('/api/notify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${oauthData.session.access_token}` },
  body: JSON.stringify({ action: 'oauth_signup' }),
})
```

Add an `else` branch (existing user, i.e. not a new signup) that fires the
same shape with `action: 'oauth_login'` instead. The access token is passed
as bearer auth so the server can verify identity — never trust user info from
the request body.

Server side, in `api/notify.js`'s `handleNotify`:
- Add `'oauth_login'` to `ALLOWED_ACTIONS`.
- Token is already verified via `supabaseAdmin.auth.getUser(token)` before
  any action runs (existing code, line ~1228) — reuse `user.email`/`user.id`
  from that verified lookup, not anything from `payload`.
- On `oauth_login`: fire the same Telegram alert as Path 1, and call
  `send-nurture-email` the same way (server-to-server, using `CRON_SECRET`).
- IP is available via the existing `getIp`-style header read
  (`x-forwarded-for`); User-Agent via `req.headers['user-agent']`.

### Telegram alert format

Matches the existing alert style (`👤 New signup: ...`, `💰 Payment received`):

```
🔓 Login: user@example.com (IP: 105.112.x.x)
```

One line, no PII beyond what other alerts already include (email, IP —
consistent with existing brute-force alerts which already show IP).

### Email content (`api/send-nurture-email.ts`)

Add `'login_alert'` to the `EmailType` union. New template, matching the
existing "Dark Prestige" visual style (`wrap()` helper, same logo/footer
structure) but with:

- Pill label: `Security` (neutral, not alarming — this fires on every normal
  login, so it should read as a routine notice, not a warning).
- Body: first name, login time (formatted WAT), IP address, truncated
  User-Agent string (~80 chars, no parsing/geo-IP — avoids a new dependency
  for a nice-to-have), and a "wasn't you? reset your password" link to
  `/forgot-password`.
- **No** `List-Unsubscribe` header and **no** `email_preferences` gating —
  unlike `welcome`/`defense_nudge`/`urgency_reminder`, this is a security
  notice, not a marketing/nurture email, so it always sends.

**`email_log` decision:** `email_log` has `UNIQUE(user_id, email_type)`
(`scripts/staging-schema.sql:489`) — it backstops the "send once ever" contract
of the three existing email types. Logging `login_alert` the same way would
mean every login after the first hits a constraint conflict (the email would
still send, since Resend fires before the log insert, but the log row would
be silently wrong for this type going forward).

Decision: **skip the `email_log` insert entirely for `login_alert`.** Send via
Resend, return `{ ok: true }`, done. Leave a one-line comment in the handler
explaining why this type is exempt, so it doesn't read as an oversight later.

## Error handling

- Both side effects (Telegram, email) are fire-and-forget with `.catch(() =>
  null)` at the call site in `auth.js`/`AuthConfirm.jsx` — a Resend or
  Telegram outage never blocks or fails a login.
- Inside `send-nurture-email.ts`, the existing failure path already applies:
  if `resend.emails.send()` throws, `sendTelegramAlert('🔴 Nurture email
  failed: ...')` fires as a fallback — no new failure path needed.
- No new env vars. No new CSP entries (Resend/Telegram calls are server-side
  only, already wired).

## Testing / rollout

`send-nurture-email.ts` has no existing test file (consistent with the
project's partial coverage, per CLAUDE.md §17 — "mainly lib/generateReport").
Not adding test infra as a prerequisite for this change. Manual verification
after implementation:

1. Password login against a real inbox — confirm email arrives, Telegram
   alert fires.
2. Google OAuth login (existing user) — same two checks.
3. Failed password login — confirm neither fires (existing brute-force
   alerts are unaffected/still correct).
4. New signup (both password and Google) — confirm the *existing* welcome
   flow is unaffected and a spurious `login_alert` doesn't also fire on the
   same request (Path 1 only fires from `handleLogin`, never `handleSignup`;
   Path 2's `else` branch is explicitly gated on `!isNewGoogleSignup`).

## Files touched

- `api/auth.js` — `handleLogin`, two fire-and-forget calls after success.
- `src/pages/auth/AuthConfirm.jsx` — `else` branch alongside the existing
  `isNewGoogleSignup` check.
- `api/notify.js` — `ALLOWED_ACTIONS` + `oauth_login` handler in `handleNotify`.
- `api/send-nurture-email.ts` — new `login_alert` `EmailType`, subject/HTML/text,
  skip `email_log` insert for this type.
