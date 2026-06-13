# Defense Free Trial + Express Defense — Design Spec
**Date:** 2026-06-13  
**Status:** Approved for implementation

---

## 1. Overview

Two parallel features that open the Defense Simulator to users who currently cannot access it.

**Feature A — Free Trial (Persona 1)**  
A registered free user who has completed at least Step 1 (Topic Validator) gets 1 complete defense session — 5 questions, full score, full verdict — before hitting a paywall. The entry point on Step 6 sells the experience before they go in. Text-only (no voice). After the session ends, a second session is paywalled.

**Feature B — Express Defense (Persona 2)**  
A separate ₦2,000 product for students who already have a completed final year project and only need defense practice. Separate onboarding (mini-form), separate route (`/express`), 3-tool journey: Red Flag Scanner → Project Reviewer → Defense Simulator. Voice included. No workflow. No upgrade path.

**What stays unchanged:**  
- Defense Pack at ₦3,500 — full product, untouched  
- Existing workflow (Personas going through Steps 1–5) — untouched  
- All existing entitlement checks — extended, not replaced  
- Vercel serverless function count — stays at 12 (no new functions)

---

## 2. User Personas

### Persona 1 — Workflow User (Free Trial Target)
- Signed up for FYPro to build their project from scratch
- Has completed at least Step 1 (Topic Validator); ideally Steps 1–3
- Has never accessed the Defense Simulator
- Needs to understand what the Defense Simulator does before paying ₦3,500
- Conversion path: Free trial → Defense Pack (₦3,500)

### Persona 2 — Already-Done Student (Express Defense Target)
- Has a completed or near-complete final year project
- Came to FYPro specifically for defense practice — not for research guidance
- Has no need for the 5-step workflow
- High intent: knows they need this, deadline is imminent
- Conversion path: Direct purchase → Express Defense (₦2,000)
- No upgrade path — if they want the full product, they buy Defense Pack directly

---

## 3. Feature A — Free Trial (Persona 1)

### 3.1 Qualification Gate
- **Hard requirement:** `state.validatedTopic` must exist (Step 1 completed)
- **If Step 1 not done:** Step 6 shows a locked state with message: "Complete Step 1 (Topic Validator) first to unlock your free defence trial"
- **If Steps 2–3 not done:** Trial is still accessible, but the entry UI shows a nudge: "Complete your chapter structure and methodology for more targeted examiner questions" — not a blocker

### 3.2 Trial Tracking
No new Redis keys or database columns needed. The server checks the existing `defense_sessions` table:

```js
// In api/ai.js — before allowing a defense turn for a free user:
const { count } = await supabaseAdmin
  .from('defense_sessions')
  .select('id', { count: 'exact', head: true })
  .eq('user_id', user.id)
  .eq('status', 'completed')

const hasUsedTrial = count > 0
const hasPaidAccess = paidFeatures.includes('defense_pack') || paidFeatures.includes('express_defense')

if (!hasPaidAccess && hasUsedTrial) {
  return res.status(403).json({ error: 'FREE_TRIAL_USED' })
}
```

A session that starts but never completes (dropped connection, tab closed) does NOT consume the trial. The trial is consumed only when the session summary is called and the session row is marked `status = 'completed'`.

### 3.3 Step 6 Entry UI — The Sell Moment
When a free user lands on Step 6 and `hasUsedTrial = false`, replace the current locked state with a hero sell section:

```
THREE AI EXAMINERS. REAL QUESTIONS. YOUR WEAKNESSES IDENTIFIED LIVE.

This is what your actual defence will feel like — except you get 
to fail here, not in front of your supervisor.

[ Start Your Free Defence Session ]

What happens in your session:
✓ The Methodologist attacks your research design and sampling
✓ The Subject Expert demands citations and theoretical grounding  
✓ The External Examiner probes whether your conclusions are justified
✓ You receive a readiness score out of 10
✓ Your critical gaps are identified so you know exactly what to fix

Note: Voice is available with the Defence Pack. This session is text-only.
```

### 3.4 During the Session
- Text-only — ElevenLabs already gated on `defense_pack` (no change needed)
- Full 5 questions, full scoring, full verdict — identical to the paid experience
- Uses real `studentContext` from their completed steps
- `redFlags` not available (Red Flag Scanner is gated on `defense_pack`/`express_defense`) — the session runs without pre-scanned flags

### 3.5 Post-Session Paywall
After the session ends, score and verdict are shown in full. When they click "Start New Session" a paywall appears — not a generic upgrade prompt but one that references their actual result:

```
You scored [X]/10.

[Dynamically list 1–2 gaps the examiners identified]

Fix these gaps. Come back ready.

[ Unlock Defence Pack — ₦3,500 ]

What you unlock:
✓ Unlimited defence sessions (5/day)
✓ AI examiner voices — hear the hostility
✓ Red Flag Scanner — find weaknesses before the panel does
✓ Project Reviewer — full AI review of your submitted document
✓ Defence certificate if you score 7+
```

The `PaidFeatureGate` component handles this — it opens the Paystack inline popup directly for `defense_pack` at ₦3,500.

### 3.6 Server Changes — api/ai.js
The defense action handler currently blocks all non-`defense_pack` users at line 289. This becomes:

```js
const hasPaidAccess = paidFeatures.includes('defense_pack') || paidFeatures.includes('express_defense')

if (!hasPaidAccess) {
  // Check free trial eligibility
  const { count } = await supabaseAdmin
    .from('defense_sessions')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'completed')
  
  if (count > 0) {
    return res.status(403).json({ error: 'FREE_TRIAL_USED' })
  }
  // else: allow — this is their free trial session
}
```

The red-flag action remains gated on `defense_pack` OR `express_defense` — free trial users do not get the Red Flag Scanner.

---

## 4. Feature B — Express Defense (Persona 2)

### 4.1 Entry Point — Splash Onboarding Fork
`SplashOnboarding.jsx` adds a new question at the very beginning before any other onboarding step:

```
What stage are you at?

[ I'm starting my final year project and need research guidance ]
[ I already have a project — I just need defence practice ]
```

- First option → existing onboarding flow, unchanged
- Second option → Express onboarding flow

### 4.2 Express Onboarding — Mini-Form
New page: `src/pages/ExpressOnboarding.jsx`

Collects exactly the fields needed to populate `studentContext`:

| Field | Input Type |
|---|---|
| University | Dropdown (existing universities.js data) |
| Faculty | Dropdown |
| Department | Text |
| Level | 300 / 400 / 500 radio |
| Project Topic | Text (their actual topic — already finalised) |
| Methodology | Quantitative / Qualitative / Mixed Methods radio |
| Chapter count | Standard 5 chapters / Custom (number input) |

This maps directly to the existing `studentContext` shape in `AppContext.jsx`. No new data contract. The form data is stored as a project step (`step_name = 'express_brief'`) in the existing `project_steps` table.

### 4.3 Payment — Immediately After Mini-Form
After submitting the mini-form, before entering the app, the user sees the Express Defense purchase screen:

```
Your Express Defence Pack

✓ Red Flag Scanner — find your project's weaknesses before the panel does
✓ Project Reviewer — full AI review of your submitted document
✓ Defence Simulator — 3 AI examiners, voice-enabled, real hostile questions
✓ Defence certificate if you score 7+

₦2,000 — one-time payment

[ Pay ₦2,000 with Paystack ]
```

Uses the existing `usePaystackCheckout` hook. On payment success → `express_defense` added to `paid_features` → redirect to `/express`.

### 4.4 The `/express` Route
New files:
- `src/features/expressDefense/ExpressShell.jsx` — layout wrapper
- `src/features/expressDefense/ExpressBrief.jsx` — compact header showing their project summary (topic, methodology, faculty)

The shell uses the same design language as `AppShell.jsx` but with a simplified sidebar showing only 3 steps:

```
Sidebar:
  1. ○ Red Flag Scanner
  2. ○ Project Reviewer
  3. ○ Defence Simulator

[Project brief card showing their topic + methodology]
```

### 4.5 The 3-Tool Journey

**Tool 1 — Red Flag Scanner**  
Same `detectRedFlags()` API call. Uses `studentContext` from their mini-form. Identifies the 3 most dangerous weaknesses in their project. Results feed into the Defense Simulator as `redFlags`.

**Tool 2 — Project Reviewer**  
Same `/api/project-reviewer` endpoint. PDF upload (4MB cap, existing validation). Full review: strengths, weaknesses, examiner questions. Results stored as `uploadedReview` in state. This tool is optional — if skipped, Defense Simulator runs on form data + red flags only. If completed, examiners probe the actual document content.

**Tool 3 — Defense Simulator**  
Full experience. Voice enabled (`express_defense` added to `speak.js` entitlement check). Uses `studentContext` (from form) + `redFlags` (from Tool 1) + `uploadedReview` (from Tool 2 if completed). Same 5 sessions/day limit. Certificate unlocks at score ≥ 7/10.

### 4.6 Gamification for Persona 2
Same system, naturally filtered:
- Momentum Ring — defense sessions count as activity ✓
- Rank Pill — defense sessions contribute to rank ✓
- Defense Celebration — score 7+, full ceremony ✓
- Certificate — FYP-2026-XXXXXX, downloadable ✓
- Achievements — defense-specific achievements only (step-based ones simply never appear) ✓
- Notifications — unchanged ✓

Dashboard (`/dashboard`) is not the home for Persona 2 — `/express` is their home. If a Persona 2 user navigates to `/dashboard` directly, `App.jsx` detects `express_defense` in their entitlements (and absence of `student_pack`/`defense_pack`) and redirects to `/express`. Profile, Settings, Achievements, Certificates pages are all accessible as normal.

### 4.7 No Upgrade Path
`express_defense` holders who want the full product buy Defense Pack directly at ₦3,500. No partial upgrade SKU. The pricing page makes this clear.

---

## 5. Pricing Changes

### Updated Tier Structure

| Tier | Price (kobo) | Entitlement key | For |
|---|---|---|---|
| Student Pack | ₦2,000 (200,000) | `student_pack` | Workflow users |
| Express Defense | ₦2,000 (200,000) | `express_defense` | Already-done students |
| Defense Pack | ₦3,500 (350,000) | `defense_pack` | Full product |
| Defense Pack Upgrade | ₦1,500 (150,000) | — adds `defense_pack` | Student Pack → Defense Pack |
| Project Reset | ₦1,500 (150,000) | `project_reset` | New project slot |

### `api/_lib/pricing.js`
Add one entry:
```js
express_defense: { amount: 200000, label: 'Express Defence' }
```

### `payments` table — tier constraint
One migration to add `express_defense` to the check constraint:
```sql
ALTER TABLE payments 
DROP CONSTRAINT IF EXISTS payments_tier_check;

ALTER TABLE payments 
ADD CONSTRAINT payments_tier_check 
CHECK (tier IN ('student_pack','defense_pack','defense_pack_upgrade','project_reset','express_defense'));
```

### Pricing Page (`src/pages/Pricing.jsx`)
Three core tiers shown with persona framing. Student Pack and Express Defense both at ₦2,000 but clearly differentiated by use case. Defense Pack at ₦3,500 positioned as the complete experience.

### Landing Page (`src/pages/LandingPage.jsx`)
New section: "Already finished your project?" — below the existing hero. Short urgency copy, direct CTA to Express Defense purchase.

---

## 6. Full File Change List

### New Files
| File | Purpose |
|---|---|
| `src/pages/ExpressOnboarding.jsx` | Mini-form + payment trigger for Persona 2 |
| `src/features/expressDefense/ExpressShell.jsx` | `/express` route layout (3-tool sidebar) |
| `src/features/expressDefense/ExpressBrief.jsx` | Compact project summary header |
| `migrations/0029_express_defense_tier.sql` | Add `express_defense` to payments tier constraint |

### Modified Files
| File | Change |
|---|---|
| `src/pages/SplashOnboarding.jsx` | Add persona fork question at step 1 |
| `src/App.jsx` | Add `/express` and `/express-onboarding` routes |
| `src/pages/Pricing.jsx` | Add Express Defense tier |
| `src/pages/LandingPage.jsx` | Add "Already have a project?" section |
| `api/_lib/pricing.js` | Add `express_defense` SKU |
| `api/ai.js` | Free trial check + `express_defense` entitlement for defense + red-flag |
| `api/project-reviewer.js` | Add `express_defense` to entitlement check |
| `api/speak.js` | Add `express_defense` to entitlement check |
| `src/features/defensePrep/DefensePrep.jsx` | Free trial sell moment + post-session paywall |
| `src/context/AppContext.jsx` | Populate `studentContext` from express mini-form |

### No Changes To
- `vercel.json` — function count stays at 12
- `useRunLimit.js` — Express Defense limits mirror Defense Pack
- All RLS policies — existing policies cover Persona 2 rows
- `defense_sessions`, `defense_certificates`, `user_achievements` tables — unchanged

---

## 7. What This Is NOT

- Express Defense is not an upgrade path to Defense Pack — Persona 2 who wants the full product buys Defense Pack directly
- The free trial does not include the Red Flag Scanner or Project Reviewer — those stay gated on paid tiers
- The free trial does not include voice — ElevenLabs stays gated on `defense_pack` and `express_defense`
- Express Defense does not include the 5-step workflow — Persona 2 never touches Steps 1–5
- No new Vercel serverless functions — all changes extend existing endpoints

---

## 8. Key Decisions Made

| Decision | Reasoning |
|---|---|
| Free trial = 1 full session (not 3 questions mid-gate) | Score at end is the sales hook. No mid-session rug pull. |
| Trial tracked via `defense_sessions` table (not Redis) | Survives restarts, handles dropped connections gracefully |
| Express Defense = ₦2,000 (not ₦3,500) | Persona 2 gets no workflow features — ₦3,500 is a hard sell for 30% of the product |
| Voice included in Express Defense | Defense practice without voice is a lesser experience — Persona 2 deserves the real thing |
| No upgrade path from Express Defense | High-intent buyers who need the full product buy Defense Pack directly |
| Persona fork at splash onboarding | Catches Persona 2 at the earliest possible moment and routes them cleanly |
| Mini-form (not PDF-only) at onboarding | PDF upload belongs inside Project Reviewer, not onboarding. Keeps entry fast. |
| Reuse existing `projects` + `project_steps` tables | No schema changes beyond the tier constraint. Express brief = one project_steps row. |
