# Express Defence — Unique Onboarding Content & Tour Carousel

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give Express Defence users their own chip question content and a 3-slide TourCarousel that explains the Express 3-step flow, shown as a "Quick look?" prompt on first dashboard visit.

**Architecture:** Three isolated changes — (1) content-only edits to `ExpressOnboarding.jsx`, (2) a `variant="express"` prop added to `TourCarousel.jsx` that switches to 3 Express slides, (3) `ExpressDashboard.jsx` updated to show a wt2-screen prompt on first load then open the Express tour. Seen state tracked in localStorage (separate from the DB-backed `walkthrough_seen_at` so standard users who buy Express later still see the Express tour).

**Tech Stack:** React 18, Framer Motion, Tailwind + CSS variables, Vitest, TypeScript (strict), Supabase

## Global Constraints

- CSS prefix for Express shell: `es-`, `eb-`. Never mix prefixes.
- `wt2-*` CSS classes (walkthrough prompt) already exist in `src/styles/onboarding-questions.css` — reuse them, do not add new CSS.
- Never hardcode hex values — use CSS variables (`var(--color-blue-primary)` etc.) in any new className-based CSS. Inline styles in JSX may use hex literals (pattern already established in TourCarousel phone mockups).
- `user_onboarding.expected_defence_band` has CHECK constraint: `('<1m','1-3m','3-6m','unsure')`. New Express defence-date options must map to one of these values before being saved to DB.
- No new Vercel serverless functions (project is at 12-function limit).
- No new npm packages.
- Run `npm run typecheck` after every task. Fix any errors before committing.

---

## File Map

| File | Action | What changes |
|------|--------|--------------|
| `src/pages/ExpressOnboarding.jsx` | Modify | `DEFENCE_OPTIONS` constant, 3 chip screen props |
| `src/features/onboarding/TourCarousel.jsx` | Modify | Add `variant` prop, add `ExpressSlides` helper, conditional TOTAL/GLOW_X_PCT |
| `src/pages/ExpressDashboard.jsx` | Modify | Replace DB walkthrough check with localStorage, add wt2-screen prompt, fix TourCarousel props |

---

## Task 1: Update ExpressOnboarding chip screen content

**Files:**
- Modify: `src/pages/ExpressOnboarding.jsx`

**Interfaces:**
- Produces: nothing consumed by other tasks — self-contained content changes

### Steps

- [ ] **Step 1: Replace `DEFENCE_OPTIONS` constant**

In `src/pages/ExpressOnboarding.jsx`, find the `DEFENCE_OPTIONS` constant near the top of the file (currently around line 30) and replace it:

```js
// BEFORE
const DEFENCE_OPTIONS = [
  { label: 'Within 1 month', value: '<1m' },
  { label: '1–3 months',     value: '1-3m' },
  { label: '3–6 months',     value: '3-6m' },
  { label: 'Not sure yet',   value: 'unsure' },
]

// AFTER
const DEFENCE_OPTIONS = [
  { label: 'This week',        value: '<1m' },
  { label: 'Within 2 weeks',   value: '<1m' },
  { label: '1 month away',     value: '<1m' },
  { label: 'More than a month', value: '1-3m' },
]
```

Note: display labels are Express-specific but values map to the existing DB CHECK constraint values (`<1m`, `1-3m`). The granularity is in the UI only.

- [ ] **Step 2: Update attribution chip screen props**

Find the `formStep === 'attribution'` block (currently around line 464) and update the `eyebrow` and `heading` props:

```jsx
{formStep === 'attribution' && (
  <ChipScreen
    key="attribution"
    eyebrow="HOW DID YOU FIND EXPRESS DEFENCE?"
    heading="How did you hear about Express Defence?"
    options={REFERRAL_OPTIONS}
    selected={referralSource}
    onSelect={setReferralSource}
    onSkip={() => setFormStep('defence-date')}
    onContinue={() => setFormStep('defence-date')}
    stepNum={surveyStepNum}
    progressPct={surveyProgressPct}
  />
)}
```

- [ ] **Step 3: Update defence-date chip screen props**

Find the `formStep === 'defence-date'` block (currently around line 478) and update the `eyebrow` and `heading` props:

```jsx
{formStep === 'defence-date' && (
  <ChipScreen
    key="defence-date"
    eyebrow="HOW SOON IS YOUR DEFENCE?"
    heading="When are you walking in?"
    options={DEFENCE_OPTIONS}
    selected={defenceBand}
    onSelect={setDefenceBand}
    onSkip={() => setFormStep('notifications')}
    onContinue={() => setFormStep('notifications')}
    stepNum={surveyStepNum}
    progressPct={surveyProgressPct}
  />
)}
```

- [ ] **Step 4: Update notifications screen description text**

Find the `NotificationsScreen` component definition (around line 96). Update the two `oq-toggle-desc` text nodes:

```jsx
// Email toggle — change description from:
// "Defence tips and reminders by email"
// to:
<div className="oq-toggle-desc">Defence prep tips and countdown reminders by email</div>

// Push toggle — change description from:
// "Get nudges on this device"
// to:
<div className="oq-toggle-desc">Get nudges on this device as your defence approaches</div>
```

- [ ] **Step 5: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors. Fix any type errors before continuing.

- [ ] **Step 6: Verify visually in browser**

Navigate to `/express-onboarding` in dev server (`npm run dev`). Complete the form and step through all chip screens. Confirm:
- Attribution screen says "How did you hear about Express Defence?"
- Defence-date screen says "When are you walking in?" with options This week / Within 2 weeks / 1 month away / More than a month
- Notifications screen email description reads "Defence prep tips and countdown reminders by email"

- [ ] **Step 7: Commit**

```bash
git add src/pages/ExpressOnboarding.jsx
git commit -m "feat(express): update onboarding chip screen content for express users"
```

---

## Task 2: Add `variant="express"` to TourCarousel

**Files:**
- Modify: `src/features/onboarding/TourCarousel.jsx`

**Interfaces:**
- Produces: `<TourCarousel variant="express" onClose={fn} />` — renders 3-slide Express carousel. `variant` defaults to `"standard"` so all existing callers are unaffected.

### Steps

- [ ] **Step 1: Update the component signature and conditional constants**

In `src/features/onboarding/TourCarousel.jsx`, update the export and the two constants that depend on slide count:

```jsx
// Change signature from:
export default function TourCarousel({ onClose, startAt = 0 }) {

// To:
export default function TourCarousel({ onClose, startAt = 0, variant = 'standard' }) {
```

Then find the two constants at the top of the component body (currently lines 4–6) and make them conditional:

```js
const isExpress = variant === 'express'
const TOTAL = isExpress ? 3 : 4
const GLOW_X_PCT = isExpress ? [72, 28, 72] : [72, 28, 72, 28]
```

- [ ] **Step 2: Add the `ExpressSlides` helper function**

Add this function directly above the closing `function Phone` at the bottom of the file (after the last `</section>` of the standard slides, before `function Phone`). This keeps all Express-specific JSX isolated:

```jsx
function ExpressSlides({ ready, current }) {
  return (
    <>
      {/* ── Slide 1 — Project Reviewer — phone RIGHT ── */}
      <section className={`oq-tour-slide oq-tour-slide--phone-right${ready && current === 0 ? ' oq-tour-slide--active' : ''}`}>
        <div className="oq-tour-text">
          <div className="oq-tour-eyebrow">STEP 1 · PROJECT REVIEWER</div>
          <h2 className="oq-tour-headline">Submit your project. Get the review your supervisor never gave you.</h2>
          <div className="oq-tour-steps">
            {[
              'Upload your dissertation — PDF, DOCX, or TXT',
              'Get an AI verdict on your methodology, gaps, and argument structure',
              'Your examiners will raise these. Know them first.',
            ].map((s, i) => (
              <div className="oq-tour-step" key={i}>
                <div className="oq-tour-chip">{i + 1}</div>
                <div className="oq-tour-step-text">{s}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="oq-tour-phone-col">
          <Phone>
            {/* Sidebar strip */}
            <div style={{ position:'absolute', top:0, left:0, bottom:0, width:44, background:'#060E18', borderRight:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', alignItems:'center', paddingTop:42, zIndex:5 }}>
              <div style={{ marginBottom:12 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1L2 4.5V9C2 13.5 5 17 9 17.5C13 17 16 13.5 16 9V4.5L9 1Z" fill="#0066FF"/><path d="M6.5 9L8.2 10.7L12 7" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, marginTop:4 }}>
                <div style={{ width:18, height:18, borderRadius:'50%', background:'#0066FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 4.5L3.8 6.5L7 3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div style={{ width:1, height:10, background:'rgba(255,255,255,.1)' }} />
                <div style={{ width:18, height:18, borderRadius:'50%', border:'1.5px solid rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:'rgba(255,255,255,.3)' }} />
                </div>
                <div style={{ width:1, height:10, background:'rgba(255,255,255,.1)' }} />
                <div style={{ width:18, height:18, borderRadius:'50%', border:'1.5px solid rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:'rgba(255,255,255,.3)' }} />
                </div>
              </div>
            </div>
            {/* Main content */}
            <div style={{ position:'absolute', top:0, left:44, right:0, bottom:0, overflow:'hidden' }}>
              <div style={{ padding:'44px 9px 0' }}>
                <div style={{ font:"700 11px/1.2 'DM Serif Display',serif", color:'#fff', marginBottom:4 }}>Step 1: Project Reviewer</div>
                <div style={{ font:'400 5.5px/1.5 Poppins,sans-serif', color:'rgba(255,255,255,.5)', marginBottom:8 }}>Upload your full project. FYPro will grade it, identify strengths and weaknesses, and generate the most dangerous examiner questions from your work.</div>
                {/* Upload dropzone */}
                <div style={{ border:'1.5px dashed rgba(0,102,255,.4)', borderRadius:6, padding:'12px 8px', textAlign:'center', background:'rgba(0,102,255,.035)', marginBottom:6 }}>
                  <svg width="16" height="19" viewBox="0 0 16 19" fill="none" style={{ marginBottom:5, display:'block', marginLeft:'auto', marginRight:'auto' }}>
                    <rect x="1" y="1" width="11" height="15" rx="1.5" fill="none" stroke="#0066FF" strokeWidth="1"/>
                    <path d="M3.5 6h6M3.5 8.5h6M3.5 11h4" stroke="#0066FF" strokeWidth=".8" strokeLinecap="round"/>
                    <path d="M9.5 1v4h4" stroke="#0066FF" strokeWidth=".8" strokeLinecap="round"/>
                  </svg>
                  <div style={{ font:'500 6px/1.4 Poppins,sans-serif', color:'rgba(255,255,255,.65)' }}>Drop your file here or <span style={{ color:'#0066FF', textDecoration:'underline' }}>click to browse</span></div>
                  <div style={{ font:'400 5px/1 Poppins,sans-serif', color:'rgba(255,255,255,.3)', marginTop:3 }}>PDF · Word (.docx) · Plain text (.txt) · Max 4 MB</div>
                </div>
                {/* CTA */}
                <div style={{ background:'#0066FF', borderRadius:5, padding:7, textAlign:'center', marginBottom:8, boxShadow:'0 2px 10px rgba(0,102,255,.4)' }}>
                  <span style={{ font:'700 7px/1 Poppins,sans-serif', color:'#fff', letterSpacing:'.04em' }}>Review My Project</span>
                </div>
                {/* Sample result */}
                <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:7 }}>
                  <div style={{ flex:1, height:1, background:'rgba(255,255,255,.08)' }} />
                  <span style={{ font:"400 5px/1 'JetBrains Mono',monospace", color:'rgba(255,255,255,.25)', textTransform:'uppercase', letterSpacing:'.08em' }}>sample result</span>
                  <div style={{ flex:1, height:1, background:'rgba(255,255,255,.08)' }} />
                </div>
                <div style={{ textAlign:'center', marginBottom:5 }}>
                  <div style={{ display:'inline-block', background:'rgba(22,163,74,.12)', border:'1px solid rgba(22,163,74,.35)', borderRadius:4, padding:'4px 10px' }}>
                    <span style={{ font:"700 9px/1 'JetBrains Mono',monospace", color:'#16A34A' }}>Distinction — 74%</span>
                  </div>
                </div>
                <div style={{ font:"500 5.5px/1 'JetBrains Mono',monospace", color:'#16A34A', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>Strengths</div>
                <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:4, padding:'5px 7px', marginBottom:3 }}>
                  <div style={{ font:'600 6.5px/1.2 Poppins,sans-serif', color:'#fff', marginBottom:2 }}>Rigorous Imbalance-Aware Evaluation</div>
                  <div style={{ font:'400 5.5px/1.45 Poppins,sans-serif', color:'rgba(255,255,255,.4)' }}>Uses precision, recall, F1, and AUC-ROC with clear justification for the class imbalance in your dataset.</div>
                </div>
                <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.07)', borderRadius:4, padding:'5px 7px' }}>
                  <div style={{ font:'600 6.5px/1.2 Poppins,sans-serif', color:'#fff', marginBottom:2 }}>Transparent Confusion Matrix Reporting</div>
                  <div style={{ font:'400 5.5px/1.45 Poppins,sans-serif', color:'rgba(255,255,255,.4)' }}>Full matrix for Gradient Boosting flags cross-validated vs single-split recall discrepancy.</div>
                </div>
              </div>
            </div>
          </Phone>
        </div>
      </section>

      {/* ── Slide 2 — Defence Brief — phone LEFT ── */}
      <section className={`oq-tour-slide oq-tour-slide--phone-left${ready && current === 1 ? ' oq-tour-slide--active' : ''}`}>
        <div className="oq-tour-phone-col">
          <Phone>
            {/* Sidebar strip — Step 2 active */}
            <div style={{ position:'absolute', top:0, left:0, bottom:0, width:44, background:'#060E18', borderRight:'1px solid rgba(255,255,255,0.06)', display:'flex', flexDirection:'column', alignItems:'center', paddingTop:42, zIndex:5 }}>
              <div style={{ marginBottom:12 }}>
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none"><path d="M9 1L2 4.5V9C2 13.5 5 17 9 17.5C13 17 16 13.5 16 9V4.5L9 1Z" fill="#0066FF"/><path d="M6.5 9L8.2 10.7L12 7" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </div>
              <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16, marginTop:4 }}>
                <div style={{ width:18, height:18, borderRadius:'50%', border:'1.5px solid rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 4.5L3.8 6.5L7 3" stroke="rgba(255,255,255,.4)" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div style={{ width:1, height:10, background:'rgba(255,255,255,.1)' }} />
                <div style={{ width:18, height:18, borderRadius:'50%', background:'#0066FF', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M2 4.5L3.8 6.5L7 3" stroke="white" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/></svg>
                </div>
                <div style={{ width:1, height:10, background:'rgba(255,255,255,.1)' }} />
                <div style={{ width:18, height:18, borderRadius:'50%', border:'1.5px solid rgba(255,255,255,.2)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <div style={{ width:5, height:5, borderRadius:'50%', background:'rgba(255,255,255,.3)' }} />
                </div>
              </div>
            </div>
            {/* Main content */}
            <div style={{ position:'absolute', top:0, left:44, right:0, bottom:0, overflow:'hidden' }}>
              <div style={{ padding:'44px 9px 0' }}>
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:3, gap:5 }}>
                  <div style={{ font:"700 10.5px/1.2 'DM Serif Display',serif", color:'#fff' }}>Your Defence Brief</div>
                  <div style={{ background:'#16A34A', borderRadius:4, padding:'4px 6px', flexShrink:0 }}>
                    <span style={{ font:'600 5px/1 Poppins,sans-serif', color:'#fff' }}>↓ Download PDF</span>
                  </div>
                </div>
                <div style={{ font:'400 5px/1 Poppins,sans-serif', color:'rgba(255,255,255,.32)', marginBottom:8 }}>Generated from your Project Review · 8 items ready</div>
                {/* Opening Statement */}
                <div style={{ font:"600 5.5px/1 'JetBrains Mono',monospace", color:'#0066FF', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:4 }}>Opening Statement</div>
                <div style={{ background:'rgba(0,102,255,.06)', border:'1px solid rgba(0,102,255,.18)', borderRadius:5, padding:'6px 8px', marginBottom:7 }}>
                  <div style={{ font:'400 5.5px/1.65 Poppins,sans-serif', color:'rgba(255,255,255,.7)', fontStyle:'italic' }}>Good morning, distinguished panel. My name is [Your Name], and I present my final year project titled &quot;Design and Implementation of a Machine Learning-Based Model for Predicting Student Academic Performance...&quot; I am ready to walk the panel through my work.</div>
                </div>
                {/* Weak Spots */}
                <div style={{ font:"600 5.5px/1 'JetBrains Mono',monospace", color:'#0066FF', textTransform:'uppercase', letterSpacing:'.12em', marginBottom:5 }}>Weak Spots &amp; Model Answers</div>
                {/* Critical card */}
                <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)', borderRadius:5, padding:'6px 7px', marginBottom:4 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                    <div style={{ background:'rgba(220,38,38,.16)', border:'1px solid rgba(220,38,38,.32)', borderRadius:2.5, padding:'1.5px 4.5px' }}>
                      <span style={{ font:'700 4.5px/1 Poppins,sans-serif', color:'#DC2626', textTransform:'uppercase', letterSpacing:'.04em' }}>Critical</span>
                    </div>
                    <span style={{ font:'600 6px/1.2 Poppins,sans-serif', color:'#fff' }}>Missing Reference List</span>
                  </div>
                  <div style={{ font:"600 5px/1 'JetBrains Mono',monospace", color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:3 }}>Model Answer</div>
                  <div style={{ font:'400 5.5px/1.5 Poppins,sans-serif', color:'rgba(255,255,255,.6)', marginBottom:5 }}>I acknowledge this is a serious gap in the submitted document. The reference list was inadvertently left as a placeholder and does not reflect the sources I actually consulted...</div>
                  <div style={{ background:'rgba(0,102,255,.1)', border:'1px solid rgba(0,102,255,.22)', borderRadius:3, padding:'3px 7px', display:'inline-flex', alignItems:'center', gap:3 }}>
                    <span style={{ font:'500 5.5px/1 Poppins,sans-serif', color:'#5599FF' }}>🎙 Coach me on this</span>
                  </div>
                </div>
                {/* Serious card */}
                <div style={{ background:'rgba(255,255,255,.03)', border:'1px solid rgba(255,255,255,.08)', borderRadius:5, padding:'6px 7px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:4, marginBottom:4 }}>
                    <div style={{ background:'rgba(245,158,11,.16)', border:'1px solid rgba(245,158,11,.32)', borderRadius:2.5, padding:'1.5px 4.5px' }}>
                      <span style={{ font:'700 4.5px/1 Poppins,sans-serif', color:'#F59E0B', textTransform:'uppercase', letterSpacing:'.04em' }}>Serious</span>
                    </div>
                    <span style={{ font:'600 6px/1.2 Poppins,sans-serif', color:'#fff' }}>No SMOTE or Resampling Justification</span>
                  </div>
                  <div style={{ font:"600 5px/1 'JetBrains Mono',monospace", color:'rgba(255,255,255,.4)', textTransform:'uppercase', letterSpacing:'.08em', marginBottom:3 }}>Model Answer</div>
                  <div style={{ font:'400 5.5px/1.5 Poppins,sans-serif', color:'rgba(255,255,255,.6)' }}>The decision not to apply SMOTE was deliberate but inadequately documented. With an 80/20 at-risk ratio, the imbalance was moderate and stratified splitting preserved class proportions across folds...</div>
                </div>
              </div>
            </div>
          </Phone>
        </div>
        <div className="oq-tour-text">
          <div className="oq-tour-eyebrow">STEP 2 · DEFENCE BRIEF</div>
          <h2 className="oq-tour-headline">Your personal war brief. Built from your review.</h2>
          <div className="oq-tour-steps">
            {[
              'Get a personalised opening statement ready to deliver',
              'Model answers for every weak spot the AI found',
              'Download your brief as a PDF before you walk in',
            ].map((s, i) => (
              <div className="oq-tour-step" key={i}>
                <div className="oq-tour-chip">{i + 1}</div>
                <div className="oq-tour-step-text">{s}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Slide 3 — Defence Simulator — phone RIGHT ── */}
      <section className={`oq-tour-slide oq-tour-slide--phone-right${ready && current === 2 ? ' oq-tour-slide--active' : ''}`}>
        <div className="oq-tour-text">
          <div className="oq-tour-eyebrow">STEP 3 · DEFENCE SIMULATOR</div>
          <h2 className="oq-tour-headline">Three examiners. Live questions. No mercy.</h2>
          <div className="oq-tour-steps">
            {[
              'Face hostile questions from three AI examiner personas, by voice or text',
              'Get scored on every turn as they probe your gaps',
              'Score 7/10+ to unlock your downloadable defence certificate',
            ].map((s, i) => (
              <div className="oq-tour-step" key={i}>
                <div className="oq-tour-chip">{i + 1}</div>
                <div className="oq-tour-step-text">{s}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="oq-tour-phone-col">
          <Phone bg="#060E18" defence>
            <div style={{ position:'absolute', top:0, left:0, right:0, padding:'40px 10px 8px', background:'#060E18', borderBottom:'1px solid rgba(255,255,255,.06)', display:'flex', alignItems:'center', justifyContent:'space-between', zIndex:5 }}>
              <svg width="15" height="16" viewBox="0 0 15 16" fill="none"><path d="M7.5 1L1.5 4V8.5C1.5 12.5 4.2 15.5 7.5 16C10.8 15.5 13.5 12.5 13.5 8.5V4L7.5 1Z" fill="none" stroke="#0066FF" strokeWidth="1.2"/><path d="M5.5 8.5L7 10L10.5 7" stroke="#0066FF" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"/></svg>
              <div style={{ font:"500 5.5px/1 'JetBrains Mono',monospace", color:'rgba(255,255,255,.5)', textTransform:'uppercase', letterSpacing:'.1em' }}>DEFENCE EXAMINATION PANEL</div>
              <div style={{ font:'500 6px/1 Poppins,sans-serif', color:'#DC2626' }}>End Session</div>
            </div>
            <div style={{ position:'absolute', top:63, left:0, right:0, bottom:0, padding:'8px 10px', overflow:'hidden' }}>
              <div style={{ textAlign:'center', marginBottom:7 }}>
                <div style={{ font:"500 5.5px/1 'JetBrains Mono',monospace", color:'rgba(255,255,255,.42)', textTransform:'uppercase', letterSpacing:'.14em', marginBottom:5 }}>QUESTION 1 OF 5</div>
                <div style={{ display:'flex', justifyContent:'center', gap:4 }}>
                  <div style={{ width:20, height:3.5, borderRadius:2, background:'#0066FF', boxShadow:'0 0 5px rgba(0,102,255,.6)' }} />
                  {[1,2,3,4].map(i => <div key={i} style={{ width:20, height:3.5, borderRadius:2, background:'rgba(255,255,255,.12)' }} />)}
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:5, marginBottom:5 }}>
                <span style={{ font:"600 5.5px/1 'JetBrains Mono',monospace", color:'#0066FF', textTransform:'uppercase', letterSpacing:'.1em' }}>THE METHODOLOGIST:</span>
              </div>
              <div style={{ background:'rgba(0,0,0,.35)', borderLeft:'2.5px solid #0066FF', borderRadius:'0 6px 6px 0', padding:'9px 10px', marginBottom:8 }}>
                <div style={{ font:"400 9.5px/1.55 'DM Serif Display',serif", color:'#fff' }}>Before we proceed — tell this panel: why did you choose this research problem, and what specific gap motivated it?</div>
              </div>
              <div style={{ font:"500 5px/1 'JetBrains Mono',monospace", color:'rgba(255,255,255,.38)', textTransform:'uppercase', letterSpacing:'.1em', marginBottom:4 }}>YOUR RESPONSE</div>
              <div style={{ background:'rgba(255,255,255,.04)', border:'1px solid rgba(255,255,255,.1)', borderRadius:5, padding:8, height:56, marginBottom:3 }}>
                <span style={{ font:'400 6.5px/1 Poppins,sans-serif', color:'rgba(255,255,255,.2)' }}>Type your answer here...</span>
              </div>
              <div style={{ textAlign:'right', font:'400 5px/1 Poppins,sans-serif', color:'rgba(255,255,255,.25)', marginBottom:7 }}>0 / 300 words</div>
              <div style={{ background:'#0066FF', borderRadius:5, padding:9, textAlign:'center', boxShadow:'0 3px 12px rgba(0,102,255,.45)' }}>
                <span style={{ font:'700 8px/1 Poppins,sans-serif', color:'#fff', letterSpacing:'.06em' }}>Send Answer</span>
              </div>
            </div>
          </Phone>
        </div>
      </section>
    </>
  )
}
```

- [ ] **Step 3: Wire ExpressSlides into the render**

In the main `TourCarousel` component body, find the section where the 4 standard slides are rendered (the four `<section className="oq-tour-slide...">` blocks). Wrap them and add the Express branch:

```jsx
{/* Slides */}
{isExpress ? (
  <ExpressSlides ready={ready} current={current} />
) : (
  <>
    {/* Slide 1 — Topic Validator */}
    <section className={`oq-tour-slide oq-tour-slide--phone-right${...}`}>
      {/* existing slide 1 content — unchanged */}
    </section>

    {/* Slide 2 — Chapter Architect */}
    <section className={`oq-tour-slide oq-tour-slide--phone-left${...}`}>
      {/* existing slide 2 content — unchanged */}
    </section>

    {/* Slide 3 — Writing Planner */}
    <section className={`oq-tour-slide oq-tour-slide--phone-right${...}`}>
      {/* existing slide 3 content — unchanged */}
    </section>

    {/* Slide 4 — Defence Simulator */}
    <section className={`oq-tour-slide oq-tour-slide--phone-left${...}`}>
      {/* existing slide 4 content — unchanged */}
    </section>
  </>
)}
```

Wrap only the slide sections, not the header or footer elements. The `oq-tour-header`, `oq-tour-footer`, dots, and Next button all remain outside the conditional.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors.

- [ ] **Step 5: Verify visually in browser**

In the dev server, temporarily add `<TourCarousel variant="express" onClose={() => {}} />` to any page (e.g. wrap it in the app root). Confirm:
- 3 dots in the footer (not 4)
- Slide 1: phone right, "Submit your project. Get the review your supervisor never gave you." headline, upload dropzone in phone
- Slide 2: phone left, "Your personal war brief." headline, Brief content in phone
- Slide 3: phone right, "Three examiners. Live questions. No mercy." headline, dark tribunal phone
- Next → advances slides, last slide shows "Finish ✓", keyboard arrows work
- Remove the temporary render after testing.

- [ ] **Step 6: Commit**

```bash
git add src/features/onboarding/TourCarousel.jsx
git commit -m "feat(express): add variant=express to TourCarousel with 3-slide express flow"
```

---

## Task 3: Add Express walkthrough prompt to ExpressDashboard

**Files:**
- Modify: `src/pages/ExpressDashboard.jsx`

**Interfaces:**
- Consumes: `<TourCarousel variant="express" onClose={fn} />` from Task 2
- Produces: First-visit walkthrough prompt on `/express`, tracked via `localStorage.getItem('fypro_express_tour_seen')`

### Steps

- [ ] **Step 1: Replace the DB-backed walkthrough check with localStorage**

In `src/pages/ExpressDashboard.jsx`, the current `useEffect` (lines 29–37) fetches `walkthrough_seen_at` from the DB. Replace it entirely:

```jsx
// Remove these imports (no longer needed for the walkthrough):
// import { markWalkthroughSeen, fetchOrCreateOnboardingRow } from '../lib/onboarding'
// import { supabase } from '../lib/supabase'
// (Only remove if not used elsewhere in the file — check first)

// Replace the walkthrough state + useEffect with:
const [showPrompt, setShowPrompt] = useState(false)
// Keep showTour state: const [showTour, setShowTour] = useState(false)

useEffect(() => {
  if (!user?.id) return
  const seen = localStorage.getItem('fypro_express_tour_seen')
  if (!seen) setShowPrompt(true)
}, [user?.id])
```

Check whether `markWalkthroughSeen`, `fetchOrCreateOnboardingRow`, and `supabase` are used anywhere else in the file before removing their imports. Remove only unused imports.

- [ ] **Step 2: Add the walkthrough prompt JSX**

Add the `showPrompt` conditional block immediately before the closing `</>` of the return statement (after the existing `{showTour && ...}` block):

```jsx
{showPrompt && !showTour && (
  <div className="wt2-screen">
    <div className="wt2-modal" role="dialog" aria-modal="true" aria-labelledby="wt2-express-heading">
      <div className="wt2-inner">
        <div className="wt2-icon-block">
          <div className="wt2-shield-wrap" aria-hidden="true">
            <svg className="wt2-shield-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="#0066FF" aria-hidden="true">
              <path d="M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z" />
            </svg>
          </div>
        </div>
        <div className="wt2-heading-block">
          <div className="wt2-eyebrow">Express Defence awaits</div>
          <h2 className="wt2-heading" id="wt2-express-heading">Quick look at how it works?</h2>
        </div>
        <div className="wt2-bullets" role="list">
          {[
            'Upload your project document for a full AI review',
            'Get your personalised Defence Brief with model answers',
            'Face 3 AI examiners in the Defence Simulator',
          ].map((b) => (
            <div key={b} className="wt2-bullet" role="listitem">
              <div className="wt2-check" aria-hidden="true">
                <svg viewBox="0 0 12 12"><polyline points="2,6 5,9 10,3" /></svg>
              </div>
              <span className="wt2-bullet-text">{b}</span>
            </div>
          ))}
        </div>
        <div className="wt2-btn-group">
          <button
            className="wt2-btn-primary"
            onClick={() => {
              localStorage.setItem('fypro_express_tour_seen', '1')
              setShowPrompt(false)
              setShowTour(true)
            }}
          >
            Take the tour <span className="wt2-arrow" aria-hidden="true">→</span>
          </button>
          <button
            className="wt2-btn-ghost"
            onClick={() => {
              localStorage.setItem('fypro_express_tour_seen', '1')
              setShowPrompt(false)
            }}
          >
            Skip to my dashboard
          </button>
        </div>
      </div>
    </div>
  </div>
)}
```

- [ ] **Step 3: Fix the TourCarousel render**

Find the existing `{showTour && ...}` block (currently lines 119–128) and update it:

```jsx
{showTour && (
  <TourCarousel
    variant="express"
    onClose={() => {
      setShowTour(false)
      localStorage.setItem('fypro_express_tour_seen', '1')
    }}
  />
)}
```

Remove the `startAt={3}` prop (it was incorrectly sending Express users to slide 4 of the standard carousel). Remove the async `supabase.auth.getSession()` + `markWalkthroughSeen` call — localStorage is the only tracking needed.

- [ ] **Step 4: Run typecheck**

```bash
npm run typecheck
```

Expected: no errors. Fix any unused import warnings.

- [ ] **Step 5: Verify end-to-end in browser**

Test the full Express first-visit flow:

1. Clear `fypro_express_tour_seen` from localStorage (DevTools → Application → Local Storage → delete the key)
2. Navigate to `/express`
3. Confirm the "Quick look at how it works?" prompt appears
4. Click "Take the tour →" — confirm the 3-slide Express carousel opens (Project Reviewer → Defence Brief → Defence Simulator)
5. Click through all 3 slides and click "Finish ✓"
6. Confirm you're back on the `/express` dashboard with no prompt
7. Refresh the page — confirm neither the prompt nor the carousel appears (localStorage key is set)

Test the skip path:
1. Clear `fypro_express_tour_seen` from localStorage again
2. Navigate to `/express`
3. Click "Skip to my dashboard" — confirm prompt dismisses immediately
4. Refresh — confirm prompt does not reappear

Test standard users who buy Express (regression):
1. Check that a user with `walkthrough_seen_at` set (standard onboarding complete) but `fypro_express_tour_seen` NOT set still sees the Express prompt. This is the point of localStorage separation.

- [ ] **Step 6: Commit**

```bash
git add src/pages/ExpressDashboard.jsx
git commit -m "feat(express): add express walkthrough prompt and fix tour to use express variant"
```

---

## Self-Review Notes

- **Spec coverage:** All 4 spec sections covered — chip content (Task 1), TourCarousel variant (Task 2), ExpressDashboard prompt (Task 3), localStorage tracking (Task 3 Step 1).
- **DB constraint:** Defence-date values map to existing CHECK constraint values (`<1m`, `1-3m`) — no migration needed.
- **Standard carousel regression:** Standard callers pass no `variant` prop → `variant` defaults to `"standard"` → `isExpress = false` → existing behaviour unchanged.
- **Dual-pack users:** Standard users who also bought Express have `walkthrough_seen_at` set in DB but `fypro_express_tour_seen` NOT in localStorage → they see the Express prompt (correct — they need orientation to the 3-step flow).
- **`startAt` removal:** The existing `startAt={3}` was sending Express users to slide 4 (Defence Simulator) of the standard carousel. Removing it is correct and intentional.
