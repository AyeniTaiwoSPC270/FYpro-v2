# User Report System — Design Spec
**Date:** 2026-06-20  
**Status:** Approved  

---

## Problem

Errors surface in Telegram and the admin dashboard but carry no user context — you know something broke, not how badly it affected a real student or what they were doing. There is no channel for users to signal when a problem persists.

---

## Solution

A lightweight in-app report system: a `ReportButton` component that appears in two places (inside `ApiErrorBox` after repeated failures, and as a standing link in the Dashboard header), backed by a `user_reports` table, a new API action, Telegram alerts, admin email, and a Reports tab in Mission Control.

---

## 1. Database — Migration 0035

**Table: `user_reports`**

| Column | Type | Notes |
|---|---|---|
| `id` | uuid PK | `gen_random_uuid()` |
| `user_id` | uuid FK → auth.users | CASCADE on delete |
| `type` | text | CHECK IN (`'error'`, `'general'`) |
| `description` | text | User-typed, max 1000 chars |
| `context` | jsonb | `{ url, step_name?, error_message? }` |
| `status` | text | CHECK IN (`'open'`, `'acknowledged'`, `'resolved'`), DEFAULT `'open'` |
| `created_at` | timestamptz | DEFAULT `now()` |

**Indexes:** `user_reports_user_idx`, `user_reports_status_idx`, `user_reports_created_idx`

**RLS:**
- Users can INSERT own rows only (`auth.uid() = user_id`)
- Users can SELECT own rows only
- No client UPDATE or DELETE — status updates go through service_role via the admin API action
- Admin reads via service_role in `api/notify.js`

---

## 2. API — `api/notify.js`

Two new actions added to `notify.js` (keeps function count at 12/12):

### `submit-report` (POST, JWT required)
**Validation:**
- `description`: non-empty string, max 1000 chars
- `type`: must be `'error'` or `'general'`
- `context`: object with `url` (string), optional `step_name` (string), optional `error_message` (string)

**On success:**
1. Insert row into `user_reports`
2. Fire Telegram alert (format below)
3. Fire Resend email to `hello@fypro.com.ng` (format below)
4. Return `{ ok: true }`

**Rate limiting via Upstash:**
- 5 reports per user per day
- 10 reports per IP per day
- Returns 429 on breach

### `update-report-status` (POST, admin-only)
- Requires `Authorization: Bearer <token>` header — verifies JWT via `supabaseAdmin.auth.getUser(token)` to get the caller's email, then does a timing-safe comparison against `process.env.ADMIN_EMAIL` (same double-check pattern as `api/admin.js`)
- Accepts `{ report_id, status }` where status is `'acknowledged'` or `'resolved'`
- Updates `user_reports` via service_role
- Returns `{ ok: true }`

---

## 3. Frontend Components

### `src/components/ReportButton.jsx`

Self-contained button + modal. No external state dependencies.

**Props:**
- `type`: `'error'` | `'general'`
- `context`: `{ url, step_name?, error_message? }`
- `label`: string — button text (default: `"Report this issue"`)

**States:** idle → modal open → submitting → success | error

**Modal structure:**
- Heading: "Report an issue"
- Textarea: placeholder "Tell us what happened" (max 1000 chars, shows char count)
- Submit + Cancel buttons
- Success state: replaces form with "Report received. We'll look into it and fix it."
- Error state: inline error message, user can retry

**Styling rules:**
- All colors via CSS variables (`var(--color-bg-card)`, `var(--color-text-primary)`, `var(--color-border)`, `var(--color-blue-primary)` etc.) — zero hardcoded hex
- Backdrop overlay: `rgba(0,0,0,0.5)` — works in both light and dark mode
- Submit button: blue primary (`var(--color-blue-primary)`), consistent with app CTAs
- Cancel: ghost button with border
- Modal uses `var(--shadow-card)` for elevation
- Fully tested in both light and dark mode before shipping

### `src/components/ApiErrorBox.jsx` — extended

**New logic:**
- Tracks `retryCount` internally via `useState` (not `useRef` — needs to trigger a re-render to show the report button)
- Wraps `onRetry` internally: clicking "Try Again" calls `setRetryCount(c => c + 1)` then calls the parent's `onRetry()`. This way the count is accurate regardless of whether the parent's retry succeeds or fails.
- Accepts new optional prop `stepName` (string) — passed in by each feature component that uses `ApiErrorBox`
- When `retryCount >= 2`, renders `ReportButton` below the retry button

**Prompt text shown at `retryCount >= 2`:**
> "Still not working? Let us know and we'll fix it."

**Context auto-filled:**
```js
{ url: window.location.pathname, step_name: stepName, error_message: error }
```

**Reset rule:** A `useEffect` watching the `error` prop resets `retryCount` to 0 when `error` clears — prevents a stale count carrying over if the same component is reused after a successful retry.

### `Dashboard.jsx` — general report entry point

A muted *"Report an issue"* text link added to the dashboard header bar, positioned next to the notification bell. Styled as a secondary action (not a prominent button — should not alarm users or imply the app is broken).

- Type: `'general'`
- Context: `{ url: window.location.pathname }`
- Uses the same `ReportButton` modal

---

## 4. Admin Dashboard — Health.jsx

**New "Reports" tab** added after the Logs tab.

Tab label shows a live open-report badge count: **Reports (3)**. Badge only shows when count > 0.

**Tab contents:**

1. **Filter row** — pill buttons: All / Open / Acknowledged / Resolved. Default view: Open only.
2. **Report list** — newest first, each row shows:
   - Status chip: `open` (red), `acknowledged` (amber), `resolved` (green) — JetBrains Mono
   - Type badge: `error` (red tint) or `general` (blue tint)
   - User email (truncated to 30 chars)
   - Step name or URL
   - Description preview (first 80 chars)
   - Time ago
   - Inline action buttons: **Acknowledge / Resolve / Expand**
3. **Expanded row** — full description + context JSON in a dark code block (`background: var(--color-bg-deep)`)

**Status updates** call `update-report-status` action on `notify.js`. No page reload — optimistic UI update on success.

All design tokens match the existing Health.jsx dark admin theme (`BG`, `SURFACE`, `CARD`, `BORDER`, `RED`, `AMBER`, `GREEN`). Health.jsx is dark-only so no light mode concern for this tab.

---

## 5. Telegram

### Alert format (fires on every new report)
```
🚨 User Report [error]
👤 student@unilag.edu.ng
📍 Step: chapter_architect
🔗 /app/step/2
💬 "The generate button keeps spinning and never..."
⏱ just now
```

### `/reports` command
Returns last 10 open reports, numbered, with type + email + step + time + description preview.

Added to `runCommand()` dispatcher and `KEYBOARD` inline button grid alongside existing commands.

### `/resolve-report <id-prefix>`
Marks a report as resolved directly from Telegram. Same pattern as existing `/resolve` for system logs — accepts minimum 4 chars of the report UUID prefix.

Added to `cmdHelp()` and `KEYBOARD`.

---

## 6. Admin Email

Fires alongside the Telegram alert on every new `submit-report` call.

**From:** `FYPro <hello@fypro.com.ng>`  
**To:** `hello@fypro.com.ng`  
**Subject:** `[FYPro Report] error — chapter_architect`  
**Body:** HTML email (matches existing contact-form email style) with full description, context fields, and user email. Uses existing `Resend` client already imported in `notify.js`.

---

## 7. Constraints & Non-Goals

- **Function limit:** No new Vercel functions — everything added as actions inside `notify.js`. Count stays at 12/12.
- **Auth required:** Reports are authenticated-only. `ApiErrorBox` and `Dashboard` are both behind `ProtectedRoute`.
- **No anonymous reports:** Public pages (Landing, Pricing, Auth) do not show a report button.
- **No file attachments:** Text description only.
- **No email reply to user:** Not in scope for v1. User sees confirmation in the modal only.
- **Context PII:** `context` JSON stores only `url` (pathname, no query params), `step_name`, and `error_message` (the string already visible to the user in the UI). No names, emails, or project content stored in context.

---

## 8. File Changelist

| File | Change |
|---|---|
| `migrations/0035_user_reports.sql` | New migration |
| `api/notify.js` | Add `submit-report`, `update-report-status`, `cmdReports()`, `/resolve-report` |
| `src/components/ReportButton.jsx` | New component |
| `src/components/ApiErrorBox.jsx` | Add retry counter + ReportButton trigger |
| `src/pages/admin/Health.jsx` | Add Reports tab |
| `src/pages/Dashboard.jsx` | Add report link to header |

---

## 9. Open Questions (resolved)

| Question | Decision |
|---|---|
| When does report button appear in ApiErrorBox? | After 2+ retries fail |
| What context is auto-captured? | `{ url, step_name, error_message }` |
| Status management? | Three states: open / acknowledged / resolved |
| Approach? | A — structured report system, no new Vercel function |
| Light/dark mode? | All frontend components use CSS variables only, zero hardcoded hex |
