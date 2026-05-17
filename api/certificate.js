// Defense Certificate endpoint
// POST /api/certificate — generates or re-fetches a PDF certificate for a
// completed defense session that scored >= 7/10.
//
// Security guarantees:
//   1. Score is read from defense_sessions.total_score — never from the request body.
//   2. defense_certificates INSERT is service_role only (RLS).
//   3. Cross-user access blocked: .eq('user_id', user.id) on every DB fetch.

import { supabaseAdmin } from './_lib/supabase-admin.js';
import { sendTelegramAlert } from './_lib/telegram.js';
import { setCorsHeaders } from './_lib/cors.js';
import { jsPDF } from 'jspdf';
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

function buildCertificatePDF({ recipientName, faculty, department, topicTitle, score, certNumber, issuedAt }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W  = 210;
  const H  = 297;
  const cx = W / 2;

  registerFonts(doc);

  const headingFont = dmSerifBase64 ? 'DMSerifDisplay' : 'times';
  const bodyFont    = poppinsBase64 ? 'Poppins'        : 'helvetica';

  // ── Top accent bar (8mm) ────────────────────────────────────────────────────
  doc.setFillColor(0, 102, 255);
  doc.rect(0, 0, W, 8, 'F');

  // ── Logo / wordmark ─────────────────────────────────────────────────────────
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', cx - 20, 14, 40, 14);
    } catch {
      drawWordmark(doc, cx, headingFont, 26);
    }
  } else {
    drawWordmark(doc, cx, headingFont, 26);
  }

  // ── Heading strip background ────────────────────────────────────────────────
  doc.setFillColor(239, 246, 255);
  doc.rect(0, 34, W, 24, 'F');

  // ── Main heading ────────────────────────────────────────────────────────────
  doc.setFont(headingFont, 'normal');
  doc.setFontSize(17);
  doc.setTextColor(13, 27, 42);
  doc.text('CERTIFICATE OF DEFENSE READINESS', cx, 50, { align: 'center' });

  // ── Decorative rule with end dots ───────────────────────────────────────────
  const lineX1 = cx - 52;
  const lineX2 = cx + 52;
  const lineY  = 57;
  doc.setDrawColor(0, 102, 255);
  doc.setLineWidth(0.8);
  doc.line(lineX1, lineY, lineX2, lineY);
  doc.setFillColor(0, 102, 255);
  doc.circle(lineX1, lineY, 1, 'F');
  doc.circle(lineX2, lineY, 1, 'F');

  // ── "This certifies that" ───────────────────────────────────────────────────
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text('This certifies that', cx, 72, { align: 'center' });

  // ── Recipient name ──────────────────────────────────────────────────────────
  doc.setFont(headingFont, 'normal');
  doc.setFontSize(22);
  doc.setTextColor(13, 27, 42);
  const displayName = recipientName.length > 48
    ? recipientName.slice(0, 47) + '…'
    : recipientName;
  doc.text(displayName, cx, 85, { align: 'center' });

  // ── Faculty & department (muted, below name) ────────────────────────────────
  if (faculty || department) {
    doc.setFont(bodyFont, 'normal');
    doc.setFontSize(9.5);
    doc.setTextColor(107, 114, 128);
    const affiliation = [faculty, department].filter(Boolean).join(' · ');
    doc.text(affiliation, cx, 93, { align: 'center' });
  }

  // ── "has demonstrated..." ───────────────────────────────────────────────────
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text('has demonstrated defence readiness for', cx, 101, { align: 'center' });

  // ── Topic title (wraps to multiple lines) ───────────────────────────────────
  doc.setFont(headingFont, 'normal');
  doc.setFontSize(14);
  doc.setTextColor(13, 27, 42);
  const maxTopicWidth  = 150;
  const topicLines     = doc.splitTextToSize(topicTitle, maxTopicWidth);
  const topicStartY    = 114;
  const topicLineHeight = 7;
  doc.text(topicLines, cx, topicStartY, { align: 'center' });
  const topicEndY = topicStartY + (topicLines.length - 1) * topicLineHeight;

  // ── Horizontal divider ──────────────────────────────────────────────────────
  const ruleY = topicEndY + 14;
  doc.setDrawColor(229, 231, 235);
  doc.setLineWidth(0.3);
  doc.line(40, ruleY, W - 40, ruleY);

  // ── Score line ──────────────────────────────────────────────────────────────
  const scoreY = ruleY + 14;
  const scoreNum = Number(score);
  doc.setFont('courier', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(0, 102, 255);
  doc.text(
    `FYPro Defense Simulator Score: ${Number.isInteger(scoreNum) ? scoreNum : scoreNum.toFixed(1)}/10`,
    cx,
    scoreY,
    { align: 'center' },
  );

  // ── Issue date ──────────────────────────────────────────────────────────────
  const dateStr = new Date(issuedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`Issued on ${dateStr}`, cx, scoreY + 12, { align: 'center' });

  // ── Tagline ─────────────────────────────────────────────────────────────────
  doc.setFont(bodyFont, 'normal');
  doc.setFontSize(9);
  doc.setTextColor(156, 163, 175);
  doc.text('"The supervisor you never had."', cx, scoreY + 22, { align: 'center' });

  // ── Footer rule ─────────────────────────────────────────────────────────────
  const footerRuleY = H - 28;
  doc.setDrawColor(0, 102, 255);
  doc.setLineWidth(0.4);
  doc.line(25, footerRuleY, W - 25, footerRuleY);

  // Verify URL — left-aligned
  const footerTextY = footerRuleY + 8;
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  doc.setTextColor(0, 102, 255);
  doc.text(`fypro.com.ng/verify/${certNumber}`, 25, footerTextY);

  // Certificate number — right-aligned
  doc.setFont('courier', 'bold');
  doc.setFontSize(8.5);
  doc.setTextColor(107, 114, 128);
  doc.text(certNumber, W - 25, footerTextY, { align: 'right' });

  // ── Bottom accent bar (8mm) ──────────────────────────────────────────────────
  doc.setFillColor(0, 102, 255);
  doc.rect(0, H - 8, W, 8, 'F');

  return Buffer.from(doc.output('arraybuffer'));
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

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token' });

  // Parse body
  const { defense_session_id } = req.body || {};
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

  // Fetch faculty/department once — needed for both new and re-downloaded certs
  const { data: userProfile } = await supabaseAdmin
    .from('users')
    .select('faculty, department')
    .eq('id', user.id)
    .maybeSingle();

  if (!cert) {
    // Full name is stored in auth user metadata by the profile page
    // (supabase.auth.updateUser({ data: { full_name } }))
    const fullName = user.user_metadata?.full_name || '';
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
    sendTelegramAlert(`🏆 Certificate issued: ${fullName} (${user.email}) scored ${sessionScore}/10\n<code>${newCert.certificate_number}</code>`).catch(() => null);
  }

  // Generate PDF (stateless — no storage, generated fresh every download)
  await ensureFonts();
  try {
    const pdfBuffer = buildCertificatePDF({
      recipientName: cert.recipient_name,
      faculty:       cert.faculty       || userProfile?.faculty    || '',
      department:    cert.department    || userProfile?.department || '',
      topicTitle:    cert.topic_title,
      score:         cert.score,
      certNumber:    cert.certificate_number,
      issuedAt:      cert.issued_at,
    });

    res.setHeader('Content-Type',        'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="FYPro-Certificate-${cert.certificate_number}.pdf"`);
    res.setHeader('Cache-Control',       'private, no-store');
    return res.end(pdfBuffer);
  } catch (err) {
    console.error('[certificate] PDF generation failed:', err.message);
    return res.status(500).json({ error: 'PDF generation failed. Please try again.' });
  }
}
