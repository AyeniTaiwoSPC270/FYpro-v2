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

**Express Defence** is a separate, isolated product (entitlement: `express_defense`, ₦2,000):
Targeted at students who already have a completed draft and just need defense preparation.
Three-step linear flow (no full 6-step workflow):
1. Project Reviewer — upload PDF for AI review
2. Defence Brief — personalised opening statement, model answers for weak spots, examiner Q&A prep. Downloads as a jsPDF-generated PDF.
3. Defence Simulator — same 3-AI-examiner simulator as the main app, with certificates.
Express users get their own isolated dashboard (/express), onboarding (/express-onboarding),
and shell (/express/run) that never touches the main workflow state.

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
│   │   ├── SplashOnboarding.jsx   # First-time onboarding flow (split-canvas shell, chip questions, TourCarousel)
│   │   ├── ExpressDashboard.jsx   # Express Defence dashboard (/express — 3-step progress view, no New Session button)
│   │   ├── ExpressAchievements.jsx # Express achievements page (/express/achievements — 8 express-scoped achievements)
│   │   ├── ExpressOnboarding.jsx  # Express onboarding (/express-onboarding — split-canvas shell)
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
│   │   │   ├── Health.jsx         # /admin/health — Mission Control tabbed dashboard (Overview, Users, Payments, Vitals, Logs, Reports, ⭐ Ratings, 📊 Data)
│   │   │   └── widgets/           # FeatureFeedbackWidget, RatingsWidget
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
│   │   │   └── _shared.jsx        # STEP_DEFS, EXPRESS_STEP_DEFS, expressBuildSteps helper
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
│   │   ├── expressDefense/        # All Express Defence components
│   │   │   ├── ExpressShell.jsx          # 3-step shell (/express/run) with sidebar + step nav
│   │   │   ├── DefenceBrief.jsx          # Defence Brief feature — generate/coach/download flow
│   │   │   ├── ExpressProjectStateProvider.jsx  # Isolated project state for Express — also fetches getUserProfile() to hydrate name/university/avatarUrl
│   │   │   └── ExpressProviders.jsx      # Wraps Express routes with isolated providers
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
│   │   ├── badges/                # BadgeRow, DefenseReadyBadge, StepBadge; AchievementsRow accepts viewAllHref prop (default /account/achievements)
│   │   ├── celebration/           # CelebrationModal (Tier 2 confetti), DefenseCelebration (Tier 3 full-screen)
│   │   ├── changelog/             # AnnouncementBanner, ChangelogEntry
│   │   ├── defense/               # CertificateUnlock, CertificateDownloadModal (style/orientation picker)
│   │   ├── feedback/              # FeedbackThumbs
│   │   ├── momentum/              # MomentumRing — 7-day activity SVG ring
│   │   ├── onboarding/            # OnboardingNudge, ReferralCapture
│   │   ├── rank/                  # RankPill sidebar component
│   │   ├── rating/                # RatingModal — 2-step star rating + suggestions modal (triggers: defense_simulator | steps_milestone)
│   │   ├── share/                 # DefenseShareCard
│   │   └── skeletons/             # Per-route page skeleton components
│   │   ├── ReportButton.jsx       # User-facing issue report button (used in ApiErrorBox + DashTopBar)
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
│   │   ├── generateDefenceBrief.js # jsPDF Defence Brief PDF (A4, db- CSS prefix, multi-section)
│   │   ├── notifications.js       # Client helpers to insert notifications
│   │   ├── offline-snapshot.ts    # Persist/patch/read/clear offline project snapshot
│   │   ├── db.ts
│   │   ├── storage.ts             # USER_STORAGE_KEYS registry
│   │   ├── routingCache.ts
│   │   ├── entitlements-cache.ts
│   │   ├── feedback.ts
│   │   ├── onboarding.ts          # saveOnboardingAnswers(), markWalkthroughSeen() helpers
│   │   ├── progress.ts
│   │   ├── referral.ts
│   │   ├── shareCard.ts
│   │   └── sync-queue.ts
│   ├── services/
│   │   ├── api.js                 # Frontend API call helpers (OFFLINE early exit + timeouts) — includes generateDefenceBrief(), coachDefenceBriefAnswer()
│   │   └── prompts.js             # AI prompt builders (defense + reviewer + defence-brief prompts now resolved SERVER-side; client sends action identifier only)
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
│   ├── styles/                    # CSS split from single index.css into per-concern files (June 2026)
│   │   ├── base.css               # Base resets + root variables
│   │   ├── design-system.css      # Design tokens (colors, spacing, typography)
│   │   ├── steps-core.css         # Shared step card patterns
│   │   ├── step-accents.css       # Per-step left-border accent colors
│   │   ├── defense.css            # Defense Simulator styles (dp- prefix)
│   │   ├── defense-brief.css      # Defence Brief styles (db- prefix, light + dark mode)
│   │   ├── defense-premium.css    # Premium defense UI elements
│   │   ├── express.css            # Express Defence shell (es-, eb- prefixes)
│   │   ├── instrument-builder.css # Instrument Builder (ib- prefix)
│   │   ├── abstract-generator.css # Abstract Generator (ag- prefix)
│   │   ├── onboarding-questions.css  # Onboarding chip questions + TourCarousel (oq- prefix)
│   │   ├── light-mode.css         # Light mode overrides
│   │   ├── theme-responsive.css   # Theme-responsive helpers
│   │   ├── responsive.css         # Breakpoint-driven layout
│   │   ├── touch-targets.css      # Mobile touch target sizing
│   │   ├── utilities-shared.css   # Shared utility classes
│   │   └── writing-planner-email.css  # Writing planner email preview
│   # NOTE: src/old files/ (v1 vanilla JS) was deleted from the repo May 2026
│   # NOTE: index.css now @imports from src/styles/ — MUST stay as CSS @imports (Tailwind v3 appends variants at stylesheet end)
├── api/                           # Vercel serverless functions (12 max on Hobby plan)
│   ├── admin.js                   # Admin data + Sentry + Telegram commands + ping + error-check + maintenance toggle
│   │                              #   + data-tab (KPIs, 8 chart datasets, 29 table counts)
│   │                              #   + data-browse (paginated table viewer, search + sort)
│   │                              #   + submit-rating, get-ratings, get-rating-force, set-rating-force, check-rating-force
│   │                              #   + submit-report (user issue reports → user_reports table + Telegram alert)
│   ├── ai.js                      # Claude proxy — workflow + defense + supervisor-prep + check-achievements
│   ├── auth.js                    # Login/signup/forgot-password + rate limiting + ban enforcement
│   │                              #   Per-IP (10/15min) + per-email (20/1hr, SHA-256 hashed) limiters on login
│   │                              #   isNewUser guard: users table update + Telegram alert + welcome notification
│   │                              #   + nurture email only fire for genuine new signups (not re-signup attempts)
│   ├── certificate.js             # Certificate record creation/verification (score >= 7/10)
│   ├── notify.js                  # Telegram alerts + bot webhook + push subscribe/unsubscribe + send-nudges cron
│   │                              #   + submit-report handler + /data command (query any of 29 tables)
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
│   │   ├── rating-force.js        # Redis+Supabase-backed rating modal force flag (admin toggle via app_config)
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
│   └── 0002 through 0035_*.sql    # (0015 app_config, 0019 notifications, 0025 push_subscriptions,
│                                  #  0026 user_achievements, 0029 express_defense_tier,
│                                  #  0030 project_mode, 0031 achievements_project_scope,
│                                  #  0032 onboarding_questions,
│                                  #  0033 defense_certificates_faculty_department,
│                                  #  0034_add_defense_brief_step_type (adds 'defense_brief' to step_type CHECK),
│                                  #  0034_user_ratings (star ratings table + RLS),
│                                  #  0035_user_reports (user issue reports table + RLS))
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
- VITE_ADMIN_EMAIL_HASH            ← SHA-256 hex of ADMIN_EMAIL; ProtectedRoute adminOnly convenience gate (no plaintext email in bundle)
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

### ADMIN GATE (resolved 2026-06-17): ProtectedRoute's adminOnly gate compares a
### SHA-256 hash of the signed-in email against VITE_ADMIN_EMAIL_HASH, so the admin
### email is NEVER shipped as plaintext in the JS bundle. The client gate is
### convenience only — real enforcement is server-side via a timing-safe ADMIN_EMAIL
### check on the verified JWT in api/admin.js. Never reintroduce a plaintext
### VITE_ADMIN_EMAIL.

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
- faculty (text, nullable — added migration 0033)
- department (text, nullable — added migration 0033)

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

### user_onboarding (extended — migration 0032)
New columns added June 2026 (all nullable — skipped question leaves column NULL):
- referral_source (text)
- expected_defence_band (text) — CHECK IN ('<1m','1-3m','3-6m','unsure')
- primary_goal (text) — CHECK IN ('validate_topic','build_chapters','plan_writing','defence_practice')
- notify_email (boolean)
- notify_push (boolean)
- walkthrough_seen_at (timestamptz)
No new RLS policies needed — existing own-row policies cover these columns.

### projects (extended — migration 0030)
- mode (text) — 'standard' | 'express' (project_mode migration 0030)
Express projects are auto-created on first /express load and have mode='express'.

### user_achievements (extended — migration 0031)
- project_id (uuid, nullable) — achievement scope isolation (express vs standard)
Express achievements are scoped to the express project; main achievements scoped to main.

### referrals, email_log, email_preferences, generation_failures,
### auth_attempts, payment_issues, feature_feedback,
### response_times, daily_usage (all exist — see Supabase dashboard for full schema)

### system_logs
- General server-side event log (27 rows in prod)

### user_progress
- Tracks per-user workflow progress state (6 rows in prod)

### admin_users
- Admin role table — controls admin access gate (1 row in prod)

### user_ratings (migration 0034)
- id (uuid)
- user_id (FK → auth.users, CASCADE)
- stars (smallint, CHECK 1–5)
- trigger_type (text, CHECK IN ('defense_simulator', 'steps_milestone'))
- feature (text)
- suggestion_feature (text, nullable)
- suggestion_ui (text, nullable)
- created_at
- Users can INSERT and SELECT own rows. Admin reads via service_role in get-ratings action.
- Rate-limited: 3/user/day, 10/IP/day. Submitted via /api/admin?action=submit-rating.
- Admin Force Modal: `rating_modal_force` key in app_config (Redis-cached, 60s TTL) forces
  the modal on next AppShell mount — controlled from ⭐ Ratings tab. Keep Force Modal toggle;
  admin needs it for testing the submission flow.

### user_reports (migration 0035)
- id (uuid)
- user_id (FK → auth.users, CASCADE)
- type (text, CHECK IN ('error', 'general'))
- description (text)
- context (jsonb, default '{}')
- status (text, CHECK IN ('open', 'acknowledged', 'resolved'), default 'open')
- created_at
- Users can INSERT and SELECT own rows. NO client UPDATE/DELETE — status managed server-side.
- Submitted via ReportButton → /api/notify?action=submit-report. Fires Telegram alert on insert.

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
- user_ratings: INSERT + SELECT own rows; admin reads all via service_role
- user_reports: INSERT + SELECT own rows; service_role manages status field

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
- express_defense:      ₦2,000 (200000 kobo) — Express Defence product (for students with completed drafts)
- project_reset:        ₦1,500 (150000 kobo)

express_defense entitlement unlocks:
- /express-onboarding → /express → /express/run routes
- Project Reviewer, Defence Brief, Defence Simulator (in Express shell only)
- Auto-creates an express project (mode='express') on first /express load
- express-only users are redirected from /dashboard → /express by ExpressDashboardRedirect

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
- defence-brief (generates opening statement + model answers + examiner Q&A for Express)
- defence-brief-coach (evaluates student's practice answer, gives corrective hint if needed)

Hardening (June 2026):
- Defense + reviewer + defence-brief SYSTEM PROMPTS are resolved server-side from api/_lib/ai-prompts.js.
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
- Defence Brief: 30 req/user/day, 60 req/IP/day
- Defence Brief Coach: 60 req/user/day, 120 req/IP/day
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
- Defence Brief: NOT cached (output depends on unique review + weak-spots context)
- Defence Brief Coach: NOT cached (coaching is conversational)

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
- 📝 User report submitted (via ReportButton)
- ⚠️ Account targeted by credential stuffing (per-email rate limit hit)

Inbound commands (tap buttons or type):
- /start or /help → shows inline keyboard with all commands
- /stats, /revenue, /users, /spend, /errors, /payments, /health
- /broadcast <message> → email all users; /broadcast_paid <message> → email paid users only
- /data <table> → query any of 29 tables (rows shown in HTML-escaped format, row count in footer)
  ALLOWED tables: admin_users, app_config, auth_attempts, daily_usage, defense_certificates,
  defense_credits, defense_sessions, defense_turns, email_log, email_preferences,
  feature_feedback, generation_failures, institutions, notifications, payment_issues,
  payments, project_steps, projects, push_subscriptions, referrals, response_times,
  system_logs, user_achievements, user_entitlements, user_onboarding, user_progress,
  user_ratings, user_reports, users

Daily report: cron-job.org fires daily at 20:00 UTC (9PM WAT) hitting
GET /api/admin?action=daily-report&secret=CRON_SECRET
The report includes orphaned pending payments (>24h) when any exist.

Error spikes: cron-job.org also hits the error-check action periodically — fires a
Telegram alert when Sentry errors spike (deduplicated via Redis).

Uptime: UptimeRobot (free plan, HEAD requests) pings GET/HEAD /api/admin?action=ping.

Test all alerts: GET /api/admin?action=test-all-alerts (admin only)

---

## 11. MULTI-PROJECT DASHBOARD

Route: /dashboard — shows project grid (standard users)
Route: /dashboard?project=PROJECT_ID — shows individual project dashboard
Route: /express — Express Defence dashboard (express-only users; no New Session button in top bar)
Route: /express/run — Express Defence 3-step shell
Route: /express/achievements — Express achievements page (8 express-scoped achievements, back → /express)
Route: /express-onboarding — Express onboarding flow (if no express_defense entitlement)

Standard dashboard flow:
- New users: blank welcome state
- Returning users: project cards grid
- Each card: project title, status badge, created date, Continue button
- "New Project" card: locked (padlock + ₦1,500) until project_reset paid
- After payment: entitlement consumed on use (one project per payment)
- Continue → /dashboard?project=ID → loads that project's dashboard
- ← My Projects button returns to grid
- Delete button: confirms then hard-deletes project + project_steps

selectProject(pid) in useProjectState.ts hydrates AppContext with the selected project's data.

Express routing:
- ExpressDashboardRedirect (at /dashboard): detects express-only users and redirects to /express
- RequireExpress guard: checks express_defense entitlement; redirects to /express-onboarding if missing
- ExpressProviders wraps /express, /express/run, and /express/achievements with isolated state (ExpressProjectStateProvider)
- Express projects are scoped by project mode='express'; their achievements are isolated to the express project_id
- Admin can grant express_defense entitlement from Mission Control (/admin/health)

DashTopBar behaviour:
- planLabel maps express_defense → 'Express Defence' (not 'Free Plan')
- New Session button only renders when onNewSession prop is passed — ExpressDashboard omits it intentionally
- ExpressProjectStateProvider hydrates name/university/avatarUrl from getUserProfile() so greeting + avatar + sidebar are correct

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

9. AI system prompts (defense + reviewer + defence-brief + defence-brief-coach) resolved
   server-side from api/_lib/ai-prompts.js — never accept prompt text from the client.

10. Secrets scanning: gitleaks runs in CI. npm audit kept clean.

10. Auth: login rate-limited per-IP (10/15min) AND per-email (20/1hr). Email hashed with
    SHA-256 before use as Redis key — no plaintext emails in Redis. isNewUser guard (identities
    array check) prevents re-signup attempts from triggering false new-user side effects
    (Telegram alert, welcome notification, nurture email, users table overwrite).

Security audit completed May 2026 — 30 checks, all passed or manually verified.
Full-stack bug hunt June 10 2026 — 9 bugs found and fixed (commits e12aa40..c549bdf):
bans at auth level, server-side prompts, atomic run-limit reservation, consume-reset CAS,
scoped CORS preview regex, TTS gated on defense_pack + bodyParser fix, token auto-refresh
re-enabled, reviewer 4 MB upload cap, achievements total_score column.
Auth hardening June 21 2026 — 3 fixes: per-email rate limit, isNewUser guard on users
table update, isNewUser guard on signup side effects (commits be84760..1b222de).

---

## 16. WHAT IS FULLY BUILT AND LIVE (as of June 21, 2026)

All features shipped and working in production (fypro.com.ng):
- Landing page (urgency CTAs, light/dark product showcase hero image) + pricing page
- Full auth (signup with email confirmation, login, forgot password, reset, Google OAuth,
  /auth/confirm redirect route)
- Complete 6-step workflow (Topic Validator → Defense Prep)
- Literature Map, Abstract Generator, Instrument Builder (embedded in steps)
- Supervisor Meeting Prep Agent
- Project Reviewer (PDF / DOCX / TXT upload, Defense Pack gated, 4 MB cap)
  — PDF: base64 to Claude natively via pdfs-2024-09-25 beta, no truncation
  — DOCX: raw base64 sent to server, mammoth extracts full text server-side, no truncation
  — TXT: text extracted client-side via FileReader, no truncation
- Defense Simulator (3 AI examiners, ElevenLabs voices, scoring, certificates,
  academic tribunal UI)
- Defense Simulator free trial (3 questions)
- Past Sessions — defense history tab with transcripts and per-turn scores
- Multi-project dashboard with project cards
- Project Reset payment flow (₦1,500, consumable entitlement, CAS-guarded)
- All five payment tiers (Student Pack, Defense Pack, Defense Pack Upgrade,
  Express Defence, Project Reset) — LIVE keys
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
  user actions (reset limits, grant packs, grant express_defense, diagnose), maintenance kill switch
- PostHog analytics (incl. paywall_shown funnel event)
- Telegram bot — alerts, admin commands, daily report, /broadcast + /broadcast_paid
- Email — Day 0/3/7 nurture, payment receipt, broadcast (Dark Prestige design,
  color-coded per email type)
- Monitoring — UptimeRobot ping, error-spike cron alert, orphaned payment flagging
- Staging environment (separate Vercel project, VITE_APP_ENV banner + Sentry env tag)
- API hardening — Zod validation, trace IDs, server-side prompts, server-side run limits
- Cookie consent banner (NDPA 2023)
- Light mode + dark mode (both fully working, incl. public pages + Express shell)
- Changelog + roadmap pages
- Referral system with defense credits
- Sentry error monitoring
- Security audit passed (30 checks) + June 10 bug hunt (9 fixes)
- Live brain — public architecture viewer (public/brain.html, Supabase Realtime)
- Onboarding questions + product walkthrough — chip question screens (referral source,
  defence date band, primary goal), notification opt-in, 4-slide TourCarousel; answers
  saved to user_onboarding (migration 0032); walkthrough_seen_at marks completion
- Express Defence — isolated 3-step product (₦2,000): Project Reviewer → Defence Brief
  → Defence Simulator; own dashboard (/express), onboarding (/express-onboarding),
  shell (/express/run), isolated state providers, achievement scope isolation
- Defence Brief — jsPDF-generated preparation document (opening statement, model answers
  for weak spots, examiner Q&A); practice mode with AI coaching per question (db- CSS prefix)
- Rating system — RatingModal (2-step: star rating + open suggestions), triggered post-defense
  and at steps milestone; stores to user_ratings; admin ⭐ Ratings tab in Mission Control with
  breakdown charts; Force Modal toggle (admin testing); localStorage dedup prevents repeat prompts
- User reports — ReportButton inline in ApiErrorBox and DashTopBar; type: error | general;
  status tracked server-side (open → acknowledged → resolved); fires Telegram alert on submit
- Admin Data Tab (📊) — KPI cards with polling, 8 curated charts (signups, revenue, usage
  trends), 29-table browser with search, sort, pagination; backed by data-tab + data-browse actions
- Telegram /data command — query any of 29 tables directly from bot; HTML-escaped rows + row count footer
- Auth hardening — per-email login rate limit (20/1hr, SHA-256 hashed key), isNewUser guard
  prevents profile overwrite + false Telegram/notification/nurture triggers on re-signup attempts
- project_steps step_type constraint updated to include 'defense_brief' (migration 0034)
- Express Dashboard UI fixes (June 21 2026) — profile hydration (name, university, avatar),
  plan label shows 'Express Defence' not 'Free Plan', New Session button removed from Express top bar
- Express achievements page (/express/achievements) — isolated 8-achievement view scoped to express
  project; AchievementsRow viewAllHref prop routes express users away from main achievements page

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

CSS naming prefixes — NEVER mix prefixes between features:
- es-  Express content area only (.es-main / .es-main__scroll + Express card overrides).
       ExpressShell reuses the MAIN app chrome — .sidebar, .step-navigator, .sidebar-toggle-btn.
       Do not reintroduce a separate Express sidebar.
- db-  Defence Brief (DefenceBrief.jsx) — src/styles/defense-brief.css
- oq-  Onboarding questions + TourCarousel — src/styles/onboarding-questions.css
All other prefixes (tv-, ca-, ma-, di-, wp-, dp-, se-) remain as before.

CSS architecture: index.css @imports from src/styles/ — MUST stay as CSS @imports,
not JS imports (Tailwind v3 appends variants at stylesheet end; switching to JS imports breaks this).

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
Launched:         June 2026 (live and accepting payments)
v3 target:        December 2026

---

*End of CLAUDE.md. Read it. Follow it. Build fast and build secure.*
