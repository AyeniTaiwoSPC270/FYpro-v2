import puppeteer from 'puppeteer-core';
import { readFileSync, writeFileSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUTPUT = join(ROOT, 'public', 'fypro-twitter-header.png');
const HTML_TMP = join(ROOT, 'public', 'fypro-twitter-header.html');

// Inline the logo so we can use file:// without CORS issues
const logoB64 = readFileSync(join(__dirname, 'logo-b64.txt'), 'utf8').trim();
const logoDataUrl = `data:image/png;base64,${logoB64}`;

const html = /* html */`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=1500" />
  <title>FYPro Twitter Header</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital,wght@0,400;1,400&family=JetBrains+Mono:wght@400;500;700&family=Poppins:wght@400;600&display=swap" rel="stylesheet" />
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    body {
      background: #060E18;
      display: flex;
      align-items: flex-start;
      justify-content: flex-start;
    }

    .canvas {
      width: 1500px;
      height: 500px;
      overflow: hidden;
      position: relative;
      background-color: #0D1B2A;
      background-image:
        radial-gradient(ellipse 80% 80% at center, transparent 30%, rgba(6,14,24,0.55) 100%),
        radial-gradient(ellipse 55% 55% at center, rgba(0,102,255,0.03) 0%, transparent 100%),
        radial-gradient(circle, rgba(0,102,255,0.07) 1px, transparent 1px);
      background-size: 100% 100%, 100% 100%, 30px 30px;
      display: flex;
      align-items: center;
    }

    /* Top blue gradient line */
    .canvas::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 2px;
      background: linear-gradient(90deg, transparent 0%, #0066FF 30%, #3B82F6 60%, transparent 100%);
      z-index: 2;
    }

    /* Atmospheric glow */
    .canvas::after {
      content: '';
      position: absolute;
      top: 0; right: 0;
      width: 100%; height: 100%;
      background:
        radial-gradient(ellipse 45% 65% at 100% 0%, rgba(0,102,255,0.09) 0%, transparent 70%),
        linear-gradient(225deg, rgba(0,102,255,0.04) 0%, transparent 50%);
      pointer-events: none;
      z-index: 0;
    }

    .inner {
      position: relative;
      z-index: 1;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      padding: 0 80px;
      gap: 56px;
    }

    /* ── LEFT ── */
    .left {
      flex: 0 0 auto;
      width: 780px;
      display: flex;
      flex-direction: column;
      align-items: flex-start;
    }

    .logo-wrap {
      position: relative;
      margin-bottom: 20px;
    }
    .logo-glow {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      width: 120px; height: 40px;
      background: radial-gradient(ellipse at center, rgba(0,102,255,0.12) 0%, transparent 70%);
      pointer-events: none;
    }
    .logo {
      height: 38px;
      width: auto;
      mix-blend-mode: screen;
      display: block;
      position: relative;
      z-index: 1;
    }

    .headline {
      font-family: 'DM Serif Display', serif;
      font-size: 56px;
      font-weight: 400;
      color: #FFFFFF;
      line-height: 1.08;
      margin-bottom: 14px;
      letter-spacing: -0.02em;
    }
    .headline .blue {
      color: #0066FF;
      text-shadow: 0 0 60px rgba(0,102,255,0.6);
    }

    .divider {
      width: 48px;
      height: 2px;
      background: linear-gradient(90deg, #0066FF, transparent);
      border-radius: 2px;
      margin-bottom: 14px;
    }

    .tagline {
      font-family: 'Poppins', sans-serif;
      font-size: 17px;
      font-weight: 400;
      color: rgba(255,255,255,0.5);
      line-height: 1.5;
      margin-bottom: 20px;
    }

    .url-badge {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      background: rgba(0,102,255,0.15);
      border: 1px solid rgba(0,102,255,0.5);
      border-radius: 999px;
      padding: 9px 22px;
    }
    .url-dot {
      width: 8px; height: 8px;
      border-radius: 50%;
      background: #0066FF;
      flex-shrink: 0;
      box-shadow: 0 0 0 3px rgba(0,102,255,0.15), 0 0 8px rgba(0,102,255,0.6);
    }
    .url-text {
      font-family: 'JetBrains Mono', monospace;
      font-size: 14px;
      font-weight: 400;
      color: #3B82F6;
      letter-spacing: 0.02em;
    }

    /* ── RIGHT ── */
    .right {
      flex: 1;
      display: flex;
      flex-direction: column;
      justify-content: center;
      gap: 14px;
      align-items: flex-end;
    }

    .card {
      width: 300px;
      border-radius: 12px;
      padding: 18px 22px;
      display: flex;
      flex-direction: column;
      gap: 5px;
      position: relative;
      overflow: hidden;
    }
    .card--default {
      background: rgba(13,27,42,0.90);
      border: 1px solid rgba(255,255,255,0.08);
      box-shadow: inset 0 1px 0 rgba(255,255,255,0.07);
    }
    .card--active {
      background: rgba(0,102,255,0.15);
      border: 1px solid rgba(0,102,255,0.25);
      box-shadow:
        0 8px 32px rgba(0,102,255,0.2),
        0 2px 8px rgba(0,0,0,0.4),
        inset 0 1px 0 rgba(255,255,255,0.1);
    }
    .card-corner-glow {
      position: absolute;
      top: 0; left: 0;
      width: 50px; height: 50px;
      background: radial-gradient(circle at 0% 0%, rgba(0,102,255,0.4), transparent 70%);
    }
    .card-edge {
      position: absolute;
      right: 0; top: 0; bottom: 0;
      width: 3px;
      background: linear-gradient(180deg, transparent, rgba(0,102,255,0.25), transparent);
      border-radius: 0 14px 14px 0;
    }
    .live-badge {
      position: absolute;
      top: 10px; right: 12px;
      background: rgba(22,163,74,0.15);
      border: 1px solid rgba(22,163,74,0.4);
      border-radius: 999px;
      padding: 3px 10px;
      display: flex;
      align-items: center;
      gap: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 9px;
      font-weight: 700;
      letter-spacing: 0.08em;
      color: #16A34A;
    }
    .live-dot {
      width: 5px; height: 5px;
      border-radius: 50%;
      background: #16A34A;
      box-shadow: 0 0 6px rgba(22,163,74,0.8);
      flex-shrink: 0;
    }
    .card-badge {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      font-weight: 500;
      color: rgba(0,102,255,0.8);
      letter-spacing: 0.12em;
      text-transform: uppercase;
      opacity: 0.7;
    }
    .card-title {
      font-family: 'Poppins', sans-serif;
      font-size: 14px;
      font-weight: 600;
      color: #F1F5F9;
    }
    .card-desc {
      font-family: 'Poppins', sans-serif;
      font-size: 12px;
      font-weight: 400;
      color: rgba(255,255,255,0.45);
      line-height: 1.6;
    }
  </style>
</head>
<body>
  <div class="canvas">
    <div class="inner">

      <div class="left">
        <div class="logo-wrap">
          <div class="logo-glow"></div>
          <img class="logo" src="${logoDataUrl}" alt="FYPro" />
        </div>
        <h1 class="headline">
          The Supervisor<br />
          <span class="blue">Most Students</span><br />
          Never Had.
        </h1>
        <div class="divider"></div>
        <p class="tagline">AI-powered final year project companion for Nigerian university students.</p>
        <div class="url-badge">
          <div class="url-dot"></div>
          <span class="url-text">fypro.com.ng</span>
        </div>
      </div>

      <div class="right">
        <div class="card card--default">
          <div class="card-edge"></div>
          <span class="card-badge">STEP 01</span>
          <span class="card-title">Topic Validator</span>
          <span class="card-desc">Validates scope, gaps &amp; feasibility</span>
        </div>

        <div class="card card--active">
          <div class="card-corner-glow"></div>
          <div class="live-badge"><div class="live-dot"></div>LIVE</div>
          <span class="card-badge">STEP 06</span>
          <span class="card-title">Defense Simulator</span>
          <span class="card-desc">3 AI examiners. Real questions.</span>
        </div>

        <div class="card" style="background:rgba(13,27,42,0.90);border:1px solid rgba(245,158,11,0.15);box-shadow:inset 0 1px 0 rgba(255,255,255,0.07);">
          <div style="position:absolute;right:0;top:0;bottom:0;width:3px;background:linear-gradient(180deg,transparent,rgba(245,158,11,0.25),transparent);border-radius:0 14px 14px 0;"></div>
          <span class="card-badge" style="color:rgba(245,158,11,0.8);">DEFENSE SEASON</span>
          <span class="card-title" style="color:#FFFFFF;">Your date is closer</span>
          <span class="card-desc" style="color:rgba(255,255,255,0.4);">Most students start too late.</span>
        </div>
      </div>

    </div>
  </div>
</body>
</html>`;

// Write HTML temporarily so Puppeteer can load it via file://
writeFileSync(HTML_TMP, html, 'utf8');

const browser = await puppeteer.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  headless: 'new',
  args: ['--no-sandbox', '--disable-setuid-sandbox', '--allow-file-access-from-files'],
});

const page = await browser.newPage();
await page.setViewport({ width: 1500, height: 500, deviceScaleFactor: 1 });

const fileUrl = `file:///${HTML_TMP.replace(/\\/g, '/')}`;
await page.goto(fileUrl, { waitUntil: 'networkidle0' });
await new Promise(r => setTimeout(r, 2500)); // wait for Google Fonts

await page.screenshot({
  path: OUTPUT,
  clip: { x: 0, y: 0, width: 1500, height: 500 },
});

await browser.close();

// Clean up temp files
unlinkSync(HTML_TMP);
unlinkSync(join(__dirname, 'logo-b64.txt'));

console.log('✓ fypro-twitter-header.png (1500×500px, 2× retina) → public/');
