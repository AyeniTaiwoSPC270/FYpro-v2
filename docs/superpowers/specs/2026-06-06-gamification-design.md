# FYPro Gamification System — Design Spec
**Date:** 2026-06-06
**Status:** Approved for implementation

---

## Overview

Add a full gamification layer to FYPro covering three goals simultaneously:
- **Retention** — students return and progress rather than abandoning mid-workflow
- **Delight** — completing steps feels like a win, not a chore
- **Activation** — rewards drive specific behaviors: defense attempts, high scores, referrals

The system has four interlocking mechanics: Research Rank, Achievement System, Momentum Ring, and Celebration Moments.

---

## 1. Research Rank System

A persistent title that grows with the student. Displayed on the sidebar, dashboard header, and profile page. Rank maps 1:1 to step completions — simple and predictable.

### The 7 Ranks

| Rank | Emoji | Unlock Condition |
|---|---|---|
| Research Recruit | 🌱 | Signed up (default) |
| Topic Explorer | 🔍 | Step 1 (Topic Validator) complete |
| Chapter Architect | 📐 | Step 2 (Chapter Architect) complete |
| Methodology Strategist | ⚗️ | Step 3 (Methodology Advisor) complete |
| Research Scholar | 📝 | Step 4 (Writing Planner) complete |
| Defense Candidate | 📄 | Step 5 (Project Reviewer) complete |
| Certified Researcher | 🎓 | Step 6 (Defense Prep) complete + defense score ≥ 7 |

### Display Locations

**Sidebar rank pill** (under student name in AppShell):
- Rank emoji + title
- Progress bar to next rank
- "X steps to [next rank]" label
- Glows briefly when rank just changed (in-session only)

**Dashboard header:** rank title shown as a small badge next to student name.

**Profile page:** rank displayed prominently with unlock date.

### Implementation

- `useRank` hook — derives current rank from `useUserProgress` data (no new DB query, uses existing `user_progress` table)
- Rank is computed client-side from step completion timestamps
- No new DB column needed — rank is always derived, never stored

---

## 2. Achievement System

19 achievements across 4 categories rewarding *how* students work, separate from the 6 step badges which reward *that* they completed steps.

### Categories and Achievements

**Milestone (4)**
| Key | Name | Condition |
|---|---|---|
| `first_step` | First Step | Topic Validator completed |
| `halfway` | Halfway There | 3 of 6 steps completed |
| `defense_ready` | Defense Ready | All 6 steps + defense session run |
| `certified` | Certified | Defense certificate earned (score ≥ 7) |

**Speed (3)**
| Key | Name | Condition |
|---|---|---|
| `fast_starter` | Fast Starter | Step 1 completed within 1 hour of signup |
| `sprint` | Sprint | 3 steps completed in a single calendar day (WAT, UTC+1) |
| `speed_run` | Speed Run | All 6 steps completed within 7 days of signup |

**Effort (5)**
| Key | Name | Condition |
|---|---|---|
| `sharp_mind` | Sharp Mind | Defense score ≥ 8 |
| `excellence` | Excellence | Defense score ≥ 9 |
| `perfectionist` | Perfectionist | Defense score = 10 |
| `persistent` | Persistent | Defense Simulator run 3 times |
| `never_give_up` | Never Give Up | Defense run again after scoring < 7 |

**Social (4)**
| Key | Name | Condition |
|---|---|---|
| `ambassador` | Ambassador | First referral made |
| `connector` | Connector | 3 qualified referrals |
| `earned_it` | Earned It | First free defense session earned via referrals |
| `shared` | Shared | Defense certificate shared |

**Hidden (3) — description hidden until earned**
| Key | Name | Condition |
|---|---|---|
| `night_owl` | Night Owl | Step completed between midnight and 4 AM (local time) |
| `early_bird` | Early Bird | Step completed before 7 AM (local time) |
| `dedicated` | Dedicated | Meaningful action (step completion or defense run) on 5 distinct calendar days — checked via `project_steps.completed_at` and `defense_sessions.completed_at` dates |

### UI Placement

- Existing `BadgeRow` (6 step badges) gets a companion `AchievementsRow` below it on the dashboard — shows earned achievements as coloured chips, locked ones as greyed outlines
- Full grid at `/account/achievements` — 4 category sections, locked achievements shown as dim outlines with question marks for hidden ones until earned
- Toast fires immediately on earn: "Achievement unlocked — Ambassador 📣"
- Hidden achievements: shown as `?` cards until earned; description revealed on unlock

### Server-Side Achievement Validation

All achievement checking is server-side via a new route in the existing `api/ai.js` function:
- `action: 'check-achievements'` — receives user ID, checks all conditions using service-role Supabase client, writes newly earned achievements to `user_achievements` table
- Called after: step completion, defense session end, referral qualification, certificate share (frontend calls this endpoint after `share-card.js` returns successfully)
- Returns array of newly earned achievement keys
- Service-role write prevents client-side forgery

### New DB Table: `user_achievements`

```sql
CREATE TABLE user_achievements (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid REFERENCES users(id) ON DELETE CASCADE,
  achievement_key text NOT NULL,
  earned_at  timestamptz DEFAULT now(),
  UNIQUE (user_id, achievement_key)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Users can read their own achievements
CREATE POLICY "select own" ON user_achievements
  FOR SELECT USING (auth.uid() = user_id);

-- Service role writes only (no client INSERT)
```

---

## 3. Momentum Ring

A circular activity gauge on the dashboard showing meaningful actions in the last 7 rolling days. Not a streak — no punishment for gaps.

### States

| State | Fill | Color | Label |
|---|---|---|---|
| Cold | 0% | Grey | "Start your research journey" |
| Warming Up | 25% | Amber `#F59E0B` | "Building momentum" |
| On Track | 50% | Blue `#3B82F6` | "Strong focus" |
| Peak Focus | 75–100% | Green `#16A34A` | "You're unstoppable 🔥" |

### What Counts as an Action (+25% each, max 100%)

1. Completing a workflow step
2. Running a Defense Simulator session
3. A referral qualifying (friend validates topic)
4. Sharing a defense certificate

### Rolling Window

Actions older than 7 days fall off automatically. The ring reflects the current week only. No streaks, no guilt.

### Dashboard Layout

Ring sits in a card on the dashboard alongside a mini activity feed — the last 4 actions that contributed to the ring, with timestamps. Empty slots show "Complete a step to add momentum."

### Implementation

- `useMomentum` hook — queries `project_steps`, `defense_sessions`, `referrals` filtered to `created_at > now() - interval '7 days'`, computes percentage client-side
- SVG `<circle>` with `stroke-dasharray` for the ring — no third-party chart library
- No new DB table — derived entirely from existing tables

---

## 4. Celebration Moments

Three tiers scaled to milestone weight.

### Tier 1 — Toast (Subtle)

**Triggers:** achievement unlocked, rank level up, momentum ring hits a new state for the first time

**Behaviour:** slides in from top-right, auto-dismisses after 4 seconds. Uses existing `Toast` component — no new infrastructure.

### Tier 2 — Confetti Modal (Medium)

**Triggers:**
- Step badge earned (first time completing any step)
- Hidden achievement revealed
- First defense session completed (any score)
- Momentum ring hits Peak Focus (100%) for the first time ever

**Behaviour:** overlays current screen, confetti rains for 2.5 seconds, shows new rank title if it changed, CTA continues to next step.

**Component:** `<CelebrationModal>` — new reusable component in `src/components/celebration/`.

### Tier 3 — Full-Screen Moment (Maximum)

**Triggers:**
- Defense Ready badge earned (all 6 steps + defense session run)
- Defense Certificate unlocked (score ≥ 7)

**Behaviour:** takes over full viewport. Blue radial glow background, animated concentric ring pulses, confetti. Three CTAs: Download Certificate, Share on WhatsApp, View all badges.

**Component:** `<DefenseCelebration>` — full-screen overlay, sits inside `DefensePrep.jsx` already.

### Celebration State (No Re-fires)

`localStorage` key `fypro_celebrations_seen` stores a JSON array of celebration keys already shown. Prevents the same celebration re-firing on page refresh. Resets if localStorage is cleared (acceptable — student sees it again, not harmful).

---

## 5. New Components and Hooks

| Item | Type | Location |
|---|---|---|
| `useRank` | Hook | `src/hooks/useRank.ts` |
| `useMomentum` | Hook | `src/hooks/useMomentum.ts` |
| `useAchievements` | Hook | `src/hooks/useAchievements.ts` |
| `RankPill` | Component | `src/components/rank/RankPill.jsx` |
| `AchievementsRow` | Component | `src/components/badges/AchievementsRow.jsx` |
| `MomentumRing` | Component | `src/components/momentum/MomentumRing.jsx` |
| `CelebrationModal` | Component | `src/components/celebration/CelebrationModal.jsx` |
| `DefenseCelebration` | Component | `src/components/celebration/DefenseCelebration.jsx` |
| `/account/achievements` | Page | `src/pages/account/Achievements.jsx` |
| `action=check-achievements` | API route | Added to `api/ai.js` |

---

## 6. Architecture Constraints

- **No new serverless function** — achievement validation added as a route inside existing `api/ai.js` (stays within 12-function Hobby plan limit)
- **No new DB tables except `user_achievements`** — rank and momentum derived from existing tables
- **Service-role writes for achievements** — prevents client-side forgery; uses existing service-role client in `api/ai.js`
- **Celebration state in localStorage** — no DB column needed for "has seen" state
- **No third-party libraries** — SVG ring rendered with `<circle stroke-dasharray>`, confetti with a small hand-rolled canvas burst or CSS animation

---

## 7. Out of Scope

- Leaderboards or comparison against other students
- Defense score personal-best tracking (score is surfaced better via UI improvements to DefensePrep, not a new system)
- Streak system (replaced by Momentum Ring which has no punishment mechanics)
- Push notifications for achievement unlocks (PWA notifications already exist and can be extended separately)
- Admin visibility into per-student achievement data (admin dashboard deferred)
