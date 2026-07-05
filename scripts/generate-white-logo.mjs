import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { copyFileSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src        = resolve(__dirname, '../public/fypro-logo.png')
const publicOut  = resolve(__dirname, '../public/fypro-logo-white.png')
const assetsOut  = resolve(__dirname, '../src/assets/fypro-logo-white.png')

// The Scoreboard share card style fills the background with a solid
// score-tier color (green/amber/red) — the logo's existing blue shield
// and "Pro" text would clash against all three. Force every non-transparent
// pixel to pure white, keeping the source alpha channel intact, so the
// shield/"Pro" render solid white and the already-faint "FY" watermark
// keeps its existing low-opacity look.
const { data, info } = await sharp(src)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true })

for (let i = 0; i < data.length; i += info.channels) {
  data[i]     = 255 // R
  data[i + 1] = 255 // G
  data[i + 2] = 255 // B
  // data[i + 3] (alpha) is left untouched
}

await sharp(data, { raw: info }).png().toFile(publicOut)
copyFileSync(publicOut, assetsOut)

console.log('wrote', publicOut)
console.log('wrote', assetsOut)
