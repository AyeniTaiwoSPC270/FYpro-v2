# CLAUDE.md — FYPro v2
# Read this file at the start of every Claude Code session.
# It is the single source of truth for what this project is,
# how it is structured, what you must never do, and what v3 requires.

---

## 1. WHAT IS FYPRO

FYPro is an AI-powered research companion for Nigerian final year university students.
Tagline: "The supervisor you never had."

It is NOT a general study tool, NOT a plagiarism tool, NOT an essay writer.
It guides students through a structured six-step research project workflow —
from raw topic idea to walking into their defense ready.

Target user: ~500,000 Nigerian final year students annually.
Expansion planned: Ghana, Kenya, South Africa (v3+).

The product has three companion cards embedded in the workflow:
- Literature Map (inside Chapter Architect step)
- Abstract Generator (inside Chapter Architect step)
- Instrument Builder (inside Methodology Advisor step)

The Defense Simulator is the core differentiator:
Claude plays a hostile external examiner — three AI personas:
- The Methodologist
- The Subject Expert
- The External Examiner (formerly "Devil's Advocate" — renamed in Day 37)
Questions adapt based on answers. Gaps identified live. Students cannot walk in unprepared.

Related products (same founder, different problems):
- CourseMap — lecture/coursework companion
- Spectra — personal growth companion

---

## 2. TECH STACK

Frontend:    React (v2 — migrated from vanilla HTML/CSS/JS in v1)
Styling:     Design system in design-system/fypro/MASTER.md — always reference it
Routing:     [React Router / Next.js — confirm in package.json]
Hosting:     Vercel (serverless functions included)
Auth:        Supabase (email/password + magic link)
Database:    Supabase (PostgreSQL with RLS)
Payments:    Paystack (one-time per project, not subscription)
AI:          Anthropic Claude API — proxied through Vercel serverless functions
Voice:       OpenAI Whisper API (replaces browser SpeechRecognition)
Cache:       Upstash Redis (rate limiting + response caching)
Error:       Sentry (PII scrubbed via beforeSend hook)
Storage:     Supabase Storage (PDF uploads — Project Reviewer)

---

## 3. FILE STRUCTURE

```
fypro-app/
├── src/
│   ├── app/                        # App workflow pages (authenticated)
│   │   ├── topic-validator/
│   │   ├── chapter-architect/
│   │   ├── methodology-advisor/
│   │   ├── writing-planner/
│   │   ├── literature-map/
│   │   ├── abstract-generator/
│   │   ├── instrument-builder/
│   │   ├── project-reviewer/
│   │   ├── defense/                # Defense Simulator
│   │   ├── meeting-prep/           # Supervisor Meeting Prep Agent
│   │   └── onboarding/
│   ├── pages/                      # Public-facing pages
│   │   ├── landing/
│   │   ├── pricing/
│   │   ├── about/
│   │   └── auth/
│   │       ├── login/
│   │       ├── signup/
│   │       ├── verify-email/
│   │       └── forgot-password/
│   ├── lib/
│   │   └── supabase.ts             # Supabase client — ANON KEY ONLY
│   ├── hooks/
│   │   ├── useUser.ts
│   │   └── usePaidFeatures.ts
│   └── components/
│       └── PaidFeature.tsx         # Wrapper for paid-gated UI
├── api/                            # Vercel serverless functions
│   ├── claude.ts                   # Main Claude proxy
│   ├── topic-validate.ts
│   ├── defense-claude.ts
│   ├── verify-payment.ts           # Paystack server-side verification
│   ├── paystack-webhook.ts         # Paystack webhook receiver
│   └── transcribe.ts               # Whisper voice transcription
├── design-system/
│   └── fypro/
│       └── MASTER.md               # Design system — read before any UI work
├── scripts/                        # Dev/test scripts — NOT deployed to Vercel
│   └── verify-rls-after-refactor.js  # RLS regression test (created Day 19)
│       # Run: node scripts/verify-rls-after-refactor.js
│       # Must pass after every DB-touching change. Zero output = all good.
├── migrations/                     # SQL migration files — run in Supabase SQL Editor
│   ├── 0001_initial_schema.sql     # All CREATE TABLE + RLS (Day 15-16)
│   └── 0002_unique_step_constraint.sql  # UNIQUE(project_id, step_type) (Day 19)
├── architecture-decisions.md       # Supabase schema (generated Day 15)
├── security-policies.md            # RLS policies (generated Day 15)
├── migration-plan.md               # localStorage → Supabase plan (generated Day 19)
├── paystack-architecture.md        # Payment architecture (generated Day 22)
├── papers-architecture.md          # Paper API architecture (generated Day 32)
├── v1/
│   └── index.html                  # v1 reference — read for content, not code
├── public/
│   └── fypro-logo.png              # Real logo — use this everywhere
├── .env.local                      # LOCAL ONLY — never committed
├── .env.example                    # Committed — shows required keys without values
└── CLAUDE.md                       # This file
```

---

## 4. ENVIRONMENT VARIABLES

### Frontend-safe (can be exposed to client, prefixed VITE_ or NEXT_PUBLIC_):
- VITE_SUPABASE_URL
- VITE_SUPABASE_ANON_KEY
- VITE_PAYSTACK_PUBLIC_KEY

### Server-only (NEVER in frontend code, NEVER in client bundle):
- SUPABASE_SERVICE_ROLE_KEY      ← service_role bypasses ALL RLS — server only
- ANTHROPIC_API_KEY
- PAYSTACK_SECRET_KEY
- OPENAI_API_KEY
- UPSTASH_REDIS_REST_URL
- UPSTASH_REDIS_REST_TOKEN
- SENTRY_DSN
- DAILY_CAP_USD
- ADMIN_EMAIL

### Rule: if you are ever putting a server-only key into a component, hook,
### or any file inside src/ — STOP. That is a critical security mistake.

---

## 5. DATABASE SCHEMA (v2)

Five tables. Every table has RLS enabled. See architecture-decisions.md for full SQL.

### users
- id (uuid, FK → auth.users)
- email
- faculty
- department
- level (300 / 400)
- institution_id (uuid, nullable — null in v2, used in v3)
- created_at

### user_entitlements (service-role only table)
- user_id (FK → users)
- paid_features (jsonb, default '[]') — e.g. ["defense_pack", "project_reviewer"]
- paid_until (timestamptz, nullable)
- defense_packs_remaining (integer, default 0)
- total_lifetime_paid_ngn (integer, default 0)
- updated_at
- ← Users can SELECT their own row (to show upgrade status in UI)
- ← Users CANNOT INSERT, UPDATE, or DELETE — no client write policies exist
- ← Only serverless functions write here via service_role after HMAC verification
- NOTE: role ('student'|'supervisor'|'admin') lives on the users table, NOT here

### projects
- id (uuid)
- user_id (FK → users)
- title
- faculty
- department
- level
- status ('active' | 'completed' | 'archived')
- created_at, updated_at

### project_steps
- id (uuid)
- project_id (FK → projects)
- user_id (FK → users)
- step_name ('topic_validator' | 'chapter_architect' | 'methodology_advisor' |
             'writing_planner' | 'literature_map' | 'abstract_generator' |
             'instrument_builder' | 'project_reviewer')
- result (jsonb)
- completed_at

### defense_sessions
- id (uuid)
- project_id (FK → projects)
- user_id (FK → users)
- turns (jsonb[])   ← array of {examiner, question, answer, score, timestamp}
- final_score
- completed_at

### payments
- id (uuid)
- user_id (FK → users)
- project_id (FK → projects, nullable)
- paystack_reference (unique)
- amount_kobo (integer) — NGN × 100. e.g. ₦3,500 = 350000
- tier ('student_pack' | 'defense_pack' | 'project_reset')
- status ('pending' | 'success' | 'failed' | 'refunded')
- webhook_verified_at (timestamptz, nullable) — set after HMAC verification
- created_at
- ← Client can SELECT own rows only. NO client INSERT/UPDATE/DELETE.

### daily_usage (admin only — no client access)
- id (uuid)
- date (date, unique) — one row per UTC calendar day
- total_tokens_in (integer)
- total_tokens_out (integer)
- total_cost_usd (numeric)
- request_count (integer)
- updated_at
- ← No client policies. Service_role only via /api/claude

---

## 6. RLS RULES — READ BEFORE TOUCHING DATABASE CODE

Row Level Security is enabled on every table. See security-policies.md for full SQL.

**The three mistakes this project has been designed to prevent:**

1. Missing RLS → default Supabase = public access to everything
2. RLS enabled but no policies → app breaks silently
3. UPDATE without WITH CHECK → users can flip ownership/role

**Core policy pattern (users own their data):**
```sql
USING ((select auth.uid()) = user_id)
WITH CHECK ((select auth.uid()) = user_id)
```
Both clauses are always required on UPDATE and DELETE.

**user_entitlements table — NO client access:**
The paid_features, role, and paid_until columns are in user_entitlements.
Only /api/verify-payment and /api/paystack-webhook write to this table,
using the SUPABASE_SERVICE_ROLE_KEY (server-side only).
Frontend reads paid status via a server-side API call, never directly.

**Verification query — run this after any schema change:**
```sql
SELECT tablename FROM pg_tables
WHERE schemaname='public' AND rowsecurity = false;
```
Must return ZERO rows. If it returns anything — fix before continuing.

---

## 7. PAYMENT FLOW

One-time pricing (not subscription):
- Student Pack: ₦2,000
- Defense Pack: ₦3,500
- Project Reset: ₦1,500

**The three mandatory payment security checks:**

1. HMAC SHA512 signature verification on every webhook
   ```
   x-paystack-signature header must match
   crypto.createHmac('sha512', PAYSTACK_SECRET_KEY).update(rawBody).digest('hex')
   ```
   If invalid → return 400 immediately. Do not process.

2. Amount verification on every /api/verify-payment call
   Paystack response amount must match expected amount for that tier.
   If mismatch → reject. Log it.

3. Idempotency check — store processed reference IDs in payments table.
   If reference already processed → skip. Do not double-credit.

**Webhook endpoint note:**
Vercel requires `export const config = { api: { bodyParser: false } }`
in paystack-webhook.ts to access raw body bytes for HMAC verification.
Using JSON.stringify on a parsed body will give wrong signature hash.

---

## 8. CLAUDE API PROXY

All Claude API calls go through Vercel serverless functions.
The ANTHROPIC_API_KEY is NEVER in the frontend.

**Rate limits (enforced via Upstash Redis):**
- /api/claude (general): 30 req/IP/hour, 100 req/user/day
- /api/topic-validate: 10 req/user/day
- /api/defense-claude: 50 req/user/day
- /api/verify-payment: 20 req/user/hour
- /api/transcribe: 30 req/user/day

**Daily spend cap:**
Stored in Supabase daily_usage table.
If today's total exceeds DAILY_CAP_USD → return graceful 429 message.
Cap starts at $10/day. Raise as revenue justifies.

**Response caching (Upstash, 24hr TTL):**
Cache key = SHA-256 hash of (system prompt + user prompt + parameters).
DO NOT cache Defense Simulator turns (each turn is unique).
DO cache: Topic Validator, Chapter Architect, Methodology Advisor,
          Writing Planner, Literature Map, Abstract Generator,
          Instrument Builder, Project Reviewer.

**Paid feature server-side check:**
Before any /api/defense-claude response, verify paid_features
from user_entitlements via service_role. Frontend gating is convenience only —
real enforcement is server-side.

---

## 9. REAL PAPER INTEGRATION

This is FYPro's core defensible moat.
See papers-architecture.md for full architecture.

**APIs used (all free, no key required for basic use):**
- Semantic Scholar: api.semanticscholar.org
- OpenAlex: api.openalex.org
- Crossref: api.crossref.org

**Where papers are used:**
- Topic Validator: fetch 5 papers before Claude validates → pass as context
- Literature Map: fetch 20 papers → Claude groups into 4-6 thematic clusters

**Security rule for external API responses:**
Treat all paper data as untrusted input.
Always render as text — never as HTML.
Never use dangerouslySetInnerHTML.
Validate response shape before using (APIs can change format without notice).

---

## 10. VOICE MODE

Implemented via OpenAI Whisper API — NOT browser SpeechRecognition.
Browser SpeechRecognition has poor Nigerian accent accuracy.
Whisper cost: ~$0.006/minute.

**Flow:**
1. Frontend: mic button records via MediaRecorder
2. On stop: sends audio blob to /api/transcribe
3. /api/transcribe forwards to Whisper-1 model
4. Returns transcription text
5. Frontend populates answer field

**Security constraints:**
- Audio file size limit: 25MB (hard limit server-side + client-side)
- File type: audio/* only
- Audio NOT stored — discarded after transcription
- No audio data in Sentry logs — metadata only (size, duration, success/fail)

---

## 11. V3 SCHEMA CONSTRAINTS — DO NOT BREAK THESE

V3 introduces the B2B institutional model:
Universities/departments pay a flat semester fee for all their final year students.

**What v3 adds:**
- institutions table (universities and departments)
- users.institution_id (already nullable in v2 schema — do not remove this column)
- supervisor role (already in user_entitlements.role enum)
- Supervisor Dashboard: supervisors see student progress in their department
- Institutional billing separate from per-student billing
- University-specific onboarding (UNILAG Engineering vs OAU vs LASU)

**Rules for v2 work that protects v3:**
1. NEVER remove institution_id from the users table — it is nullable now, used in v3
2. NEVER remove 'supervisor' from the role enum in user_entitlements
3. Always use user_id foreign keys (not email) — enables multi-user relationships later
4. Projects table must remain linkable to both users AND (future) institutions
5. Do not hardcode "only students use this" assumptions into RLS policies —
   write policies that can extend to supervisors without full rewrites

---

## 12. DESIGN SYSTEM

Always read design-system/fypro/MASTER.md before any UI work.
Do not hardcode colors — use design system tokens.
Both light and dark modes must be correct on every page.

Key UI components:
- Result card (used by every workflow step)
- Loading state (spinner or animated dots)
- Error state (friendly, never "Error: undefined")
- Step navigator (horizontal, lights up on progress)
- Paid feature wrapper (<PaidFeature> component)
- Score badge (Weak / Developing / Strong — Defense Simulator)

Defense Simulator visual treatment is intentionally different from workflow screens.
Different color scheme, examiner card style distinct from student response card.
This communicates the seriousness of the mode.

---

## 13. WORKING RULES FOR CLAUDE CODE

**Start of every session:**
1. Read CLAUDE.md (this file)
2. Read design-system/fypro/MASTER.md if doing UI work
3. Read architecture-decisions.md if doing database work
4. Read security-policies.md if doing auth or RLS work
5. Read paystack-architecture.md if doing payment work
6. Read papers-architecture.md if doing paper integration work

**File discipline:**
- Name exact files in every instruction — never "fix the auth stuff"
- Tell Claude Code explicitly what NOT to modify
- Never modify v1/index.html — reference only for content
- Never commit .env.local or any file containing real keys

**Session discipline:**
- Use /clear before every new task
- One task per session — do not chain unrelated work
- Do not use Claude Code for CSS-only fixes — do those manually in VS Code
- If Claude Code reaches for service_role key in frontend code — STOP and rewrite

**Verification step after every session:**
- Open browser and manually verify what was built
- Do not trust Claude Code output without visual confirmation
- Run RLS verification query after any schema change

---

## 14. WHAT IS BUILT (v2 status)

Confirmed working:
- Landing page
- Full end-to-end workflow (landing → login → dashboard → app)
- Theme toggle (light/dark)
- Topic Validator
- Chapter Architect
- Methodology Advisor
- Writing Planner
- Literature Map
- Abstract Generator
- Instrument Builder
- Project Reviewer
- Defense Simulator (three examiner personas)
- Custom ElevenLabs examiner voices (limited credits — do not use again until live demo)

In progress / outstanding:
- Supabase schema + RLS (Day 15 — current)
- Supabase auth wiring (Day 16-18)
- localStorage → Supabase migration (Day 19)
- Paystack payments (Week 4)
- Rate limiting + spend cap (Week 5)
- Real paper integration (Week 5)
- Supervisor Meeting Prep Agent (Week 6)
- Whisper voice mode (Week 6)
- Security audit (Day 47)

Deferred:
- Supervisor Dashboard (v3)
- Institutional billing (v3)
- University-specific onboarding beyond UNILAG (v3)

---

## 15. SECURITY RULES — NON-NEGOTIABLE

These are the five rules. They do not bend for convenience.

1. **RLS on every table.**
   Verified by: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;`
   Must return zero rows. Always.

2. **API keys in Vercel env vars only.**
   Never in code. Never committed to git. Service role key NEVER in frontend.
   Confirm: `git log -p | grep -i 'service_role\|sk_live\|sk_test\|paystack_secret'` → zero matches.

3. **Paystack webhooks verify HMAC SHA512 before processing.**
   Invalid signatures return 400 immediately. Not optional.
   bodyParser must be disabled in Vercel for raw body access.

4. **Claude API endpoints rate-limited per IP and per user.**
   Via Upstash Redis. Without this, one bad actor drains the budget in minutes.

5. **All user input is untrusted.**
   React default text rendering is safe — keep it that way.
   Never use dangerouslySetInnerHTML.
   PDFs validated by magic-byte check + 10MB size limit on server.

---

## 16. LIVE URLS

Production: https://fypro.vercel.app
Repo: https://github.com/AyeniTaiwoSPC270/fypro-app
Target public launch: June 12, 2026
v3 scaling: December 2026

---

*End of CLAUDE.md. Read it. Follow it. Build fast and build secure.*
