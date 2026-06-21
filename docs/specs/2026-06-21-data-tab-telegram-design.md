# Data Tab + Telegram /data Command — Design Spec
Date: 2026-06-21

## Problem

Checking Supabase directly to inspect table data is slow and hard to read — 29 tables, wide rows, no quick way to get a pulse on the product from the admin dashboard or on the go via Telegram.

## Solution

**Hybrid approach (Option C):**
- A new **Data tab** in `/admin/health` with two sections: curated KPI charts for 8 key tables at the top, and a full table browser for all 29 tables below.
- A new **`/data` command** in the Telegram bot that returns the last N rows of any table in a readable text format.

---

## Constraints

- **Read-only everywhere.** No edit, delete, or insert from the Data tab or Telegram. Write operations stay in their existing dedicated tabs (Users, Payments, Ratings).
- Recharts is already imported in `Health.jsx` — use it for all charts. No new charting library.
- All data fetched via a new `api/admin.js` action (`action=data-tab`) using the Supabase service-role client. The client never queries Supabase directly from the Data tab.
- Table browser search uses server-side filtering (`ilike`) — never client-side string matching on raw rows, to avoid pulling thousands of rows to the browser.
- The Telegram `/data` command is handled in `api/notify.js` alongside existing bot commands.

---

## 1. Data Tab — Curated Section (top)

### KPI Cards (row of 4)
Always visible at the top. Hard-coded to these four:

| Card | Value | Sub-label |
|------|-------|-----------|
| Total Users | `count(users)` | +N today |
| Total Revenue | `sum(payments.amount_kobo where status='success')` converted to ₦ | +₦X today |
| Defense Sessions | `count(defense_sessions)` | avg score N/10 |
| Certificates | `count(defense_certificates)` | pass rate N% (certificates ÷ total defense_sessions) |

### Charts Grid (2×2, then 2×2)
8 curated charts in a 2-column grid. Each chart is a card with a title and a small type label.

| # | Table | Chart type | Query |
|---|-------|-----------|-------|
| 1 | users | Bar — signups per day, last 7 days | `created_at` grouped by date |
| 2 | payments | Pie — revenue split by tier | `sum(amount_kobo)` grouped by `tier` where `status='success'` |
| 3 | projects | Pie — status breakdown | `count` grouped by `status` (active/archived/draft); mode split (standard vs express) shown as two stat labels below the pie, not a second chart |
| 4 | defense_sessions | Histogram — score distribution | `count` grouped by `total_score` (1–10 buckets) |
| 5 | defense_certificates | Line — certs issued over time | `count` grouped by `issued_at` date, last 30 days |
| 6 | user_achievements | Bar — top achievements by frequency | `count` grouped by `achievement_key`, top 8 |
| 7 | referrals | Line — referrals over time | `count` grouped by `created_at` date, last 30 days |
| 8 | generation_failures | Horizontal bar — failures by step | `count` grouped by `step` (or equivalent column), top 6 |

All chart data fetched in a single `action=data-tab` call that returns all 8 datasets in one response. No waterfall of 8 separate requests.

---

## 2. Data Tab — Table Browser (bottom)

### Controls (row)
- **Table dropdown** — lists all 29 tables alphabetically, each labelled with row count (e.g. `auth_attempts (450 rows)`). Row counts fetched with charts data on tab load.
- **Search input** — plain text, triggers server-side `ilike` filter across text columns only (not UUIDs, booleans, or numerics) of the selected table. Debounced 400ms.
- **Rows per page** — 20 / 50 / 100 (default 20).

### Table display
- Columns auto-derived from the first row returned. UUIDs truncated to 8 chars + `...`. Boolean values shown as coloured badges (green `true` / red `false`). Timestamps formatted `DD Mon YY, HH:MM`.
- Column headers are clickable to sort (asc/desc). One active sort at a time.
- Pagination: Prev / page numbers / Next. Shows "Showing X–Y of Z".

### API action
`GET /api/admin?action=data-browse&table=payments&search=abc&page=1&limit=20&sort=created_at&dir=desc`

Server validates `table` against a hardcoded allowlist of all 29 table names before querying — no dynamic table name injection possible.

---

## 3. Telegram `/data` Command

### Format
```
/data <table> [limit]
```
- `<table>` — any of the 29 allowed tables (case-insensitive)
- `[limit]` — optional, 1–20, defaults to 5

### Response format
```
📦 payments — last 3 rows

1. ₦3,500 · defense_pack · ✅ success · 21 Jun 14:32
2. ₦2,000 · student_pack · ✅ success · 21 Jun 13:15
3. ₦1,500 · project_reset · ⏳ pending · 21 Jun 11:44

Total rows: 89 · /data payments 10 for more
```

Each table has a **key columns config** — a hardcoded map of `table → [col1, col2, col3, col4]` that determines what appears per row. This keeps messages short and readable. Unknown tables fall back to showing `id` + `created_at` only.

Key columns per table:

| Table | Columns shown |
|-------|--------------|
| users | email, full_name, university, created_at |
| payments | amount_kobo (as ₦), tier, status, created_at |
| projects | title, status, mode, created_at |
| defense_sessions | total_score, completed_at |
| defense_certificates | certificate_number, issued_at |
| user_achievements | achievement_key, earned_at |
| referrals | source_user_id (truncated), created_at |
| generation_failures | step, error (truncated 60 chars), created_at |
| auth_attempts | email, success, created_at |
| notifications | type, title, created_at |
| system_logs | level, message (truncated 80 chars), created_at |
| *all others* | id (truncated), created_at |

### Error cases
- Unknown table name → `❌ Unknown table. Try: users, payments, projects, defense_sessions...`
- Limit out of range → clamp silently to 1–20
- Query error → `❌ Query failed. Check logs.`

---

## 4. Backend — api/admin.js changes

Two new actions added to the existing `api/admin.js` (stays within the 12-function limit):

### `action=data-tab`
Returns all chart data + table row counts in one call.
```json
{
  "kpis": { "total_users": 13, "revenue_ngn": 178500, "defense_sessions": 31, "certificates": 2, "revenue_today_ngn": 3500, "users_today": 2, "avg_score": 6.4, "pass_rate": 6.5 },
  "charts": {
    "users_by_day": [...],
    "payments_by_tier": [...],
    "projects_by_status": [...],
    "score_distribution": [...],
    "certs_by_day": [...],
    "top_achievements": [...],
    "referrals_by_day": [...],
    "failures_by_step": [...]
  },
  "table_counts": { "users": 13, "payments": 89, "auth_attempts": 450, ... }
}
```

### `action=data-browse`
Params: `table`, `search`, `page`, `limit`, `sort`, `dir`
Returns:
```json
{
  "rows": [...],
  "total": 450,
  "page": 1,
  "limit": 20
}
```

---

## 5. Frontend — Health.jsx changes

- New tab `'data'` added to the tab switcher.
- `loadDataTab()` function fetches `action=data-tab` — called on tab switch and every 60s while active.
- `loadTableBrowser()` function fetches `action=data-browse` — called on table change, search, page change, or sort change.
- Search input debounced with `useRef` + `setTimeout` (400ms). No new deps needed.
- Charts rendered with existing Recharts components: `BarChart`, `LineChart`, `PieChart` (add `PieChart`, `Pie`, `Cell` to existing import).

---

## 6. Polling Strategy

| Section | Poll interval while Data tab active |
|---------|-------------------------------------|
| Charts + KPIs | 60s (same as Payments tab) |
| Table browser | No auto-poll — manual refresh only (user is mid-browse) |

---

## 7. Security

- `table` param in `data-browse` validated against a hardcoded allowlist — no raw string interpolation into SQL.
- `search` param passed as a Supabase `.ilike()` parameter — never string-concatenated into a query.
- `sort` param validated server-side: only accepted if it matches a key present in the response rows; otherwise defaults to `created_at desc` silently.
- All `/data` Telegram commands require the message to come from `TELEGRAM_CHAT_ID` (same as existing bot commands). No public access.
- Service-role key used server-side only, same as all other admin actions.

---

## Out of Scope

- Editing or deleting rows from the Data tab or Telegram
- Exporting table data to CSV
- Chart date range pickers (charts use fixed windows: 7 days for bar, 30 days for line)
- Real-time row streaming
- Column visibility toggles in the table browser
