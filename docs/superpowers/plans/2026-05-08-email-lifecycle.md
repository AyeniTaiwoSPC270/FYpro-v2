# 3-Email Lifecycle Sequence Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a daily-cron 3-email onboarding sequence (welcome, defense nudge, urgency reminder) with idempotent send logging, per-user preference controls, and a granular opt-out UI.

**Architecture:** A Supabase Deno Edge Function runs daily at 9am UTC, queries eligible users via a Postgres RPC function, checks per-user preferences, and POSTs each candidate to `/api/send-nurture-email` (Vercel/Node). That Vercel function renders a React Email template, sends via Resend, and records the send in `email_log`. A unique index on `(user_id, email_type)` prevents duplicate sends on retries.

**Tech Stack:** `@react-email/components` + `@react-email/render` (v1), `resend` v6, `@supabase/supabase-js` v2, Supabase Deno Edge Functions, Vercel serverless Node.js functions, React + Framer Motion (preferences UI).

---

## File Map

**New files:**
| Path | Responsibility |
|------|---------------|
| `supabase/migrations/2026_06_email_log.sql` | email_log DDL + RLS + indexes |
| `supabase/migrations/2026_06_email_preferences.sql` | email_preferences DDL + RLS |
| `supabase/migrations/2026_06_email_nurture_rpc.sql` | `get_eligible_nurture_users()` Postgres function |
| `supabase/config.toml` | Local CLI config + function declaration |
| `supabase/functions/email-nurture/index.ts` | Deno Edge Function — eligibility query + POST Vercel |
| `api/send-nurture-email.ts` | Vercel function — render template, send via Resend, write email_log |
| `src/emails/templates/welcome.tsx` | Welcome React Email template |
| `src/emails/templates/defense-nudge.tsx` | Defense Nudge React Email template |
| `src/emails/templates/urgency-reminder.tsx` | Urgency Reminder React Email template |
| `src/emails/render.tsx` | `renderTemplate(type, props)` helper — note: `.tsx` not `.ts` (needs JSX) |
| `src/pages/account/EmailPreferences.jsx` | Auth-gated preferences page at `/account/email-preferences` |
| `src/components/Footer.jsx` | Footer with conditional email prefs link for logged-in users |

**Modified files:**
| Path | Change |
|------|--------|
| `package.json` | Add `@react-email/components`, `@react-email/render` |
| `src/App.jsx` | Add `/account/email-preferences` route wrapped in ProtectedRoute |
| `src/pages/LandingPage.jsx` | Import + render `<Footer />` at bottom |
| `src/pages/Dashboard.jsx` | Import + render `<Footer />` at bottom |

---

## Task 1: Install React Email packages

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Add the two packages to package.json**

Open `package.json`. In the `"dependencies"` object, add after the existing `"resend"` line:

```json
"@react-email/components": "^0.0.36",
"@react-email/render": "^1.0.5",
```

- [ ] **Step 2: Install**

```bash
npm install
```

Expected: resolves without errors. `node_modules/@react-email/` directory appears.

- [ ] **Step 3: Verify the existing build still passes**

```bash
npm run build
```

Expected: build completes without errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "deps: add @react-email/components and @react-email/render"
```

---

## Task 2: Database — email_log migration

**Files:**
- Create: `supabase/migrations/2026_06_email_log.sql`

- [ ] **Step 1: Create the file**

Create `supabase/migrations/2026_06_email_log.sql` with this exact content:

```sql
-- email_log: idempotency record of every email sent.
-- service_role only — users do not read this from the client.
CREATE TABLE public.email_log (
  id         uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  email_type text        NOT NULL
                         CHECK (email_type IN ('welcome','defense_nudge','urgency_reminder')),
  sent_at    timestamptz NOT NULL DEFAULT now(),
  resend_id  text,
  status     text        NOT NULL DEFAULT 'sent'
                         CHECK (status IN ('sent','failed'))
);

-- Idempotency: second INSERT for the same (user, type) fails with code 23505.
-- /api/send-nurture-email catches this and returns { ok: true, alreadySent: true }.
CREATE UNIQUE INDEX email_log_unique     ON public.email_log(user_id, email_type);
CREATE INDEX        email_log_sent_at_idx ON public.email_log(sent_at DESC);

ALTER TABLE public.email_log ENABLE ROW LEVEL SECURITY;

-- No client policies — service_role only.
CREATE POLICY "service role only" ON public.email_log
  FOR ALL TO service_role USING (true) WITH CHECK (true);
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Paste the SQL block above into the Supabase dashboard SQL Editor and run it.

- [ ] **Step 3: Verify**

Run in SQL Editor:

```sql
-- Table exists and is empty
SELECT COUNT(*) FROM public.email_log;

-- Zero tables without RLS (must stay 0)
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;

-- Unique index exists
SELECT indexname FROM pg_indexes
WHERE tablename = 'email_log' AND indexname = 'email_log_unique';
```

Expected: `COUNT` = 0, RLS query = 0 rows, index query = 1 row named `email_log_unique`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026_06_email_log.sql
git commit -m "db: add email_log table with service-role-only RLS and unique idempotency index"
```

---

## Task 3: Database — email_preferences migration

**Files:**
- Create: `supabase/migrations/2026_06_email_preferences.sql`

- [ ] **Step 1: Create the file**

Create `supabase/migrations/2026_06_email_preferences.sql`:

```sql
-- email_preferences: per-user opt-out controls.
-- Authenticated users can SELECT, INSERT, UPDATE their own row.
-- No DELETE policy — the row persists; unsubscribed_all = true is the signal.
CREATE TABLE public.email_preferences (
  user_id                  uuid        PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  welcome_enabled          boolean     NOT NULL DEFAULT true,
  defense_nudge_enabled    boolean     NOT NULL DEFAULT true,
  urgency_reminder_enabled boolean     NOT NULL DEFAULT true,
  unsubscribed_all         boolean     NOT NULL DEFAULT false,
  updated_at               timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.email_preferences ENABLE ROW LEVEL SECURITY;

CREATE POLICY "user reads own prefs" ON public.email_preferences
  FOR SELECT TO authenticated
  USING ((select auth.uid()) = user_id);

-- WITH CHECK on UPDATE is required — prevents user_id transfer attack.
CREATE POLICY "user updates own prefs" ON public.email_preferences
  FOR UPDATE TO authenticated
  USING  ((select auth.uid()) = user_id)
  WITH CHECK ((select auth.uid()) = user_id);

CREATE POLICY "user inserts own prefs" ON public.email_preferences
  FOR INSERT TO authenticated
  WITH CHECK ((select auth.uid()) = user_id);
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Paste and run.

- [ ] **Step 3: Verify**

```sql
-- Table exists
SELECT COUNT(*) FROM public.email_preferences;

-- Zero tables without RLS
SELECT tablename FROM pg_tables
WHERE schemaname = 'public' AND rowsecurity = false;

-- 3 policies created
SELECT policyname FROM pg_policies WHERE tablename = 'email_preferences';
```

Expected: `COUNT` = 0, RLS query = 0 rows, policies query = 3 rows.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/2026_06_email_preferences.sql
git commit -m "db: add email_preferences table with per-user RLS and WITH CHECK on UPDATE"
```

---

## Task 4: Database — eligibility RPC function

**Files:**
- Create: `supabase/migrations/2026_06_email_nurture_rpc.sql`

The Edge Function calls this Postgres function instead of joining `auth.users` directly from application code. `SECURITY DEFINER` lets it read `auth.users` as a privileged function.

- [ ] **Step 1: Create the migration file**

Create `supabase/migrations/2026_06_email_nurture_rpc.sql`:

```sql
-- get_eligible_nurture_users: returns users due to receive a given email type.
-- Called by the email-nurture Deno Edge Function via service_role RPC.
-- SECURITY DEFINER: runs as the function owner (postgres), allowing access to auth.users.
CREATE OR REPLACE FUNCTION public.get_eligible_nurture_users(
  p_email_type text,
  p_min_days   integer
)
RETURNS TABLE (
  user_id uuid,
  email   text,
  name    text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    au.id        AS user_id,
    au.email     AS email,
    pu.full_name AS name
  FROM auth.users au
  LEFT JOIN public.users pu ON pu.id = au.id
  WHERE au.email_confirmed_at IS NOT NULL
    AND au.email_confirmed_at <= now() - (p_min_days || ' days')::interval
    AND NOT EXISTS (
      SELECT 1 FROM public.email_log el
      WHERE el.user_id   = au.id
        AND el.email_type = p_email_type
    );
$$;
```

- [ ] **Step 2: Run in SQL Editor and verify**

Paste and run. Then test the function returns correctly shaped rows:

```sql
SELECT * FROM public.get_eligible_nurture_users('welcome', 0) LIMIT 5;
```

Expected: columns `user_id`, `email`, `name` — no SQL error. Will be empty if no verified users exist yet.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/2026_06_email_nurture_rpc.sql
git commit -m "db: add get_eligible_nurture_users() RPC for daily email eligibility queries"
```

---

## Task 5: React Email templates + render helper

**Files:**
- Create: `src/emails/templates/welcome.tsx`
- Create: `src/emails/templates/defense-nudge.tsx`
- Create: `src/emails/templates/urgency-reminder.tsx`
- Create: `src/emails/render.tsx`  ← `.tsx` not `.ts` — calls render() with JSX

- [ ] **Step 1: Create src/emails/templates/welcome.tsx**

```tsx
import {
  Body, Button, Container, Head, Heading, Hr,
  Html, Link, Preview, Section, Text,
} from '@react-email/components'

interface Props { name: string; baseUrl: string }

const main    = { backgroundColor: '#F0F4F8', fontFamily: "'Poppins', Arial, sans-serif" }
const box     = { backgroundColor: '#ffffff', borderRadius: '12px', padding: '40px', maxWidth: '560px', margin: '32px auto' }
const h1      = { fontSize: '22px', fontWeight: '700', color: '#0D1B2A', margin: '0 0 16px' }
const para    = { fontSize: '15px', lineHeight: '1.7', color: '#374151', margin: '0 0 24px' }
const btn     = { backgroundColor: '#16A34A', color: '#ffffff', borderRadius: '8px', padding: '12px 24px', fontSize: '15px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }
const hr      = { borderColor: '#E5E7EB', margin: '24px 0' }
const foot    = { fontSize: '12px', color: '#9CA3AF', lineHeight: '1.6' }

export default function Welcome({ name, baseUrl }: Props) {
  const firstName = name ? name.split(' ')[0] : 'there'
  return (
    <Html lang="en">
      <Head />
      <Preview>Your FYPro journey starts now — validate your topic in 2 minutes</Preview>
      <Body style={main}>
        <Container style={box}>
          <Heading style={h1}>Welcome to FYPro, {firstName}</Heading>
          <Text style={para}>
            You've just joined thousands of Nigerian final year students who are taking their
            project seriously. Your next step is simple — paste your topic idea into our Topic
            Validator and find out if it's defensible before your supervisor ever sees it.
          </Text>
          <Section>
            <Button href={`${baseUrl}/app/topic-validator`} style={btn}>
              Validate your topic now
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={foot}>
            You're receiving this because you signed up for FYPro.<br />
            FYPro · Lagos, Nigeria<br />
            <Link href={`${baseUrl}/account/email-preferences`} style={{ color: '#6B7280' }}>
              Manage email preferences
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 2: Create src/emails/templates/defense-nudge.tsx**

```tsx
import {
  Body, Button, Container, Head, Heading, Hr,
  Html, Link, Preview, Section, Text,
} from '@react-email/components'

interface Props { name: string; baseUrl: string }

const main = { backgroundColor: '#F0F4F8', fontFamily: "'Poppins', Arial, sans-serif" }
const box  = { backgroundColor: '#ffffff', borderRadius: '12px', padding: '40px', maxWidth: '560px', margin: '32px auto' }
const h1   = { fontSize: '22px', fontWeight: '700', color: '#0D1B2A', margin: '0 0 16px' }
const para = { fontSize: '15px', lineHeight: '1.7', color: '#374151', margin: '0 0 24px' }
const btn  = { backgroundColor: '#0066FF', color: '#ffffff', borderRadius: '8px', padding: '12px 24px', fontSize: '15px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }
const hr   = { borderColor: '#E5E7EB', margin: '24px 0' }
const foot = { fontSize: '12px', color: '#9CA3AF', lineHeight: '1.6' }

export default function DefenseNudge({ name, baseUrl }: Props) {
  const firstName = name ? name.split(' ')[0] : 'there'
  return (
    <Html lang="en">
      <Head />
      <Preview>Meet your AI examiners before the real thing — free first session inside</Preview>
      <Body style={main}>
        <Container style={box}>
          <Heading style={h1}>Have you met your examiners yet, {firstName}?</Heading>
          <Text style={para}>
            Most students walk into their defense never having practiced out loud. FYPro's
            Defense Simulator puts you in front of three AI examiners — a methodologist, a
            subject expert, and an external examiner — who push back on your work exactly the
            way the real panel will. Find out where you're weak before it matters.
          </Text>
          <Section>
            <Button href={`${baseUrl}/app/defense`} style={btn}>
              Try a Defense Simulation
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={foot}>
            You're receiving this because you signed up for FYPro.<br />
            FYPro · Lagos, Nigeria<br />
            <Link href={`${baseUrl}/account/email-preferences`} style={{ color: '#6B7280' }}>
              Manage email preferences
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 3: Create src/emails/templates/urgency-reminder.tsx**

```tsx
import {
  Body, Button, Container, Head, Heading, Hr,
  Html, Link, Preview, Section, Text,
} from '@react-email/components'

interface Props { name: string; baseUrl: string }

const main  = { backgroundColor: '#F0F4F8', fontFamily: "'Poppins', Arial, sans-serif" }
const box   = { backgroundColor: '#ffffff', borderRadius: '12px', padding: '40px', maxWidth: '560px', margin: '32px auto' }
const h1    = { fontSize: '22px', fontWeight: '700', color: '#0D1B2A', margin: '0 0 16px' }
const para  = { fontSize: '15px', lineHeight: '1.7', color: '#374151', margin: '0 0 16px' }
const item  = { fontSize: '15px', lineHeight: '1.7', color: '#374151', margin: '0 0 10px', paddingLeft: '8px' }
const btn   = { backgroundColor: '#16A34A', color: '#ffffff', borderRadius: '8px', padding: '12px 24px', fontSize: '15px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }
const hr    = { borderColor: '#E5E7EB', margin: '24px 0' }
const foot  = { fontSize: '12px', color: '#9CA3AF', lineHeight: '1.6' }

export default function UrgencyReminder({ name, baseUrl }: Props) {
  const firstName = name ? name.split(' ')[0] : 'there'
  return (
    <Html lang="en">
      <Head />
      <Preview>Defense checklist — where do you stand right now?</Preview>
      <Body style={main}>
        <Container style={box}>
          <Heading style={h1}>Defense checklist, {firstName} — are you ready?</Heading>
          <Text style={para}>
            A week in and the clock is moving. Run through this before you do anything else:
          </Text>
          <Text style={item}>☐ &nbsp; Topic locked and validated?</Text>
          <Text style={item}>☐ &nbsp; Methodology chosen and defensible?</Text>
          <Text style={item}>☐ &nbsp; Project PDF uploaded for review?</Text>
          <Text style={item}>☐ &nbsp; Defense Simulator score 7 or above?</Text>
          <Text style={{ ...para, marginTop: '16px' }}>
            If any box is unchecked, open your dashboard and work through it.
            Your panel will not go easy on gaps.
          </Text>
          <Section>
            <Button href={`${baseUrl}/dashboard`} style={btn}>
              Open my dashboard
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={foot}>
            You're receiving this because you signed up for FYPro.<br />
            FYPro · Lagos, Nigeria<br />
            <Link href={`${baseUrl}/account/email-preferences`} style={{ color: '#6B7280' }}>
              Manage email preferences
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 4: Create src/emails/render.tsx**

This file is `.tsx` because `render()` takes a JSX element as its argument.

```tsx
import { render } from '@react-email/render'
import Welcome from './templates/welcome'
import DefenseNudge from './templates/defense-nudge'
import UrgencyReminder from './templates/urgency-reminder'

export type EmailType = 'welcome' | 'defense_nudge' | 'urgency_reminder'

export interface EmailProps {
  name: string
  baseUrl: string
}

export async function renderTemplate(type: EmailType, props: EmailProps): Promise<string> {
  switch (type) {
    case 'welcome':
      return await render(<Welcome {...props} />)
    case 'defense_nudge':
      return await render(<DefenseNudge {...props} />)
    case 'urgency_reminder':
      return await render(<UrgencyReminder {...props} />)
    default:
      throw new Error(`Unknown email type: ${type}`)
  }
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run build
```

Expected: build completes without TypeScript errors in `src/emails/`.

- [ ] **Step 6: Commit**

```bash
git add src/emails/
git commit -m "feat(email): add three React Email templates and renderTemplate() helper"
```

---

## Task 6: Vercel send-nurture-email function

**Files:**
- Create: `api/send-nurture-email.ts`

This function is the only place that touches Resend and writes to `email_log`. It:
1. Rejects requests without the correct `CRON_SECRET`
2. Renders the template to HTML
3. Sends via Resend with `List-Unsubscribe` headers
4. Inserts an `email_log` row — catching unique violations (already sent) as a success, not an error
5. Logs metadata only — never email addresses or HTML body

- [ ] **Step 1: Create api/send-nurture-email.ts**

```typescript
import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { renderTemplate, EmailType } from '../src/emails/render'

const BASE_URL        = 'https://www.fypro.com.ng'
const FROM            = 'FYPro <hello@fypro.com.ng>'
const LIST_UNSUB      = '<mailto:unsubscribe@fypro.com.ng>, <https://fypro.com.ng/account/email-preferences>'

const SUBJECTS: Record<EmailType, string> = {
  welcome:          'Welcome to FYPro — validate your topic now',
  defense_nudge:    'Have you met your AI examiners yet?',
  urgency_reminder: 'Defense checklist — where do you stand?',
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = (req.headers['authorization'] as string) ?? ''
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { userId, emailType, email, name } = req.body as {
    userId:    string
    emailType: EmailType
    email:     string
    name:      string
  }

  if (!userId || !emailType || !email) {
    return res.status(400).json({ error: 'Missing required fields: userId, emailType, email' })
  }

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const resend = new Resend(process.env.RESEND_API_KEY)

  let resendId: string | null = null
  let status: 'sent' | 'failed' = 'sent'

  try {
    const html = await renderTemplate(emailType, { name: name ?? '', baseUrl: BASE_URL })

    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: SUBJECTS[emailType],
      html,
      headers: { 'List-Unsubscribe': LIST_UNSUB },
    })

    if (error) throw new Error(error.message)
    resendId = data?.id ?? null
  } catch (err) {
    status = 'failed'
    // Log metadata only — no email address, no HTML body
    console.error('[send-nurture-email] Resend failed', {
      userId,
      emailType,
      message: (err as Error).message,
    })
  }

  try {
    await supabase.from('email_log').insert({
      user_id:    userId,
      email_type: emailType,
      resend_id:  resendId,
      status,
    })
  } catch (dbErr: any) {
    // 23505 = unique_violation: this user already received this email type
    if (dbErr?.code === '23505') {
      return res.status(200).json({ ok: true, alreadySent: true })
    }
    // Log but don't crash the response — send may have succeeded
    console.error('[send-nurture-email] email_log insert failed', { userId, emailType })
  }

  return res.status(200).json({ ok: status === 'sent', resendId, alreadySent: false })
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: no TypeScript errors in `api/`.

- [ ] **Step 3: Commit**

```bash
git add api/send-nurture-email.ts
git commit -m "feat(api): add /api/send-nurture-email Vercel function (render + Resend + email_log)"
```

---

## Task 7: Supabase Edge Function

**Files:**
- Create: `supabase/functions/email-nurture/index.ts`

This Deno function is the daily cron entrypoint. It calls the Postgres RPC to get eligible users, checks preferences in `email_preferences`, and POSTs to the Vercel function for each candidate. It never throws — all errors are logged and skipped.

- [ ] **Step 1: Create supabase/functions/email-nurture/index.ts**

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VERCEL_SEND_URL = 'https://www.fypro.com.ng/api/send-nurture-email'
const CRON_SECRET     = Deno.env.get('CRON_SECRET') ?? ''
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

type EmailType = 'welcome' | 'defense_nudge' | 'urgency_reminder'

interface EligibleUser {
  user_id: string
  email:   string
  name:    string | null
}

const DAY_THRESHOLDS: Record<EmailType, number> = {
  welcome:          0,
  defense_nudge:    3,
  urgency_reminder: 7,
}

async function getEligibleUsers(emailType: EmailType): Promise<EligibleUser[]> {
  const { data, error } = await supabase.rpc('get_eligible_nurture_users', {
    p_email_type: emailType,
    p_min_days:   DAY_THRESHOLDS[emailType],
  })

  if (error) {
    console.error(`[email-nurture] eligibility query failed for ${emailType}:`, error.message)
    return []
  }
  return (data ?? []) as EligibleUser[]
}

async function isSubscribed(userId: string, emailType: EmailType): Promise<boolean> {
  const { data } = await supabase
    .from('email_preferences')
    .select('unsubscribed_all, welcome_enabled, defense_nudge_enabled, urgency_reminder_enabled')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return true // no row = default subscribed (all enabled)
  if (data.unsubscribed_all) return false

  const toggle: Record<EmailType, boolean> = {
    welcome:          data.welcome_enabled,
    defense_nudge:    data.defense_nudge_enabled,
    urgency_reminder: data.urgency_reminder_enabled,
  }
  return toggle[emailType] !== false
}

async function sendEmail(user: EligibleUser, emailType: EmailType): Promise<void> {
  try {
    const res = await fetch(VERCEL_SEND_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({
        userId:    user.user_id,
        emailType,
        email:     user.email,
        name:      user.name ?? '',
      }),
    })
    if (!res.ok) {
      // Log metadata only — not the email address
      console.error(`[email-nurture] Vercel function returned ${res.status}`, {
        userId:    user.user_id,
        emailType,
      })
    }
  } catch (err) {
    console.error(`[email-nurture] fetch to Vercel failed`, {
      userId:    user.user_id,
      emailType,
      message:   (err as Error).message,
    })
  }
}

Deno.serve(async () => {
  const emailTypes: EmailType[] = ['welcome', 'defense_nudge', 'urgency_reminder']

  for (const emailType of emailTypes) {
    const users = await getEligibleUsers(emailType)
    console.log(`[email-nurture] ${emailType}: ${users.length} eligible`)

    for (const user of users) {
      const subscribed = await isSubscribed(user.user_id, emailType)
      if (!subscribed) continue
      await sendEmail(user, emailType)
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
```

- [ ] **Step 2: Commit**

```bash
git add supabase/functions/email-nurture/index.ts
git commit -m "feat(edge): add email-nurture Deno Edge Function (daily eligibility + POST Vercel)"
```

---

## Task 8: supabase/config.toml

**Files:**
- Create: `supabase/config.toml`

`config.toml` is used by the Supabase CLI for local development and for `supabase functions deploy`. The production cron schedule is set separately in the Supabase dashboard (see Step 2 below).

- [ ] **Step 1: Create supabase/config.toml**

```toml
# Supabase local development configuration
# Docs: https://supabase.com/docs/guides/cli/config

[api]
enabled = true
port = 54321
schemas = ["public", "graphql_public"]
extra_search_path = ["public", "extensions"]
max_rows = 1000

[db]
port = 54322
shadow_port = 54320
major_version = 15

[studio]
enabled = true
port = 54323

[inbucket]
enabled = true
port = 54324

[storage]
enabled = true

[auth]
enabled = true
site_url = "http://localhost:5173"
additional_redirect_urls = ["https://www.fypro.com.ng"]
jwt_expiry = 3600
enable_confirmations = true

[auth.email]
enable_signup = true
double_confirm_changes = true
enable_confirmations = true

# Declare the function so `supabase functions deploy email-nurture` works from CLI.
# The cron schedule is set in the Supabase dashboard (see Step 2).
[functions.email-nurture]
verify_jwt = false
```

- [ ] **Step 2: Register the cron in Supabase dashboard**

In the Supabase dashboard for your project:

1. Go to **Database → Extensions** → enable `pg_cron` if not already enabled.
2. Go to **Database → Cron Jobs → New Cron Job**.
3. Set schedule: `0 9 * * *` (9am UTC daily = 10am Lagos WAT).
4. Set the HTTP call:
   - URL: `https://<your-project-ref>.supabase.co/functions/v1/email-nurture`
   - Method: `POST`
   - Headers: `{"Authorization": "Bearer <your-supabase-anon-key>"}`

Or via SQL (run in SQL Editor after enabling pg_cron):

```sql
SELECT cron.schedule(
  'email-nurture-daily',
  '0 9 * * *',
  $$
    SELECT net.http_post(
      url     := 'https://<your-project-ref>.supabase.co/functions/v1/email-nurture',
      headers := '{"Authorization": "Bearer <anon-key>", "Content-Type": "application/json"}'::jsonb,
      body    := '{}'::jsonb
    )
  $$
);
```

Replace `<your-project-ref>` and `<anon-key>` with your actual values from the Supabase dashboard → Settings → API.

- [ ] **Step 3: Deploy the Edge Function**

```bash
supabase functions deploy email-nurture --project-ref <your-project-ref>
```

- [ ] **Step 4: Set Edge Function secrets in Supabase dashboard**

Go to **Edge Functions → email-nurture → Secrets** and add:
- `CRON_SECRET` — same value as in Vercel env vars
- `SUPABASE_SERVICE_ROLE_KEY` — from Supabase dashboard → Settings → API → service_role key

- [ ] **Step 5: Commit**

```bash
git add supabase/config.toml
git commit -m "feat(supabase): add config.toml with email-nurture function declaration"
```

---

## Task 9: EmailPreferences page

**Files:**
- Create: `src/pages/account/EmailPreferences.jsx`

Matches the visual pattern of `src/pages/Settings.jsx`: same dark navbar, card style, `ToggleRow`/`ToggleSwitch` components. Reads and writes `email_preferences` via the authenticated Supabase client (RLS handles isolation). Upserts on first visit (INSERT if no row, UPDATE thereafter). Optimistic UI with revert on error.

- [ ] **Step 1: Create src/pages/account/EmailPreferences.jsx**

```jsx
import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { showToast } from '../../components/Toast'

// ─── ToggleSwitch ─────────────────────────────────────────────────────────────

function ToggleSwitch({ checked, onChange, disabled = false, ariaLabel }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      onClick={disabled ? undefined : onChange}
      disabled={disabled}
      className={`relative w-11 h-6 rounded-full transition-colors duration-200 flex-shrink-0 border-0 p-0 outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${checked && !disabled ? 'bg-blue-600' : 'bg-slate-700'}`}
    >
      <span
        className={`absolute top-[3px] w-[18px] h-[18px] rounded-full bg-white shadow-sm transition-transform duration-200 ${
          checked ? 'translate-x-[22px]' : 'translate-x-[3px]'
        }`}
      />
    </button>
  )
}

function ToggleRow({ title, desc, checked, onChange, disabled = false }) {
  return (
    <div className={`flex items-center justify-between gap-4 ${disabled ? 'opacity-50' : ''}`}>
      <div className="flex-1 min-w-0">
        <div className="font-sans text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
          {title}
        </div>
        <div className="font-sans text-xs mt-0.5 leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {desc}
        </div>
      </div>
      <ToggleSwitch checked={checked} onChange={onChange} disabled={disabled} ariaLabel={title} />
    </div>
  )
}

// ─── Navbar ───────────────────────────────────────────────────────────────────

function Navbar() {
  return (
    <header
      className="h-[68px] flex items-center justify-between px-8 sticky top-0 z-30 flex-shrink-0"
      style={{ background: 'var(--bg-sidebar)', borderBottom: '1px solid var(--border-subtle)' }}
    >
      <Link to="/dashboard" className="flex items-center gap-2.5 no-underline">
        <img src="/fypro-logo.png" alt="FYPro" className="h-9 w-auto" />
      </Link>
      <Link
        to="/settings"
        className="font-sans text-sm no-underline transition-opacity hover:opacity-80"
        style={{ color: 'var(--text-muted)' }}
      >
        ← Back to Settings
      </Link>
    </header>
  )
}

// ─── EmailPreferences ─────────────────────────────────────────────────────────

const DEFAULTS = {
  welcome_enabled:          true,
  defense_nudge_enabled:    true,
  urgency_reminder_enabled: true,
  unsubscribed_all:         false,
}

const cardStyle = {
  background:   'var(--bg-card)',
  borderRadius: '1rem',
  border:       '1px solid var(--border-color)',
  boxShadow:    'var(--card-shadow)',
}

export default function EmailPreferences() {
  const [prefs,   setPrefs]   = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [hasRow,  setHasRow]  = useState(false)

  useEffect(() => {
    async function load() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const { data } = await supabase
        .from('email_preferences')
        .select('welcome_enabled, defense_nudge_enabled, urgency_reminder_enabled, unsubscribed_all')
        .eq('user_id', user.id)
        .maybeSingle()

      if (data) {
        setPrefs({
          welcome_enabled:          data.welcome_enabled,
          defense_nudge_enabled:    data.defense_nudge_enabled,
          urgency_reminder_enabled: data.urgency_reminder_enabled,
          unsubscribed_all:         data.unsubscribed_all,
        })
        setHasRow(true)
      }
      setLoading(false)
    }
    load()
  }, [])

  async function persist(updated) {
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = { ...updated, updated_at: new Date().toISOString() }

    let error
    if (hasRow) {
      ;({ error } = await supabase
        .from('email_preferences')
        .update(payload)
        .eq('user_id', user.id))
    } else {
      ;({ error } = await supabase
        .from('email_preferences')
        .insert({ user_id: user.id, ...payload }))
      if (!error) setHasRow(true)
    }

    if (error) {
      showToast('Failed to save. Please try again.', 'error')
      setPrefs(prefs) // revert optimistic update
    } else {
      showToast('Preferences saved')
    }
    setSaving(false)
  }

  function toggle(field) {
    const updated = { ...prefs, [field]: !prefs[field] }
    setPrefs(updated)   // optimistic
    persist(updated)
  }

  const isUnsubscribed = prefs.unsubscribed_all

  return (
    <div
      className="min-h-screen"
      style={{
        background:          'var(--bg-base)',
        backgroundImage:     'var(--dot-bg-image)',
        backgroundSize:      '28px 28px',
      }}
    >
      <Navbar />

      <div className="max-w-2xl mx-auto px-6 py-12">

        <motion.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        >
          <h1 className="font-serif text-3xl leading-none" style={{ color: 'var(--text-primary)' }}>
            Email Preferences
          </h1>
          <p className="font-sans text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
            Control which emails FYPro sends you.
          </p>
        </motion.div>

        {loading ? (
          <div className="mt-16 flex justify-center">
            <div className="w-6 h-6 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
          </div>
        ) : (
          <>
            {/* Per-type toggles */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="mt-8 p-8"
              style={cardStyle}
            >
              <div
                className="font-mono text-xs font-semibold uppercase tracking-wider mb-6"
                style={{ color: 'var(--text-muted)' }}
              >
                Email Types
              </div>

              <div className="flex flex-col gap-5">
                <ToggleRow
                  title="Welcome email"
                  desc="Sent immediately after you verify your email — directs you to validate your topic"
                  checked={prefs.welcome_enabled && !isUnsubscribed}
                  onChange={() => toggle('welcome_enabled')}
                  disabled={isUnsubscribed}
                />
                <div className="border-t" style={{ borderColor: 'var(--border-color)' }} />
                <ToggleRow
                  title="Defense Simulator nudge"
                  desc="Sent 3 days after signup — introduces the three-examiner Defense Simulator"
                  checked={prefs.defense_nudge_enabled && !isUnsubscribed}
                  onChange={() => toggle('defense_nudge_enabled')}
                  disabled={isUnsubscribed}
                />
                <div className="border-t" style={{ borderColor: 'var(--border-color)' }} />
                <ToggleRow
                  title="Urgency reminder"
                  desc="Sent 7 days after signup — defense checklist and dashboard link"
                  checked={prefs.urgency_reminder_enabled && !isUnsubscribed}
                  onChange={() => toggle('urgency_reminder_enabled')}
                  disabled={isUnsubscribed}
                />
              </div>
            </motion.div>

            {/* Master unsubscribe */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.16, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
              className="mt-6 p-8"
              style={{
                ...cardStyle,
                border: isUnsubscribed
                  ? '1px solid rgba(239,68,68,0.3)'
                  : '1px solid var(--border-color)',
              }}
            >
              <div
                className="font-mono text-xs font-semibold uppercase tracking-wider mb-6"
                style={{ color: 'var(--text-muted)' }}
              >
                Global Opt-Out
              </div>
              <ToggleRow
                title="Unsubscribe from all FYPro emails"
                desc="Turns off every email type above. You can re-enable individual emails at any time."
                checked={prefs.unsubscribed_all}
                onChange={() => toggle('unsubscribed_all')}
              />
            </motion.div>

            {saving && (
              <div className="mt-4 flex items-center gap-2 justify-center">
                <div className="w-4 h-4 rounded-full border-2 border-blue-500 border-t-transparent animate-spin" />
                <span className="font-sans text-xs" style={{ color: 'var(--text-muted)' }}>
                  Saving…
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: no errors in `src/pages/account/`.

- [ ] **Step 3: Commit**

```bash
git add src/pages/account/EmailPreferences.jsx
git commit -m "feat(ui): add EmailPreferences page with per-type toggles and master unsubscribe"
```

---

## Task 10: Footer component

**Files:**
- Create: `src/components/Footer.jsx`

Shows Privacy, Terms, and (for logged-in users only) an "Email preferences" link. Auth state is derived from Supabase's session, not from the app's local state, so it works on public pages too.

- [ ] **Step 1: Create src/components/Footer.jsx**

```jsx
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'

export default function Footer() {
  const [authed, setAuthed] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setAuthed(!!session)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session)
    })
    return () => subscription.unsubscribe()
  }, [])

  return (
    <footer
      className="py-8 px-6 border-t"
      style={{ borderColor: 'var(--border-subtle)', background: 'var(--bg-sidebar)' }}
    >
      <div className="max-w-4xl mx-auto flex flex-wrap items-center justify-between gap-4">
        <span className="font-mono text-xs" style={{ color: 'var(--text-muted)' }}>
          FYPro · Lagos, Nigeria
        </span>

        <nav className="flex flex-wrap items-center gap-4">
          <Link
            to="/privacy"
            className="font-sans text-xs no-underline hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            Privacy
          </Link>
          <Link
            to="/terms"
            className="font-sans text-xs no-underline hover:opacity-80 transition-opacity"
            style={{ color: 'var(--text-muted)' }}
          >
            Terms
          </Link>
          {authed && (
            <Link
              to="/account/email-preferences"
              className="font-sans text-xs no-underline hover:opacity-80 transition-opacity"
              style={{ color: 'var(--text-muted)' }}
            >
              Email preferences
            </Link>
          )}
        </nav>
      </div>
    </footer>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 3: Commit**

```bash
git add src/components/Footer.jsx
git commit -m "feat(ui): add Footer component with conditional email preferences link"
```

---

## Task 11: Wire routes, Footer into App.jsx and pages

**Files:**
- Modify: `src/App.jsx`
- Modify: `src/pages/LandingPage.jsx`
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 1: Add route to src/App.jsx**

At the top of `src/App.jsx`, add the import alongside the other page imports:

```jsx
import EmailPreferences from './pages/account/EmailPreferences'
```

Inside `<Routes>`, after the existing `/settings` route line, add:

```jsx
<Route path="/account/email-preferences" element={<ProtectedRoute><EmailPreferences /></ProtectedRoute>} />
```

- [ ] **Step 2: Add Footer to src/pages/LandingPage.jsx**

Add this import at the top of `LandingPage.jsx` (with the other imports):

```jsx
import Footer from '../components/Footer'
```

Find the very last closing tag of the page's root `return` block and add `<Footer />` immediately before it. For example, if the root ends with `</div>`, the change looks like:

```jsx
      {/* existing last section */}
      <Footer />
    </div>   {/* ← root closing tag, unchanged */}
  )
}
```

- [ ] **Step 3: Add Footer to src/pages/Dashboard.jsx**

Add this import at the top of `Dashboard.jsx`:

```jsx
import Footer from '../components/Footer'
```

Find the very last closing tag of the page's root `return` block and add `<Footer />` immediately before it (same pattern as Step 2).

- [ ] **Step 4: Verify build and route**

```bash
npm run build
```

Expected: clean build with no import resolution errors.

```bash
npm run dev
```

Open `http://localhost:5173/account/email-preferences` while logged out → should redirect to `/login` (ProtectedRoute working). Log in, then navigate to `/account/email-preferences` → Email Preferences page renders with three toggles and a Global Opt-Out card.

Check that the Footer visible on `http://localhost:5173/` shows "Email preferences" when logged in, hides it when logged out.

- [ ] **Step 5: Commit**

```bash
git add src/App.jsx src/pages/LandingPage.jsx src/pages/Dashboard.jsx
git commit -m "feat: wire /account/email-preferences route and Footer into landing + dashboard"
```

---

## Post-Implementation Checklist

Before calling this done, complete these environment and deployment steps:

- [ ] Generate `CRON_SECRET`: run `openssl rand -hex 32` and save the output
- [ ] Add `CRON_SECRET` to **Vercel** → Project → Settings → Environment Variables
- [ ] Add `CRON_SECRET` to **Supabase** dashboard → Edge Functions → email-nurture → Secrets
- [ ] Confirm `RESEND_API_KEY` exists in Vercel env vars
- [ ] Add `RESEND_API_KEY` to Supabase Edge Function secrets (used only if you call Resend directly from Deno — not needed in the current Edge → Vercel design, but good hygiene)
- [ ] Set up the cron schedule in Supabase dashboard (see Task 8 Step 2)
- [ ] Deploy the Edge Function: `supabase functions deploy email-nurture --project-ref <ref>`
- [ ] Run final RLS check in SQL Editor: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;` → must return 0 rows

---

## Verification Sequence

Run these in order after everything is deployed:

1. **Welcome email** — sign up with a fresh test email, verify it. Manually invoke the Edge Function (curl or Supabase dashboard → Edge Functions → Invoke). Confirm welcome email arrives in inbox.

2. **Defense nudge (no re-send)** — in Supabase SQL Editor as service_role: `UPDATE auth.users SET email_confirmed_at = now() - interval '4 days' WHERE email = '<test>';` Invoke Edge Function. Defense nudge arrives. Welcome does NOT resend (already in `email_log`).

3. **Unsubscribe** — log in as test user, visit `/account/email-preferences`, toggle "Unsubscribe from all". Invoke Edge Function. No emails sent.

4. **Idempotency** — invoke Edge Function twice in quick succession. Only one email per type per user. Second run: unique constraint catches the duplicate; `email_log` is not double-inserted.
