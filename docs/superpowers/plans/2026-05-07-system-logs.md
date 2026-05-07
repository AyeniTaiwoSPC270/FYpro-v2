# System Logs Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a system_logs Supabase table, a shared write helper, error instrumentation in two API routes, two new admin endpoints, a Sentry webhook handler, and a System Logs UI section at the bottom of the Admin Health page.

**Architecture:** A shared fire-and-forget `writeSystemLog()` helper (in `api/_lib/`) is imported by defense-claude.js, project-reviewer.js, and the new sentry-webhook.js. Two new actions on `api/admin.js` (`system_logs` + `resolve_log`) serve the Health page, which polls every 60 s and renders expandable log cards with a Resolve button.

**Tech Stack:** Supabase (PostgreSQL + RLS), Vercel serverless functions (Node.js ESM), React 18, Node `crypto` for HMAC-SHA256.

**Spec:** `docs/superpowers/specs/2026-05-07-system-logs-design.md`

---

## File Map

| Action | Path |
|--------|------|
| Create | `supabase/migrations/0010_system_logs.sql` |
| Create | `api/_lib/system-log.js` |
| Modify | `api/defense-claude.js` |
| Modify | `api/project-reviewer.js` |
| Modify | `api/admin.js` |
| Create | `api/sentry-webhook.js` |
| Modify | `src/pages/admin/Health.jsx` |

---

### Task 1: Create the Supabase migration

**Files:**
- Create: `supabase/migrations/0010_system_logs.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- supabase/migrations/0010_system_logs.sql
CREATE TABLE system_logs (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at    timestamptz DEFAULT now(),
  severity      text        CHECK (severity = ANY (ARRAY['error','warning','info'])),
  feature       text        NOT NULL,
  plain_message text        NOT NULL,
  raw_detail    jsonb,
  source        text        CHECK (source = ANY (ARRAY['ai','auth','payment','database','sentry','system'])),
  resolved      boolean     DEFAULT false
);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only" ON system_logs
  FOR ALL USING (auth.jwt() ->> 'email' = 'team.fypro@gmail.com');
```

- [ ] **Step 2: Run the migration in Supabase**

Open the Supabase SQL Editor for your project and paste + run the file contents.

Verify with:
```sql
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'system_logs';
-- Must return one row: system_logs

SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;
-- Must return ZERO rows (RLS enabled everywhere)
```

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0010_system_logs.sql
git commit -m "feat(db): add system_logs table with admin-only RLS"
```

---

### Task 2: Create the shared `writeSystemLog` helper

**Files:**
- Create: `api/_lib/system-log.js`

- [ ] **Step 1: Write the helper**

```js
// api/_lib/system-log.js
import { supabaseAdmin } from './supabase-admin.js';

/**
 * Fire-and-forget insert into system_logs.
 * Never throws — a logging failure must never propagate to the caller.
 */
export async function writeSystemLog({ severity, feature, source, plain_message, raw_detail }) {
  try {
    const { error } = await supabaseAdmin.from('system_logs').insert({
      severity,
      feature,
      source,
      plain_message,
      raw_detail: raw_detail ?? null,
    });
    if (error) console.error('[system-log] insert failed:', error.message);
  } catch (err) {
    console.error('[system-log] unexpected error:', err.message);
  }
}
```

- [ ] **Step 2: Verify the file is importable**

Run from the repo root:
```bash
node --input-type=module <<'EOF'
import { writeSystemLog } from './api/_lib/system-log.js';
console.log(typeof writeSystemLog); // expected: function
EOF
```
Expected output: `function`

- [ ] **Step 3: Commit**

```bash
git add api/_lib/system-log.js
git commit -m "feat(api): add writeSystemLog fire-and-forget helper"
```

---

### Task 3: Instrument `api/defense-claude.js`

**Files:**
- Modify: `api/defense-claude.js`

The catch block is at line 95–98. `user` is in scope there (set at line 28).

- [ ] **Step 1: Add the import at the top of the file**

After the existing imports (around line 6), add:

```js
import { writeSystemLog } from './_lib/system-log.js';
```

- [ ] **Step 2: Update the catch block**

Replace the existing catch block:
```js
  } catch (err) {
    console.error('[defense-claude] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
```

With:
```js
  } catch (err) {
    console.error('[defense-claude] error:', err.message);
    writeSystemLog({
      severity: 'error',
      feature: 'Defense Simulator',
      source: 'ai',
      plain_message: 'A defense session failed — the AI did not respond in time or hit the token limit',
      raw_detail: { error: err.message, userId: user.id },
    });
    return res.status(500).json({ error: err.message });
  }
```

Note: `writeSystemLog` is intentionally not awaited — it is fire-and-forget. The 500 response returns immediately.

- [ ] **Step 3: Verify the file parses cleanly**

```bash
node --check api/defense-claude.js
```
Expected: no output (clean parse).

- [ ] **Step 4: Commit**

```bash
git add api/defense-claude.js
git commit -m "feat(api): log defense simulator failures to system_logs"
```

---

### Task 4: Instrument `api/project-reviewer.js`

**Files:**
- Modify: `api/project-reviewer.js`

The catch block is at line 90–93. `user` is in scope there (set at line 28).

- [ ] **Step 1: Add the import at the top of the file**

After the existing imports, add:

```js
import { writeSystemLog } from './_lib/system-log.js';
```

- [ ] **Step 2: Update the catch block**

Replace:
```js
  } catch (err) {
    console.error('[project-reviewer] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
```

With:
```js
  } catch (err) {
    console.error('[project-reviewer] error:', err.message);
    writeSystemLog({
      severity: 'error',
      feature: 'Project Reviewer',
      source: 'ai',
      plain_message: 'A project review failed — PDF may be too large or AI timed out',
      raw_detail: { error: err.message, userId: user.id },
    });
    return res.status(500).json({ error: err.message });
  }
```

- [ ] **Step 3: Verify the file parses cleanly**

```bash
node --check api/project-reviewer.js
```
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add api/project-reviewer.js
git commit -m "feat(api): log project reviewer failures to system_logs"
```

---

### Task 5: Add `system_logs` and `resolve_log` actions to `api/admin.js`

**Files:**
- Modify: `api/admin.js`

Two new handler functions, registered in the existing `handler` switch at the bottom.

- [ ] **Step 1: Add `handleSystemLogs` function**

Add this function anywhere before the `export default` line (e.g. after `handleResolvePaymentIssue`):

```js
// action: "system_logs"
async function handleSystemLogs(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const { data, error } = await supabaseAdmin
      .from('system_logs')
      .select('*')
      .eq('resolved', false)
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    return res.status(200).json({ logs: data || [] });
  } catch (err) {
    console.error('[admin/system_logs] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
```

- [ ] **Step 2: Add `handleResolveLog` function**

```js
// action: "resolve_log"
async function handleResolveLog(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const { error } = await supabaseAdmin
      .from('system_logs')
      .update({ resolved: true })
      .eq('id', id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/resolve_log] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
```

- [ ] **Step 3: Register both actions in the router**

Find the bottom of the `handler` function. It currently ends with:
```js
  if (action === 'resolve-payment-issue')  return handleResolvePaymentIssue(req, res);

  return res.status(400).json({ error: `Unknown action: ${action}` });
```

Add two lines before the final `return`:
```js
  if (action === 'system_logs')   return handleSystemLogs(req, res);
  if (action === 'resolve_log')   return handleResolveLog(req, res);
```

- [ ] **Step 4: Verify the file parses cleanly**

```bash
node --check api/admin.js
```
Expected: no output.

- [ ] **Step 5: Commit**

```bash
git add api/admin.js
git commit -m "feat(api): add system_logs and resolve_log admin endpoints"
```

---

### Task 6: Create `api/sentry-webhook.js`

**Files:**
- Create: `api/sentry-webhook.js`

- [ ] **Step 1: Write the webhook handler**

```js
// api/sentry-webhook.js
// Receives Sentry webhook events, verifies HMAC-SHA256, writes to system_logs.
// bodyParser must be disabled so Vercel passes raw bytes for signature verification.
export const config = { api: { bodyParser: false } };

import crypto from 'crypto';
import { writeSystemLog } from './_lib/system-log.js';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function mapSeverity(level) {
  if (level === 'fatal' || level === 'error') return 'error';
  if (level === 'warning')                    return 'warning';
  return 'info';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody = await readRawBody(req);
  const secret  = process.env.SENTRY_WEBHOOK_SECRET;

  if (secret) {
    const sig      = req.headers['sentry-hook-signature'] || '';
    const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
    if (sig !== expected) {
      console.error('[sentry-webhook] invalid signature');
      return res.status(400).json({ error: 'Invalid signature' });
    }
  } else {
    console.warn('[sentry-webhook] SENTRY_WEBHOOK_SECRET not set — skipping verification');
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const event       = payload?.data?.event || {};
  const level       = event.level || 'info';
  const title       = String(event.title || 'Unknown Sentry event').slice(0, 200);
  const tags        = Array.isArray(event.tags) ? event.tags : [];
  const featureTag  = tags.find(([k]) => k === 'feature');
  const feature     = featureTag ? featureTag[1] : 'Unknown';

  await writeSystemLog({
    severity:      mapSeverity(level),
    feature,
    source:        'sentry',
    plain_message: title,
    raw_detail:    payload,
  });

  return res.status(200).json({ ok: true });
}
```

- [ ] **Step 2: Verify the file parses cleanly**

```bash
node --check api/sentry-webhook.js
```
Expected: no output.

- [ ] **Step 3: Verify HMAC logic manually (optional sanity check)**

```bash
node --input-type=module <<'EOF'
import crypto from 'crypto';
const secret = 'test-secret';
const body   = Buffer.from('{"hello":"world"}');
const sig    = crypto.createHmac('sha256', secret).update(body).digest('hex');
// Re-verify with same inputs
const check  = crypto.createHmac('sha256', secret).update(body).digest('hex');
console.log(sig === check ? 'HMAC OK' : 'HMAC MISMATCH');
EOF
```
Expected: `HMAC OK`

- [ ] **Step 4: Commit**

```bash
git add api/sentry-webhook.js
git commit -m "feat(api): add Sentry webhook handler with HMAC-SHA256 verification"
```

---

### Task 7: Add System Logs section to `src/pages/admin/Health.jsx`

**Files:**
- Modify: `src/pages/admin/Health.jsx`

This task has four sub-steps: state, loaders, UI section, and wiring.

- [ ] **Step 1: Add the polling interval constant**

Find the block of interval constants near the top of the file (around line 275):
```js
const INTERVAL_OVERVIEW = 20 * 1000
const INTERVAL_VITALS   = 15 * 1000
const INTERVAL_FAILURES = 20 * 1000
const INTERVAL_AUTH     = 30 * 1000
const INTERVAL_PAYMENTS = 30 * 1000
```

Add one more line:
```js
const INTERVAL_LOGS     = 60 * 1000   // 60s
```

- [ ] **Step 2: Add state variables**

Find the block of state declarations inside `AdminHealth` (around line 295). After the `paymentIssues` state block, add:

```js
const [systemLogs, setSystemLogs]               = useState(null)
const [systemLogsLoading, setSystemLogsLoading] = useState(true)
const [resolvingLogId, setResolvingLogId]       = useState(null)
const [expandedLogIds, setExpandedLogIds]       = useState(new Set())
const systemLogsTimerRef                        = useRef(null)
```

- [ ] **Step 3: Add `loadSystemLogs` callback**

After the `loadPaymentIssues` useCallback (around line 376), add:

```js
const loadSystemLogs = useCallback(() => {
  if (!session?.access_token) return Promise.resolve()
  return fetch('/api/admin?action=system_logs', {
    headers: { Authorization: `Bearer ${session.access_token}` },
  })
    .then(r => r.json())
    .then(d => { if (!d.error) setSystemLogs(d.logs) })
    .catch(() => {})
    .finally(() => setSystemLogsLoading(false))
}, [session?.access_token])
```

- [ ] **Step 4: Add `loadSystemLogs` to `handleRefresh`**

Find `handleRefresh` (around line 379):
```js
const handleRefresh = useCallback(async () => {
  setRefreshing(true)
  await Promise.all([
    loadData(),
    loadVitals(),
    loadFailures(),
    loadAuthAttempts(),
    loadPaymentIssues(),
  ])
  setLastUpdated(new Date())
  setRefreshing(false)
}, [loadData, loadVitals, loadFailures, loadAuthAttempts, loadPaymentIssues])
```

Replace with:
```js
const handleRefresh = useCallback(async () => {
  setRefreshing(true)
  await Promise.all([
    loadData(),
    loadVitals(),
    loadFailures(),
    loadAuthAttempts(),
    loadPaymentIssues(),
    loadSystemLogs(),
  ])
  setLastUpdated(new Date())
  setRefreshing(false)
}, [loadData, loadVitals, loadFailures, loadAuthAttempts, loadPaymentIssues, loadSystemLogs])
```

- [ ] **Step 5: Add the polling useEffect**

After the "Payment issues — 30s polling" useEffect block (around line 430), add:

```js
// System logs — 60s polling
useEffect(() => {
  if (!isAdmin || !session) return
  loadSystemLogs()
  systemLogsTimerRef.current = setInterval(loadSystemLogs, INTERVAL_LOGS)
  return () => clearInterval(systemLogsTimerRef.current)
}, [isAdmin, session, loadSystemLogs])
```

- [ ] **Step 6: Add `handleResolveLog` function**

After the `handleResolvePaymentIssue` function (around line 532), add:

```js
async function handleResolveLog(id) {
  setResolvingLogId(id)
  setSystemLogs(prev => (prev || []).filter(log => log.id !== id))
  try {
    const res = await fetch('/api/admin?action=resolve_log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
      body: JSON.stringify({ id }),
    })
    const json = await res.json()
    if (!res.ok) throw new Error(json.error)
  } catch (err) {
    console.error('[admin] resolve log failed:', err.message)
    // Re-fetch to restore the log if the server call failed
    loadSystemLogs()
  } finally {
    setResolvingLogId(null)
  }
}

function toggleLogExpanded(id) {
  setExpandedLogIds(prev => {
    const next = new Set(prev)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    return next
  })
}
```

- [ ] **Step 7: Add the System Logs UI section**

Find the end of the JSX, just before the closing `</div>` of the main container (the very last line before `)`). The current last section ends with:

```jsx
      </div>

    </div>
  )
}
```

Insert the System Logs section before the final `</div>`:

```jsx
      {/* ── System Logs ───────────────────────────────────────────── */}
      <div style={{ marginTop: 40, marginBottom: 64 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          marginBottom: 16, paddingBottom: 12,
          borderBottom: `1px solid ${BORDER}`,
        }}>
          <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400, color: WHITE, margin: 0 }}>
            System Logs
          </h2>
          {!systemLogsLoading && systemLogs !== null && (
            <span style={{
              fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600,
              background: systemLogs.length > 0 ? `${RED}22` : `${GREEN}22`,
              color: systemLogs.length > 0 ? RED : GREEN,
              border: `1px solid ${systemLogs.length > 0 ? RED + '55' : GREEN + '55'}`,
              borderRadius: 999, padding: '2px 10px',
            }}>
              {systemLogs.length} unresolved
            </span>
          )}
        </div>

        {systemLogsLoading ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[0,1,2,3,4].map(i => (
              <div key={i} style={{ height: 56, background: 'rgba(255,255,255,0.04)', borderRadius: 8 }} />
            ))}
          </div>
        ) : !systemLogs || systemLogs.length === 0 ? (
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: GREEN, margin: 0 }}>
            No issues detected — system is healthy
          </p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {systemLogs.map(log => {
              const severityColor = log.severity === 'error' ? RED : log.severity === 'warning' ? AMBER : BLUE
              const isExpanded    = expandedLogIds.has(log.id)
              return (
                <div key={log.id} style={{
                  background: CARD,
                  border: `1px solid ${BORDER}`,
                  borderLeft: `3px solid ${severityColor}`,
                  borderRadius: 10,
                  padding: '14px 18px',
                }}>
                  {/* Top row: badge + feature + timestamp + resolve */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 6 }}>
                    <span style={{
                      fontFamily: "'JetBrains Mono', monospace",
                      fontSize: 10, fontWeight: 700,
                      color: WHITE,
                      background: `${severityColor}33`,
                      border: `1px solid ${severityColor}55`,
                      borderRadius: 999, padding: '2px 8px',
                      textTransform: 'uppercase',
                    }}>
                      {log.severity}
                    </span>
                    <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: WHITE, fontWeight: 500 }}>
                      {log.feature}
                    </span>
                    <span style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginLeft: 'auto' }}>
                      {timeAgo(log.created_at)}
                    </span>
                    <button
                      onClick={() => handleResolveLog(log.id)}
                      disabled={resolvingLogId === log.id}
                      style={{
                        fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600,
                        color: WHITE,
                        background: resolvingLogId === log.id ? `${GREEN}55` : GREEN,
                        border: 'none', borderRadius: 6,
                        padding: '4px 12px',
                        cursor: resolvingLogId === log.id ? 'not-allowed' : 'pointer',
                        transition: 'background 0.15s ease',
                        flexShrink: 0,
                      }}
                    >
                      {resolvingLogId === log.id ? 'Resolving…' : 'Resolve'}
                    </button>
                  </div>

                  {/* Message */}
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM, margin: '0 0 8px 0' }}>
                    {log.plain_message}
                  </p>

                  {/* Expand toggle */}
                  {log.raw_detail && (
                    <>
                      <button
                        onClick={() => toggleLogExpanded(log.id)}
                        style={{
                          fontFamily: "'Poppins', sans-serif", fontSize: 11,
                          color: MUTED, background: 'transparent',
                          border: `1px solid ${BORDER}`, borderRadius: 6,
                          padding: '3px 10px', cursor: 'pointer',
                        }}
                      >
                        {isExpanded ? 'Hide detail' : 'Show detail'}
                      </button>
                      {isExpanded && (
                        <pre style={{
                          fontFamily: "'JetBrains Mono', monospace",
                          fontSize: 11, color: DIM,
                          background: SURFACE,
                          border: `1px solid ${BORDER}`,
                          borderRadius: 8,
                          padding: 16,
                          marginTop: 10,
                          overflowX: 'auto',
                          whiteSpace: 'pre-wrap',
                          wordBreak: 'break-all',
                        }}>
                          {JSON.stringify(log.raw_detail, null, 2)}
                        </pre>
                      )}
                    </>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
```

- [ ] **Step 8: Verify the component builds**

```bash
npm run build
```
Expected: build succeeds with no errors. Warnings about unused vars are acceptable; errors are not.

- [ ] **Step 9: Smoke-test in the browser**

1. Run `npm run dev` and navigate to `/admin/health` (you must be logged in as `team.fypro@gmail.com`).
2. Scroll to the bottom. The System Logs section should appear with "No issues detected — system is healthy" in green (table is empty).
3. Insert a test row via the Supabase SQL Editor:
   ```sql
   INSERT INTO system_logs (severity, feature, source, plain_message, raw_detail)
   VALUES ('error', 'Defense Simulator', 'ai', 'Test log entry', '{"error": "timeout", "userId": "test-123"}');
   ```
4. Wait up to 60 s (or click Refresh). The card should appear with a red left border, red "error" badge, and "Test log entry" text.
5. Click "Show detail" — the raw JSON should expand.
6. Click "Resolve" — the card should disappear immediately.
7. Verify the row is resolved in Supabase:
   ```sql
   SELECT id, resolved FROM system_logs ORDER BY created_at DESC LIMIT 1;
   -- resolved should be true
   ```

- [ ] **Step 10: Commit**

```bash
git add src/pages/admin/Health.jsx
git commit -m "feat(ui): add System Logs section to admin health page"
```

---

## Post-implementation checklist

- [ ] RLS verification: run `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;` — must return zero rows.
- [ ] Add `SENTRY_WEBHOOK_SECRET` to Vercel environment variables (Settings → Environment Variables). Set the same value in your Sentry webhook configuration (Project Settings → Integrations → Webhooks → Edit → Header). The header key Sentry sends is `sentry-hook-signature`.
- [ ] Deploy to Vercel (`git push origin main`) and verify the admin health page loads without JS errors in production.
