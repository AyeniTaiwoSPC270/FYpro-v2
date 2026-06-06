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

function drawModern(doc, W, H, data)   { /* implemented in next task */ }
function drawPrestige(doc, W, H, data) { /* implemented in Task 4 */ }
function drawDark(doc, W, H, data)     { /* implemented in Task 5 */ }

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
