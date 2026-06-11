import puppeteer from 'puppeteer';
import { pathToFileURL, fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const flyersDir = path.resolve(__dirname, 'flyers');
const outputDir = path.resolve(__dirname, '..', 'public', 'flyers');

const flyers = [
  {
    html: path.join(flyersDir, 'flyer-whatsapp.html'),
    png:  path.join(outputDir, 'flyer-whatsapp.png'),
    width: 800, height: 800,
    deviceScaleFactor: 2,
    label: 'flyer-whatsapp',
  },
  {
    html: path.join(flyersDir, 'flyer-instagram.html'),
    png:  path.join(outputDir, 'flyer-instagram.png'),
    width: 1080, height: 1350,
    deviceScaleFactor: 1,
    label: 'flyer-instagram',
  },
  {
    html: path.join(flyersDir, 'flyer-instagram-21dev.html'),
    png:  path.join(outputDir, 'flyer-instagram-21dev.png'),
    width: 1080, height: 1350,
    deviceScaleFactor: 1,
    label: 'flyer-instagram-21dev',
  },
  {
    html: path.join(flyersDir, 'flyer-twitter.html'),
    png:  path.join(outputDir, 'flyer-twitter.png'),
    width: 1600, height: 900,
    deviceScaleFactor: 1,
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

  await page.setViewport({ width: flyer.width, height: flyer.height, deviceScaleFactor: flyer.deviceScaleFactor });
  await page.goto(pathToFileURL(flyer.html).href, { waitUntil: 'networkidle0', timeout: 30000 });

  // Wait for Google Fonts to finish rendering
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
