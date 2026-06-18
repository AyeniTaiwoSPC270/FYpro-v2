// Renders the product-showcase board (scripts/showcase/board.html) to PNG.
//
//   node scripts/screenshot-showcase.mjs           → light variant (default)
//   node scripts/screenshot-showcase.mjs --check   → also render dark to a temp
//                                                     file for diffing vs -v2.png
//
// Outputs public/FYPro-Product-Showcase-light.png. NEVER overwrites
// FYPro-Product-Showcase-v2.png (the dark image stays as-is).
//
// Self-contained: serves public/ over http and special-cases /board.html so the
// board's absolute asset refs (/fypro-logo*.png, /shield-star.svg) resolve.

import puppeteer from 'puppeteer-core';
import sharp from 'sharp';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const publicDir = path.join(root, 'public');
const boardPath = path.join(root, 'scripts/showcase/board.html');

const CHROME = process.env.CHROME_PATH || 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';
const WIDTH = 1600;
const HEIGHT = 900;

const MIME = {
  '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml',
  '.css': 'text/css', '.js': 'text/javascript', '.woff2': 'font/woff2',
  '.json': 'application/json', '.ico': 'image/x-icon',
};

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = decodeURIComponent((req.url || '/').split('?')[0]);
      const resolvedPublicDir = path.resolve(publicDir);
      const file = url === '/board.html'
        ? boardPath
        : path.join(publicDir, url.replace(/^\/+/, ''));
      const resolvedFile = path.resolve(file);
      if (resolvedFile !== path.resolve(boardPath) && !resolvedFile.startsWith(resolvedPublicDir + path.sep)) {
        res.writeHead(403); res.end('forbidden'); return;
      }
      fs.readFile(resolvedFile, (err, buf) => {
        if (err) { res.writeHead(404); res.end('not found'); return; }
        res.writeHead(200, { 'Content-Type': MIME[path.extname(resolvedFile)] || 'application/octet-stream' });
        res.end(buf);
      });
    });
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function render(browser, base, theme, outPath) {
  const page = await browser.newPage();
  await page.setViewport({ width: WIDTH, height: HEIGHT, deviceScaleFactor: 1 });
  await page.goto(`${base}/board.html?theme=${theme}`, { waitUntil: 'networkidle0' });
  // Let embedded fonts paint (matches screenshot-og.mjs timing).
  await new Promise((r) => setTimeout(r, 2500));
  const raw = await page.screenshot({ clip: { x: 0, y: 0, width: WIDTH, height: HEIGHT } });
  await page.close();
  // Compress for web — palette quantization keeps UI/text crisp at a fraction
  // of the raw PNG size (raw ~1.4 MB → ~300 KB).
  await sharp(raw).png({ palette: true, quality: 90, effort: 10, compressionLevel: 9 }).toFile(outPath);
  const kb = (fs.statSync(outPath).size / 1024).toFixed(0);
  console.log('Saved:', path.relative(root, outPath), `(${kb} KB)`);
}

const check = process.argv.includes('--check');

const server = await startServer();
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await puppeteer.launch({
  executablePath: CHROME,
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox'],
});

try {
  await render(browser, base, 'light', path.join(publicDir, 'FYPro-Product-Showcase-light.png'));
  if (check) {
    await render(browser, base, 'dark', path.join(publicDir, '.showcase-dark-check.png'));
  }
} finally {
  await browser.close();
  server.close();
}
