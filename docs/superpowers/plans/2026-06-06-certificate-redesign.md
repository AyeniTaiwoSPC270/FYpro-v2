# Certificate Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the single-style PDF certificate with three selectable designs (Academic Prestige, Modern Bold, Dark Premium) × two orientations (portrait/landscape), a QR verification code on every certificate, and a style/orientation picker modal that opens when the student clicks Download.

**Architecture:** `buildCertificatePDF` is refactored to accept `style` and `orientation` params and branch into three draw functions (`drawModern`, `drawPrestige`, `drawDark`). A shared `generateQR` utility produces a base64 PNG embedded in all designs. A new `CertificateDownloadModal` component owns the picker UI and is used by both `CertificateUnlock` and `MyCertificates`.

**Tech Stack:** jsPDF v4 (existing), `qrcode` npm package (new), React + hooks (existing), localStorage for preference persistence.

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `package.json` | Modify | Add `qrcode` dependency |
| `api/certificate.js` | Modify | Refactor PDF builder — style branching, QR, landscape layout |
| `src/lib/certificate.ts` | Modify | Add `style` + `orientation` params to `downloadCertificate` |
| `src/components/defense/CertificateDownloadModal.jsx` | **Create** | Style + orientation picker modal |
| `src/components/defense/CertificateUnlock.jsx` | Modify | Replace download button with modal trigger |
| `src/pages/account/MyCertificates.jsx` | Modify | Replace per-row download button with modal trigger |

---

## Task 1: Install `qrcode` dependency

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the package**

```bash
npm install qrcode
```

Expected output: `added 1 package` (or similar — `qrcode` has no sub-dependencies).

- [ ] **Step 2: Verify it resolves**

```bash
node -e "const QRCode = require('qrcode'); QRCode.toDataURL('https://fypro.com.ng/verify/FYP-2026-000001', {width:80,margin:1}).then(d => console.log('OK', d.slice(0,30)))"
```

Expected: `OK data:image/png;base64,iVBOR`

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add qrcode dependency for certificate QR generation"
```

---

## Task 2: Add `generateQR` utility + refactor `buildCertificatePDF` signature

This task restructures `api/certificate.js` — it creates the new scaffold (shared utils, empty draw stubs, updated `buildCertificatePDF` orchestrator, updated handler body) without yet implementing the three draw functions. The certificate endpoint still works after this task using `drawModern` as a stub that falls back to the old layout.

**Files:**
- Modify: `api/certificate.js`

- [ ] **Step 1: Add the `qrcode` static import and `generateQR` utility**

At the top of `api/certificate.js`, add `qrcode` to the existing imports (after the `Buffer` import):

```js
import QRCode from 'qrcode';
```

Then add the `generateQR` utility immediately after the closing brace of `ensureFonts()` (around line 49):

```js
// ── QR code ──────────────────────────────────────────────────────────────────

async function generateQR(url, darkColor = '#0D1B2A') {
  return QRCode.toDataURL(url, {
    width:  80,
    margin: 1,
    color:  { dark: darkColor, light: '#FFFFFF00' },
  });
}
```

Note: `light: '#FFFFFF00'` makes the QR background transparent so it inherits the certificate background on all styles. For prestige (ivory bg) and dark (navy bg), transparency lets the background show through correctly.

- [ ] **Step 2: Replace `buildCertificatePDF` with an async orchestrator**

Replace the entire `function buildCertificatePDF(...)` block (lines 64–210 in the original) with:

```js
// ── PDF builder ───────────────────────────────────────────────────────────────

async function buildCertificatePDF({
  recipientName,
  faculty,
  department,
  topicTitle,
  score,
  certNumber,
  issuedAt,
  style       = 'modern',
  orientation = 'portrait',
}) {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const W   = orientation === 'landscape' ? 297 : 210;
  const H   = orientation === 'landscape' ? 210 : 297;

  registerFonts(doc);

  const headingFont = dmSerifBase64  ? 'DMSerifDisplay' : 'times';
  const bodyFont    = poppinsBase64  ? 'Poppins'        : 'helvetica';

  const scoreNum    = Number(score);
  const scoreLabel  = `${Number.isInteger(scoreNum) ? scoreNum : scoreNum.toFixed(1)}/10`;
  const dateStr     = new Date(issuedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });

  const qrDarkColors = { prestige: '#2C1810', modern: '#0D1B2A', dark: '#93C5FD' };
  const qrBase64 = await generateQR(
    `https://fypro.com.ng/verify/${certNumber}`,
    qrDarkColors[style] ?? '#0D1B2A',
  );

  const data = {
    recipientName, faculty, department, topicTitle,
    scoreLabel, dateStr, certNumber, qrBase64,
    headingFont, bodyFont,
    logoBase64,
  };

  if      (style === 'prestige') drawPrestige(doc, W, H, data);
  else if (style === 'dark')     drawDark(doc, W, H, data);
  else                           drawModern(doc, W, H, data);

  return Buffer.from(doc.output('arraybuffer'));
}
```

- [ ] **Step 3: Add empty draw-function stubs after `buildCertificatePDF` and before `drawWordmark`**

```js
function drawModern(doc, W, H, data)   { /* implemented in next task */ }
function drawPrestige(doc, W, H, data) { /* implemented in Task 4 */ }
function drawDark(doc, W, H, data)     { /* implemented in Task 5 */ }
```

- [ ] **Step 4: Update the handler to parse `style` and `orientation` from the request body**

In the `handler` function, find the line:

```js
const { defense_session_id } = req.body || {};
```

Replace it with:

```js
const {
  defense_session_id,
  style       = 'modern',
  orientation = 'portrait',
} = req.body || {};

const validStyles       = ['modern', 'prestige', 'dark'];
const validOrientations = ['portrait', 'landscape'];
const safeStyle       = validStyles.includes(style)       ? style       : 'modern';
const safeOrientation = validOrientations.includes(orientation) ? orientation : 'portrait';
```

- [ ] **Step 5: Pass `style` and `orientation` to `buildCertificatePDF`**

Find the `buildCertificatePDF({...})` call near the bottom of the handler and add the two new params:

```js
const pdfBuffer = await buildCertificatePDF({
  recipientName: currentName,
  faculty:       cert.faculty       || userProfile?.faculty    || '',
  department:    cert.department    || userProfile?.department || '',
  topicTitle:    cert.topic_title,
  score:         cert.score,
  certNumber:    cert.certificate_number,
  issuedAt:      cert.issued_at,
  style:         safeStyle,
  orientation:   safeOrientation,
});
```

`ensureFonts()` is still called in the handler just before `buildCertificatePDF` — leave it there. Just add the two new params to the `buildCertificatePDF` call.

- [ ] **Step 6: Commit the scaffold**

```bash
git add api/certificate.js
git commit -m "refactor: scaffold certificate PDF for multi-style support"
```

---

## Task 3: Implement `drawModern` (Modern Bold style)

The Modern Bold design is the evolution of the existing certificate layout. It keeps the basic structure but upgrades the top/bottom bars to 10mm, adds a green achievement band, and improves typography.

**Files:**
- Modify: `api/certificate.js` — replace the `drawModern` stub

- [ ] **Step 1: Replace the `drawModern` stub with the full implementation**

```js
function drawModern(doc, W, H, data) {
  const { recipientName, faculty, department, topicTitle,
          scoreLabel, dateStr, certNumber, qrBase64,
          headingFont, bodyFont, logoBase64 } = data;
  const isLandscape = W > H;

  if (isLandscape) {
    drawModernLandscape(doc, W, H, data);
    return;
  }

  const cx = W / 2;

  // Blue top bar (10mm)
  doc.setFillColor(0, 102, 255);
  doc.rect(0, 0, W, 10, 'F');

  // Logo / wordmark
  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', cx - 20, 15, 40, 14); }
    catch { drawWordmark(doc, cx, headingFont, 26); }
  } else {
    drawWordmark(doc, cx, headingFont, 26);
  }

  // Green achievement band
  doc.setFillColor(240, 255, 244);
  doc.rect(20, 36, W - 40, 16, 'F');
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(1.5);
  doc.line(20, 36, 20, 52);
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(7);
  doc.setTextColor(22, 163, 74);
  doc.text('DEFENSE READINESS CERTIFIED', 25, 42);
  doc.setFontSize(6.5);
  doc.setTextColor(107, 114, 128);
  doc.text('AI-proctored · Verified score · Cannot be self-reported', 25, 49);

  // "This certifies that"
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text('This certifies that', cx, 64, { align: 'center' });

  // Recipient name
  doc.setFont(headingFont, 'normal');
  doc.setFontSize(22);
  doc.setTextColor(13, 27, 42);
  const displayName = recipientName.length > 48 ? recipientName.slice(0, 47) + '…' : recipientName;
  doc.text(displayName, cx, 77, { align: 'center' });

  // Faculty & department
  if (faculty || department) {
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(107, 114, 128);
    doc.text([faculty, department].filter(Boolean).join(' · '), cx, 86, { align: 'center' });
  }

  // Divider
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(40, 92, W - 40, 92);

  // "has demonstrated..."
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text('has demonstrated defence readiness for', cx, 104, { align: 'center' });

  // Topic title
  doc.setFont(headingFont, 'normal');
  doc.setFontSize(14);
  doc.setTextColor(13, 27, 42);
  const topicLines = doc.splitTextToSize(topicTitle, 150);
  const topicY = 117;
  doc.text(topicLines, cx, topicY, { align: 'center' });
  const topicEndY = topicY + (topicLines.length - 1) * 7;

  // Horizontal divider
  const ruleY = topicEndY + 14;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(40, ruleY, W - 40, ruleY);

  // Score pill (blue solid)
  const scoreY = ruleY + 16;
  const pillW  = 90;
  const pillH  = 10;
  doc.setFillColor(0, 102, 255);
  doc.roundedRect(cx - pillW / 2, scoreY - 7.5, pillW, pillH, 5, 5, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`FYPro Score: ${scoreLabel}`, cx, scoreY, { align: 'center' });

  // Issue date
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`Issued on ${dateStr}`, cx, scoreY + 14, { align: 'center' });

  // Tagline
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text('"The supervisor you never had."', cx, scoreY + 24, { align: 'center' });

  // Footer rule
  const footerRuleY = H - 28;
  doc.setDrawColor(0, 102, 255);
  doc.setLineWidth(0.4);
  doc.line(25, footerRuleY, W - 25, footerRuleY);

  // QR code (bottom-left)
  const qrSize = 20;
  const qrX    = 20;
  const qrY    = H - 26;
  try { doc.addImage(qrBase64, 'PNG', qrX, qrY, qrSize, qrSize); } catch { /* skip if QR failed */ }

  // Cert number (bottom-right)
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(107, 114, 128);
  doc.text(certNumber, W - 20, H - 16, { align: 'right' });

  // Verify URL (below cert number)
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(0, 102, 255);
  doc.text(`fypro.com.ng/verify/${certNumber}`, W - 20, H - 10, { align: 'right' });

  // Blue bottom bar (10mm)
  doc.setFillColor(0, 102, 255);
  doc.rect(0, H - 10, W, 10, 'F');
}

function drawModernLandscape(doc, W, H, data) {
  const { recipientName, faculty, department, topicTitle,
          scoreLabel, dateStr, certNumber, qrBase64,
          headingFont, bodyFont, logoBase64 } = data;

  // Blue top bar
  doc.setFillColor(0, 102, 255);
  doc.rect(0, 0, W, 10, 'F');

  // Vertical separator
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(182, 15, 182, H - 15);

  // ── LEFT COLUMN (x: 15–177, cx: 96) ─────────────────────────────────────
  const lcx = 96;

  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', lcx - 18, 14, 36, 12); }
    catch { drawWordmark(doc, lcx, headingFont, 23); }
  } else {
    drawWordmark(doc, lcx, headingFont, 23);
  }

  // Green band
  doc.setFillColor(240, 255, 244);
  doc.rect(15, 32, 162, 14, 'F');
  doc.setDrawColor(22, 163, 74);
  doc.setLineWidth(1.5);
  doc.line(15, 32, 15, 46);
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(22, 163, 74);
  doc.text('DEFENSE READINESS CERTIFIED', 20, 38);
  doc.setFontSize(6);
  doc.setTextColor(107, 114, 128);
  doc.text('AI-proctored · Verified score · Cannot be self-reported', 20, 44);

  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text('This certifies that', lcx, 56, { align: 'center' });

  doc.setFont(headingFont, 'normal');
  doc.setFontSize(18);
  doc.setTextColor(13, 27, 42);
  const displayName = recipientName.length > 40 ? recipientName.slice(0, 39) + '…' : recipientName;
  doc.text(displayName, lcx, 67, { align: 'center' });

  if (faculty || department) {
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(107, 114, 128);
    doc.text([faculty, department].filter(Boolean).join(' · '), lcx, 75, { align: 'center' });
  }

  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(30, 80, 162, 80);

  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text('has demonstrated defence readiness for', lcx, 90, { align: 'center' });

  doc.setFont(headingFont, 'normal');
  doc.setFontSize(12);
  doc.setTextColor(13, 27, 42);
  const topicLines = doc.splitTextToSize(topicTitle, 140);
  doc.text(topicLines, lcx, 100, { align: 'center' });

  // ── RIGHT COLUMN (x: 187–282, cx: 234) ───────────────────────────────────
  const rcx = 234;

  // Score pill
  const pillW = 80;
  const pillH = 11;
  doc.setFillColor(0, 102, 255);
  doc.roundedRect(rcx - pillW / 2, 58, pillW, pillH, 5, 5, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`FYPro Score: ${scoreLabel}`, rcx, 65, { align: 'center' });

  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(107, 114, 128);
  doc.text(`Issued on ${dateStr}`, rcx, 82, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(156, 163, 175);
  doc.text('"The supervisor you never had."', rcx, 92, { align: 'center' });

  // QR code
  const qrX = rcx - 10;
  const qrY = H - 42;
  try { doc.addImage(qrBase64, 'PNG', qrX, qrY, 20, 20); } catch { /* skip */ }

  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.setTextColor(107, 114, 128);
  doc.text(certNumber, rcx, H - 16, { align: 'center' });

  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(0, 102, 255);
  doc.text(`fypro.com.ng/verify`, rcx, H - 10, { align: 'center' });

  // Blue bottom bar
  doc.setFillColor(0, 102, 255);
  doc.rect(0, H - 10, W, 10, 'F');
}
```

- [ ] **Step 2: Manually test Modern Bold portrait**

Deploy locally (`npm run dev` — frontend only; for the API, use `vercel dev` if available, or test via the live staging URL). Trigger a certificate download from a completed defense session, select Modern Bold + Portrait. Verify:
- Blue bars at top and bottom
- Green achievement band visible
- Name, topic, score pill all present
- QR code appears bottom-left
- Cert number appears bottom-right

- [ ] **Step 3: Commit**

```bash
git add api/certificate.js
git commit -m "feat: implement Modern Bold PDF style (portrait + landscape)"
```

---

## Task 4: Implement `drawPrestige` (Academic Prestige style)

**Files:**
- Modify: `api/certificate.js` — replace the `drawPrestige` stub

- [ ] **Step 1: Replace the `drawPrestige` stub with the full implementation**

```js
function drawPrestige(doc, W, H, data) {
  const { recipientName, faculty, department, topicTitle,
          scoreLabel, dateStr, certNumber, qrBase64,
          headingFont, bodyFont } = data;
  const isLandscape = W > H;

  if (isLandscape) {
    drawPrestigeLandscape(doc, W, H, data);
    return;
  }

  const cx = W / 2;

  // Ivory background
  doc.setFillColor(255, 253, 245);
  doc.rect(0, 0, W, H, 'F');

  // Outer gold border
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(1.5);
  doc.rect(4, 4, W - 8, H - 8);

  // Inner gold border (hairline)
  doc.setLineWidth(0.4);
  doc.rect(9, 9, W - 18, H - 18);

  // Corner ornaments (L-shapes, 18×18mm, inset 4mm)
  const co = 4;   // corner inset from page edge
  const cs = 18;  // corner size
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(1.2);
  // Top-left
  doc.line(co + cs, co + 2, co + 2, co + 2); doc.line(co + 2, co + 2, co + 2, co + cs);
  // Top-right
  doc.line(W - co - cs, co + 2, W - co - 2, co + 2); doc.line(W - co - 2, co + 2, W - co - 2, co + cs);
  // Bottom-left
  doc.line(co + 2, H - co - cs, co + 2, H - co - 2); doc.line(co + 2, H - co - 2, co + cs, H - co - 2);
  // Bottom-right
  doc.line(W - co - 2, H - co - cs, W - co - 2, H - co - 2); doc.line(W - co - 2, H - co - 2, W - co - cs, H - co - 2);

  // Seal (gold circle with "FY")
  doc.setFillColor(201, 168, 76);
  doc.circle(cx, 33, 13, 'F');
  doc.setFillColor(230, 200, 106);
  doc.circle(cx, 33, 9, 'F');
  doc.setFont(headingFont, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text('FY', cx, 36, { align: 'center' });

  // Title band
  doc.setFillColor(253, 248, 232);
  doc.rect(15, 52, W - 30, 16, 'F');
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.5);
  doc.line(15, 52, W - 15, 52);
  doc.line(15, 68, W - 15, 68);
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(139, 105, 20);
  doc.text('CERTIFICATE OF DEFENSE READINESS', cx, 62, { align: 'center', charSpace: 2 });

  // "This certifies that"
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(160, 120, 64);
  doc.text('This certifies that', cx, 80, { align: 'center' });

  // Recipient name
  doc.setFont(headingFont, 'normal');
  doc.setFontSize(22);
  doc.setTextColor(44, 24, 16);
  const displayName = recipientName.length > 48 ? recipientName.slice(0, 47) + '…' : recipientName;
  doc.text(displayName, cx, 93, { align: 'center' });

  // Faculty & department
  if (faculty || department) {
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(9);
    doc.setTextColor(160, 120, 64);
    doc.text([faculty, department].filter(Boolean).join(' · '), cx, 101, { align: 'center' });
  }

  // Fleuron divider
  const divY = 109;
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.4);
  doc.line(cx - 40, divY, cx - 6, divY);
  doc.line(cx + 6,  divY, cx + 40, divY);
  doc.setFont('courier', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(201, 168, 76);
  doc.text('*', cx, divY + 1.5, { align: 'center' });

  // "has demonstrated..."
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(160, 120, 64);
  doc.text('has demonstrated defence readiness for', cx, 120, { align: 'center' });

  // Topic (italic, quoted)
  doc.setFont(headingFont, 'normal');
  doc.setFontSize(13);
  doc.setTextColor(44, 24, 16);
  const raw        = topicTitle.length > 120 ? topicTitle.slice(0, 119) + '…' : topicTitle;
  const topicLines = doc.splitTextToSize(`"${raw}"`, 148);
  const topicY     = 132;
  doc.text(topicLines, cx, topicY, { align: 'center' });
  const topicEndY  = topicY + (topicLines.length - 1) * 7;

  // Score pill (gold)
  const scoreY  = topicEndY + 18;
  const pillW   = 80;
  const pillH   = 11;
  doc.setFillColor(201, 168, 76);
  doc.roundedRect(cx - pillW / 2, scoreY - 8, pillW, pillH, 5, 5, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(255, 255, 255);
  doc.text(`Score: ${scoreLabel}`, cx, scoreY, { align: 'center' });

  // Issue date
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(160, 120, 64);
  doc.text(`Issued on ${dateStr}`, cx, scoreY + 13, { align: 'center' });

  // Footer
  const footerRuleY = H - 30;
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.5);
  doc.line(25, footerRuleY, W - 25, footerRuleY);

  // QR code (bottom-left, ivory bg so transparent QR works fine)
  const qrSize = 20;
  const qrX    = 20;
  const qrY    = H - 28;
  try { doc.addImage(qrBase64, 'PNG', qrX, qrY, qrSize, qrSize); } catch { /* skip */ }

  // Cert number (bottom-right)
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(160, 120, 64);
  doc.text(certNumber, W - 18, H - 18, { align: 'right' });
  doc.setFontSize(6.5);
  doc.setTextColor(201, 168, 76);
  doc.text(`fypro.com.ng/verify/${certNumber}`, W - 18, H - 12, { align: 'right' });
}

function drawPrestigeLandscape(doc, W, H, data) {
  const { recipientName, faculty, department, topicTitle,
          scoreLabel, dateStr, certNumber, qrBase64,
          headingFont, bodyFont } = data;

  // Ivory background
  doc.setFillColor(255, 253, 245);
  doc.rect(0, 0, W, H, 'F');

  // Outer gold border
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(1.5);
  doc.rect(4, 4, W - 8, H - 8);
  doc.setLineWidth(0.4);
  doc.rect(9, 9, W - 18, H - 18);

  // Corner ornaments
  const co = 4; const cs = 18;
  doc.setLineWidth(1.2);
  doc.line(co + cs, co + 2, co + 2, co + 2); doc.line(co + 2, co + 2, co + 2, co + cs);
  doc.line(W - co - cs, co + 2, W - co - 2, co + 2); doc.line(W - co - 2, co + 2, W - co - 2, co + cs);
  doc.line(co + 2, H - co - cs, co + 2, H - co - 2); doc.line(co + 2, H - co - 2, co + cs, H - co - 2);
  doc.line(W - co - 2, H - co - cs, W - co - 2, H - co - 2); doc.line(W - co - 2, H - co - 2, W - co - cs, H - co - 2);

  // Vertical separator
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.4);
  doc.line(182, 15, 182, H - 15);

  // ── LEFT COLUMN (cx: 96) ─────────────────────────────────────────────────
  const lcx = 96;

  // Seal
  doc.setFillColor(201, 168, 76);
  doc.circle(lcx, 26, 10, 'F');
  doc.setFillColor(230, 200, 106);
  doc.circle(lcx, 26, 7, 'F');
  doc.setFont(headingFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(255, 255, 255);
  doc.text('FY', lcx, 29, { align: 'center' });

  doc.setFillColor(253, 248, 232);
  doc.rect(15, 41, 162, 12, 'F');
  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.5);
  doc.line(15, 41, 177, 41); doc.line(15, 53, 177, 53);
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(139, 105, 20);
  doc.text('CERTIFICATE OF DEFENSE READINESS', lcx, 49, { align: 'center', charSpace: 1.5 });

  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(160, 120, 64);
  doc.text('This certifies that', lcx, 62, { align: 'center' });

  doc.setFont(headingFont, 'normal');
  doc.setFontSize(18);
  doc.setTextColor(44, 24, 16);
  const displayName = recipientName.length > 40 ? recipientName.slice(0, 39) + '…' : recipientName;
  doc.text(displayName, lcx, 73, { align: 'center' });

  if (faculty || department) {
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(160, 120, 64);
    doc.text([faculty, department].filter(Boolean).join(' · '), lcx, 81, { align: 'center' });
  }

  doc.setDrawColor(201, 168, 76);
  doc.setLineWidth(0.4);
  doc.line(lcx - 30, 87, lcx - 5, 87); doc.line(lcx + 5, 87, lcx + 30, 87);
  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.setTextColor(201, 168, 76);
  doc.text('*', lcx, 88.5, { align: 'center' });

  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(160, 120, 64);
  doc.text('has demonstrated defence readiness for', lcx, 97, { align: 'center' });

  doc.setFont(headingFont, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(44, 24, 16);
  const raw        = topicTitle.length > 100 ? topicTitle.slice(0, 99) + '…' : topicTitle;
  const topicLines = doc.splitTextToSize(`"${raw}"`, 140);
  doc.text(topicLines, lcx, 107, { align: 'center' });

  // ── RIGHT COLUMN (cx: 234) ───────────────────────────────────────────────
  const rcx = 234;

  const pillW = 76; const pillH = 11;
  doc.setFillColor(201, 168, 76);
  doc.roundedRect(rcx - pillW / 2, 56, pillW, pillH, 5, 5, 'F');
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.text(`Score: ${scoreLabel}`, rcx, 63, { align: 'center' });

  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(160, 120, 64);
  doc.text(`Issued on ${dateStr}`, rcx, 80, { align: 'center' });

  const qrX = rcx - 10; const qrY = H - 44;
  try { doc.addImage(qrBase64, 'PNG', qrX, qrY, 20, 20); } catch { /* skip */ }

  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(160, 120, 64);
  doc.text(certNumber, rcx, H - 16, { align: 'center' });
  doc.setFontSize(6);
  doc.setTextColor(201, 168, 76);
  doc.text('fypro.com.ng/verify', rcx, H - 10, { align: 'center' });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/certificate.js
git commit -m "feat: implement Academic Prestige PDF style (portrait + landscape)"
```

---

## Task 5: Implement `drawDark` (Dark Premium style)

**Files:**
- Modify: `api/certificate.js` — replace the `drawDark` stub

- [ ] **Step 1: Replace the `drawDark` stub with the full implementation**

```js
function drawDark(doc, W, H, data) {
  const { recipientName, faculty, department, topicTitle,
          scoreLabel, dateStr, certNumber, qrBase64,
          headingFont, bodyFont, logoBase64 } = data;
  const isLandscape = W > H;

  if (isLandscape) {
    drawDarkLandscape(doc, W, H, data);
    return;
  }

  const cx = W / 2;

  // Deep navy background
  doc.setFillColor(13, 27, 42);
  doc.rect(0, 0, W, H, 'F');

  // Outer blue border
  doc.setDrawColor(0, 60, 150);
  doc.setLineWidth(0.8);
  doc.rect(3, 3, W - 6, H - 6);

  // Top accent bar (gradient-like: draw 3 thin rects of decreasing opacity)
  doc.setFillColor(0, 102, 255);
  doc.rect(0, 0, W, 2.5, 'F');
  doc.setFillColor(30, 80, 200);
  doc.rect(0, 2.5, W, 1.5, 'F');

  // Bottom accent bar
  doc.setFillColor(0, 102, 255);
  doc.rect(0, H - 2.5, W, 2.5, 'F');
  doc.setFillColor(30, 80, 200);
  doc.rect(0, H - 4, W, 1.5, 'F');

  // Logo / wordmark (white)
  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', cx - 20, 14, 40, 14); }
    catch {
      doc.setFont(headingFont, 'normal');
      doc.setFontSize(18);
      doc.setTextColor(255, 255, 255);
      doc.text('FYPro', cx, 26, { align: 'center' });
    }
  } else {
    doc.setFont(headingFont, 'normal');
    doc.setFontSize(18);
    doc.setTextColor(255, 255, 255);
    doc.text('FYPro', cx, 26, { align: 'center' });
  }

  // Top rule
  doc.setDrawColor(0, 102, 255);
  doc.setLineWidth(0.6);
  doc.line(cx - 30, 32, cx + 30, 32);

  // Title (light blue)
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(8);
  doc.setTextColor(96, 165, 250);
  doc.text('CERTIFICATE OF DEFENSE READINESS', cx, 42, { align: 'center', charSpace: 2 });

  // Title flanking rules
  doc.setDrawColor(0, 60, 150);
  doc.setLineWidth(0.3);
  doc.line(15, 45, cx - 50, 45); doc.line(cx + 50, 45, W - 15, 45);

  // "This certifies that"
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(255, 255, 255);
  doc.setTextColor(150, 160, 180);
  doc.text('This certifies that', cx, 57, { align: 'center' });

  // Recipient name (white, subtle glow via bold)
  doc.setFont(headingFont, 'normal');
  doc.setFontSize(22);
  doc.setTextColor(255, 255, 255);
  const displayName = recipientName.length > 48 ? recipientName.slice(0, 47) + '…' : recipientName;
  doc.text(displayName, cx, 70, { align: 'center' });

  // Faculty & department
  if (faculty || department) {
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(100, 120, 150);
    doc.text([faculty, department].filter(Boolean).join(' · '), cx, 79, { align: 'center' });
  }

  // Dot divider
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(0, 80, 180);
  doc.text('· · ·', cx, 89, { align: 'center' });

  // "has demonstrated..."
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(150, 160, 180);
  doc.text('has demonstrated defence readiness for', cx, 99, { align: 'center' });

  // Topic (white/dim, italic via DM Serif Display)
  doc.setFont(headingFont, 'normal');
  doc.setFontSize(13);
  doc.setTextColor(220, 225, 235);
  const raw        = topicTitle.length > 120 ? topicTitle.slice(0, 119) + '…' : topicTitle;
  const topicLines = doc.splitTextToSize(`"${raw}"`, 148);
  const topicY     = 112;
  doc.text(topicLines, cx, topicY, { align: 'center' });
  const topicEndY  = topicY + (topicLines.length - 1) * 7;

  // Score badge (outlined pill, blue border)
  const scoreY = topicEndY + 18;
  const pillW  = 90;
  const pillH  = 11;
  doc.setDrawColor(0, 102, 255);
  doc.setLineWidth(0.8);
  doc.roundedRect(cx - pillW / 2, scoreY - 8, pillW, pillH, 5, 5, 'S');
  doc.setFont('courier', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(147, 197, 253);
  doc.text(`SCORE: ${scoreLabel}`, cx, scoreY, { align: 'center' });

  // Issue date
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(100, 120, 150);
  doc.text(`Issued on ${dateStr}`, cx, scoreY + 14, { align: 'center' });

  // Tagline
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(70, 90, 120);
  doc.text('"The supervisor you never had."', cx, scoreY + 24, { align: 'center' });

  // Bottom rule
  doc.setDrawColor(0, 102, 255);
  doc.setLineWidth(0.6);
  doc.line(cx - 30, scoreY + 30, cx + 30, scoreY + 30);

  // Footer
  const footerRuleY = H - 28;
  doc.setDrawColor(0, 60, 150);
  doc.setLineWidth(0.3);
  doc.line(20, footerRuleY, W - 20, footerRuleY);

  // QR code (bottom-left — QR modules are light blue on transparent/navy background)
  const qrSize = 20;
  const qrX    = 18;
  const qrY    = H - 26;
  try { doc.addImage(qrBase64, 'PNG', qrX, qrY, qrSize, qrSize); } catch { /* skip */ }

  // Cert number
  doc.setFont('courier', 'bold');
  doc.setFontSize(8);
  doc.setTextColor(100, 120, 150);
  doc.text(certNumber, W - 18, H - 18, { align: 'right' });
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.setTextColor(0, 80, 150);
  doc.text(`fypro.com.ng/verify/${certNumber}`, W - 18, H - 12, { align: 'right' });
}

function drawDarkLandscape(doc, W, H, data) {
  const { recipientName, faculty, department, topicTitle,
          scoreLabel, dateStr, certNumber, qrBase64,
          headingFont, bodyFont, logoBase64 } = data;

  // Navy background
  doc.setFillColor(13, 27, 42);
  doc.rect(0, 0, W, H, 'F');
  doc.setDrawColor(0, 60, 150);
  doc.setLineWidth(0.8);
  doc.rect(3, 3, W - 6, H - 6);

  // Top/bottom accent bars
  doc.setFillColor(0, 102, 255);
  doc.rect(0, 0, W, 2.5, 'F');
  doc.setFillColor(30, 80, 200);
  doc.rect(0, 2.5, W, 1.5, 'F');
  doc.setFillColor(0, 102, 255);
  doc.rect(0, H - 2.5, W, 2.5, 'F');
  doc.setFillColor(30, 80, 200);
  doc.rect(0, H - 4, W, 1.5, 'F');

  // Vertical separator
  doc.setDrawColor(0, 60, 150);
  doc.setLineWidth(0.3);
  doc.line(182, 12, 182, H - 12);

  // ── LEFT COLUMN (cx: 96) ─────────────────────────────────────────────────
  const lcx = 96;

  if (logoBase64) {
    try { doc.addImage(logoBase64, 'PNG', lcx - 18, 12, 36, 12); }
    catch {
      doc.setFont(headingFont, 'normal');
      doc.setFontSize(16);
      doc.setTextColor(255, 255, 255);
      doc.text('FYPro', lcx, 22, { align: 'center' });
    }
  } else {
    doc.setFont(headingFont, 'normal');
    doc.setFontSize(16);
    doc.setTextColor(255, 255, 255);
    doc.text('FYPro', lcx, 22, { align: 'center' });
  }

  doc.setDrawColor(0, 102, 255);
  doc.setLineWidth(0.6);
  doc.line(lcx - 25, 28, lcx + 25, 28);

  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(96, 165, 250);
  doc.text('CERTIFICATE OF DEFENSE READINESS', lcx, 36, { align: 'center', charSpace: 1.5 });

  doc.setFontSize(9);
  doc.setTextColor(150, 160, 180);
  doc.text('This certifies that', lcx, 47, { align: 'center' });

  doc.setFont(headingFont, 'normal');
  doc.setFontSize(18);
  doc.setTextColor(255, 255, 255);
  const displayName = recipientName.length > 40 ? recipientName.slice(0, 39) + '…' : recipientName;
  doc.text(displayName, lcx, 58, { align: 'center' });

  if (faculty || department) {
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(100, 120, 150);
    doc.text([faculty, department].filter(Boolean).join(' · '), lcx, 66, { align: 'center' });
  }

  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(0, 80, 180);
  doc.text('· · ·', lcx, 74, { align: 'center' });

  doc.setFontSize(9);
  doc.setTextColor(150, 160, 180);
  doc.text('has demonstrated defence readiness for', lcx, 82, { align: 'center' });

  doc.setFont(headingFont, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(220, 225, 235);
  const raw        = topicTitle.length > 100 ? topicTitle.slice(0, 99) + '…' : topicTitle;
  const topicLines = doc.splitTextToSize(`"${raw}"`, 140);
  doc.text(topicLines, lcx, 92, { align: 'center' });

  // ── RIGHT COLUMN (cx: 234) ───────────────────────────────────────────────
  const rcx = 234;

  const pillW = 80; const pillH = 11;
  doc.setDrawColor(0, 102, 255);
  doc.setLineWidth(0.8);
  doc.roundedRect(rcx - pillW / 2, 56, pillW, pillH, 5, 5, 'S');
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(147, 197, 253);
  doc.text(`SCORE: ${scoreLabel}`, rcx, 63, { align: 'center' });

  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(100, 120, 150);
  doc.text(`Issued on ${dateStr}`, rcx, 80, { align: 'center' });

  doc.setFontSize(8);
  doc.setTextColor(70, 90, 120);
  doc.text('"The supervisor you never had."', rcx, 91, { align: 'center' });

  const qrX = rcx - 10; const qrY = H - 42;
  try { doc.addImage(qrBase64, 'PNG', qrX, qrY, 20, 20); } catch { /* skip */ }

  doc.setFont('courier', 'bold');
  doc.setFontSize(7);
  doc.setTextColor(100, 120, 150);
  doc.text(certNumber, rcx, H - 14, { align: 'center' });
  doc.setFont('courier', 'normal');
  doc.setFontSize(6.5);
  doc.setTextColor(0, 80, 150);
  doc.text('fypro.com.ng/verify', rcx, H - 8, { align: 'center' });
}
```

- [ ] **Step 2: Commit**

```bash
git add api/certificate.js
git commit -m "feat: implement Academic Prestige and Dark Premium PDF styles"
```

---

## Task 6: Update `downloadCertificate` in `src/lib/certificate.ts`

**Files:**
- Modify: `src/lib/certificate.ts`

- [ ] **Step 1: Add `style` and `orientation` params**

Replace the `downloadCertificate` function signature and body:

```ts
export async function downloadCertificate(
  defenseSessionId: string,
  style:       'prestige' | 'modern' | 'dark' = 'modern',
  orientation: 'portrait' | 'landscape'       = 'portrait',
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const res = await fetch('/api/certificate', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ defense_session_id: defenseSessionId, style, orientation }),
  })

  if (!res.ok) {
    let data: { error?: string; message?: string } = {}
    try { data = await res.json() } catch { /* ignore */ }
    throw new Error(data.error || data.message || 'Failed to generate certificate')
  }

  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  a.download = match?.[1] || 'FYPro-Certificate.pdf'
  a.href = url
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}
```

- [ ] **Step 2: Commit**

```bash
git add src/lib/certificate.ts
git commit -m "feat: add style and orientation params to downloadCertificate"
```

---

## Task 7: Create `CertificateDownloadModal.jsx`

This component owns the style/orientation picker UI. It reads and writes `cert_style` / `cert_orientation` in localStorage.

**Files:**
- Create: `src/components/defense/CertificateDownloadModal.jsx`

- [ ] **Step 1: Create the file**

```jsx
import { useState } from 'react'
import { downloadCertificate } from '../../lib/certificate'
import { supabase } from '../../lib/supabase'
import Sentry from '../../lib/sentry'
import { useTheme } from '../../context/ThemeContext'

const STYLES = [
  {
    id:    'modern',
    label: 'Modern Bold',
    desc:  'Clean white, blue bars',
    preview: (
      <div style={{ background: '#fff', borderRadius: 4, overflow: 'hidden', height: 52, display: 'flex', flexDirection: 'column' }}>
        <div style={{ background: '#0066FF', height: 5 }} />
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: '4px 6px' }}>
          <div style={{ background: '#F0FFF4', borderLeft: '2px solid #16A34A', width: '100%', padding: '2px 4px' }}>
            <div style={{ fontSize: 5, color: '#16A34A', fontWeight: 700, letterSpacing: 1 }}>CERTIFIED</div>
          </div>
          <div style={{ width: 28, height: 2, background: '#0066FF', borderRadius: 2 }} />
          <div style={{ width: 22, height: 1.5, background: '#E5E7EB', borderRadius: 1 }} />
        </div>
        <div style={{ background: '#0066FF', height: 5 }} />
      </div>
    ),
  },
  {
    id:    'prestige',
    label: 'Academic Prestige',
    desc:  'Ivory, gold border',
    preview: (
      <div style={{ background: '#FFFDF5', border: '1.5px solid #C9A84C', borderRadius: 4, height: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, position: 'relative', padding: 6 }}>
        <div style={{ position: 'absolute', top: 3, left: 3, width: 8, height: 8, borderTop: '1.5px solid #C9A84C', borderLeft: '1.5px solid #C9A84C' }} />
        <div style={{ position: 'absolute', top: 3, right: 3, width: 8, height: 8, borderTop: '1.5px solid #C9A84C', borderRight: '1.5px solid #C9A84C' }} />
        <div style={{ position: 'absolute', bottom: 3, left: 3, width: 8, height: 8, borderBottom: '1.5px solid #C9A84C', borderLeft: '1.5px solid #C9A84C' }} />
        <div style={{ position: 'absolute', bottom: 3, right: 3, width: 8, height: 8, borderBottom: '1.5px solid #C9A84C', borderRight: '1.5px solid #C9A84C' }} />
        <div style={{ width: 14, height: 14, borderRadius: '50%', background: '#C9A84C', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <span style={{ fontSize: 6, color: '#fff', fontWeight: 700 }}>FY</span>
        </div>
        <div style={{ width: 28, height: 1.5, background: '#C9A84C', borderRadius: 1 }} />
        <div style={{ width: 22, height: 1, background: 'rgba(201,168,76,0.4)', borderRadius: 1 }} />
      </div>
    ),
  },
  {
    id:    'dark',
    label: 'Dark Premium',
    desc:  'Navy, blue glow',
    preview: (
      <div style={{ background: 'linear-gradient(145deg,#0D1B2A,#060E18)', border: '1px solid rgba(0,102,255,0.3)', borderRadius: 4, height: 52, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3, padding: 6, position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, background: '#0066FF' }} />
        <div style={{ fontSize: 7, color: '#fff', letterSpacing: 2, fontFamily: 'Georgia,serif' }}>FYPro</div>
        <div style={{ width: 22, height: 1.5, background: 'rgba(0,102,255,0.8)' }} />
        <div style={{ width: 28, height: 1, background: 'rgba(255,255,255,0.3)', borderRadius: 1 }} />
        <div style={{ width: 22, height: 1, background: 'rgba(255,255,255,0.15)', borderRadius: 1 }} />
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 2.5, background: '#0066FF' }} />
      </div>
    ),
  },
]

const ORIENTATIONS = [
  { id: 'portrait',  label: 'Portrait',  sub: '210 × 297 mm' },
  { id: 'landscape', label: 'Landscape', sub: '297 × 210 mm' },
]

export default function CertificateDownloadModal({ isOpen, onClose, defenseSessionId, topic }) {
  const { theme } = useTheme()
  const isDark = theme === 'dark'

  const [style,       setStyle]       = useState(() => localStorage.getItem('cert_style')       || 'modern')
  const [orientation, setOrientation] = useState(() => localStorage.getItem('cert_orientation') || 'portrait')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState(null)

  if (!isOpen) return null

  async function handleDownload() {
    setError(null)
    setLoading(true)
    localStorage.setItem('cert_style',       style)
    localStorage.setItem('cert_orientation', orientation)
    try {
      await downloadCertificate(defenseSessionId, style, orientation)
      onClose()
    } catch (err) {
      if (err.message === 'NAME_REQUIRED') {
        setError('NAME_REQUIRED')
      } else {
        const sentryErr = err instanceof Error ? err : new Error(String(err))
        supabase.auth.getUser()
          .then(({ data }) => {
            Sentry.withScope(scope => {
              scope.setTag('feature', 'certificate_generation')
              scope.setExtra('defense_session_id', defenseSessionId)
              scope.setExtra('style', style)
              scope.setExtra('orientation', orientation)
              if (data?.user?.id) scope.setUser({ id: data.user.id })
              Sentry.captureException(sentryErr)
            })
          })
          .catch(() => Sentry.captureException(sentryErr))
        setError(err.message || 'certificate_failed')
      }
    } finally {
      setLoading(false)
    }
  }

  const bg      = isDark ? '#0D1B2A' : '#FFFFFF'
  const overlay = 'rgba(0,0,0,0.6)'
  const border  = isDark ? 'rgba(255,255,255,0.1)' : 'rgba(13,27,42,0.12)'
  const text1   = isDark ? '#FFFFFF'               : '#0D1B2A'
  const text2   = isDark ? 'rgba(255,255,255,0.5)' : 'rgba(13,27,42,0.55)'
  const label   = isDark ? 'rgba(255,255,255,0.35)' : 'rgba(13,27,42,0.4)'

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{
        position: 'fixed', inset: 0, background: overlay,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 1000, padding: 16,
      }}
    >
      <div style={{
        background: bg, borderRadius: 16, border: `1px solid ${border}`,
        padding: '28px 24px', width: '100%', maxWidth: 400,
        boxShadow: isDark ? '0 24px 64px rgba(0,0,0,0.6)' : '0 24px 64px rgba(0,0,0,0.15)',
        animation: 'card-enter 0.2s ease forwards',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 22 }}>
          <div>
            <p style={{ fontFamily: "'DM Serif Display', Georgia, serif", fontSize: '1.1rem', color: text1, margin: 0, marginBottom: 4 }}>
              Download Certificate
            </p>
            <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.72rem', color: text2, margin: 0 }}>
              Choose your style and format
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: 28, height: 28, borderRadius: '50%',
              background: isDark ? 'rgba(255,255,255,0.06)' : 'rgba(13,27,42,0.06)',
              border: 'none', color: text2, fontSize: 14, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Style picker */}
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: label, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>
          Style
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 20 }}>
          {STYLES.map(s => {
            const active = style === s.id
            return (
              <button
                key={s.id}
                onClick={() => setStyle(s.id)}
                style={{
                  border:       active ? '2px solid #0066FF' : `1.5px solid ${border}`,
                  borderRadius: 10, padding: '10px 6px', textAlign: 'center',
                  background:   active ? (isDark ? 'rgba(0,102,255,0.1)' : '#EFF6FF') : 'transparent',
                  cursor: 'pointer', position: 'relative', transition: 'all 0.15s ease',
                }}
              >
                {active && (
                  <div style={{
                    position: 'absolute', top: -6, right: -6,
                    width: 14, height: 14, background: '#0066FF', borderRadius: '50%',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: 8, color: '#fff',
                  }}>✓</div>
                )}
                <div style={{ marginBottom: 6 }}>{s.preview}</div>
                <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.6rem', color: active ? '#0066FF' : text2, margin: 0, lineHeight: 1.3, fontWeight: active ? 600 : 400 }}>
                  {s.label}
                </p>
              </button>
            )
          })}
        </div>

        {/* Orientation toggle */}
        <p style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: '0.65rem', color: label, letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 10 }}>
          Orientation
        </p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 22 }}>
          {ORIENTATIONS.map(o => {
            const active   = orientation === o.id
            const isPortrait = o.id === 'portrait'
            return (
              <button
                key={o.id}
                onClick={() => setOrientation(o.id)}
                style={{
                  border:       active ? '2px solid #0066FF' : `1.5px solid ${border}`,
                  borderRadius: 10, padding: '12px', cursor: 'pointer',
                  background:   active ? (isDark ? 'rgba(0,102,255,0.1)' : '#EFF6FF') : 'transparent',
                  display: 'flex', alignItems: 'center', gap: 10,
                  transition: 'all 0.15s ease',
                }}
              >
                {/* Page icon */}
                <div style={{
                  width:        isPortrait ? 16 : 22,
                  height:       isPortrait ? 22 : 16,
                  background:   active ? 'rgba(0,102,255,0.15)' : (isDark ? 'rgba(255,255,255,0.08)' : 'rgba(13,27,42,0.06)'),
                  border:       active ? '1.5px solid rgba(0,102,255,0.5)' : `1.5px solid ${border}`,
                  borderRadius: 2, flexShrink: 0,
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 2, padding: 2,
                }}>
                  <div style={{ width: '80%', height: 1.5, background: active ? '#0066FF' : (isDark ? 'rgba(255,255,255,0.3)' : 'rgba(13,27,42,0.3)'), borderRadius: 1 }} />
                  <div style={{ width: '70%', height: 1, background: active ? 'rgba(0,102,255,0.5)' : (isDark ? 'rgba(255,255,255,0.2)' : 'rgba(13,27,42,0.2)'), borderRadius: 1 }} />
                </div>
                <div style={{ textAlign: 'left' }}>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: active ? '#0066FF' : text1, margin: 0, fontWeight: active ? 600 : 400 }}>
                    {o.label}
                  </p>
                  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.62rem', color: text2, margin: 0 }}>
                    {o.sub}
                  </p>
                </div>
              </button>
            )
          })}
        </div>

        {/* Errors */}
        {error === 'NAME_REQUIRED' && (
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: '#DC2626', marginBottom: 10 }}>
            Please set your full name in your{' '}
            <a href="/profile" style={{ color: '#60A5FA', textDecoration: 'underline' }}>profile</a>{' '}
            before downloading.
          </p>
        )}
        {error && error !== 'NAME_REQUIRED' && (
          <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: '#DC2626', marginBottom: 10 }}>
            Download failed. Please try again or{' '}
            <a href="https://wa.me/2348029061967" target="_blank" rel="noopener noreferrer" style={{ color: '#4ADE80', textDecoration: 'underline' }}>contact us on WhatsApp</a>.
          </p>
        )}

        {/* Download button */}
        <button
          onClick={handleDownload}
          disabled={loading}
          style={{
            width: '100%', padding: '13px', borderRadius: 10,
            background: loading ? 'rgba(22,163,74,0.5)' : '#16A34A',
            color: '#FFFFFF', border: 'none',
            fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.875rem',
            cursor: loading ? 'not-allowed' : 'pointer',
            transition: 'all 0.2s ease', marginBottom: 10,
          }}
          onMouseEnter={e => { if (!loading) e.currentTarget.style.boxShadow = '0 0 20px rgba(22,163,74,0.35)' }}
          onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
        >
          {loading ? 'Generating your certificate…' : '⬇ Download PDF'}
        </button>

        {/* Cancel */}
        <div style={{ textAlign: 'center' }}>
          <button
            onClick={onClose}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: text2 }}
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/defense/CertificateDownloadModal.jsx
git commit -m "feat: add CertificateDownloadModal with style/orientation picker"
```

---

## Task 8: Wire `CertificateUnlock.jsx` to use modal

**Files:**
- Modify: `src/components/defense/CertificateUnlock.jsx`

- [ ] **Step 1: Replace the download button logic with modal state**

At the top of the file, add the import:

```jsx
import CertificateDownloadModal from './CertificateDownloadModal'
```

Inside `CertificateUnlock`, replace the `certLoading`, `certError` state declarations and `handleDownload` function with:

```jsx
const [isCertModalOpen, setIsCertModalOpen] = useState(false)
```

Keep `shareLoading`, `shareError`, and `handleShare` exactly as they are — share is unchanged.

- [ ] **Step 2: Replace the download button and its error UI with the modal trigger**

Find the section in the `return` that starts with `{certError === 'NAME_REQUIRED' && ...}` and ends with the closing `</div>` of the button container. Replace it with:

```jsx
<div style={{ display: 'flex', flexDirection: 'column', gap: 8, width: '100%', maxWidth: 340 }}>
  <button
    onClick={() => setIsCertModalOpen(true)}
    aria-label="Download PDF certificate"
    style={{
      width: '100%', padding: '14px 28px', borderRadius: 12,
      fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.875rem',
      cursor: 'pointer', transition: 'all 0.2s ease', border: 'none',
      background: '#16A34A', color: '#FFFFFF',
    }}
    onMouseEnter={e => { e.currentTarget.style.boxShadow = '0 0 20px rgba(22,163,74,0.35)' }}
    onMouseLeave={e => { e.currentTarget.style.boxShadow = 'none' }}
  >
    ⬇ Download certificate
  </button>
  <button
    onClick={handleShare}
    disabled={shareLoading}
    aria-label="Share certificate to WhatsApp"
    style={{
      width: '100%', padding: '13px 27px', borderRadius: 12,
      fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.875rem',
      cursor: shareLoading ? 'not-allowed' : 'pointer', transition: 'all 0.2s ease',
      background: 'transparent',
      border: isLight ? '1.5px solid rgba(13,27,42,0.15)' : '1.5px solid rgba(255,255,255,0.08)',
      color: isLight ? '#0D1B2A' : '#FFFFFF', opacity: shareLoading ? 0.6 : 1,
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
    }}
    onMouseEnter={e => { if (!shareLoading) e.currentTarget.style.borderColor = isLight ? 'rgba(13,27,42,0.4)' : 'rgba(255,255,255,0.6)' }}
    onMouseLeave={e => { e.currentTarget.style.borderColor = isLight ? 'rgba(13,27,42,0.15)' : 'rgba(255,255,255,0.08)' }}
  >
    <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
    </svg>
    {shareLoading ? 'Generating…' : 'Share on WhatsApp'}
  </button>
</div>

{shareError && (
  <p style={{ fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem', color: '#F87171', marginTop: 8 }}>
    {shareError}
  </p>
)}

<CertificateDownloadModal
  isOpen={isCertModalOpen}
  onClose={() => setIsCertModalOpen(false)}
  defenseSessionId={defenseSessionId}
  topic={topic}
/>
```

- [ ] **Step 3: Commit**

```bash
git add src/components/defense/CertificateUnlock.jsx
git commit -m "feat: wire CertificateDownloadModal into CertificateUnlock"
```

---

## Task 9: Wire `MyCertificates.jsx` to use modal

**Files:**
- Modify: `src/pages/account/MyCertificates.jsx`

- [ ] **Step 1: Import the modal**

Add at the top of the file:

```jsx
import CertificateDownloadModal from '../../components/defense/CertificateDownloadModal'
```

- [ ] **Step 2: Add modal state to `MyCertificates`**

In the `MyCertificates` component, replace the `downloading` state:

```jsx
// Remove:
const [downloading, setDownloading] = useState(null)

// Add:
const [activeCert, setActiveCert] = useState(null) // { defenseSessionId, topic }
```

Remove the `handleDownload` function entirely — it's no longer needed.

- [ ] **Step 3: Update `CertRow` to open modal instead of calling download directly**

The `CertRow` component currently receives `onDownload` and `downloading` props. Replace its Download button with a simple opener:

In `MyCertificates`, update the map:

```jsx
{certs.map(cert => (
  <CertRow
    key={cert.id}
    cert={cert}
    onDownload={() => setActiveCert({ defenseSessionId: cert.defense_session_id, topic: cert.topic_title })}
    isDark={isDark}
  />
))}
```

In `CertRow`, remove the `downloading` prop from the function signature, remove the `error`/`setError` state and `handleDownload` function, and simplify the button in the right column. The left info column is unchanged. The new full component:

```jsx
function CertRow({ cert, onDownload, isDark }) {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: '1fr auto', gap: 16,
      padding: '18px 22px',
      background: isDark
        ? 'linear-gradient(145deg, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.025) 100%)'
        : 'linear-gradient(145deg, #ffffff 0%, #f8faff 100%)',
      borderRadius: 12,
      border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid rgba(13,27,42,0.08)',
      boxShadow: isDark ? '0 4px 20px rgba(0,0,0,0.35)' : '0 4px 16px rgba(0,0,0,0.06)',
      marginBottom: 12, animation: 'card-enter 0.4s ease forwards',
    }}>
      {/* Left: info */}
      <div style={{ minWidth: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
          <ScorePill score={cert.score} />
          <span style={{
            fontFamily: "'JetBrains Mono', 'Courier New', monospace",
            fontSize: '0.68rem', fontWeight: 500,
            color: isDark ? 'rgba(255,255,255,0.3)' : 'rgba(13,27,42,0.35)',
            letterSpacing: '0.3px',
          }}>
            {cert.certificate_number}
          </span>
        </div>
        <p style={{
          fontFamily: "'DM Serif Display', Georgia, serif",
          fontSize: '0.95rem', color: isDark ? '#FFFFFF' : '#0D1B2A',
          lineHeight: 1.4, marginBottom: 4,
          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
        }}>
          {cert.topic_title}
        </p>
        <p style={{
          fontFamily: "'Poppins', sans-serif", fontSize: '0.75rem',
          color: isDark ? 'rgba(255,255,255,0.45)' : 'rgba(13,27,42,0.5)', margin: 0,
        }}>
          Issued {formatDate(cert.issued_at)} · {cert.recipient_name}
        </p>
      </div>

      {/* Right: open modal */}
      <div style={{ display: 'flex', alignItems: 'center' }}>
        <button
          onClick={onDownload}
          aria-label={`Download certificate ${cert.certificate_number}`}
          style={{
            padding: '9px 16px', borderRadius: 10,
            background: '#0066FF', color: '#FFFFFF', border: 'none',
            fontFamily: "'Poppins', sans-serif", fontWeight: 600, fontSize: '0.8rem',
            cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all 0.2s ease',
          }}
          onMouseOver={e => { e.currentTarget.style.background = '#0052CC' }}
          onMouseOut={e => { e.currentTarget.style.background = '#0066FF' }}
        >
          ⬇ Download
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Render the modal once at the bottom of `MyCertificates` return**

Just before the closing `</div>` of the outer container (before the `<style>` tag), add:

```jsx
<CertificateDownloadModal
  isOpen={activeCert !== null}
  onClose={() => setActiveCert(null)}
  defenseSessionId={activeCert?.defenseSessionId ?? ''}
  topic={activeCert?.topic ?? ''}
/>
```

- [ ] **Step 5: Commit**

```bash
git add src/pages/account/MyCertificates.jsx
git commit -m "feat: wire CertificateDownloadModal into MyCertificates page"
```

---

## Task 10: End-to-end verification

- [ ] **Step 1: Run the frontend dev server**

```bash
npm run dev
```

- [ ] **Step 2: Test Modern Bold portrait**

Navigate to a completed defense session (score ≥ 7/10). Click **Download certificate**. Verify the modal opens. Select Modern Bold + Portrait. Click Download PDF. Open the PDF and check:
- Blue bars top and bottom
- Green achievement band present
- Name, topic, score displayed correctly
- QR code visible bottom-left
- Cert number visible bottom-right

- [ ] **Step 3: Test Academic Prestige landscape**

Open the modal again. Select Academic Prestige + Landscape. Download and check:
- Ivory background
- Gold border with corner ornaments
- Two-column layout in landscape
- Gold seal
- QR code in right column

- [ ] **Step 4: Test Dark Premium portrait**

Select Dark Premium + Portrait. Download and check:
- Navy background
- Blue accent lines top/bottom
- Light-blue QR modules visible
- Outlined score badge

- [ ] **Step 5: Test localStorage persistence**

Close the modal without downloading. Reload the page. Click Download certificate. Verify the previously selected style and orientation are pre-selected.

- [ ] **Step 6: Test from My Certificates page**

Navigate to `/account/certificates`. Click Download on a certificate row. Verify the same modal opens and works.

- [ ] **Step 7: Final commit**

```bash
git add .
git commit -m "feat: complete certificate redesign — 3 styles, 2 orientations, QR code, download modal"
```
