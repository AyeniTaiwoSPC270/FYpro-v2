// api/sentry-webhook.js
// Receives Sentry webhook events, verifies HMAC-SHA256, writes to system_logs.
// bodyParser must be disabled so Vercel passes raw bytes for signature verification.
export const config = { api: { bodyParser: false } };

import crypto from 'crypto';
import { writeSystemLog } from './_lib/system-log.js';

function readRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', chunk => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function mapSeverity(level) {
  if (level === 'fatal' || level === 'error') return 'error';
  if (level === 'warning')                    return 'warning';
  return 'info';
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rawBody = await readRawBody(req);
  const secret  = process.env.SENTRY_WEBHOOK_SECRET;

  if (!secret) {
    console.error('[sentry-webhook] SENTRY_WEBHOOK_SECRET is not set — rejecting request');
    return res.status(500).json({ error: 'Webhook secret not configured on server.' });
  }

  const sig      = req.headers['sentry-hook-signature'] || '';
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  if (sig !== expected) {
    console.error('[sentry-webhook] invalid signature');
    return res.status(400).json({ error: 'Invalid signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const event       = payload?.data?.event || {};
  const level       = event.level || 'info';
  const title       = String(event.title || 'Unknown Sentry event').slice(0, 200);
  const tags        = Array.isArray(event.tags) ? event.tags : [];
  const featureTag  = tags.find(([k]) => k === 'feature');
  const feature     = featureTag ? featureTag[1] : 'Unknown';

  await writeSystemLog({
    severity:      mapSeverity(level),
    feature,
    source:        'sentry',
    plain_message: title,
    raw_detail:    payload,
  });

  return res.status(200).json({ ok: true });
}
