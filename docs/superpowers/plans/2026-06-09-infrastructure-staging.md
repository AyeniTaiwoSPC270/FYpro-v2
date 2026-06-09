# Infrastructure: Staging Environment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire up a permanent `staging` branch, Vercel staging project, and two small code changes so FYPro has a safe pre-production environment using Paystack test keys and a throwaway Supabase database.

**Architecture:** A `staging` git branch deploys automatically to a separate Vercel project (`fypro-v2-staging.vercel.app`) with staging-specific env vars. Two code changes land in `main` before the branch is cut: a Sentry environment tag fix and a visible staging banner. Vercel and Supabase setup is manual (dashboard clicks), documented here as a step-by-step checklist.

**Tech Stack:** React (Vite), Vercel, Supabase, Paystack test keys. No new npm packages.

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/sentry.ts` | Replace `import.meta.env.MODE` with `import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE` as the Sentry environment |
| `src/App.jsx` | Add staging banner — a fixed top bar visible only when `VITE_APP_ENV === 'staging'` |
| `.env.example` | Add `VITE_APP_ENV=` entry |

---

## Task 1: Fix Sentry environment tag

**Context:** `sentry.ts` currently uses `import.meta.env.MODE` as the Sentry environment. Vite sets `MODE` to `"production"` for ALL production builds — including staging. So staging errors would appear as "production" in Sentry, mixing with real user errors. We want staging errors tagged as "staging".

**Fix:** Use `VITE_APP_ENV` if set, fall back to `MODE` otherwise. The staging Vercel project will have `VITE_APP_ENV=staging`. Production will have no `VITE_APP_ENV`, so it falls back to `"production"`.

**Files:**
- Modify: `src/lib/sentry.ts`

- [ ] **Step 1: Open `src/lib/sentry.ts`**

Current content (line 5):
```ts
  environment: import.meta.env.MODE,
```

- [ ] **Step 2: Replace line 5**

Change it to:
```ts
  environment: import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE,
```

Full file after change:
```ts
import * as Sentry from "@sentry/react";

Sentry.init({
  dsn: import.meta.env.VITE_SENTRY_DSN,
  environment: import.meta.env.VITE_APP_ENV ?? import.meta.env.MODE,
  enabled: import.meta.env.PROD,
  tracesSampleRate: 0.2,
  beforeSend(event) {
    if (event.user) {
      delete event.user.ip_address;
      delete event.user.email;
      delete event.user.username;
    }
    return event;
  },
});

export default Sentry;

export function setTraceId(id: string): void {
  Sentry.setTag('trace_id', id);
}
```

- [ ] **Step 3: Run build to verify no TypeScript errors**

```
npm run build
```

Expected: build completes with no errors (chunk size warnings are fine).

- [ ] **Step 4: Commit**

```
git add src/lib/sentry.ts
git commit -m "fix(sentry): use VITE_APP_ENV for environment tag, falling back to MODE"
```

---

## Task 2: Add staging banner to App.jsx

**Context:** When you open `fypro-v2-staging.vercel.app`, there is currently nothing telling you it's staging. It looks identical to production. This means it's easy to accidentally test something on production thinking it's staging, or vice versa. A persistent banner fixes this.

**The banner:** A fixed strip at the very top of every page, amber background, only renders when `VITE_APP_ENV === 'staging'`. In production `VITE_APP_ENV` is not set so the banner is invisible — zero impact on production users.

**Files:**
- Modify: `src/App.jsx` (lines 106–126, the `App` default export)

- [ ] **Step 1: Add the banner inside the `App` component**

Current `App` export (lines 106–126):
```jsx
export default function App() {
  return (
    <AuthProvider>
    <ThemeProvider>
    <AppProvider>
      <BrowserRouter>
        <ProjectStateProvider>
        <RouteProgressBar />
        <ToastProvider />
        <CookieBanner />
        <PWAInstallPrompt />
        <Suspense fallback={null}>
          <AppRoutes />
        </Suspense>
        </ProjectStateProvider>
      </BrowserRouter>
    </AppProvider>
    </ThemeProvider>
    </AuthProvider>
  )
}
```

Replace with:
```jsx
export default function App() {
  return (
    <AuthProvider>
    <ThemeProvider>
    <AppProvider>
      <BrowserRouter>
        <ProjectStateProvider>
        {import.meta.env.VITE_APP_ENV === 'staging' && (
          <div style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            background: '#F59E0B', color: '#000', textAlign: 'center',
            padding: '4px 0', fontSize: '12px', fontWeight: 600,
            fontFamily: 'monospace', letterSpacing: '0.03em',
          }}>
            ⚠ STAGING — Paystack test mode · throwaway database
          </div>
        )}
        <RouteProgressBar />
        <ToastProvider />
        <CookieBanner />
        <PWAInstallPrompt />
        <Suspense fallback={null}>
          <AppRoutes />
        </Suspense>
        </ProjectStateProvider>
      </BrowserRouter>
    </AppProvider>
    </ThemeProvider>
    </AuthProvider>
  )
}
```

- [ ] **Step 2: Run build to verify no errors**

```
npm run build
```

Expected: build completes cleanly.

- [ ] **Step 3: Run tests**

```
npm test
```

Expected: 85 passed.

- [ ] **Step 4: Commit**

```
git add src/App.jsx
git commit -m "feat(staging): add visible staging environment banner"
```

---

## Task 3: Update .env.example

**Context:** `.env.example` documents every variable the project uses. `VITE_APP_ENV` is new — it must be listed so future contributors know it exists and what it's for.

**Files:**
- Modify: `.env.example`

- [ ] **Step 1: Add `VITE_APP_ENV` to `.env.example`**

Add these lines at the end of the file (after the last `VITE_VAPID_PUBLIC_KEY=` line):

```
# App environment — set to "staging" in the Vercel staging project only.
# Leave unset in production. Controls the Sentry environment tag and the staging banner.
VITE_APP_ENV=
```

- [ ] **Step 2: Commit**

```
git add .env.example
git commit -m "docs(env): add VITE_APP_ENV variable"
```

---

## Task 4: Create the staging git branch and push

**Context:** The staging Vercel project (set up in Task 5) watches the `staging` branch. This branch must exist on GitHub before Vercel can link to it.

- [ ] **Step 1: Create the branch from current main**

```
git checkout -b staging
```

- [ ] **Step 2: Push to GitHub**

```
git push -u origin staging
```

Expected output: `Branch 'staging' set up to track remote branch 'staging' from 'origin'.`

- [ ] **Step 3: Return to main**

```
git checkout main
```

- [ ] **Step 4: Push main (includes Tasks 1–3 commits)**

```
git push origin main
```

---

## Task 5: Create Vercel staging project (manual — Vercel dashboard)

**Context:** This is a new Vercel project that is completely separate from the production project. It points to the same GitHub repo but deploys from the `staging` branch. It gets its own domain (`fypro-v2-staging.vercel.app`) and its own env vars.

**This task has no code changes.** Follow the steps exactly.

- [ ] **Step 1: Open Vercel dashboard**

Go to https://vercel.com/dashboard → click **Add New → Project**.

- [ ] **Step 2: Import the GitHub repo**

Select `AyeniTaiwoSPC270/FYpro-v2`. If it doesn't appear, click **Adjust GitHub App Permissions** and grant access.

- [ ] **Step 3: Configure the project**

Before clicking Deploy:
- **Project Name:** `fypro-v2-staging`
- **Framework Preset:** Vite (Vercel should auto-detect)
- Click **Edit** next to the branch selector → change from `main` to `staging`

- [ ] **Step 4: Add environment variables**

Click **Environment Variables** and add every variable from the production Vercel project, but override these 6:

| Variable | Staging value |
|---|---|
| `VITE_SUPABASE_URL` | URL from your staging Supabase project (Settings → API) |
| `VITE_SUPABASE_ANON_KEY` | Anon key from staging Supabase project |
| `SUPABASE_URL` | Same as `VITE_SUPABASE_URL` staging value |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key from staging Supabase project |
| `VITE_PAYSTACK_PUBLIC_KEY` | `pk_test_...` from your Paystack dashboard |
| `PAYSTACK_PUBLIC_KEY` | Same `pk_test_...` value |
| `PAYSTACK_SECRET_KEY` | `sk_test_...` from your Paystack dashboard |
| `DAILY_CAP_USD` | `2` |
| `VITE_APP_ENV` | `staging` |

Everything else (Anthropic, ElevenLabs, Upstash, Resend, Telegram, PostHog, Sentry, CRON_SECRET, etc.) uses the same keys as production.

- [ ] **Step 5: Click Deploy**

Vercel will build from the `staging` branch. Wait for the build to complete (≈2 minutes).

Expected: green checkmark, URL shown as `https://fypro-v2-staging.vercel.app`.

- [ ] **Step 6: Verify the staging banner appears**

Open `https://fypro-v2-staging.vercel.app` in your browser.

Expected: amber banner at the top reading `⚠ STAGING — Paystack test mode · throwaway database`.

If the banner is missing, check that `VITE_APP_ENV=staging` was saved in the Vercel env vars and trigger a redeploy.

---

## Task 6: Configure Supabase auth redirect URLs (manual — Supabase dashboard)

**Context:** Supabase sends auth emails (email confirmation, password reset) with a redirect URL. If the staging URL isn't whitelisted, clicking the link in an email gives a "redirect URI not allowed" error and login breaks entirely.

- [ ] **Step 1: Open staging Supabase project**

Go to https://supabase.com/dashboard → select your **staging** project.

- [ ] **Step 2: Set the Site URL**

Authentication → URL Configuration → **Site URL**

Set to: `https://fypro-v2-staging.vercel.app`

- [ ] **Step 3: Add redirect URL**

Authentication → URL Configuration → **Redirect URLs** → click **Add URL**

Add: `https://fypro-v2-staging.vercel.app/**`

The `/**` wildcard covers `/auth/confirm`, `/auth/callback`, `/reset-password`, and any future auth routes.

- [ ] **Step 4: Save**

Click Save on both fields.

---

## Task 7: Smoke test the staging environment

**Context:** Verify the full flow works end-to-end on staging before trusting it for future testing.

- [ ] **Step 1: Test signup**

Go to `https://fypro-v2-staging.vercel.app/signup`.
Create a new account with a real email address.
Check your inbox for the confirmation email.
Click the confirmation link — it should redirect to `fypro-v2-staging.vercel.app`, not `fypro.com.ng`.

Expected: you land on the dashboard at `fypro-v2-staging.vercel.app/dashboard`.

- [ ] **Step 2: Test a payment flow**

From the staging app, trigger a payment (e.g. Student Pack).
When the Paystack popup opens, use the test card:
- Card number: `4084 0840 8408 4081`
- Expiry: any future date (e.g. `12/30`)
- CVV: `408`
- PIN: `0000`
- OTP: `123456`

Expected: payment completes, entitlement is granted, no real ₦ charged.

- [ ] **Step 3: Verify the staging banner is visible throughout**

Navigate to a few pages — landing, dashboard, /app, /pricing.
Expected: amber banner is visible on every page.

- [ ] **Step 4: Confirm production is unaffected**

Open `https://www.fypro.com.ng` in a separate tab.
Expected: no staging banner visible.

---

## Done

After Task 7 passes, the staging workflow is live:

```
Write code → merge to staging branch → test at fypro-v2-staging.vercel.app → merge to main → goes live
```
