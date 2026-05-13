# FYPro Landing Page UI Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring `LandingPage.jsx` from a 6.5/10 to a 10/10 by fixing three bugs, rebuilding the hero mockup, and adding three urgency signals.

**Architecture:** All 7 tasks touch a single file — `src/pages/LandingPage.jsx` (1283 lines). No new files, no new routes, no new imports. CSS animations go in an inline `<style>` tag inside `HeroMockup`. Tasks are ordered from simplest to most complex so each commit is immediately verifiable.

**Tech Stack:** React 18, Vite, Tailwind CSS, Framer Motion, custom CSS variables from `design-system/fypro/MASTER.md`

**Dev server:** `npm run dev` — runs on http://localhost:5174

---

## File Map

| File | Role | What changes |
|------|------|-------------|
| `src/pages/LandingPage.jsx:779-784` | `FEAT_COLOR_MAP` | Fix `border` values for green/amber/red |
| `src/pages/LandingPage.jsx:894` | `HowItWorks` subtitle | `mb-[60px]` → `mb-[28px]` |
| `src/pages/LandingPage.jsx:1034-1066` | `LandingFAQItem` | Fix border colour |
| `src/pages/LandingPage.jsx:1069-1096` | `LandingFAQSection` | Wrap in card container |
| `src/pages/LandingPage.jsx:471-596` | `HeroMockup` | Full rebuild: LIVE badge, timer, active/waiting examiners, typing dots |
| `src/pages/LandingPage.jsx:629` | `Hero` | Remove `useReveal()` for mockup wrapper |
| `src/pages/LandingPage.jsx:694-703` | `Hero` actions | Add urgency nudge below CTA buttons |
| `src/pages/LandingPage.jsx:721-726` | `StatsBar` + `StatItem` | Replace 4th stat with "1 in 3" pressure stat |
| `src/pages/LandingPage.jsx:1155-1172` | `FinalCTA` | Sharpen headline, add failure quote, add nudge |

---

## Task 1 — Fix Feature Card Border Colors

**Files:**
- Modify: `src/pages/LandingPage.jsx:779-784`

- [ ] **Step 1: Make the edit**

Find this block at line 779:
```js
const FEAT_COLOR_MAP = {
  blue:  { kicker: '#60A5FA', iconBg: 'rgba(0,102,255,0.12)', border: '#0066FF' },
  green: { kicker: '#4ADE80', iconBg: 'rgba(22,163,74,0.12)', border: '#0066FF' },
  amber: { kicker: '#FCD34D', iconBg: 'rgba(245,158,11,0.12)', border: '#0066FF' },
  red:   { kicker: '#F87171', iconBg: 'rgba(220,38,38,0.12)', border: '#0066FF' },
}
```

Replace with:
```js
const FEAT_COLOR_MAP = {
  blue:  { kicker: '#60A5FA', iconBg: 'rgba(0,102,255,0.12)', border: '#0066FF' },
  green: { kicker: '#4ADE80', iconBg: 'rgba(22,163,74,0.12)', border: '#16A34A' },
  amber: { kicker: '#FCD34D', iconBg: 'rgba(245,158,11,0.12)', border: '#F59E0B' },
  red:   { kicker: '#F87171', iconBg: 'rgba(220,38,38,0.12)', border: '#DC2626' },
}
```

- [ ] **Step 2: Verify in browser**

Open http://localhost:5174. Scroll to the Features section. Confirm:
- Step 1 (Topic Validator) has a blue left border
- Step 2 (Chapter Architect) has a green left border
- Step 3 (Methodology Advisor) has an amber/gold left border
- Steps 5 and 6 have green and red left borders respectively

- [ ] **Step 3: Commit**

```bash
git add src/pages/LandingPage.jsx
git commit -m "fix(landing): feature card left-border colours now match step identity"
```

---

## Task 2 — Fix How It Works Dead Gap

**Files:**
- Modify: `src/pages/LandingPage.jsx:894`

- [ ] **Step 1: Make the edit**

Find line 894 — the subtitle paragraph inside `HowItWorks`:
```jsx
<Reveal delay={0.1} as="p" className="text-center text-white/65 text-[0.975rem] max-w-[500px] mx-auto mb-[60px] leading-[1.75]">Designed around the exact journey Nigerian final year students go through — with or without a present supervisor.</Reveal>
```

Change `mb-[60px]` to `mb-[28px]`:
```jsx
<Reveal delay={0.1} as="p" className="text-center text-white/65 text-[0.975rem] max-w-[500px] mx-auto mb-[28px] leading-[1.75]">Designed around the exact journey Nigerian final year students go through — with or without a present supervisor.</Reveal>
```

- [ ] **Step 2: Verify in browser**

Scroll to the "How It Works" section. The subtitle text should now sit tight above Step 01 with no large dead zone between them.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LandingPage.jsx
git commit -m "fix(landing): remove ~150px dead gap in How It Works section"
```

---

## Task 3 — Fix FAQ: Card Container + Border

**Files:**
- Modify: `src/pages/LandingPage.jsx:1034-1096`

- [ ] **Step 1: Update LandingFAQItem border colour**

Find `LandingFAQItem` at line 1034. Change `border-[var(--border-color)]` to `border-white/[0.06]`:

```jsx
function LandingFAQItem({ q, a, isOpen, onToggle }) {
  return (
    <div className="border-b border-white/[0.06] py-5">
      <button
        className="w-full flex items-center justify-between text-left bg-transparent border-0 cursor-pointer group"
        onClick={onToggle}
      >
        <span className="font-sans font-medium text-white text-[0.9rem] pr-4 leading-snug">{q}</span>
        <motion.svg
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="flex-shrink-0 text-slate-500 group-hover:text-slate-300 transition-colors duration-150"
          width="20" height="20" viewBox="0 0 24 24"
          fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </motion.svg>
      </button>
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            style={{ overflow: 'hidden' }}
          >
            <p className="font-sans text-slate-400 text-sm leading-relaxed mt-3 pb-2">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
```

- [ ] **Step 2: Rewrite LandingFAQSection with card container**

Replace the entire `LandingFAQSection` function (lines 1069–1096):

```jsx
function LandingFAQSection() {
  const [openIndex, setOpenIndex] = useState(null)
  return (
    <section id="faq" className="py-24 bg-bg-dark">
      <div className="max-w-3xl mx-auto px-5 md:px-10">
        <Reveal delay={0.05}>
          <div style={{
            background: 'linear-gradient(150deg, #0D1B2A 0%, #091420 100%)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: '16px',
            overflow: 'hidden',
          }}>
            <div style={{ padding: '24px 24px 0' }}>
              <div style={{ fontFamily: 'monospace', fontSize: '0.6rem', letterSpacing: '0.12em', textTransform: 'uppercase', color: '#60A5FA', marginBottom: '8px' }}>Common Questions</div>
              <h2 style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: 'clamp(1.5rem,3vw,2rem)', color: 'white', marginBottom: '6px', fontWeight: 'normal' }}>Frequently asked questions</h2>
              <p style={{ fontSize: '0.875rem', color: 'rgba(255,255,255,0.5)', marginBottom: '20px' }}>Everything you need to know before you start.</p>
            </div>
            <div style={{ height: '1px', background: 'rgba(255,255,255,0.06)' }} />
            <div style={{ padding: '0 24px' }}>
              {LANDING_FAQ_ITEMS.map((item, i) => (
                <LandingFAQItem
                  key={i}
                  q={item.q}
                  a={item.a}
                  isOpen={openIndex === i}
                  onToggle={() => setOpenIndex(openIndex === i ? null : i)}
                />
              ))}
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
```

- [ ] **Step 3: Verify in browser**

Scroll to the FAQ section. Confirm:
- Questions appear inside a dark card with rounded corners and a visible border
- No dead space below the last question
- Accordion still opens and closes correctly
- Borders between items are visible (subtle white/6%)

- [ ] **Step 4: Commit**

```bash
git add src/pages/LandingPage.jsx
git commit -m "fix(landing): wrap FAQ in card container, remove dead space below"
```

---

## Task 4 — Rebuild HeroMockup

This is the largest change. The mockup currently uses `useReveal()` on all three examiner cards, making it invisible until the IntersectionObserver fires (which often never happens in viewport). We also add a LIVE SESSION badge, animated timer bar, and active/waiting examiner states.

**Files:**
- Modify: `src/pages/LandingPage.jsx:471-596` (`HeroMockup`)
- Modify: `src/pages/LandingPage.jsx:626-714` (`Hero` — remove `mockupRef` and `mockupVisible`)

- [ ] **Step 1: Replace the entire HeroMockup function**

Find `function HeroMockup()` at line 471. Replace everything from line 471 to the closing `}` at line 596 with:

```jsx
function HeroMockup() {
  const [hoveredCard, setHoveredCard] = useState(null)

  const steps = [
    { label: 'Topic Validator', done: true },
    { label: 'Chapter Architect', done: true },
    { label: 'Methodology Advisor', done: true },
    { label: 'Instrument Builder', done: true },
    { label: 'Writing Planner', done: true },
    { label: 'Defense Simulator', active: true },
  ]

  const examiners = [
    {
      av: 'TM', avCls: 'bg-[rgba(0,102,255,0.3)] border-[1.5px] border-[rgba(0,102,255,0.6)]',
      name: 'The Methodologist', role: 'EXTERNAL EXAMINER',
      q: '"Your research objectives claim to be exploratory yet your design is conclusive. Justify this contradiction before we go further."',
      asking: true,
    },
    {
      av: 'SE', avCls: 'bg-[rgba(245,158,11,0.2)] border-[1.5px] border-[rgba(245,158,11,0.5)]',
      name: 'The Subject Expert', role: 'INTERNAL EXAMINER',
      q: 'Waiting for your answer...',
      asking: false,
    },
    {
      av: 'EE', avCls: 'bg-[rgba(22,163,74,0.2)] border-[1.5px] border-[rgba(22,163,74,0.5)]',
      name: 'The External Examiner', role: 'EXT. UNIVERSITY · PANEL',
      q: 'Watching your response...',
      asking: false,
    },
  ]

  return (
    <>
      <style>{`
        @keyframes lp-drain { from { width: 90%; } to { width: 15%; } }
        @keyframes lp-blink { 0%,80%,100% { opacity: 0.2; } 40% { opacity: 1; } }
        @keyframes lp-pulse-red { 0%,100% { opacity:1; box-shadow:0 0 0 0 rgba(248,113,113,0.5); } 50% { opacity:0.7; box-shadow:0 0 0 4px rgba(248,113,113,0); } }
        .lp-timer-fill { height: 100%; background: linear-gradient(90deg, #F87171, #DC2626); border-radius: 2px; animation: lp-drain 8s linear infinite; }
        .lp-typing-dot { width: 4px; height: 4px; border-radius: 50%; background: #60A5FA; }
        .lp-typing-dot:nth-child(1) { animation: lp-blink 1.2s ease-in-out infinite 0s; }
        .lp-typing-dot:nth-child(2) { animation: lp-blink 1.2s ease-in-out infinite 0.2s; }
        .lp-typing-dot:nth-child(3) { animation: lp-blink 1.2s ease-in-out infinite 0.4s; }
        .lp-live-dot { width: 6px; height: 6px; border-radius: 50%; background: #F87171; animation: lp-pulse-red 1.4s ease-in-out infinite; flex-shrink: 0; }
      `}</style>
      <div className="relative rounded-[24px] border border-[rgba(0,102,255,0.22)] overflow-hidden" style={{ background: '#080F1C', boxShadow: '0 0 0 1px rgba(0,102,255,0.08), 0 24px 64px rgba(0,0,0,0.55), 0 4px 16px rgba(0,0,0,0.4)' }}>
        {/* Chrome */}
        <div className="flex items-center gap-3 px-5 py-3 border-b border-white/5 bg-white/[0.03]">
          <div className="flex gap-1.5">
            {[0,1,2].map(i => <div key={i} className="w-2.5 h-2.5 rounded-full bg-white/[0.08] border border-white/[0.14]" />)}
          </div>
          <div className="flex-1 bg-white/5 rounded-lg py-[5px] px-3 font-mono text-[0.7rem] text-white/35 text-center">www.fypro.com.ng — Step 6: Defense Simulator</div>
          <div className="flex items-center gap-1.5 rounded-full px-2.5 py-1 flex-shrink-0" style={{ background: 'rgba(220,38,38,0.12)', border: '1px solid rgba(220,38,38,0.35)' }}>
            <div className="lp-live-dot" />
            <span className="font-mono text-[0.6rem] tracking-[0.08em] whitespace-nowrap" style={{ color: 'rgba(248,113,113,0.95)' }}>LIVE SESSION</span>
          </div>
        </div>

        {/* Shell */}
        <div className="grid min-h-[370px] grid-cols-1 md:grid-cols-[220px_1fr]">
          {/* Sidebar */}
          <div className="hidden md:block border-r border-white/5 py-5 bg-black/20">
            <div className="flex items-center gap-2 px-5 pb-4 border-b border-white/5 mb-3">
              <img src="/fypro-logo.png" alt="FYPro" height="32" style={{ objectFit: 'contain' }} />
            </div>
            {steps.map(({ label, done, active }) => (
              <div key={label} className={`flex items-center gap-2 px-5 py-[9px] text-[0.72rem] font-medium border-l-2 ${active ? 'text-white bg-[rgba(0,102,255,0.12)] border-blue-brand' : done ? 'text-[rgba(22,163,74,0.8)] border-transparent' : 'text-white/40 border-transparent'}`}>
                <div className="w-[7px] h-[7px] rounded-full bg-current flex-shrink-0" />{label}
              </div>
            ))}
          </div>

          {/* Content */}
          <div className="p-6 flex flex-col gap-3.5">
            <div className="border-b border-white/5 pb-3.5">
              <div className="font-mono text-[0.62rem] tracking-[0.12em] uppercase text-blue-brand mb-1">Step 6 of 6 — Defense Prep</div>
              <div className="font-serif text-[1.1rem] text-white">Three-Examiner Panel Simulation</div>
            </div>

            {/* Timer bar */}
            <div className="flex items-center gap-2.5">
              <div className="font-mono text-[0.6rem] whitespace-nowrap" style={{ color: 'rgba(248,113,113,0.8)' }}>⏱ 01:23 remaining</div>
              <div className="flex-1 h-[3px] rounded-[2px] overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
                <div className="lp-timer-fill" />
              </div>
              <div className="font-mono text-[0.6rem] whitespace-nowrap" style={{ color: 'rgba(248,113,113,0.8)' }}>respond now</div>
            </div>

            {/* Examiners */}
            <div className="grid gap-2.5 grid-cols-1 sm:grid-cols-3">
              {examiners.map(({ av, avCls, name, role, q, asking }) => {
                const hovered = hoveredCard === name
                return (
                  <div
                    key={name}
                    onMouseEnter={() => setHoveredCard(name)}
                    onMouseLeave={() => setHoveredCard(null)}
                    className="rounded-xl p-3.5 cursor-default"
                    style={{
                      background: asking ? 'rgba(0,102,255,0.07)' : 'rgba(255,255,255,0.03)',
                      border: hovered ? '1px solid rgba(59,130,246,0.5)' : asking ? '1px solid rgba(0,102,255,0.4)' : '1px solid rgba(255,255,255,0.08)',
                      boxShadow: asking ? '0 0 20px rgba(0,102,255,0.15)' : 'none',
                      opacity: asking ? 1 : 0.5,
                      transition: 'all 0.2s ease',
                    }}
                  >
                    <div className={`w-[34px] h-[34px] rounded-full flex items-center justify-center font-mono text-[0.6rem] font-bold text-white mb-2 ${avCls}`}>{av}</div>
                    <div className="text-[0.68rem] font-bold text-white mb-0.5">{name}</div>
                    <div className="font-mono text-[0.58rem] text-white/35 mb-2">{role}</div>
                    {asking ? (
                      <>
                        <div className="text-[0.66rem] text-white/65 leading-[1.5] italic">{q}</div>
                        <div className="flex gap-[3px] mt-2">
                          <div className="lp-typing-dot" />
                          <div className="lp-typing-dot" />
                          <div className="lp-typing-dot" />
                        </div>
                      </>
                    ) : (
                      <div className="text-[0.66rem] leading-[1.5]" style={{ color: 'rgba(255,255,255,0.3)' }}>{q}</div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Vulnerabilities */}
            <div className="bg-[rgba(220,38,38,0.06)] border border-[rgba(220,38,38,0.22)] rounded-xl p-3 px-3.5">
              <div className="font-mono text-[0.6rem] tracking-[0.1em] uppercase text-[rgba(248,113,113,0.9)] mb-2">PROJECT VULNERABILITIES DETECTED</div>
              {[
                '⚠ Sampling frame excludes postgraduate respondents — representativeness risk',
                '⚠ Chapter 2 theoretical framework not linked to research objectives',
                '⚠ No triangulation strategy declared for mixed-methods design',
              ].map((v, i) => (
                <div key={i} className={`text-[0.68rem] text-white/[0.62] leading-[1.6] py-[3px] ${i > 0 ? 'border-t border-[rgba(220,38,38,0.1)]' : ''}`}>{v}</div>
              ))}
            </div>

            {/* Chips */}
            <div className="flex gap-2 flex-wrap">
              <div className="font-mono text-[0.62rem] px-2.5 py-1 rounded-lg bg-[rgba(22,163,74,0.12)] border border-[rgba(22,163,74,0.3)] text-[#4ADE80]">Readiness Score: 71 / 100</div>
              <div className="font-mono text-[0.62rem] px-2.5 py-1 rounded-lg bg-[rgba(0,102,255,0.12)] border border-[rgba(0,102,255,0.3)] text-[#60A5FA]">4 questions remaining</div>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
```

- [ ] **Step 2: Remove useReveal from Hero's mockup wrapper**

Find the `Hero` function at line 626. Locate these two lines:
```jsx
const [mockupRef, mockupVisible] = useReveal()
```
Delete that line entirely.

Then find the mockup wrapper div around line 706:
```jsx
<div
  ref={mockupRef}
  className="relative z-[1] w-full max-w-[880px]"
  style={{ opacity: mockupVisible ? 1 : 0, transform: mockupVisible ? 'translateY(0)' : 'translateY(24px)', transition: 'opacity 0.5s ease, transform 0.5s ease' }}
>
```

Replace with:
```jsx
<div className="relative z-[1] w-full max-w-[880px]">
```

- [ ] **Step 3: Verify in browser**

Reload http://localhost:5174. WITHOUT scrolling, the mockup should be fully visible immediately on page load. Confirm:
- Red LIVE SESSION pill visible in the chrome bar with pulsing dot
- Timer bar draining from right to left in the content area
- The Methodologist has a blue glow, full opacity, and shows typing dots
- Subject Expert and External Examiner are dimmed to 50% opacity
- The readiness score now reads 71/100 (not 84/100)

- [ ] **Step 4: Commit**

```bash
git add src/pages/LandingPage.jsx
git commit -m "feat(landing): rebuild HeroMockup with LIVE badge, timer, active/waiting examiner states"
```

---

## Task 5 — Add Urgency Nudge Under Hero CTAs

**Files:**
- Modify: `src/pages/LandingPage.jsx:694-703` (Hero actions div)

- [ ] **Step 1: Make the edit**

Find the actions div in `Hero` at line 694:
```jsx
<div
  className="lp-hero-cta relative z-[1] flex gap-3 items-center justify-center flex-wrap mb-[72px]"
  style={{ animationDelay: '1800ms' }}
>
  <BtnLink href="/login" className="lp-btn-shimmer px-8 py-3.5 text-base bg-blue-brand text-white hover:shadow-[0_0_24px_rgba(0,102,255,0.4)] hover:-translate-y-0.5">Start Free</BtnLink>
  <BtnLink href="#how-it-works" className="px-8 py-3.5 text-base bg-transparent text-white border border-white/[0.22] hover:border-white/45 hover:bg-white/[0.04]">
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/></svg>
    See How It Works
  </BtnLink>
</div>
```

Replace with:
```jsx
<div
  className="lp-hero-cta relative z-[1] flex flex-col items-center gap-4 mb-[72px]"
  style={{ animationDelay: '1800ms' }}
>
  <div className="flex gap-3 items-center justify-center flex-wrap">
    <BtnLink href="/login" className="lp-btn-shimmer px-8 py-3.5 text-base bg-blue-brand text-white hover:shadow-[0_0_24px_rgba(0,102,255,0.4)] hover:-translate-y-0.5">Start Free</BtnLink>
    <BtnLink href="#how-it-works" className="px-8 py-3.5 text-base bg-transparent text-white border border-white/[0.22] hover:border-white/45 hover:bg-white/[0.04]">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="10"/><polygon points="10,8 16,12 10,16" fill="currentColor" stroke="none"/></svg>
      See How It Works
    </BtnLink>
  </div>
  <div className="flex items-center gap-2">
    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F87171', animation: 'lp-pulse-red 1.4s ease-in-out infinite', flexShrink: 0 }} />
    <span className="font-mono text-[0.7rem]" style={{ color: 'rgba(248,113,113,0.85)', letterSpacing: '0.04em' }}>Most students start 3 weeks before their defense. The earlier, the better.</span>
  </div>
</div>
```

- [ ] **Step 2: Verify in browser**

Reload the page. Under the "Start Free" and "See How It Works" buttons, a subtle red-tinted monospace line should appear with a pulsing red dot. It should not be aggressive — quiet but present.

- [ ] **Step 3: Commit**

```bash
git add src/pages/LandingPage.jsx
git commit -m "feat(landing): add urgency nudge below hero CTA buttons"
```

---

## Task 6 — Replace Stats Bar 4th Stat

**Files:**
- Modify: `src/pages/LandingPage.jsx:337-349` (`StatItem`)
- Modify: `src/pages/LandingPage.jsx:721-736` (`StatsBar`)

- [ ] **Step 1: Update StatItem to support urgent styling**

Find `StatItem` at line 337:
```jsx
function StatItem({ renderNumber, target, label, delay }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, amount: 0.5 })
  const count = useCountUp(target, inView)
  return (
    <Reveal delay={delay} className="text-center">
      <div ref={ref} className="lp-stat-num-wrap font-serif leading-none mb-2" style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '3.2rem', color: '#60A5FA' }}>
        {renderNumber(count)}
      </div>
      <div className="text-[0.82rem] text-white/65 font-medium">{label}</div>
    </Reveal>
  )
}
```

Replace with:
```jsx
function StatItem({ renderNumber, target, label, delay, urgent }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: false, amount: 0.5 })
  const count = useCountUp(target ?? 0, inView)
  return (
    <Reveal delay={delay} className="text-center">
      <div ref={ref} className="lp-stat-num-wrap font-serif leading-none mb-2" style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '3.2rem', color: urgent ? '#F87171' : '#60A5FA' }}>
        {renderNumber(count)}
      </div>
      <div className="text-[0.82rem] font-medium" style={{ color: urgent ? 'rgba(248,113,113,0.75)' : 'rgba(255,255,255,0.65)' }}>{label}</div>
    </Reveal>
  )
}
```

- [ ] **Step 2: Replace the fourth stat in StatsBar**

Find the `stats` array inside `StatsBar` at line 721:
```jsx
const stats = [
  { target: 500, renderNumber: (n) => <>{n}<em className="not-italic text-blue-brand">K+</em></>, label: 'Final year students in Nigeria', delay: 0 },
  { target: 6, renderNumber: (n) => <em className="not-italic text-blue-brand">{n}</em>, label: 'Structured research steps', delay: 0.1 },
  { target: 3, renderNumber: (n) => <em className="not-italic text-blue-brand">{n}</em>, label: 'AI examiners on your panel', delay: 0.2 },
  { target: 1, renderNumber: (n) => <>₦<em className="not-italic text-blue-brand">{n}B+</em></>, label: 'Academic coaching market (NG)', delay: 0.3 },
]
```

Replace with:
```jsx
const stats = [
  { target: 500, renderNumber: (n) => <>{n}<em className="not-italic text-blue-brand">K+</em></>, label: 'Final year students in Nigeria', delay: 0 },
  { target: 6, renderNumber: (n) => <em className="not-italic text-blue-brand">{n}</em>, label: 'Structured research steps', delay: 0.1 },
  { target: 3, renderNumber: (n) => <em className="not-italic text-blue-brand">{n}</em>, label: 'AI examiners on your panel', delay: 0.2 },
  { target: 0, renderNumber: () => <span style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '2.4rem', color: '#F87171' }}>1 in 3</span>, label: 'Students asked to repeat their defense due to poor preparation', delay: 0.3, urgent: true },
]
```

- [ ] **Step 3: Verify in browser**

Scroll to the stats bar. The four stats should now be:
- 500K+ Final year students in Nigeria
- 6 Structured research steps
- 3 AI examiners on your panel
- `1 in 3` (in red) Students asked to repeat their defense... (red label text)

- [ ] **Step 4: Commit**

```bash
git add src/pages/LandingPage.jsx
git commit -m "feat(landing): replace investor-facing stat with student-facing pressure stat"
```

---

## Task 7 — Sharpen Final CTA Copy

**Files:**
- Modify: `src/pages/LandingPage.jsx:1155-1172` (`FinalCTA`)

- [ ] **Step 1: Make the edit**

Find `FinalCTA` at line 1155. Replace the entire function:

```jsx
function FinalCTA() {
  return (
    <section className="py-24 relative overflow-hidden" style={{ background: '#060E18' }}>
      <div className="lp-cta-glow" aria-hidden="true" />
      <div className="max-w-[1080px] mx-auto px-5 md:px-10 relative z-[1]">
        <div className="max-w-[620px] mx-auto text-center">
          <ShieldIcon size={56} className="block mx-auto mb-[22px]" style={{ filter: 'drop-shadow(0 4px 18px rgba(0,102,255,0.45))' }} />
          <Reveal as="h2" className="font-serif text-white leading-[1.15] mb-3.5" style={{ fontSize: 'clamp(1.9rem,4.5vw,3rem)' }}>
            Your defense is coming.<br />Are you <em style={{ fontStyle: 'italic', color: '#60A5FA' }}>actually</em> ready?
          </Reveal>
          <Reveal delay={0.1} as="p" className="text-base text-white/65 leading-[1.75] mb-4">
            Every question an examiner can ask, FYPro has already asked you first.<br />
            Most students who fail their defense say the same thing: <em style={{ color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>"I thought I was prepared."</em>
          </Reveal>
          <Reveal delay={0.12}>
            <div className="flex items-center justify-center gap-2 mb-7">
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#F87171', animation: 'lp-pulse-red 1.4s ease-in-out infinite', flexShrink: 0 }} />
              <span className="font-mono text-[0.7rem]" style={{ color: 'rgba(248,113,113,0.8)', letterSpacing: '0.04em' }}>Join students currently using FYPro to prepare</span>
            </div>
          </Reveal>
          <Reveal delay={0.15} className="flex justify-center gap-3 flex-wrap">
            <BtnLink href="/login" className="lp-btn-shimmer px-8 py-3.5 text-base bg-blue-brand text-white hover:shadow-[0_0_24px_rgba(0,102,255,0.4)] hover:-translate-y-0.5">Start Free — No Sign Up</BtnLink>
            <BtnLink href="#how-it-works" className="px-8 py-3.5 text-base bg-transparent text-white border border-white/[0.22] hover:border-white/45 hover:bg-white/[0.04]">See the 6 Steps</BtnLink>
          </Reveal>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify in browser**

Scroll to the bottom of the page. Confirm:
- Headline reads: "Your defense is coming. Are you *actually* ready?" (with "actually" in blue italic)
- Subtext includes the failure quote in italic: "I thought I was prepared."
- Red pulsing dot with "Join students currently using FYPro to prepare" text sits between subtext and buttons
- Both CTA buttons render correctly below

- [ ] **Step 3: Commit**

```bash
git add src/pages/LandingPage.jsx
git commit -m "feat(landing): sharpen final CTA with failure quote and urgency counter"
```

---

## Final Verification Checklist

After all 7 tasks are committed, do a full page review:

- [ ] Hero mockup is visible immediately on load (no scroll required)
- [ ] LIVE SESSION red badge pulses in the chrome bar
- [ ] Timer bar drains left-to-right in an 8s loop
- [ ] The Methodologist card is bright + has typing dots; other two are dimmed to 50%
- [ ] Red urgency nudge visible under hero CTA buttons
- [ ] Stats bar 4th stat is red "1 in 3" text, not "₦1B+"
- [ ] Feature cards: green border on Step 2, amber on Step 3, red on Step 6
- [ ] How It Works: no dead gap between subtitle and Step 01
- [ ] FAQ: contained in dark card, no dead space below last item, accordion still works
- [ ] Final CTA: "actually" in blue italic, failure quote present, red nudge dot present
- [ ] No console errors in browser devtools
