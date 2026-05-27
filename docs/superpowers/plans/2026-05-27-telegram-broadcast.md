# Telegram Broadcast Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `/broadcast` and `/broadcast_paid` admin commands to the existing Telegram bot in `api/notify.js`, delivering messages via Resend email and in-app notification to target users.

**Architecture:** Two new functions added inside `api/notify.js` — `buildBroadcastHtml` (email template) and `cmdBroadcast` (delivery logic). A broadcast early-exit block is inserted into `handleTelegramBot` before the existing generic command parser. A separate one-time webhook registration script is created at `scripts/register-telegram-webhook.js`. No new Vercel function files.

**Tech Stack:** Resend (existing), Supabase service role (existing), Telegram Bot API (existing), Node.js fetch

---

## File Map

| Action | File | Responsibility |
|---|---|---|
| Modify | `api/notify.js` | Add `buildBroadcastHtml`, `cmdBroadcast`, broadcast early-exit block |
| Create | `scripts/register-telegram-webhook.js` | One-time webhook registration |

---

## Task 1 — Add `buildBroadcastHtml` helper to `notify.js`

**Files:**
- Modify: `api/notify.js` — insert after the `bar()` helper at line 45

### Steps

- [ ] **Step 1: Add the function**

Open `api/notify.js`. After the `bar()` function (line 45, just before the `// ─── Telegram send ───` comment), insert:

```js
function buildBroadcastHtml(body) {
  const safe = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  return `<!DOCTYPE html><html><head>
    <style>
      body { margin:0; padding:0; background:#F0F4F8; font-family:'Poppins',Arial,sans-serif; }
      .wrapper { max-width:560px; margin:32px auto; }
      .header { background:#0f172a; border-radius:12px 12px 0 0; padding:24px; text-align:center; }
      .header img { height:36px; width:auto; }
      .box { background:#fff; border-radius:0 0 12px 12px; padding:40px; }
      .msg { font-size:15px; color:#111827; line-height:1.7; }
      hr { border:none; border-top:1px solid #E5E7EB; margin:24px 0; }
      .foot { font-size:12px; color:#9CA3AF; }
    </style>
  </head><body>
    <div class="wrapper">
      <div class="header">
        <img src="https://fypro.com.ng/fypro-logo.png" alt="FYPro" />
      </div>
      <div class="box">
        <p class="msg">${safe}</p>
        <hr>
        <p class="foot">You're receiving this because you have an account at fypro.com.ng.</p>
      </div>
    </div>
  </body></html>`
}
```

- [ ] **Step 2: Verify the file still parses**

```bash
node --input-type=module < api/notify.js
```

Expected: exits without error (the file uses top-level `import`, so Node ESM mode is required). If it errors with `Cannot use import statement`, that's fine — it means the file is valid ES module syntax being run outside its Vercel context. Any other syntax error means the paste has a problem.

- [ ] **Step 3: Commit**

```bash
git add api/notify.js
git commit -m "feat(broadcast): add buildBroadcastHtml email template helper"
```

---

## Task 2 — Add `cmdBroadcast` to `notify.js`

**Files:**
- Modify: `api/notify.js` — insert after `cmdMaintenance`, before `cmdHelp` (around line 517)

### Steps

- [ ] **Step 1: Add the function**

Open `api/notify.js`. Insert the following after the closing `}` of `cmdMaintenance` (around line 532) and before `function cmdHelp()`:

```js
async function cmdBroadcast(body, paidOnly) {
  // 1. Fetch all auth users
  const allUsers = await listAllUsers()

  // 2. Narrow to paid users if requested
  let targetUsers = allUsers
  if (paidOnly) {
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('user_id')
      .eq('status', 'success')
    const paidIds = new Set((payments || []).map(p => p.user_id))
    targetUsers = allUsers.filter(u => paidIds.has(u.id))
  }

  // 3. Remove globally unsubscribed users
  const { data: optedOut } = await supabaseAdmin
    .from('email_preferences')
    .select('user_id')
    .eq('unsubscribed_all', true)
  const optedOutIds = new Set((optedOut || []).map(r => r.user_id))
  targetUsers = targetUsers.filter(u => u.email && !optedOutIds.has(u.id))

  if (targetUsers.length === 0) return 0

  // 4. Send emails in batches of 10
  const resend = new Resend(process.env.RESEND_API_KEY)
  const html   = buildBroadcastHtml(body)
  let sentCount = 0

  for (let i = 0; i < targetUsers.length; i += 10) {
    const batch = targetUsers.slice(i, i + 10)
    await Promise.all(
      batch.map(async u => {
        try {
          const { error } = await resend.emails.send({
            from:    'FYPro <hello@fypro.com.ng>',
            to:      u.email,
            subject: 'FYPro Announcement',
            html,
          })
          if (!error) sentCount++
        } catch (err) {
          console.error('[notify/broadcast] Resend failed for', u.email, err.message)
        }
      })
    )
  }

  // 5. Bulk-insert in-app notifications (best-effort)
  const { error: insertError } = await supabaseAdmin
    .from('notifications')
    .insert(
      targetUsers.map(u => ({
        user_id: u.id,
        type:    'announcement',
        title:   'Announcement from FYPro',
        message: body,
      }))
    )
  if (insertError) {
    console.error('[notify/broadcast] notification insert failed:', insertError.message)
  }

  return sentCount
}
```

- [ ] **Step 2: Verify parse**

```bash
node --input-type=module < api/notify.js
```

Expected: exits without error (or the known `Cannot use import statement` message which is fine — just no syntax errors).

- [ ] **Step 3: Commit**

```bash
git add api/notify.js
git commit -m "feat(broadcast): add cmdBroadcast delivery function"
```

---

## Task 3 — Wire broadcast early-exit block into `handleTelegramBot`

**Files:**
- Modify: `api/notify.js` — insert between lines 659 and 660 (between `const chatId = message.chat.id` and `const raw = ...`)

### Steps

- [ ] **Step 1: Insert the broadcast early-exit block**

In `handleTelegramBot`, find this exact block (around line 659):

```js
  const chatId = message.chat.id
  const raw    = (message.text || '').trim().toLowerCase().split('@')[0]
```

Replace it with:

```js
  const chatId  = message.chat.id
  const msgText = (message.text || '').trim()

  // ── Broadcast commands — handled before generic command parser ───────────
  if (msgText.toLowerCase().startsWith('/broadcast')) {
    const adminId = Number(process.env.TELEGRAM_ADMIN_ID)
    if (!adminId || message.from?.id !== adminId) return res.status(200).end()

    const paidOnly = msgText.toLowerCase().startsWith('/broadcast_paid')
    const prefix   = paidOnly ? '/broadcast_paid' : '/broadcast'
    const body     = msgText.slice(prefix.length).trim()

    if (!body) {
      await sendReply(chatId, `❌ Usage: ${prefix} &lt;message&gt;`)
      return res.status(200).end()
    }

    try {
      const count = await cmdBroadcast(body, paidOnly)
      await sendReply(chatId, `✅ Broadcast sent to ${count} users`)
    } catch (err) {
      console.error('[notify/broadcast] failed:', err.message)
      await sendReply(chatId, `❌ Broadcast failed — check server logs`)
    }
    return res.status(200).end()
  }
  // ─────────────────────────────────────────────────────────────────────────

  const raw    = msgText.toLowerCase().split('@')[0]
```

Note: `msgText` replaces the inline `(message.text || '').trim()` that `raw` previously used. The rest of the command parser (`raw.startsWith('/')`, `parts`, `key`, etc.) is unchanged — it now uses `raw` derived from `msgText`.

- [ ] **Step 2: Verify parse**

```bash
node --input-type=module < api/notify.js
```

Expected: exits without syntax error.

- [ ] **Step 3: Commit**

```bash
git add api/notify.js
git commit -m "feat(broadcast): wire /broadcast and /broadcast_paid commands into bot handler"
```

---

## Task 4 — Add `TELEGRAM_ADMIN_ID` to Vercel env

**Files:** None (Vercel dashboard config)

### Steps

- [ ] **Step 1: Add the env var**

In the Vercel dashboard → Project Settings → Environment Variables, add:

```
TELEGRAM_ADMIN_ID = <your Telegram numeric user ID>
```

Set it for Production, Preview, and Development environments.

To find your Telegram user ID: send any message to `@userinfobot` on Telegram — it replies with your numeric ID.

- [ ] **Step 2: Redeploy**

After adding the env var, trigger a new deployment (push a commit or redeploy from the dashboard) so the function picks up the new variable.

---

## Task 5 — Create `scripts/register-telegram-webhook.js`

**Files:**
- Create: `scripts/register-telegram-webhook.js`

### Steps

- [ ] **Step 1: Create the script**

Create `scripts/register-telegram-webhook.js` with this content:

```js
// scripts/register-telegram-webhook.js
//
// Registers https://fypro.com.ng/api/notify as the Telegram bot webhook.
// Run this once after the first deployment, or whenever the webhook URL changes.
//
// Usage:
//   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_WEBHOOK_SECRET=xxx node scripts/register-telegram-webhook.js
//
// Or with a .env file:
//   node -r dotenv/config scripts/register-telegram-webhook.js

const TOKEN  = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

if (!TOKEN || !SECRET) {
  console.error('Error: TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET must be set.')
  process.exit(1)
}

const WEBHOOK_URL = 'https://fypro.com.ng/api/notify'

async function register() {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url: WEBHOOK_URL, secret_token: SECRET }),
  })
  const data = await res.json()
  if (data.ok) {
    console.log(`✅ Webhook registered: ${WEBHOOK_URL}`)
    console.log('   Pending update count:', data.result?.pending_update_count ?? 0)
  } else {
    console.error('❌ Failed:', data.description)
    process.exit(1)
  }
}

register().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
```

- [ ] **Step 2: Run the script to register the webhook**

```bash
TELEGRAM_BOT_TOKEN=<token> TELEGRAM_WEBHOOK_SECRET=<secret> node scripts/register-telegram-webhook.js
```

Expected output:
```
✅ Webhook registered: https://fypro.com.ng/api/notify
   Pending update count: 0
```

- [ ] **Step 3: Commit**

```bash
git add scripts/register-telegram-webhook.js
git commit -m "feat(broadcast): add webhook registration script"
```

---

## Task 6 — Smoke test

No automated test framework exists in this codebase. Verify manually.

### Steps

- [ ] **Step 1: Test empty body guard**

In Telegram, send to your bot:
```
/broadcast
```
Expected bot reply: `❌ Usage: /broadcast <message>`

- [ ] **Step 2: Test non-admin rejection**

If you have a second Telegram account, send `/broadcast hello` from it to the bot. Expected: no reply (silent ignore).

- [ ] **Step 3: Test `/broadcast` delivery**

Send:
```
/broadcast Test announcement — ignore this
```
Expected Telegram reply: `✅ Broadcast sent to X users`

Check:
1. Your own registered email receives an email with subject "FYPro Announcement" and the test text in the body.
2. In Supabase → `notifications` table, rows of `type = 'announcement'` exist for the broadcast targets.

- [ ] **Step 4: Test `/broadcast_paid` delivery**

Send:
```
/broadcast_paid Test paid-only announcement — ignore this
```
Expected reply: `✅ Broadcast sent to X users` where X ≤ the count from the all-users test.

Check Supabase `payments` table to confirm X matches the number of distinct users with `status = 'success'` (minus any opted-out).

- [ ] **Step 5: Verify unsubscribed users are skipped**

In Supabase, temporarily set `unsubscribed_all = true` for your own user in `email_preferences`. Send another `/broadcast`. Expected: your email is not in the delivery batch (check server logs or Resend dashboard for the send list).

Restore `unsubscribed_all = false` afterwards.
