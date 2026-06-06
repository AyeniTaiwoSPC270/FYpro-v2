/**
 * Creates public/fypro-logo-gold.png by recoloring the actual fypro-logo.png:
 * - Blue pixels → gold
 * - White/near-white background → transparent
 * Run: node scripts/create-gold-logo.mjs
 */
import sharp from 'sharp';
import { fileURLToPath } from 'url';
import path from 'path';
import { dirname } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root      = path.resolve(__dirname, '..');
const inPath    = path.join(root, 'public', 'fypro-logo.png');
const outPath   = path.join(root, 'public', 'fypro-logo-gold.png');

const { data, info } = await sharp(inPath)
  .ensureAlpha()
  .raw()
  .toBuffer({ resolveWithObject: true });

const buf = Buffer.from(data);
const { width, height } = info;

for (let i = 0; i < buf.length; i += 4) {
  const r = buf[i], g = buf[i + 1], b = buf[i + 2], a = buf[i + 3];

  if (a < 20) continue; // already transparent

  // Pure white background (r,g,b all near 255) → transparent
  // Tight threshold so ghost "FY" text (which is slightly off-white/light-grey) survives
  if (r > 250 && g > 250 && b > 250) {
    buf[i + 3] = 0;
    continue;
  }

  // Map every surviving pixel to gold using perceived luminance.
  // This covers: saturated blue (#0066FF), light blue anti-aliasing, AND
  // the near-white "FY" ghost text (which becomes a very pale gold).
  const lum = Math.min(1, (r * 0.2126 + g * 0.7152 + b * 0.0722) / 255);

  // Gold spectrum: #8B6914 (dark/saturated) → #F0E0B0 (pale/ghost)
  buf[i]     = Math.round(139 + (240 - 139) * lum); // R
  buf[i + 1] = Math.round(105 + (224 - 105) * lum); // G
  buf[i + 2] = Math.round( 20 + (176 -  20) * lum); // B
  // keep original alpha for smooth anti-aliasing edges
}

await sharp(buf, { raw: { width, height, channels: 4 } })
  .png({ compressionLevel: 9 })
  .toFile(outPath);

console.log(`Done → ${outPath}  (${width}×${height})`);
