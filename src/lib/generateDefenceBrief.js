// Generates a Defence Brief PDF using jsPDF.
// Called from DefenceBrief.jsx after the brief is generated.
// Returns a jsPDF instance (caller calls .save() to download).

import { jsPDF } from 'jspdf';

const PAGE_W    = 210; // A4 mm
const MARGIN    = 20;
const CONTENT_W = PAGE_W - MARGIN * 2;
const LINE_H    = 7;   // mm between lines

// jsPDF's built-in fonts (Helvetica etc.) only support WinAnsiEncoding — a
// subset of Latin-1. Characters outside that range (Greek letters, Unicode
// minus, subscript digits, ṁ, etc.) render as garbage or cause silent
// truncation. We substitute them with readable ASCII equivalents before any
// text reaches jsPDF. Applied to all variable content; constant strings that
// are already ASCII are unaffected.
function sanitizeForPdf(text) {
  if (text === null || text === undefined) return '';
  const s = String(text);

  return s
    // ── Dashes and minus variants → hyphen-minus ─────────────────────────
    .replace(/[‐‑‒–—―−]/g, '-')
    // ── Smart / typographic quotes → straight ASCII ───────────────────────
    .replace(/[‘’ʼ]/g, "'")
    .replace(/[“”„‟]/g, '"')
    // ── Ellipsis ──────────────────────────────────────────────────────────
    .replace(/…/g, '...')
    // ── Non-breaking and thin spaces → regular space ──────────────────────
    .replace(/[     ]/g, ' ')
    // ── Subscript digits 0-9 → plain digit (e.g. SO₂ → SO2) ─────────────
    .replace(/[₀-₉]/g, (c) => String(c.codePointAt(0) - 0x2080))
    // ── Superscript digits → ^digit ───────────────────────────────────────
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/¹/g, '^1')
    .replace(/[⁰⁴-⁹]/g, (c) =>
      ({ '⁰': '0', '⁴': '4', '⁵': '5', '⁶': '6', '⁷': '7', '⁸': '8', '⁹': '9' }[c] ?? c)
    )
    // ── Common Greek lowercase letters ────────────────────────────────────
    .replace(/α/g, 'alpha')
    .replace(/β/g, 'beta')
    .replace(/γ/g, 'gamma')
    .replace(/δ/g, 'delta')
    .replace(/ε/g, 'epsilon')
    .replace(/ζ/g, 'zeta')
    .replace(/η/g, 'eta')
    .replace(/θ/g, 'theta')
    .replace(/κ/g, 'kappa')
    .replace(/λ/g, 'lambda')
    .replace(/μ/g, 'mu')
    .replace(/ν/g, 'nu')
    .replace(/ξ/g, 'xi')
    .replace(/π/g, 'pi')
    .replace(/ρ/g, 'rho')
    .replace(/σ/g, 'sigma')
    .replace(/τ/g, 'tau')
    .replace(/φ/g, 'phi')
    .replace(/χ/g, 'chi')
    .replace(/ψ/g, 'psi')
    .replace(/ω/g, 'omega')
    // ── Common Greek uppercase letters ────────────────────────────────────
    .replace(/Α/g, 'Alpha')
    .replace(/Γ/g, 'Gamma')
    .replace(/Δ/g, 'Delta')
    .replace(/Θ/g, 'Theta')
    .replace(/Λ/g, 'Lambda')
    .replace(/Π/g, 'Pi')
    .replace(/Σ/g, 'Sigma')
    .replace(/Ω/g, 'Omega')
    // ── Micro sign (U+00B5) — distinct code point from Greek mu ───────────
    .replace(/µ/g, 'mu')
    // ── Latin letters with combining dots (ṁ, ṡ, ṫ, etc.) → base letter ──
    .replace(/ṁ/g, 'm')   // ṁ  m-dot (mass flow rate)
    .replace(/ṗ/g, 'p')   // ṗ
    .replace(/ṡ/g, 's')   // ṡ
    .replace(/ṣ/g, 's')   // ṣ
    .replace(/ṫ/g, 't')   // ṫ
    .replace(/ẇ/g, 'w')   // ẇ
    // ── Mathematical operators ────────────────────────────────────────────
    .replace(/±/g, '+/-')
    .replace(/×/g, 'x')
    .replace(/÷/g, '/')
    .replace(/∞/g, 'infinity')
    .replace(/≈/g, '~=')
    .replace(/≠/g, '!=')
    .replace(/≤/g, '<=')
    .replace(/≥/g, '>=')
    .replace(/⁄/g, '/')    // fraction slash
    .replace(/∂/g, 'd')    // partial derivative ∂
    .replace(/∫/g, 'integral')
    .replace(/√/g, 'sqrt')
    // ── Degree and temperature ────────────────────────────────────────────
    .replace(/°/g, ' deg')
    // ── Bullet and dingbats → hyphen ─────────────────────────────────────
    .replace(/[•‣․‥⁃⁌⁍]/g, '-')
    // ── Any remaining non-ASCII → stripped (last resort) ─────────────────
    .replace(/[^\x20-\x7E\n\r\t]/g, '');
}

function addWrappedText(doc, text, x, y, maxWidth, lineHeight = LINE_H) {
  const lines = doc.splitTextToSize(sanitizeForPdf(text), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

function addSectionHeading(doc, label, y, color = [13, 27, 42]) {
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(9);
  doc.setTextColor(...color);
  doc.text(label.toUpperCase(), MARGIN, y);
  doc.setDrawColor(...color);
  doc.setLineWidth(0.3);
  doc.line(MARGIN, y + 1.5, PAGE_W - MARGIN, y + 1.5);
  return y + 8;
}

function checkPageBreak(doc, y, needed = 20) {
  if (y + needed > 277) {
    doc.addPage();
    return MARGIN + 10;
  }
  return y;
}

export function generateDefenceBrief(brief, topic) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });

  // ── Header ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.setTextColor(13, 27, 42);
  doc.text('DEFENCE BRIEF', MARGIN, 28);

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(80, 100, 120);
  const topicLine  = sanitizeForPdf(topic || 'Your Project');
  const topicLines = doc.splitTextToSize(topicLine, CONTENT_W);
  doc.text(topicLines, MARGIN, 36);

  doc.setFontSize(8);
  doc.setTextColor(160, 170, 180);
  doc.text(
    `Generated by FYPro · ${new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
    MARGIN,
    36 + topicLines.length * 5 + 2
  );

  // divider
  doc.setDrawColor(0, 102, 255);
  doc.setLineWidth(0.5);
  doc.line(MARGIN, 44, PAGE_W - MARGIN, 44);

  let y = 54;

  // ── Opening Statement ─────────────────────────────────────────────────────
  y = addSectionHeading(doc, 'Opening Statement', y, [0, 102, 255]);
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(10);
  doc.setTextColor(40, 60, 80);
  y = addWrappedText(doc, brief.openingStatement || '', MARGIN, y, CONTENT_W);
  y += 8;

  // ── Weak Spots ────────────────────────────────────────────────────────────
  y = checkPageBreak(doc, y, 30);
  y = addSectionHeading(doc, 'Weak Spots & Model Answers', y, [220, 38, 38]);

  for (const ws of (brief.weakSpots || [])) {
    y = checkPageBreak(doc, y, 30);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    const severityColor = ws.severity === 'Critical' ? [220, 38, 38]
      : ws.severity === 'Serious' ? [217, 119, 6]
      : [99, 102, 241];
    doc.setTextColor(...severityColor);
    doc.text(`[${sanitizeForPdf(ws.severity || '').toUpperCase()}]`, MARGIN, y);

    doc.setTextColor(13, 27, 42);
    doc.setFontSize(10);
    doc.text(sanitizeForPdf(ws.title || ''), MARGIN + 22, y);
    y += 5;

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9);
    doc.setTextColor(100, 120, 140);
    y = addWrappedText(doc, `"${ws.examiner_question || ''}"`, MARGIN + 3, y, CONTENT_W - 3, 5.5);
    y += 2;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8);
    doc.setTextColor(22, 163, 74);
    doc.text('MODEL ANSWER', MARGIN + 3, y);
    y += 5;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(30, 50, 70);
    y = addWrappedText(doc, ws.studentAnswer || ws.model_answer || '', MARGIN + 3, y, CONTENT_W - 3);
    y += 8;
  }

  // ── Examiner Q&As ─────────────────────────────────────────────────────────
  y = checkPageBreak(doc, y, 30);
  y = addSectionHeading(doc, 'Likely Examiner Questions', y, [217, 119, 6]);

  for (const qa of (brief.examinerQas || [])) {
    y = checkPageBreak(doc, y, 22);

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(217, 119, 6);
    doc.text(`Q${qa.number}`, MARGIN, y);

    doc.setFont('helvetica', 'italic');
    doc.setFontSize(9.5);
    doc.setTextColor(13, 27, 42);
    y = addWrappedText(doc, qa.question || '', MARGIN + 10, y, CONTENT_W - 10, 5.5);
    y += 2;

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(60, 80, 100);
    y = addWrappedText(doc, qa.answer || '', MARGIN + 10, y, CONTENT_W - 10, 5.5);
    y += 7;
  }

  // ── Footer ────────────────────────────────────────────────────────────────
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.setTextColor(180, 190, 200);
    doc.text(`FYPro Defence Brief · fypro.com.ng · Page ${i} of ${pageCount}`, MARGIN, 290);
  }

  return doc;
}
