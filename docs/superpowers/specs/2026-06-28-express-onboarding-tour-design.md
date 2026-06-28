# Express Defence — Unique Onboarding Content & Tour Carousel

**Date:** 2026-06-28
**Status:** Approved

---

## Problem

Express Defence shares onboarding chip question content with the standard 6-step workflow, and has no TourCarousel at all. This makes Express feel like a reskin of standard FYPro rather than its own product. Express users are near-term, high-stakes, and already have a completed project — they need different framing, different urgency, and a tour that explains their specific 3-step flow.

---

## Scope

Four files change. No new files, no migrations, no new API endpoints.

| File | Change |
|------|--------|
| `src/features/onboarding/TourCarousel.jsx` | Add `variant="express"` prop rendering 3 Express slides |
| `src/pages/ExpressOnboarding.jsx` | Update content of 3 chip screens |
| `src/pages/ExpressDashboard.jsx` | Add "Quick look at Express Defence?" prompt on first load |
| `localStorage` | `fypro_express_tour_seen` key tracks whether user has seen the tour |

---

## 1. TourCarousel — `variant="express"`

### Approach
Add a single `variant` prop (default: `"standard"`). When `variant="express"`:
- `TOTAL` = 3 (not 4)
- `GLOW_X_PCT` = `[72, 28, 72]` (phone right, left, right)
- Slide content switches to 3 Express-specific slides
- All shell logic unchanged: keyboard nav, touch swipe, dot nav, exit animation, `Phone` component

### Caller
```jsx
<TourCarousel variant="express" onClose={handleTourClose} />
```

### Express Slides

**Slide 1 — Project Reviewer** (phone RIGHT, text LEFT)
- Eyebrow: `STEP 1 · PROJECT REVIEWER`
- Headline: `Submit your project. Get the review your supervisor never gave you.`
- Steps:
  1. Upload your dissertation — PDF, DOCX, or TXT
  2. Get an AI verdict on your methodology, gaps, and argument structure
  3. Your examiners will raise these. Know them first.
- Phone mockup: Express sidebar (vertical step-indicator column, Step 1 active), upload dropzone, "Review My Project" CTA, sample result showing Distinction 74% score + strength cards

**Slide 2 — Defence Brief** (phone LEFT, text RIGHT)
- Eyebrow: `STEP 2 · DEFENCE BRIEF`
- Headline: `Your personal war brief. Built from your review.`
- Steps:
  1. Get a personalised opening statement ready to deliver
  2. Model answers for every weak spot the AI found
  3. Download your brief as a PDF before you walk in
- Phone mockup: Express sidebar (Step 2 active), Defence Brief with opening statement section, Critical/Serious weak spot cards with model answers, "🎙 Coach me on this" button, green "↓ Download PDF" button

**Slide 3 — Defence Simulator** (phone RIGHT, text LEFT)
- Eyebrow: `STEP 3 · DEFENCE SIMULATOR`
- Headline: `Three examiners. Live questions. No mercy.`
- Steps:
  1. Face hostile questions from three AI examiner personas, by voice or text
  2. Get scored on every turn as they probe your gaps
  3. Score 7/10+ to unlock your downloadable defence certificate
- Phone mockup: Dark tribunal UI (`#060E18`), "DEFENCE EXAMINATION PANEL" header, Q1 of 5 progress bars, The Methodologist question bubble, answer text area, Send Answer button

### Source
All 3 phone mockup designs come from `FYPro Express Defence Tour.html` (Claude Design output, 2026-06-28). The JSX conversion is a direct inline-style translation of that file — no visual changes.

---

## 2. ExpressOnboarding — Chip Screen Content

### Attribution screen
| Field | Before | After |
|-------|--------|-------|
| Eyebrow | `HOW DID YOU HEAR ABOUT US?` | `HOW DID YOU FIND EXPRESS DEFENCE?` |
| Heading | `How did you find FYPro?` | `How did you hear about Express Defence?` |
| Options | unchanged | unchanged |

### Defence-date screen
| Field | Before | After |
|-------|--------|-------|
| Eyebrow | `WHEN'S YOUR DEFENCE?` | `HOW SOON IS YOUR DEFENCE?` |
| Heading | `When are you defending?` | `When are you walking in?` |
| Options (display) | Within 1 month / 1–3 months / 3–6 months / Not sure yet | This week / Within 2 weeks / 1 month away / More than a month |
| Values (stored) | `<1m` / `1-3m` / `3-6m` / `unsure` | `<1m` / `<1m` / `<1m` / `1-3m` |

**DB constraint note:** `user_onboarding.expected_defence_band` has a `CHECK IN ('<1m','1-3m','3-6m','unsure')` constraint. The Express options use Express-specific display labels but map to existing valid DB values — no migration required. The granularity lives in the UI; the DB just needs a valid value.

Rationale: Express users cluster near-term. The standard options (3–6 months, not sure) describe a planning mindset. Express users are cramming, not planning.

### Notifications screen
| Field | Before | After |
|-------|--------|-------|
| Email description | `Defence tips and reminders by email` | `Defence prep tips and countdown reminders by email` |
| Push description | `Get nudges on this device` | `Get nudges on this device as your defence approaches` |

The heading ("Want reminders?") and eyebrow ("STAY ON TRACK") stay the same.

---

## 3. ExpressDashboard — Walkthrough Prompt

### Placement
Rendered on first `/express` load, after the dashboard mounts. Shown as a modal overlay (same `wt2-screen` CSS class as the standard walkthrough).

### Seen state
```js
// Check on mount
const seen = localStorage.getItem('fypro_express_tour_seen')

// Set when dismissed (tour taken or skipped)
localStorage.setItem('fypro_express_tour_seen', '1')
```

No migration needed. No new DB column. Standard users who also buy Express will see the prompt (they know standard FYPro but still need orientation to the 3-step Express flow).

### Prompt content
```
[Shield icon]
Express Defence awaits

Quick look at how it works?

✓ Upload your project document for a full AI review
✓ Get your personalised Defence Brief with model answers
✓ Face 3 AI examiners in the Defence Simulator

[Take the tour →]   [Skip to my dashboard]
```

### Tour flow
- "Take the tour →" → sets seen flag → opens `<TourCarousel variant="express" />`
- "Skip to my dashboard" → sets seen flag → dismisses prompt
- TourCarousel `onClose` → prompt already dismissed, user is on dashboard

---

## 4. What Does NOT Change

- Visual design of any screen (split-canvas shell, chip layout, TourCarousel frame)
- Standard onboarding (`SplashOnboarding.jsx`) — untouched
- Standard `TourCarousel` default behaviour — untouched
- `walkthrough_seen_at` DB column — not used for Express tour (localStorage only)
- `saveOnboardingAnswers()` call in ExpressOnboarding — unchanged, `primary_goal` still hardcoded to `defence_practice`
- The defence-date values stored to `user_onboarding.expected_defence_band` — display labels are Express-specific but stored values map to existing CHECK constraint values (`<1m`, `1-3m`) — no migration needed

---

## Implementation Notes

- The `Phone` component in `TourCarousel.jsx` is reused as-is for Express slides
- Express slide JSX is a direct conversion of `FYPro Express Defence Tour.html` inline styles to React inline style objects — no new CSS classes
- The `wt2-screen` CSS in `src/styles/onboarding-questions.css` is reused for the prompt modal — no new CSS needed
- Test: a user who completed standard onboarding (has `walkthrough_seen_at` set) and then buys Express should still see the Express prompt (`localStorage` key is separate)
