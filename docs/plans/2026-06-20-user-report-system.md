# User Report System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a user-facing report system so students can flag persistent errors and general issues, routing reports to Telegram, admin email, and a new Mission Control tab.

**Architecture:** A `user_reports` Supabase table stores structured reports. Three new actions in `api/notify.js` handle submission, status updates, and admin reads — staying within the 12-function limit. A reusable `ReportButton` component appears in `ApiErrorBox` (after 2 retries fail) and in the `DashTopBar` avatar dropdown (always available). Health.jsx gets a new Reports tab.

**Tech Stack:** React, Supabase (PostgreSQL + RLS), Vercel serverless (notify.js), Resend email, Telegram Bot API, Upstash Redis (rate limiting), CSS variables (light/dark mode — zero hardcoded hex in frontend components).

## Global Constraints

- Zero hardcoded hex in any frontend component file — always `var(--color-bg-card)`, `var(--color-text-primary)`, etc.
- All Vercel serverless functions stay at 12/12 — new logic goes inside existing `api/notify.js` only.
- RLS must be enabled on `user_reports`. After migration, verify: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;` must return zero rows.
- `ANTHROPIC_API_KEY`, `SUPABASE_SERVICE_ROLE_KEY` and all server-only env vars must never appear in `src/` files.
- `ReportButton` must work in both light and dark mode using existing CSS variable tokens.
- The `retryCount` that triggers the report button must use `useState` (not `useRef`) — it needs to trigger a re-render.
- CSS variable reference: `var(--color-bg-card)`, `var(--color-bg-surface)`, `var(--color-text-primary)`, `var(--color-text-secondary)`, `var(--color-text-muted)`, `var(--color-border)`, `var(--color-border-strong)`, `var(--color-blue-primary)`, `var(--color-red)`, `var(--radius-md)`, `var(--radius-lg)`, `var(--shadow-card)`, `var(--text-sm)`, `var(--text-base)`, `var(--text-xl)`, `var(--transition-base)`.

---

## File Map

| File | Action | Purpose |
|---|---|---|
| `migrations/0035_user_reports.sql` | Create | Table, indexes, RLS policies |
| `api/notify.js` | Modify | Add `handleSubmitReport`, `handleUpdateReportStatus`, `handleGetReports`, `cmdReports`, `cmdResolveReport`, router wiring, KEYBOARD update, cmdHelp update |
| `src/components/ReportButton.jsx` | Create | Self-contained button + modal. Props: `type`, `context`, `label` |
| `src/components/ApiErrorBox.jsx` | Modify | Add `retryCount` state, wrap `onRetry`, render `ReportButton` at count ≥ 2 |
| `src/features/dashboard/DashTopBar.jsx` | Modify | Add "Report an issue" link in avatar dropdown |
| `src/pages/admin/Health.jsx` | Modify | Add Reports tab: `loadReports`, state, TAB_ITEMS entry, `switchTab` wiring, full tab render, status update calls |

---

## Task 1: Database Migration

**Files:**
- Create: `migrations/0035_user_reports.sql`

**Interfaces:**
- Produces: `user_reports` table readable by service_role, writable by authenticated users (own rows only)

- [ ] **Step 1: Write the migration file**

Create `migrations/0035_user_reports.sql` with this exact content:

```sql
-- Migration 0035: user_reports
-- Stores user-submitted issue reports (error reports + general feedback).
-- Run in Supabase SQL Editor. Verify RLS check at the bottom.

CREATE TABLE public.user_reports (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type        text        NOT NULL CHECK (type IN ('error', 'general')),
  description text        NOT NULL,
  context     jsonb       NOT NULL DEFAULT '{}',
  status      text        NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'acknowledged', 'resolved')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX user_reports_user_idx    ON public.user_reports(user_id);
CREATE INDEX user_reports_status_idx  ON public.user_reports(status);
CREATE INDEX user_reports_created_idx ON public.user_reports(created_at DESC);

ALTER TABLE public.user_reports ENABLE ROW LEVEL SECURITY;

-- Users can insert their own reports only.
CREATE POLICY "user inserts own reports"
  ON public.user_reports
  FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);

-- Users can read their own reports only.
CREATE POLICY "user reads own reports"
  ON public.user_reports
  FOR SELECT
  TO authenticated
  USING ((select auth.uid()) = user_id);

-- No client UPDATE or DELETE — status changes go through service_role via API.

-- ── Verification ────────────────────────────────────────────────────────────────
-- Run after applying. Must return zero rows.
-- SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
```

- [ ] **Step 2: Apply the migration**

Open Supabase dashboard → SQL Editor → paste the full file → Run.

- [ ] **Step 3: Verify RLS**

In the SQL Editor, run:
```sql
SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;
```
Expected: zero rows returned. If `user_reports` appears, re-run the `ALTER TABLE` line.

- [ ] **Step 4: Commit**

```bash
git add migrations/0035_user_reports.sql
git commit -m "feat(reports): add user_reports table with RLS"
```

---

## Task 2: API — notify.js additions

**Files:**
- Modify: `api/notify.js`

**Interfaces:**
- Consumes: existing `supabaseAdmin`, `sendTelegramAlert`, `escapeTgHtml`, `Resend`, `UPSTASH_URL`, `UPSTASH_TOKEN`, `timeAgo` (all already in file)
- Produces:
  - `POST /api/notify` with `action: 'submit-report'` — saves report, fires Telegram + email
  - `POST /api/notify` with `action: 'update-report-status'` — admin-only status update
  - `POST /api/notify` with `action: 'get-reports'` — admin-only, returns reports array
  - `/reports` Telegram bot command
  - `/resolve-report <id>` Telegram bot command

- [ ] **Step 1: Add `buildReportEmail` helper**

In `api/notify.js`, add this function directly after the existing `buildBroadcastHtml` function (around line 84):

```js
function buildReportEmail({ email, type, description, context }) {
  const typeColor = type === 'error' ? '#DC2626' : '#0066FF'
  const typeLabel = type === 'error' ? 'Error Report' : 'General Report'
  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#F0F4F8;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:32px auto;">
  <div style="height:3px;background-color:${typeColor};border-radius:8px 8px 0 0;"></div>
  <div style="background:#0D1B2A;padding:20px 22px;text-align:center;">
    <img src="https://fypro.com.ng/fypro-logo.png" alt="FYPro" height="40" style="display:block;margin:0 auto;" />
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 8px 8px;border:1px solid #E5E7EB;border-top:none;">
    <div style="display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;border-radius:4px;padding:3px 10px;margin-bottom:16px;background:${typeColor}22;color:${typeColor};border:1px solid ${typeColor}55;">${typeLabel}</div>
    <h1 style="font-size:18px;font-weight:700;color:#0D1B2A;margin:0 0 16px;">User Issue Report</h1>
    <div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">From</div><div style="font-size:14px;color:#111827;">${esc(email)}</div></div>
    <div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">URL</div><div style="font-size:14px;color:#111827;">${esc(context.url)}</div></div>
    ${context.step_name ? `<div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">Step</div><div style="font-size:14px;color:#111827;">${esc(context.step_name)}</div></div>` : ''}
    ${context.error_message ? `<div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">Error</div><div style="font-size:13px;color:#DC2626;font-family:monospace;background:#FFF5F5;padding:8px 10px;border-radius:4px;">${esc(context.error_message)}</div></div>` : ''}
    <div><div style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Description</div><div style="font-size:14px;color:#111827;white-space:pre-wrap;background:#F9FAFB;padding:12px;border-radius:6px;border:1px solid #E5E7EB;">${esc(description)}</div></div>
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0 12px;">
    <p style="font-size:11px;color:#9CA3AF;margin:0;">Manage in <a href="https://www.fypro.com.ng/admin/health" style="color:#0066FF;">Mission Control</a> or use /resolve-report in Telegram.</p>
  </div>
</div>
</body></html>`
}
```

- [ ] **Step 2: Add `handleSubmitReport` function**

Add this function after `handleContact` (around line 950):

```js
async function handleSubmitReport(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  // Rate limiting via Upstash
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const today = new Date().toISOString().slice(0, 10)
    const userKey = `rl:report:user:${user.id}:${today}`
    const ipKey   = `rl:report:ip:${ip}:${today}`
    const [userR, ipR] = await Promise.all([
      fetch(`${UPSTASH_URL}/incr/${userKey}`, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }).then(x => x.json()).catch(() => null),
      fetch(`${UPSTASH_URL}/incr/${ipKey}`,   { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }).then(x => x.json()).catch(() => null),
    ])
    if ((userR?.result ?? 0) > 5 || (ipR?.result ?? 0) > 10) {
      return res.status(429).json({ error: 'Too many reports. Please try again tomorrow.' })
    }
    // Set TTL on first increment (25 hours)
    if (userR?.result === 1) fetch(`${UPSTASH_URL}/expire/${userKey}/90000`, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }).catch(() => null)
    if (ipR?.result  === 1) fetch(`${UPSTASH_URL}/expire/${ipKey}/90000`,   { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }).catch(() => null)
  }

  const { type, description, context } = req.body || {}

  if (!['error', 'general'].includes(type)) {
    return res.status(400).json({ error: 'Invalid report type' })
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' })
  }
  if (description.length > 1000) {
    return res.status(400).json({ error: 'Description must be 1000 characters or less' })
  }

  const safeContext = {
    url: typeof context?.url === 'string' ? context.url.slice(0, 500) : '?',
    ...(context?.step_name     && { step_name:     String(context.step_name).slice(0, 100) }),
    ...(context?.error_message && { error_message: String(context.error_message).slice(0, 500) }),
  }

  const { error: insertError } = await supabaseAdmin
    .from('user_reports')
    .insert({ user_id: user.id, type, description: description.trim(), context: safeContext })

  if (insertError) {
    console.error('[notify/submit-report] insert error:', insertError.message)
    return res.status(500).json({ error: 'Failed to save report' })
  }

  const email   = user.email || 'unknown'
  const preview = description.trim().slice(0, 100)
  const step    = safeContext.step_name || safeContext.url

  // Fire Telegram + email in parallel (non-blocking — don't await)
  Promise.all([
    sendTelegramAlert(
      `🚨 <b>User Report [${type}]</b>\n` +
      `👤 ${escapeTgHtml(email)}\n` +
      (safeContext.step_name ? `📍 Step: ${escapeTgHtml(safeContext.step_name)}\n` : '') +
      `🔗 ${escapeTgHtml(safeContext.url)}\n` +
      `💬 "${escapeTgHtml(preview)}"\n⏱ just now`
    ).catch(err => console.error('[notify/submit-report] Telegram error:', err.message)),
    (async () => {
      try {
        const resend = new Resend(process.env.RESEND_API_KEY)
        await resend.emails.send({
          from:    'FYPro <hello@fypro.com.ng>',
          to:      'hello@fypro.com.ng',
          subject: `[FYPro Report] ${type} — ${step}`,
          html:    buildReportEmail({ email, type, description: description.trim(), context: safeContext }),
        })
      } catch (err) {
        console.error('[notify/submit-report] Resend error:', err.message)
      }
    })(),
  ])

  return res.status(200).json({ ok: true })
}
```

- [ ] **Step 3: Add `handleUpdateReportStatus` function**

Add directly after `handleSubmitReport`:

```js
async function handleUpdateReportStatus(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { report_id, status } = req.body || {}
  if (!['acknowledged', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'status must be acknowledged or resolved' })
  }
  if (!report_id || typeof report_id !== 'string') {
    return res.status(400).json({ error: 'report_id is required' })
  }

  const { error: updateError } = await supabaseAdmin
    .from('user_reports')
    .update({ status })
    .eq('id', report_id)

  if (updateError) {
    console.error('[notify/update-report-status] error:', updateError.message)
    return res.status(500).json({ error: 'Failed to update report' })
  }

  return res.status(200).json({ ok: true })
}
```

- [ ] **Step 4: Add `handleGetReports` function**

Add directly after `handleUpdateReportStatus`:

```js
async function handleGetReports(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const statusFilter = req.body?.status // 'open' | 'acknowledged' | 'resolved' | undefined (all)

  let query = supabaseAdmin
    .from('user_reports')
    .select('id, user_id, type, description, context, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (statusFilter && ['open', 'acknowledged', 'resolved'].includes(statusFilter)) {
    query = query.eq('status', statusFilter)
  }

  const { data: reports, error: fetchError } = await query

  if (fetchError) {
    console.error('[notify/get-reports] error:', fetchError.message)
    return res.status(500).json({ error: 'Failed to fetch reports' })
  }

  // Enrich with user emails
  const userIds = [...new Set((reports || []).map(r => r.user_id).filter(Boolean))]
  const emailMap = {}
  await Promise.all(
    userIds.map(async uid => {
      try {
        const { data: { user: u } } = await supabaseAdmin.auth.admin.getUserById(uid)
        if (u) emailMap[uid] = u.email
      } catch {}
    })
  )

  const enriched = (reports || []).map(r => ({ ...r, email: emailMap[r.user_id] || '—' }))
  return res.status(200).json({ reports: enriched })
}
```

- [ ] **Step 5: Add `cmdReports` bot command function**

Add after the existing `cmdReferrals` function:

```js
async function cmdReports() {
  const { data: rows } = await supabaseAdmin
    .from('user_reports')
    .select('id, user_id, type, description, context, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(10)

  if (!rows || rows.length === 0) return '✅ <b>No open reports</b>'

  const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
  const emailMap = {}
  await Promise.all(
    userIds.map(async uid => {
      try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(uid)
        if (user) emailMap[uid] = user.email
      } catch {}
    })
  )

  const lines = rows.map((r, i) => {
    const email   = emailMap[r.user_id] || '—'
    const loc     = r.context?.step_name || r.context?.url || '—'
    const preview = (r.description || '').slice(0, 60)
    const shortId = (r.id || '').slice(0, 8)
    return (
      `${i + 1}. [${r.type}] ${escapeTgHtml(email)}\n` +
      `    ${escapeTgHtml(loc)} · ${timeAgo(r.created_at)}\n` +
      `    "${escapeTgHtml(preview)}"\n` +
      `    <code>/resolve-report ${shortId}</code>`
    )
  }).join('\n\n')

  return `📋 <b>Open Reports (${rows.length})</b>\n\n${lines}`
}
```

- [ ] **Step 6: Add `cmdResolveReport` bot command function**

Add directly after `cmdReports`:

```js
async function cmdResolveReport(id) {
  if (!id || id.length < 4) return '❌ Usage: /resolve-report &lt;id-prefix&gt; (min 4 chars)'

  const safeId = id.replace(/[%_]/g, '')
  const { data: rows } = await supabaseAdmin
    .from('user_reports')
    .select('id, description')
    .ilike('id', `${safeId}%`)
    .neq('status', 'resolved')
    .limit(2)

  if (!rows || rows.length === 0) return `❌ No open report found matching <code>${id}</code>`
  if (rows.length > 1) return `⚠️ Multiple matches for <code>${id}</code> — use more characters`

  const { error } = await supabaseAdmin
    .from('user_reports')
    .update({ status: 'resolved' })
    .eq('id', rows[0].id)

  if (error) return `❌ Failed to resolve report: ${error.message}`
  return `✅ Report resolved: "${(rows[0].description || '').slice(0, 80)}"`
}
```

- [ ] **Step 7: Wire new commands into `runCommand`**

Find the `runCommand` function (around line 697). Add two new `else if` branches before the final `return null`:

```js
// Add these two lines before the final "return null" in runCommand:
else if (key === 'reports'        ) return cmdReports()
else if (key === 'resolve-report' ) return cmdResolveReport(args[0])
```

- [ ] **Step 8: Add `/reports` button to KEYBOARD**

Find the `KEYBOARD` constant (around line 666). Add a new row for Reports:

```js
// Add this row inside inline_keyboard array, after the Referrals/Logs row:
[
  { text: '📋 Reports', callback_data: 'reports' },
],
```

- [ ] **Step 9: Update `cmdHelp` to include new commands**

Find `cmdHelp` (around line 640). Add to the Data section:
```
/reports — open user reports
```
And add to the Actions section:
```
/resolve-report &lt;id&gt; — mark report resolved
```

- [ ] **Step 10: Wire new actions into the router**

Find the router at the bottom of `handler` (around line 1148). Add three new action checks before `return handleNotify(req, res)`:

```js
if (req.body?.action === 'submit-report')        return handleSubmitReport(req, res)
if (req.body?.action === 'update-report-status') return handleUpdateReportStatus(req, res)
if (req.body?.action === 'get-reports')          return handleGetReports(req, res)
```

- [ ] **Step 11: Manual test — submit-report**

In your browser dev tools Console (while logged into the app), run:

```js
const { data: { session } } = await window.__supabase.auth.getSession()
const res = await fetch('/api/notify', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
  body: JSON.stringify({ action: 'submit-report', type: 'error', description: 'Test report from dev', context: { url: '/dashboard', step_name: 'chapter_architect', error_message: 'Test error' } })
})
console.log(await res.json())
```
Expected: `{ ok: true }`, Telegram alert fires, email sent to `hello@fypro.com.ng`.

- [ ] **Step 12: Manual test — /reports Telegram command**

Send `/reports` to the Telegram bot. Expected: the test report appears in the list.

- [ ] **Step 13: Commit**

```bash
git add api/notify.js
git commit -m "feat(reports): add submit-report, update-report-status, get-reports API actions + Telegram commands"
```

---

## Task 3: ReportButton Component

**Files:**
- Create: `src/components/ReportButton.jsx`

**Interfaces:**
- Consumes: `supabase` from `../lib/supabase`, `window.location.pathname`
- Produces: exported default `ReportButton({ type, context, label })` — renders trigger button + modal

- [ ] **Step 1: Create `src/components/ReportButton.jsx`**

```jsx
import { useState } from 'react'
import { supabase } from '../lib/supabase'

const ghostBtn = {
  background: 'none',
  border: '1px solid var(--color-border-strong)',
  borderRadius: 'var(--radius-md)',
  padding: '10px 20px',
  fontFamily: "'Poppins', sans-serif",
  fontSize: 'var(--text-base)',
  fontWeight: 600,
  color: 'var(--color-text-primary)',
  cursor: 'pointer',
  transition: 'var(--transition-base)',
}

export default function ReportButton({ type = 'general', context = {}, label = 'Report this issue' }) {
  const [open, setOpen]             = useState(false)
  const [description, setDescription] = useState('')
  const [status, setStatus]         = useState('idle') // idle | submitting | success | error
  const [errorMsg, setErrorMsg]     = useState('')

  async function handleSubmit() {
    if (!description.trim()) return
    setStatus('submitting')
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) throw new Error('Not signed in')

      const res = await fetch('/api/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: 'submit-report',
          type,
          description: description.trim(),
          context: { url: window.location.pathname, ...context },
        }),
      })

      if (res.status === 429) throw new Error('You've submitted too many reports today. Please try again tomorrow.')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Failed to submit report')
      }

      setStatus('success')
    } catch (err) {
      setErrorMsg(err.message || 'Something went wrong. Please try again.')
      setStatus('error')
    }
  }

  function handleClose() {
    setOpen(false)
    // Reset after animation settles
    setTimeout(() => {
      setDescription('')
      setStatus('idle')
      setErrorMsg('')
    }, 300)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        style={{
          background: 'none',
          border: 'none',
          padding: 0,
          color: 'var(--color-text-secondary)',
          fontSize: 'var(--text-sm)',
          fontFamily: "'Poppins', sans-serif",
          cursor: 'pointer',
          textDecoration: 'underline',
          textUnderlineOffset: '2px',
        }}
      >
        {label}
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-modal-title"
          style={{
            position: 'fixed', inset: 0, zIndex: 9999,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.5)',
            padding: '16px',
          }}
          onClick={e => { if (e.target === e.currentTarget) handleClose() }}
        >
          <div style={{
            background: 'var(--color-bg-card)',
            borderRadius: 'var(--radius-lg)',
            border: '1px solid var(--color-border)',
            boxShadow: 'var(--shadow-card)',
            padding: '32px',
            width: '100%',
            maxWidth: '480px',
          }}>
            {status === 'success' ? (
              <div style={{ textAlign: 'center', padding: '16px 0' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
                <h2 style={{
                  fontFamily: "'DM Serif Display', serif",
                  fontSize: 'var(--text-xl)',
                  color: 'var(--color-text-primary)',
                  margin: '0 0 8px',
                }}>
                  Report received
                </h2>
                <p style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 'var(--text-base)',
                  color: 'var(--color-text-secondary)',
                  margin: '0 0 24px',
                }}>
                  We'll look into it and fix it.
                </p>
                <button onClick={handleClose} style={ghostBtn}>Close</button>
              </div>
            ) : (
              <>
                <h2
                  id="report-modal-title"
                  style={{
                    fontFamily: "'DM Serif Display', serif",
                    fontSize: 'var(--text-xl)',
                    color: 'var(--color-text-primary)',
                    margin: '0 0 6px',
                  }}
                >
                  Report an issue
                </h2>
                <p style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 'var(--text-sm)',
                  color: 'var(--color-text-secondary)',
                  margin: '0 0 20px',
                }}>
                  Tell us what happened and we'll investigate.
                </p>

                <textarea
                  value={description}
                  onChange={e => setDescription(e.target.value.slice(0, 1000))}
                  placeholder="Tell us what happened…"
                  rows={5}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    background: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-strong)',
                    borderRadius: 'var(--radius-sm)',
                    padding: '12px 14px',
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 'var(--text-base)',
                    color: 'var(--color-text-primary)',
                    resize: 'vertical',
                    outline: 'none',
                    marginBottom: '4px',
                  }}
                />
                <div style={{
                  fontFamily: "'Poppins', sans-serif",
                  fontSize: 'var(--text-xs)',
                  color: 'var(--color-text-muted)',
                  textAlign: 'right',
                  marginBottom: '16px',
                }}>
                  {description.length}/1000
                </div>

                {status === 'error' && (
                  <p style={{
                    fontFamily: "'Poppins', sans-serif",
                    fontSize: 'var(--text-sm)',
                    color: 'var(--color-red)',
                    margin: '0 0 14px',
                  }}>
                    {errorMsg}
                  </p>
                )}

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    onClick={handleClose}
                    disabled={status === 'submitting'}
                    style={ghostBtn}
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSubmit}
                    disabled={!description.trim() || status === 'submitting'}
                    style={{
                      background: description.trim() && status !== 'submitting'
                        ? 'var(--color-blue-primary)'
                        : 'var(--color-text-muted)',
                      color: '#fff',
                      border: 'none',
                      borderRadius: 'var(--radius-md)',
                      padding: '10px 20px',
                      fontFamily: "'Poppins', sans-serif",
                      fontSize: 'var(--text-base)',
                      fontWeight: 600,
                      cursor: description.trim() && status !== 'submitting' ? 'pointer' : 'not-allowed',
                      transition: 'var(--transition-base)',
                    }}
                  >
                    {status === 'submitting' ? 'Sending…' : 'Submit Report'}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Visual test — light mode**

Start the dev server (`npm run dev`). Navigate to any authenticated page. Open browser console and run:

```js
// Temporarily mount component test — paste in console
// Instead, test via the DashTopBar after Task 5
```

Skip for now — test visually after Task 5 when the button is wired up in the UI.

- [ ] **Step 3: Commit**

```bash
git add src/components/ReportButton.jsx
git commit -m "feat(reports): add ReportButton component with modal (light/dark mode)"
```

---

## Task 4: Extend ApiErrorBox

**Files:**
- Modify: `src/components/ApiErrorBox.jsx`

**Interfaces:**
- Consumes: `ReportButton` from `./ReportButton`
- Produces: updated `ApiErrorBox({ error, onRetry, stepName })` — shows ReportButton when `retryCount >= 2`
- **Breaking change note:** existing callers of `ApiErrorBox` do not need to pass `stepName` — it is optional. But callers that pass `stepName` get better context in the report. Search for `<ApiErrorBox` across `src/` to identify callers.

- [ ] **Step 1: Find all callers of `ApiErrorBox`**

Run:
```bash
grep -rn "ApiErrorBox" src/ --include="*.jsx" --include="*.tsx"
```
Note the files. After this task, optionally add `stepName="feature_name"` to each caller (e.g. `stepName="chapter_architect"`). This is optional but improves report context.

- [ ] **Step 2: Replace the full content of `src/components/ApiErrorBox.jsx`**

```jsx
import { useState, useEffect } from 'react'
import ReportButton from './ReportButton'

export default function ApiErrorBox({ error, onRetry, stepName }) {
  const [retryCount, setRetryCount] = useState(0)

  // Reset counter if the error clears (successful retry)
  useEffect(() => {
    if (!error) setRetryCount(0)
  }, [error])

  if (!error) return null

  function handleRetry() {
    setRetryCount(c => c + 1)
    onRetry?.()
  }

  return (
    <div className="api-error-box">
      <p className="api-error-box__message">{error}</p>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '8px' }}>
        {onRetry && (
          <button className="api-error-box__retry" onClick={handleRetry}>
            Try Again
          </button>
        )}
        {retryCount >= 2 && (
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            marginTop: '2px',
          }}>
            <span style={{
              fontSize: 'var(--text-sm)',
              color: 'var(--color-text-muted)',
              fontFamily: "'Poppins', sans-serif",
            }}>
              Still not working?
            </span>
            <ReportButton
              type="error"
              context={{
                url: window.location.pathname,
                ...(stepName && { step_name: stepName }),
                error_message: error,
              }}
              label="Let us know and we'll fix it."
            />
          </div>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Visual test**

Start dev server. Trigger an `ApiErrorBox` in any step (e.g. disconnect internet, try generating in Topic Validator). Click "Try Again" twice. The "Still not working? Let us know and we'll fix it." prompt should appear. Click it — modal should open. Works in both light and dark mode.

- [ ] **Step 4: Commit**

```bash
git add src/components/ApiErrorBox.jsx
git commit -m "feat(reports): extend ApiErrorBox with retry counter + report trigger"
```

---

## Task 5: DashTopBar — Report Link

**Files:**
- Modify: `src/features/dashboard/DashTopBar.jsx`

**Interfaces:**
- Consumes: `ReportButton` from `../../components/ReportButton`
- Produces: "Report an issue" link in the avatar dropdown menu

**Note:** The "Report an issue" link goes in the avatar dropdown (between "My Referrals" and the sign-out separator). This is more practical than the header bar on mobile — the dropdown is already how users access secondary actions in this header.

- [ ] **Step 1: Add `ReportButton` import**

At the top of `src/features/dashboard/DashTopBar.jsx`, add the import after the existing component imports:

```js
import ReportButton from '../../components/ReportButton'
```

- [ ] **Step 2: Add `reportOpen` state**

Inside the `DashTopBar` component function, add this state alongside the existing `avatarOpen` state:

```js
const [reportOpen, setReportOpen] = useState(false)
```

- [ ] **Step 3: Add the Report link in the avatar dropdown**

Find the avatar dropdown menu content. It currently looks like this:

```jsx
<Link to="/account/referrals" onClick={() => setAvatarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 no-underline hover:bg-white/5 transition-colors duration-150">
  <span className="font-sans text-[0.82rem] text-slate-300">My Referrals</span>
</Link>
<div className="mx-3 my-1 h-px" style={{ background: 'var(--border-color)' }} />
<button
  onClick={handleLogout}
```

Replace that block with:

```jsx
<Link to="/account/referrals" onClick={() => setAvatarOpen(false)} className="flex items-center gap-3 px-4 py-2.5 no-underline hover:bg-white/5 transition-colors duration-150">
  <span className="font-sans text-[0.82rem] text-slate-300">My Referrals</span>
</Link>
<button
  onClick={() => { setAvatarOpen(false); setReportOpen(true) }}
  className="flex items-center gap-3 px-4 py-2.5 w-full text-left hover:bg-white/5 transition-colors duration-150"
>
  <span className="font-sans text-[0.82rem] text-slate-400">Report an issue</span>
</button>
<div className="mx-3 my-1 h-px" style={{ background: 'var(--border-color)' }} />
<button
  onClick={handleLogout}
```

- [ ] **Step 4: Add the controlled ReportButton after the header close tag**

Find the closing `</header>` tag near the bottom of the component. Add the controlled `ReportButton` just after it, before the component's closing fragment/div:

```jsx
</header>

{reportOpen && (
  <ReportButton
    type="general"
    context={{ url: window.location.pathname }}
    label=""
    _controlled
    _onClose={() => setReportOpen(false)}
  />
)}
```

Wait — `ReportButton` is not designed to be externally controlled. Instead, manage this more simply: just let the dropdown button directly set a flag and render a hidden zero-size `ReportButton` that auto-opens. The cleanest approach is to use a ref to imperatively trigger the modal. But to keep `ReportButton` clean with no ref forwarding, do this instead:

Replace Steps 3-4 with this single approach — add a self-mounted `ReportButton` that renders when `reportOpen` is true, with the modal auto-shown via the `initialOpen` prop:

Actually the cleanest solution without modifying `ReportButton`'s API: render a regular `ReportButton` but style it as invisible and trigger a click on mount. This is fragile. Better: add `initialOpen` prop to `ReportButton` in Task 3.

**Revised approach for Task 5:**

Go back to `ReportButton.jsx` and add one line — accept `initialOpen` prop:

```jsx
// Change the useState line:
const [open, setOpen] = useState(initialOpen ?? false)
// Change the function signature:
export default function ReportButton({ type = 'general', context = {}, label = 'Report this issue', initialOpen = false }) {
```

Then in `DashTopBar.jsx`, after the `</header>`:

```jsx
{reportOpen && (
  <ReportButton
    type="general"
    context={{ url: window.location.pathname }}
    label=""
    initialOpen={true}
  />
)}
```

And when `ReportButton` closes (via `handleClose`), it won't un-set `reportOpen`. Add an `onClose` prop to `ReportButton`:

```jsx
// In ReportButton, change the signature:
export default function ReportButton({ type = 'general', context = {}, label = 'Report this issue', initialOpen = false, onClose }) {

// In handleClose:
function handleClose() {
  setOpen(false)
  onClose?.()
  setTimeout(() => {
    setDescription('')
    setStatus('idle')
    setErrorMsg('')
  }, 300)
}
```

Then in DashTopBar:

```jsx
{reportOpen && (
  <ReportButton
    type="general"
    context={{ url: window.location.pathname }}
    label=""
    initialOpen={true}
    onClose={() => setReportOpen(false)}
  />
)}
```

**This means you need to update `ReportButton.jsx` before completing Task 5.** Update `ReportButton.jsx` first:

```jsx
// Updated signature line in ReportButton.jsx:
export default function ReportButton({ type = 'general', context = {}, label = 'Report this issue', initialOpen = false, onClose }) {

// Updated useState:
const [open, setOpen] = useState(initialOpen ?? false)

// Updated handleClose:
function handleClose() {
  setOpen(false)
  onClose?.()
  setTimeout(() => {
    setDescription('')
    setStatus('idle')
    setErrorMsg('')
  }, 300)
}
```

- [ ] **Step 5: Visual test**

Open the dashboard. Click the avatar. Click "Report an issue". Modal should open immediately. Submit a test report. Check Telegram for the alert. Toggle to light mode — modal should render cleanly in both modes.

- [ ] **Step 6: Commit**

```bash
git add src/components/ReportButton.jsx src/features/dashboard/DashTopBar.jsx
git commit -m "feat(reports): add Report an issue to dashboard avatar dropdown"
```

---

## Task 6: Health.jsx — Reports Tab

**Files:**
- Modify: `src/pages/admin/Health.jsx`

**Interfaces:**
- Consumes: `POST /api/notify` actions `get-reports` and `update-report-status`
- Produces: new "Reports" tab in Mission Control with filter, list, expand, and status update buttons

- [ ] **Step 1: Add reports state variables**

In `Health.jsx`, find the block where other state variables are declared (around line 629 where `activeTab` is defined). Add these alongside the other state declarations:

```js
const [reports, setReports]             = useState([])
const [reportsLoading, setReportsLoading] = useState(false)
const [reportFilter, setReportFilter]   = useState('open')
const [expandedReport, setExpandedReport] = useState(null)
```

- [ ] **Step 2: Add `loadReports` function**

Find where other `load*` functions are defined (look for `async function loadData` or `const loadData = useCallback`). Add `loadReports` nearby:

```js
const loadReports = useCallback(async () => {
  if (!session?.access_token) return
  setReportsLoading(true)
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'get-reports' }),
    })
    if (!res.ok) return
    const data = await res.json()
    setReports(data.reports || [])
  } catch (err) {
    console.error('[Health/loadReports]', err)
  } finally {
    setReportsLoading(false)
  }
}, [session])
```

- [ ] **Step 3: Add polling useEffect for reports tab**

Find the block of `useEffect` calls that handle polling (where `activeTab === 'logs'` etc. appear). Add a new `useEffect` after the last one:

```js
useEffect(() => {
  if (!isAdmin) return
  loadReports()
  if (activeTab !== 'reports') return
  const id = setInterval(loadReports, 30_000) // poll every 30s when tab is active
  return () => clearInterval(id)
}, [isAdmin, session, loadReports, activeTab])
```

- [ ] **Step 4: Wire `loadReports` into `switchTab`**

Find the `switchTab` function (around line 1593). Add the reports case:

```js
function switchTab(id) {
  if (id === 'overview') counterKeyRef.current += 1
  setActiveTab(id)
  if (id === 'overview' || id === 'users') loadData()
  else if (id === 'vitals') { loadVitals(); loadAuthAttempts() }
  else if (id === 'payments') { loadPaymentIssues(); loadFeedbackSummary() }
  else if (id === 'logs') { loadSystemLogs(); loadFailures() }
  else if (id === 'reports') loadReports()   // ← add this line
}
```

- [ ] **Step 5: Add "Reports" to TAB_ITEMS with open-count badge**

Find the `TAB_ITEMS` array (around line 1565). Replace it with:

```js
const openReportCount = reports.filter(r => r.status === 'open').length

const TAB_ITEMS = [
  { id: 'overview',  label: 'Overview' },
  { id: 'users',     label: 'Users' },
  { id: 'payments',  label: 'Payments' },
  { id: 'vitals',    label: 'Vitals' },
  { id: 'logs',      label: 'Logs' },
  { id: 'reports',   label: openReportCount > 0 ? `Reports (${openReportCount})` : 'Reports' },
]
```

- [ ] **Step 6: Add `updateReportStatus` helper**

Add this function inside the `Health` component (near `loadReports`):

```js
async function updateReportStatus(reportId, status) {
  if (!session?.access_token) return
  // Optimistic update
  setReports(prev => prev.map(r => r.id === reportId ? { ...r, status } : r))
  try {
    const res = await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ action: 'update-report-status', report_id: reportId, status }),
    })
    if (!res.ok) {
      // Revert on failure
      loadReports()
    }
  } catch {
    loadReports()
  }
}
```

- [ ] **Step 7: Add the Reports tab render**

Find the section that renders tab content (around line 1734 where `{activeTab === 'overview' && ...}`). Add the Reports tab content at the end, before the closing `</div>` of the tab content wrapper:

```jsx
{activeTab === 'reports' && (
  <div style={{ padding: '24px 0' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
      <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, color: WHITE, margin: 0 }}>
        User Reports
      </h2>
      <button
        onClick={loadReports}
        style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 8, padding: '6px 14px', color: DIM, fontFamily: "'Poppins', sans-serif", fontSize: 12, cursor: 'pointer' }}
      >
        Refresh
      </button>
    </div>

    {/* Filter row */}
    <div style={{ display: 'flex', gap: 8, marginBottom: 20 }}>
      {['all', 'open', 'acknowledged', 'resolved'].map(f => (
        <button
          key={f}
          onClick={() => setReportFilter(f)}
          style={{
            background: reportFilter === f ? BLUE : 'none',
            border: `1px solid ${reportFilter === f ? BLUE : BORDER}`,
            borderRadius: 999,
            padding: '5px 14px',
            color: reportFilter === f ? WHITE : MUTED,
            fontFamily: "'Poppins', sans-serif",
            fontSize: 12,
            fontWeight: reportFilter === f ? 600 : 400,
            cursor: 'pointer',
            transition: 'all 0.15s',
            textTransform: 'capitalize',
          }}
        >
          {f}
        </button>
      ))}
    </div>

    {reportsLoading && reports.length === 0 && (
      <p style={{ color: MUTED, fontFamily: "'Poppins', sans-serif", fontSize: 13 }}>Loading reports…</p>
    )}

    {!reportsLoading && reports.filter(r => reportFilter === 'all' || r.status === reportFilter).length === 0 && (
      <div style={{ textAlign: 'center', padding: '48px 0', color: MUTED, fontFamily: "'Poppins', sans-serif", fontSize: 14 }}>
        {reportFilter === 'open' ? '✅ No open reports' : `No ${reportFilter} reports`}
      </div>
    )}

    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {reports
        .filter(r => reportFilter === 'all' || r.status === reportFilter)
        .map(r => {
          const isExpanded = expandedReport === r.id
          const statusColor = r.status === 'open' ? RED : r.status === 'acknowledged' ? AMBER : GREEN
          const typeColor   = r.type === 'error' ? RED : BLUE

          return (
            <div key={r.id} style={{
              background: CARD,
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
              overflow: 'hidden',
            }}>
              {/* Row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', flexWrap: 'wrap' }}>
                {/* Status chip */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10, fontWeight: 700,
                  color: WHITE,
                  background: `${statusColor}33`,
                  border: `1px solid ${statusColor}66`,
                  borderRadius: 999, padding: '2px 8px',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  flexShrink: 0,
                }}>
                  {r.status}
                </span>

                {/* Type badge */}
                <span style={{
                  fontFamily: "'JetBrains Mono', monospace",
                  fontSize: 10, fontWeight: 600,
                  color: typeColor,
                  background: `${typeColor}18`,
                  border: `1px solid ${typeColor}44`,
                  borderRadius: 999, padding: '2px 8px',
                  textTransform: 'uppercase', letterSpacing: '0.06em',
                  flexShrink: 0,
                }}>
                  {r.type}
                </span>

                {/* Email */}
                <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: DIM, flexShrink: 0 }}>
                  {(r.email || '—').slice(0, 30)}
                </span>

                {/* Step / URL */}
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: MUTED, flexShrink: 0 }}>
                  {r.context?.step_name || r.context?.url || '—'}
                </span>

                {/* Description preview */}
                <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: DIM, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {(r.description || '').slice(0, 80)}
                </span>

                {/* Time */}
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 10, color: MUTED, flexShrink: 0 }}>
                  {timeAgo(r.created_at)}
                </span>

                {/* Actions */}
                <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
                  {r.status === 'open' && (
                    <button
                      onClick={() => updateReportStatus(r.id, 'acknowledged')}
                      style={{ background: `${AMBER}22`, border: `1px solid ${AMBER}55`, borderRadius: 6, padding: '4px 10px', color: AMBER, fontFamily: "'Poppins', sans-serif", fontSize: 11, cursor: 'pointer' }}
                    >
                      Acknowledge
                    </button>
                  )}
                  {r.status !== 'resolved' && (
                    <button
                      onClick={() => updateReportStatus(r.id, 'resolved')}
                      style={{ background: `${GREEN}22`, border: `1px solid ${GREEN}55`, borderRadius: 6, padding: '4px 10px', color: GREEN, fontFamily: "'Poppins', sans-serif", fontSize: 11, cursor: 'pointer' }}
                    >
                      Resolve
                    </button>
                  )}
                  <button
                    onClick={() => setExpandedReport(isExpanded ? null : r.id)}
                    style={{ background: 'none', border: `1px solid ${BORDER}`, borderRadius: 6, padding: '4px 10px', color: MUTED, fontFamily: "'Poppins', sans-serif", fontSize: 11, cursor: 'pointer' }}
                  >
                    {isExpanded ? 'Collapse' : 'Expand'}
                  </button>
                </div>
              </div>

              {/* Expanded detail */}
              {isExpanded && (
                <div style={{ borderTop: `1px solid ${BORDER}`, padding: '16px', background: BG }}>
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Full Description</div>
                    <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM, margin: 0, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{r.description}</p>
                  </div>
                  <div>
                    <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>Context</div>
                    <pre style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: DIM, background: SURFACE, border: `1px solid ${BORDER}`, borderRadius: 6, padding: '10px 12px', margin: 0, overflowX: 'auto' }}>
                      {JSON.stringify(r.context, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )
        })}
    </div>
  </div>
)}
```

- [ ] **Step 8: Visual test**

Navigate to `/admin/health`. A "Reports" tab should appear. Click it — it shows the reports you submitted in Task 2 testing. Test filtering (All / Open / Acknowledged / Resolved). Click "Acknowledge" on a report — chip updates immediately. Click "Expand" — context JSON is visible. Check the tab label shows the open count badge.

- [ ] **Step 9: Commit**

```bash
git add src/pages/admin/Health.jsx
git commit -m "feat(reports): add Reports tab to Mission Control admin dashboard"
```

---

## Self-Review Checklist

- [x] **Spec coverage:** Migration ✓, submit-report ✓, update-report-status ✓, get-reports ✓, Telegram alert ✓, /reports command ✓, /resolve-report command ✓, ReportButton ✓, ApiErrorBox retry counter ✓, Dashboard entry point ✓ (avatar dropdown), Health.jsx Reports tab ✓, filter row ✓, expand row ✓, status management ✓, rate limiting ✓, admin email ✓, light/dark mode ✓
- [x] **Placeholders:** None — all steps have complete code
- [x] **Type consistency:** `report_id` used consistently in `update-report-status` action and `updateReportStatus` call. `status` values `'open'`/`'acknowledged'`/`'resolved'` match migration CHECK constraint.
- [x] **ReportButton props:** `initialOpen` and `onClose` added in Task 5 Step 4 — update Task 3 file before finishing Task 5.
- [x] **Function limit:** Still 12/12 — all additions go into existing `api/notify.js`
- [x] **RLS:** `user_reports` has RLS enabled, verified in Task 1 Step 3
