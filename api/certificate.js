// Defense Certificate endpoint
// POST /api/certificate — generates or re-fetches a PDF certificate for a
// completed defense session that scored >= 7/10.
//
// Security guarantees:
//   1. Score is read from defense_sessions.total_score — never from the request body.
//   2. defense_certificates INSERT is service_role only (RLS).
//   3. Cross-user access blocked: .eq('user_id', user.id) on every DB fetch.

import { supabaseAdmin } from './_lib/supabase-admin.js';
import { sendTelegramAlert, escapeTgHtml } from './_lib/telegram.js';
import { setCorsHeaders } from './_lib/cors.js';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

const SCORE_THRESHOLD = 7;

// Load logo once at cold start — graceful fallback to text wordmark if absent
let logoBase64 = null;
try {
  const bytes = fs.readFileSync(path.join(process.cwd(), 'public', 'fypro-logo.png'));
  logoBase64 = `data:image/png;base64,${bytes.toString('base64')}`;
} catch {
  // Logo not accessible from serverless context — PDF uses "FYPro" text instead
}

// Google Fonts — fetch TTF binaries at cold start and cache in module scope.
// Uses legacy UA header so Google returns TTF (jsPDF requires TTF, not WOFF2).
let dmSerifBase64  = null;
let poppinsBase64  = null;
let fontsAttempted = false;

async function ensureFonts() {
  if (fontsAttempted) return;
  fontsAttempted = true;
  const UA = 'Mozilla/4.0 (compatible; MSIE 7.0; Windows NT 6.0)';
  try {
    const dmCss  = await fetch('https://fonts.googleapis.com/css?family=DM+Serif+Display', { headers: { 'User-Agent': UA } }).then(r => r.text());
    const dmUrl  = dmCss.match(/url\((https:\/\/[^)]+\.ttf)\)/)?.[1];
    if (dmUrl) dmSerifBase64 = Buffer.from(await fetch(dmUrl).then(r => r.arrayBuffer())).toString('base64');
  } catch { /* fall back to times */ }
  try {
    const ppCss  = await fetch('https://fonts.googleapis.com/css?family=Poppins:400,600', { headers: { 'User-Agent': UA } }).then(r => r.text());
    const ppUrl  = ppCss.match(/url\((https:\/\/[^)]+\.ttf)\)/)?.[1];
    if (ppUrl) poppinsBase64 = Buffer.from(await fetch(ppUrl).then(r => r.arrayBuffer())).toString('base64');
  } catch { /* fall back to helvetica */ }
}

// ── QR code ──────────────────────────────────────────────────────────────────

async function generateQR(url, darkColor = '#0D1B2A') {
  return QRCode.toDataURL(url, {
    width:  80,
    margin: 1,
    color:  { dark: darkColor, light: '#FFFFFF00' },
  });
}

// ── PDF builder ───────────────────────────────────────────────────────────────

function registerFonts(doc) {
  if (dmSerifBase64) {
    doc.addFileToVFS('DMSerifDisplay.ttf', dmSerifBase64);
    doc.addFont('DMSerifDisplay.ttf', 'DMSerifDisplay', 'normal');
  }
  if (poppinsBase64) {
    doc.addFileToVFS('Poppins.ttf', poppinsBase64);
    doc.addFont('Poppins.ttf', 'Poppins', 'normal');
  }
}

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
  doc.setCharSpace(2);
  doc.text('CERTIFICATE OF DEFENSE READINESS', cx, 62, { align: 'center' });
  doc.setCharSpace(0);

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
  doc.setCharSpace(1.5);
  doc.text('CERTIFICATE OF DEFENSE READINESS', lcx, 49, { align: 'center' });
  doc.setCharSpace(0);

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
  doc.setCharSpace(2);
  doc.text('CERTIFICATE OF DEFENSE READINESS', cx, 42, { align: 'center' });
  doc.setCharSpace(0);

  // Title flanking rules
  doc.setDrawColor(0, 60, 150);
  doc.setLineWidth(0.3);
  doc.line(15, 45, cx - 50, 45); doc.line(cx + 50, 45, W - 15, 45);

  // "This certifies that"
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(10);
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
  doc.setCharSpace(1.5);
  doc.text('CERTIFICATE OF DEFENSE READINESS', lcx, 36, { align: 'center' });
  doc.setCharSpace(0);

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

function drawWordmark(doc, cx, font, y) {
  doc.setFont(font, 'normal');
  doc.setFontSize(22);
  doc.setTextColor(13, 27, 42);
  doc.text('FYPro', cx, y, { align: 'center' });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // Auth
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });

  let authResult;
  try {
    authResult = await supabaseAdmin.auth.getUser(token);
  } catch (err) {
    console.error('[certificate] auth.getUser threw:', err.message);
    return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
  }
  const { data: { user }, error: authError } = authResult;
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  // Parse body
  const {
    defense_session_id,
    style       = 'modern',
    orientation = 'portrait',
  } = req.body || {};

  const validStyles       = ['modern', 'prestige', 'dark'];
  const validOrientations = ['portrait', 'landscape'];
  const safeStyle       = validStyles.includes(style)       ? style       : 'modern';
  const safeOrientation = validOrientations.includes(orientation) ? orientation : 'portrait';

  if (!defense_session_id) return res.status(400).json({ error: 'defense_session_id required' });

  // Fetch the defense session — ownership check enforced here (service_role bypasses RLS,
  // so we manually filter by user_id to prevent cross-user access)
  const { data: session, error: sessionError } = await supabaseAdmin
    .from('defense_sessions')
    .select('id, user_id, total_score, status, project_id')
    .eq('id',      defense_session_id)
    .eq('user_id', user.id)
    .maybeSingle();

  if (sessionError || !session) {
    return res.status(403).json({ error: 'Defense session not found or access denied' });
  }

  if (session.status !== 'completed') {
    return res.status(422).json({ error: 'Defense session is not yet complete' });
  }

  const sessionScore = session.total_score ?? 0;
  if (sessionScore < SCORE_THRESHOLD) {
    return res.status(422).json({
      error: `Score ${sessionScore}/10 does not meet the ${SCORE_THRESHOLD}/10 minimum required for a certificate`,
    });
  }

  // Record that a certificate was requested for this session (fire-and-forget)
  supabaseAdmin
    .from('defense_sessions')
    .update({ certificate_requested_at: new Date().toISOString() })
    .eq('id', defense_session_id)
    .then()
    .catch(err => console.warn('[certificate] certificate_requested_at update failed:', err.message));

  // Idempotency: return the same certificate if this session was already processed
  const { data: existing } = await supabaseAdmin
    .from('defense_certificates')
    .select('*')
    .eq('defense_session_id', defense_session_id)
    .maybeSingle();

  let cert = existing;

  // Fetch profile once — needed for both new and re-downloaded certs.
  // users table is the source of truth for profile data.
  const { data: userProfile } = await supabaseAdmin
    .from('users')
    .select('full_name, faculty, department')
    .eq('id', user.id)
    .maybeSingle();

  if (!cert) {
    const fullName = userProfile?.full_name || user.user_metadata?.full_name || '';
    if (!fullName) {
      return res.status(422).json({
        error:   'NAME_REQUIRED',
        message: 'Please set your full name in your profile before downloading your certificate.',
      });
    }

    // Fetch project title for the certificate body
    const { data: project } = await supabaseAdmin
      .from('projects')
      .select('title')
      .eq('id',      session.project_id)
      .eq('user_id', user.id)
      .maybeSingle();

    const topicTitle = (project?.title || '').trim() || 'Final Year Research Project';

    // INSERT — the trg_cert_number trigger auto-generates certificate_number from sequence
    const { data: newCert, error: insertError } = await supabaseAdmin
      .from('defense_certificates')
      .insert({
        user_id:            user.id,
        defense_session_id: defense_session_id,
        score:              sessionScore,
        topic_title:        topicTitle,
        recipient_name:     fullName,
        faculty:            userProfile?.faculty    || null,
        department:         userProfile?.department || null,
      })
      .select()
      .single();

    if (insertError || !newCert) {
      console.error('[certificate] insert failed:', insertError?.message);
      return res.status(500).json({ error: 'Failed to create certificate record' });
    }

    cert = newCert;
    sendTelegramAlert(`🏆 Certificate issued: ${escapeTgHtml(fullName)} (${escapeTgHtml(user.email)}) scored ${sessionScore}/10\n<code>${escapeTgHtml(newCert.certificate_number)}</code>`).catch(() => null);

    // Notify user — best-effort
    supabaseAdmin
      .from('notifications')
      .insert({
        user_id:  user.id,
        type:     'certificate_unlocked',
        title:    'Defense certificate unlocked',
        message:  `You scored ${sessionScore}/10 — ${newCert.certificate_number} is ready.`,
        metadata: { certificate_number: newCert.certificate_number, score: sessionScore },
      })
      .catch(e => console.error('[certificate] notification insert failed:', e.message));
  }

  // Generate PDF (stateless — no storage, generated fresh every download).
  // Precedence: users table (source of truth) → auth metadata → stored recipient_name.
  const currentName = userProfile?.full_name || user.user_metadata?.full_name || cert.recipient_name;
  await ensureFonts();
  try {
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

    res.setHeader('Content-Type',        'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FYPro-Certificate-${cert.certificate_number}.pdf"`);
    res.setHeader('Cache-Control',       'private, no-store');
    return res.end(pdfBuffer);
  } catch (err) {
    console.error('[certificate] PDF generation failed:', err.message);
    sendTelegramAlert(`🔴 Certificate PDF failed for user:${user?.email || 'unknown'} (cert exists, download broken) — ${err.message}`).catch(() => null);
    return res.status(500).json({ error: 'PDF generation failed. Please try again.' });
  }
}
