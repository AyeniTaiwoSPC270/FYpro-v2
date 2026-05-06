import puppeteer from 'puppeteer-core';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outputPath = join(__dirname, '../public/fypro-og-image.png');

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1200, height: 630, deviceScaleFactor: 1 });
await page.goto('http://localhost:5173/fypro-og-image.html', { waitUntil: 'networkidle0' });

// Wait for Google Fonts to fully paint
await new Promise(resolve => setTimeout(resolve, 2500));

await page.screenshot({
  path: outputPath,
  clip: { x: 0, y: 0, width: 1200, height: 630 },
});

await browser.close();
console.log('Saved:', outputPath);
