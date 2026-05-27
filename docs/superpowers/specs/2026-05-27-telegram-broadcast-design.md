# Telegram Broadcast Feature — Design Spec

**Date:** 2026-05-27
**Status:** Approved
**Scope:** Add `/broadcast` and `/broadcast_paid` admin commands to the existing Telegram bot in `api/notify.js`, delivering messages via Resend email and in-app notification to target users.

---

## Overview

The admin types a command in Telegram to broadcast an announcement to all users or paid users only. The broadcast delivers two ways: a Resend email to each user's registered address, and an in-app notification row inserted into the `notifications` table. The bot replies with a delivery count once complete. No new Vercel function file is created.

---

## Command Syntax

```
/broadcast <message body>
/broadcast_paid <message body>
```

- `/broadcast` — targets all registered users
- `/broadcast_paid` — targets users with at least one `payments` row where `status = 'success'`
- Only the sender whose `message.from.id` matches `TELEGRAM_ADMIN_ID` (integer env var) may trigger a broadcast. Any other sender is silently ignored (return 200, no reply).

---

## Handler Structure

The broadcast check is inserted into `handleTelegramBot` **before** the existing typed-command block. It reads from the original `message.text` (preserving case for the message body) rather than the lowercased `raw` string used by the generic command parser.

```
handleTelegramBot
  ├── webhook secret validation (existing)
  ├── callback_query handler (existing)
  └── message handler
        ├── ── NEW ── broadcast early-exit block
        │     Does text start with /broadcast?
        │       no  → fall through to existing command parser
        │       yes → is from.id === Number(TELEGRAM_ADMIN_ID)?
        │               no  → return 200 (silent ignore)
        │               yes → parse command + body
        │                     → await cmdBroadcast(body, paidOnly, chatId)
        │                     → sendReply confirmation
        │                     → return 200
        └── existing /command parser (unchanged)
```

---

## `cmdBroadcast(body, paidOnly, chatId)` — Data Flow

1. **Fetch all auth users** via existing `listAllUsers()` helper.
2. **If `paidOnly`**: query `payments` table for distinct `user_id` where `status = 'success'`. Filter user list to that set.
3. **Fetch opted-out users**: `SELECT user_id FROM email_preferences WHERE unsubscribed_all = true`. Build a `Set<string>`. Exclude those IDs from the target list.
4. **Send emails** via Resend in batches of 10 concurrent requests:
   - `from`: `FYPro <hello@fypro.com.ng>`
   - `subject`: `FYPro Announcement`
   - `html`: minimal branded template — dark header with logo, white content box, broadcast body text, footer. Matches the style of the existing contact-form email in `handleContact`.
   - Track a `sentCount` counter. On per-batch error: log, continue — partial delivery is preferable to total failure.
5. **Bulk-insert notifications** in one call:
   ```js
   supabaseAdmin.from('notifications').insert(
     targetUsers.map(u => ({
       user_id: u.id,
       type:    'announcement',
       title:   'Announcement from FYPro',
       message: body,
     }))
   )
   ```
   If insert fails: log error, do not block Telegram reply.
6. **Reply to Telegram**: `✅ Broadcast sent to ${sentCount} users`

---

## Email Template

Minimal branded HTML, inline styles. Structure:
- Dark navy header (`#0f172a`) with `fypro-logo.png`
- White content box, Poppins font
- `<p>` containing the broadcast `body` text (HTML-escaped)
- Footer: `You're receiving this because you have an account at fypro.com.ng`

---

## Error Handling

| Scenario | Behaviour |
|---|---|
| Resend batch throws | Log error, continue remaining batches; count only successful sends |
| Supabase notification insert fails | Log error, do not block; Telegram reply still sent |
| `listAllUsers()` throws | Let it propagate — bot sends `❌ Broadcast failed` reply |
| `payments` query fails (paidOnly) | Let it propagate — bot sends `❌ Broadcast failed` reply |
| Non-admin sender | Silent 200, no reply |
| Empty message body | Send reply: `❌ Usage: /broadcast <message>` |

---

## Webhook Registration Script

**File:** `scripts/register-telegram-webhook.js`

A one-time Node script (not a Vercel function). Calls `setWebhook` on the Telegram Bot API:
- `url`: `https://fypro.com.ng/api/notify`
- `secret_token`: `process.env.TELEGRAM_WEBHOOK_SECRET`

Run instructions in a comment at the top of the file:
```
# node scripts/register-telegram-webhook.js
# Requires TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET in env.
# Run once after first deployment or when the webhook URL changes.
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `TELEGRAM_ADMIN_ID` | Your Telegram user ID (integer). Only this sender can trigger broadcasts. Add to Vercel project env. |

All other required env vars (`TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`, `RESEND_API_KEY`, Supabase vars) already exist.

---

## Files Changed

| Action | File |
|---|---|
| Modify | `api/notify.js` — add broadcast early-exit block + `cmdBroadcast()` function |
| Create | `scripts/register-telegram-webhook.js` |

No new Vercel function files. No schema migrations (uses existing `notifications` table and `email_preferences` table).
