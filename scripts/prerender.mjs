import { preview } from 'vite'
import { copyFileSync, mkdirSync, writeFileSync } from 'fs'
import { dirname, join } from 'path'
import { fileURLToPath } from 'url'

// Vercel's build container is a minimal Linux image that's missing the
// shared libraries (libnspr4, libnss3, ...) regular desktop Chrome needs —
// @sparticuz/chromium ships a Chromium build made for exactly these
// serverless/minimal-Linux environments. Locally (any other OS/environment)
// plain `puppeteer`'s bundled Chrome works fine and is simpler, so only pull
// in the serverless build on Vercel.
async function launchBrowser() {
  if (process.env.VERCEL) {
    const { default: chromium } = await import('@sparticuz/chromium')
    const { default: puppeteerCore } = await import('puppeteer-core')
    return puppeteerCore.launch({
      args: chromium.args,
      executablePath: await chromium.executablePath(),
      headless: true,
    })
  }
  const { default: puppeteer } = await import('puppeteer')
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  })
}

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

  const browser = await launchBrowser()

  // Capture every route into memory FIRST. Writing dist/index.html mid-loop
  // would corrupt the shell that vite preview is still serving to the
  // remaining routes.
  const captures = []
  for (const route of ROUTES) {
    console.log(`Prerendering ${route.path}...`)
    const page = await browser.newPage()

    // Third-party calls (fonts, analytics, Supabase) don't affect the markup
    // we're capturing and make network-idle-based waits flaky/slow — block
    // everything but the app itself.
    await page.setRequestInterception(true)
    page.on('request', (req) => (req.url().startsWith(base) ? req.continue() : req.abort()))

    await page.goto(`${base}${route.path}`, { waitUntil: 'domcontentloaded', timeout: 30000 })
    // Wait for a concrete render signal instead of network idle — every one
    // of these routes has an <h1> as part of its actual rendered content.
    // If this times out, fail loudly (non-zero exit fails the build) rather
    // than silently writing near-empty HTML to dist/.
    await page.waitForSelector('h1', { timeout: 15000 })
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
