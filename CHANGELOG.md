# Changelog

All notable changes to FYPro are documented here.
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
Versions follow [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added
- OpenAPI 3.0 specification (`openapi.yaml`) covering all serverless API endpoints
- JSDoc documentation on all major serverless handler functions

### Changed
- Sidebar logo resized for balanced proportions across viewport sizes
- Writing Planner now reads actual word count from Chapter Architect result instead of a fixed default
- Per-step accent colors on nav pills, sidebar badges, and card left-borders
- Step-number watermarks on all step cards via CSS `::before` pseudo-elements
- Green confirm CTAs (`#16A34A`) and JetBrains Mono typography for defense score display

### Fixed
- Comprehensive mobile responsiveness across all pages
- Light mode on all public pages, step cards, Referrals page, and Certificates page
- Abstract Generator text color in dark mode; removed duplicate Project Reviewer watermark
- `handleGeneral` — replaced `.maybeSingle().catch()` with `try/catch` to eliminate silent 500s
- `response_times` inserts now awaited with a 3 s timeout guard across all Claude endpoints to prevent function hangs
- `response_times` tracking gaps filled in `research.js` and `project-reviewer.js`
- Referral link domain corrected
- Admin Realtime WebSocket subscription no longer closes and reopens on each render
- Admin `daily_usage` metrics now update reliably via Realtime and polling fallback
- TypeScript `TOKEN_REFRESH_FAILED` auth event cast resolved
- Moderate npm dependency vulnerabilities resolved via `npm audit fix`

### Security
- Prompt injection surface closed: `handleGeneral` no longer accepts a client-supplied `system` prompt — system prompts are resolved server-side by step name
- Missing auth guard added to `handleGeneral` for unauthenticated requests

---

## [2.0.0] - 2026-06-12

Full React/Vite rebuild of the v1 vanilla-JS prototype. Every feature rebuilt from scratch with auth, payments, a real database, and production-grade security.

### Added
- **Six-step workflow**: Topic Validator → Chapter Architect → Methodology Advisor → Writing Planner → Defense Prep, with Literature Map, Abstract Generator, and Instrument Builder as companion cards
- **Defense Simulator** — three AI examiner personas (Methodologist, Subject Expert, External Examiner); questions adapt to student answers; free trial for 3 questions before paywall
- **ElevenLabs TTS** — distinct voices assigned per examiner persona in the Defense Simulator
- **Project Reviewer** — PDF upload with AI review (Defense Pack only); server-side magic-byte validation and 10 MB size cap
- **Supervisor Meeting Prep Agent** — generates 8 targeted questions per session based on project stage and last feedback
- **Red Flag Scanner** — surfaces research weaknesses in the workflow
- **Multi-project dashboard** — project cards grid, per-project progress tracking, project archive
- **Project Reset** — consumable paid entitlement (₦1,500) to create additional projects
- **Defense Certificate** — downloadable certificate (serial format `FYP-2026-XXXXXX`) unlocked at score ≥ 7/10
- **Social share card** — Satori-generated PNG for sharing defense results
- **Paystack payments** — Student Pack (₦2,000) and Defense Pack (₦3,500); LIVE keys active
- **Google OAuth** via Supabase Auth
- **Email auth** — signup with email confirmation, login, forgot/reset password, email verification flow
- **Admin dashboard** (`/admin/health`) — user table, 30-day revenue and signup charts, feature usage, drop-off funnel, never-converted list, live event feed, daily spend, cache hit rate, real-time API vitals
- **Telegram bot** (`@fypro_admin_bot`) — 10 real-time alert types and 8 admin commands; daily report at 20:00 UTC
- **Resend transactional emails** — welcome (Day 0), defense nudge (Day 3), urgency reminder (Day 7)
- **Upstash Redis** — response caching and per-IP/per-user rate limiting on every AI endpoint
  - Topic Validator: 24 h cache · Chapter Architect: 24 h · Methodology Advisor: 12 h · Writing Planner: 6 h · Supervisor Prep: 6 h
  - Defense Simulator and Project Reviewer are never cached
- **Sentry** error monitoring with PII scrub (`beforeSend` deletes email and username before dispatch)
- **PostHog** behavioural analytics — 9 custom events tracked
- **Referral system** — defense credits awarded at milestone referral counts
- **Changelog and roadmap pages** in-app
- **Cookie consent banner** compliant with Nigeria Data Protection Act 2023
- **Light and dark mode** — both fully functional across every page
- **Cloudflare DNS** with email routing (`hello@fypro.com.ng`)
- Real paper integration — Semantic Scholar (primary) and OpenAlex (fallback) augment Topic Validator and Literature Map prompts with up to 20 real papers; sparse literature framed as an originality opportunity

### Security
- Full security audit completed May 2026 — 17 bugs fixed across 30 checks; all findings resolved or manually verified
- Row Level Security enabled on every Supabase table — verified with `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false` returning zero rows
- Paystack webhooks verified with HMAC-SHA512 (`bodyParser: false` on the payments function to preserve raw body)
- Daily spend cap (`DAILY_CAP_USD`, default $10) enforced server-side on all AI endpoints
- ANTHROPIC_API_KEY and SUPABASE_SERVICE_ROLE_KEY never exposed to frontend code
- CORS restricted to production origin only — no wildcard `Access-Control-Allow-Origin` anywhere
- All user input treated as untrusted; no `dangerouslySetInnerHTML`; PDFs validated by magic-byte check before forwarding

### Fixed
- `response_times` tracking wired across all Claude endpoints
- `maybeSingle` 500 error in `handleGeneral` resolved
- `admin SELECT` RLS policies added for `daily_usage`, `response_times`, and metric tables
- Silent 500s across all serverless endpoints eliminated

---

## [1.0.0] - 2026-04-24

Hackathon submission for the CBC UNILAG Claude AI Hackathon.

### Added
- Defense Simulator with single AI examiner persona
- Basic six-step research workflow (vanilla HTML/CSS/JS, no framework)
- Landing page
- Claude API proxy via Vercel serverless function
- Session state in `localStorage`
