# Admin Dashboard — Four Monitoring Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add System Vitals, Unit Economics, Cache Performance, and Failed Generation Log widgets to the existing admin dashboard — without rebuilding it.

**Architecture:** Two new Supabase tables (`generation_failures`, `response_times`) feed three new admin API actions (`vitals`, `failures`, `resolve-failure`). Feature catch blocks fire-and-forget log to `generation_failures` via a centralised `logFailure` utility in `src/services/api.js`. `api/claude.js` records response times server-side. `Health.jsx` adds four widget sections with two independent refresh intervals (30s for vitals, 60s for failures) on top of the existing 5-minute main refresh.

**Tech Stack:** React 19, Vite, Supabase JS v2, Vercel Serverless Functions, inline styles (no new deps)

**Spec:** `docs/superpowers/specs/2026-05-07-admin-monitoring-widgets-design.md`

---

## File Map

| Action | File |
|--------|------|
| Create | `migrations/0003_generation_failures.sql` |
| Create | `migrations/0004_response_times.sql` |
| Modify | `api/claude.js` |
| Modify | `api/admin.js` |
| Modify | `src/services/api.js` |
| Modify | `src/features/topicValidator/TopicValidator.jsx` |
| Modify | `src/features/chapterArchitect/ChapterArchitect.jsx` |
| Modify | `src/features/methodology/MethodologyAdvisor.jsx` |
| Modify | `src/features/writingPlanner/WritingPlanner.jsx` |
| Modify | `src/features/literatureMap/LiteratureMap.jsx` |
| Modify | `src/features/projectReviewer/ProjectReviewer.jsx` |
| Modify | `src/features/defensePrep/DefensePrep.jsx` |
| Modify | `src/features/supervisorPrep/SupervisorPrep.jsx` |
| Modify | `src/pages/admin/Health.jsx` |

---

## Task 1: SQL Migrations

**Files:**
- Create: `migrations/0003_generation_failures.sql`
- Create: `migrations/0004_response_times.sql`

- [ ] **Step 1: Create `migrations/0003_generation_failures.sql`**

```sql
-- Migration: generation_failures
-- Run in Supabase SQL Editor (Dashboard → SQL Editor → New query)

CREATE TABLE IF NOT EXISTS generation_failures (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_email    text,
  feature       text NOT NULL,
  error_type    text NOT NULL,
  error_message text,
  input_preview text,
  created_at    timestamptz DEFAULT now(),
  resolved      boolean DEFAULT false
);

ALTER TABLE generation_failures ENABLE ROW LEVEL SECURITY;

-- Authenticated users can INSERT their own rows (or null user_id for pre-auth errors).
-- No SELECT/UPDATE/DELETE for clients — admin reads via service role.
CREATE POLICY "insert own failures"
  ON generation_failures FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- Index for the admin dashboard queries
CREATE INDEX IF NOT EXISTS idx_gen_failures_created_at ON generation_failures(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_gen_failures_user_id    ON generation_failures(user_id);
```

- [ ] **Step 2: Create `migrations/0004_response_times.sql`**

```sql
-- Migration: response_times
-- Run in Supabase SQL Editor after 0003

CREATE TABLE IF NOT EXISTS response_times (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  feature     text NOT NULL,
  duration_ms integer NOT NULL,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE response_times ENABLE ROW LEVEL SECURITY;
-- No client policies — service role only (written by api/claude.js)

CREATE INDEX IF NOT EXISTS idx_response_times_created_at ON response_times(created_at DESC);
```

- [ ] **Step 3: Run both migrations in Supabase SQL Editor**

Open Supabase → SQL Editor → paste and run `0003_generation_failures.sql`, then `0004_response_times.sql`.

- [ ] **Step 4: Verify tables exist**

In Supabase SQL Editor run:
```sql
SELECT tablename, rowsecurity
FROM pg_tables
WHERE schemaname = 'public'
  AND tablename IN ('generation_failures', 'response_times');
```
Expected: two rows, both with `rowsecurity = true`.

- [ ] **Step 5: Commit migration files**

```bash
git add migrations/0003_generation_failures.sql migrations/0004_response_times.sql
git commit -m "feat: add generation_failures and response_times tables"
```

---

## Task 2: Response Time Recording in `api/claude.js`

**Files:**
- Modify: `api/claude.js`

- [ ] **Step 1: Add supabaseAdmin import at top of `api/claude.js`**

The file currently starts with:
```javascript
import { rateLimitCheck } from './_lib/rate-limit.js';
import { checkDailyCap, trackUsage } from './_lib/usage-tracker.js';
import { getCached, setCached, buildCacheKey } from './_lib/cache.js';
```

Change to:
```javascript
import { rateLimitCheck } from './_lib/rate-limit.js';
import { checkDailyCap, trackUsage } from './_lib/usage-tracker.js';
import { getCached, setCached, buildCacheKey } from './_lib/cache.js';
import { supabaseAdmin } from './_lib/supabase-admin.js';
```

- [ ] **Step 2: Add `start` timer and response-time recording**

Find this block (around line 59–90 of `api/claude.js`):
```javascript
    const cached = await getCached(cacheKey);
    if (cached) {
      console.log('[claude] cache HIT for step:', prefix);
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
```

Replace with:
```javascript
    const cached = await getCached(cacheKey);
    if (cached) {
      console.log('[claude] cache HIT for step:', prefix);
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    const start = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
```

Then find the block after the Anthropic response (around line 82–90):
```javascript
    const data = await response.json();
    console.log('[claude] Anthropic responded with status:', response.status);
    if (data.usage) {
      trackUsage(data.usage.input_tokens, data.usage.output_tokens, model);
    }

    res.setHeader('X-Cache', 'MISS');
    if (response.ok) {
      setCached(cacheKey, data, ttl); // fire and forget — do not await
    }
    return res.status(response.status).json(data);
```

Replace with:
```javascript
    const data = await response.json();
    console.log('[claude] Anthropic responded with status:', response.status);
    if (data.usage) {
      trackUsage(data.usage.input_tokens, data.usage.output_tokens, model);
    }

    if (response.ok) {
      const duration = Date.now() - start;
      // fire and forget — do not await
      supabaseAdmin.from('response_times').insert({ feature: prefix, duration_ms: duration })
        .then(() => {})
        .catch(() => {});
      setCached(cacheKey, data, ttl);
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(response.status).json(data);
```

- [ ] **Step 3: Verify build passes**

```bash
npm run build
```
Expected: exits 0, no errors about `supabaseAdmin`.

- [ ] **Step 4: Smoke-test (optional — requires local Vercel dev)**

If running `vercel dev` locally: make any API call through a feature, then check Supabase → Table Editor → `response_times` for a new row.

- [ ] **Step 5: Commit**

```bash
git add api/claude.js
git commit -m "feat: record response_times after each successful Claude API call"
```

---

## Task 3: `logFailure` Utility in `src/services/api.js`

**Files:**
- Modify: `src/services/api.js`

- [ ] **Step 1: Add `logFailure` export at the bottom of `src/services/api.js`**

The file already imports `supabase` at the top (`import { supabase } from '../lib/supabase';`). Add this function before the final exports, at the end of the file:

```javascript
// ── Failure logging ───────────────────────────────────────────────────────────
// Call from every feature's catch block. Never throws — never affects UX.
export async function logFailure(feature, err, inputPreview = '') {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    await supabase.from('generation_failures').insert({
      user_id:       session?.user?.id    || null,
      user_email:    session?.user?.email || null,
      feature,
      error_type:    err?.code === 'RATE_LIMIT'      ? 'rate_limit'
                   : err?.code === 'GATEWAY_TIMEOUT' ? 'timeout'
                   : 'generic',
      error_message: err?.message || 'Unknown error',
      input_preview: String(inputPreview).substring(0, 100),
    });
  } catch {
    // silent — never affect UX
  }
}
```

- [ ] **Step 2: Verify build passes**

```bash
npm run build
```
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add src/services/api.js
git commit -m "feat: add logFailure utility to api.js for generation failure tracking"
```

---

## Task 4: Feature Catch Blocks — Batch 1 (Four Simple Files)

Adds one `logFailure` call to the single catch block in each of four files. All four follow the identical pattern.

**Files:**
- Modify: `src/features/topicValidator/TopicValidator.jsx`
- Modify: `src/features/writingPlanner/WritingPlanner.jsx`
- Modify: `src/features/literatureMap/LiteratureMap.jsx`
- Modify: `src/features/supervisorPrep/SupervisorPrep.jsx`

- [ ] **Step 1: Update import in `TopicValidator.jsx`**

Find:
```javascript
import { validateTopic, handleApiError } from '../../services/api'
```
Replace with:
```javascript
import { validateTopic, handleApiError, logFailure } from '../../services/api'
```

- [ ] **Step 2: Add `logFailure` to `TopicValidator.jsx` catch block**

Find:
```javascript
      .catch(err => {
        setSection('input')
        if (!handleApiError(err, msg => {
          setError(msg)
          // Re-enable button after rate-limit countdown clears the message
          if (!msg) setBtnDisabled(false)
        })) {
          setBtnDisabled(false)
          setError('Something went wrong. Please check your connection and try again.')
        }
      })
```
Replace with:
```javascript
      .catch(err => {
        logFailure('Topic Validator', err, topic.trim())
        setSection('input')
        if (!handleApiError(err, msg => {
          setError(msg)
          // Re-enable button after rate-limit countdown clears the message
          if (!msg) setBtnDisabled(false)
        })) {
          setBtnDisabled(false)
          setError('Something went wrong. Please check your connection and try again.')
        }
      })
```

- [ ] **Step 3: Update import in `WritingPlanner.jsx`**

Find:
```javascript
import { buildWritingPlan, handleApiError } from '../../services/api'
```
Replace with:
```javascript
import { buildWritingPlan, handleApiError, logFailure } from '../../services/api'
```

- [ ] **Step 4: Add `logFailure` to `WritingPlanner.jsx` catch block**

Find:
```javascript
      .catch(err => {
        setSection('input')
        if (!handleApiError(err, msg => {
          setError(msg)
          if (!msg) setBtnDisabled(false)
        })) {
          setBtnDisabled(false)
          setError('Something went wrong. Please check your connection and try again.')
        }
      })
```
Replace with:
```javascript
      .catch(err => {
        logFailure('Writing Planner', err, dateValue)
        setSection('input')
        if (!handleApiError(err, msg => {
          setError(msg)
          if (!msg) setBtnDisabled(false)
        })) {
          setBtnDisabled(false)
          setError('Something went wrong. Please check your connection and try again.')
        }
      })
```

- [ ] **Step 5: Update import in `LiteratureMap.jsx`**

Find:
```javascript
import { generateLiteratureMap, handleApiError } from '../../services/api'
```
Replace with:
```javascript
import { generateLiteratureMap, handleApiError, logFailure } from '../../services/api'
```

- [ ] **Step 6: Add `logFailure` to `LiteratureMap.jsx` catch block**

Find:
```javascript
      .catch(err => {
        setSection('input')
        setBtnDisabled(false)
        if (!handleApiError(err, msg => setError(msg))) {
          setError('Something went wrong generating the literature map. Please try again.')
        }
      })
```
Replace with:
```javascript
      .catch(err => {
        logFailure('Literature Map', err, state.validatedTopic || '')
        setSection('input')
        setBtnDisabled(false)
        if (!handleApiError(err, msg => setError(msg))) {
          setError('Something went wrong generating the literature map. Please try again.')
        }
      })
```

- [ ] **Step 7: Update import in `SupervisorPrep.jsx`**

Find:
```javascript
import { prepareSupervisorMeeting, handleApiError } from '../../services/api'
```
Replace with:
```javascript
import { prepareSupervisorMeeting, handleApiError, logFailure } from '../../services/api'
```

- [ ] **Step 8: Add `logFailure` to `SupervisorPrep.jsx` catch block**

Find:
```javascript
      .catch(err => {
        setSection('input')
        if (!handleApiError(err, msg => {
          setError(msg)
          if (!msg) setBtnDisabled(false)
        })) {
          setBtnDisabled(false)
          setError('Something went wrong. Please check your connection and try again.')
        }
      })
```
Replace with:
```javascript
      .catch(err => {
        logFailure('Meeting Prep', err, `${stage} | ${stuckOn.trim()}`)
        setSection('input')
        if (!handleApiError(err, msg => {
          setError(msg)
          if (!msg) setBtnDisabled(false)
        })) {
          setBtnDisabled(false)
          setError('Something went wrong. Please check your connection and try again.')
        }
      })
```

- [ ] **Step 9: Build check**

```bash
npm run build
```
Expected: exits 0, no import errors.

- [ ] **Step 10: Commit**

```bash
git add src/features/topicValidator/TopicValidator.jsx \
        src/features/writingPlanner/WritingPlanner.jsx \
        src/features/literatureMap/LiteratureMap.jsx \
        src/features/supervisorPrep/SupervisorPrep.jsx
git commit -m "feat: add logFailure to TopicValidator, WritingPlanner, LiteratureMap, SupervisorPrep"
```

---

## Task 5: Feature Catch Blocks — `ChapterArchitect.jsx`

Three catch blocks: initial generate, regenerate, and abstract generator.

**Files:**
- Modify: `src/features/chapterArchitect/ChapterArchitect.jsx`

- [ ] **Step 1: Update import**

Find:
```javascript
import { buildChapters, generateAbstract, handleApiError } from '../../services/api'
```
Replace with:
```javascript
import { buildChapters, generateAbstract, handleApiError, logFailure } from '../../services/api'
```

- [ ] **Step 2: Add `logFailure` to the initial `handleGenerate` catch block**

Find (the first `.catch` after `buildChapters`):
```javascript
      .catch(err => {
        setSection('input')
        if (!handleApiError(err, msg => {
          setError(msg)
          if (!msg) setBtnDisabled(false)
        })) {
          setBtnDisabled(false)
          setError('Something went wrong. Please check your connection and try again.')
        }
      })
  }

  function handleRegenerate() {
```
Replace with:
```javascript
      .catch(err => {
        logFailure('Chapter Architect', err, state.validatedTopic || '')
        setSection('input')
        if (!handleApiError(err, msg => {
          setError(msg)
          if (!msg) setBtnDisabled(false)
        })) {
          setBtnDisabled(false)
          setError('Something went wrong. Please check your connection and try again.')
        }
      })
  }

  function handleRegenerate() {
```

- [ ] **Step 3: Add `logFailure` to the `handleRegenerate` catch block**

Find (the `.catch` after the second `buildChapters` call, inside `handleRegenerate`):
```javascript
      .catch(err => {
        setSection('result')
        if (!handleApiError(err, msg => setResultError(msg))) {
          setResultError('Regeneration failed. Your previous structure is still displayed.')
        }
      })
  }
```
Replace with:
```javascript
      .catch(err => {
        logFailure('Chapter Architect', err, state.validatedTopic || '')
        setSection('result')
        if (!handleApiError(err, msg => setResultError(msg))) {
          setResultError('Regeneration failed. Your previous structure is still displayed.')
        }
      })
  }
```

- [ ] **Step 4: Add `logFailure` to the `handleGenerateAbstract` catch block**

Find (the `.catch` after `generateAbstract`):
```javascript
      .catch(err => {
        setAgSection('input')
        if (!handleApiError(err, msg => {
          setAgError(msg)
          if (!msg) setAgBtnDisabled(false)
        })) {
          setAgBtnDisabled(false)
          setAgError('Something went wrong generating the abstract. Please try again.')
        }
      })
```
Replace with:
```javascript
      .catch(err => {
        logFailure('Abstract Generator', err, state.validatedTopic || '')
        setAgSection('input')
        if (!handleApiError(err, msg => {
          setAgError(msg)
          if (!msg) setAgBtnDisabled(false)
        })) {
          setAgBtnDisabled(false)
          setAgError('Something went wrong generating the abstract. Please try again.')
        }
      })
```

- [ ] **Step 5: Build check**

```bash
npm run build
```

- [ ] **Step 6: Commit**

```bash
git add src/features/chapterArchitect/ChapterArchitect.jsx
git commit -m "feat: add logFailure to ChapterArchitect and AbstractGenerator catch blocks"
```

---

## Task 6: Feature Catch Blocks — `MethodologyAdvisor.jsx`

Two catch blocks: methodology advisor and instrument builder.

**Files:**
- Modify: `src/features/methodology/MethodologyAdvisor.jsx`

- [ ] **Step 1: Update import**

Find:
```javascript
import { adviseMethodology, buildInstrument, handleApiError } from '../../services/api'
```
Replace with:
```javascript
import { adviseMethodology, buildInstrument, handleApiError, logFailure } from '../../services/api'
```

- [ ] **Step 2: Add `logFailure` to `handleAnalyse` catch block**

Find:
```javascript
      .catch(err => {
        setMaSection('input')
        if (!handleApiError(err, msg => {
          setMaError(msg)
          if (!msg) setMaBtnDisabled(false)
        })) {
          setMaBtnDisabled(false)
          setMaError('Something went wrong. Please check your connection and try again.')
        }
      })
  }
```
Replace with:
```javascript
      .catch(err => {
        logFailure('Methodology Advisor', err, state.validatedTopic || '')
        setMaSection('input')
        if (!handleApiError(err, msg => {
          setMaError(msg)
          if (!msg) setMaBtnDisabled(false)
        })) {
          setMaBtnDisabled(false)
          setMaError('Something went wrong. Please check your connection and try again.')
        }
      })
  }
```

- [ ] **Step 3: Add `logFailure` to `handleGenerateInstrument` catch block**

Find:
```javascript
      .catch(err => {
        setDiSection('input')
        if (!handleApiError(err, msg => {
          setDiError(msg)
          if (!msg) setDiGenBtnDisabled(false)
        })) {
          setDiGenBtnDisabled(false)
          setDiError('Something went wrong. Please check your connection and try again.')
        }
      })
  }
```
Replace with:
```javascript
      .catch(err => {
        logFailure('Instrument Builder', err, selectedMethodology || '')
        setDiSection('input')
        if (!handleApiError(err, msg => {
          setDiError(msg)
          if (!msg) setDiGenBtnDisabled(false)
        })) {
          setDiGenBtnDisabled(false)
          setDiError('Something went wrong. Please check your connection and try again.')
        }
      })
  }
```

- [ ] **Step 4: Build check and commit**

```bash
npm run build
git add src/features/methodology/MethodologyAdvisor.jsx
git commit -m "feat: add logFailure to MethodologyAdvisor and InstrumentBuilder catch blocks"
```

---

## Task 7: Feature Catch Blocks — `ProjectReviewer.jsx`

One catch block — the final `catch (err)` in `handleReview`.

**Files:**
- Modify: `src/features/projectReviewer/ProjectReviewer.jsx`

- [ ] **Step 1: Find and add the import**

Find the existing api import line (it will include `reviewProject`, `reviewProjectPDF`, etc.). Add `logFailure` to whatever is already imported from `../../services/api`. For example, if it reads:
```javascript
import { reviewProject, reviewProjectPDF, checkDocumentRelevance, checkDocumentRelevancePDF, handleApiError } from '../../services/api'
```
Add `, logFailure` before the closing `}`.

- [ ] **Step 2: Add `logFailure` to the main review catch block**

Find:
```javascript
    } catch (err) {
      setIsProcessing(false)
      setSection('input')
      handleApiError(err, msg => setError(msg || 'Something went wrong during the review. Please try again.'))
    }
  }
```
Replace with:
```javascript
    } catch (err) {
      logFailure('Project Reviewer', err, selectedFile?.name || '')
      setIsProcessing(false)
      setSection('input')
      handleApiError(err, msg => setError(msg || 'Something went wrong during the review. Please try again.'))
    }
  }
```

- [ ] **Step 3: Build check and commit**

```bash
npm run build
git add src/features/projectReviewer/ProjectReviewer.jsx
git commit -m "feat: add logFailure to ProjectReviewer catch block"
```

---

## Task 8: Feature Catch Blocks — `DefensePrep.jsx`

Four catch blocks. Three use bare `catch {}` — these need to become `catch (err) {}`.

**Files:**
- Modify: `src/features/defensePrep/DefensePrep.jsx`

- [ ] **Step 1: Add `logFailure` to import**

Find the existing import from `../../services/api`. It includes `detectRedFlags`, `panelFirstQuestion`, `panelFollowUp`, `panelSummary`, `handleApiError`. Add `, logFailure` to the list.

- [ ] **Step 2: Add `logFailure` to the red-flag scan catch block**

This catch already has `err`. Find:
```javascript
    } catch (err) {
      setIsScanning(false)
      setSection('input')
      handleApiError(err, msg => setScanError(msg))
    }
  }
```
Replace with:
```javascript
    } catch (err) {
      logFailure('Defense Simulator', err, state.validatedTopic || '')
      setIsScanning(false)
      setSection('input')
      handleApiError(err, msg => setScanError(msg))
    }
  }
```

- [ ] **Step 3: Convert bare catch and add `logFailure` in `getFirstQuestion`**

Find:
```javascript
    } catch {
      setTypingVisible(false)
      addMsg({
        type:     'examiner',
        examiner: 'The Methodologist',
        text:     'There was a connection issue. Please end the session and try again.',
      })
    }
  }

  // ── student submit ────────────────────────────────────────────────────────
```
Replace with:
```javascript
    } catch (err) {
      logFailure('Defense Simulator', err, state.validatedTopic || '')
      setTypingVisible(false)
      addMsg({
        type:     'examiner',
        examiner: 'The Methodologist',
        text:     'There was a connection issue. Please end the session and try again.',
      })
    }
  }

  // ── student submit ────────────────────────────────────────────────────────
```

- [ ] **Step 4: Convert bare catch and add `logFailure` in `handleStudentSubmit`**

Find:
```javascript
    } catch {
      setTypingVisible(false)
      addMsg({
        type:     'examiner',
        examiner: currentExaminerRef.current,
        text:     'There was a connection issue. Please try submitting your answer again.',
      })
      setInputLocked(false)
    }
  }

  // ── end session ───────────────────────────────────────────────────────────
```
Replace with:
```javascript
    } catch (err) {
      logFailure('Defense Simulator', err, answer.substring(0, 100))
      setTypingVisible(false)
      addMsg({
        type:     'examiner',
        examiner: currentExaminerRef.current,
        text:     'There was a connection issue. Please try submitting your answer again.',
      })
      setInputLocked(false)
    }
  }

  // ── end session ───────────────────────────────────────────────────────────
```

- [ ] **Step 5: Convert bare catch and add `logFailure` in `doEndSession`**

Find:
```javascript
    } catch {
      setVerdictLoading(false)
      setEndEnabled(true)
      addMsg({
        type:     'examiner',
        examiner: currentExaminerRef.current,
        text:     'Something went wrong generating your verdict. Tap "End Defence Session" to try again.',
      })
    }
  }
```
Replace with:
```javascript
    } catch (err) {
      logFailure('Defense Simulator', err, '')
      setVerdictLoading(false)
      setEndEnabled(true)
      addMsg({
        type:     'examiner',
        examiner: currentExaminerRef.current,
        text:     'Something went wrong generating your verdict. Tap "End Defence Session" to try again.',
      })
    }
  }
```

- [ ] **Step 6: Build check and commit**

```bash
npm run build
git add src/features/defensePrep/DefensePrep.jsx
git commit -m "feat: add logFailure to all DefensePrep catch blocks"
```

---

## Task 9: `api/admin.js` — Update Dashboard Action

Adds `revenue_today_ngn`, `paying_users_today`, `ngn_per_usd` to the dashboard response.

**Files:**
- Modify: `api/admin.js`

- [ ] **Step 1: Add `todayPaymentsRes` to the parallel fetch in `handleDashboard`**

Find this `Promise.all` array (around line 160):
```javascript
    const [authRes, paymentsRes, projectsRes, entitlementsRes, usageRes, cacheHits, failedPaymentsRes, signupsYesterdayRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 }),
      supabaseAdmin.from('payments').select('user_id, amount_kobo, status, created_at, tier').eq('status', 'success'),
      supabaseAdmin.from('projects').select('user_id, created_at'),
      supabaseAdmin.from('user_entitlements').select('user_id, run_counts').not('run_counts', 'is', null),
      supabaseAdmin.from('daily_usage').select('total_cost_usd, request_count').eq('date', today).maybeSingle(),
      readCacheHits(),
      supabaseAdmin.from('payments').select('*', { count: 'exact', head: true }).neq('status', 'success').gte('created_at', todayStart),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart),
    ]);
```
Replace with:
```javascript
    const [authRes, paymentsRes, projectsRes, entitlementsRes, usageRes, cacheHits, failedPaymentsRes, signupsYesterdayRes, todayPaymentsRes] = await Promise.all([
      supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 }),
      supabaseAdmin.from('payments').select('user_id, amount_kobo, status, created_at, tier').eq('status', 'success'),
      supabaseAdmin.from('projects').select('user_id, created_at'),
      supabaseAdmin.from('user_entitlements').select('user_id, run_counts').not('run_counts', 'is', null),
      supabaseAdmin.from('daily_usage').select('total_cost_usd, request_count').eq('date', today).maybeSingle(),
      readCacheHits(),
      supabaseAdmin.from('payments').select('*', { count: 'exact', head: true }).neq('status', 'success').gte('created_at', todayStart),
      supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', yesterdayStart).lt('created_at', todayStart),
      supabaseAdmin.from('payments').select('user_id, amount_kobo').eq('status', 'success').gte('created_at', todayStart),
    ]);
```

- [ ] **Step 2: Compute today's revenue and paying user count**

After the existing destructuring block (after `const signupsYesterday = signupsYesterdayRes.count || 0;`), add:
```javascript
    const todayPayments      = todayPaymentsRes.data || [];
    const revenueTodayNgn    = todayPayments.reduce((sum, p) => sum + Math.round((p.amount_kobo || 0) / 100), 0);
    const payingUsersToday   = new Set(todayPayments.map(p => p.user_id)).size;
    const ngnPerUsd          = parseFloat(process.env.NGN_PER_USD || '1600');
```

- [ ] **Step 3: Add new fields to the return statement**

Find the return statement (around line 344):
```javascript
    return res.status(200).json({
      overview: {
        ...
      },
      ...
      failed_payments_today: failedPaymentsToday,
      signups_yesterday:     signupsYesterday,
    });
```
Add three fields before the closing `});`:
```javascript
      failed_payments_today: failedPaymentsToday,
      signups_yesterday:     signupsYesterday,
      revenue_today_ngn:     revenueTodayNgn,
      paying_users_today:    payingUsersToday,
      ngn_per_usd:           ngnPerUsd,
    });
```

- [ ] **Step 4: Build check and commit**

```bash
npm run build
git add api/admin.js
git commit -m "feat: add revenue_today_ngn, paying_users_today, ngn_per_usd to dashboard response"
```

---

## Task 10: `api/admin.js` — Add `vitals` Action

**Files:**
- Modify: `api/admin.js`

- [ ] **Step 1: Add `handleVitals` function before `verifyAdmin`**

Insert this function before the `// Shared admin JWT gate` comment:
```javascript
// action: "vitals" — system health stats, polled every 30s by the admin dashboard
async function handleVitals(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const today      = new Date().toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00.000Z`;
    const tenMinsAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();

    const [recentTimesRes, latestTimeRes, failuresTodayRes, usageRes, activeSessionsRes] = await Promise.all([
      supabaseAdmin
        .from('response_times')
        .select('duration_ms')
        .order('created_at', { ascending: false })
        .limit(10),
      supabaseAdmin
        .from('response_times')
        .select('created_at')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabaseAdmin
        .from('generation_failures')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart),
      supabaseAdmin
        .from('daily_usage')
        .select('request_count')
        .eq('date', today)
        .maybeSingle(),
      supabaseAdmin
        .from('generation_failures')
        .select('user_id')
        .gte('created_at', tenMinsAgo),
    ]);

    const times = recentTimesRes.data || [];
    const avgMs = times.length > 0
      ? Math.round(times.reduce((s, r) => s + r.duration_ms, 0) / times.length)
      : 0;

    const activeUserIds = new Set(
      (activeSessionsRes.data || []).map(r => r.user_id).filter(Boolean)
    );

    return res.status(200).json({
      avg_response_ms:  avgMs,
      last_call_at:     latestTimeRes.data?.created_at || null,
      failures_today:   failuresTodayRes.count || 0,
      requests_today:   usageRes.data?.request_count || 0,
      active_sessions:  activeUserIds.size,
    });
  } catch (err) {
    console.error('[admin/vitals] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
```

- [ ] **Step 2: Register the action in the `handler` function**

Find:
```javascript
  if (action === 'health')       return handleHealth(req, res);
  if (action === 'alert-check')  return handleAlertCheck(req, res);
  if (action === 'dashboard')    return handleDashboard(req, res);
  if (action === 'delete-user')  return handleDeleteUser(req, res);
  if (action === 'ban-user')     return handleBanUser(req, res);
  if (action === 'self-delete')  return handleSelfDelete(req, res);
```
Replace with:
```javascript
  if (action === 'health')          return handleHealth(req, res);
  if (action === 'alert-check')     return handleAlertCheck(req, res);
  if (action === 'dashboard')       return handleDashboard(req, res);
  if (action === 'vitals')          return handleVitals(req, res);
  if (action === 'delete-user')     return handleDeleteUser(req, res);
  if (action === 'ban-user')        return handleBanUser(req, res);
  if (action === 'self-delete')     return handleSelfDelete(req, res);
```

- [ ] **Step 3: Build check and commit**

```bash
npm run build
git add api/admin.js
git commit -m "feat: add admin vitals action for system health polling"
```

---

## Task 11: `api/admin.js` — Add `failures` and `resolve-failure` Actions

**Files:**
- Modify: `api/admin.js`

- [ ] **Step 1: Add `handleFailures` function**

Insert before `handleVitals` (or after it — order doesn't matter):
```javascript
// action: "failures" — last 20 generation failures, polled every 60s
async function handleFailures(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  try {
    const today      = new Date().toISOString().slice(0, 10);
    const todayStart = `${today}T00:00:00.000Z`;

    const [rowsRes, countRes] = await Promise.all([
      supabaseAdmin
        .from('generation_failures')
        .select('id, user_email, feature, error_type, input_preview, created_at, resolved')
        .order('created_at', { ascending: false })
        .limit(20),
      supabaseAdmin
        .from('generation_failures')
        .select('*', { count: 'exact', head: true })
        .gte('created_at', todayStart),
    ]);

    return res.status(200).json({
      rows:        rowsRes.data  || [],
      total_today: countRes.count || 0,
    });
  } catch (err) {
    console.error('[admin/failures] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
```

- [ ] **Step 2: Add `handleResolveFailure` function**

```javascript
// action: "resolve-failure" — mark a generation_failures row as resolved
async function handleResolveFailure(req, res) {
  const caller = await verifyAdmin(req, res);
  if (!caller) return;

  const { id } = req.body || {};
  if (!id) return res.status(400).json({ error: 'id required' });

  try {
    const { error } = await supabaseAdmin
      .from('generation_failures')
      .update({ resolved: true })
      .eq('id', id);
    if (error) throw error;
    return res.status(200).json({ ok: true });
  } catch (err) {
    console.error('[admin/resolve-failure] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
```

- [ ] **Step 3: Register both actions in `handler`**

Find the updated handler block from Task 10:
```javascript
  if (action === 'vitals')          return handleVitals(req, res);
  if (action === 'delete-user')     return handleDeleteUser(req, res);
```
Replace with:
```javascript
  if (action === 'vitals')          return handleVitals(req, res);
  if (action === 'failures')        return handleFailures(req, res);
  if (action === 'resolve-failure') return handleResolveFailure(req, res);
  if (action === 'delete-user')     return handleDeleteUser(req, res);
```

- [ ] **Step 4: Build check and commit**

```bash
npm run build
git add api/admin.js
git commit -m "feat: add failures and resolve-failure admin actions"
```

---

## Task 12: `Health.jsx` — New Sub-components, State, and Effects

Adds helper components and all new state/effects to `AdminHealth` — no JSX rendered yet.

**Files:**
- Modify: `src/pages/admin/Health.jsx`

- [ ] **Step 1: Add `VitalCard` helper component**

Place it after the existing `ChartCard` component definition (after the `tooltipStyle` object):
```javascript
function VitalCard({ label, value, color, pulse }) {
  return (
    <div style={{
      flex: '1 1 0', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 8,
      background: 'rgba(13,27,42,0.8)',
      border: `1px solid ${BORDER}`,
      borderRadius: 10, padding: 16,
    }}>
      <div style={{
        width: 12, height: 12, borderRadius: '50%', background: color,
        ...(pulse ? { animation: 'pulse-dot 1.5s ease-in-out infinite' } : {}),
      }} />
      <div style={{
        fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED,
        textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'center',
      }}>{label}</div>
      <div style={{
        fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: WHITE,
      }}>{value}</div>
    </div>
  )
}
```

- [ ] **Step 2: Add `timeAgo` helper function**

Place it after `fmtChartDate`:
```javascript
function timeAgo(iso) {
  const seconds = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (seconds < 60)  return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60)  return `${minutes} min${minutes === 1 ? '' : 's'} ago`
  const hours = Math.floor(minutes / 60)
  return `${hours}h ago`
}
```

- [ ] **Step 3: Add new state variables inside `AdminHealth`**

Find (inside `AdminHealth`, after the existing `const [actionState...` line):
```javascript
  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
```
Insert the new state declarations before that line:
```javascript
  // Vitals widget — 30s refresh
  const [vitals, setVitals]               = useState(null)
  const [vitalsLoading, setVitalsLoading] = useState(true)
  const vitalsTimerRef                    = useRef(null)

  // Failures widget — 60s refresh
  const [failures, setFailures]               = useState(null)
  const [failuresLoading, setFailuresLoading] = useState(true)
  const failuresTimerRef                      = useRef(null)
  const [resolvingId, setResolvingId]         = useState(null)

  const adminEmail = import.meta.env.VITE_ADMIN_EMAIL
```

- [ ] **Step 4: Add `loadVitals` and `loadFailures` callbacks, and their `useEffect` timers**

Find the existing `const loadData = useCallback(...)` block. After it (and after the existing `useEffect` for main data), add:
```javascript
  const loadVitals = useCallback(() => {
    if (!session?.access_token) return
    fetch('/api/admin?action=vitals', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (!d.error) setVitals(d) })
      .catch(() => {})
      .finally(() => setVitalsLoading(false))
  }, [session?.access_token])

  useEffect(() => {
    if (!isAdmin || !session) return
    loadVitals()
    vitalsTimerRef.current = setInterval(loadVitals, 30_000)
    return () => clearInterval(vitalsTimerRef.current)
  }, [isAdmin, session, loadVitals])

  const loadFailures = useCallback(() => {
    if (!session?.access_token) return
    fetch('/api/admin?action=failures', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
      .then(r => r.json())
      .then(d => { if (!d.error) setFailures(d) })
      .catch(() => {})
      .finally(() => setFailuresLoading(false))
  }, [session?.access_token])

  useEffect(() => {
    if (!isAdmin || !session) return
    loadFailures()
    failuresTimerRef.current = setInterval(loadFailures, 60_000)
    return () => clearInterval(failuresTimerRef.current)
  }, [isAdmin, session, loadFailures])
```

- [ ] **Step 5: Add `handleResolveFailure` action handler**

After `handleBanUser`, add:
```javascript
  async function handleResolveFailure(id) {
    setResolvingId(id)
    try {
      const res = await fetch('/api/admin?action=resolve-failure', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) return
      // Optimistic update — mark row resolved locally
      setFailures(prev => prev ? {
        ...prev,
        rows: prev.rows.map(r => r.id === id ? { ...r, resolved: true } : r),
      } : prev)
    } catch {
      // non-fatal
    } finally {
      setResolvingId(null)
    }
  }
```

- [ ] **Step 6: Add new fields to the data destructure**

Find:
```javascript
  const { overview, revenue_chart, signups_chart, feature_usage, funnel, never_converted,
          daily_spend, cache_hit_rate, top_active_users, failed_payments_today, signups_yesterday } = data
```
Replace with:
```javascript
  const { overview, revenue_chart, signups_chart, feature_usage, funnel, never_converted,
          daily_spend, cache_hit_rate, top_active_users, failed_payments_today, signups_yesterday,
          revenue_today_ngn, paying_users_today, ngn_per_usd } = data
```

- [ ] **Step 7: Build check**

```bash
npm run build
```
Expected: exits 0. (No new JSX rendered yet — just logic.)

- [ ] **Step 8: Commit**

```bash
git add src/pages/admin/Health.jsx
git commit -m "feat: add vitals/failures state, effects, and helpers to AdminHealth"
```

---

## Task 13: `Health.jsx` — Widget 4: System Vitals

Renders four traffic-light cards at the very top of the dashboard.

**Files:**
- Modify: `src/pages/admin/Health.jsx`

- [ ] **Step 1: Add `@keyframes pulse-dot` style tag + System Vitals section**

Find in the return JSX:
```jsx
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 36, flexWrap: 'wrap', gap: 16 }}>
```
Insert before the header div:
```jsx
      {/* Keyframe for pulsing red vitals dot */}
      <style>{`
        @keyframes pulse-dot {
          0%, 100% { transform: scale(1); opacity: 1; }
          50%       { transform: scale(1.3); opacity: 0.6; }
        }
      `}</style>
```

- [ ] **Step 2: Insert System Vitals section after the header block**

Find:
```jsx
      {/* ── SECTION 1: Overview Cards ─────────────────────────────── */}
```
Insert immediately before it:
```jsx
      {/* ── Widget 4 — System Vitals ──────────────────────────────── */}
      <SectionHeading title="System Vitals" />
      <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
        {vitalsLoading ? (
          [0,1,2,3].map(i => (
            <div key={i} style={{
              flex: '1 1 0', height: 100,
              background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${BORDER}`,
              borderRadius: 10,
            }} />
          ))
        ) : (() => {
          const aiOk      = !!(vitals?.last_call_at && new Date(vitals.last_call_at).getTime() > Date.now() - 5 * 60 * 1000)
          const avgMs     = vitals?.avg_response_ms ?? 0
          const avgS      = (avgMs / 1000).toFixed(1)
          const avgColor  = avgMs === 0 ? RED : avgMs < 15000 ? GREEN : avgMs < 30000 ? AMBER : RED
          const errPct    = vitals?.requests_today > 0
            ? (vitals.failures_today / vitals.requests_today) * 100
            : 0
          const errStr    = errPct.toFixed(1)
          const errColor  = errPct < 2 ? GREEN : errPct < 5 ? AMBER : RED
          return (
            <>
              <VitalCard
                label="AI Engine"
                value={aiOk ? 'Operational' : 'Degraded'}
                color={aiOk ? GREEN : RED}
                pulse={!aiOk}
              />
              <VitalCard
                label={`Avg Response: ${avgS}s`}
                value={avgMs === 0 ? 'No data' : `${avgS}s`}
                color={avgColor}
                pulse={avgMs > 30000 || avgMs === 0}
              />
              <VitalCard
                label={`Error Rate: ${errStr}%`}
                value={`${errStr}%`}
                color={errColor}
                pulse={errPct >= 5}
              />
              <VitalCard
                label="Active Now"
                value={String(vitals?.active_sessions ?? 0)}
                color={BLUE}
                pulse={false}
              />
            </>
          )
        })()}
      </div>
```

- [ ] **Step 3: Build check and visual verify**

```bash
npm run build
```
Then open the admin dashboard in the browser. You should see four cards labelled "AI Engine", "Avg Response", "Error Rate", "Active Now" at the top of the page — all showing skeleton placeholders until the vitals fetch completes.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/Health.jsx
git commit -m "feat: add System Vitals widget to admin dashboard"
```

---

## Task 14: `Health.jsx` — Widget 1: Unit Economics

Renders a three-stat card below the overview row.

**Files:**
- Modify: `src/pages/admin/Health.jsx`

- [ ] **Step 1: Remove the existing small cache OverviewCard**

Find and delete:
```jsx
        {cache_hit_rate && (
          <OverviewCard
            label="Cache Hit Rate"
            value={`${cache_hit_rate.hit_rate_pct}%`}
            sub={`${(cache_hit_rate.hits_total ?? 0).toLocaleString()} hits today`}
            accent={BLUE}
          />
        )}
```
(Cache performance will now live in its own dedicated Widget 3 card below.)

- [ ] **Step 2: Add Unit Economics card after the overview row**

Find:
```jsx
      {/* ── SECTION 2: User Table ──────────────────────────────────── */}
```
Insert immediately before it:
```jsx
      {/* ── Widget 1 — Unit Economics ─────────────────────────────── */}
      {(() => {
        const costPerUser   = overview.active_today > 0
          ? (daily_spend.spent_usd * (ngn_per_usd ?? 1600)) / overview.active_today
          : null
        const revPerUser    = paying_users_today > 0
          ? (revenue_today_ngn ?? 0) / paying_users_today
          : null
        const marginPct     = costPerUser != null && revPerUser != null && revPerUser > 0
          ? ((revPerUser - costPerUser) / revPerUser) * 100
          : null

        const costColor   = costPerUser == null ? MUTED
          : costPerUser < 200 ? GREEN : costPerUser < 400 ? AMBER : RED
        const marginColor = marginPct == null ? MUTED
          : marginPct > 60 ? GREEN : marginPct > 30 ? AMBER : RED

        const statStyle = {
          flex: 1,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        }
        const valStyle = (color) => ({
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 26, fontWeight: 700, color,
          lineHeight: 1,
        })
        const lblStyle = {
          fontFamily: "'Poppins', sans-serif",
          fontSize: 11, color: MUTED,
          textTransform: 'uppercase', letterSpacing: '0.06em',
          marginBottom: 6,
        }

        return (
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`, borderTop: `3px solid ${AMBER}`,
            borderRadius: 12, padding: '20px 24px', marginBottom: 8,
          }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 20 }}>
              Unit Economics — Today
            </div>
            <div style={{ display: 'flex', gap: 24 }}>
              <div style={statStyle}>
                <div style={lblStyle}>Cost Per User</div>
                <div style={valStyle(costColor)}>
                  {costPerUser != null ? `₦${costPerUser.toFixed(2)}` : '—'}
                </div>
              </div>
              <div style={{ width: 1, background: BORDER, alignSelf: 'stretch' }} />
              <div style={statStyle}>
                <div style={lblStyle}>Revenue Per User</div>
                <div style={valStyle(WHITE)}>
                  {revPerUser != null ? `₦${revPerUser.toFixed(2)}` : '—'}
                </div>
              </div>
              <div style={{ width: 1, background: BORDER, alignSelf: 'stretch' }} />
              <div style={statStyle}>
                <div style={lblStyle}>Profit Margin Per User</div>
                <div style={valStyle(marginColor)}>
                  {marginPct != null ? `${marginPct.toFixed(1)}%` : '—'}
                </div>
              </div>
            </div>
          </div>
        )
      })()}
```

- [ ] **Step 3: Build check and visual verify**

```bash
npm run build
```
Open admin dashboard. Below the overview cards row you should see "UNIT ECONOMICS — TODAY" with three stats. If no payments today all values show `—`.

- [ ] **Step 4: Commit**

```bash
git add src/pages/admin/Health.jsx
git commit -m "feat: add Unit Economics widget and remove redundant cache OverviewCard"
```

---

## Task 15: `Health.jsx` — Widget 3: Cache Performance

Replaces the removed small OverviewCard with a dedicated cache card.

**Files:**
- Modify: `src/pages/admin/Health.jsx`

- [ ] **Step 1: Add Cache Performance card after Unit Economics**

Find (the line you just added ends just before `{/* ── SECTION 2: User Table`). Insert between the Unit Economics card and the User Table section:

```jsx
      {/* ── Widget 3 — Cache Performance ─────────────────────────── */}
      {cache_hit_rate && (() => {
        const hitRate   = cache_hit_rate.hit_rate_pct ?? 0
        const hits      = cache_hit_rate.hits_total   ?? 0
        const freshCalls = Math.max(0, (daily_spend.request_count || 0) - hits)
        const ngnRate   = ngn_per_usd ?? 1600
        const avgCostPerFresh = freshCalls > 0
          ? daily_spend.spent_usd / freshCalls
          : 0
        const savingsNgn = Math.round(hits * avgCostPerFresh * ngnRate)

        const hitColor = hitRate >= 25 ? GREEN : hitRate >= 10 ? AMBER : RED

        return (
          <div style={{
            background: CARD, border: `1px solid ${BORDER}`, borderTop: `3px solid ${BLUE}`,
            borderRadius: 12, padding: '20px 24px', marginBottom: 8,
          }}>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 }}>
              Cache Performance
            </div>
            <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 32, fontWeight: 700, color: hitColor, lineHeight: 1, marginBottom: 16 }}>
              {hitRate}%
            </div>
            <div style={{ display: 'flex', gap: 32, marginBottom: 12 }}>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: GREEN }}>{hits.toLocaleString()}</div>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginTop: 2 }}>cached today</div>
              </div>
              <div>
                <div style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 20, fontWeight: 700, color: AMBER }}>{freshCalls.toLocaleString()}</div>
                <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 11, color: MUTED, marginTop: 2 }}>fresh calls (costs money)</div>
              </div>
            </div>
            <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: DIM }}>
              Est. savings today: <span style={{ fontFamily: "'JetBrains Mono', monospace", color: GREEN }}>₦{savingsNgn.toLocaleString()}</span>
            </div>
          </div>
        )
      })()}
```

- [ ] **Step 2: Build check and visual verify**

```bash
npm run build
```
Cache Performance card should appear. If cache_hit_rate is null (no data yet), the widget doesn't render — that's the correct guard behaviour.

- [ ] **Step 3: Commit**

```bash
git add src/pages/admin/Health.jsx
git commit -m "feat: add Cache Performance widget to admin dashboard"
```

---

## Task 16: `Health.jsx` — Widget 2: Failed Generation Log

Renders a live-updating failure table with resolve actions.

**Files:**
- Modify: `src/pages/admin/Health.jsx`

- [ ] **Step 1: Add Failed Generation Log section**

Find:
```jsx
      {/* ── Most Active Today ─────────────────────────────────────── */}
```
Insert immediately before it:
```jsx
      {/* ── Widget 2 — Failed Generation Log ──────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '40px 0 16px', paddingBottom: 12, borderBottom: `1px solid ${BORDER}` }}>
        <h2 style={{ fontFamily: "'DM Serif Display', serif", fontSize: 22, fontWeight: 400, color: WHITE, margin: 0 }}>
          Failed Generations
        </h2>
        {failures && (
          <span style={{
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: 12, fontWeight: 700,
            color: WHITE,
            background: failures.total_today > 0 ? `${RED}33` : `${GREEN}33`,
            border: `1px solid ${failures.total_today > 0 ? RED : GREEN}55`,
            borderRadius: 999, padding: '2px 10px',
          }}>
            {failures.total_today > 0 ? `${failures.total_today} today` : '0 today'}
          </span>
        )}
      </div>
      <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: 12, padding: 24, marginBottom: 8 }}>
        {failuresLoading ? (
          [0,1,2,3,4].map(i => (
            <div key={i} style={{ height: 44, background: 'rgba(255,255,255,0.04)', borderRadius: 6, marginBottom: 6 }} />
          ))
        ) : !failures?.rows?.length ? (
          <div style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: MUTED, textAlign: 'center', padding: '20px 0' }}>
            No failures logged yet.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 800 }}>
              <thead>
                <tr>
                  {['Time', 'Feature', 'Error', 'User', 'Input Preview', 'Action'].map(h => (
                    <th key={h} style={{
                      fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600,
                      color: MUTED, textTransform: 'uppercase', letterSpacing: '0.06em',
                      padding: '10px 12px', textAlign: 'left', background: SURFACE,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {failures.rows.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{
                      background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.02)',
                      borderLeft: row.resolved ? 'none' : `3px solid ${RED}`,
                      opacity: row.resolved ? 0.4 : 1,
                    }}
                  >
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 12, color: MUTED, padding: '10px 12px', borderTop: `1px solid ${BORDER}`, whiteSpace: 'nowrap' }}>
                      {timeAgo(row.created_at)}
                    </td>
                    <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 13, color: DIM, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>
                      {row.feature}
                    </td>
                    <td style={{ padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>
                      <span style={{
                        fontFamily: "'JetBrains Mono', monospace", fontSize: 11, fontWeight: 600,
                        color: WHITE,
                        background: row.error_type === 'rate_limit' ? `${AMBER}33`
                          : row.error_type === 'timeout'     ? `${BLUE}33`
                          : `${RED}33`,
                        border: `1px solid ${row.error_type === 'rate_limit' ? AMBER
                          : row.error_type === 'timeout'     ? BLUE
                          : RED}55`,
                        borderRadius: 999, padding: '2px 8px',
                      }}>{row.error_type}</span>
                    </td>
                    <td style={{ fontFamily: "'Poppins', sans-serif", fontSize: 12, color: DIM, padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>
                      {(row.user_email || 'anonymous').substring(0, 20)}
                    </td>
                    <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: 11, color: MUTED, padding: '10px 12px', borderTop: `1px solid ${BORDER}`, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {(row.input_preview || '').substring(0, 50)}
                    </td>
                    <td style={{ padding: '10px 12px', borderTop: `1px solid ${BORDER}` }}>
                      <button
                        disabled={row.resolved || resolvingId === row.id}
                        onClick={() => handleResolveFailure(row.id)}
                        style={{
                          fontFamily: "'Poppins', sans-serif", fontSize: 11, fontWeight: 600,
                          color:      row.resolved ? MUTED : GREEN,
                          background: 'transparent',
                          border:     `1px solid ${row.resolved ? BORDER : GREEN + '55'}`,
                          borderRadius: 6, padding: '4px 10px',
                          cursor: row.resolved || resolvingId === row.id ? 'not-allowed' : 'pointer',
                          opacity: resolvingId === row.id ? 0.5 : 1,
                        }}
                      >
                        {row.resolved ? 'Resolved' : resolvingId === row.id ? '…' : 'Mark Resolved'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
```

- [ ] **Step 2: Build check**

```bash
npm run build
```

- [ ] **Step 3: Visual verify**

Open the admin dashboard. You should see "Failed Generations" section with a 0 or N badge. If no failures exist yet: "No failures logged yet." Trigger a deliberate API error (e.g. temporarily pass a bad prompt to a feature) to verify a row appears. Click "Mark Resolved" and confirm it greys out immediately (optimistic update).

- [ ] **Step 4: Final full build check**

```bash
npm run build
```
Expected: exits 0, no warnings about undefined variables.

- [ ] **Step 5: Commit**

```bash
git add src/pages/admin/Health.jsx
git commit -m "feat: add Failed Generation Log widget to admin dashboard"
```

---

## Self-Review

**Spec coverage check:**

| Requirement | Task |
|-------------|------|
| `generation_failures` table + RLS | Task 1 |
| `response_times` table + RLS | Task 1 |
| Response time recording in api/claude.js | Task 2 |
| `logFailure` utility | Task 3 |
| Failure logging in all 9 feature catch blocks | Tasks 4–8 |
| Dashboard adds unit economics fields | Task 9 |
| `vitals` admin action | Task 10 |
| `failures` + `resolve-failure` admin actions | Task 11 |
| System Vitals widget (top of page, 30s refresh, 4 traffic-light cards, pulse animation) | Tasks 12, 13 |
| Unit Economics card (3 stats, colour rules, ₦ format, guard for zero denominators) | Tasks 12, 14 |
| Cache Performance card (large %, cached/fresh counts, savings estimate, remove old small card) | Tasks 12, 15 |
| Failed Generation Log (table, resolve action, 60s refresh, red border on unresolved, skeleton) | Tasks 12, 16 |
| NGN_PER_USD env var with 1600 fallback | Task 9 |
| Service role only reads in admin actions | Tasks 10, 11 |
| Separate refresh intervals with useEffect cleanup | Task 12 |
| Skeleton loaders for all new widgets | Tasks 13, 16 |

All requirements covered.

**Placeholder check:** No TBDs, no "handle edge cases" statements. All code blocks are complete.

**Type consistency:** `logFailure(feature, err, inputPreview)` — same signature in Task 3 (definition) and Tasks 4–8 (call sites). `vitals.avg_response_ms`, `vitals.failures_today`, `vitals.requests_today`, `vitals.active_sessions`, `vitals.last_call_at` — same keys in Task 10 (API return) and Task 13 (consumer). `failures.rows`, `failures.total_today` — same keys in Task 11 (API return) and Task 16 (consumer). `revenue_today_ngn`, `paying_users_today`, `ngn_per_usd` — same keys in Task 9 (API return) and Tasks 12/14/15 (consumer).
