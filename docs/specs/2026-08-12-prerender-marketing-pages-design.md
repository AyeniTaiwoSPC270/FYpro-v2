# Prerender public marketing pages — design

**Date:** 2026-08-12
**Status:** approved, ready for implementation plan

## Problem

FYPro's public marketing pages (`/`, `/pricing`, `/about`, `/contact`) are pure
client-side-rendered React. A third-party SEO scan against `fypro.com.ng`
confirmed the initial HTML response is an essentially empty `<div id="root">`
shell — 0 headings, 0 images, 0 links, 61 bytes of readable text. Googlebot
renders JS and likely indexes the site fine, but every other consumer of the
raw HTML (Bing, link-unfurl bots on WhatsApp/LinkedIn/X beyond the static
`og:image`, AI-answer crawlers, other SEO tools) sees nothing. These four
routes are the ones that actually receive organic/ad/social traffic, so the
gap is worth closing.

Confirmed via `vite.config.js` / `package.json`: there is no SSG/SSR/
prerendering of any kind today — only `vite-plugin-pwa` for the service
worker.

## Goal

Ship real static HTML (headings, copy, links, per-page meta tags) for `/`,
`/pricing`, `/about`, `/contact` at build time, while every other route
(`/login`, `/dashboard`, `/app/*`, `/express/*`, etc.) keeps working exactly
as it does today — pure CSR against an empty shell, no SEO value, no change
needed.

## Non-goals

- No SSR/hydration for the authenticated app.
- No per-page JSON-LD/schema markup beyond the existing site-wide
  Organization/SoftwareApplication/WebSite block in `index.html` — that stays
  as-is and is inherited by all four prerendered pages unchanged.
- No changes to `/changelog`, `/roadmap`, or any other route.
- The `www` vs apex duplicate-content warning from the same scan is a
  **separate, already-diagnosed issue**: the redirect chain works
  (`http://fypro.com.ng` → 308 → `https://fypro.com.ng` → 307 →
  `https://www.fypro.com.ng` → 200) but the final hop is a 307 (temporary)
  instead of a 301/308 (permanent). Fix is a checkbox in Vercel → Project →
  Settings → Domains ("Permanent Redirect" on the domain-to-domain rule).
  Not part of this spec — no code involved.

## Architecture

```
vite build
  → dist/index.html (empty CSR shell) + all hashed assets

copy dist/index.html → dist/shell.html
  (preserves the original shell — theme anti-flicker script, font preconnects,
   manifest link, site-wide JSON-LD — for use as the fallback for every
   OTHER route)

start `vite preview` against dist/
  (default appType: 'spa' already serves index.html for any unmatched path,
   same mechanism that makes React Router work in local dev — no extra
   server config needed)

Puppeteer (headless Chrome) visits, in order:
  http://localhost:<port>/
  http://localhost:<port>/pricing
  http://localhost:<port>/about
  http://localhost:<port>/contact

For each route:
  - wait for networkidle0 (matches the pattern already used in
    scripts/screenshot-flyers.mjs)
  - page.evaluate() to override <title>, meta[name=description],
    meta[property=og:title], meta[property=og:description],
    meta[property=og:url], meta[name=twitter:title],
    meta[name=twitter:description] per the metadata table below
  - capture document.documentElement.outerHTML
  - HOLD IN MEMORY — do not write yet

Only after all four captures succeed:
  stop the preview server
  write dist/index.html          ← captured '/'        (overwrites the shell)
  write dist/pricing/index.html  ← captured '/pricing'
  write dist/about/index.html    ← captured '/about'
  write dist/contact/index.html  ← captured '/contact'
  close the Puppeteer browser
```

Capturing all four into memory before writing any output file is required:
overwriting `dist/index.html` mid-run would corrupt the shell that
`vite preview` is still serving to the remaining Puppeteer navigations for
`/pricing`, `/about`, `/contact`.

Because the client bundle's `<script type="module" src="/assets/...">` tag
remains in the captured DOM (script tags aren't removed after execution),
each prerendered page still boots the full React app on load exactly as
before — `main.jsx` uses `createRoot(...).render()`, not `hydrateRoot()`, so
there is no hydration-mismatch risk from serving pre-rendered markup; React
simply replaces `#root`'s contents on mount, same as it does today.

## New file: `scripts/prerender.mjs`

Follows the existing pattern in `scripts/screenshot-flyers.mjs` (plain
`puppeteer` — already a devDependency — `headless: true`,
`args: ['--no-sandbox', '--disable-setuid-sandbox']`). Contains:

- A `ROUTES` config array: `{ path, title, description, ogTitle,
  ogDescription, ogUrl, twitterTitle, twitterDescription }` for each of the
  four routes (metadata table below).
- Preview-server startup/shutdown (Vite's `preview()` API).
- The capture loop described above.
- File writes, creating `dist/pricing/`, `dist/about/`, `dist/contact/` as
  needed.

## `vercel.json` changes

1. Rewrite destination changes from `/index.html` to `/shell.html`:
   ```json
   { "source": "/((?!api/|assets/).*)", "destination": "/shell.html" }
   ```
   This is the only routing change. `/`, `/pricing`, `/about`, `/contact`
   are served directly from their own static files because Vercel checks
   the filesystem before applying rewrites — **this is the top risk to
   verify on the first preview deploy**, not something to assume blindly.

2. Add the same `X-Robots-Tag: noindex, nofollow` header block already used
   for `/login`, `/signup`, etc. to `/shell.html` — it's a bare utility page
   with no content and shouldn't be indexed directly.

## `package.json` changes

The real Vercel build entrypoint is the `vercel-build` script, not `build`:

```
"vercel-build": "npm run lint:migrations && npm run lint:api && npm run typecheck && npm run test && vite build && node scripts/prerender.mjs"
```

`node scripts/prerender.mjs` runs last, after `vite build` has produced
`dist/`.

## Per-page metadata

| Route | Title | Meta description |
|---|---|---|
| `/` | *(unchanged — already accurate)* | *(unchanged)* |
| `/pricing` | Pricing — FYPro Final Year Project Companion | Simple one-time pricing for Nigerian final year students — free tools, Student Plan ₦2,000, Express Defence ₦2,000, Defense Plan ₦3,500. No subscriptions. |
| `/about` | About FYPro — Built for Nigerian Final Year Students | FYPro was built to give every Nigerian final year student the supervisor guidance many never get — from topic validation to walking into defense ready. |
| `/contact` | Contact FYPro — Get Help With Your Final Year Project | Questions about FYPro, your project, or a payment issue? Reach the FYPro team and get a response. |

Each page also gets its own `og:url`/`twitter` fields pointing at its own
path instead of all four hardcoding the homepage URL, and title/description
in the OG/Twitter tags mirror the primary title/description above unless a
shorter variant reads better in a link preview.

Exact copy is adjustable during implementation — this table is a draft, not
final.

## Service worker impact

Checked `src/sw.js`: its `NavigationRoute(new NetworkFirst())` caches
whatever HTML the network actually returns, keyed per request URL, with no
hardcoded reference to a single shared shell document. **No changes needed.**
Offline behavior for the four marketing pages improves slightly — real
content gets cached instead of an empty shell. `vite-plugin-pwa`'s
`injectManifest.globPatterns` (`**/*.html`) will pick up `shell.html`,
`index.html`, `pricing/index.html`, `about/index.html`, `contact/index.html`
into the precache; each is a small text file, no meaningful bloat.

## Testing / verification plan

1. Local: `npm run build` (or the equivalent `vercel-build` steps), then
   inspect `dist/index.html`, `dist/pricing/index.html`,
   `dist/about/index.html`, `dist/contact/index.html` — confirm real
   heading/copy text is present (not just the shell), and each has its own
   `<title>`/meta description/`og:url`.
2. Local: `vite preview` against the built `dist/`, curl each of the four
   routes plus a non-marketing route (e.g. `/login`) — confirm the
   marketing routes return full content and `/login` still returns the
   shell.
3. Push to a branch, let Vercel build a preview deployment, and verify on
   the **actual Vercel platform** (not just local `vite preview`):
   - `curl -s <preview-url>/pricing` returns the prerendered HTML, not the
     shell (validates the filesystem-before-rewrite assumption).
   - The Puppeteer/Chromium step actually succeeds in Vercel's build
     container (validates the build-environment assumption).
   - Full smoke test: `/login`, `/dashboard`, `/app/*`, `/express/*` still
     load and route correctly client-side (validates the shell-split rewrite
     change didn't break the rest of the app).
4. Re-run (or manually replicate) the original SEO scan against the preview
   URL to confirm headings/text/links are now detected.

## Risks

- **Vercel static-file-vs-rewrite precedence** — assumed based on standard
  Vercel behavior, not yet verified against this project's actual
  deployment. Must confirm on first preview deploy (test plan step 3).
- **Puppeteer/Chromium inside Vercel's build container** — the existing
  `scripts/screenshot-*.mjs` scripts run locally, not as part of the Vercel
  build. This is a common, generally-working pattern (Vercel's build
  machine is a full Linux image, unlike the constrained serverless function
  runtime), but untested in this repo. If it fails, fallback is pinning a
  known-working `puppeteer` version or switching to
  `@sparticuz/chromium-min`.
- **Build time increase** — roughly 5-15s added to `vercel-build` for
  spinning up Chromium and rendering four pages. Not expected to be an
  issue, no documented build-time cap in CLAUDE.md, but worth watching on
  the first few deploys.
