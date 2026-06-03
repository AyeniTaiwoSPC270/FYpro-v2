import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import { mkdirSync } from 'fs'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = resolve(__dirname, '../public/fypro-logo.png')
const outDir = resolve(__dirname, '../public/icons')

mkdirSync(outDir, { recursive: true })

// 192×192 — Android home screen icon
await sharp(src)
  .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(resolve(outDir, 'icon-192.png'))

// 512×512 — splash screen icon
await sharp(src)
  .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toFile(resolve(outDir, 'icon-512.png'))

// 512×512 maskable — logo at 80% (410px) on a solid #060E18 background
// The safe zone for maskable icons is the inner 80% of the canvas.
// Anything outside may be cropped by Android's adaptive icon shape.
const logoBuffer = await sharp(src)
  .resize(410, 410, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
  .png()
  .toBuffer()

await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: { r: 6, g: 14, b: 24, alpha: 1 }, // #060E18
  },
})
  .composite([{ input: logoBuffer, gravity: 'center' }])
  .png()
  .toFile(resolve(outDir, 'icon-512-maskable.png'))

console.log('PWA icons written to public/icons/')
