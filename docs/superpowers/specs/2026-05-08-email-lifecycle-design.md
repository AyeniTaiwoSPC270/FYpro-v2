# FYPro — 3-Email Lifecycle Sequence Design

**Date:** 2026-05-08
**Status:** Approved

---

## What We Are Building

A triggered 3-email onboarding sequence sent to every verified FYPro user:

| Day | Email type | Trigger | CTA |
|-----|-----------|---------|-----|
| 0 | `welcome` | email_confirmed_at is not null + no prior log row | Validate your topic now → /app/topic-validator |
| 3 | `defense_nudge` | confirmed ≥ 3 days ago + no prior log row | Try a Defense Simulation → /app/defense |
| 7 | `urgency_reminder` | confirmed ≥ 7 days ago + no prior log row | Open my dashboard → /dashboard |

Users can opt out of individual email types or unsubscribe entirely via `/account/email-preferences`.

---

## Architecture

```
Supabase Edge Function (Deno)
  Cron: 0 9 * * * (9am UTC = 10am Lagos)
  └─ SELECT eligible users per email type from auth.users + email_log
  └─ For each user: check email_preferences (skip if unsubscribed)
  └─ POST /api/send-nurture-email { userId, emailType, email, name }
         Authorization: Bearer CRON_SECRET

Vercel Function: /api/send-nurture-email.ts (Node.js)
  └─ Verify CRON_SECRET header — reject 401 if missing/wrong
  └─ Render React Email template to HTML string
  └─ POST Resend API (from: FYPro <hello@fypro.com.ng>)
  └─ INSERT email_log row via service_role Supabase client
       status: 'sent' + resend_id on success
       status: 'failed' on Resend error (do not throw — continue)
  └─ Return { ok, resendId, alreadySent }
```

**Why Edge → Vercel instead of rendering in Deno:**
React Email (`@react-email/render`) requires JSX compilation that works cleanly in Node.js but adds significant complexity in Deno's module system. The Edge Function handles scheduling/eligibility only; the Vercel function handles rendering + sending. Clean separation of concerns.

---

## Database

### `email_log`

```sql
CREATE TABLE public.email_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  email_type text not null check (email_type in ('welcome','defense_nudge','urgency_reminder')),
  sent_at timestamptz not null default now(),
  resend_id text,
  status text not null default 'sent'
);

CREATE UNIQUE INDEX email_log_unique ON public.email_log(user_id, email_type);
CREATE INDEX email_log_sent_at_idx ON public.email_log(sent_at desc);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service role only" ON public.email_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

**Idempotency:** The UNIQUE INDEX on `(user_id, email_type)` prevents duplicate sends even if the cron fires twice. The Vercel function catches the unique violation and returns `{ ok: true, alreadySent: true }` without sending a second email.

### `email_preferences`

```sql
CREATE TABLE public.email_preferences (
  user_id uuid primary key references auth.users(id) on delete cascade,
  welcome_enabled boolean not null default true,
  defense_nudge_enabled boolean not null default true,
  urgency_reminder_enabled boolean not null default true,
  unsubscribed_all boolean not null default false,
  updated_at timestamptz not null default now()
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own prefs" ON public.email_preferences
  FOR SELECT TO authenticated USING ((select auth.uid()) = user_id);
CREATE POLICY "user updates own prefs" ON public.email_preferences
  FOR UPDATE TO authenticated
  USING ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);
CREATE POLICY "user inserts own prefs" ON public.email_preferences
  FOR INSERT TO authenticated WITH CHECK ((select auth.uid()) = user_id);
```

No DELETE policy — the row persists; `unsubscribed_all = true` is the signal.

---

## Files

### New files

| Path | Description |
|------|-------------|
| `supabase/migrations/2026_06_email_log.sql` | email_log DDL + RLS |
| `supabase/migrations/2026_06_email_preferences.sql` | email_preferences DDL + RLS |
| `supabase/functions/email-nurture/index.ts` | Deno Edge Function |
| `supabase/config.toml` | Created fresh — cron registration |
| `api/send-nurture-email.ts` | Vercel function (render + send + log) |
| `src/emails/templates/welcome.tsx` | React Email template |
| `src/emails/templates/defense-nudge.tsx` | React Email template |
| `src/emails/templates/urgency-reminder.tsx` | React Email template |
| `src/emails/render.ts` | `renderTemplate(type, props) → string` |
| `src/pages/account/EmailPreferences.jsx` | Auth-gated preferences page |
| `src/components/Footer.jsx` | Footer with email prefs link |

### Modified files

| Path | Change |
|------|--------|
| `src/App.jsx` | Add `/account/email-preferences` route |
| `src/pages/LandingPage.jsx` | Render `<Footer />` (public pages) |
| `src/pages/Dashboard.jsx` | Render `<Footer />` (authenticated pages) |
| `package.json` | Add `@react-email/components`, `@react-email/render` |

---

## Environment Variables

| Variable | Where | Purpose |
|----------|-------|---------|
| `RESEND_API_KEY` | Vercel env vars + Supabase function secrets | Resend API auth |
| `SUPABASE_SERVICE_ROLE_KEY` | Vercel env vars only | Write to email_log from send-nurture-email.ts |
| `CRON_SECRET` | Vercel env vars + Supabase function secrets | Auth between Edge Function and Vercel endpoint |

`CRON_SECRET` is a new env var — a random 32-char string generated once and added to both Vercel and Supabase dashboard secrets.

---

## Email Templates — Content Rules

- Tone: plain language, Nigerian university student, no stock marketing copy
- `from`: `FYPro <hello@fypro.com.ng>`
- All links HTTPS
- Every email footer: physical address ("FYPro · Lagos, Nigeria"), unsubscribe link to `/account/email-preferences`, "You're receiving this because you signed up for FYPro"
- `List-Unsubscribe` header set on every Resend send: `<mailto:unsubscribe@fypro.com.ng>, <https://fypro.com.ng/account/email-preferences>`

| Type | Body | CTA |
|------|------|-----|
| welcome | 1 short paragraph | "Validate your topic now" → /app/topic-validator |
| defense_nudge | 1 short paragraph | "Try a Defense Simulation" → /app/defense |
| urgency_reminder | 1 short paragraph + 4-item checklist | "Open my dashboard" → /dashboard |

---

## Email Preferences Page (`/account/email-preferences`)

- Auth required (wrapped in `<ProtectedRoute>`)
- Matches Settings.jsx visual pattern: same navbar, card style, ToggleRow components
- Four toggles: welcome, defense_nudge, urgency_reminder, unsubscribe_all
- Turning on `unsubscribed_all` disables and greys out the three individual toggles
- Reads/writes `email_preferences` via authenticated Supabase client (RLS handles isolation)
- Upsert on first visit (INSERT if no row, UPDATE thereafter)
- Optimistic UI: toggle flips immediately; toast on save; reverts on error

---

## Security

- `RESEND_API_KEY`: Vercel env vars + Supabase function secrets only. Never in source.
- `SUPABASE_SERVICE_ROLE_KEY`: Vercel env vars only. Never in `src/`. Never logged.
- `CRON_SECRET`: Shared secret in both environments. Rejects 401 on mismatch.
- `email_log`: service_role only. Users cannot read Resend message IDs.
- Edge Function logs: user_id (uuid), email_type, success/fail only. No email addresses. No HTML body.
- `List-Unsubscribe` header set on every send for inbox provider compliance.
- Unique index prevents duplicate sends on cron retry.

---

## Verification Steps

1. Sign up fresh test email → verify → next cron tick → welcome email arrives.
2. Manually set `email_confirmed_at` to 4 days ago for test user → trigger function → defense_nudge arrives; welcome not resent (already in email_log).
3. Unsubscribe via `/account/email-preferences` → trigger function → no emails sent.
4. Trigger function twice in quick succession → second run: unique constraint catches duplicate → no second email sent.
