import { chromium } from 'playwright'

const BASE = 'http://localhost:5200'
const errors = []
const screenshots = []

async function run() {
  const browser = await chromium.launch({ headless: true })
  const ctx = await browser.newContext()
  const page = await ctx.newPage()

  page.on('console', msg => {
    if (msg.type() === 'error') errors.push(`[console.error] ${msg.text()}`)
  })
  page.on('pageerror', err => errors.push(`[pageerror] ${err.message}`))

  // ── 1. App loads ────────────────────────────────────────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle' })
  screenshots.push(await page.screenshot({ path: 'scripts/ss-01-landing.png' }))
  console.log('1. Landed on:', page.url())

  // ── 2. Navigate to login ────────────────────────────────────────────────
  await page.goto(`${BASE}/login`, { waitUntil: 'networkidle' })
  screenshots.push(await page.screenshot({ path: 'scripts/ss-02-login.png' }))
  console.log('2. Login page title:', await page.title())

  // Check login form exists
  const emailInput = page.locator('input[type="email"]')
  const passInput  = page.locator('input[type="password"]')
  const hasLogin   = (await emailInput.count()) > 0 && (await passInput.count()) > 0
  console.log('   Login form present:', hasLogin)

  // ── 3. Verify PastSessions component is in the JS bundle ───────────────
  const res = await page.goto(`${BASE}/src/features/defensePrep/PastSessions.jsx`, { waitUntil: 'domcontentloaded' }).catch(() => null)
  console.log('3. PastSessions.jsx request status:', res?.status() ?? 'redirected/transformed by Vite')

  // ── 4. Check dp-tab-bar CSS is in the built styles ─────────────────────
  await page.goto(BASE, { waitUntil: 'networkidle' })
  const hasTabBarCSS = await page.evaluate(() => {
    const sheets = Array.from(document.styleSheets)
    for (const sheet of sheets) {
      try {
        const rules = Array.from(sheet.cssRules || [])
        if (rules.some(r => r.selectorText === '.dp-tab-bar')) return true
      } catch { /* cross-origin */ }
    }
    return false
  })
  console.log('4. .dp-tab-bar CSS loaded in browser:', hasTabBarCSS)

  // ── 5. Check dp-history-item CSS loaded ────────────────────────────────
  const hasHistoryCSS = await page.evaluate(() => {
    const sheets = Array.from(document.styleSheets)
    for (const sheet of sheets) {
      try {
        const rules = Array.from(sheet.cssRules || [])
        if (rules.some(r => r.selectorText === '.dp-history-item')) return true
      } catch { /* cross-origin */ }
    }
    return false
  })
  console.log('5. .dp-history-item CSS loaded in browser:', hasHistoryCSS)

  // ── 6. No JS page errors on landing ─────────────────────────────────────
  console.log('6. JS errors so far:', errors.length === 0 ? 'none' : errors)

  await browser.close()

  console.log('\n── Summary ──')
  console.log('JS errors:', errors.length === 0 ? '✅ none' : `❌ ${errors.length}`)
  console.log('.dp-tab-bar CSS in browser:', hasTabBarCSS ? '✅' : '❌')
  console.log('.dp-history-item CSS in browser:', hasHistoryCSS ? '✅' : '❌')
  console.log('Login form present:', hasLogin ? '✅' : '❌')
  console.log('\nScreenshots: scripts/ss-01-landing.png, scripts/ss-02-login.png')
}

run().catch(err => { console.error('VERIFY FAILED:', err.message); process.exit(1) })
