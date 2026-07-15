# FYPro — Your Final Year Companion

FYPro is an AI-powered research companion for Nigerian final year university students.
It guides a student through a structured six-step research workflow — from a raw topic
idea all the way to a hostile, three-examiner defense simulation — and hands them a
downloadable certificate when they're ready.

**Live:** [www.fypro.com.ng](https://www.fypro.com.ng)<br>
**Repo:** [github.com/AyeniTaiwoSPC270/FYpro-v2](https://github.com/AyeniTaiwoSPC270/FYpro-v2)

---

## What it does

The core workflow walks a student through six steps:

1. **Topic Validator** — validates a rough topic against real literature
2. **Chapter Architect** — builds a chapter structure (+ Literature Map & Abstract Generator cards)
3. **Methodology Advisor** — recommends methodology (+ Instrument Builder card)
4. **Data Collection Instrument Builder**
5. **Writing Planner** — a week-by-week writing schedule
6. **Defense Prep** — a live simulation against three AI examiner personas
   (the Methodologist, the Subject Expert, the External Examiner)

Scoring 7/10+ in the Defense Simulator unlocks a downloadable certificate
(`FYP-2026-XXXXXX`), verifiable at `/verify/:certNumber`.

**Express Defence** is a separate, isolated product for students who already have a
completed draft: Project Reviewer → Defence Brief → Defence Simulator.

Additional features: Supervisor Meeting Prep, Project Reviewer (PDF/DOCX/TXT), Red Flag
Scanner, real paper integration (Semantic Scholar / OpenAlex / Crossref), gamification
(ranks, achievements, momentum ring), PWA install + offline mode, web push, referrals,
and a full admin/monitoring dashboard.

---

## Tech stack

| Layer       | Technology |
|-------------|------------|
| Frontend    | React 19 + Vite, React Router v7 |
| Styling     | Tailwind CSS + custom CSS design tokens |
| Auth & DB   | Supabase (PostgreSQL, RLS on every table, email/password + Google OAuth) |
| Payments    | Paystack (one-time payments, HMAC-verified webhooks) |
| AI          | Anthropic Claude API — proxied through Vercel serverless functions |
| Voice       | ElevenLabs TTS (examiner voices) |
| Cache/limits| Upstash Redis |
| Hosting     | Vercel (Hobby plan) |
| Errors      | Sentry (PII scrubbed) |
| Analytics   | PostHog |
| Email       | Resend |
| Monitoring  | Telegram bot, UptimeRobot |

The Anthropic API key never touches the browser — all Claude calls go through
`/api/ai`. System prompts for the defense and reviewer flows are resolved server-side.

---

## Getting started

Requires Node.js and npm.

```bash
# Install dependencies
npm install

# Copy the env template and fill in your keys
cp .env.example .env.local

# Start the dev server
npm run dev
```

Environment variables are documented in `.env.example`. Frontend-safe keys are prefixed
`VITE_`; everything else is server-only and must never appear in `src/`.
See `CLAUDE.md` §4 for the full list.

### Scripts

| Command             | Description |
|---------------------|-------------|
| `npm run dev`       | Start the Vite dev server |
| `npm run build`     | Production build |
| `npm run preview`   | Preview the production build |
| `npm run lint`      | ESLint |
| `npm run typecheck` | TypeScript type check (`tsc --noEmit`) |
| `npm run test`      | Run the vitest suite |
| `npm run test:watch`| vitest in watch mode |

Run `npm run typecheck` and `npm run test` before committing non-trivial changes.

---

## Project structure

```
fypro-v2/
├── src/
│   ├── pages/        # Route-level pages (landing, dashboard, admin, account, ...)
│   ├── features/     # Feature modules (workflow steps, defense, express, ...)
│   ├── components/   # Shared UI components
│   ├── hooks/        # React hooks (project state, entitlements, achievements, ...)
│   ├── lib/          # Supabase client, analytics, certificate/PDF generation, ...
│   ├── services/     # Frontend API helpers + prompt builders
│   ├── context/      # Global app + theme state
│   └── styles/       # Per-concern CSS (imported by index.css)
├── api/              # Vercel serverless functions (12-function Hobby limit)
├── migrations/       # SQL migrations (run in the Supabase SQL editor)
├── design-system/    # MASTER.md — read before any UI work
├── public/           # Static assets, PWA manifest, favicons
└── vercel.json       # CSP headers, function config, SPA rewrite
```

`CLAUDE.md` is the authoritative source of truth for architecture, conventions, and the
rules contributors must follow.

---

## Security

- Row Level Security is enabled on **every** table (zero tolerance).
- All API keys live in Vercel env vars; the service-role key is server-only.
- Paystack webhooks are HMAC SHA512-verified before processing (raw body, `bodyParser: false`).
- Every Claude endpoint is rate-limited per IP and per user via Upstash.
- All user input is untrusted — no `dangerouslySetInnerHTML`; uploads validated by
  magic-byte + size check.
- CORS is scoped to the production origin (no wildcards).

See `CLAUDE.md` §15 for the full non-negotiable security ruleset.

---

## Design system

Read `design-system/fypro/MASTER.md` before any UI work. Never hardcode hex values —
use the CSS variables. Both light and dark modes must work on every page.

---

Built for Nigerian final year students. Founder project alongside CourseMap and Spectra.
```