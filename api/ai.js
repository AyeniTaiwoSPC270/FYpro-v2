// FYPro — AI proxy
// ?action=defense → Defense Simulator (JWT + defense_pack required, no cache)
// default         → General Claude proxy (cached, no auth required)

import { rateLimitCheck, extractUserId } from './_lib/rate-limit.js';
import { checkDailyCap, trackUsage }     from './_lib/usage-tracker.js';
import { getCached, setCached, buildCacheKey } from './_lib/cache.js';
import { supabaseAdmin }  from './_lib/supabase-admin.js';
import { writeSystemLog } from './_lib/system-log.js';

const TTL_BY_STEP = {
  'topic-validator':     86400,
  'chapter-architect':   86400,
  'methodology-advisor': 43200,
  'writing-planner':     21600,
};

async function handleGeneral(req, res) {
  console.log('[ai/general] incoming — method:', req.method, '| body:', JSON.stringify(req.body));

  const rl = await rateLimitCheck(req, { userDay: 30, ipDay: 60, prefix: 'claude' });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

  const cap = await checkDailyCap();
  if (!cap.allowed) return res.status(503).json({ error: 'FYPro is at capacity for today. Please try again tomorrow.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[ai/general] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  try {
    const {
      system,
      messages,
      max_tokens = 2000,
      model = 'claude-sonnet-4-6',
      step,
    } = req.body || {};

    const prefix      = step || 'general';
    const userContent = messages?.find(m => m.role === 'user')?.content ?? '';
    const userPrompt  = typeof userContent === 'string' ? userContent : JSON.stringify(userContent);
    const cacheKey    = buildCacheKey(prefix, system ?? '', userPrompt);
    const ttl         = TTL_BY_STEP[prefix] ?? 21600;

    const cached = await getCached(cacheKey);
    if (cached) {
      console.log('[ai/general] cache HIT for step:', prefix);
      const userId = extractUserId(req);
      try {
        const result = await supabaseAdmin.from('response_times').insert({ feature: prefix, duration_ms: 0, user_id: userId });
        console.log('[ai/general] response_times insert (cache-hit):', JSON.stringify(result));
      } catch (err) {
        console.error('[ai/general] response_times insert failed (cache-hit):', err.message);
      }
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    const start    = Date.now();
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'pdfs-2024-09-25',
      },
      body: JSON.stringify({ model, max_tokens, system, messages, temperature: 0 }),
    });

    const data = await response.json();
    console.log('[ai/general] Anthropic status:', response.status);
    if (data.usage) trackUsage(data.usage.input_tokens, data.usage.output_tokens, model);

    if (response.ok) {
      const duration = Date.now() - start;
      const userId   = extractUserId(req);
      try {
        const result = await supabaseAdmin.from('response_times').insert({ feature: prefix, duration_ms: duration, user_id: userId });
        console.log('[ai/general] response_times insert:', JSON.stringify(result));
      } catch (err) {
        console.error('[ai/general] response_times insert failed:', err.message);
      }
      setCached(cacheKey, data, ttl);
    }

    res.setHeader('X-Cache', 'MISS');
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[ai/general] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleDefense(req, res) {
  const rl = await rateLimitCheck(req, { userDay: 20, ipDay: 40, prefix: 'defense' });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'No authentication token provided.' });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired authentication token.' });

  const { data: entitlements, error: entError } = await supabaseAdmin
    .from('user_entitlements')
    .select('paid_features')
    .eq('user_id', user.id)
    .single();

  if (entError || !entitlements) return res.status(403).json({ error: 'Feature not unlocked.' });

  const paidFeatures = Array.isArray(entitlements.paid_features) ? entitlements.paid_features : [];
  if (!paidFeatures.includes('defense_pack')) {
    return res.status(403).json({ error: 'Feature not unlocked. Please purchase the Defense Pack.' });
  }

  const cap = await checkDailyCap();
  if (!cap.allowed) return res.status(503).json({ error: 'FYPro is at capacity for today. Please try again tomorrow.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[ai/defense] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  try {
    const {
      system,
      messages,
      max_tokens = 2000,
      model = 'claude-sonnet-4-6',
      answerWordCount,
    } = req.body || {};

    if (answerWordCount !== undefined && answerWordCount > 300) {
      return res.status(400).json({ error: 'Input too long. Please shorten your text to continue.' });
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta':    'pdfs-2024-09-25',
      },
      body: JSON.stringify({ model, max_tokens, system, messages, temperature: 0 }),
    });

    const data = await response.json();
    console.log('[ai/defense] Anthropic status:', response.status);
    if (data.usage) trackUsage(data.usage.input_tokens, data.usage.output_tokens, model);
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[ai/defense] error:', err.message);
    writeSystemLog({
      severity:      'error',
      feature:       'Defense Simulator',
      source:        'ai',
      plain_message: 'A defense session failed — the AI did not respond in time or hit the token limit',
      raw_detail:    { error: err.message, userId: user.id },
    });
    return res.status(500).json({ error: err.message });
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (req.query.action === 'defense') return handleDefense(req, res);
  return handleGeneral(req, res);
}
