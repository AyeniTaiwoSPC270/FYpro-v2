import puppeteer from 'puppeteer'
import { mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(__dirname, '../public/screenshots')
const BASE_URL = process.env.PREVIEW_URL || 'http://localhost:4173'

mkdirSync(outDir, { recursive: true })

const browser = await puppeteer.launch({ headless: 'new' })

// Wide (desktop) — 1280×800
const wideP = await browser.newPage()
await wideP.setViewport({ width: 1280, height: 800 })
await wideP.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 })
await wideP.screenshot({ path: resolve(outDir, 'screenshot-wide.png') })
console.log('screenshot-wide.png written (1280x800)')

// Narrow (mobile) — 390×844
const narrowP = await browser.newPage()
await narrowP.setViewport({ width: 390, height: 844, isMobile: true, deviceScaleFactor: 2 })
await narrowP.goto(BASE_URL, { waitUntil: 'networkidle2', timeout: 15000 })
await narrowP.screenshot({ path: resolve(outDir, 'screenshot-narrow.png') })
console.log('screenshot-narrow.png written (390x844)')

await browser.close()
console.log('PWA screenshots written to public/screenshots/')
