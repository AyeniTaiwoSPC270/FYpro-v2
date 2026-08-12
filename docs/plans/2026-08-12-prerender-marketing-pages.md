# Prerender Public Marketing Pages — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship real static HTML for FYPro's four public marketing routes (`/`, `/pricing`, `/about`, `/contact`) at build time, so crawlers that don't execute JS see actual content instead of an empty `<div id="root">` shell — while every other route keeps working exactly as it does today.

**Architecture:** A new build-time script (`scripts/prerender.mjs`) starts a local Vite preview server against the built `dist/`, drives a headless Chrome (Puppeteer, already a devDependency) through each of the four routes, captures the fully client-rendered HTML, and writes it to its own static file. The original empty shell is preserved as `dist/shell.html` and becomes the fallback destination for every other route via a one-line `vercel.json` rewrite change.

**Tech Stack:** Vite 8 (`preview()` JS API), Puppeteer 24 (already used by `scripts/screenshot-flyers.mjs`), Vercel static hosting + rewrites.

**Note on testing approach:** this plan builds a build-time automation script, not application logic — like the existing `scripts/screenshot-*.mjs` files in this repo, it has no unit test suite. Verification instead happens by actually running the script against a real build and asserting on its output (grepping the generated HTML files for real page content), which is the closest equivalent to red/green here: there's no meaningful "write a failing test" step for a file that doesn't exist yet, so each task's checks are "run it, inspect the output, confirm it's correct."

Full design context: `docs/specs/2026-08-12-prerender-marketing-pages-design.md`.

---

### Task 1: Write `scripts/prerender.mjs`

**Files:**
- Create: `scripts/prerender.mjs`

- [ ] **Step 1: Build the app so `dist/` exists to develop against**

Run: `npm run build`
Expected: succeeds, creates `dist/index.html` and `dist/assets/*`.

- [ ] **Step 2: Write the script**

Create `scripts/prerender.mjs`:

```js
import puppeteer from 'puppeteer'
import { preview } from 'vite'
import { copyFileSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = join(__dirname, '..', 'dist')

// title/description left null for '/' — the built shell's meta tags are
// already accurate for the homepage, so no override is needed there.
const ROUTES = [
  {
    path: '/',
    outFile: join(distDir, 'index.html'),
    title: null,
    description: null,
    ogUrl: null,
  },
  {
    path: '/pricing',
    outFile: join(distDir, 'pricing', 'index.html'),
    title: 'Pricing — FYPro Final Year Project Companion',
    description: 'Simple one-time pricing for Nigerian final year students — free tools, Student Plan ₦2,000, Express Defence ₦2,000, Defense Plan ₦3,500. No subscriptions.',
    ogUrl: 'https://www.fypro.com.ng/pricing',
  },
  {
    path: '/about',
    outFile: join(distDir, 'about', 'index.html'),
    title: 'About FYPro — Built for Nigerian Final Year Students',
    description: 'FYPro was built to give every Nigerian final year student the supervisor guidance many never get — from topic validation to walking into defense ready.',
    ogUrl: 'https://www.fypro.com.ng/about',
  },
  {
    path: '/contact',
    outFile: join(distDir, 'contact', 'index.html'),
    title: 'Contact FYPro — Get Help With Your Final Year Project',
    description: 'Questions about FYPro, your project, or a payment issue? Reach the FYPro team and get a response.',
    ogUrl: 'https://www.fypro.com.ng/contact',
  },
]

async function overrideMeta(page, route) {
  if (!route.title) return
  await page.evaluate((meta) => {
    document.title = meta.title
    const setMeta = (selector, value) => {
      const el = document.querySelector(selector)
      if (el) el.setAttribute('content', value)
    }
    setMeta('meta[name="description"]', meta.description)
    setMeta('meta[property="og:title"]', meta.title)
    setMeta('meta[property="og:description"]', meta.description)
    setMeta('meta[property="og:url"]', meta.ogUrl)
    setMeta('meta[name="twitter:title"]', meta.title)
    setMeta('meta[name="twitter:description"]', meta.description)
  }, { title: route.title, description: route.description, ogUrl: route.ogUrl })
}

async function closeHttpServer(server) {
  await new Promise((resolve, reject) => {
    server.httpServer.close((err) => (err ? reject(err) : resolve()))
  })
}

async function main() {
  // Preserve the original CSR shell — every route this script doesn't
  // prerender (login, dashboard, app/*, express/*, ...) falls back to this
  // file via the vercel.json rewrite.
  copyFileSync(join(distDir, 'index.html'), join(distDir, 'shell.html'))

  const server = await preview({ preview: { port: 4173, strictPort: false } })
  const base = server.resolvedUrls.local[0].replace(/\/$/, '')

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })

  // Capture every route into memory FIRST. Writing dist/index.html mid-loop
  // would corrupt the shell that vite preview is still serving to the
  // remaining routes.
  const captures = []
  for (const route of ROUTES) {
    console.log(`Prerendering ${route.path}...`)
    const page = await browser.newPage()
    await page.goto(`${base}${route.path}`, { waitUntil: 'networkidle0', timeout: 30000 })
    await overrideMeta(page, route)
    const html = await page.content()
    captures.push({ outFile: route.outFile, html })
    await page.close()
  }

  await browser.close()
  await closeHttpServer(server)

  for (const { outFile, html } of captures) {
    mkdirSync(dirname(outFile), { recursive: true })
    writeFileSync(outFile, html)
    console.log(`  → wrote ${outFile}`)
  }

  console.log('Prerendering done.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
```

- [ ] **Step 3: Run the script and verify each output file has real content**

Run: `node scripts/prerender.mjs`
Expected output ends with:
```
  → wrote .../dist/index.html
  → wrote .../dist/pricing/index.html
  → wrote .../dist/about/index.html
  → wrote .../dist/contact/index.html
Prerendering done.
```

Then verify actual page content landed in each file (these are real, distinctive
strings pulled from the current page components — not word-fragmented by any
stagger-animation component):

```bash
grep -c "guides you from a rough topic to a defensible project" dist/index.html
grep -c "One project. One payment. No subscriptions." dist/pricing/index.html
grep -c "born out of frustration" dist/about/index.html
grep -c "We're here to help." dist/contact/index.html
```
Expected: each command prints `1`.

Verify per-page meta landed correctly:

```bash
grep -c "Pricing — FYPro Final Year Project Companion" dist/pricing/index.html
grep -c "Contact FYPro — Get Help With Your Final Year Project" dist/contact/index.html
grep -c "https://www.fypro.com.ng/about" dist/about/index.html
```
Expected: each command prints `1` or more.

Verify `dist/shell.html` still exists and still has NO rendered content (it's
the untouched CSR shell):
```bash
grep -c "id=\"root\"></div>" dist/shell.html
```
Expected: `1` (the shell's root div is still empty — this is intentional, it's
what every non-marketing route falls back to).

- [ ] **Step 4: Commit**

```bash
git add scripts/prerender.mjs
git commit -m "feat: add build-time prerender script for public marketing pages"
```

---

### Task 2: Wire the prerender step into the real Vercel build

**Files:**
- Modify: `package.json:21`

- [ ] **Step 1: Update the `vercel-build` script**

In `package.json`, change:

```json
"vercel-build": "npm run lint:migrations && npm run lint:api && npm run typecheck && npm run test && vite build"
```

to:

```json
"vercel-build": "npm run lint:migrations && npm run lint:api && npm run typecheck && npm run test && vite build && node scripts/prerender.mjs"
```

- [ ] **Step 2: Verify the script line is syntactically valid**

Run: `npm run vercel-build`
Expected: runs the full lint/typecheck/test/build/prerender chain end-to-end
and finishes with the same `Prerendering done.` output from Task 1 Step 3.
This is slower than running the pieces individually (it re-runs the full test
suite and typecheck) — that's expected and fine, this is the exact command
Vercel will run on deploy.

- [ ] **Step 3: Commit**

```bash
git add package.json
git commit -m "build: run marketing-page prerender as part of vercel-build"
```

---

### Task 3: Split the SPA fallback so `/`, `/pricing`, `/about`, `/contact` aren't overridden by the catch-all rewrite

**Files:**
- Modify: `vercel.json`

- [ ] **Step 1: Change the catch-all rewrite destination**

In `vercel.json`, change:

```json
  "rewrites": [
    { "source": "/((?!api/|assets/).*)", "destination": "/index.html" }
  ],
```

to:

```json
  "rewrites": [
    { "source": "/((?!api/|assets/).*)", "destination": "/shell.html" }
  ],
```

- [ ] **Step 2: Add a noindex header for `/shell.html`, matching the existing pattern for other no-content utility routes**

In `vercel.json`, in the `headers` array, add a new entry right after the existing `/payment-success` block (before the catch-all `/(.*)"` security-headers block):

```json
    {
      "source": "/shell.html",
      "headers": [{ "key": "X-Robots-Tag", "value": "noindex, nofollow" }]
    },
```

- [ ] **Step 3: Validate the JSON is well-formed**

Run: `node -e "JSON.parse(require('fs').readFileSync('vercel.json', 'utf8')); console.log('valid')"`
Expected: `valid`

Note: this change can't be fully verified locally — `vite preview` doesn't
apply `vercel.json` rewrites (it uses Vite's own SPA fallback to
`index.html` regardless of this file). Real verification of the
`shell.html` split happens on an actual Vercel deployment in Task 5.

- [ ] **Step 4: Commit**

```bash
git add vercel.json
git commit -m "fix: route non-marketing paths to shell.html so prerendered pages aren't overwritten"
```

---

### Task 4: Local end-to-end verification

**Files:** none (verification only)

- [ ] **Step 1: Run the full build pipeline exactly as Vercel will**

Run: `npm run vercel-build`
Expected: same as Task 2 Step 2 — full chain passes, ends with
`Prerendering done.`

- [ ] **Step 2: Re-run the content/meta checks from Task 1 Step 3 against this fresh build**

```bash
grep -c "guides you from a rough topic to a defensible project" dist/index.html
grep -c "One project. One payment. No subscriptions." dist/pricing/index.html
grep -c "born out of frustration" dist/about/index.html
grep -c "We're here to help." dist/contact/index.html
```
Expected: each prints `1`.

- [ ] **Step 3: Smoke-test with `vite preview` that the client app still boots correctly on top of the prerendered HTML**

Run: `npm run preview` (in one terminal, leave it running)

In a browser, visit the printed local URL and:
- Load `/` — landing page renders, no console errors, no visible flash of
  duplicate/mismatched content.
- Load `/pricing` — pricing cards render and are interactive (e.g. the
  Paystack checkout button responds to a click).
- Click through in-app navigation from `/` to `/pricing` to `/about` to
  `/contact` and back — confirms React Router still owns client-side
  navigation normally (this only proves the client bundle still works;
  it does NOT prove the `vercel.json` shell.html split works, since
  `vite preview` doesn't apply `vercel.json` — that's Task 5).

Stop the preview server (Ctrl+C) when done.

- [ ] **Step 4: No commit needed** — this task is verification only.

---

### Task 5: Deploy to a Vercel preview and verify the parts that only exist in production routing

**Files:** none (verification only)

This task validates the two assumptions flagged as risks in the design spec
that cannot be checked locally: (1) Vercel serves a matching static file
ahead of applying a rewrite, and (2) Puppeteer's bundled Chromium actually
launches inside Vercel's build container.

- [ ] **Step 1: Push the branch and open a PR (or push to trigger a preview
  deploy if already on a PR branch)**

Confirm with the user before pushing, per normal workflow — this makes the
branch and its preview deployment visible on GitHub/Vercel.

- [ ] **Step 2: Once the Vercel preview deployment finishes, get its URL from
  the Vercel dashboard or the GitHub PR check, then verify the prerendered
  pages are served statically**

```bash
curl -s https://<preview-url>/pricing | grep -c "One project. One payment. No subscriptions."
curl -s https://<preview-url>/about | grep -c "born out of frustration"
curl -s https://<preview-url>/contact | grep -c "We're here to help."
curl -s https://<preview-url>/ | grep -c "guides you from a rough topic to a defensible project"
```
Expected: each prints `1`. If any print `0`, the filesystem-vs-rewrite
assumption from the design spec was wrong and needs revisiting — do not
proceed to merge until this passes.

- [ ] **Step 3: Verify non-marketing routes still fall back to the shell correctly**

```bash
curl -s https://<preview-url>/login | grep -c 'id="root"></div>'
curl -s https://<preview-url>/dashboard | grep -c 'id="root"></div>'
```
Expected: each prints `1` (still an empty shell — these routes are
client-rendered as before).

- [ ] **Step 4: Full manual smoke test in a real browser against the preview URL**

- Log in, land on `/dashboard` — loads correctly.
- Open an existing project (or start a new one) and confirm the 6-step
  workflow still loads (`/app` routes still resolve via the shell + client
  router).
- Visit `/express` if you have an express_defense test account — confirms
  the Express shell still resolves too.
- View source (or `curl`) on `/pricing`, `/about`, `/contact` and confirm
  the `<title>` and meta description tags match the values from the
  per-page metadata table.

- [ ] **Step 5: No commit needed** — this task is verification only. Once
  everything above passes, the branch is ready for its normal PR review and
  merge process.
