import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const LOGO = path.join(ROOT, 'public', 'fypro-logo.png');

async function makeProfilePic(outputPath, size) {
  const logoSize = Math.round(size * 0.7);

  // Step 1: resize logo, keep transparency
  const logoBuffer = await sharp(LOGO)
    .resize(logoSize, logoSize, {
      fit: 'contain',
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .png()
    .toBuffer();

  // Step 2: composite logo onto dark background → flat PNG buffer
  const withBg = await sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: { r: 6, g: 14, b: 24, alpha: 1 }, // #060E18
    },
  })
    .composite([{ input: logoBuffer, gravity: 'center' }])
    .png()
    .toBuffer();

  // Step 3: apply circle mask via dest-in on a fresh sharp instance
  const circleSvg = Buffer.from(
    `<svg width="${size}" height="${size}">
       <circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}" fill="white"/>
     </svg>`
  );

  await sharp(withBg)
    .composite([{ input: circleSvg, blend: 'dest-in' }])
    .png({ compressionLevel: 6 })
    .toFile(outputPath);

  console.log(`✓ ${path.basename(outputPath)} (${size}×${size}px)`);
}

await makeProfilePic(path.join(ROOT, 'public', 'fypro-instagram-profile.png'), 320);
await makeProfilePic(path.join(ROOT, 'public', 'fypro-twitter-profile.png'), 400);

console.log('\nDone. Files saved to public/');
