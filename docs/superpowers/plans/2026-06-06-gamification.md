# Gamification System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Research Rank, Achievement System, Momentum Ring, and Celebration Moments to FYPro.

**Architecture:** All rank and momentum data is derived client-side from existing Supabase tables (no new DB tables for those). Achievements are validated server-side inside the existing `api/ai.js` function via a new `check-achievements` action, then written to a new `user_achievements` table using the service-role client. Celebration state (which modals have been seen) is persisted in localStorage to prevent re-fires on reload.

**Tech Stack:** React, TypeScript (hooks), JSX (components), Framer Motion (already installed), Supabase client (`src/lib/supabase.ts`), existing `showToast` from `src/components/Toast.jsx`, existing `supabaseAdmin` from `api/_lib/supabase-admin.js`.

---

## File Map

**New files:**
- `migrations/0015_user_achievements.sql` — DB table + RLS
- `src/hooks/useRank.ts` — derives rank from user_progress
- `src/hooks/useMomentum.ts` — computes 7-day activity ring
- `src/hooks/useAchievements.ts` — loads earned achievements from DB
- `src/lib/celebrations.ts` — localStorage helpers for seen-celebration state
- `src/lib/checkAchievements.ts` — frontend helper that calls `/api/ai?action=check-achievements`
- `src/components/rank/RankPill.jsx` — sidebar rank card
- `src/components/momentum/MomentumRing.jsx` — SVG ring + mini feed card
- `src/components/badges/AchievementsRow.jsx` — compact earned-achievements strip on dashboard
- `src/components/celebration/CelebrationModal.jsx` — Tier 2 confetti modal
- `src/components/celebration/DefenseCelebration.jsx` — Tier 3 full-screen moment
- `src/pages/account/Achievements.jsx` — full `/account/achievements` grid page

**Modified files:**
- `api/ai.js` — add `handleCheckAchievements` + route
- `src/App.jsx` — add `/account/achievements` route
- `src/features/shell/AppShell.jsx` — add `RankPill` below sidebar context card, add Achievements nav button
- `src/features/defensePrep/DefensePrep.jsx` — wire `DefenseCelebration` + call `checkAchievements` after session ends
- `src/features/topicValidator/TopicValidator.jsx` — call `checkAchievements` after step completes
- `src/features/chapterArchitect/ChapterArchitect.jsx` — call `checkAchievements` after step completes
- `src/features/methodology/MethodologyAdvisor.jsx` — call `checkAchievements` after step completes
- `src/features/writingPlanner/WritingPlanner.jsx` — call `checkAchievements` after step completes
- `src/features/projectReviewer/ProjectReviewer.jsx` — call `checkAchievements` after step completes
- `src/pages/Dashboard.jsx` — add `MomentumRing` + `AchievementsRow`

---

## Task 1: DB Migration — `user_achievements` table

**Files:**
- Create: `migrations/0015_user_achievements.sql`

- [ ] **Step 1: Write the migration file**

```sql
-- migrations/0015_user_achievements.sql

CREATE TABLE IF NOT EXISTS user_achievements (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  achievement_key text NOT NULL,
  earned_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_key)
);

ALTER TABLE user_achievements ENABLE ROW LEVEL SECURITY;

-- Users can read their own achievements only
CREATE POLICY "user_achievements_select_own"
  ON user_achievements
  FOR SELECT
  USING (auth.uid() = user_id);

-- No client INSERT/UPDATE/DELETE — service role writes only
```

- [ ] **Step 2: Run in Supabase SQL Editor**

Open the Supabase dashboard → SQL Editor → paste the file contents → Run.

- [ ] **Step 3: Verify RLS is on and table exists**

Run this in the SQL Editor:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public' AND tablename = 'user_achievements';
```
Expected: one row with `rowsecurity = true`.

- [ ] **Step 4: Commit**

```bash
git add migrations/0015_user_achievements.sql
git commit -m "feat: add user_achievements table with RLS"
```

---

## Task 2: `useRank` hook

**Files:**
- Create: `src/hooks/useRank.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useRank.ts
import { useEffect, useMemo, useState } from 'react'
import { useUserProgress } from './useUserProgress'
import { supabase } from '../lib/supabase'
import { useUser } from './useUser'

export interface RankInfo {
  index: number
  key: string
  label: string
  emoji: string
  color: string
  nextLabel: string | null
  progressPct: number // 0-100, overall steps progress
}

export const RANKS: RankInfo[] = [
  { index: 0, key: 'recruit',    label: 'Research Recruit',      emoji: '🌱', color: '#6B7280', nextLabel: 'Topic Explorer',         progressPct: 0   },
  { index: 1, key: 'explorer',   label: 'Topic Explorer',         emoji: '🔍', color: '#3B82F6', nextLabel: 'Chapter Architect',      progressPct: 17  },
  { index: 2, key: 'architect',  label: 'Chapter Architect',      emoji: '📐', color: '#8B5CF6', nextLabel: 'Methodology Strategist', progressPct: 33  },
  { index: 3, key: 'strategist', label: 'Methodology Strategist', emoji: '⚗️',  color: '#06B6D4', nextLabel: 'Research Scholar',       progressPct: 50  },
  { index: 4, key: 'scholar',    label: 'Research Scholar',       emoji: '📝', color: '#F59E0B', nextLabel: 'Defense Candidate',      progressPct: 67  },
  { index: 5, key: 'candidate',  label: 'Defense Candidate',      emoji: '📄', color: '#10B981', nextLabel: 'Certified Researcher',   progressPct: 83  },
  { index: 6, key: 'certified',  label: 'Certified Researcher',   emoji: '🎓', color: '#0066FF', nextLabel: null,                     progressPct: 100 },
]

const STEP_KEYS = [
  'topic_validator_completed_at',
  'chapter_architect_completed_at',
  'methodology_advisor_completed_at',
  'writing_planner_completed_at',
  'project_reviewer_completed_at',
  'defense_prep_completed_at',
] as const

export function useRank() {
  const { progress, loading: progressLoading } = useUserProgress()
  const { user } = useUser()
  const [hasCertificate, setHasCertificate] = useState(false)
  const [certLoading, setCertLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) { setCertLoading(false); return }
    supabase
      .from('defense_certificates')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .then(({ data }) => {
        setHasCertificate((data ?? []).length > 0)
        setCertLoading(false)
      })
      .catch(() => setCertLoading(false))
  }, [user?.id])

  const rank = useMemo((): RankInfo => {
    const completedCount = STEP_KEYS.filter(k => Boolean(progress[k])).length
    // Certified Researcher requires all 6 steps + a passing certificate
    let index = completedCount
    if (index === 6 && !hasCertificate) index = 5
    index = Math.min(index, 6)
    return RANKS[index]
  }, [progress, hasCertificate])

  return { rank, loading: progressLoading || certLoading }
}
```

- [ ] **Step 2: Verify it builds**

```bash
npx tsc --noEmit
```
Expected: no errors related to `useRank.ts`.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useRank.ts
git commit -m "feat: add useRank hook deriving rank from user_progress"
```

---

## Task 3: `RankPill` component

**Files:**
- Create: `src/components/rank/RankPill.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/rank/RankPill.jsx
import { useEffect, useRef } from 'react'
import { useRank } from '../../hooks/useRank'
import { useTheme } from '../../context/ThemeContext'

export default function RankPill() {
  const { rank, loading } = useRank()
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const prevKeyRef = useRef(rank.key)

  // Detect rank change in this session for the glow effect
  const justChangedRef = useRef(false)
  useEffect(() => {
    if (!loading && prevKeyRef.current !== rank.key) {
      justChangedRef.current = true
      prevKeyRef.current = rank.key
      const t = setTimeout(() => { justChangedRef.current = false }, 3000)
      return () => clearTimeout(t)
    }
  }, [rank.key, loading])

  if (loading) return (
    <div style={{
      height: 72, borderRadius: 10,
      background: isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
      margin: '0 0 8px',
    }} />
  )

  const glowColor = rank.color + '40'

  return (
    <div style={{
      background: isDark
        ? `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)`
        : `linear-gradient(135deg, #f8faff 0%, #f0f4ff 100%)`,
      border: `1px solid ${rank.color}40`,
      borderRadius: 10,
      padding: '10px 12px',
      marginBottom: 8,
      boxShadow: justChangedRef.current ? `0 0 16px ${glowColor}` : 'none',
      transition: 'box-shadow 0.4s ease',
    }}>
      {/* Label */}
      <p style={{
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: '0.58rem',
        fontWeight: 600,
        textTransform: 'uppercase',
        letterSpacing: '0.1em',
        color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.45)',
        margin: '0 0 4px',
      }}>
        Research Rank
      </p>

      {/* Rank name row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={{ fontSize: '1rem' }}>{rank.emoji}</span>
        <span style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.82rem',
          fontWeight: 700,
          color: isDark ? '#fff' : '#0D1B2A',
        }}>
          {rank.label}
        </span>
      </div>

      {/* Progress bar */}
      <div style={{
        height: 4,
        background: isDark ? 'rgba(255,255,255,0.08)' : 'rgba(13,27,42,0.08)',
        borderRadius: 999,
        overflow: 'hidden',
        marginBottom: 5,
      }}>
        <div style={{
          height: '100%',
          width: `${rank.progressPct}%`,
          background: rank.color,
          borderRadius: 999,
          transition: 'width 0.6s cubic-bezier(0.22,1,0.36,1)',
          boxShadow: `0 0 6px ${glowColor}`,
        }} />
      </div>

      {/* Next rank label */}
      {rank.nextLabel ? (
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.6rem',
          color: isDark ? 'rgba(255,255,255,0.35)' : 'rgba(13,27,42,0.4)',
          margin: 0,
        }}>
          1 step to {rank.nextLabel}
        </p>
      ) : (
        <p style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.6rem',
          color: rank.color,
          fontWeight: 700,
          margin: 0,
        }}>
          MAX RANK ✓
        </p>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify no TypeScript errors**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/components/rank/RankPill.jsx
git commit -m "feat: add RankPill sidebar component"
```

---

## Task 4: Wire `RankPill` into `AppShell` sidebar

**Files:**
- Modify: `src/features/shell/AppShell.jsx`

- [ ] **Step 1: Add the import at the top of AppShell.jsx** (after existing imports)

```jsx
import RankPill from '../../components/rank/RankPill'
```

- [ ] **Step 2: Insert `RankPill` after the sidebar context card**

Find this block in AppShell.jsx:
```jsx
        {/* Student context card */}
        <div className="sidebar__context-card">
```

Insert `<RankPill />` immediately after the closing `</div>` of `sidebar__context-card`:

```jsx
        {/* Student context card */}
        <div className="sidebar__context-card">
          <p className="context-card__item context-card__item--university">{state.university}</p>
          <p className="context-card__item context-card__item--faculty">{state.faculty}</p>
          <p className="context-card__item context-card__item--department">{state.department}</p>
          <p className="context-card__item context-card__item--level">Level {state.level}</p>
          <p className="context-card__item context-card__item--topic">
            {state.validatedTopic || state.roughTopic}
          </p>
        </div>

        {/* Research Rank */}
        <div style={{ padding: '0 12px' }}>
          <RankPill />
        </div>
```

- [ ] **Step 3: Add Achievements nav button** in the sidebar bonus section, after the "My Certificates" button block:

```jsx
        {/* Achievements */}
        <div className="sidebar__bonus" style={{ marginTop: 8 }}>
          <button
            className="sidebar__bonus-btn"
            onClick={() => navigate('/account/achievements')}
          >
            🏅 Achievements
          </button>
        </div>
```

- [ ] **Step 4: Start dev server and verify**

```bash
npm run dev
```

Open http://localhost:5173/app — confirm the RankPill appears below the student context card in the sidebar. Confirm rank title and progress bar render correctly.

- [ ] **Step 5: Commit**

```bash
git add src/features/shell/AppShell.jsx
git commit -m "feat: wire RankPill and Achievements nav into AppShell sidebar"
```

---

## Task 5: `useMomentum` hook

**Files:**
- Create: `src/hooks/useMomentum.ts`

- [ ] **Step 1: Create the hook**

```typescript
// src/hooks/useMomentum.ts
import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from './useUser'

export interface MomentumAction {
  label: string
  timestamp: string
  type: 'step' | 'defense' | 'referral'
}

export interface MomentumData {
  pct: number          // 0, 25, 50, 75, or 100
  state: 'cold' | 'warming' | 'on_track' | 'peak'
  label: string
  color: string
  actions: MomentumAction[]
  loading: boolean
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

function classifyPct(pct: number): Pick<MomentumData, 'state' | 'label' | 'color'> {
  if (pct === 0)   return { state: 'cold',     label: 'Start your research journey', color: '#6B7280' }
  if (pct <= 25)   return { state: 'warming',  label: 'Building momentum',           color: '#F59E0B' }
  if (pct <= 75)   return { state: 'on_track', label: 'Strong focus',                color: '#3B82F6' }
  return               { state: 'peak',     label: "You're unstoppable 🔥",        color: '#16A34A' }
}

const STEP_LABEL: Record<string, string> = {
  topic_validator:    'Completed Topic Validator',
  chapter_architect:  'Completed Chapter Architect',
  methodology_advisor:'Completed Methodology Advisor',
  writing_planner:    'Completed Writing Planner',
  project_reviewer:   'Completed Project Reviewer',
  defense_prep:       'Completed Defense Prep',
}

export function useMomentum(): MomentumData {
  const { user } = useUser()
  const [data, setData] = useState<MomentumData>({
    pct: 0, ...classifyPct(0), actions: [], loading: true,
  })

  useEffect(() => {
    if (!user?.id) { setData(d => ({ ...d, loading: false })); return }

    const since = new Date(Date.now() - SEVEN_DAYS_MS).toISOString()

    async function load() {
      const [{ data: steps }, { data: defSessions }, { data: referrals }] = await Promise.all([
        supabase
          .from('project_steps')
          .select('step_name, completed_at')
          .eq('user_id', user!.id)
          .gte('completed_at', since)
          .order('completed_at', { ascending: false }),
        supabase
          .from('defense_sessions')
          .select('completed_at')
          .eq('user_id', user!.id)
          .gte('completed_at', since)
          .not('completed_at', 'is', null)
          .order('completed_at', { ascending: false }),
        supabase
          .from('referrals')
          .select('created_at')
          .eq('referrer_user_id', user!.id)
          .in('status', ['qualified', 'rewarded'])
          .gte('created_at', since)
          .order('created_at', { ascending: false }),
      ])

      const actions: MomentumAction[] = []

      for (const s of (steps ?? [])) {
        actions.push({
          label: STEP_LABEL[s.step_name] ?? `Completed ${s.step_name}`,
          timestamp: s.completed_at,
          type: 'step',
        })
      }
      for (const d of (defSessions ?? [])) {
        actions.push({ label: 'Ran Defense Simulator', timestamp: d.completed_at!, type: 'defense' })
      }
      for (const r of (referrals ?? [])) {
        actions.push({ label: 'Referral qualified', timestamp: r.created_at, type: 'referral' })
      }

      actions.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

      const actionCount = Math.min(actions.length, 4)
      const pct = actionCount * 25

      setData({ pct, ...classifyPct(pct), actions: actions.slice(0, 4), loading: false })
    }

    load().catch(() => setData(d => ({ ...d, loading: false })))
  }, [user?.id])

  return data
}
```

- [ ] **Step 2: Verify types**

```bash
npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
git add src/hooks/useMomentum.ts
git commit -m "feat: add useMomentum hook for 7-day activity ring"
```

---

## Task 6: `MomentumRing` component

**Files:**
- Create: `src/components/momentum/MomentumRing.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/momentum/MomentumRing.jsx
import { useMomentum } from '../../hooks/useMomentum'
import { useTheme } from '../../context/ThemeContext'

const RADIUS = 48
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

function formatTimeAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))
  if (days === 0) return 'today'
  if (days === 1) return '1d ago'
  return `${days}d ago`
}

const TYPE_COLOR = {
  step:     '#16A34A',
  defense:  '#3B82F6',
  referral: '#8B5CF6',
}

export default function MomentumRing() {
  const { pct, state, label, color, actions, loading } = useMomentum()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const dashArray = `${(pct / 100) * CIRCUMFERENCE} ${CIRCUMFERENCE}`

  const cardBg     = isDark
    ? 'linear-gradient(145deg, #0D1B2A 0%, #0F2235 100%)'
    : 'linear-gradient(145deg, #ffffff 0%, #f4f8ff 100%)'
  const cardBorder = isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(13,27,42,0.08)'
  const textPrimary   = isDark ? '#ffffff' : '#0D1B2A'
  const textSecondary = isDark ? 'rgba(255,255,255,0.45)' : 'rgba(13,27,42,0.5)'
  const trackColor    = isDark ? 'rgba(255,255,255,0.07)' : 'rgba(13,27,42,0.08)'
  const dividerColor  = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(13,27,42,0.06)'

  if (loading) return (
    <div style={{
      background: cardBg, border: cardBorder, borderRadius: 16, padding: 24, marginBottom: 20,
      height: 140,
    }} />
  )

  // Fill up to 4 slots with actions, rest are empty placeholders
  const slots = [...actions]
  while (slots.length < 4) slots.push(null)

  return (
    <div style={{
      background: cardBg,
      border: cardBorder,
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 20,
      boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.06)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.85rem', fontWeight: 700, color: textPrimary, margin: 0 }}>
            Research Momentum
          </p>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', color: textSecondary, margin: '2px 0 0' }}>
            Last 7 days
          </p>
        </div>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
          padding: '3px 10px', borderRadius: 999,
          background: `${color}18`, color, border: `1px solid ${color}40`,
        }}>
          {state === 'cold' ? 'Cold' : state === 'warming' ? 'Warming Up' : state === 'on_track' ? 'On Track' : 'Peak Focus 🔥'}
        </span>
      </div>

      {/* Ring + Activity feed */}
      <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>

        {/* SVG Ring */}
        <div style={{ position: 'relative', width: 110, height: 110, flexShrink: 0 }}>
          <svg width="110" height="110" viewBox="0 0 110 110" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="55" cy="55" r={RADIUS} fill="none" stroke={trackColor} strokeWidth="9" />
            {pct > 0 && (
              <circle
                cx="55" cy="55" r={RADIUS}
                fill="none"
                stroke={color}
                strokeWidth="9"
                strokeDasharray={dashArray}
                strokeLinecap="round"
                style={{ transition: 'stroke-dasharray 0.8s cubic-bezier(0.22,1,0.36,1), stroke 0.4s ease' }}
              />
            )}
          </svg>
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            textAlign: 'center',
          }}>
            <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.3rem', fontWeight: 800, color: pct > 0 ? color : textSecondary, margin: 0, lineHeight: 1 }}>
              {pct}%
            </p>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.52rem', color: textSecondary, textTransform: 'uppercase', letterSpacing: '0.08em', margin: '3px 0 0' }}>
              momentum
            </p>
          </div>
        </div>

        {/* Activity feed */}
        <div style={{ flex: 1, minWidth: 0 }}>
          {slots.map((action, i) => (
            <div key={i} style={{
              display: 'flex', alignItems: 'center', gap: 8, padding: '7px 0',
              borderBottom: i < 3 ? `1px solid ${dividerColor}` : 'none',
              opacity: action ? 1 : 0.3,
            }}>
              <div style={{
                width: 7, height: 7, borderRadius: '50', flexShrink: 0,
                background: action ? TYPE_COLOR[action.type] : textSecondary,
              }} />
              <span style={{
                fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem',
                color: action ? textPrimary : textSecondary, flex: 1,
                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
              }}>
                {action ? action.label : 'Complete a step to add momentum'}
              </span>
              {action && (
                <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.62rem', color: textSecondary, flexShrink: 0 }}>
                  {formatTimeAgo(action.timestamp)}
                </span>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Bottom label */}
      <p style={{
        fontFamily: "'Poppins', sans-serif", fontSize: '0.7rem', color: textSecondary,
        margin: '12px 0 0', textAlign: 'center',
      }}>
        {label}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/momentum/MomentumRing.jsx
git commit -m "feat: add MomentumRing SVG component"
```

---

## Task 7: `check-achievements` handler in `api/ai.js`

**Files:**
- Modify: `api/ai.js`

- [ ] **Step 1: Add the handler function** — paste this entire function before the `export default async function handler` line at the bottom of `api/ai.js`:

```javascript
/**
 * Checks all 19 achievement conditions for the authenticated user server-side,
 * writes any newly earned ones to user_achievements via service role,
 * and returns the list of newly earned keys.
 * Called after: step completion, defense session end, referral qualification, certificate share.
 */
async function handleCheckAchievements(req, res) {
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  const { data: { user } = {}, error: authErr } = await supabaseAdmin.auth.getUser(token);
  if (authErr || !user) return res.status(401).json({ error: 'Invalid token.' });

  const userId = user.id;
  const shared = req.body?.shared === true;

  // Fetch all user data + existing achievements in parallel
  const [
    { data: steps },
    { data: defSessions },
    { data: certs },
    { data: referrals },
    { data: credits },
    { data: existing },
  ] = await Promise.all([
    supabaseAdmin.from('project_steps').select('step_name, completed_at').eq('user_id', userId),
    supabaseAdmin.from('defense_sessions').select('final_score, completed_at').eq('user_id', userId).order('completed_at', { ascending: true }),
    supabaseAdmin.from('defense_certificates').select('id').eq('user_id', userId).limit(1),
    supabaseAdmin.from('referrals').select('status, created_at').eq('referrer_user_id', userId),
    supabaseAdmin.from('defense_credits').select('id').eq('user_id', userId).limit(1),
    supabaseAdmin.from('user_achievements').select('achievement_key').eq('user_id', userId),
  ]);

  const earned = new Set((existing ?? []).map(r => r.achievement_key));
  const newlyEarned = [];
  const userCreatedAt = new Date(user.created_at);

  function check(key, condition) {
    if (!earned.has(key) && condition) {
      newlyEarned.push({ user_id: userId, achievement_key: key });
      earned.add(key);
    }
  }

  const stepNames = (steps ?? []).map(s => s.step_name);
  const scores = (defSessions ?? []).map(s => s.final_score).filter(n => typeof n === 'number');
  const maxScore = scores.length > 0 ? Math.max(...scores) : -1;
  const WAT_OFFSET_MS = 60 * 60 * 1000; // UTC+1

  // ── MILESTONE ──────────────────────────────────────────────────────────────
  check('first_step',    stepNames.includes('topic_validator'));
  check('halfway',       stepNames.length >= 3);
  check('defense_ready', stepNames.length >= 6 && (defSessions ?? []).length > 0);
  check('certified',     (certs ?? []).length > 0);

  // ── SPEED ──────────────────────────────────────────────────────────────────
  const tvStep = (steps ?? []).find(s => s.step_name === 'topic_validator');
  if (tvStep) {
    const tvMs   = new Date(tvStep.completed_at).getTime();
    const signupMs = userCreatedAt.getTime();
    check('fast_starter', tvMs - signupMs <= 60 * 60 * 1000);
  }

  // Sprint: 3 steps on same WAT calendar day
  const stepsByWatDay = {};
  for (const s of (steps ?? [])) {
    const watDate = new Date(new Date(s.completed_at).getTime() + WAT_OFFSET_MS);
    const key = watDate.toISOString().slice(0, 10);
    stepsByWatDay[key] = (stepsByWatDay[key] ?? 0) + 1;
  }
  check('sprint', Object.values(stepsByWatDay).some(n => n >= 3));

  // Speed run: all 6 steps within 7 days of signup
  if (stepNames.length >= 6) {
    const latestStepMs = Math.max(...(steps ?? []).map(s => new Date(s.completed_at).getTime()));
    check('speed_run', latestStepMs - userCreatedAt.getTime() <= 7 * 24 * 60 * 60 * 1000);
  }

  // ── EFFORT ─────────────────────────────────────────────────────────────────
  check('sharp_mind',    maxScore >= 8);
  check('excellence',    maxScore >= 9);
  check('perfectionist', maxScore === 10);
  check('persistent',    (defSessions ?? []).length >= 3);

  // Never Give Up: ran defense again after a score < 7
  const hasBadScore  = scores.some(s => s < 7);
  const hasLaterRun  = hasBadScore && scores.length > 1;
  check('never_give_up', hasLaterRun);

  // ── SOCIAL ─────────────────────────────────────────────────────────────────
  const qualifiedRefs = (referrals ?? []).filter(r => r.status === 'qualified' || r.status === 'rewarded');
  check('ambassador',  (referrals ?? []).length > 0);
  check('connector',   qualifiedRefs.length >= 3);
  check('earned_it',   (credits ?? []).length > 0);
  check('shared',      shared);

  // ── HIDDEN ─────────────────────────────────────────────────────────────────
  // Night Owl: step completed midnight–4 AM WAT
  const nightOwl = (steps ?? []).some(s => {
    const localHour = (new Date(s.completed_at).getUTCHours() + 1) % 24;
    return localHour < 4;
  });
  check('night_owl', nightOwl);

  // Early Bird: step completed before 7 AM WAT
  const earlyBird = (steps ?? []).some(s => {
    const localHour = (new Date(s.completed_at).getUTCHours() + 1) % 24;
    return localHour < 7;
  });
  check('early_bird', earlyBird);

  // Dedicated: meaningful actions on 5+ distinct WAT calendar days
  const actionDays = new Set();
  for (const s of (steps ?? [])) {
    actionDays.add(new Date(new Date(s.completed_at).getTime() + WAT_OFFSET_MS).toISOString().slice(0, 10));
  }
  for (const d of (defSessions ?? [])) {
    if (d.completed_at) {
      actionDays.add(new Date(new Date(d.completed_at).getTime() + WAT_OFFSET_MS).toISOString().slice(0, 10));
    }
  }
  check('dedicated', actionDays.size >= 5);

  // Write newly earned — upsert is safe (UNIQUE constraint prevents duplicates)
  if (newlyEarned.length > 0) {
    await supabaseAdmin
      .from('user_achievements')
      .upsert(newlyEarned, { onConflict: 'user_id,achievement_key', ignoreDuplicates: true })
      .catch(err => console.error('[check-achievements] upsert error:', err?.message));
  }

  return res.status(200).json({ newlyEarned: newlyEarned.map(r => r.achievement_key) });
}
```

- [ ] **Step 2: Register the route** — in the `export default async function handler` at the bottom of `api/ai.js`, add the new route before `return handleGeneral(req, res)`:

```javascript
  if (req.query.action === 'check-achievements') return handleCheckAchievements(req, res);
```

The full handler block should now read:
```javascript
export default async function handler(req, res) {
  setCorsHeaders(req, res);
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.query.action === 'defense')             return handleDefense(req, res);
  if (req.query.action === 'supervisor-prep')     return handleSupervisorPrep(req, res);
  if (req.query.action === 'sync-run-counts')     return handleSyncRunCounts(req, res);
  if (req.query.action === 'check-achievements')  return handleCheckAchievements(req, res);
  return handleGeneral(req, res);
}
```

- [ ] **Step 3: Commit**

```bash
git add api/ai.js
git commit -m "feat: add check-achievements action to api/ai.js"
```

---

## Task 8: Frontend `checkAchievements` helper and `useAchievements` hook

**Files:**
- Create: `src/lib/checkAchievements.ts`
- Create: `src/hooks/useAchievements.ts`

- [ ] **Step 1: Create the frontend helper**

```typescript
// src/lib/checkAchievements.ts
import { supabase } from './supabase'

/**
 * Calls /api/ai?action=check-achievements server-side.
 * Returns the list of newly earned achievement keys (may be empty).
 * Pass shared=true when the trigger was a certificate share action.
 * Fire-and-forget safe — never throws, just logs.
 */
export async function checkAchievements(opts: { shared?: boolean } = {}): Promise<string[]> {
  try {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return []

    const res = await fetch('/api/ai?action=check-achievements', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ shared: opts.shared ?? false }),
    })

    if (!res.ok) return []
    const body = await res.json()
    return Array.isArray(body.newlyEarned) ? body.newlyEarned : []
  } catch {
    return []
  }
}
```

- [ ] **Step 2: Create `useAchievements` hook**

```typescript
// src/hooks/useAchievements.ts
import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useUser } from './useUser'

export interface Achievement {
  key: string
  earned_at: string | null
}

export function useAchievements() {
  const { user } = useUser()
  const [achievements, setAchievements] = useState<Achievement[]>([])
  const [loading, setLoading] = useState(true)

  const refresh = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from('user_achievements')
      .select('achievement_key, earned_at')
      .eq('user_id', userId)
      .order('earned_at', { ascending: false })

    setAchievements((data ?? []).map(r => ({ key: r.achievement_key, earned_at: r.earned_at })))
    setLoading(false)
  }, [])

  useEffect(() => {
    if (!user?.id) { setLoading(false); return }
    refresh(user.id)
  }, [user?.id, refresh])

  // Allow components to re-fetch after checkAchievements returns new keys
  const refetch = useCallback(() => {
    if (user?.id) refresh(user.id)
  }, [user?.id, refresh])

  const earnedKeys = new Set(achievements.map(a => a.key))

  return { achievements, earnedKeys, loading, refetch }
}
```

- [ ] **Step 3: Verify types**

```bash
npx tsc --noEmit
```

- [ ] **Step 4: Commit**

```bash
git add src/lib/checkAchievements.ts src/hooks/useAchievements.ts
git commit -m "feat: add checkAchievements helper and useAchievements hook"
```

---

## Task 9: `celebrations.ts` localStorage helper

**Files:**
- Create: `src/lib/celebrations.ts`

- [ ] **Step 1: Create the helper**

```typescript
// src/lib/celebrations.ts
// Tracks which celebration modals have already been shown in this browser,
// so they don't re-fire on page reload.

const STORAGE_KEY = 'fypro_celebrations_seen'

function getSeenSet(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return new Set(Array.isArray(parsed) ? parsed : [])
  } catch {
    return new Set()
  }
}

function saveSeenSet(set: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]))
  } catch { /* quota exceeded — silently ignore */ }
}

/** Returns true if this celebration has NOT been shown yet (and marks it as shown). */
export function shouldShowCelebration(key: string): boolean {
  const seen = getSeenSet()
  if (seen.has(key)) return false
  seen.add(key)
  saveSeenSet(seen)
  return true
}

export function markCelebrationSeen(key: string): void {
  const seen = getSeenSet()
  seen.add(key)
  saveSeenSet(seen)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/celebrations.ts
git commit -m "feat: add celebrations localStorage helper"
```

---

## Task 10: `CelebrationModal` component (Tier 2)

**Files:**
- Create: `src/components/celebration/CelebrationModal.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/celebration/CelebrationModal.jsx
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTheme } from '../../context/ThemeContext'

// Lightweight canvas confetti — no external library
function fireConfetti(canvas) {
  const ctx = canvas.getContext('2d')
  const pieces = Array.from({ length: 60 }, () => ({
    x: Math.random() * canvas.width,
    y: -10,
    r: Math.random() * 6 + 3,
    color: ['#0066FF', '#16A34A', '#F59E0B', '#8B5CF6', '#3B82F6'][Math.floor(Math.random() * 5)],
    vx: (Math.random() - 0.5) * 4,
    vy: Math.random() * 3 + 2,
    rotation: Math.random() * 360,
    vr: (Math.random() - 0.5) * 6,
  }))

  let frame
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    let alive = false
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy; p.rotation += p.vr; p.vy += 0.05
      if (p.y < canvas.height + 10) alive = true
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r)
      ctx.restore()
    }
    if (alive) frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  setTimeout(() => cancelAnimationFrame(frame), 2500)
}

/**
 * Props:
 *   open       — boolean, controls visibility
 *   onClose    — () => void
 *   emoji      — string, e.g. '📐'
 *   headline   — string, e.g. 'Step Complete!'
 *   body       — string, secondary description
 *   rankLabel  — string | null, if rank changed show it
 *   ctaLabel   — string, button label
 *   onCta      — () => void
 */
export default function CelebrationModal({ open, onClose, emoji, headline, body, rankLabel, ctaLabel = 'Continue', onCta }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'
  const canvasRef = useRef(null)

  useEffect(() => {
    if (open && canvasRef.current) {
      fireConfetti(canvasRef.current)
    }
  }, [open])

  function handleCta() {
    onCta?.()
    onClose()
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9000,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)',
          }}
          onClick={onClose}
        >
          <canvas
            ref={canvasRef}
            width={window.innerWidth}
            height={window.innerHeight}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          />
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 300, damping: 25 }}
            onClick={e => e.stopPropagation()}
            style={{
              background: isDark
                ? 'linear-gradient(145deg, #0D1B2A 0%, #0F2235 100%)'
                : '#ffffff',
              border: isDark ? '1px solid rgba(0,102,255,0.25)' : '1px solid rgba(13,27,42,0.1)',
              borderRadius: 20,
              padding: '36px 32px',
              textAlign: 'center',
              maxWidth: 360,
              width: '90vw',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
              position: 'relative',
              zIndex: 1,
            }}
          >
            <div style={{ fontSize: '3rem', marginBottom: 12 }}>{emoji}</div>
            <h2 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '1.5rem', color: isDark ? '#fff' : '#0D1B2A',
              margin: '0 0 8px',
            }}>
              {headline}
            </h2>
            <p style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.85rem', color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(13,27,42,0.6)',
              margin: '0 0 20px', lineHeight: 1.6,
            }}>
              {body}
            </p>
            {rankLabel && (
              <div style={{
                background: 'rgba(0,102,255,0.08)', border: '1px solid rgba(0,102,255,0.2)',
                borderRadius: 10, padding: '10px 16px', marginBottom: 20,
              }}>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', color: 'rgba(255,255,255,0.45)', margin: '0 0 2px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  New rank
                </p>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.9rem', fontWeight: 700, color: '#3B82F6', margin: 0 }}>
                  {rankLabel}
                </p>
              </div>
            )}
            <button
              onClick={handleCta}
              style={{
                width: '100%', background: '#0066FF', color: '#fff',
                border: 'none', borderRadius: 10, padding: '13px',
                fontFamily: "'Poppins', sans-serif", fontSize: '0.9rem', fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {ctaLabel}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/celebration/CelebrationModal.jsx
git commit -m "feat: add CelebrationModal (Tier 2) with canvas confetti"
```

---

## Task 11: `DefenseCelebration` component (Tier 3)

**Files:**
- Create: `src/components/celebration/DefenseCelebration.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/celebration/DefenseCelebration.jsx
import { useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'

function fireFullConfetti(canvas) {
  const ctx = canvas.getContext('2d')
  const pieces = Array.from({ length: 120 }, () => ({
    x: Math.random() * canvas.width,
    y: -20,
    r: Math.random() * 8 + 4,
    color: ['#0066FF', '#16A34A', '#F59E0B', '#8B5CF6', '#3B82F6', '#ffffff'][Math.floor(Math.random() * 6)],
    vx: (Math.random() - 0.5) * 5,
    vy: Math.random() * 4 + 2,
    rotation: Math.random() * 360,
    vr: (Math.random() - 0.5) * 8,
    shape: Math.random() > 0.5 ? 'rect' : 'circle',
  }))

  let frame
  const tick = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    let alive = false
    for (const p of pieces) {
      p.x += p.vx; p.y += p.vy; p.rotation += p.vr; p.vy += 0.06
      if (p.y < canvas.height + 20) alive = true
      ctx.save()
      ctx.translate(p.x, p.y)
      ctx.rotate((p.rotation * Math.PI) / 180)
      ctx.fillStyle = p.color
      if (p.shape === 'circle') {
        ctx.beginPath(); ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2); ctx.fill()
      } else {
        ctx.fillRect(-p.r, -p.r / 2, p.r * 2, p.r)
      }
      ctx.restore()
    }
    if (alive) frame = requestAnimationFrame(tick)
  }
  frame = requestAnimationFrame(tick)
  setTimeout(() => cancelAnimationFrame(frame), 4000)
}

/**
 * Props:
 *   open       — boolean
 *   score      — number (e.g. 8.5)
 *   onDownload — () => void
 *   onShare    — () => void
 *   onClose    — () => void
 */
export default function DefenseCelebration({ open, score, onDownload, onShare, onClose }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    if (open && canvasRef.current) {
      fireFullConfetti(canvasRef.current)
    }
  }, [open])

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 9500,
            background: 'radial-gradient(ellipse at center top, rgba(0,102,255,0.3) 0%, #060E18 65%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexDirection: 'column', padding: '40px 20px', textAlign: 'center',
          }}
        >
          <canvas
            ref={canvasRef}
            width={window.innerWidth}
            height={window.innerHeight}
            style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}
          />

          {/* Concentric ring pulses */}
          {[300, 480, 660].map((size, i) => (
            <motion.div
              key={size}
              animate={{ scale: [1, 1.08, 1], opacity: [0.15, 0.05, 0.15] }}
              transition={{ duration: 3, repeat: Infinity, delay: i * 0.8, ease: 'easeInOut' }}
              style={{
                position: 'absolute', top: '50%', left: '50%',
                transform: 'translate(-50%,-50%)',
                width: size, height: size, borderRadius: '50%',
                border: '1px solid rgba(0,102,255,0.4)',
                pointerEvents: 'none',
              }}
            />
          ))}

          <motion.div
            initial={{ scale: 0.7, opacity: 0, y: 30 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{ type: 'spring', stiffness: 260, damping: 20, delay: 0.1 }}
            style={{ position: 'relative', zIndex: 1, maxWidth: 420, width: '100%' }}
          >
            <div style={{ fontSize: '4rem', marginBottom: 16 }}>🎓</div>

            <p style={{
              fontFamily: "'JetBrains Mono', monospace",
              fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase',
              letterSpacing: '0.15em', color: '#3B82F6', marginBottom: 8,
            }}>
              Defense Certificate Unlocked
            </p>

            <h1 style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: '2.2rem', color: '#ffffff', margin: '0 0 10px', lineHeight: 1.15,
            }}>
              You passed.<br />Download your certificate.
            </h1>

            <p style={{
              fontFamily: "'Poppins', sans-serif",
              fontSize: '0.9rem', color: 'rgba(255,255,255,0.55)', margin: '0 0 28px', lineHeight: 1.6,
            }}>
              You scored above the pass threshold in the FYPro Defense Simulator.
            </p>

            {/* Score display */}
            <div style={{
              display: 'inline-flex', alignItems: 'baseline', gap: 4,
              background: 'rgba(0,102,255,0.12)', border: '1px solid rgba(0,102,255,0.3)',
              borderRadius: 12, padding: '12px 28px', marginBottom: 28,
            }}>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '2.8rem', fontWeight: 900, color: '#3B82F6' }}>
                {typeof score === 'number' ? score.toFixed(1) : score}
              </span>
              <span style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '1.3rem', color: 'rgba(255,255,255,0.3)' }}>
                /10
              </span>
            </div>

            {/* CTAs */}
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={onDownload}
                style={{
                  background: '#0066FF', color: '#fff', border: 'none',
                  borderRadius: 10, padding: '13px 24px',
                  fontFamily: "'Poppins', sans-serif", fontSize: '0.88rem', fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Download Certificate
              </button>
              <button
                onClick={onShare}
                style={{
                  background: 'transparent', color: 'rgba(255,255,255,0.7)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 10, padding: '13px 20px',
                  fontFamily: "'Poppins', sans-serif", fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Share on WhatsApp
              </button>
              <button
                onClick={onClose}
                style={{
                  background: 'transparent', color: 'rgba(255,255,255,0.4)',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 10, padding: '13px 20px',
                  fontFamily: "'Poppins', sans-serif", fontSize: '0.85rem', fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                View badges
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/celebration/DefenseCelebration.jsx
git commit -m "feat: add DefenseCelebration full-screen Tier 3 component"
```

---

## Task 12: `AchievementsRow` component

**Files:**
- Create: `src/components/badges/AchievementsRow.jsx`

- [ ] **Step 1: Create the component**

```jsx
// src/components/badges/AchievementsRow.jsx
// Compact row of earned achievement chips shown on the dashboard.
// Locked achievements show as faint outlines. Hidden ones show as '?' until earned.
import { motion } from 'framer-motion'
import { useAchievements } from '../../hooks/useAchievements'
import { useTheme } from '../../context/ThemeContext'
import { Link } from 'react-router-dom'

// All 19 achievements in display order
const ALL_ACHIEVEMENTS = [
  { key: 'first_step',    label: 'First Step',    emoji: '🌱', hidden: false },
  { key: 'halfway',       label: 'Halfway There', emoji: '⚡', hidden: false },
  { key: 'defense_ready', label: 'Defense Ready', emoji: '🛡️', hidden: false },
  { key: 'certified',     label: 'Certified',     emoji: '🎓', hidden: false },
  { key: 'fast_starter',  label: 'Fast Starter',  emoji: '🚀', hidden: false },
  { key: 'sprint',        label: 'Sprint',         emoji: '🏃', hidden: false },
  { key: 'speed_run',     label: 'Speed Run',      emoji: '💨', hidden: false },
  { key: 'sharp_mind',    label: 'Sharp Mind',     emoji: '🎯', hidden: false },
  { key: 'excellence',    label: 'Excellence',     emoji: '⭐', hidden: false },
  { key: 'perfectionist', label: 'Perfectionist',  emoji: '💎', hidden: false },
  { key: 'persistent',    label: 'Persistent',     emoji: '🔄', hidden: false },
  { key: 'never_give_up', label: 'Never Give Up',  emoji: '💪', hidden: false },
  { key: 'ambassador',    label: 'Ambassador',     emoji: '📣', hidden: false },
  { key: 'connector',     label: 'Connector',      emoji: '🌐', hidden: false },
  { key: 'earned_it',     label: 'Earned It',      emoji: '🏆', hidden: false },
  { key: 'shared',        label: 'Shared',         emoji: '📤', hidden: false },
  { key: 'night_owl',     label: 'Night Owl',      emoji: '🦉', hidden: true  },
  { key: 'early_bird',    label: 'Early Bird',     emoji: '🌅', hidden: true  },
  { key: 'dedicated',     label: 'Dedicated',      emoji: '🔥', hidden: true  },
]

export default function AchievementsRow() {
  const { earnedKeys, loading } = useAchievements()
  const { theme } = useTheme()
  const isLight = theme === 'light'

  if (loading) return null

  const earnedCount = ALL_ACHIEVEMENTS.filter(a => earnedKeys.has(a.key)).length

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1], delay: 0.1 }}
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: 8,
        padding: '14px 20px',
        borderRadius: 16,
        background: isLight
          ? 'linear-gradient(135deg, #F8FAFC 0%, #F1F5F9 100%)'
          : 'linear-gradient(135deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.02) 100%)',
        border: isLight ? '1px solid #E2E8F0' : '1px solid rgba(255,255,255,0.07)',
        marginBottom: 20,
        overflowX: 'auto',
        scrollbarWidth: 'none',
      }}
      role="region"
      aria-label="Achievement badges"
    >
      {/* Label */}
      <div style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minWidth: 72, flexShrink: 0 }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace", fontSize: '0.58rem', fontWeight: 600,
          color: isLight ? 'rgba(13,27,42,0.45)' : 'rgba(255,255,255,0.3)',
          textTransform: 'uppercase', letterSpacing: '0.1em',
        }}>
          Achievements
        </span>
        <span style={{
          fontFamily: "'Poppins', sans-serif", fontSize: '0.6rem',
          color: isLight ? 'rgba(13,27,42,0.35)' : 'rgba(255,255,255,0.18)', marginTop: 3,
        }}>
          {earnedCount}/{ALL_ACHIEVEMENTS.length} earned
        </span>
        <Link
          to="/account/achievements"
          style={{
            fontFamily: "'Poppins', sans-serif", fontSize: '0.58rem',
            color: '#0066FF', textDecoration: 'none', marginTop: 4,
          }}
        >
          View all →
        </Link>
      </div>

      {/* Divider */}
      <div style={{ width: 1, alignSelf: 'stretch', background: isLight ? '#E2E8F0' : 'rgba(255,255,255,0.07)', margin: '0 4px', flexShrink: 0 }} />

      {/* Achievement chips — show first 12, rest accessible via /account/achievements */}
      {ALL_ACHIEVEMENTS.slice(0, 12).map(a => {
        const earned = earnedKeys.has(a.key)
        const showHidden = a.hidden && !earned
        return (
          <motion.div
            key={a.key}
            title={earned ? a.label : a.hidden ? '???' : a.label}
            animate={earned ? { scale: [1, 1.2, 1] } : {}}
            transition={{ duration: 0.5 }}
            style={{
              width: 36, height: 36, borderRadius: '50%', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '1.1rem',
              background: earned
                ? isLight ? 'rgba(0,102,255,0.08)' : 'rgba(0,102,255,0.12)'
                : isLight ? 'rgba(0,0,0,0.03)' : 'rgba(255,255,255,0.04)',
              border: earned
                ? '1.5px solid rgba(0,102,255,0.3)'
                : isLight ? '1.5px solid rgba(13,27,42,0.1)' : '1.5px solid rgba(255,255,255,0.08)',
              opacity: earned ? 1 : 0.35,
              filter: earned ? 'none' : 'grayscale(1)',
              cursor: 'default',
            }}
          >
            {showHidden ? '?' : a.emoji}
          </motion.div>
        )
      })}
    </motion.div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/badges/AchievementsRow.jsx
git commit -m "feat: add AchievementsRow compact dashboard component"
```

---

## Task 13: Achievements page at `/account/achievements`

**Files:**
- Create: `src/pages/account/Achievements.jsx`
- Modify: `src/App.jsx`

- [ ] **Step 1: Create the page**

```jsx
// src/pages/account/Achievements.jsx
import { Link } from 'react-router-dom'
import { useAchievements } from '../../hooks/useAchievements'
import { useTheme } from '../../context/ThemeContext'

const ACHIEVEMENT_DEFS = [
  // Milestone
  { key: 'first_step',    name: 'First Step',          emoji: '🌱', desc: 'Completed Topic Validator for the first time',                    cat: 'Milestone', hidden: false },
  { key: 'halfway',       name: 'Halfway There',        emoji: '⚡', desc: 'Completed 3 of the 6 steps',                                    cat: 'Milestone', hidden: false },
  { key: 'defense_ready', name: 'Defense Ready',        emoji: '🛡️', desc: 'Completed all 6 steps and ran a defense session',                cat: 'Milestone', hidden: false },
  { key: 'certified',     name: 'Certified',            emoji: '🎓', desc: 'Earned a Defense Certificate (score 7 or higher)',               cat: 'Milestone', hidden: false },
  // Speed
  { key: 'fast_starter',  name: 'Fast Starter',         emoji: '🚀', desc: 'Completed Step 1 within 1 hour of signing up',                  cat: 'Speed',     hidden: false },
  { key: 'sprint',        name: 'Sprint',               emoji: '🏃', desc: 'Completed 3 steps in a single day',                             cat: 'Speed',     hidden: false },
  { key: 'speed_run',     name: 'Speed Run',            emoji: '💨', desc: 'Completed all 6 steps within 7 days of signup',                 cat: 'Speed',     hidden: false },
  // Effort
  { key: 'sharp_mind',    name: 'Sharp Mind',           emoji: '🎯', desc: 'Scored 8 or higher in the Defense Simulator',                   cat: 'Effort',    hidden: false },
  { key: 'excellence',    name: 'Excellence',           emoji: '⭐', desc: 'Scored 9 or higher in the Defense Simulator',                   cat: 'Effort',    hidden: false },
  { key: 'perfectionist', name: 'Perfectionist',        emoji: '💎', desc: 'Scored a perfect 10/10 in the Defense Simulator',               cat: 'Effort',    hidden: false },
  { key: 'persistent',    name: 'Persistent',           emoji: '🔄', desc: 'Ran the Defense Simulator 3 times',                             cat: 'Effort',    hidden: false },
  { key: 'never_give_up', name: 'Never Give Up',        emoji: '💪', desc: 'Ran defense again after scoring below 7',                       cat: 'Effort',    hidden: false },
  // Social
  { key: 'ambassador',    name: 'Ambassador',           emoji: '📣', desc: 'Made your first referral',                                     cat: 'Social',    hidden: false },
  { key: 'connector',     name: 'Connector',            emoji: '🌐', desc: '3 qualified referrals — friends who validated a topic',         cat: 'Social',    hidden: false },
  { key: 'earned_it',     name: 'Earned It',            emoji: '🏆', desc: 'Earned your first free Defense session via referrals',          cat: 'Social',    hidden: false },
  { key: 'shared',        name: 'Shared',               emoji: '📤', desc: 'Shared your Defense certificate',                              cat: 'Social',    hidden: false },
  // Hidden
  { key: 'night_owl',     name: 'Night Owl',            emoji: '🦉', desc: 'Completed a step between midnight and 4 AM',                   cat: 'Hidden',    hidden: true  },
  { key: 'early_bird',    name: 'Early Bird',           emoji: '🌅', desc: 'Completed a step before 7 AM',                                 cat: 'Hidden',    hidden: true  },
  { key: 'dedicated',     name: 'Dedicated',            emoji: '🔥', desc: 'Took meaningful action on 5 different days',                   cat: 'Hidden',    hidden: true  },
]

const CATEGORIES = ['Milestone', 'Speed', 'Effort', 'Social', 'Hidden']

function AchCard({ def, earned, isDark }) {
  const showLabel = !def.hidden || earned
  return (
    <div style={{
      background: earned
        ? isDark ? 'rgba(255,255,255,0.06)' : '#ffffff'
        : isDark ? 'rgba(255,255,255,0.025)' : 'rgba(0,0,0,0.025)',
      border: earned
        ? isDark ? '1px solid rgba(255,255,255,0.15)' : '1px solid rgba(13,27,42,0.12)'
        : isDark ? '1px solid rgba(255,255,255,0.06)' : '1px solid rgba(13,27,42,0.06)',
      borderRadius: 12, padding: '16px',
      opacity: earned ? 1 : def.hidden ? 0.6 : 0.4,
      display: 'flex', flexDirection: 'column', gap: 8,
      boxShadow: earned
        ? isDark ? '0 4px 20px rgba(0,0,0,0.3)' : '0 4px 20px rgba(0,0,0,0.06)'
        : 'none',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{
          width: 40, height: 40, borderRadius: 10, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.3rem',
          background: earned ? 'rgba(0,102,255,0.1)' : isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)',
          filter: earned ? 'none' : 'grayscale(1)',
        }}>
          {!earned && def.hidden ? '?' : def.emoji}
        </div>
        <p style={{
          fontFamily: "'Poppins', sans-serif", fontSize: '0.85rem', fontWeight: 700,
          color: earned ? (isDark ? '#fff' : '#0D1B2A') : isDark ? 'rgba(255,255,255,0.5)' : 'rgba(13,27,42,0.5)',
          margin: 0,
        }}>
          {showLabel ? def.name : '???'}
        </p>
        {earned && (
          <span style={{
            marginLeft: 'auto', fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em',
            padding: '2px 8px', borderRadius: 999,
            background: 'rgba(22,163,74,0.12)', color: '#16A34A', border: '1px solid rgba(22,163,74,0.3)',
            flexShrink: 0,
          }}>
            ✓
          </span>
        )}
      </div>
      <p style={{
        fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem',
        color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.45)',
        margin: 0, lineHeight: 1.5,
      }}>
        {showLabel ? def.desc : 'Keep exploring to discover this achievement.'}
      </p>
    </div>
  )
}

export default function Achievements() {
  const { earnedKeys, loading } = useAchievements()
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const pageBg   = isDark ? '#060E18' : '#F0F4F8'
  const dotColor = isDark ? 'rgba(0,102,255,0.05)' : 'rgba(0,102,255,0.06)'

  const totalEarned = ACHIEVEMENT_DEFS.filter(a => earnedKeys.has(a.key)).length

  return (
    <div style={{
      minHeight: '100vh', background: pageBg,
      backgroundImage: `radial-gradient(circle, ${dotColor} 1px, transparent 1px)`,
      backgroundSize: '28px 28px', padding: '40px 20px',
    }}>
      <div style={{ maxWidth: 720, margin: '0 auto' }}>

        <Link to="/dashboard" style={{
          fontFamily: "'Poppins', sans-serif", fontSize: '0.8125rem',
          color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.45)',
          textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 28,
        }}>
          ← Back to Dashboard
        </Link>

        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontFamily: "'DM Serif Display', serif", fontSize: '2rem', color: isDark ? '#fff' : '#0D1B2A', margin: '0 0 8px' }}>
            Achievements
          </h1>
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.9rem', color: isDark ? 'rgba(255,255,255,0.55)' : 'rgba(13,27,42,0.6)', margin: 0 }}>
            {totalEarned} of {ACHIEVEMENT_DEFS.length} unlocked
          </p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
            <div style={{
              width: 32, height: 32, border: '3px solid rgba(0,102,255,0.15)', borderTopColor: '#0066FF',
              borderRadius: '50%', animation: 'ach-spin 0.7s linear infinite',
            }} />
            <style>{`@keyframes ach-spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        ) : (
          CATEGORIES.map(cat => {
            const defs = ACHIEVEMENT_DEFS.filter(a => a.cat === cat)
            return (
              <div key={cat} style={{ marginBottom: 36 }}>
                <p style={{
                  fontFamily: "'JetBrains Mono', monospace", fontSize: '0.68rem', fontWeight: 700,
                  textTransform: 'uppercase', letterSpacing: '0.1em',
                  color: isDark ? 'rgba(255,255,255,0.4)' : 'rgba(13,27,42,0.45)',
                  margin: '0 0 14px', display: 'flex', alignItems: 'center', gap: 12,
                }}>
                  {cat}
                  <span style={{ flex: 1, height: 1, background: isDark ? 'rgba(255,255,255,0.07)' : 'rgba(13,27,42,0.08)' }} />
                </p>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
                  {defs.map(def => (
                    <AchCard key={def.key} def={def} earned={earnedKeys.has(def.key)} isDark={isDark} />
                  ))}
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Add the route in `App.jsx`**

Add this lazy import near the other account-page imports:
```jsx
const Achievements = lazy(() => import('./pages/account/Achievements'))
```

Add this route in the account routes section:
```jsx
<Route path="/account/achievements" element={<ProtectedRoute><S fallback={<DashboardPageSkeleton />}><Achievements /></S></ProtectedRoute>} />
```

- [ ] **Step 3: Verify the page loads**

```bash
npm run dev
```

Navigate to http://localhost:5173/account/achievements — confirm the 4 categories render, locked achievements show as faint, hidden ones show as `?`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/account/Achievements.jsx src/App.jsx
git commit -m "feat: add /account/achievements page and route"
```

---

## Task 14: Wire `MomentumRing` and `AchievementsRow` into Dashboard

**Files:**
- Modify: `src/pages/Dashboard.jsx`

- [ ] **Step 1: Add imports at the top of Dashboard.jsx**

```jsx
import MomentumRing from '../components/momentum/MomentumRing'
import AchievementsRow from '../components/badges/AchievementsRow'
```

- [ ] **Step 2: Insert components into the dashboard layout**

Find where `BadgeRow` is already rendered in Dashboard.jsx and add `AchievementsRow` immediately below it, and `MomentumRing` below that:

```jsx
<BadgeRow />
<AchievementsRow />
<MomentumRing />
```

- [ ] **Step 3: Start dev server and verify layout**

```bash
npm run dev
```

Navigate to http://localhost:5173/dashboard — confirm BadgeRow, AchievementsRow, and MomentumRing stack correctly. Confirm MomentumRing shows "Cold / Start your research journey" for a fresh account.

- [ ] **Step 4: Commit**

```bash
git add src/pages/Dashboard.jsx
git commit -m "feat: wire MomentumRing and AchievementsRow into Dashboard"
```

---

## Task 15: Wire achievement checks at step completion trigger points

Each step calls `checkAchievements()` after marking itself complete and fires a `CelebrationModal` for newly earned achievements + Tier 1 toasts.

**Files:**
- Modify: `src/features/topicValidator/TopicValidator.jsx`
- Modify: `src/features/chapterArchitect/ChapterArchitect.jsx`
- Modify: `src/features/methodology/MethodologyAdvisor.jsx`
- Modify: `src/features/writingPlanner/WritingPlanner.jsx`
- Modify: `src/features/projectReviewer/ProjectReviewer.jsx`

The pattern is identical in all five files. Apply it to each:

- [ ] **Step 1: Add imports to each step file**

```jsx
import { useState } from 'react' // already imported in all step files
import { checkAchievements } from '../../lib/checkAchievements'
import { shouldShowCelebration } from '../../lib/celebrations'
import { showToast } from '../../components/Toast'
import CelebrationModal from '../../components/celebration/CelebrationModal'
import { useRank } from '../../hooks/useRank'
```

- [ ] **Step 2: Add celebration state and rank hook at the top of the component function**

```jsx
const { rank: currentRank } = useRank()
const [celebration, setCelebration] = useState(null)
// celebration = { emoji, headline, body, rankLabel, ctaLabel } | null
```

- [ ] **Step 3: Add the post-completion handler**

In each step, find where the step marks itself complete (the function that calls `State.save()` or updates project state). After that call resolves, add:

```jsx
// Fire achievement check — non-blocking
checkAchievements().then(newKeys => {
  if (newKeys.length === 0) return

  // Tier 1: toast for all newly earned achievements
  for (const key of newKeys) {
    showToast(`Achievement unlocked — ${key.replace(/_/g, ' ')} 🏅`, 'unlock')
  }

  // Tier 2: confetti modal for step badge earn (first time completing this step)
  const stepKey = `step_${stepNumber}_complete` // use the step-specific key
  if (shouldShowCelebration(stepKey)) {
    setCelebration({
      emoji: STEP_EMOJI,           // each step file defines this constant
      headline: 'Step Complete!',
      body: STEP_COMPLETE_BODY,    // each step file defines this constant
      rankLabel: currentRank.nextLabel ? null : currentRank.label, // show if just maxed
      ctaLabel: 'Continue to next step',
    })
  }
})
```

For each step file, define at the top of the module:
- **TopicValidator.jsx**: `const STEP_EMOJI = '🔍'`, `const STEP_COMPLETE_BODY = "Your topic is validated. You're ready to build your chapter structure."`, `const stepNumber = 1`
- **ChapterArchitect.jsx**: `const STEP_EMOJI = '📐'`, `const STEP_COMPLETE_BODY = "Your chapters are mapped. Time to define your methodology."`, `const stepNumber = 2`
- **MethodologyAdvisor.jsx**: `const STEP_EMOJI = '⚗️'`, `const STEP_COMPLETE_BODY = "Research methodology locked in. On to planning your writing."`, `const stepNumber = 3`
- **WritingPlanner.jsx**: `const STEP_EMOJI = '📝'`, `const STEP_COMPLETE_BODY = "Writing plan set. One step closer to your defense."`, `const stepNumber = 4`
- **ProjectReviewer.jsx**: `const STEP_EMOJI = '📄'`, `const STEP_COMPLETE_BODY = "Project reviewed. You're ready to enter the Defense Simulator."`, `const stepNumber = 5`

- [ ] **Step 4: Render the modal inside each step component's JSX**

Add at the very bottom of each step component's return, before the final closing tag:
```jsx
<CelebrationModal
  open={celebration !== null}
  onClose={() => setCelebration(null)}
  emoji={celebration?.emoji ?? '🎉'}
  headline={celebration?.headline ?? ''}
  body={celebration?.body ?? ''}
  rankLabel={celebration?.rankLabel ?? null}
  ctaLabel={celebration?.ctaLabel ?? 'Continue'}
  onCta={() => setCelebration(null)}
/>
```

- [ ] **Step 5: Start dev server and test one step**

```bash
npm run dev
```

Complete Topic Validator — confirm:
1. Toast appears: "Achievement unlocked — first step 🏅"
2. CelebrationModal fires with "🔍 Step Complete!" headline and confetti

- [ ] **Step 6: Commit**

```bash
git add src/features/topicValidator/TopicValidator.jsx
git add src/features/chapterArchitect/ChapterArchitect.jsx
git add src/features/methodology/MethodologyAdvisor.jsx
git add src/features/writingPlanner/WritingPlanner.jsx
git add src/features/projectReviewer/ProjectReviewer.jsx
git commit -m "feat: wire checkAchievements and CelebrationModal into all 5 workflow steps"
```

---

## Task 16: Wire `DefenseCelebration` into `DefensePrep`

**Files:**
- Modify: `src/features/defensePrep/DefensePrep.jsx`

- [ ] **Step 1: Add imports**

```jsx
import { checkAchievements } from '../../lib/checkAchievements'
import { shouldShowCelebration } from '../../lib/celebrations'
import { showToast } from '../../components/Toast'
import CelebrationModal from '../../components/celebration/CelebrationModal'
import DefenseCelebration from '../../components/celebration/DefenseCelebration'
```

- [ ] **Step 2: Add state**

```jsx
const [achievementModal, setAchievementModal] = useState(null)
const [defenseCelebration, setDefenseCelebration] = useState(null)
// defenseCelebration = { score } | null
```

- [ ] **Step 3: After defense session completes and score is saved, add**

Find the function/effect that handles a completed defense session (where `final_score` is set). After the DB write resolves, add:

```jsx
checkAchievements().then(newKeys => {
  // Tier 1 toasts for all newly earned achievements
  for (const key of newKeys) {
    showToast(`Achievement unlocked — ${key.replace(/_/g, ' ')} 🏅`, 'unlock')
  }

  // Tier 3: full-screen moment if certificate unlocked
  if (newKeys.includes('certified') && shouldShowCelebration('certified')) {
    setDefenseCelebration({ score: finalScore })
    return // full screen takes priority, skip modal
  }

  // Tier 2: modal for first defense session
  if (shouldShowCelebration('first_defense')) {
    setAchievementModal({
      emoji: '🛡️',
      headline: 'Defense Session Complete!',
      body: `You scored ${finalScore}/10. ${finalScore >= 7 ? 'You passed — download your certificate below.' : 'Keep practising — you can run the simulator again.'}`,
      rankLabel: null,
      ctaLabel: 'View Results',
    })
  }
})
```

- [ ] **Step 4: Render both modals in DefensePrep's JSX**

```jsx
<CelebrationModal
  open={achievementModal !== null}
  onClose={() => setAchievementModal(null)}
  emoji={achievementModal?.emoji ?? '🛡️'}
  headline={achievementModal?.headline ?? ''}
  body={achievementModal?.body ?? ''}
  rankLabel={achievementModal?.rankLabel ?? null}
  ctaLabel={achievementModal?.ctaLabel ?? 'Continue'}
  onCta={() => setAchievementModal(null)}
/>

<DefenseCelebration
  open={defenseCelebration !== null}
  score={defenseCelebration?.score ?? 0}
  onDownload={() => { /* trigger existing download flow */ setDefenseCelebration(null) }}
  onShare={() => {
    const msg = encodeURIComponent(`I just passed my FYPro Defense Simulator with a score of ${defenseCelebration?.score}/10! 🎓 Practice yours at fypro.com.ng`)
    window.open(`https://wa.me/?text=${msg}`, '_blank')
    checkAchievements({ shared: true }) // check 'shared' achievement
    setDefenseCelebration(null)
  }}
  onClose={() => setDefenseCelebration(null)}
/>
```

- [ ] **Step 5: Test in dev**

Run a complete defense session in dev. Confirm:
1. After session ends: toasts fire for any newly earned achievements
2. If first session: CelebrationModal fires
3. If score ≥ 7 first time: DefenseCelebration full-screen fires instead

- [ ] **Step 6: Commit**

```bash
git add src/features/defensePrep/DefensePrep.jsx
git commit -m "feat: wire DefenseCelebration and checkAchievements into DefensePrep"
```

---

## Task 17: Final verification

- [ ] **Step 1: TypeScript check**

```bash
npx tsc --noEmit
```
Expected: zero errors.

- [ ] **Step 2: Dev build check**

```bash
npm run build
```
Expected: builds successfully, no import errors.

- [ ] **Step 3: End-to-end walkthrough in browser**

1. Open http://localhost:5173 in dev, sign in
2. Confirm RankPill shows in sidebar — "Research Recruit 🌱" for a fresh account
3. Confirm MomentumRing shows "Cold" state on Dashboard
4. Confirm AchievementsRow shows all locked (greyed)
5. Complete Topic Validator → confirm:
   - Toast: "Achievement unlocked — first step"
   - CelebrationModal fires with "🔍 Step Complete!"
   - Sidebar RankPill updates to "Topic Explorer"
   - MomentumRing updates (+25%)
6. Navigate to /account/achievements → confirm First Step is now earned (glowing)
7. Navigate to /account/achievements → confirm hidden achievements show as `?`

- [ ] **Step 4: Commit any final fixes, then final commit**

```bash
git add -A
git commit -m "feat: complete gamification system — rank, achievements, momentum ring, celebrations"
```
