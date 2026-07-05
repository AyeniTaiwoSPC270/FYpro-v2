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
