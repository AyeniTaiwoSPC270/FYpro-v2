import puppeteer from 'puppeteer';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public', 'flyers');

const flyers = [
  {
    html: path.join(publicDir, 'flyer-instagram.html'),
    png:  path.join(publicDir, 'flyer-instagram.png'),
    width: 1080, height: 1350,
    label: 'flyer-instagram',
  },
  {
    html: path.join(publicDir, 'flyer-instagram-21dev.html'),
    png:  path.join(publicDir, 'flyer-instagram-21dev.png'),
    width: 1080, height: 1350,
    label: 'flyer-instagram-21dev',
  },
  {
    html: path.join(publicDir, 'flyer-twitter.html'),
    png:  path.join(publicDir, 'flyer-twitter.png'),
    width: 1600, height: 900,
    label: 'flyer-twitter',
  },
];

const browser = await puppeteer.launch({
  headless: true,
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

for (const flyer of flyers) {
  console.log(`Rendering ${flyer.label}...`);
  const page = await browser.newPage();

  await page.setViewport({ width: flyer.width, height: flyer.height, deviceScaleFactor: 1 });
  await page.goto(pathToFileURL(flyer.html).href, { waitUntil: 'networkidle0', timeout: 30000 });

  // Extra wait for Google Fonts to render
  await new Promise(r => setTimeout(r, 2000));

  await page.screenshot({
    path: flyer.png,
    clip: { x: 0, y: 0, width: flyer.width, height: flyer.height },
    type: 'png',
  });

  await page.close();
  console.log(`  → saved ${flyer.png}`);
}

await browser.close();
console.log('Done.');
