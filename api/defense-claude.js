// Defense Simulator proxy — requires valid Supabase JWT with defense_pack entitlement.
// Server-side enforcement: frontend gating alone is not enough.

import { supabaseAdmin } from './_lib/supabase-admin.js';
import { rateLimitCheck } from './_lib/rate-limit.js';

const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = await rateLimitCheck(req, { userDay: 20, ipDay: 40, prefix: 'defense' });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

  // 1. Extract JWT from Authorization header
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;

  if (!token) {
    return res.status(401).json({ error: 'No authentication token provided.' });
  }

  // 2. Verify JWT — supabaseAdmin.auth.getUser validates the signature server-side
  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) {
    return res.status(401).json({ error: 'Invalid or expired authentication token.' });
  }

  // 3. Check user_entitlements — service_role bypasses RLS so this is authoritative
  const { data: entitlements, error: entError } = await supabaseAdmin
    .from('user_entitlements')
    .select('paid_features')
    .eq('user_id', user.id)
    .single();

  if (entError || !entitlements) {
    return res.status(403).json({ error: 'Feature not unlocked.' });
  }

  const paidFeatures = Array.isArray(entitlements.paid_features)
    ? entitlements.paid_features
    : [];

  if (!paidFeatures.includes('defense_pack')) {
    return res.status(403).json({ error: 'Feature not unlocked. Please purchase the Defense Pack.' });
  }

  // 4. Proxy to Anthropic — identical to /api/claude from here
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[defense-claude] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  try {
    const {
      system,
      messages,
      max_tokens = 2000,
      model = 'claude-sonnet-4-6',
    } = req.body || {};

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
    console.log('[defense-claude] Anthropic responded with status:', response.status);
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[defense-claude] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

export default handler;
