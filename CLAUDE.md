# CLAUDE.md — FYPro v2
# Read this file at the start of every Claude Code session.
# It is the single source of truth for what this project is,
# how it is structured, what you must never do, and what v3 requires.

---

## 1. WHAT IS FYPRO

FYPro is an AI-powered research companion for Nigerian final year university students.
Tagline: "Your Final Year Companion."

It is NOT a general study tool, NOT a plagiarism tool, NOT an essay writer.
It guides students through a structured six-step research project workflow —
from raw topic idea to walking into their defense ready.

Target user: ~500,000 Nigerian final year students annually.
Expansion planned: Ghana, Kenya, South Africa (v3+).

The product has three companion cards embedded in the workflow:
- Literature Map (inside Chapter Architect step)
- Abstract Generator (inside Chapter Architect step)
- Instrument Builder (inside Methodology Advisor step)

Additional features:
- Supervisor Meeting Prep Agent (generates supervisor meeting questions)
- Project Reviewer (AI review of uploaded PDFs — Defense Pack only)
- Red Flag Scanner (identifies research weaknesses)
- Writing Planner (week-by-week writing schedule)

The Defense Simulator is the core differentiator:
Claude plays a hostile external examiner — three AI personas:
- The Methodologist
- The Subject Expert
- The External Examiner
Questions adapt based on answers. Gaps identified live. Students cannot walk in unprepared.
Scores 7/10+ unlock a downloadable defense certificate (FYP-2026-XXXXXX serial format).
ElevenLabs TTS voices assigned per examiner persona.
Free trial: 3 questions before paywall.

Related products (same founder, different problems):
- CourseMap — lecture/coursework companion
- Spectra — personal growth companion

---

## 2. TECH STACK

Frontend:    React (Vite) — NOT vanilla HTML/CSS/JS (that was v1, now archived in v1/)
Styling:     Tailwind + custom CSS variables from MASTER.md design system
Routing:     React Router v6
Hosting:     Vercel (Hobby plan — 12 serverless function limit, 1 cron job limit)
Auth:        Supabase (email/password with email confirmation required)
Database:    Supabase (PostgreSQL with RLS enabled on all tables)
Payments:    Paystack LIVE keys active — one-time payments, not subscriptions
AI:          Anthropic Claude API — proxied through Vercel serverless functions
Voice:       ElevenLabs TTS (examiner voices in Defense Simulator)
Cache:       Upstash Redis (rate limiting + response caching)
Error:       Sentry (PII scrubbed via beforeSend hook — no email/username in logs)
Analytics:   PostHog (behavioural analytics — 9 custom events tracked)
Email:       Resend via hello@fypro.com.ng (welcome + Day 3 + Day 7 nurture sequences)
Monitoring:  Telegram bot (@fypro_admin_bot) — real-time alerts + admin commands
DNS/CDN:     Cloudflare (nameservers active, email routing hello@fypro.com.ng → ayenit381@gmail.com)

---

## 3. FILE STRUCTURE

```
fypro-v2/
├── src/
│   ├── pages/
│   │   ├── Landing.jsx
│   │   ├── Pricing.jsx
│   │   ├── Dashboard.jsx          # Multi-project dashboard — shows project cards
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── Profile.jsx
│   │   ├── Settings.jsx
│   │   ├── PaymentSuccess.jsx
│   │   ├── AdminHealth.jsx        # /admin/health — gated to VITE_ADMIN_EMAIL
│   │   ├── Roadmap.jsx
│   │   ├── Changelog.jsx
│   │   ├── MyCertificates.jsx
│   │   └── NotFound.jsx
│   ├── features/
│   │   ├── topicValidator/
│   │   ├── chapterArchitect/
│   │   ├── methodologyAdvisor/
│   │   ├── writingPlanner/
│   │   ├── projectReviewer/
│   │   ├── defensePrep/           # Defense Simulator
│   │   └── supervisorPrep/        # Supervisor Meeting Prep Agent
│   ├── components/
│   │   ├── AppShell.jsx           # Sidebar + layout wrapper for /app
│   │   ├── ProtectedRoute.jsx
│   │   └── CookieConsent.jsx      # NDPA 2023 compliance banner
│   ├── hooks/
│   │   ├── useProjectState.ts     # Loads most-recent project, manages workflow state
│   │   ├── usePaidFeatures.ts     # Reads user_entitlements from Supabase
│   │   └── usePaystackCheckout.js # Extracted Paystack inline popup hook
│   ├── lib/
│   │   ├── supabase-client.ts     # Supabase anon client + helper functions
│   │   │                          # Includes: getAllUserProjects(), createProject(),
│   │   │                          #           archiveAllActiveProjects(), deleteProject()
│   │   └── analytics.js           # PostHog helpers: trackEvent, identifyUser, resetUser
│   ├── services/
│   │   └── api.js                 # Frontend API call helpers
│   └── context/
│       └── AppContext.jsx         # Global state (project data, step results)
├── api/                           # Vercel serverless functions (12 max on Hobby plan)
│   ├── admin.js                   # Admin dashboard data + Sentry integration + Telegram test
│   ├── ai.js                      # Claude proxy — general workflow + defense + supervisor-prep
│   ├── auth.js                    # Login/signup/forgot-password + rate limiting
│   ├── certificate.js             # PDF certificate generation (score >= 7/10)
│   ├── notify.js                  # Telegram outbound alerts + inbound bot webhook handler
│   ├── payments.js                # Paystack initiate/verify/webhook/consume-reset
│   ├── project-reviewer.js        # PDF upload + Claude review (Defense Pack only)
│   ├── referral.js                # Referral tracking + defense credit milestones
│   ├── research.js                # Semantic Scholar + OpenAlex + Claude (topic-validate + lit-map)
│   ├── send-nurture-email.ts      # Welcome + Day 3 + Day 7 email sequences via Resend
│   ├── share-card.js              # Satori PNG share card generation
│   └── speak.js                   # ElevenLabs TTS proxy
│   └── _lib/                      # Shared utilities (not counted as functions)
│       ├── telegram.js            # sendTelegramAlert(), sendTelegramAlertOnce()
│       ├── pricing.js             # Plan definitions and amounts
│       ├── papers.js              # Semantic Scholar + OpenAlex shared fetch logic
│       └── credit-user.js        # Grant entitlements after verified payment
├── public/
│   └── fypro-logo.png            # Real logo — use this everywhere
├── design-system/
│   └── fypro/
│       └── MASTER.md             # Design system — ALWAYS read before any UI work
├── .env.local                    # LOCAL ONLY — never committed
├── .env.example                  # Committed — shows required keys without values
├── vercel.json                   # CSP headers, redirects, cron job config
└── CLAUDE.md                     # This file
```

---

## 4. ENVIRONMENT VARIABLES (27 total in Vercel)

### Frontend-safe (prefixed VITE_):
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_PAYSTACK_PUBLIC_KEY         ← LIVE key active
- VITE_POSTHOG_KEY
- VITE_ADMIN_EMAIL                 ← gates /admin/health route
- VITE_SENTRY_DSN                  ← Sentry error reporting from frontend

### Server-only (NEVER in frontend code or src/ files):
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY        ← bypasses ALL RLS — server only
- ANTHROPIC_API_KEY
- PAYSTACK_SECRET_KEY              ← LIVE key active
- PAYSTACK_PUBLIC_KEY              ← server-side reference (VITE_ version used in frontend)
- SENTRY_WEBHOOK_SECRET
- EL_API_KEY                       ← ElevenLabs TTS
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- SENTRY_AUTH_TOKEN                ← for admin dashboard Sentry API queries
- SENTRY_ORG                       ← org slug: "fypro"
- SENTRY_PROJECT                   ← project slug
- RESEND_API_KEY
- DAILY_CAP_USD                    ← $10/day default
- ADMIN_EMAIL
- CRON_SECRET                      ← gates send-nurture-email + daily-report cron
- TELEGRAM_BOT_TOKEN               ← @fypro_admin_bot token
- TELEGRAM_CHAT_ID                 ← Taiwo's personal Telegram chat ID
- GMAIL_USER                       ← unused, kept for future use
- GMAIL_APP_PASSWORD               ← unused, kept for future use

### Rule: if you are ever putting a server-only key into a component, hook,
### or any file inside src/ — STOP. That is a critical security mistake.

---

## 5. DATABASE SCHEMA (current production state)

All tables have RLS enabled. Zero tables with rowsecurity=false (verified).

### users
- id (uuid, FK → auth.users)
- email, full_name, avatar_url
- faculty, department, level (300/400/500)
- university (text)
- institution_id (uuid, nullable — reserved for v3 B2B)
- created_at, updated_at

### user_entitlements (service-role writes only)
- user_id (FK → users)
- paid_features (jsonb, default '[]') — e.g. ["defense_pack", "project_reset"]
- total_lifetime_paid_ngn (integer)
- updated_at
- Users can SELECT their own row only. NO client INSERT/UPDATE/DELETE.
- Only serverless functions write here via service_role after HMAC verification.

### projects (supports multiple projects per user — no UNIQUE constraint on user_id)
- id (uuid)
- user_id (FK → users)
- title (text, nullable)
- status ('active' | 'archived' | 'draft' — constraint: projects_status_check)
- current_step (text, default 'topic_validator')
- faculty, department, level
- supervisor_id (uuid, nullable)
- institution_id (uuid, nullable)
- created_at, updated_at

### project_steps
- id (uuid)
- project_id (FK → projects)
- user_id (FK → users)
- step_name (text)
- result (jsonb)
- completed_at

### defense_sessions
- id (uuid)
- project_id (FK → projects)
- user_id (FK → users)
- turns (jsonb[])
- final_score (integer)
- completed_at

### defense_turns
- id (uuid)
- session_id (FK → defense_sessions)
- user_id (FK → users)
- turn_number (integer)
- examiner_question (text)
- student_answer (text)

### defense_certificates
- id (uuid)
- user_id (FK → users)
- session_id (FK → defense_sessions)
- certificate_number (text, unique — format: FYP-2026-XXXXXX)
- issued_at

### defense_credits
- id (uuid)
- user_id (FK → users)
- reason (text)
- source_referral_id (uuid)

### payments
- id (uuid)
- user_id (FK → users)
- paystack_reference (unique)
- amount_kobo (integer)
- tier ('student_pack' | 'defense_pack' | 'project_reset')
- status ('pending' | 'success' | 'failed' | 'refunded')
- webhook_verified_at (timestamptz, nullable)
- created_at
- Client can SELECT own rows only. NO client INSERT/UPDATE/DELETE.

### daily_usage
- date (date, unique)
- total_tokens_in, total_tokens_out (integer)
- total_cost_usd (numeric)
- request_count (integer)
- updated_at

### institutions (reference table — Nigerian universities)
- id (uuid)
- name, short_name (text)
- faculty (text)

### referrals, email_log, email_preferences, generation_failures,
### auth_attempts, payment_issues, feature_feedback, user_onboarding,
### response_times, daily_usage (all exist — see Supabase dashboard for full schema)

---

## 6. RLS RULES — READ BEFORE TOUCHING DATABASE CODE

Row Level Security is enabled on every table.
Verified: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;`
Must return zero rows. Always check after any schema change.

Key policy patterns:
- users: SELECT/UPDATE own row only
- user_entitlements: SELECT own row, NO client writes (service_role only)
- projects: SELECT/INSERT/UPDATE/DELETE own rows only
- project_steps: SELECT/INSERT/UPDATE own rows only
- payments: SELECT own rows only (service_role writes via webhook)
- institutions: readable by all authenticated users (reference data)
- defense_certificates: service role inserts only
- referrals/defense_credits: service role writes only

The three mistakes this project has been designed to prevent:
1. Storing subscription status on a user-writable table (leads to free premium exploit)
2. Missing RLS on any table (leads to full data exposure)
3. Client-side enforcement only (always enforce server-side too)

---

## 7. PAYMENT ARCHITECTURE

Plans and prices (LIVE Paystack keys active):
- student_pack: ₦2,000 (200000 kobo)
- defense_pack: ₦3,500 (350000 kobo)
- project_reset: ₦1,500 (150000 kobo)

Payment flow:
1. Frontend calls POST /api/payments?action=initiate
2. Server creates pending payment row, returns Paystack reference
3. Paystack inline popup opens
4. On success: poll /api/payments?action=check-payment-status every 3s
5. Webhook hits /api/payments (bodyParser: false — raw body for HMAC)
6. HMAC SHA512 verified before any processing
7. Amount verified against expected kobo amount
8. user_entitlements updated via service_role
9. Telegram alert sent

CRITICAL: bodyParser must be disabled in payments.js for raw body HMAC verification.
Idempotency: paystack_reference UNIQUE constraint + .eq('status','pending') guard prevents double-crediting.
Race condition: Both verify and webhook paths are safe due to idempotency guard.

Project Reset flow:
- usePaystackCheckout hook handles payment from Dashboard
- On success → redirect to /dashboard (not /app)
- consume-reset endpoint removes project_reset from paid_features (one-time use)
- New project created, old project archived

---

## 8. CLAUDE API PROXY

All Claude API calls go through /api/ai (consolidated endpoint).
The ANTHROPIC_API_KEY is NEVER in the frontend.

Actions handled by /api/ai:
- general workflow (topic_validator, chapter_architect, etc.)
- defense (Defense Simulator turns)
- supervisor-prep (merged from api/supervisor-prep.js to stay within 12-function limit)

Rate limits (enforced via Upstash Redis):
- General: 30 req/IP/hour, 30 req/user/day
- Defense: 5 sessions/user/day
- Supervisor prep: 5 req/user/day, 15 req/IP/hour

Daily spend cap: DAILY_CAP_USD env var ($10 default).
Telegram alert fires at 80% and 100% of cap (deduplicated per UTC day via Redis).

Response caching (Upstash, TTL varies):
- Topic Validator: 24h
- Chapter Architect: 24h
- Methodology Advisor: 12h
- Writing Planner: 6h
- Defense Simulator: NOT cached (each turn is unique)
- Project Reviewer: NOT cached

Cache key = SHA-256 hash of (system prompt + user prompt + parameters).

---

## 9. REAL PAPER INTEGRATION

APIs used (all free, no key required):
- Semantic Scholar: api.semanticscholar.org (primary)
- OpenAlex: api.openalex.org (fallback when <3 results from Semantic Scholar)
- Crossref: api.crossref.org (metadata enrichment)

Shared module: /api/_lib/papers.js

Nigerian research quirk: Strip geographic modifiers like "in Nigeria" before OpenAlex
fallback — broadens search and returns more results. Sparse local literature is framed
as an originality opportunity in the UI, not a failure.

Used in:
- Topic Validator: fetch papers → pass as context to Claude
- Literature Map: fetch 20 papers → Claude clusters into themes

---

## 10. TELEGRAM BOT

Bot: @fypro_admin_bot
Webhook: POST https://www.fypro.com.ng/api/notify (registered with www subdomain — not bare domain, Telegram doesn't follow 307 redirects)

Outbound alerts (fire automatically):
- 👤 New signup
- 💰 Payment received
- ❌ Payment failed
- ⚠️ Spend cap hit (deduplicated per day)
- 🔶 80% spend warning (deduplicated per day)
- 🔴 Generation failed
- 🎓 Defense completed
- 📁 New project created
- 🚨 Payment issue reported

Inbound commands (tap buttons or type):
- /start or /help → shows inline keyboard with all commands
- /stats, /revenue, /users, /spend, /errors, /payments, /health

Daily report: cron-job.org fires daily at 20:00 UTC (9PM WAT) hitting
GET /api/admin?action=daily-report&secret=CRON_SECRET

Test all alerts: GET /api/admin?action=test-all-alerts (admin only)

---

## 11. MULTI-PROJECT DASHBOARD

Route: /dashboard — shows project grid
Route: /dashboard?project=PROJECT_ID — shows individual project dashboard

Flow:
- New users: blank welcome state
- Returning users: project cards grid
- Each card: project title, status badge, created date, Continue button
- "New Project" card: locked (padlock + ₦1,500) until project_reset paid
- After payment: entitlement consumed on use (one project per payment)
- Continue → /dashboard?project=ID → loads that project's dashboard
- ← My Projects button returns to grid
- Delete button: confirms then hard-deletes project + project_steps

selectProject(pid) in useProjectState.ts hydrates AppContext with the selected project's data.

---

## 12. VERCEL CONSTRAINTS (Hobby Plan)

12 serverless function limit — currently AT LIMIT:
admin, ai, auth, certificate, notify, payments, project-reviewer,
referral, research, send-nurture-email, share-card, speak

1 cron job limit — used by Vercel for heartbeat (actual cron via cron-job.org).
cron-job.org handles: daily-report at 20:00 UTC, nurture emails at 09:00 UTC.

If adding a new endpoint: must merge an existing one first.
Safe merge candidates: supervisor-prep already merged into ai.js, notify.js handles both outbound alerts and inbound webhook.

---

## 13. CSP (Content Security Policy) — vercel.json

Current connect-src includes:
- https://api.anthropic.com
- https://*.supabase.co
- wss://*.supabase.co
- https://api.elevenlabs.io
- https://api.paystack.co
- https://*.ingest.sentry.io
- https://us.i.posthog.com
- https://us-assets.i.posthog.com

Current script-src includes:
- https://js.paystack.co
- https://us-assets.i.posthog.com
- https://static.cloudflareinsights.com

Current style-src includes:
- https://fonts.googleapis.com
- https://paystack.com

If adding a new third-party service, update vercel.json CSP before deploying.

---

## 14. DESIGN SYSTEM

Always read design-system/fypro/MASTER.md before any UI work.
Never hardcode hex values — use CSS variables.
Both light and dark modes must work on every page.

Key colors:
- Background (dark): #060E18
- Sidebar: #0D1B2A
- Accent blue: #0066FF
- Surface (light workspace): #F0F4F8

Key fonts:
- DM Serif Display — headings, step labels
- Poppins — body text, buttons
- JetBrains Mono — scores, badges, technical labels

Anti-patterns (NEVER do these):
- Purple gradients
- White cards on plain grey (always add dot texture to workspace)
- Hardcoded hex in component CSS
- Generic Inter/Roboto as primary font

---

## 15. SECURITY — NON-NEGOTIABLE RULES

1. RLS on every table. Zero tolerance.
   Verify: SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;

2. API keys in Vercel env vars only. Never in src/. Service role NEVER in frontend.

3. Paystack webhooks: HMAC SHA512 verified before processing. bodyParser: false required.

4. Rate limiting: every Claude endpoint rate-limited per IP and per user via Upstash.

5. All user input is untrusted. No dangerouslySetInnerHTML. PDFs validated by magic-byte + size check.

6. CORS: all API endpoints use setCorsHeaders() restricting to production origin only.
   No wildcard CORS anywhere. Verified: grep -rn "Allow-Origin.*\*" api/ → zero matches.

7. Sentry: beforeSend hook deletes email, username, and any PII before sending to Sentry.

8. Admin route: /admin/health gated by VITE_ADMIN_EMAIL check — not accessible to regular users.

Security audit completed May 2026 — 30 checks, all passed or manually verified.

---

## 16. WHAT IS FULLY BUILT AND LIVE (as of May 2026)

All features shipped and working in production (fypro.com.ng):
- Landing page + pricing page
- Full auth (signup with email confirmation, login, forgot password, reset)
- Complete 6-step workflow (Topic Validator → Defense Prep)
- Literature Map, Abstract Generator, Instrument Builder (embedded in steps)
- Supervisor Meeting Prep Agent
- Project Reviewer (PDF upload, Defense Pack gated)
- Defense Simulator (3 AI examiners, ElevenLabs voices, scoring, certificates)
- Defense Simulator free trial (3 questions)
- Multi-project dashboard with project cards
- Project Reset payment flow (₦1,500, consumable entitlement)
- All three payment tiers (Student Pack, Defense Pack, Project Reset) — LIVE keys
- Certificate generation (FYP-2026-XXXXXX, unlocks at score >= 7/10)
- Social share card (Satori PNG)
- Admin dashboard (/admin/health)
- PostHog analytics (9 events)
- Telegram notifications (10 alert types + 8 admin commands + daily report)
- Email nurturing (Day 0/3/7 sequences via Resend)
- Cookie consent banner (NDPA 2023)
- Light mode + dark mode (both fully working)
- Changelog + roadmap pages
- Referral system with defense credits
- Sentry error monitoring
- Security audit passed (30 checks)

Deferred to v3:
- Supervisor Dashboard
- Institutional/B2B billing
- University-specific onboarding beyond general Nigerian context
- Voice input (Whisper) — removed from v2 scope
- Rigid progression system
- 3D visual identity

---

## 17. WORKING RULES FOR CLAUDE CODE

Start of every session:
1. Read CLAUDE.md (this file)
2. Read design-system/fypro/MASTER.md if doing UI work
3. Check function count in api/ before adding new endpoints (limit: 12)

File discipline:
- Name exact files in every instruction
- Never modify v1/ — reference only
- Never commit .env.local or any file containing real keys
- Never put service_role key in src/ files

Session discipline:
- Use /clear before every new task
- One task per session
- Verify visually in browser after every session
- Run RLS check after any schema change

Critical pitfall — hardcoded colors:
The color #0D1B2A appears in both dark backgrounds AND as text color in some components.
Always use CSS variables. Never hardcode hex in component CSS.

---

## 18. LIVE URLS AND SERVICES

Production:       https://www.fypro.com.ng
Supabase project: ayvunikgfwpylfrkpalj
GitHub repo:      AyeniTaiwoSPC270/fypro-app
Telegram bot:     @fypro_admin_bot
Support email:    hello@fypro.com.ng (forwards to ayenit381@gmail.com via Cloudflare)
Admin dashboard:  https://www.fypro.com.ng/admin/health
Target launch:    June 12, 2026
v3 target:        December 2026

---

*End of CLAUDE.md. Read it. Follow it. Build fast and build secure.*
