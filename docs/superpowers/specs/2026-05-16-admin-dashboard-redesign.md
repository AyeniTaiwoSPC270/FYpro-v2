# Admin Dashboard Redesign — Design Spec
**Date:** 2026-05-16
**File:** `src/pages/admin/Health.jsx`
**Direction:** Mission Control (Option B)

---

## 1. Architecture

Health.jsx stays as a single file — no split into sub-components. The current monolithic structure is manageable and splitting would add coordination overhead with no benefit.

The page gains a **tab navigation system** on top of its existing section structure. Each tab renders its section's content; all data fetching and state remain as-is (auto-refresh intervals, existing handlers).

**Tab structure:**
| Tab | Content |
|-----|---------|
| Overview | KPI cards + signups chart + live activity feed |
| Users | Search/sort/paginate user table + actions |
| Payments | Payment issues table + payment stats |
| Vitals | System health cards (API/DB/Redis/TTS/Paystack/Sentry) |
| Logs | System logs + auth attempts + generation failures |

A red badge on the Vitals tab shows the count of degraded/down services. Logs tab shows unread failure count.

---

## 2. Visual System

All colors from the existing design tokens in Health.jsx (`BG=#060E18`, `SURFACE=#0D1B2A`, `CARD=#0F2235`). No new hex values introduced.

**Glassmorphism cards:**
```css
background: rgba(15,34,53,0.7);
border: 1px solid rgba(255,255,255,0.08);
border-radius: 14px;
backdrop-filter: blur(12px);
```

**KPI glow colors** (text-shadow only — not background):
- Total users → blue glow (`#60A5FA`, shadow `rgba(0,102,255,0.6)`)
- Revenue → green glow (`#4ade80`, shadow `rgba(22,163,74,0.5)`)
- AI spend → amber glow (`#fbbf24`, shadow `rgba(245,158,11,0.5)`)
- Defenses done → white, no glow

**Fonts:** `JetBrains Mono` for KPI values, `Poppins` for labels and body, `DM Serif Display` for the page title only.

---

## 3. Animations

All animations use CSS keyframes + `framer-motion` (already in project). No new animation libraries.

| Animation | Trigger | Implementation |
|-----------|---------|----------------|
| Card slide-up | Tab enter / page load | `motion.div` with `initial={{opacity:0,y:16}}` + stagger delay per card index |
| KPI counter | Tab enter (Overview) | `useEffect` with `requestAnimationFrame` counter loop, 1200–1600ms duration, ease-out cubic |
| Bar chart grow | Tab enter (Overview) | CSS `scaleY` keyframe on bars, staggered per bar via `animationDelay` |
| Activity feed slide-in | Tab enter (Overview) | `framer-motion` `AnimatePresence` with `initial={{opacity:0,x:12}}`, stagger 60ms |
| Vital pulse dot | Continuous | CSS `@keyframes pulse` (already in codebase) |
| Tab switch fade | Tab click | `AnimatePresence` wrapping tab content, `initial={{opacity:0}}` `animate={{opacity:1}}` 150ms |

Counter animation only runs once per tab-enter (tracked with a ref, reset on tab leave).

---

## 4. Layout & Responsiveness

**Desktop (≥1024px):** Top bar → tabs → main content (max-width 1400px, padding 28px)

**Tablet (768–1023px):** Same tab bar (wraps if needed), KPI grid 2-column, chart+feed stack vertically

**Mobile (<768px):** Tab bar hidden → replaced by `<select>` dropdown. KPI grid 1-column. All tables horizontally scrollable with `overflow-x: auto`. Action buttons stack below user row.

---

## 5. UI State Fixes (included in this redesign)

These 4 states must be handled in every data-fetching section:

| State | Implementation |
|-------|---------------|
| Loading | Skeleton pulse blocks replacing card content (`animate-pulse bg-slate-700/50`) |
| Empty | Centered message with icon and explanation text |
| Error | Red-bordered card with error message + retry button |
| Success | Normal content render |

Specific gaps to fix:
- Users table: add skeleton rows (5 rows × 6 cols) while `data` is null; add empty state "No users yet" when `data.users.length === 0`
- Vitals: skeleton cards while `vitals` is null
- Logs: skeleton rows while `systemLogs` is null
- Payment issues: empty state "No payment issues reported" when list is empty
- All action buttons (Ban, Delete, Grant Plan, Reset Usage): add `disabled` + spinner while their operation is in-flight

---

## 6. Top Bar Additions

- **Logo + "Admin"** label on the left
- **Live pulse pill** (green dot + "LIVE" text) — always visible
- **Last-refresh timestamp** — updates on each fetch cycle
- **Refresh button** — triggers all active-tab fetches manually
- **Admin avatar** — initials from `VITE_ADMIN_EMAIL`, no dropdown needed

---

## 7. What Is NOT Changing

- All existing data fetching logic, auto-refresh intervals, handlers
- All existing state variables (data, vitals, failures, authAttempts, etc.)
- Authentication gate (VITE_ADMIN_EMAIL check stays)
- Maintenance mode toggle functionality
- Sentry/Telegram/Spend card logic
- Any API endpoint

---

## 8. Out of Scope

- Real-time WebSocket updates (polling stays as-is)
- Charts switching to Recharts (existing Recharts usage stays; new bars use CSS for the weekly comparison chart)
- Dark/light mode toggle on admin (admin is dark-only)
- Pagination redesign (existing pagination logic stays, just restyled)
