// Project Reviewer proxy — requires valid Supabase JWT with defense_pack entitlement.
// Server-side enforcement: frontend gating alone is not enough.

import { supabaseAdmin } from './_lib/supabase-admin.js';
import { rateLimitCheck } from './_lib/rate-limit.js';
import { checkDailyCap, trackUsage } from './_lib/usage-tracker.js';
import { writeSystemLog } from './_lib/system-log.js';
import { setCorsHeaders } from './_lib/cors.js';

const handler = async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = await rateLimitCheck(req, { userDay: 10, ipDay: 100, prefix: 'reviewer' });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

  // 1. Extract JWT from Authorization header
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided.' });
  }

  // 2. Verify JWT
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }

  // 3. Check user_entitlements
  const { data: entitlements, error: entError } = await supabaseAdmin
    .from('user_entitlements')
    .select('paid_features')
    .eq('user_id', user.id)
    .maybeSingle();

  if (entError) {
    console.error('[project-reviewer] entitlements query error:', entError.message);
    return res.status(500).json({ error: 'Failed to verify entitlements. Please try again.' });
  }

  const paidFeatures = Array.isArray(entitlements?.paid_features)
    ? entitlements.paid_features
    : [];

  if (!paidFeatures.includes('defense_pack')) {
    return res.status(403).json({ error: 'Feature not unlocked. Please purchase the Defense Pack.' });
  }

  // 4. Check daily spend cap before proxying
  const cap = await checkDailyCap();
  if (!cap.allowed) {
    return res.status(503).json({ error: 'FYPro is at capacity for today. Please try again tomorrow.' });
  }

  // 5. Proxy to Anthropic
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[project-reviewer] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  try {
    const {
      system,
      messages,
      max_tokens = 2000,
      model = 'claude-sonnet-4-6',
    } = req.body || {};

    // Server-side file validation: find the PDF source block (if any) and check
    // magic bytes + size. The frontend encodes PDFs as base64 and embeds them in
    // the messages array as { type:'document', source:{ type:'base64', data:'...' } }.
    if (Array.isArray(messages)) {
      for (const msg of messages) {
        const content = Array.isArray(msg.content) ? msg.content : [];
        for (const block of content) {
          if (block?.type === 'document' && block?.source?.type === 'base64') {
            const b64 = block.source.data || '';
            // 10 MB decoded → ~13.3 MB base64 chars
            const MAX_B64_CHARS = 14_000_000;
            if (b64.length > MAX_B64_CHARS) {
              return res.status(400).json({ error: 'File too large. Maximum size is 10 MB.' });
            }
            // Magic-byte check: first 4 bytes of a PDF must be %PDF (25 50 44 46)
            const headerBytes = Buffer.from(b64.slice(0, 8), 'base64');
            if (headerBytes.slice(0, 4).toString('ascii') !== '%PDF') {
              return res.status(400).json({ error: 'Invalid file type. Only PDF files are accepted.' });
            }
          }
        }
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25',
      },
      body: JSON.stringify({ model, max_tokens, system, messages, temperature: 0 }),
    });

    const data = await response.json();
    console.log('[project-reviewer] Anthropic responded with status:', response.status);
    if (data.usage) {
      trackUsage(data.usage.input_tokens, data.usage.output_tokens, model);
    }

    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[project-reviewer] error:', err.message);
    writeSystemLog({
      severity: 'error',
      feature: 'Project Reviewer',
      source: 'ai',
      plain_message: 'A project review failed — PDF may be too large or AI timed out',
      raw_detail: { error: err.message, userId: user.id },
    });
    return res.status(500).json({ error: 'An unexpected error occurred. Please try again.' });
  }
};

export default handler;
