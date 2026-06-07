# FYPro Email Redesign — Design Spec
Date: 2026-06-07

## Summary

Redesign all 5 user-facing email templates to the **Dark Prestige** direction with **color-per-type** differentiation. Every email must feel like it belongs to FYPro — dark navy, sharp typography, color-coded by purpose.

---

## Design Direction: Dark Prestige

Full dark navy email. White/dim text on dark background. Each email differentiated by a unique accent color. Matches the FYPro app aesthetic exactly.

**Never:** white cards, plain grey backgrounds, generic blue buttons on everything, system fonts.

---

## Anatomy — Shared Across All 5 Emails

Every email shares this structure top-to-bottom:

1. **Accent bar** — 3px solid line in the email's accent color. First thing rendered.
2. **Header** — `background: linear-gradient(160deg, #0D1B2A 0%, #0a1520 100%)`. Contains:
   - Shield icon (inline SVG, blue stroke `#3b82f6`, 34×34px, rounded box background)
   - Wordmark: `FYPro` — "FY" white, "Pro" blue (`#3b82f6`), 17px bold
   - Tagline: `Your Final Year Companion` — 9px, `rgba(255,255,255,0.28)`, uppercase, letter-spacing 1.8px
3. **Type pill** — small colored badge below header, labels the email type (e.g. "Welcome", "Defense Prep")
4. **Body** — `background: #0D1B2A`, padding 22px. Contains headline, copy, CTA button.
5. **HR** — `rgba(255,255,255,0.06)` divider
6. **Footer** — 10.5px, `rgba(255,255,255,0.2)`. "You're receiving this because…", "FYPro · Lagos, Nigeria", unsubscribe link.

---

## Color Map — One Accent Per Email

| Email | Accent Color | Hex | Used On |
|---|---|---|---|
| Welcome | Green | `#16A34A` | Accent bar, pill, CTA button |
| Defense Nudge | Blue | `#0066FF` | Accent bar, pill, CTA button |
| Urgency Reminder | Red | `#DC2626` | Accent bar, pill, CTA button |
| Payment Receipt | Amber | `#D97706` | Accent bar, pill, CTA button, amount text |
| Broadcast | Teal | `#0891B2` | Accent bar, pill, content border |

---

## Per-Email Specs

### 1. Welcome — `welcome.tsx`
- **Trigger:** Day 0 nurture (signup)
- **Subject:** `Your FYPro journey starts now — validate your topic in 2 minutes`
- **Preview text:** `Your FYPro journey starts now — validate your topic in 2 minutes`
- **Accent:** Green `#16A34A`
- **Pill label:** "Welcome"
- **Headline:** `{firstName}, your research journey starts today.`
- **Body:** You've joined thousands of Nigerian final year students who are taking their project seriously. Your next step is simple — paste your topic idea and find out if it's defensible before your supervisor ever sees it.
- **CTA:** "Validate your topic now →" → `{baseUrl}/app/topic-validator`
- **Footer:** Standard

### 2. Defense Nudge — `defense-nudge.tsx`
- **Trigger:** Day 3 nurture
- **Subject:** `Meet your AI examiners before the real thing — free first session inside`
- **Accent:** Blue `#0066FF`
- **Pill label:** "Defense Prep"
- **Headline:** `{firstName}, have you met your examiners yet?`
- **Body:** Most students walk into their defense never having practiced out loud. FYPro's Defense Simulator puts you in front of three AI examiners who push back exactly the way the real panel will. Find out where you're weak before it matters.
- **CTA:** "Try a Defense Simulation →" → `{baseUrl}/app/defense`
- **Footer:** Standard

### 3. Urgency Reminder — `urgency-reminder.tsx`
- **Trigger:** Day 7 nurture
- **Subject:** `Defense checklist — where do you stand right now?`
- **Accent:** Red `#DC2626`
- **Pill label:** "Checklist"
- **Headline:** `{firstName} — a week in. Are you ready?`
- **Body:** "The clock is moving. Run through this before you do anything else:"
- **Checklist items (4 unchecked boxes):**
  - Topic locked and validated?
  - Methodology chosen and defensible?
  - Project PDF uploaded for review?
  - Defense Simulator score 7 or above?
- **CTA:** "Open my dashboard →" → `{baseUrl}/dashboard`
- **Footer:** Standard

### 4. Payment Receipt — `sendReceiptEmail()` in `api/payments.js`
- **Trigger:** Webhook-verified payment success
- **Subject:** `Your FYPro receipt — {planDisplay}`
- **Accent:** Amber `#D97706`
- **Pill label:** "Payment Confirmed"
- **Headline:** `Your FYPro access is unlocked.`
- **Receipt box** (`background: rgba(255,255,255,0.04)`, `border: 1px solid rgba(255,255,255,0.07)`, `border-radius: 8px`):
  - Row: Plan → `{planDisplay}`
  - Row: Amount paid → `₦{amount}` (amber color `#F59E0B`)
  - Row: Reference → `{reference}` (monospace, 10px)
- **Body:** "You now have full access. Log in to continue."
- **CTA:** "Go to my dashboard →" → `https://fypro.com.ng/dashboard`
- **Footer:** "Keep this email as your receipt. FYPro · Lagos, Nigeria · hello@fypro.com.ng"

### 5. Broadcast — `buildBroadcastHtml()` in `api/notify.js`
- **Trigger:** Admin Telegram `/broadcast` command
- **Subject:** Passed in from Telegram command
- **Accent:** Teal `#0891B2`
- **Pill label:** "Announcement"
- **Headline:** "A message from FYPro"
- **Content block:** `background: rgba(8,145,178,0.1)`, `border-left: 3px solid #0891B2`, `border-radius: 0 6px 6px 0`, `padding: 10px 14px`. Contains the broadcast body text (HTML-escaped, newlines → `<br>`).
- **No CTA button** — broadcast is informational only
- **Footer:** "You're receiving this because you have an account at fypro.com.ng. FYPro · Lagos, Nigeria"

---

## Implementation Files

### React Email templates (templates 1–3)
These use `@react-email/components`. The new design must be implemented as inline styles (React Email renders to email-safe HTML).

- `src/emails/templates/welcome.tsx` → also mirrored to `api/_emails/templates/welcome.tsx`
- `src/emails/templates/defense-nudge.tsx` → also mirrored to `api/_emails/templates/defense-nudge.tsx`
- `src/emails/templates/urgency-reminder.tsx` → also mirrored to `api/_emails/templates/urgency-reminder.tsx`

**Important:** Both `src/emails/` and `api/_emails/` must be updated — they are identical copies. The nurture email sender (`api/admin.js` and `api/send-nurture-email.ts`) uses the `api/_emails/` versions at runtime.

### Raw HTML templates (templates 4–5)
These are raw HTML strings built in serverless functions. No React Email.

- `api/payments.js` → `sendReceiptEmail()` function — replace the inline HTML string
- `api/notify.js` → `buildBroadcastHtml()` function — replace the inline HTML string

### Shared SVG shield snippet
All 5 emails use the same header. Extract into a shared constant or inline directly. For raw HTML functions, it's a string. For React Email, it's a JSX `<svg>` element.

```
Shield SVG path: M9 2L3 5v5c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V5L9 2z
Checkmark path: M6.5 9.5l2 2 3-3
Stroke color: #3b82f6
Viewbox: 0 0 18 18
Container: 34×34px, background rgba(0,102,255,0.12), border 1.5px solid rgba(0,102,255,0.35), border-radius 7px
```

---

## Email Client Compatibility Notes

- No CSS animations — email clients strip them
- No `@import` or Google Fonts — fallback to Arial in all templates
- All styles must be inline (React Email handles this automatically; raw HTML templates already use inline styles)
- Background images are blocked in many clients — use solid/gradient backgrounds only
- `border-radius` works in Gmail, Apple Mail, modern clients — acceptable risk for minor clients
- The `linear-gradient` on the header background may fall back to `#0D1B2A` in Outlook — acceptable

---

## What Is NOT Changing

- Email subjects (kept as-is)
- Sending logic in `api/send-nurture-email.ts` and `api/admin.js`
- The `render.tsx` files
- The Supabase auth confirmation email (controlled via Supabase dashboard, not in codebase)
- Admin-facing emails (payment issue alert, spend cap alert, contact form) — utility alerts, not in scope
