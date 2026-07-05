# Share Card Styles Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let users pick between 3 visual styles (Dark Premium / Scoreboard / Academic Prestige) for the Defense Simulator's WhatsApp share card, via a picker modal that mirrors the existing certificate download flow.

**Architecture:** `api/share-card.js` gains two new Satori/`@vercel/og` render functions alongside the existing one, dispatched on a `style` request field (mirroring `api/certificate.js`'s existing style dispatch). The client mirrors this with three small preview components behind a `DefenseShareCard` dispatcher, plus a new `ShareCardStyleModal` (modeled on `CertificateDownloadModal.jsx`) that persists the chosen style to `localStorage` and drives the actual share action.

**Tech Stack:** React (Vite), `@vercel/og` (Satori) for server-side PNG rendering, `sharp` for one-off asset generation, vitest for pure-function tests.

**Spec:** `docs/superpowers/specs/2026-07-05-share-card-styles-design.md`

---

## Task 1: Extract shared card helpers (`scoreColor`, `truncate`) with tests

**Files:**
- Create: `src/components/share/cardHelpers.js`
- Create: `src/components/share/cardHelpers.test.js`
- Modify: `src/components/share/DefenseShareCard.jsx` (temporarily — its local `scoreColor`/`truncate` get removed here; the rest of the file is fully replaced in Task 2)

- [ ] **Step 1: Write the failing test**

Create `src/components/share/cardHelpers.test.js`:

```js
import { describe, it, expect } from 'vitest'
import { scoreColor, truncate } from './cardHelpers'

describe('scoreColor', () => {
  it('returns blue for a null score',   () => expect(scoreColor(null)).toBe('#3B82F6'))
  it('returns green for score 8',       () => expect(scoreColor(8)).toBe('#16A34A'))
  it('returns green for score 10',      () => expect(scoreColor(10)).toBe('#16A34A'))
  it('returns amber for score 5',       () => expect(scoreColor(5)).toBe('#F59E0B'))
  it('returns amber for score 7',       () => expect(scoreColor(7)).toBe('#F59E0B'))
  it('returns red for score 4',         () => expect(scoreColor(4)).toBe('#DC2626'))
  it('returns red for score 0',         () => expect(scoreColor(0)).toBe('#DC2626'))
})

describe('truncate', () => {
  it('returns empty string for null',      () => expect(truncate(null, 10)).toBe(''))
  it('returns empty string for undefined', () => expect(truncate(undefined, 10)).toBe(''))
  it('returns the string unchanged when under max', () => expect(truncate('short', 10)).toBe('short'))
  it('truncates and appends an ellipsis when over max', () => {
    expect(truncate('this is a long topic title', 10)).toBe('this is a…')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run src/components/share/cardHelpers.test.js`
Expected: FAIL — `Cannot find module './cardHelpers'` (the file doesn't exist yet)

- [ ] **Step 3: Create `cardHelpers.js`**

Create `src/components/share/cardHelpers.js`:

```js
export function scoreColor(score) {
  if (score == null) return '#3B82F6'
  if (score >= 8) return '#16A34A'
  if (score >= 5) return '#F59E0B'
  return '#DC2626'
}

export function truncate(str, max) {
  if (!str) return ''
  return str.length <= max ? str : str.slice(0, max - 1) + '…'
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run src/components/share/cardHelpers.test.js`
Expected: PASS (11 tests)

- [ ] **Step 5: Commit**

```bash
git add src/components/share/cardHelpers.js src/components/share/cardHelpers.test.js
git commit -m "test: add shared score/truncate helpers for share card styles"
```

---

## Task 2: Split `DefenseShareCard.jsx` into a style dispatcher + `DarkPremiumCard`

This extracts the existing (unchanged) Dark Premium visuals into their own file and turns `DefenseShareCard.jsx` into a thin switch, so Tasks 4–5 can add the two new styles as sibling files instead of growing one large component.

**Files:**
- Create: `src/components/share/cards/DarkPremiumCard.jsx`
- Modify: `src/components/share/DefenseShareCard.jsx` (full replacement)

- [ ] **Step 1: Create `DarkPremiumCard.jsx` with the existing visuals**

Create `src/components/share/cards/DarkPremiumCard.jsx` (this is the current contents of `DefenseShareCard.jsx`, unchanged except the import paths and the function/export name):

```jsx
import fyproLogo from '../../../assets/fypro-logo.png'
import { scoreColor, truncate } from '../cardHelpers'

export default function DarkPremiumCard({ score, scoreLabel, topic }) {
  const color = scoreColor(score)

  return (
    <div
      aria-label="Defense result share card preview"
      style={{
        width: 'min(270px, 100%)',
        aspectRatio: '270 / 337',
        height: 'auto',
        borderRadius: 16,
        overflow: 'hidden',
        background: 'linear-gradient(160deg, #060E18 0%, #0D1B2A 55%, #0F2235 100%)',
        border: '1px solid rgba(255,255,255,0.1)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.6), 0 0 40px rgba(0,102,255,0.08)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(0,102,255,0.04) 1px, transparent 1px)',
          backgroundSize: '18px 18px',
          pointerEvents: 'none',
        }}
      />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 6,
        padding: '16px 20px 0',
        position: 'relative',
      }}>
        <img
          src={fyproLogo}
          alt="FYPro"
          style={{ height: 22, width: 'auto', objectFit: 'contain', display: 'block' }}
        />
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.5rem',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.90)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          Defence Result
        </span>
      </div>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <div aria-hidden="true" style={{
          position: 'absolute',
          width: 90, height: 90,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${color}22, transparent 70%)`,
          filter: 'blur(12px)',
        }} />

        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.6rem',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.90)',
          textTransform: 'uppercase',
          letterSpacing: '0.14em',
          marginBottom: 4,
        }}>
          Panel Score
        </span>

        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '2.8rem',
          fontWeight: 700,
          color,
          lineHeight: 1,
          letterSpacing: '-0.02em',
          position: 'relative',
        }}>
          {score ?? '?'}<span style={{ fontSize: '1.2rem', color: 'rgba(255,255,255,0.55)' }}>/10</span>
        </span>

        {scoreLabel && (
          <span style={{
            marginTop: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.58rem',
            fontWeight: 700,
            color,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            padding: '3px 10px',
            borderRadius: 999,
            border: `1px solid ${color}55`,
            background: `${color}12`,
          }}>
            {scoreLabel.toUpperCase()}
          </span>
        )}
      </div>

      <div style={{ padding: '0 20px 12px' }}>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.62rem',
          color: 'rgba(255,255,255,0.75)',
          lineHeight: 1.5,
          margin: 0,
          textAlign: 'center',
        }}>
          {truncate(topic || 'Research topic', 80)}
        </p>
      </div>

      <div style={{
        padding: '10px 20px',
        borderTop: '1px solid rgba(255,255,255,0.07)',
      }}>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.6rem',
          color: 'rgba(255,255,255,0.70)',
          margin: 0,
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          I just simulated my project defense on FYPro.
        </p>
      </div>

      <div style={{
        padding: '8px 20px 14px',
        display: 'flex',
        justifyContent: 'center',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.52rem',
          fontWeight: 600,
          color: '#7ab8ff',
          letterSpacing: '0.08em',
          opacity: 0.9,
        }}>
          fypro.com.ng
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Replace `DefenseShareCard.jsx` with a style dispatcher**

Replace the full contents of `src/components/share/DefenseShareCard.jsx` with:

```jsx
// Visual preview of the shareable defense result card.
// The actual PNG is rendered server-side by /api/share-card.
// This component shows the same design in-app for preview — one
// sub-component per style, mirroring api/share-card.js's build functions.

import DarkPremiumCard from './cards/DarkPremiumCard'

export default function DefenseShareCard({ score, scoreLabel, topic, style = 'dark' }) {
  if (style === 'scoreboard') {
    // added in Task 4
  }
  if (style === 'prestige') {
    // added in Task 5
  }
  return <DarkPremiumCard score={score} scoreLabel={scoreLabel} topic={topic} />
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: no new errors

- [ ] **Step 4: Verify visually**

Run `npm run dev`, complete or view a past Defense Simulator session summary, and confirm the share card preview under "Download Result Card" looks pixel-identical to before this change (same navy background, same score, same layout).

- [ ] **Step 5: Commit**

```bash
git add src/components/share/DefenseShareCard.jsx src/components/share/cards/DarkPremiumCard.jsx
git commit -m "refactor: extract Dark Premium share card into its own component"
```

---

## Task 3: Generate the white/mono FYPro logo asset

The Scoreboard style (Task 4) needs a white version of the FYPro logo so it reads on green/amber/red backgrounds. `sharp` is already a project dependency (used by `scripts/generate-pwa-icons.mjs`), so this is a scripted recolor, not a hand-drawn asset: every non-transparent pixel in the existing logo becomes pure white, keeping the original alpha channel — this turns the current blue shield/"Pro" into solid white and keeps the already-faint "FY" watermark at its existing low opacity.

**Files:**
- Create: `scripts/generate-white-logo.mjs`
- Create (generated): `public/fypro-logo-white.png`
- Create (generated): `src/assets/fypro-logo-white.png`

- [ ] **Step 1: Write the script**

Create `scripts/generate-white-logo.mjs`. Note: the source logo encodes its "FY" ghost watermark as near-white RGB at full opacity (a trick that only reads as "faint" against a white page background) — not via alpha. `scripts/create-gold-logo.mjs` (an existing, similar script in this repo) handles this by mapping luminance to a gold color range so the ghost region ends up pale relative to the solid shield/"Pro" ink. A pure white variant has no equivalent "paler shade of white" to exploit, so the only way to make "FY" read as faint against an arbitrary colored background is to genuinely lower its alpha:

```js
import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { copyFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src        = resolve(__dirname, '../public/fypro-logo.png')
const publicOut  = resolve(__dirname, '../public/fypro-logo-white.png')
const assetsOut  = resolve(__dirname, '../src/assets/fypro-logo-white.png')

// The Scoreboard share card style fills the background with a solid
// score-tier color (green/amber/red). The source logo's "FY" ghost
// watermark is encoded as near-white RGB at full opacity — a trick that
// only reads as "faint" against a white page. On a colored background it
// would look just as solid as the shield/"Pro" ink. So: recolor every
// surviving pixel to white, and additionally drop the alpha of the
// near-white ("FY") region so it reads as a faint watermark against any
// background color, while the saturated (low-luminance) shield/"Pro" ink
// stays fully opaque.
const { data, info } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

for (let i = 0; i < data.length; i += info.channels) {
  const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
  if (a < 20) continue // already transparent — leave as-is

  const luminance = (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255

  data[i]     = 255
  data[i + 1] = 255
  data[i + 2] = 255
  data[i + 3] = luminance > 0.85 ? Math.round(a * 0.15) : a
}

await sharp(data, { raw: info }).png().toFile(publicOut)
copyFileSync(publicOut, assetsOut)

console.log('wrote', publicOut)
console.log('wrote', assetsOut)
```

The `0.85` luminance threshold and `0.15` alpha multiplier are starting points, not fixed values — validate them empirically in Step 3 below (sample actual pixel luminance values in the shield/"Pro" region vs. the "FY" region, the same way `scripts/create-gold-logo.mjs`'s `> 250` per-channel threshold was tuned) and adjust if the two regions aren't cleanly separated.

- [ ] **Step 2: Run the script**

Run: `node scripts/generate-white-logo.mjs`
Expected output:
```
wrote /path/to/fypro-v2/public/fypro-logo-white.png
wrote /path/to/fypro-v2/src/assets/fypro-logo-white.png
```

- [ ] **Step 3: Verify the output visually**

Reading a transparent PNG directly won't show whether "FY" is actually faint — it renders on a white viewer canvas either way. Composite the output onto a solid colored background (e.g. green `#16A34A`, matching one of the Scoreboard tier colors) using `sharp`'s `.flatten({ background: ... })` or a `.composite()` call, save that as a throwaway PNG, and view *that*. Confirm: shield outline and "Pro" text are solid, fully-opaque white; "FY" is visibly fainter than the shield/"Pro" (the background color should show through it) — not just faint against a white page, faint against an actual colored background. Sample a few raw pixel values (RGBA) from the shield/"Pro" region vs. the "FY" region to confirm the luminance threshold actually separated them as intended (this is the same failure mode a previous attempt at this asset hit: forcing RGB to white while leaving the source's already-fully-opaque alpha untouched produced a fully solid "FY" with no faintness at all once placed on a non-white background).

- [ ] **Step 4: Commit**

```bash
git add scripts/generate-white-logo.mjs public/fypro-logo-white.png src/assets/fypro-logo-white.png
git commit -m "feat: generate white/mono FYPro logo variant for Scoreboard share card style"
```

---

## Task 4: Build the `ScoreboardCard` client preview component

**Files:**
- Create: `src/components/share/cards/ScoreboardCard.jsx`
- Modify: `src/components/share/DefenseShareCard.jsx:9-11` (wire in the new style)

- [ ] **Step 1: Create `ScoreboardCard.jsx`**

Create `src/components/share/cards/ScoreboardCard.jsx`:

```jsx
import fyproLogoWhite from '../../../assets/fypro-logo-white.png'
import { scoreColor, truncate } from '../cardHelpers'

export default function ScoreboardCard({ score, scoreLabel, topic }) {
  const color = scoreColor(score)

  return (
    <div
      aria-label="Defense result share card preview"
      style={{
        width: 'min(270px, 100%)',
        aspectRatio: '270 / 337',
        height: 'auto',
        borderRadius: 16,
        overflow: 'hidden',
        background: color,
        border: '1px solid rgba(0,0,0,0.08)',
        boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div
        aria-hidden="true"
        style={{
          position: 'absolute', inset: 0,
          backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.16) 1.5px, transparent 1.5px)',
          backgroundSize: '18px 18px',
          pointerEvents: 'none',
        }}
      />

      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '16px 20px 0', position: 'relative' }}>
        <img
          src={fyproLogoWhite}
          alt="FYPro"
          style={{ height: 22, width: 'auto', objectFit: 'contain', display: 'block' }}
        />
        <div style={{ flex: 1 }} />
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.5rem',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.9)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        }}>
          Defence Result
        </span>
      </div>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '3.4rem',
          fontWeight: 700,
          color: '#fff',
          lineHeight: 0.9,
        }}>
          {score ?? '?'}<span style={{ fontSize: '1.4rem', color: 'rgba(255,255,255,0.7)' }}>/10</span>
        </span>

        {scoreLabel && (
          <span style={{
            marginTop: 10,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.62rem',
            fontWeight: 700,
            color,
            textTransform: 'uppercase',
            letterSpacing: '0.12em',
            padding: '4px 12px',
            borderRadius: 999,
            background: '#fff',
          }}>
            {scoreLabel.toUpperCase()}
          </span>
        )}
      </div>

      <div style={{ padding: '0 20px 12px', position: 'relative' }}>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.62rem',
          fontWeight: 600,
          color: 'rgba(255,255,255,0.92)',
          lineHeight: 1.5,
          margin: 0,
          textAlign: 'center',
        }}>
          {truncate(topic || 'Research topic', 80)}
        </p>
      </div>

      <div style={{ padding: '10px 20px', borderTop: '1px solid rgba(255,255,255,0.25)', position: 'relative' }}>
        <p style={{
          fontFamily: "'Poppins', sans-serif",
          fontSize: '0.6rem',
          color: 'rgba(255,255,255,0.85)',
          margin: 0,
          textAlign: 'center',
          lineHeight: 1.5,
        }}>
          I just simulated my project defense on FYPro.
        </p>
      </div>

      <div style={{ padding: '8px 20px 14px', display: 'flex', justifyContent: 'center', position: 'relative' }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.52rem',
          fontWeight: 700,
          color: '#fff',
          letterSpacing: '0.08em',
        }}>
          fypro.com.ng
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `DefenseShareCard.jsx`**

In `src/components/share/DefenseShareCard.jsx`, replace:

```jsx
import DarkPremiumCard from './cards/DarkPremiumCard'

export default function DefenseShareCard({ score, scoreLabel, topic, style = 'dark' }) {
  if (style === 'scoreboard') {
    // added in Task 4
  }
  if (style === 'prestige') {
    // added in Task 5
  }
  return <DarkPremiumCard score={score} scoreLabel={scoreLabel} topic={topic} />
}
```

with:

```jsx
import DarkPremiumCard from './cards/DarkPremiumCard'
import ScoreboardCard from './cards/ScoreboardCard'

export default function DefenseShareCard({ score, scoreLabel, topic, style = 'dark' }) {
  if (style === 'scoreboard') {
    return <ScoreboardCard score={score} scoreLabel={scoreLabel} topic={topic} />
  }
  if (style === 'prestige') {
    // added in Task 5
  }
  return <DarkPremiumCard score={score} scoreLabel={scoreLabel} topic={topic} />
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: no new errors

- [ ] **Step 4: Verify visually**

Run `npm run dev`. Temporarily pass `style="scoreboard"` to the `<DefenseShareCard>` usage in `src/features/defensePrep/DefensePrep.jsx` (around line 438), reload the defense summary screen, and confirm: solid green background (for a high score), huge white score digit, white pill badge, white logo readable against the green. Revert the temporary prop change afterward (it gets wired properly in Task 9).

- [ ] **Step 5: Commit**

```bash
git add src/components/share/cards/ScoreboardCard.jsx src/components/share/DefenseShareCard.jsx
git commit -m "feat: add Scoreboard share card style"
```

---

## Task 5: Build the `PrestigeCard` client preview component

**Files:**
- Create: `src/components/share/cards/PrestigeCard.jsx`
- Modify: `src/components/share/DefenseShareCard.jsx` (wire in the new style)

- [ ] **Step 1: Create `PrestigeCard.jsx`**

Create `src/components/share/cards/PrestigeCard.jsx`:

```jsx
import { truncate } from '../cardHelpers'

const GOLD = '#C9A84C'
const SHIELD_PATH = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

export default function PrestigeCard({ score, scoreLabel, topic }) {
  return (
    <div
      aria-label="Defense result share card preview"
      style={{
        width: 'min(270px, 100%)',
        aspectRatio: '270 / 337',
        height: 'auto',
        borderRadius: 10,
        overflow: 'hidden',
        background: '#FFFDF5',
        border: `2px solid ${GOLD}`,
        boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      <div aria-hidden="true" style={{ position: 'absolute', top: 8, left: 8, width: 18, height: 18, borderTop: `2px solid ${GOLD}`, borderLeft: `2px solid ${GOLD}` }} />
      <div aria-hidden="true" style={{ position: 'absolute', top: 8, right: 8, width: 18, height: 18, borderTop: `2px solid ${GOLD}`, borderRight: `2px solid ${GOLD}` }} />
      <div aria-hidden="true" style={{ position: 'absolute', bottom: 8, left: 8, width: 18, height: 18, borderBottom: `2px solid ${GOLD}`, borderLeft: `2px solid ${GOLD}` }} />
      <div aria-hidden="true" style={{ position: 'absolute', bottom: 8, right: 8, width: 18, height: 18, borderBottom: `2px solid ${GOLD}`, borderRight: `2px solid ${GOLD}` }} />

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '22px 20px 0', position: 'relative' }}>
        <svg width="26" height="26" viewBox="0 0 256 256" fill={GOLD} aria-hidden="true">
          <path d={SHIELD_PATH} />
        </svg>
        <span style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '0.72rem',
          color: '#0D1B2A',
          letterSpacing: '0.14em',
          marginTop: 8,
        }}>
          DEFENCE RESULT
        </span>
      </div>

      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative',
      }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.62rem',
          color: '#7A6530',
          letterSpacing: '0.1em',
          marginBottom: 6,
        }}>
          PANEL SCORE
        </span>
        <span style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '2.4rem',
          fontWeight: 700,
          color: '#0D1B2A',
          lineHeight: 1,
        }}>
          {score ?? '?'}<span style={{ fontSize: '1.1rem', color: '#7A6530' }}>/10</span>
        </span>
        {scoreLabel && (
          <span style={{
            marginTop: 8,
            fontFamily: "'JetBrains Mono', monospace",
            fontSize: '0.56rem',
            fontWeight: 700,
            color: '#7A6530',
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            padding: '3px 10px',
            border: `1px solid ${GOLD}`,
          }}>
            {scoreLabel.toUpperCase()}
          </span>
        )}
      </div>

      <div style={{ padding: '0 22px 10px', position: 'relative' }}>
        <p style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontStyle: 'italic',
          fontSize: '0.62rem',
          color: '#0D1B2A',
          textAlign: 'center',
          margin: 0,
        }}>
          {truncate(topic || 'Research topic', 80)}
        </p>
      </div>

      <div style={{ padding: '8px 22px', borderTop: `1px solid ${GOLD}66`, position: 'relative' }}>
        <p style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '0.6rem',
          color: '#0D1B2A',
          textAlign: 'center',
          margin: 0,
        }}>
          I just simulated my project defense on FYPro.
        </p>
      </div>

      <div style={{ padding: '6px 20px 12px', textAlign: 'center', position: 'relative' }}>
        <span style={{
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: '0.52rem',
          fontWeight: 600,
          color: '#7A6530',
          letterSpacing: '0.06em',
        }}>
          fypro.com.ng
        </span>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Wire it into `DefenseShareCard.jsx`**

Replace the full contents of `src/components/share/DefenseShareCard.jsx` with the final version:

```jsx
// Visual preview of the shareable defense result card.
// The actual PNG is rendered server-side by /api/share-card.
// This component shows the same design in-app for preview — one
// sub-component per style, mirroring api/share-card.js's build functions.

import DarkPremiumCard from './cards/DarkPremiumCard'
import ScoreboardCard from './cards/ScoreboardCard'
import PrestigeCard from './cards/PrestigeCard'

export default function DefenseShareCard({ score, scoreLabel, topic, style = 'dark' }) {
  if (style === 'scoreboard') {
    return <ScoreboardCard score={score} scoreLabel={scoreLabel} topic={topic} />
  }
  if (style === 'prestige') {
    return <PrestigeCard score={score} scoreLabel={scoreLabel} topic={topic} />
  }
  return <DarkPremiumCard score={score} scoreLabel={scoreLabel} topic={topic} />
}
```

- [ ] **Step 3: Run typecheck**

Run: `npm run typecheck`
Expected: no new errors

- [ ] **Step 4: Verify visually**

Run `npm run dev`. Temporarily pass `style="prestige"` to the `<DefenseShareCard>` usage in `src/features/defensePrep/DefensePrep.jsx` (around line 438), reload the defense summary screen, and confirm: ivory background, gold corner ornaments, gold shield icon at top (not a "FY" circle), serif typography. Then temporarily try `style="scoreboard"` and `style="dark"` too, confirming all three still render correctly through the dispatcher. Revert the temporary prop change afterward (wired properly in Task 9).

- [ ] **Step 5: Commit**

```bash
git add src/components/share/cards/PrestigeCard.jsx src/components/share/DefenseShareCard.jsx
git commit -m "feat: add Academic Prestige share card style"
```

---

## Task 6: Add server-side Scoreboard and Prestige renderers to `api/share-card.js`

**Files:**
- Modify: `api/share-card.js`

- [ ] **Step 1: Rename the existing builder**

In `api/share-card.js`, rename `buildCardElement` to `buildDarkCard` (function declaration at line 39 and its call site at line 339). No other changes to this function's body — it stays visually identical.

- [ ] **Step 2: Add `buildScoreboardCard`**

Immediately after the `buildDarkCard` function (which now ends at the line that used to be line 261, `}`), add:

```js
function buildScoreboardCard(score, scoreLabel, topic, studentName, logoBase64) {
  const color = scoreColor(score)
  const scoreDisplay = score != null ? String(score) : '?'

  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: WIDTH,
      height: HEIGHT,
      background: color,
      fontFamily: "'Poppins', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    },
  },
    // Dot texture overlay
    React.createElement('div', {
      style: {
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(255,255,255,0.16) 2px, transparent 2px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      },
    }),

    // ── Header ────────────────────────────────────────────────────────────────
    React.createElement('div', {
      style: { display: 'flex', alignItems: 'center', padding: '64px 80px 0', gap: 16, position: 'relative' },
    },
      logoBase64
        ? React.createElement('img', { src: logoBase64, style: { height: 48, width: 160, objectFit: 'contain' } })
        : React.createElement('span', {
            style: { fontFamily: 'Georgia, serif', fontSize: 40, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em' },
          }, 'FYPro'),

      React.createElement('div', { style: { flex: 1 } }),

      React.createElement('span', {
        style: { fontFamily: 'monospace', fontSize: 20, fontWeight: 600, color: 'rgba(255,255,255,0.85)', textTransform: 'uppercase', letterSpacing: '0.1em' },
      }, 'Defence Result'),
    ),

    // ── Score block ───────────────────────────────────────────────────────────
    React.createElement('div', {
      style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', gap: 24 },
    },
      React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
        React.createElement('span', {
          style: { fontFamily: 'monospace', fontSize: 260, fontWeight: 700, color: '#FFFFFF', lineHeight: 0.9, letterSpacing: '-0.04em' },
        }, scoreDisplay),
        React.createElement('span', {
          style: { fontFamily: 'monospace', fontSize: 80, fontWeight: 400, color: 'rgba(255,255,255,0.7)', lineHeight: 1 },
        }, '/10'),
      ),

      scoreLabel && React.createElement('div', {
        style: { display: 'flex', padding: '12px 40px', borderRadius: 999, background: '#FFFFFF' },
      },
        React.createElement('span', {
          // Fixed dark text, not the tier `color` — matches the WCAG contrast
          // fix already applied to the client ScoreboardCard.jsx preview
          // (white-background badges with tier-colored text failed AA for
          // green/amber/blue tiers; only red happened to pass).
          style: { fontFamily: 'monospace', fontSize: 28, fontWeight: 700, color: '#0D1B2A', textTransform: 'uppercase', letterSpacing: '0.14em' },
        }, (scoreLabel || '').toUpperCase()),
      ),

      studentName && React.createElement('span', {
        style: { fontFamily: 'sans-serif', fontSize: 32, fontWeight: 600, color: 'rgba(255,255,255,0.92)', letterSpacing: '0.01em', marginTop: 8 },
      }, truncate(studentName, 40)),
    ),

    // ── Topic ─────────────────────────────────────────────────────────────────
    React.createElement('div', {
      style: { padding: '0 80px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, position: 'relative' },
    },
      React.createElement('div', { style: { width: '72%', height: 3, background: '#FFFFFF', borderRadius: 999, opacity: 0.85 } }),
      React.createElement('p', {
        style: { fontFamily: 'sans-serif', fontSize: 30, fontWeight: 600, color: 'rgba(255,255,255,0.92)', lineHeight: 1.5, margin: 0, textAlign: 'center' },
      }, truncate(topic || '', 80)),
    ),

    // ── Caption + Footer ──────────────────────────────────────────────────────
    React.createElement('div', {
      style: { borderTop: '1px solid rgba(255,255,255,0.3)', padding: '36px 80px 56px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'relative' },
    },
      React.createElement('p', {
        style: { fontFamily: 'sans-serif', fontSize: 28, color: 'rgba(255,255,255,0.85)', margin: 0, textAlign: 'center', lineHeight: 1.5 },
      }, 'I just simulated my project defense on FYPro.'),
      React.createElement('span', {
        style: { fontFamily: 'monospace', fontSize: 26, fontWeight: 700, color: '#FFFFFF', letterSpacing: '0.06em' },
      }, 'fypro.com.ng'),
    ),
  )
}
```

- [ ] **Step 3: Add `buildPrestigeCard`**

Immediately after `buildScoreboardCard`, add:

```js
const SHIELD_PATH = 'M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z'

function buildPrestigeCard(score, scoreLabel, topic, studentName) {
  const scoreDisplay = score != null ? String(score) : '?'
  const gold = '#C9A84C' // decorative strokes/icon only — not used for text
  // '#7A6530' below (not '#8a7638') is the WCAG-contrast-fixed muted-gold
  // text color already applied to the client PrestigeCard.jsx preview
  // (~4.36:1 against the ivory background failed AA for small text; this
  // clears ~5.5:1).

  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: WIDTH,
      height: HEIGHT,
      background: '#FFFDF5',
      fontFamily: 'Georgia, serif',
      position: 'relative',
      overflow: 'hidden',
      border: `6px solid ${gold}`,
    },
  },
    // Corner ornaments
    React.createElement('div', { style: { position: 'absolute', top: 40, left: 40, width: 48, height: 48, borderTop: `3px solid ${gold}`, borderLeft: `3px solid ${gold}` } }),
    React.createElement('div', { style: { position: 'absolute', top: 40, right: 40, width: 48, height: 48, borderTop: `3px solid ${gold}`, borderRight: `3px solid ${gold}` } }),
    React.createElement('div', { style: { position: 'absolute', bottom: 40, left: 40, width: 48, height: 48, borderBottom: `3px solid ${gold}`, borderLeft: `3px solid ${gold}` } }),
    React.createElement('div', { style: { position: 'absolute', bottom: 40, right: 40, width: 48, height: 48, borderBottom: `3px solid ${gold}`, borderRight: `3px solid ${gold}` } }),

    // ── Header ────────────────────────────────────────────────────────────────
    React.createElement('div', {
      style: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '88px 80px 0', gap: 16, position: 'relative' },
    },
      React.createElement('svg', { width: 72, height: 72, viewBox: '0 0 256 256', fill: gold },
        React.createElement('path', { d: SHIELD_PATH }),
      ),
      React.createElement('span', {
        style: { fontFamily: 'Georgia, serif', fontSize: 28, color: '#0D1B2A', letterSpacing: '0.3em' },
      }, 'DEFENCE RESULT'),
    ),

    // ── Score block ───────────────────────────────────────────────────────────
    React.createElement('div', {
      style: { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', position: 'relative', gap: 24 },
    },
      React.createElement('span', {
        style: { fontFamily: 'monospace', fontSize: 24, color: '#7A6530', textTransform: 'uppercase', letterSpacing: '0.2em' },
      }, 'Panel Score'),

      React.createElement('div', { style: { display: 'flex', alignItems: 'baseline', gap: 8 } },
        React.createElement('span', {
          style: { fontFamily: 'Georgia, serif', fontSize: 180, fontWeight: 700, color: '#0D1B2A', lineHeight: 1 },
        }, scoreDisplay),
        React.createElement('span', {
          style: { fontFamily: 'Georgia, serif', fontSize: 64, fontWeight: 400, color: '#7A6530', lineHeight: 1 },
        }, '/10'),
      ),

      scoreLabel && React.createElement('div', {
        style: { display: 'flex', padding: '10px 36px', border: `2px solid ${gold}` },
      },
        React.createElement('span', {
          style: { fontFamily: 'monospace', fontSize: 26, fontWeight: 700, color: '#7A6530', textTransform: 'uppercase', letterSpacing: '0.14em' },
        }, (scoreLabel || '').toUpperCase()),
      ),

      studentName && React.createElement('span', {
        style: { fontFamily: 'Georgia, serif', fontSize: 30, fontStyle: 'italic', color: '#0D1B2A', marginTop: 8 },
      }, truncate(studentName, 40)),
    ),

    // ── Topic ─────────────────────────────────────────────────────────────────
    React.createElement('div', {
      style: { padding: '0 96px 40px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, position: 'relative' },
    },
      React.createElement('div', { style: { width: '60%', height: 2, background: gold, opacity: 0.85 } }),
      React.createElement('p', {
        style: { fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: 28, color: '#0D1B2A', lineHeight: 1.5, margin: 0, textAlign: 'center' },
      }, truncate(topic || '', 80)),
    ),

    // ── Caption + Footer ──────────────────────────────────────────────────────
    React.createElement('div', {
      style: { borderTop: `1px solid ${gold}66`, padding: '36px 80px 60px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, position: 'relative' },
    },
      React.createElement('p', {
        style: { fontFamily: 'Georgia, serif', fontSize: 26, color: '#0D1B2A', margin: 0, textAlign: 'center', lineHeight: 1.5 },
      }, 'I just simulated my project defense on FYPro.'),
      React.createElement('span', {
        style: { fontFamily: 'monospace', fontSize: 24, fontWeight: 700, color: '#7A6530', letterSpacing: '0.06em' },
      }, 'fypro.com.ng'),
    ),
  )
}
```

- [ ] **Step 4: Read `style` from the request and dispatch to the right builder**

In `handler()`, change:

```js
  // ── Fetch defense result (server reads the score — client cannot fake it) ─
  const { project_id } = req.body || {}
  if (!project_id) return res.status(400).json({ error: 'project_id required' })
```

to:

```js
  // ── Fetch defense result (server reads the score — client cannot fake it) ─
  const { project_id, style } = req.body || {}
  if (!project_id) return res.status(400).json({ error: 'project_id required' })

  // style is cosmetic only — it never affects the score/topic/name below,
  // so a client sending a bogus value just falls back to the default look.
  const VALID_STYLES = ['dark', 'scoreboard', 'prestige']
  const safeStyle = VALID_STYLES.includes(style) ? style : 'dark'
```

Then change:

```js
  // ── Render PNG via @vercel/og ─────────────────────────────────────────────
  let logoBase64 = null
  try {
    const logoRes = await fetch('https://www.fypro.com.ng/fypro-logo.png')
    if (!logoRes.ok) throw new Error('logo fetch failed')
    const logoBuffer = await logoRes.arrayBuffer()
    const logoData = Buffer.from(logoBuffer).toString('base64')
    logoBase64 = `data:image/png;base64,${logoData}`
  } catch (_) {
    // logo fetch failed — card renders without it
  }

  try {
    const imgResponse = new ImageResponse(
      buildDarkCard(score, scoreLabel, topic, studentName, logoBase64),
      { width: WIDTH, height: HEIGHT }
    )
```

(this still reads `buildDarkCard` here because Step 1 already renamed it — this snippet is what the file looks like after Step 1, before this step's edit)

to:

```js
  // ── Render PNG via @vercel/og ─────────────────────────────────────────────
  // Prestige has no raster logo (it uses an inline SVG shield instead), so
  // skip the network fetch entirely for that style.
  let logoBase64 = null
  if (safeStyle !== 'prestige') {
    try {
      const logoUrl = safeStyle === 'scoreboard'
        ? 'https://www.fypro.com.ng/fypro-logo-white.png'
        : 'https://www.fypro.com.ng/fypro-logo.png'
      const logoRes = await fetch(logoUrl)
      if (!logoRes.ok) throw new Error('logo fetch failed')
      const logoBuffer = await logoRes.arrayBuffer()
      const logoData = Buffer.from(logoBuffer).toString('base64')
      logoBase64 = `data:image/png;base64,${logoData}`
    } catch (_) {
      // logo fetch failed — card renders without it
    }
  }

  try {
    const cardElement =
      safeStyle === 'scoreboard' ? buildScoreboardCard(score, scoreLabel, topic, studentName, logoBase64) :
      safeStyle === 'prestige'   ? buildPrestigeCard(score, scoreLabel, topic, studentName) :
      buildDarkCard(score, scoreLabel, topic, studentName, logoBase64)

    const imgResponse = new ImageResponse(
      cardElement,
      { width: WIDTH, height: HEIGHT }
    )
```

- [ ] **Step 5: Verify with a local render script**

`api/share-card.js` has no unit tests today (consistent with the rest of `api/` — this project's test coverage is concentrated in `src/lib`), and `npm run dev` only runs the Vite frontend, not the serverless functions. Verify the three builders render without throwing by exercising them directly with Node, bypassing the HTTP handler (no Supabase/auth needed for this check):

Create a throwaway script — do not commit it — at the repo root, e.g. `verify-share-card.mjs`:

```js
import { ImageResponse } from '@vercel/og'
import { writeFileSync } from 'fs'

// Copy buildDarkCard/buildScoreboardCard/buildPrestigeCard's current source
// out of api/share-card.js into this file temporarily (they aren't exported),
// or temporarily add `export` in front of each function definition and
// `import { buildDarkCard, buildScoreboardCard, buildPrestigeCard } from './api/share-card.js'` here instead.

const styles = { dark: buildDarkCard, scoreboard: buildScoreboardCard, prestige: buildPrestigeCard }
for (const [name, build] of Object.entries(styles)) {
  const element = name === 'prestige'
    ? build(8, 'Defence Ready', 'Impact of Mobile Money on Rural Financial Inclusion in Nigeria', 'Ada Obi')
    : build(8, 'Defence Ready', 'Impact of Mobile Money on Rural Financial Inclusion in Nigeria', 'Ada Obi', null)
  const res = new ImageResponse(element, { width: 1080, height: 1350 })
  writeFileSync(`verify-${name}.png`, Buffer.from(await res.arrayBuffer()))
  console.log('wrote', `verify-${name}.png`)
}
```

Run: `node verify-share-card.mjs`
Expected: three PNGs written with no thrown errors. Open each and visually confirm they match the client preview components from Tasks 2, 4, and 5. Delete `verify-share-card.mjs` and the three generated PNGs afterward — they're a one-off local check, not project artifacts.

- [ ] **Step 6: Commit**

```bash
git add api/share-card.js
git commit -m "feat: add Scoreboard and Academic Prestige renderers to the share card API"
```

---

## Task 7: Thread the `style` parameter through `fetchShareCardBlob`

**Files:**
- Modify: `src/lib/shareCard.ts:8-31`

- [ ] **Step 1: Update the function signature and request body**

In `src/lib/shareCard.ts`, replace:

```ts
export async function fetchShareCardBlob(projectId: string): Promise<Blob> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const res = await fetch('/api/share-card', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ project_id: projectId }),
  })
```

with:

```ts
export async function fetchShareCardBlob(
  projectId: string,
  style: 'dark' | 'scoreboard' | 'prestige' = 'dark'
): Promise<Blob> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const res = await fetch('/api/share-card', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ project_id: projectId, style }),
  })
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no new errors

- [ ] **Step 3: Commit**

```bash
git add src/lib/shareCard.ts
git commit -m "feat: add style parameter to fetchShareCardBlob"
```

---

## Task 8: Build `ShareCardStyleModal.jsx`

**Files:**
- Create: `src/components/share/ShareCardStyleModal.jsx`

- [ ] **Step 1: Create the modal**

Create `src/components/share/ShareCardStyleModal.jsx`:

```jsx
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { fetchShareCardBlob, shareToWhatsApp } from '../../lib/shareCard'
import { supabase } from '../../lib/supabase'
import Sentry from '../../lib/sentry'
import { useTheme } from '../../context/ThemeContext'

const STYLES = [
  {
    id:    'dark',
    label: 'Dark Premium',
    desc:  'Navy, blue glow',
    preview: (
      <div style={{ background: 'linear-gradient(160deg,#060E18,#0D1B2A)', borderRadius: 4, overflow: 'hidden', height: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: 6 }}>
        <div style={{ fontSize: 6, color: '#fff', fontFamily: 'Georgia,serif', letterSpacing: 1 }}>FYPro</div>
        <div style={{ fontSize: 16, fontWeight: 700, color: '#16A34A', fontFamily: 'monospace' }}>8<span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>/10</span></div>
        <div style={{ width: 28, height: 1.5, background: '#0066FF', borderRadius: 1, opacity: 0.8 }} />
      </div>
    ),
  },
  {
    id:    'scoreboard',
    label: 'Scoreboard',
    desc:  'Bold color, huge score',
    preview: (
      <div style={{ background: '#16A34A', borderRadius: 4, overflow: 'hidden', height: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: 6 }}>
        <div style={{ fontSize: 6, color: '#fff', fontFamily: 'Georgia,serif', letterSpacing: 1 }}>FYPro</div>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'monospace' }}>8<span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)' }}>/10</span></div>
        <div style={{ fontSize: 5, fontWeight: 700, color: '#16A34A', background: '#fff', borderRadius: 999, padding: '1px 6px' }}>READY</div>
      </div>
    ),
  },
  {
    id:    'prestige',
    label: 'Academic Prestige',
    desc:  'Ivory, gold shield',
    preview: (
      <div style={{ background: '#FFFDF5', border: '1.5px solid #C9A84C', borderRadius: 4, height: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative', padding: 6 }}>
        <div style={{ position: 'absolute', top: 3, left: 3, width: 8, height: 8, borderTop: '1.5px solid #C9A84C', borderLeft: '1.5px solid #C9A84C' }} />
        <div style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderTop: '1.5px solid #C9A84C', borderRight: '1.5px solid #C9A84C' }} />
        <div style={{ position: 'absolute', bottom: 3, left: 3, width: 8, height: 8, borderBottom: '1.5px solid #C9A84C', borderLeft: '1.5px solid #C9A84C' }} />
        <div style={{ position: 'absolute', bottom: 3, right: 3, width: 8, height: 8, borderBottom: '1.5px solid #C9A84C', borderRight: '1.5px solid #C9A84C' }} />
        <svg width="14" height="14" viewBox="0 0 256 256" fill="#C9A84C" aria-hidden="true">
          <path d="M80.57,117A8,8,0,0,1,91,112.57l29,11.61V96a8,8,0,0,1,16,0v28.18l29-11.61A8,8,0,1,1,171,127.43l-30.31,12.12L158.4,163.2a8,8,0,1,1-12.8,9.6L128,149.33,110.4,172.8a8,8,0,1,1-12.8-9.6l17.74-23.65L85,127.43A8,8,0,0,1,80.57,117ZM224,56v56c0,52.72-25.52,84.67-46.93,102.19-23.06,18.86-46,25.27-47,25.53a8,8,0,0,1-4.2,0c-1-.26-23.91-6.67-47-25.53C57.52,196.67,32,164.72,32,112V56A16,16,0,0,1,48,40H208A16,16,0,0,1,224,56Zm-16,0L48,56l0,56c0,37.3,13.82,67.51,41.07,89.81A128.25,128.25,0,0,0,128,223.62a129.3,129.3,0,0,0,39.41-22.2C194.34,179.16,208,149.07,208,112Z" />
        </svg>
        <div style={{ width: 22, height: 1, background: 'rgba(201,168,76,0.5)', borderRadius: 1 }} />
      </div>
    ),
  },
]

export default function ShareCardStyleModal({ isOpen, onClose, projectId, score, scoreLabel, topic, initialStyle = 'dark', onStyleChange }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [style,   setStyle]   = useState(initialStyle)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState(null)

  if (!isOpen) return null

  async function handleShare() {
    if (!projectId) { setError('Project ID not available — please try again.'); return }
    setError(null)
    setLoading(true)
    localStorage.setItem('share_card_style', style)
    try {
      const blob = await fetchShareCardBlob(projectId, style)
      await shareToWhatsApp(blob, score ?? null, topic || '')
      onStyleChange?.(style)
      onClose()
    } catch (err) {
      const sentryErr = err instanceof Error ? err : new Error(String(err))
      supabase.auth.getUser()
        .then(({ data }) => {
          Sentry.withScope(scope => {
            scope.setTag('feature', 'share_card_generation')
            scope.setExtra('project_id', projectId)
            scope.setExtra('style', style)
            if (data?.user?.id) scope.setUser({ id: data.user.id })
            Sentry.captureException(sentryErr)
          })
        })
        .catch(() => Sentry.captureException(sentryErr))
      setError(err.message || 'Failed to generate share card.')
    } finally {
      setLoading(false)
    }
  }

  const bg      = isDark ? '#0D1B2A' : '#FFFFFF'
  const overlay = 'rgba(0,0,0,0.6)'
  const border  = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(13,27,42,0.12)'
  const text1   = isDark ? '#FFFFFF'               : '#0D1B2A'
  const text2   = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(13,27,42,0.55)'
  const label   = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(13,27,42,0.4)'

  return createPortal(
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div style={{
        background: bg, borderRadius: 16, border: `1px solid ${border}`,
        padding: '28px 24px', width: '100%', maxWidth: 400,
        boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 24px 64px rgba(0,0,0,0.15)',
        animation: 'card-enter 0.2s ease forwards',
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.1rem', color: text1, margin: 0, marginBottom: 4 }}>
              Share Result Card
            </p>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', color: text2, margin: 0 }}>
              Choose your style
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(13,27,42,0.06)',
              border: 'none', color: text2, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: label, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>
          Style
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 22 }}>
          {STYLES.map(s => {
            const active = style === s.id
            return (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                style={{
                  border:       active ? '2px solid #0066FF' : `1.5px solid ${border}`,
                  borderRadius: 10, padding: '10px 6px', textAlign: 'center',
                  background:   active ? (isDark ? 'rgba(0,102,255,0.1)' : '#EFF6FF') : 'transparent',
                  cursor: 'pointer', position: 'relative', transition: 'all 0.15s ease',
                }}
              >
                {active && (
                  <div style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 14, height: 14, background: '#0066FF', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, color: '#fff',
                  }}>✓</div>
                )}
                <div style={{ marginBottom: 6 }}>{s.preview}</div>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.6rem', color: active ? '#0066FF' : text2, margin: 0, lineHeight: 1.3, fontWeight: active ? 600 : 400 }}>
                  {s.label}
                </p>
              </button>
            )
          })}
        </div>

        {error && (
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: '#DC2626', marginBottom: 10 }}>
            Failed to generate the card. Please try again or{' '}
            <a href="https://wa.me/2348029061967" target="_blank" rel="noopener noreferrer" style={{ color: '#4ADE80', textDecoration: 'underline' }}>contact us on WhatsApp</a>.
          </p>
        )}

        <button
          onClick={handleShare}
          disabled={loading}
          style={{
            width: '100%', padding: '13px', borderRadius: 10,
            background: loading ? 'rgba(37,211,102,0.5)' : '#25D366',
            color: '#FFFFFF', border: 'none',
            fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.875rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease', marginBottom: 10,
          }}
        >
          {loading ? 'Generating your card…' : '⬇ Share to WhatsApp'}
        </button>

        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: text2 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
```

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no new errors (this file isn't wired into any page yet, so nothing renders it — Task 9 does that)

- [ ] **Step 3: Commit**

```bash
git add src/components/share/ShareCardStyleModal.jsx
git commit -m "feat: add ShareCardStyleModal component"
```

---

## Task 9: Wire the modal into `DefensePrep.jsx`

**Files:**
- Modify: `src/features/defensePrep/DefensePrep.jsx:44-45, 290-482`

- [ ] **Step 1: Update imports**

In `src/features/defensePrep/DefensePrep.jsx`, replace:

```js
import { fetchShareCardBlob, shareToWhatsApp } from '../../lib/shareCard'
import DefenseShareCard from '../../components/share/DefenseShareCard'
```

with:

```js
import DefenseShareCard from '../../components/share/DefenseShareCard'
import ShareCardStyleModal from '../../components/share/ShareCardStyleModal'
```

(`fetchShareCardBlob`/`shareToWhatsApp` are no longer called directly from this file — they now live inside `ShareCardStyleModal`.)

- [ ] **Step 2: Replace the share state and `handleShare` function**

Replace:

```jsx
const SummaryCard = memo(function SummaryCard({ data, onClose, projectId, topic, defenseSessionId, isExpress = false }) {
  const panelLabel = (data.panel_score_label || '').toLowerCase()
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError]     = useState(null)
  const { theme } = useTheme()
  const isLight = theme === 'light'

  async function handleShare() {
    if (!projectId) { setShareError('Project ID not available — please try again.'); return }
    setShareError(null)
    setShareLoading(true)
    try {
      const blob = await fetchShareCardBlob(projectId)
      await shareToWhatsApp(blob, data.panel_score ?? null, topic || '')
    } catch (err) {
      setShareError(err.message || 'Failed to generate share card.')
    } finally {
      setShareLoading(false)
    }
  }
```

with:

```jsx
const SummaryCard = memo(function SummaryCard({ data, onClose, projectId, topic, defenseSessionId, isExpress = false }) {
  const panelLabel = (data.panel_score_label || '').toLowerCase()
  const [shareStyle, setShareStyle] = useState(() => localStorage.getItem('share_card_style') || 'dark')
  const [showShareModal, setShowShareModal] = useState(false)
  const { theme } = useTheme()
  const isLight = theme === 'light'
```

- [ ] **Step 3: Update the "Download Result Card" section**

Replace (the block starting at `<p className="dp-summary-section-label"...>Download Result Card</p>` through the closing `</div>` of the share button's wrapper, i.e. what was lines 436–482):

```jsx
            <p className="dp-summary-section-label" style={{ marginBottom: 16 }}>Download Result Card</p>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
              <DefenseShareCard
                score={data.panel_score ?? null}
                scoreLabel={data.panel_score_label || null}
                topic={topic || ''}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.78rem', color: isLight ? 'rgba(13,27,42,0.55)' : 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>
                  Download your result card and share it on WhatsApp.
                </p>
                {shareError && (
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', color: '#DC2626', margin: 0 }}>
                    {shareError}
                  </p>
                )}
                <button
                  className="dp-share-whatsapp-btn"
                  onClick={handleShare}
                  disabled={shareLoading}
                  aria-label="Share result to WhatsApp"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: shareLoading ? 'rgba(37,211,102,0.5)' : '#25D366',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '12px 20px',
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: shareLoading ? 'not-allowed' : 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    justifyContent: 'center',
                  }}
                >
                  {shareLoading ? <Spinner size={18} /> : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                    </svg>
                  )}
                  {shareLoading ? 'Generating card…' : 'Share to WhatsApp'}
                </button>
              </div>
            </div>
          </div>

          <button className="dp-summary-done-btn" onClick={onClose}>
            Close Defence Session
          </button>
        </div>
      </div>
    </>
  )
})
```

with:

```jsx
            <p className="dp-summary-section-label" style={{ marginBottom: 16 }}>Download Result Card</p>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 20, flexWrap: 'wrap', justifyContent: 'center' }}>
              <DefenseShareCard
                score={data.panel_score ?? null}
                scoreLabel={data.panel_score_label || null}
                topic={topic || ''}
                style={shareStyle}
              />
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, flex: 1, minWidth: 0 }}>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.78rem', color: isLight ? 'rgba(13,27,42,0.55)' : 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>
                  Choose a style and share your result card on WhatsApp.
                </p>
                <button
                  className="dp-share-whatsapp-btn"
                  onClick={() => setShowShareModal(true)}
                  aria-label="Choose a style and share result to WhatsApp"
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: '#25D366',
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    padding: '12px 20px',
                    fontFamily: "'Poppins', sans-serif",
                    fontWeight: 600,
                    fontSize: '0.82rem',
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    width: '100%',
                    justifyContent: 'center',
                  }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                  </svg>
                  Share to WhatsApp
                </button>
              </div>
            </div>
          </div>

          <button className="dp-summary-done-btn" onClick={onClose}>
            Close Defence Session
          </button>
        </div>
      </div>

      <ShareCardStyleModal
        isOpen={showShareModal}
        onClose={() => setShowShareModal(false)}
        projectId={projectId}
        score={data.panel_score ?? null}
        scoreLabel={data.panel_score_label || null}
        topic={topic || ''}
        initialStyle={shareStyle}
        onStyleChange={setShareStyle}
      />
    </>
  )
})
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: no new errors

- [ ] **Step 5: Verify visually**

Run `npm run dev`, complete or open a past Defense Simulator session summary, and confirm:
1. Clicking "Share to WhatsApp" opens `ShareCardStyleModal` instead of sharing immediately.
2. All 3 style thumbnails render and are selectable (border highlight + checkmark on the active one).
3. Confirming a style inside the modal shares the correct-looking card (check the downloaded/shared PNG matches the selected style).
4. After closing the modal, the outer `DefenseShareCard` preview reflects the newly chosen style.
5. Reload the page — the previously chosen style is still selected when the modal is reopened (persisted via `localStorage['share_card_style']`).
6. Repeat for a project with a low score (<5) and confirm the Scoreboard style shows a red background with a still-readable white logo, and a mid-range score (5–7) shows amber.

- [ ] **Step 6: Commit**

```bash
git add src/features/defensePrep/DefensePrep.jsx
git commit -m "feat: open a style picker modal before sharing the defense result card"
```

---

## Task 10: Final verification pass

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass, including the new `cardHelpers.test.js`

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: no errors

- [ ] **Step 3: Run a production build**

Run: `npm run build`
Expected: build succeeds — this catches any stray unused imports (e.g. leftover `shareLoading`/`shareError`/`handleShare` references) that `vitest`/`tsc` might not flag in `.jsx` files.

- [ ] **Step 4: End-to-end manual QA**

Using the running dev server (`npm run dev`) and a deployed preview (for the actual `/api/share-card` PNG generation, since Vite alone doesn't serve `api/`):
1. Generate a share card at each of the 3 styles for a high (≥8), mid (5–7), and low (<5) score, confirming Scoreboard's background color and Prestige's fixed gold palette are both correct via the real endpoint.
2. Confirm the in-app preview and the actual downloaded/shared PNG match for all 3 styles.
3. Confirm the modal's persisted style choice survives a page reload.

- [ ] **Step 5: Commit any final fixes**

If Step 3 or Step 4 surfaces anything (e.g. an unused import), fix it and commit:

```bash
git add -A
git commit -m "fix: clean up unused share card references after style picker rollout"
```
