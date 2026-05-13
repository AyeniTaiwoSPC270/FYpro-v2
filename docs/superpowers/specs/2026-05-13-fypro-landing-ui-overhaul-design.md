# FYPro Landing Page UI Overhaul — Design Spec
**Date:** 2026-05-13
**Scope:** LandingPage.jsx — from 6.5/10 to 10/10
**Approach:** Hero rebuild + all bug fixes + urgency signals

---

## Overview

The landing page has three categories of problems:
1. **Invisible content** — the hero mockup doesn't render (IntersectionObserver doesn't fire in cold view)
2. **Bug fixes** — wrong border colors on feature cards, dead gaps in How It Works and FAQ
3. **Missing urgency** — the page has no sustained pressure beyond the hero headline

This spec covers all three. No new pages, no new routes, no new API endpoints. Changes are entirely within `src/pages/LandingPage.jsx`.

---

## Section 1 — Hero Mockup Rebuild

### Problem
`HeroMockup` uses `useReveal()` (IntersectionObserver). The observer doesn't fire when the element is already in the viewport on load, making the mockup invisible to many visitors — and to all screenshots/crawlers.

### Solution
Rebuild `HeroMockup` as a fully static component (no Reveal wrapper, no useReveal). The mockup always renders. The richness of the content creates the impression of motion without requiring an observer.

### Content: "Student is under fire right now"
The mockup captures **Step 6 — Defense Simulator, mid-session**. The student has just been asked a hard question. The panel is live.

**Elements:**
- Chrome bar: `www.fypro.com.ng — Step 6: Defense Simulator` + red LIVE SESSION pill badge (pulsing dot)
- Sidebar: 6 steps, first 5 with green checkmarks, Step 6 "Defense Simulator" active with blue left border
- Content header: `Step 6 of 6 — Defense Prep` / `Three-Examiner Panel Simulation`
- Timer bar: animated drain from 90% → 15% (8s linear loop), red fill, `⏱ 01:23 remaining` label
- Examiner grid (3 columns):
  - The Methodologist — ASKING NOW — blue glow border, typing indicator (3 animated dots)
  - Subject Expert — WAITING — dimmed to 50% opacity
  - Ext. Examiner — WATCHING — dimmed to 50% opacity
- Vulnerabilities panel: red-tinted box, 3 bullet points of research gaps
- Footer chips: `Readiness Score: 71/100` (green) + `4 questions remaining` (blue)

**CSS animations used:**
- `pulse-red` on LIVE dot: 1.4s ease-in-out infinite, opacity + box-shadow
- `drain` on timer fill: 8s linear infinite, width 90% → 15%
- `blink` on typing dots: staggered 1.2s ease-in-out

---

## Section 2 — Bug Fixes

### Fix 01 — Feature Card Border Colors
**File:** `LandingPage.jsx` — `FEAT_COLOR_MAP` object  
**Bug:** All 6 entries have `border: '#0066FF'`. Step colors are defined but not wired up.  
**Fix:** Map each step to its correct color:
- Step 1 (Topic Validator): `#0066FF` blue
- Step 2 (Chapter Architect): `#16A34A` green
- Step 3 (Methodology Advisor): `#F59E0B` amber
- Step 4 (Instrument Builder): `#0066FF` blue
- Step 5 (Writing Planner): `#16A34A` green
- Step 6 (Defense Prep): `#DC2626` red

The `icon` background and `kicker` color should follow the same mapping.

### Fix 02 — How It Works Dead Gap
**File:** `LandingPage.jsx` — `HowItWorks` component  
**Bug:** ~150px dead space between section heading and Step 01. Caused by `mb-[60px]` on the subtitle.  
**Fix:** Change `mb-[60px]` → `mb-[28px]` on the subtitle element.

### Fix 03 — FAQ Dead Space + Container
**File:** `LandingPage.jsx` — `LandingFAQSection` component  
**Bug:** FAQ questions float on a black background with ~300px of empty space below.  
**Fix:**
- Wrap FAQ list in a styled card container: dark gradient background, rounded corners, border
- Add a section kicker `Common Questions` above the FAQ title inside the container
- Remove padding-bottom that creates dead space below the last item

---

## Section 3 — Urgency Signals

### Signal 01 — Hero CTA Nudge
**Location:** Under the two hero CTA buttons  
**Add:** One line — red pulsing dot + monospace text:  
`Most students start 3 weeks before their defense. The earlier, the better.`  
No counter (requires API). Quiet, persistent, not aggressive.

### Signal 02 — Stats Bar
**Location:** `StatsSection` — fourth stat  
**Change:** Replace `₦1B+ market` (investor-facing, meaningless to students) with:  
- Number: `1 in 3`
- Label: `Students asked to repeat their defense due to poor preparation`
- Styling: red tint on both number and label to distinguish it from the neutral three

### Signal 03 — Final CTA Copy
**Location:** `FinalCTA` component  
**Changes:**
- Headline: `Your defense is coming.` → `Your defense is coming. Are you actually ready?`
- Subtext: Add: `Most students who fail their defense say the same thing: "I thought I was prepared."`
- Below subtext: Add a live student counter nudge (same red dot + monospace text): `Join students currently using FYPro to prepare`
- CTA button: Keep `Start Free — No Sign Up`

---

## Implementation Constraints

- All changes in `src/pages/LandingPage.jsx` only
- No new files, no new components files, no new routes
- CSS animations added inline (keyframes in a `<style>` tag or Tailwind `animate-*` classes where available)
- No Framer Motion additions — the mockup is purely CSS-animated
- All colors use existing CSS variables from MASTER.md (no hardcoded hex)
- Mobile: mockup collapses to a simplified view at `md:` breakpoint (sidebar hides, grid stacks)

---

## Success Criteria

- Hero mockup is always visible on page load, no scroll required
- Feature cards each show a distinct left-border color matching their step identity
- How It Works section has no visible gap between heading and Step 01
- FAQ is contained in a card, no dead space below
- Urgency nudge is visible under hero CTAs
- Stats bar fourth stat reads "1 in 3 students..."
- Final CTA includes the failure-framed subtext
