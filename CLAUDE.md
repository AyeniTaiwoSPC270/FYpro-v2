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

Frontend:    React (Vite) — NOT vanilla HTML/CSS/JS (v1 artifacts were removed from the repo May 2026)
Styling:     Tailwind + custom CSS variables from MASTER.md design system
Routing:     React Router v7 (upgraded from v6 June 2026 to patch a DoS vulnerability)
Hosting:     Vercel (Hobby plan — 12 serverless function limit, 1 cron job limit)
Auth:        Supabase (email/password with email confirmation required + Google OAuth)
Database:    Supabase (PostgreSQL with RLS enabled on all tables)
Payments:    Paystack LIVE keys active — one-time payments, not subscriptions
AI:          Anthropic Claude API — proxied through Vercel serverless functions
Voice:       ElevenLabs TTS (examiner voices in Defense Simulator)
Cache:       Upstash Redis (rate limiting + response caching)
Error:       Sentry (PII scrubbed via beforeSend hook — no email/username in logs)
Analytics:   PostHog (behavioural analytics — custom events incl. paywall_shown funnel)
Email:       Resend via hello@fypro.com.ng (Day 0/3/7 nurture, payment receipt, broadcast — all "Dark Prestige" design, color-coded per type)
PWA:         vite-plugin-pwa + Workbox (injectManifest) — installable app, app-shell caching, offline snapshot, SW update toast
Push:        Web Push via web-push + VAPID keys (subscribe/nudge handled by api/notify.js)
Validation:  Zod schemas on api/ai, api/auth, api/payments + request trace IDs (X-Trace-Id → Sentry tag)
Testing:     vitest (npm run test) + tsc typecheck (npm run typecheck) — coverage is partial, mainly lib/generateReport
Monitoring:  Telegram bot (@fypro_admin_bot) — real-time alerts + admin commands; UptimeRobot pings /api/admin?action=ping; error-spike cron alert
Staging:     separate Vercel project with VITE_APP_ENV=staging (visible banner + Sentry environment tag)
DNS/CDN:     Cloudflare (nameservers active, email routing hello@fypro.com.ng → ayenit381@gmail.com)

---

## 3. FILE STRUCTURE

```
fypro-v2/
├── src/
│   ├── App.jsx                    # Root component — React Router routes defined here
│   ├── main.jsx                   # Vite entry point
│   ├── index.css                  # Global styles + Tailwind base
│   ├── assets/                    # fypro-logo.png, hero.png
│   ├── pages/
│   │   ├── LandingPage.jsx        # Public landing page (hero uses product showcase image)
│   │   ├── Pricing.jsx
│   │   ├── About.jsx
│   │   ├── Contact.jsx
│   │   ├── Privacy.jsx
│   │   ├── Terms.jsx
│   │   ├── CookiePolicy.jsx
│   │   ├── Dashboard.jsx          # Multi-project dashboard — project cards grid
│   │   ├── SplashOnboarding.jsx   # First-time onboarding flow
│   │   ├── Login.jsx
│   │   ├── Signup.jsx
│   │   ├── ForgotPassword.jsx
│   │   ├── ResetPassword.jsx
│   │   ├── VerifyEmail.jsx
│   │   ├── VerifyCertificate.jsx  # Public cert verification at /verify/:certNumber
│   │   ├── MaintenancePage.jsx    # Shown when admin maintenance kill switch is on
│   │   ├── Profile.jsx
│   │   ├── Settings.jsx           # Includes push notifications toggle
│   │   ├── PaymentSuccess.jsx
│   │   ├── NotFound.jsx
│   │   ├── admin/
│   │   │   ├── Health.jsx         # /admin/health — Mission Control tabbed dashboard
│   │   │   └── widgets/           # FeatureFeedbackWidget
│   │   ├── auth/
│   │   │   └── AuthConfirm.jsx    # /auth/confirm — email confirmation redirect target
│   │   ├── account/
│   │   │   ├── MyCertificates.jsx
│   │   │   ├── MyReferrals.jsx
│   │   │   ├── Achievements.jsx   # /account/achievements — gamification page
│   │   │   └── EmailPreferences.jsx
│   │   ├── changelog/
│   │   │   └── ChangelogPage.jsx
│   │   └── roadmap/
│   │       ├── RoadmapPage.jsx
│   │       ├── RoadmapCard.jsx
│   │       └── RoadmapColumn.jsx
│   ├── features/
│   │   ├── shell/
│   │   │   └── AppShell.jsx       # Sidebar + layout wrapper for /app routes (RankPill, Achievements nav)
│   │   ├── dashboard/             # Dashboard sub-components (DashTopBar with notification bell, etc.)
│   │   ├── topicValidator/
│   │   │   └── TopicValidator.jsx
│   │   ├── chapterArchitect/
│   │   │   └── ChapterArchitect.jsx
│   │   ├── literatureMap/
│   │   │   └── LiteratureMap.jsx
│   │   ├── methodology/           # Folder is "methodology", NOT "methodologyAdvisor"
│   │   │   └── MethodologyAdvisor.jsx
│   │   ├── writingPlanner/
│   │   │   └── WritingPlanner.jsx
│   │   ├── projectReviewer/
│   │   │   └── ProjectReviewer.jsx
│   │   ├── defensePrep/
│   │   │   ├── DefensePrep.jsx    # Defense Simulator (academic tribunal UI)
│   │   │   └── PastSessions.jsx   # Past Sessions tab — session history + transcripts
│   │   ├── supervisorPrep/
│   │   │   └── SupervisorPrep.jsx # Supervisor Meeting Prep Agent
│   │   └── supervisorEmail/
│   │       └── SupervisorEmail.jsx
│   ├── components/
│   │   ├── ProtectedRoute.jsx     # Auth + ban + adminOnly route guard
│   │   ├── CookieBanner.jsx       # NDPA 2023 consent banner (NOT CookieConsent.jsx)
│   │   ├── PaidFeatureGate.jsx    # Paid-gated UI — opens Paystack inline directly (no /pricing redirect)
│   │   ├── PaymentIssueModal.jsx
│   │   ├── NotificationPanel.jsx  # Bell dropdown — reads notifications table
│   │   ├── PWAInstallPrompt.jsx   # Bottom-sheet install prompt
│   │   ├── FyproLogo.jsx          # Theme-aware logo (light/dark variants)
│   │   ├── Spinner.jsx            # Consistent async-button spinner
│   │   ├── Toast.jsx
│   │   ├── Footer.jsx
│   │   ├── ApiErrorBox.jsx
│   │   ├── LoadingMessages.jsx
│   │   ├── RouteProgressBar.jsx
│   │   ├── WhatsAppButton.jsx
│   │   ├── AnonymousMigrationModal.tsx
│   │   ├── OfflineBanner.tsx      # Offline + amber "cached data" variant
│   │   ├── badges/                # BadgeRow, DefenseReadyBadge, StepBadge
│   │   ├── celebration/           # CelebrationModal (Tier 2 confetti), DefenseCelebration (Tier 3 full-screen)
│   │   ├── changelog/             # AnnouncementBanner, ChangelogEntry
│   │   ├── defense/               # CertificateUnlock, CertificateDownloadModal (style/orientation picker)
│   │   ├── feedback/              # FeedbackThumbs
│   │   ├── momentum/              # MomentumRing — 7-day activity SVG ring
│   │   ├── onboarding/            # OnboardingNudge, ReferralCapture
│   │   ├── rank/                  # RankPill sidebar component
│   │   ├── share/                 # DefenseShareCard
│   │   └── skeletons/             # Per-route page skeleton components
│   ├── hooks/
│   │   ├── useProjectState.ts     # Loads project, manages workflow state + offline snapshot fallback
│   │   ├── usePaidFeatures.js     # Reads user_entitlements from Supabase
│   │   ├── usePaystackCheckout.js # Paystack inline popup hook
│   │   ├── useAchievements.ts     # Gamification — achievements + realtime updates
│   │   ├── useMomentum.ts         # 7-day activity ring data
│   │   ├── useNotifications.js    # Notification bell state
│   │   ├── useRank.ts             # Derives rank from user progress
│   │   ├── useUser.ts
│   │   ├── useUserProgress.ts
│   │   ├── useOnboardingState.ts
│   │   └── useRunLimit.js
│   ├── lib/
│   │   ├── supabase.ts            # Primary Supabase client (supabase-client.ts is gone — this is the only one)
│   │   ├── analytics.js           # PostHog: trackEvent, identifyUser, resetUser
│   │   ├── sentry.ts
│   │   ├── certificate.ts         # jsPDF certs — 3 styles × 2 orientations + QR code
│   │   ├── checkAchievements.ts   # Calls /api/ai?action=check-achievements
│   │   ├── celebrations.ts        # localStorage celebration dedupe
│   │   ├── generateReport.js      # PDF progress report (Bold Nigerian Tech design) + generateReport.test.js
│   │   ├── notifications.js       # Client helpers to insert notifications
│   │   ├── offline-snapshot.ts    # Persist/patch/read/clear offline project snapshot
│   │   ├── db.ts
│   │   ├── storage.ts             # USER_STORAGE_KEYS registry
│   │   ├── routingCache.ts
│   │   ├── entitlements-cache.ts
│   │   ├── feedback.ts
│   │   ├── onboarding.ts
│   │   ├── progress.ts
│   │   ├── referral.ts
│   │   ├── shareCard.ts
│   │   └── sync-queue.ts
│   ├── services/
│   │   ├── api.js                 # Frontend API call helpers (OFFLINE early exit + timeouts)
│   │   └── prompts.js             # AI prompt builders (defense + reviewer prompts now resolved SERVER-side)
│   ├── context/
│   │   ├── AppContext.jsx         # Global state (project data, step results)
│   │   └── ThemeContext.jsx       # Light/dark mode state
│   ├── data/
│   │   ├── changelog.ts
│   │   ├── roadmap.ts
│   │   └── universities.js        # Nigerian universities list
│   └── emails/                    # React Email templates (frontend copy — also in api/_emails/)
│       ├── render.tsx
│       └── templates/
│           ├── welcome.tsx
│           ├── defense-nudge.tsx
│           └── urgency-reminder.tsx
│   # NOTE: src/old files/ (v1 vanilla JS) was deleted from the repo May 2026
├── api/                           # Vercel serverless functions (12 max on Hobby plan)
│   ├── admin.js                   # Admin data + Sentry + Telegram commands + ping + error-check + maintenance toggle
│   ├── ai.js                      # Claude proxy — workflow + defense + supervisor-prep + check-achievements
│   ├── auth.js                    # Login/signup/forgot-password + rate limiting + ban enforcement
│   ├── certificate.js             # Certificate record creation/verification (score >= 7/10)
│   ├── notify.js                  # Telegram alerts + bot webhook + push subscribe/unsubscribe + send-nudges cron
│   ├── payments.js                # Paystack initiate/verify/webhook/consume-reset (CAS guard)
│   ├── project-reviewer.js        # PDF upload + Claude review (Defense Pack only, 4 MB cap)
│   ├── referral.js                # Referral tracking + defense credit milestones
│   ├── research.js                # Semantic Scholar + OpenAlex + Claude
│   ├── send-nurture-email.ts      # Welcome + Day 3 + Day 7 email sequences
│   ├── share-card.js              # Satori PNG share card generation
│   ├── speak.js                   # ElevenLabs TTS proxy (gated on defense_pack)
│   ├── _lib/                      # Shared utilities (not Vercel functions)
│   │   ├── cors.js                # setCorsHeaders() — used by every endpoint
│   │   ├── supabase-admin.js      # Service-role Supabase client
│   │   ├── telegram.js            # sendTelegramAlert(), sendTelegramAlertOnce(), broadcast helpers
│   │   ├── pricing.js             # Plan definitions and kobo amounts
│   │   ├── papers.js              # Semantic Scholar + OpenAlex fetch logic
│   │   ├── credit-user.js         # Grant entitlements after verified payment
│   │   ├── cache.js               # Upstash response caching
│   │   ├── rate-limit.js          # Upstash rate limiter helpers
│   │   ├── usage-tracker.js       # Daily token/cost tracking
│   │   ├── ai-prompts.js          # SERVER-side system prompts (defense + reviewer — never trust client prompts)
│   │   ├── anthropic-proxy.js     # Shared Anthropic call wrapper
│   │   ├── validate.js            # Shared Zod validation schemas
│   │   ├── trace.js               # Request trace ID generator + prefixed logger
│   │   ├── maintenance.js         # Redis-backed maintenance mode kill switch
│   │   ├── defense-credit-check.js
│   │   └── system-log.js
│   └── _emails/                   # Email templates used by send-nurture-email.ts
│       ├── render.tsx
│       └── templates/
│           ├── welcome.tsx
│           ├── defense-nudge.tsx
│           └── urgency-reminder.tsx
├── migrations/                    # SQL files — run in Supabase SQL Editor
│   └── 0002 through 0028_*.sql    # (0015 app_config, 0019 notifications, 0025 push_subscriptions, 0026 user_achievements)
├── scripts/                       # Dev/ops scripts — NOT deployed
│   ├── verify-rls-after-refactor.js  # RLS regression test
│   ├── flush-reviewer-rate-limits.js
│   ├── register-telegram-webhook.js
│   ├── staging-schema.sql         # Schema dump for the staging Supabase project
│   ├── load-env.js
│   ├── generate-pwa-icons.mjs / generate-pwa-screenshots.mjs
│   └── screenshot-*.mjs           # OG image / flyer screenshot scripts
├── supabase/
│   ├── config.toml                # Local dev config — additional_redirect_urls set to www.fypro.com.ng
│   ├── functions/                 # Supabase Edge Functions
│   └── migrations/                # Supabase-managed migrations
├── public/
│   ├── fypro-logo.png / fypro-logo-bg.png / fypro-logo-light.png / fypro-logo-gold.png
│   ├── fypro-og-image.png
│   ├── favicon.svg / favicon-16x16.png / favicon-32x32.png / shield-star.svg
│   ├── manifest.json              # PWA manifest (icons + screenshots)
│   ├── brain.html / brain.js      # Live architecture viewer (Supabase Realtime)
│   ├── robots.txt
│   ├── sitemap.xml
│   └── flyers/
├── design-system/
│   └── fypro/
│       └── MASTER.md              # Design system — ALWAYS read before any UI work
├── .env.local                     # LOCAL ONLY — never committed
├── .env.example                   # Committed — required keys without values
├── vercel.json                    # CSP headers, function timeouts, SPA rewrite
├── tailwind.config.js
├── vite.config.js
├── tsconfig.json
└── CLAUDE.md                      # This file
```

---

## 4. ENVIRONMENT VARIABLES (see .env.example for the authoritative list)

### Frontend-safe (prefixed VITE_):
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_PAYSTACK_PUBLIC_KEY         ← LIVE key active
- VITE_POSTHOG_KEY
- VITE_ADMIN_EMAIL                 ← used by ProtectedRoute adminOnly check (see note below)
- VITE_SENTRY_DSN                  ← Sentry error reporting from frontend
- VITE_VAPID_PUBLIC_KEY            ← Web Push subscription (same value as VAPID_PUBLIC_KEY)
- VITE_APP_ENV                     ← "staging" on the staging Vercel project ONLY; unset in production

### Server-only (NEVER in frontend code or src/ files):
- SUPABASE_URL
- SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY        ← bypasses ALL RLS — server only
- ANTHROPIC_API_KEY
- PAYSTACK_SECRET_KEY              ← LIVE key active
- PAYSTACK_PUBLIC_KEY              ← server-side reference (VITE_ version used in frontend)
- SENTRY_WEBHOOK_SECRET
- EL_API_KEY                       ← ElevenLabs TTS
- UPSTASH_REDIS_REST_URLco
- UPSTASH_REDIS_REST_TOKEN
- SENTRY_AUTH_TOKEN                ← for admin dashboard Sentry API queries
- SENTRY_ORG                       ← org slug: "fypro"
- SENTRY_PROJECT                   ← project slug
- RESEND_API_KEY
- DAILY_CAP_USD                    ← $10/day default
- ADMIN_EMAIL                      ← server-side admin checks in api/ endpoints
- CRON_SECRET                      ← gates send-nurture-email + daily-report + error-check crons
- TELEGRAM_BOT_TOKEN               ← @fypro_admin_bot token
- TELEGRAM_CHAT_ID                 ← Taiwo's personal Telegram chat ID
- TELEGRAM_WEBHOOK_SECRET          ← bot rejects ALL inbound updates if unset (fails closed)
- VAPID_PUBLIC_KEY                 ← Web Push (used by api/notify.js)
- VAPID_PRIVATE_KEY                ← Web Push (used by api/notify.js)
- GMAIL_USER                       ← unused, kept for future use
- GMAIL_APP_PASSWORD               ← unused, kept for future use

### KNOWN INCONSISTENCY (resolve eventually): .env.example says "never create
### VITE_ADMIN_EMAIL" (it exposes the admin email in the JS bundle), but
### src/components/ProtectedRoute.jsx:92 still reads it for the adminOnly route
### gate. The client gate is convenience only — real enforcement is server-side
### via ADMIN_EMAIL. Do not add any NEW reliance on VITE_ADMIN_EMAIL.

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
- updated_at (auto-updated via trigger — added migration 0022)

### defense_sessions
- id (uuid)
- project_id (FK → projects)
- user_id (FK → users)
- turns (jsonb[])
- total_score (integer)
- completed_at

### defense_turns
- id (uuid)
- session_id (FK → defense_sessions)
- user_id (FK → users)
- turn_number (integer)
- examiner_question (text)
- student_answer (text)
- scores (added migration 0024 — powers Past Sessions transcripts)

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
- tier ('student_pack' | 'defense_pack' | 'defense_pack_upgrade' | 'project_reset')
- status ('pending' | 'success' | 'failed' | 'refunded')
- webhook_verified_at (timestamptz, nullable)
- created_at
- Client can SELECT own rows only. NO client INSERT/UPDATE/DELETE.

### user_achievements (gamification — migration 0026)
- id (uuid)
- user_id (FK → users, CASCADE)
- achievement_key (text)
- earned_at (timestamptz)
- Achievement unlocks are checked SERVER-side via /api/ai?action=check-achievements.
- defense_sessions scoring column is total_score — NOT final_score (a bug here once
  silently broke every defense achievement).

### notifications (in-app bell — migration 0019)
- id (uuid)
- user_id (FK → users, CASCADE)
- type, title, message (text)
- read (boolean, default false)
- metadata (jsonb)
- created_at

### push_subscriptions (Web Push — migration 0025)
- id (uuid)
- user_id (FK → users, CASCADE)
- subscription (jsonb — the PushSubscription object)
- last_nudged_at (timestamptz)
- created_at

### app_config (key/value — migration 0015, used for maintenance mode etc.)
- key (text, PK)
- value (text)
- updated_at

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

Plans and prices (LIVE Paystack keys active — source of truth: api/_lib/pricing.js):
- student_pack:         ₦2,000 (200000 kobo)
- defense_pack:         ₦3,500 (350000 kobo)
- defense_pack_upgrade: ₦1,500 (150000 kobo) — upgrade path from Student Pack to Defense Pack
- project_reset:        ₦1,500 (150000 kobo)

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
All payment actions are rate-limited.

Checkout UX: PaidFeatureGate opens the Paystack inline popup DIRECTLY (no navigation
to /pricing). PostHog paywall_shown event fires when the gate renders.

Project Reset flow:
- usePaystackCheckout hook handles payment from Dashboard
- On success → redirect to /dashboard (not /app)
- consume-reset endpoint removes project_reset from paid_features (one-time use)
- consume-reset is a COMPARE-AND-SWAP — it re-reads paid_features and only writes if
  project_reset is still present, preventing double-use from concurrent requests
- New project created, old project archived

Monitoring: daily Telegram report flags orphaned pending payments (>24h old).

---

## 8. CLAUDE API PROXY

All Claude API calls go through /api/ai (consolidated endpoint).
The ANTHROPIC_API_KEY is NEVER in the frontend.

Actions handled by /api/ai:
- general workflow (topic_validator, chapter_architect, etc.)
- defense (Defense Simulator turns)
- supervisor-prep (merged from api/supervisor-prep.js to stay within 12-function limit)
- check-achievements (gamification unlock checks — server-side, rate-limited)

Hardening (June 2026):
- Defense + reviewer SYSTEM PROMPTS are resolved server-side from api/_lib/ai-prompts.js.
  The client sends an action/step identifier, never the prompt text.
- Request bodies validated with Zod (api/_lib/validate.js). Every request gets a trace ID
  (api/_lib/trace.js) returned as X-Trace-Id and attached as a Sentry tag on the frontend.
- Free-tier per-step run limits are enforced SERVER-side, with an atomic Redis
  reservation to close the concurrent-request race.
- Maintenance mode kill switch (api/_lib/maintenance.js, Redis-backed, toggled from the
  admin dashboard) blocks generation and shows MaintenancePage.
- User bans are enforced at the auth level, not just client-side.

Rate limits (enforced via Upstash Redis):
- General: 30 req/IP/hour, 30 req/user/day
- Defense: 5 sessions/user/day
- Supervisor prep: 5 req/user/day, 15 req/IP/hour
- Free-tier per-step run limits: Chapter Architect and Methodology Advisor allow 3 free runs

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
Webhook secret: TELEGRAM_WEBHOOK_SECRET must match the secret_token set at registration
(scripts/register-telegram-webhook.js). If unset, the bot rejects ALL inbound updates — fails closed.

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
- /broadcast <message> → email all users; /broadcast_paid <message> → email paid users only

Daily report: cron-job.org fires daily at 20:00 UTC (9PM WAT) hitting
GET /api/admin?action=daily-report&secret=CRON_SECRET
The report includes orphaned pending payments (>24h) when any exist.

Error spikes: cron-job.org also hits the error-check action periodically — fires a
Telegram alert when Sentry errors spike (deduplicated via Redis).

Uptime: UptimeRobot (free plan, HEAD requests) pings GET/HEAD /api/admin?action=ping.

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
cron-job.org handles: daily-report at 20:00 UTC, nurture emails at 09:00 UTC,
error-spike check, and push nudges (api/notify.js send-nudges action).
UptimeRobot handles uptime pings (/api/admin?action=ping, accepts HEAD).

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

8. Admin route: /admin/health client-gated via ProtectedRoute adminOnly; real enforcement
   is server-side (ADMIN_EMAIL checks in api/ endpoints). Bans enforced at auth level.

9. AI system prompts (defense + reviewer) resolved server-side from api/_lib/ai-prompts.js —
   never accept prompt text from the client.

10. Secrets scanning: gitleaks runs in CI. npm audit kept clean.

Security audit completed May 2026 — 30 checks, all passed or manually verified.
Full-stack bug hunt June 10 2026 — 9 bugs found and fixed (commits e12aa40..c549bdf):
bans at auth level, server-side prompts, atomic run-limit reservation, consume-reset CAS,
scoped CORS preview regex, TTS gated on defense_pack + bodyParser fix, token auto-refresh
re-enabled, reviewer 4 MB upload cap, achievements total_score column.

---

## 16. WHAT IS FULLY BUILT AND LIVE (as of June 2026)

All features shipped and working in production (fypro.com.ng):
- Landing page (urgency CTAs, product showcase hero image) + pricing page
- Full auth (signup with email confirmation, login, forgot password, reset, Google OAuth,
  /auth/confirm redirect route)
- Complete 6-step workflow (Topic Validator → Defense Prep)
- Literature Map, Abstract Generator, Instrument Builder (embedded in steps)
- Supervisor Meeting Prep Agent
- Project Reviewer (PDF upload, Defense Pack gated, 4 MB cap)
- Defense Simulator (3 AI examiners, ElevenLabs voices, scoring, certificates,
  academic tribunal UI)
- Defense Simulator free trial (3 questions)
- Past Sessions — defense history tab with transcripts and per-turn scores
- Multi-project dashboard with project cards
- Project Reset payment flow (₦1,500, consumable entitlement, CAS-guarded)
- All four payment tiers (Student Pack, Defense Pack, Defense Pack Upgrade,
  Project Reset) — LIVE keys
- Certificate generation (FYP-2026-XXXXXX, unlocks at score >= 7/10) —
  3 PDF styles × 2 orientations, QR code, public verify page at /verify/:certNumber
- PDF progress report (Bold Nigerian Tech design, includes companion card sections)
- Gamification — Rank pill, Achievements page, Momentum ring, tiered celebrations
- In-app notification system (bell + dropdown, Supabase-backed)
- PWA — installable app, app-shell caching, install bottom sheet, SW update toast
- Web Push notifications (VAPID, Settings toggle, cron-driven nudges)
- Offline mode — cached project snapshot with amber offline banner
- Performance overhaul — lazy routes, per-route skeleton screens, optimistic UI updates
- Social share card (Satori PNG)
- Admin dashboard (/admin/health) — Mission Control tabbed redesign, realtime feed,
  user actions (reset limits, grant packs, diagnose), maintenance kill switch
- PostHog analytics (incl. paywall_shown funnel event)
- Telegram bot — alerts, admin commands, daily report, /broadcast + /broadcast_paid
- Email — Day 0/3/7 nurture, payment receipt, broadcast (Dark Prestige design,
  color-coded per email type)
- Monitoring — UptimeRobot ping, error-spike cron alert, orphaned payment flagging
- Staging environment (separate Vercel project, VITE_APP_ENV banner + Sentry env tag)
- API hardening — Zod validation, trace IDs, server-side prompts, server-side run limits
- Cookie consent banner (NDPA 2023)
- Light mode + dark mode (both fully working, incl. public pages redesign)
- Changelog + roadmap pages
- Referral system with defense credits
- Sentry error monitoring
- Security audit passed (30 checks) + June 10 bug hunt (9 fixes)
- Live brain — public architecture viewer (public/brain.html, Supabase Realtime)

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
- Never commit .env.local or any file containing real keys
- Never put service_role key in src/ files

Session discipline:
- Use /clear before every new task
- One task per session
- Verify visually in browser after every session
- Run RLS check after any schema change
- Run `npm run typecheck` (tsc, strictNullChecks + noImplicitAny on) and
  `npm run test` (vitest) before committing non-trivial changes
- Commit one fix per commit during bug-fix sessions (established pattern)

Critical pitfall — hardcoded colors:
The color #0D1B2A appears in both dark backgrounds AND as text color in some components.
Always use CSS variables. Never hardcode hex in component CSS.

---

## 18. LIVE URLS AND SERVICES

Production:       https://www.fypro.com.ng
Supabase project: ayvunikgfwpylfrkpalj
GitHub repo:      AyeniTaiwoSPC270/FYpro-v2
Telegram bot:     @fypro_admin_bot
Support email:    hello@fypro.com.ng (forwards to ayenit381@gmail.com via Cloudflare)
Admin dashboard:  https://www.fypro.com.ng/admin/health
Target launch:    June 12, 2026
v3 target:        December 2026

---

*End of CLAUDE.md. Read it. Follow it. Build fast and build secure.*
