# Infrastructure: Staging Environment Design
**Date:** 2026-06-09
**Status:** Approved

---

## Problem

Every code change currently deploys straight to `fypro.com.ng` — where real students are using the app, real ₦ moves through Paystack, and real data lives in the database. There is no safe place to test a feature before it reaches users, test a payment flow without charging a real card, or run a database migration before touching production data.

---

## Design

### Git workflow

Two permanent branches:

- `main` → deploys to `fypro.com.ng` (production)
- `staging` → deploys to `fypro-v2-staging.vercel.app` (staging)

Day-to-day flow:
1. Write code on a feature branch
2. Merge feature branch into `staging`
3. Test on staging
4. When confirmed working, merge feature branch into `main`

Staging is a testing ground. Feature branches merge into `main` directly after staging validation — `staging` never merges into `main`.

---

### External services

| Variable | Production | Staging |
|---|---|---|
| Supabase URL + keys | Production project (`ayvunikgfwpylfrkpalj`) | Staging project (separate, already created + schema applied) |
| `VITE_PAYSTACK_PUBLIC_KEY` | `pk_live_...` | `pk_test_...` |
| `PAYSTACK_PUBLIC_KEY` | `pk_live_...` | `pk_test_...` |
| `PAYSTACK_SECRET_KEY` | `sk_live_...` | `sk_test_...` |
| `DAILY_CAP_USD` | 10 | 2 |
| `VITE_APP_ENV` | `production` | `staging` |

All other services (Anthropic, ElevenLabs, Upstash Redis, Resend, Telegram, PostHog, Sentry) use the same API keys in both environments. No separate accounts needed.

---

### Vercel setup (manual — Vercel dashboard)

Create a new Vercel project `fypro-v2-staging`:
- Connect to `AyeniTaiwoSPC270/FYpro-v2` repo
- Set production branch to `staging`
- Add all env vars from production, overriding the 6 staging-specific vars above
- Domain will be `fypro-v2-staging.vercel.app` (Vercel auto-assigns)

---

### Supabase auth redirect URL (manual — Supabase dashboard)

In the staging Supabase project → Authentication → URL Configuration:
- Add `https://fypro-v2-staging.vercel.app` to **Redirect URLs**
- Set Site URL to `https://fypro-v2-staging.vercel.app`

Without this, auth email links (confirmation, password reset) redirect to the wrong URL and login breaks.

---

### Code changes

**1. `src/lib/sentry.ts` — add environment tag**

Add `environment: import.meta.env.VITE_APP_ENV ?? 'production'` to the Sentry `init()` call. Staging errors then appear under "staging" in Sentry, separate from production errors.

**2. `App.jsx` — staging banner**

When `import.meta.env.VITE_APP_ENV === 'staging'`, render a fixed banner at the top of the page:

```
⚠ STAGING — Paystack test mode · throwaway database
```

This prevents accidentally testing on production and confusing staging behaviour for a bug.

**3. `staging` git branch**

Create `staging` branch from current `main`. This is the branch the staging Vercel project watches.

---

### What is NOT changing

- No code changes to any API endpoint
- No new npm packages
- No changes to `vercel.json`
- No separate Upstash Redis instance (rate limiting on staging uses the same Redis; low traffic means no interference with production limits)
- No separate ElevenLabs or Resend accounts
- Staging Telegram alerts go to the same bot (volume is low enough to not matter)

---

## Files changed

| File | Change |
|------|--------|
| `src/lib/sentry.ts` | Add `environment` field to `Sentry.init()` |
| `src/App.jsx` | Add staging banner conditional |
| `scripts/staging-schema.sql` | Already created — one-time use, not deployed |
| `.env.example` | Add `VITE_APP_ENV=` entry with comment |

---

## Out of scope

- Automated data sync from production to staging
- CI gate requiring staging to pass before merging to main
- Separate ElevenLabs / Upstash / Resend staging instances
- Subdomain `staging.fypro.com.ng` (Vercel auto URL is sufficient for now)
