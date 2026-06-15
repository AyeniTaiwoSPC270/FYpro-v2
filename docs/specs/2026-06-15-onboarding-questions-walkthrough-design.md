# Design Spec — Onboarding Questions & Product Walkthrough
**Date:** 2026-06-15
**Scope:** Standard onboarding only (`SplashOnboarding.jsx`, the "I'm starting my final year project" persona path). Express onboarding (`/express-onboarding`) is untouched.

---

## 1. Problem

The current onboarding collects university/faculty/dept/level/topic and immediately drops the user into the app. FYPro learns nothing useful about the user (attribution, timeline, goal) at the moment they're most willing to share, and new users get zero orientation before facing a 6-step workflow with no explanation.

---

## 2. Goals

- Capture 4 high-value data points (attribution, defence date, primary goal, notification consent) during the moment of highest engagement.
- Give every new user a skippable product tour so they walk into the app with a mental model of what each step does.
- Add a progress bar + congratulatory finish moment so onboarding feels complete and rewarding, not just a form.
- Keep completion rate high: every new question is skippable, the flow is chip-driven (taps, not typing), and the tour is opt-in.

---

## 3. What Is NOT Changing

- Express onboarding (`/express-onboarding`, `ExpressOnboarding.jsx`) — untouched.
- The persona fork ("What stage are you at?") — stays as the entry point.
- The profile form (university / faculty / dept / level / topic) — stays as Step 1, content unchanged.
- The `onboarding_completed` metadata flag in `auth.users` — still the canonical "has onboarded" signal.
- No plan/pricing step in onboarding — removed from scope. Plan awareness lives only as a soft one-liner on the congrats screen.

---

## 4. New Flow

```
[splash 1.7s]
      ↓
[persona screen]  ── "I already have a project" ──→  /express-onboarding (unchanged)
      ↓ "I'm starting my FYP"
[Step 1 — Profile]        university / faculty / dept / level / topic
      ↓
[Step 2 — Attribution]    "How did you hear about us?" (chips)
      ↓
[Step 3 — Defence date]   "When's your defence/submission?" (chips)
      ↓
[Step 4 — Primary goal]   "What do you want most right now?" (chips)
      ↓
[Step 5 — Notifications]  Email nudges toggle + Push reminders toggle
      ↓
[Congrats screen]         🎉 celebratory, soft plan mention, "Enter FYPro" CTA
      ↓
[Walkthrough card]        "Take the tour" / "Skip to my project"
      ↓ (tour chosen)     ↓ (skip chosen)
[4-slide carousel]        navigate('/app')
      ↓ (finish / skip)
  navigate('/app')
```

A **slim progress bar** sits above every screen from Step 1 through Step 5, filling left-to-right. Near the end (Step 4–5) it shows the label **"Almost done."**

---

## 5. Individual Screens

### 5.1 Steps 2–4 — Quick Question Screens
Each is a single chip-selection screen. Same `.onb` Split Canvas shell (persistent brand rail on left, question on right). One question per screen, no typing required.

**Step 2 — Attribution**
- Label: `HOW DID YOU HEAR ABOUT US?`
- Chips (single select): Friend or colleague · Twitter / X · TikTok · Instagram · WhatsApp · Lecturer · Google Search · Other
- Skip affordance: quiet "Skip" text link below chips.
- On answer or skip → advance to Step 3.

**Step 3 — Defence / Submission Date**
- Label: `WHEN'S YOUR DEFENCE OR SUBMISSION?`
- Chips (single select): Within 1 month · 1–3 months · 3–6 months · Not sure yet
- Skip affordance: quiet "Skip" text link.
- On answer or skip → advance to Step 4.

**Step 4 — Primary Goal**
- Label: `WHAT DO YOU WANT MOST RIGHT NOW?`
- Chips (single select): Validate my topic · Build my chapters · Plan my writing · Defence practice
- Skip affordance: quiet "Skip" text link.
- On answer or skip → advance to Step 5.

All chip screens animate in with the same `card-enter` pattern (fade + translateY 12px, 0.4s). Selected chip gets a blue border + fill; deselected chips are ghost style. A "Continue" button activates once a chip is selected — or users can tap "Skip".

### 5.2 Step 5 — Notifications
Two toggle rows, not chips. Same `.onb` shell.

- **Email nudges** — "Get writing reminders and defence tips by email" → writes `notify_email` to `user_onboarding`.
- **Push reminders** — "Get nudges on this device" → triggers the existing Web Push subscribe flow (`api/notify.js`, VAPID). Writes `notify_push`.

Both default **off**. Neither is required. "Continue" always enabled on this screen (no mandatory selection).

### 5.3 Congrats Screen
Not inside the `.onb` shell — full-bleed dark canvas, centred content. Triggered after Step 5 saves.

Content:
- Large animated checkmark or shield ✓ (CSS animation, no lottie).
- `🎉 You're all set, [first name].`
- One-line recap derived from their primary goal answer. Examples:
  - "validate my topic" → *"Start with Step 1 — let's check if your idea is researchable."*
  - "defence practice" → *"Jump to Step 6 when you're ready to face the panel."*
  - skipped → *"Your 6-step workflow is ready."*
- **Soft plan line** (small, muted): *"You're on the free plan — unlock the 3-examiner defence panel whenever you're ready."* with a quiet link to `/pricing`.
- Primary CTA: green **"Enter FYPro"** button — navigates to walkthrough card (does NOT go to `/app` directly).

### 5.4 Walkthrough Card (Style C)
Replaces the congrats screen content with a crossfade (same dark full-bleed canvas, content swaps in place). Summarises FYPro in 3 bullet points:

```
✓  Validate your topic with real research
✓  Build chapters, methodology, and a writing schedule
✓  Face 3 AI examiners before your real panel
```

Two buttons:
- **"Take the tour"** (blue, primary) → opens the 4-slide carousel modal.
- **"Skip to my project"** (ghost, secondary) → `navigate('/app')`.

Choice is stored in `user_onboarding.walkthrough_seen_at` (timestamptz, set to `now()` on either choice) so the tour never re-appears on subsequent logins.

### 5.5 The 4-Slide Carousel
A full-screen modal carousel matching the approved design in `FYPro Product Tour.html` (already built). All slides use the premium iPhone frame style with real app UI mockups.

| Slide | Feature | Phone side | Eyebrow |
|-------|---------|-----------|---------|
| 1 | Topic Validator | Right | `STEP 1 · TOPIC VALIDATOR` |
| 2 | Chapter Architect & Methodology | Left | `STEPS 2–3 · STRUCTURE & METHOD` |
| 3 | Writing Planner | Right | `STEP 5 · WRITING PLANNER` |
| 4 | Defence Simulator | Left | `STEP 6 · DEFENCE SIMULATOR` |

Controls: 4 progress dots (active dot elongates), **Skip tour** (top right, always visible), **Next →** / **Finish ✓** (bottom right). Arrow keys + swipe also work (already in the HTML).

On Finish or Skip → `navigate('/app')`, set `sessionStorage.intentional_app_entry = 'true'`.

The carousel is extracted from the standalone HTML into a React component (`TourCarousel.jsx`) that renders as a full-screen overlay. The inline app-screen mockups (the mini UI inside each iPhone) are pure CSS/HTML — no images required.

---

## 6. Data Model

One migration. Adds nullable columns to `user_onboarding` — no new table, existing RLS policies (SELECT/INSERT/UPDATE own row) already cover all new columns.

**File:** `migrations/0032_onboarding_questions.sql`

```sql
ALTER TABLE public.user_onboarding
  ADD COLUMN IF NOT EXISTS referral_source        text,
  ADD COLUMN IF NOT EXISTS expected_defence_band  text
    CHECK (expected_defence_band IN ('<1m','1-3m','3-6m','unsure')),
  ADD COLUMN IF NOT EXISTS primary_goal           text
    CHECK (primary_goal IN ('validate_topic','build_chapters','plan_writing','defence_practice')),
  ADD COLUMN IF NOT EXISTS notify_email           boolean,
  ADD COLUMN IF NOT EXISTS notify_push            boolean,
  ADD COLUMN IF NOT EXISTS walkthrough_seen_at    timestamptz;
```

All columns nullable — a skipped question leaves its column NULL. No backfill needed for existing users.

Migration applied manually in Supabase SQL Editor before testing, per project convention. Verify after: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;` must return 0 rows.

---

## 7. What Each Answer Actually Does

| Answer | Stored where | Wired now | Wired later |
|--------|-------------|-----------|-------------|
| Attribution (`referral_source`) | `user_onboarding` | ✓ saved to DB | Admin dashboard display + referral correlation |
| Defence date (`expected_defence_band`) | `user_onboarding` | ✓ saved to DB | Writing Planner urgency + nurture email tone |
| Primary goal (`primary_goal`) | `user_onboarding` | ✓ saved + drives congrats copy | Deep-link to relevant step (future) |
| Email nudges (`notify_email`) | `user_onboarding` | ✓ saved (email_preferences already exist) | Nurture email targeting |
| Push (`notify_push`) | `user_onboarding` | ✓ triggers existing Web Push subscribe flow | — |
| Walkthrough choice (`walkthrough_seen_at`) | `user_onboarding` | ✓ prevents re-show | — |

The defence-date value is captured now but **not yet wired into the Writing Planner or cron** — that's a separate task. Capture now, wire later.

---

## 8. Files Changed

| File | Change |
|------|--------|
| `migrations/0032_onboarding_questions.sql` | New — adds 6 columns to `user_onboarding` |
| `src/lib/onboarding.ts` | Extend `fetchOrCreateOnboardingRow` to select new columns; add `saveOnboardingAnswers()` helper; add `markWalkthroughSeen()` |
| `src/pages/SplashOnboarding.jsx` | Add Steps 2–5, progress bar, congrats screen, walkthrough card; wire `saveOnboardingAnswers()` on submit |
| `src/features/onboarding/TourCarousel.jsx` | New — React port of `FYPro Product Tour.html`, rendered as full-screen overlay |
| `src/styles/onboarding-questions.css` | New — chip styles, progress bar, congrats screen, walkthrough card (`.oq-*` prefix). All design tokens, no hardcoded hex. |
| `src/index.css` | Add `@import './styles/onboarding-questions.css'` |

No changes to: `api/`, `ExpressOnboarding.jsx`, `AppContext.jsx`, routing, `vercel.json`.

---

## 9. CSS Prefix

`oq-` — Onboarding Questions. Appended to `src/styles/onboarding-questions.css`. Never mix with existing prefixes.

---

## 10. Error Handling & Edge Cases

- **Save failure on questions:** Don't block the user. Log the error, show no error UI, let them into the app. Same forgiving pattern as the existing profile save. Answers are nice-to-have data.
- **Push subscribe failure:** Silent — toggle stays off. Don't surface a permission error during onboarding.
- **Returning user in incognito:** The existing `onboarding_completed` metadata gate short-circuits — they bypass all of this and go to `/app`. No change.
- **User skips all questions:** All columns stay NULL. `saveOnboardingAnswers()` upserts whatever is non-null, which may be nothing — that's fine.
- **Tour re-render guard:** `walkthrough_seen_at IS NOT NULL` → never show the walkthrough card again. Checked client-side from the onboarding row fetched at load.
- **Notification opt-in timing:** Push subscribe only fires if the user explicitly toggles it on. Requesting browser permission during onboarding (before they've seen any value) is only done if they actively choose it.

---

## 11. Design Constraints (from CLAUDE.md + MASTER.md)

- All colours via CSS variables — zero hardcoded hex in component CSS.
- Fonts: `DM Serif Display` (headings), `Poppins` (body/chips/buttons), `JetBrains Mono` (eyebrow labels).
- No purple gradients. No white cards on plain grey.
- Chip selected state: blue border `var(--color-border-blue)` + subtle blue fill `var(--color-blue-glow)`.
- Progress bar uses `var(--color-blue-primary)`.
- Congrats "Enter FYPro" button: green `var(--color-green)` with green glow on hover.
- Implementation driven by `impeccable` or `ui-ux-pro-max` skill.

---

## 12. Out of Scope (Deferred)

- Deep-linking a user to their goal step based on `primary_goal` answer.
- Wiring `expected_defence_band` into the Writing Planner schedule or nurture cron.
- Live coach-mark spotlight tour (Style B) — noted as future upgrade, not built in v1.
- Surfacing attribution data in the admin dashboard.
- Porting the new questions to Express onboarding.
