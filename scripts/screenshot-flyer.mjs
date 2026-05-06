import puppeteer from 'puppeteer';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = join(__dirname, '..', 'public', 'flyer-whatsapp.png');

const browser = await puppeteer.launch({ headless: 'new' });
const page = await browser.newPage();

await page.setViewport({ width: 800, height: 800, deviceScaleFactor: 2 });
await page.goto('http://localhost:5175/flyer-whatsapp.html', { waitUntil: 'networkidle0' });

// Wait for Google Fonts to finish rendering
await new Promise(r => setTimeout(r, 2000));

await page.screenshot({
  path: outPath,
  clip: { x: 0, y: 0, width: 800, height: 800 },
});

await browser.close();
console.log('Screenshot saved to:', outPath);
