# Button Spinner Loading States Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace all text-only loading states (`'Working…'`, `'Signing in…'`, etc.) and missing loading states with a consistent inline spinner + label pattern across every async button.

**Architecture:** Create one shared `Spinner` component (`src/components/Spinner.jsx`) that every file imports. Pattern: `{loading ? <><Spinner /> Label…</> : 'Label'}` with `disabled={loading}`. Exact replication of the existing `SpinnerIcon` in `Settings.jsx`.

**Tech Stack:** React, Tailwind (`animate-spin`), inline SVG arc

---

## Files

- **Create:** `src/components/Spinner.jsx`
- **Modify:** `src/pages/Login.jsx` — Sign In button
- **Modify:** `src/pages/Signup.jsx` — Create Account button
- **Modify:** `src/pages/Profile.jsx` — Sign Out button (add state)
- **Modify:** `src/pages/Dashboard.jsx` — Try Again button (add disabled)
- **Modify:** `src/features/topicValidator/TopicValidator.jsx` — Validate Topic
- **Modify:** `src/features/chapterArchitect/ChapterArchitect.jsx` — Generate Chapters, Generate Abstract
- **Modify:** `src/features/literatureMap/LiteratureMap.jsx` — Generate Literature Map
- **Modify:** `src/features/methodology/MethodologyAdvisor.jsx` — Analyse Methodology, Generate Instrument
- **Modify:** `src/features/writingPlanner/WritingPlanner.jsx` — Generate Writing Plan
- **Modify:** `src/features/supervisorPrep/SupervisorPrep.jsx` — Prepare Me
- **Modify:** `src/features/supervisorEmail/SupervisorEmail.jsx` — Generate Email, Regenerate
- **Modify:** `src/features/projectReviewer/ProjectReviewer.jsx` — Review My Project
- **Modify:** `src/features/defensePrep/DefensePrep.jsx` — Share to WhatsApp, Download PDF

---

### Task 1: Create shared Spinner component

**Files:**
- Create: `src/components/Spinner.jsx`

- [ ] **Step 1: Create the file**

```jsx
export default function Spinner({ size = 14 }) {
  return (
    <svg
      className="animate-spin"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/Spinner.jsx
git commit -m "feat: add shared Spinner component for button loading states"
```

---

### Task 2: Auth pages — Login + Signup

**Files:**
- Modify: `src/pages/Login.jsx` line ~340
- Modify: `src/pages/Signup.jsx` line ~475

- [ ] **Step 1: Update Login.jsx Sign In button**

Add import at top of file (after existing imports):
```jsx
import Spinner from '../components/Spinner'
```

Change the submit button content (line ~340):
```jsx
// Before:
{loading ? 'Signing in…' : 'Sign In'}

// After:
{loading ? <><Spinner /> Signing in…</> : 'Sign In'}
```

- [ ] **Step 2: Update Signup.jsx Create Account button**

Add import at top of file:
```jsx
import Spinner from '../components/Spinner'
```

Change the button content (line ~475):
```jsx
// Before:
{loading ? 'Creating account…' : 'Create Account'}

// After:
{loading ? <><Spinner /> Creating account…</> : 'Create Account'}
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Login.jsx src/pages/Signup.jsx
git commit -m "feat: add spinner loading states to Sign In and Create Account buttons"
```

---

### Task 3: Profile Sign Out + Dashboard Try Again

**Files:**
- Modify: `src/pages/Profile.jsx` line ~224
- Modify: `src/pages/Dashboard.jsx` line ~256

- [ ] **Step 1: Update Profile.jsx Sign Out button**

Add import at top of file:
```jsx
import Spinner from '../components/Spinner'
```

Find the header component that contains the Sign Out dropdown button. Add a `signingOut` state near the other state declarations in that component:
```jsx
const [signingOut, setSigningOut] = useState(false)
```

Replace the inline onClick handler with a proper async function and update the button:
```jsx
// Before:
<button
  onClick={async () => { await supabase.auth.signOut(); resetUser(); clearState(); navigate('/') }}
  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/10 transition-colors duration-150 cursor-pointer"
>
  <span className="text-red-400"><LogOutIcon /></span>
  <span className="font-sans text-[0.82rem] text-red-400">Sign Out</span>
</button>

// After:
<button
  onClick={async () => {
    if (signingOut) return
    setSigningOut(true)
    try {
      await supabase.auth.signOut()
      resetUser()
      clearState()
      navigate('/')
    } finally {
      setSigningOut(false)
    }
  }}
  disabled={signingOut}
  className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-red-500/10 transition-colors duration-150 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
>
  {signingOut ? (
    <><span className="text-red-400"><Spinner size={14} /></span>
    <span className="font-sans text-[0.82rem] text-red-400">Signing out…</span></>
  ) : (
    <><span className="text-red-400"><LogOutIcon /></span>
    <span className="font-sans text-[0.82rem] text-red-400">Sign Out</span></>
  )}
</button>
```

- [ ] **Step 2: Update Dashboard.jsx Try Again button**

Add import at top of file:
```jsx
import Spinner from '../components/Spinner'
```

The Try Again button's click handler already sets `projectsLoading(true)` which hides the button immediately (it's in the `projectsError` branch). Add `disabled={projectsLoading}` to prevent double-click in the render gap:

```jsx
// Before:
<button
  onClick={() => {
    setProjectsError(null)
    setProjectsLoading(true)
    getAllUserProjects(user.id)
      .then(p => { if (mountedRef.current) { setProjects(p); setProjectsLoading(false) } })
      .catch(err => { if (mountedRef.current) { setProjectsError(err?.message || 'Failed to load projects'); setProjectsLoading(false) } })
  }}
  className="font-sans font-semibold text-white rounded-xl px-5 py-2.5 cursor-pointer border-0"
  style={{ background: '#DC2626', fontSize: '0.875rem' }}
>
  Try Again
</button>

// After:
<button
  onClick={() => {
    setProjectsError(null)
    setProjectsLoading(true)
    getAllUserProjects(user.id)
      .then(p => { if (mountedRef.current) { setProjects(p); setProjectsLoading(false) } })
      .catch(err => { if (mountedRef.current) { setProjectsError(err?.message || 'Failed to load projects'); setProjectsLoading(false) } })
  }}
  disabled={projectsLoading}
  className="font-sans font-semibold text-white rounded-xl px-5 py-2.5 cursor-pointer border-0 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
  style={{ background: '#DC2626', fontSize: '0.875rem' }}
>
  {projectsLoading ? <><Spinner size={13} /> Retrying…</> : 'Try Again'}
</button>
```

- [ ] **Step 3: Commit**

```bash
git add src/pages/Profile.jsx src/pages/Dashboard.jsx
git commit -m "feat: add loading state to Sign Out and Try Again buttons"
```

---

### Task 4: Feature step buttons — Group 1

**Files:**
- Modify: `src/features/topicValidator/TopicValidator.jsx` line ~317
- Modify: `src/features/chapterArchitect/ChapterArchitect.jsx` lines ~581, ~672
- Modify: `src/features/literatureMap/LiteratureMap.jsx` line ~157

Pattern for all: add `import Spinner from '../../components/Spinner'`, then change `{btnDisabled ? 'Working…' : 'Label'}` to `{btnDisabled ? <><Spinner /> Working…</> : 'Label'}`. Also add `flex items-center gap-2` to button className.

- [ ] **Step 1: Update TopicValidator.jsx**

Add import:
```jsx
import Spinner from '../../components/Spinner'
```

Update the Validate Topic button content (line ~317):
```jsx
// Before:
{btnDisabled ? 'Working…' : 'Validate Topic'}

// After:
{btnDisabled ? <><Spinner /> Working…</> : 'Validate Topic'}
```

Add `flex items-center gap-2` to the button's className (so the spinner and text align horizontally).

- [ ] **Step 2: Update ChapterArchitect.jsx**

Add import:
```jsx
import Spinner from '../../components/Spinner'
```

Update Generate Chapters button (line ~581):
```jsx
// Before:
{btnDisabled ? 'Working…' : 'Generate Chapters'}
// After:
{btnDisabled ? <><Spinner /> Working…</> : 'Generate Chapters'}
```

Update Generate Abstract button (line ~672):
```jsx
// Before:
{agBtnDisabled ? 'Working…' : 'Generate Abstract'}
// After:
{agBtnDisabled ? <><Spinner /> Working…</> : 'Generate Abstract'}
```

Add `flex items-center gap-2` to both buttons' classNames.

- [ ] **Step 3: Update LiteratureMap.jsx**

Add import:
```jsx
import Spinner from '../../components/Spinner'
```

Update Generate Literature Map button (line ~157):
```jsx
// Before:
{btnDisabled ? 'Working…' : 'Generate Literature Map'}
// After:
{btnDisabled ? <><Spinner /> Working…</> : 'Generate Literature Map'}
```

Add `flex items-center gap-2` to the button's className.

- [ ] **Step 4: Commit**

```bash
git add src/features/topicValidator/TopicValidator.jsx src/features/chapterArchitect/ChapterArchitect.jsx src/features/literatureMap/LiteratureMap.jsx
git commit -m "feat: add spinners to TopicValidator, ChapterArchitect, and LiteratureMap buttons"
```

---

### Task 5: Feature step buttons — Group 2

**Files:**
- Modify: `src/features/methodology/MethodologyAdvisor.jsx` lines ~303, ~500
- Modify: `src/features/writingPlanner/WritingPlanner.jsx` line ~235
- Modify: `src/features/supervisorPrep/SupervisorPrep.jsx` line ~237
- Modify: `src/features/supervisorEmail/SupervisorEmail.jsx` lines ~128, ~204
- Modify: `src/features/projectReviewer/ProjectReviewer.jsx` line ~570

Same pattern: add import, change text to `<><Spinner /> Working…</>`, add `flex items-center gap-2`.

- [ ] **Step 1: Update MethodologyAdvisor.jsx**

Add import:
```jsx
import Spinner from '../../components/Spinner'
```

Update Analyse Methodology button (line ~303):
```jsx
// Before:
{maBtnDisabled ? 'Working…' : 'Analyse Methodology'}
// After:
{maBtnDisabled ? <><Spinner /> Working…</> : 'Analyse Methodology'}
```

Update Generate Instrument button (line ~500):
```jsx
// Before:
{diGenBtnDisabled ? 'Working…' : 'Generate Instrument'}
// After:
{diGenBtnDisabled ? <><Spinner /> Working…</> : 'Generate Instrument'}
```

Add `flex items-center gap-2` to both buttons' classNames.

- [ ] **Step 2: Update WritingPlanner.jsx**

Add import:
```jsx
import Spinner from '../../components/Spinner'
```

Update Generate Writing Plan button (line ~235):
```jsx
// Before:
{btnDisabled ? 'Working…' : 'Generate Writing Plan'}
// After:
{btnDisabled ? <><Spinner /> Working…</> : 'Generate Writing Plan'}
```

Add `flex items-center gap-2` to the button's className.

- [ ] **Step 3: Update SupervisorPrep.jsx**

Add import:
```jsx
import Spinner from '../../components/Spinner'
```

Update Prepare Me button (line ~237):
```jsx
// Before:
{btnDisabled ? 'Working…' : 'Prepare Me'}
// After:
{btnDisabled ? <><Spinner /> Working…</> : 'Prepare Me'}
```

Add `flex items-center gap-2` to the button's className.

- [ ] **Step 4: Update SupervisorEmail.jsx**

Add import:
```jsx
import Spinner from '../../components/Spinner'
```

Update Generate Email button (line ~128):
```jsx
// Before:
{section === 'loading' ? 'Working…' : 'Generate Email'}
// After:
{section === 'loading' ? <><Spinner /> Working…</> : 'Generate Email'}
```

Update Regenerate button (line ~204):
```jsx
// Before:
{section === 'loading' ? 'Working…' : 'Regenerate'}
// After:
{section === 'loading' ? <><Spinner /> Working…</> : 'Regenerate'}
```

Add `flex items-center gap-2` to both buttons' classNames.

- [ ] **Step 5: Update ProjectReviewer.jsx**

Add import:
```jsx
import Spinner from '../../components/Spinner'
```

Update Review My Project button (line ~570):
```jsx
// Before:
{isProcessing ? 'Working…' : 'Review My Project'}
// After:
{isProcessing ? <><Spinner /> Working…</> : 'Review My Project'}
```

Add `flex items-center gap-2` to the button's className.

- [ ] **Step 6: Commit**

```bash
git add src/features/methodology/MethodologyAdvisor.jsx src/features/writingPlanner/WritingPlanner.jsx src/features/supervisorPrep/SupervisorPrep.jsx src/features/supervisorEmail/SupervisorEmail.jsx src/features/projectReviewer/ProjectReviewer.jsx
git commit -m "feat: add spinners to Methodology, WritingPlanner, SupervisorPrep, SupervisorEmail, ProjectReviewer buttons"
```

---

### Task 6: DefensePrep — Share to WhatsApp + Download PDF

**Files:**
- Modify: `src/features/defensePrep/DefensePrep.jsx` lines ~458, ~1655

- [ ] **Step 1: Update DefensePrep.jsx**

Add import near the top of the file (after existing imports):
```jsx
import Spinner from '../../components/Spinner'
```

Update Share to WhatsApp button (line ~458):
```jsx
// Before:
{shareLoading ? 'Generating card…' : 'Share to WhatsApp'}
// After:
{shareLoading ? <><Spinner /> Generating card…</> : 'Share to WhatsApp'}
```

Update Download PDF button (line ~1655):
```jsx
// Before:
Generating PDF…
// After — wrap with conditional:
{downloadingTranscript ? <><Spinner /> Generating PDF…</> : 'Download PDF'}
```

Note: Check the exact variable name for the download button's loading state at line ~1650 before editing — it may be `downloadingTranscript` or similar.

Add `flex items-center gap-2` to both buttons' classNames (or their wrapper span if the button already has complex layout).

- [ ] **Step 2: Commit**

```bash
git add src/features/defensePrep/DefensePrep.jsx
git commit -m "feat: add spinners to DefensePrep Share and Download buttons"
```
