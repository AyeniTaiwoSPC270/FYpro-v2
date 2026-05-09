// Defense Certificate endpoint
// POST /api/certificate — generates or re-fetches a PDF certificate for a
// completed defense session that scored >= 7/10.
//
// Security guarantees:
//   1. Score is read from defense_sessions.total_score — never from the request body.
//   2. defense_certificates INSERT is service_role only (RLS).
//   3. Cross-user access blocked: .eq('user_id', user.id) on every DB fetch.
//   4. Rate limited: 20 downloads per user per day.

import { supabaseAdmin } from './_lib/supabase-admin.js';
import { rateLimitCheck } from './_lib/rate-limit.js';
import { jsPDF } from 'jspdf';
import fs from 'fs';
import path from 'path';

const SCORE_THRESHOLD = 7;

// Load logo once at cold start — graceful fallback to text wordmark if absent
let logoBase64 = null;
try {
  const bytes = fs.readFileSync(path.join(process.cwd(), 'public', 'fypro-logo.png'));
  logoBase64 = `data:image/png;base64,${bytes.toString('base64')}`;
} catch {
  // Logo not accessible from serverless context — PDF uses "FYPro" text instead
}

// ── PDF builder ───────────────────────────────────────────────────────────────

function buildCertificatePDF({ recipientName, topicTitle, score, certNumber, issuedAt }) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const W  = 210;
  const H  = 297;
  const cx = W / 2;

  // ── Top accent bar ──────────────────────────────────────────────────────────
  doc.setFillColor(0, 102, 255);
  doc.rect(0, 0, W, 4, 'F');

  // ── Logo / wordmark ─────────────────────────────────────────────────────────
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, 'PNG', cx - 20, 10, 40, 14);
    } catch {
      drawWordmark(doc, cx, 22);
    }
  } else {
    drawWordmark(doc, cx, 22);
  }

  // ── Heading strip background ────────────────────────────────────────────────
  doc.setFillColor(239, 246, 255);
  doc.rect(0, 30, W, 24, 'F');

  // ── Main heading ────────────────────────────────────────────────────────────
  doc.setFont('times', 'bold');
  doc.setFontSize(17);
  doc.setTextColor(13, 27, 42);
  doc.text('CERTIFICATE OF DEFENSE READINESS', cx, 46, { align: 'center' });

  // ── Decorative rule with end dots ───────────────────────────────────────────
  const lineX1 = cx - 52;
  const lineX2 = cx + 52;
  const lineY  = 53;
  doc.setDrawColor(0, 102, 255);
  doc.setLineWidth(0.8);
  doc.line(lineX1, lineY, lineX2, lineY);
  doc.setFillColor(0, 102, 255);
  doc.circle(lineX1, lineY, 1, 'F');
  doc.circle(lineX2, lineY, 1, 'F');

  // ── "This certifies that" ───────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text('This certifies that', cx, 68, { align: 'center' });

  // ── Recipient name ──────────────────────────────────────────────────────────
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(13, 27, 42);
  // Truncate very long names gracefully
  const displayName = recipientName.length > 48
    ? recipientName.slice(0, 47) + '…'
    : recipientName;
  doc.text(displayName, cx, 81, { align: 'center' });

  // ── "has demonstrated..." ───────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic');
  doc.setFontSize(11);
  doc.setTextColor(107, 114, 128);
  doc.text('has demonstrated defence readiness for', cx, 94, { align: 'center' });

  // ── Topic title (wraps to multiple lines) ───────────────────────────────────
  doc.setFont('times', 'italic');
  doc.setFontSize(14);
  doc.setTextColor(13, 27, 42);
  const maxTopicWidth  = 150;
  const topicLines     = doc.splitTextToSize(topicTitle, maxTopicWidth);
  const topicStartY    = 107;
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
  doc.setTextColor(22, 163, 74);
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
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  doc.setTextColor(107, 114, 128);
  doc.text(`Issued on ${dateStr}`, cx, scoreY + 12, { align: 'center' });

  // ── Tagline ─────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'italic');
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

  // ── Bottom accent bar ────────────────────────────────────────────────────────
  doc.setFillColor(0, 102, 255);
  doc.rect(0, H - 4, W, 4, 'F');

  return Buffer.from(doc.output('arraybuffer'));
}

function drawWordmark(doc, cx, y) {
  doc.setFont('times', 'bold');
  doc.setFontSize(22);
  doc.setTextColor(13, 27, 42);
  doc.text('FYPro', cx, y, { align: 'center' });
}

// ── Handler ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // Rate limit: 20 certificate downloads per user per day
  const rl = await rateLimitCheck(req, { userDay: 20, ipDay: 60, prefix: 'certificate' });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

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

  // Idempotency: return the same certificate if this session was already processed
  const { data: existing } = await supabaseAdmin
    .from('defense_certificates')
    .select('*')
    .eq('defense_session_id', defense_session_id)
    .maybeSingle();

  let cert = existing;

  if (!cert) {
    // Fetch full name — must be set before a certificate can be issued
    const { data: profile } = await supabaseAdmin
      .from('users')
      .select('full_name')
      .eq('id', user.id)
      .maybeSingle();

    if (!profile?.full_name) {
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
        recipient_name:     profile.full_name,
      })
      .select()
      .single();

    if (insertError || !newCert) {
      console.error('[certificate] insert failed:', insertError?.message);
      return res.status(500).json({ error: 'Failed to create certificate record' });
    }

    cert = newCert;
  }

  // Generate PDF (stateless — no storage, generated fresh every download)
  try {
    const pdfBuffer = buildCertificatePDF({
      recipientName: cert.recipient_name,
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
