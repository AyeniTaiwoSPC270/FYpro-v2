# System Logs — Design Spec
Date: 2026-05-07

## Overview

Add a System Logs section to the Admin Health page that aggregates AI failures, payment errors, auth events, and Sentry exceptions into a single unresolved-issue feed. Each log entry can be resolved by the admin, removing it from the list.

---

## Files Created

| File | Purpose |
|------|---------|
| `supabase/migrations/0010_system_logs.sql` | Creates `system_logs` table with RLS |
| `api/_lib/system-log.js` | Shared fire-and-forget `writeSystemLog()` helper |
| `api/sentry-webhook.js` | Receives Sentry webhook events, verifies HMAC-SHA256, inserts into system_logs |

## Files Modified

| File | Change |
|------|--------|
| `api/defense-claude.js` | Import `writeSystemLog`; call it in the catch block |
| `api/project-reviewer.js` | Same pattern |
| `api/admin.js` | Add `system_logs` and `resolve_log` action handlers + route entries |
| `src/pages/admin/Health.jsx` | Add System Logs section with polling, skeleton, cards, expand, resolve |

---

## Data Layer

### Migration: `supabase/migrations/0010_system_logs.sql`

```sql
CREATE TABLE system_logs (
  id           uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at   timestamptz DEFAULT now(),
  severity     text        CHECK (severity = ANY (ARRAY['error','warning','info'])),
  feature      text        NOT NULL,
  plain_message text       NOT NULL,
  raw_detail   jsonb,
  source       text        CHECK (source = ANY (ARRAY['ai','auth','payment','database','sentry','system'])),
  resolved     boolean     DEFAULT false
);

ALTER TABLE system_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin only" ON system_logs
  FOR ALL USING (auth.jwt() ->> 'email' = 'team.fypro@gmail.com');
```

### Shared helper: `api/_lib/system-log.js`

Exports a single async function:

```js
writeSystemLog({ severity, feature, source, plain_message, raw_detail })
```

- Uses `supabaseAdmin` to insert one row.
- Wraps insert in `try/catch`; on error logs to `console.error` and returns silently.
- Never throws — callers do not need to await it for correctness (fire-and-forget).

### Instrumentation

**`api/defense-claude.js` catch block:**
```js
writeSystemLog({
  severity: 'error',
  feature: 'Defense Simulator',
  source: 'ai',
  plain_message: 'A defense session failed — the AI did not respond in time or hit the token limit',
  raw_detail: { error: err.message, userId: user?.id },
})
```

**`api/project-reviewer.js` catch block:**
```js
writeSystemLog({
  severity: 'error',
  feature: 'Project Reviewer',
  source: 'ai',
  plain_message: 'A project review failed — PDF may be too large or AI timed out',
  raw_detail: { error: err.message, userId: user?.id },
})
```

Both calls are non-blocking. Existing `console.error` calls are preserved.

---

## API Endpoints

All new actions added to `api/admin.js` behind the existing `verifyAdmin()` gate.

### `GET /api/admin?action=system_logs`

Query: `system_logs` where `resolved = false`, ordered `created_at DESC`, limit 50.  
Response: `{ logs: [...] }`

### `POST /api/admin?action=resolve_log`

Body: `{ id: string }`  
Action: `UPDATE system_logs SET resolved = true WHERE id = $id`  
Response: `{ ok: true }`  
Error: 400 if `id` missing, 500 on DB error.

### `api/sentry-webhook.js`

- `export const config = { api: { bodyParser: false } }` — Vercel must not parse the body so the raw bytes are available for HMAC verification.
- Reads raw body from the request stream.
- Computes `HMAC-SHA256(process.env.SENTRY_WEBHOOK_SECRET, rawBody)` using Node `crypto`.
- Compares against `sentry-hook-signature` request header. Mismatch → 400, no processing.
- If `SENTRY_WEBHOOK_SECRET` is not set: logs a warning, processes anyway (dev-friendly fallback).
- Severity mapping: `fatal|error → 'error'`, `warning → 'warning'`, everything else → `'info'`.
- `feature`: read from `event.tags` (key `feature`), fallback to `'Unknown'`.
- `plain_message`: Sentry event title, truncated to 200 characters.
- `raw_detail`: full parsed Sentry payload stored as-is.
- Calls `writeSystemLog(...)`, returns 200.
- No entry in `vercel.json` needed — Vercel auto-routes `api/sentry-webhook.js`.

---

## UI: `src/pages/admin/Health.jsx`

### State additions

```js
const [systemLogs, setSystemLogs]             = useState(null)
const [systemLogsLoading, setSystemLogsLoading] = useState(true)
const [resolvingLogId, setResolvingLogId]     = useState(null)
const [expandedLogIds, setExpandedLogIds]     = useState(new Set())
const systemLogsTimerRef                      = useRef(null)
```

### Polling

```js
const INTERVAL_LOGS = 60 * 1000  // 60s

// loadSystemLogs: same fetch pattern as loadFailures, loadVitals, etc.
// useEffect fires on mount; setInterval at INTERVAL_LOGS.
// loadSystemLogs also added to handleRefresh's Promise.all.
```

### Section placement

Bottom of page, after "Never Converted". Uses the existing `SectionHeading` component. Count badge next to heading: red background if unresolved count > 0, green if 0 — matching the "Failed Generations" badge.

### Log entry card

Each unresolved log renders as a flex row card:

- **Left border**: 3px, coloured by severity — `RED` for error, `AMBER` for warning, `BLUE` for info.
- **Severity badge**: pill, JetBrains Mono 11px, coloured background (matching left border colour).
- **Feature name**: Poppins 13px, white.
- **Timestamp**: `timeAgo(log.created_at)`, Poppins 11px, muted — right-aligned.
- **`plain_message`**: Poppins 13px, `DIM` colour, full width below the top row.
- **"Show detail" / "Hide detail" toggle**: Poppins 11px ghost button. Toggled per-card via `expandedLogIds` Set. Expanded view shows `raw_detail` as `<pre>` with `JSON.stringify(raw_detail, null, 2)`, monospace, dark surface background.
- **Resolve button**: green, same style as payment issues resolve button. On click: optimistically removes card from `systemLogs` state, then calls `POST /api/admin?action=resolve_log`. Sets `resolvingLogId` during the call.

### Loading skeleton

Five shimmer bars (`height: 56`, `background: rgba(255,255,255,0.04)`, `borderRadius: 8`) — matching failures widget skeleton.

### Empty state

```
No issues detected — system is healthy
```
Poppins 13px, `GREEN` colour. No card, no border.

---

## Constraints

- `writeSystemLog` must never throw — it must not propagate to the caller.
- The Sentry webhook must not process payloads with invalid HMAC signatures.
- `system_logs` is additive — no changes to `generation_failures` or any existing table.
- The UI resolve action removes the card optimistically (like payment issues), not after server confirmation.
- No changes to `vercel.json`.
