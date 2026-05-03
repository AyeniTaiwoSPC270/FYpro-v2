// FYPro — Vercel Serverless Function
// Proxies requests to Anthropic API. The API key never touches the browser.

import { rateLimitCheck } from './_lib/rate-limit.js';
import { checkDailyCap, trackUsage } from './_lib/usage-tracker.js';
import { getCached, setCached, buildCacheKey } from './_lib/cache.js';

const TTL_BY_STEP = {
  'topic-validator':     86400,
  'chapter-architect':   86400,
  'methodology-advisor': 43200,
  'writing-planner':     21600,
};

const handler = async (req, res) => {
  // Log every incoming request so Vercel's function logs show exactly what arrived.
  // This is the first thing we do — before any early returns — so the log fires even
  // when the function bails out early (e.g. wrong method, missing API key).
  console.log('[claude] incoming request — method:', req.method, '| body:', JSON.stringify(req.body));

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const rl = await rateLimitCheck(req, { userDay: 30, ipDay: 60, prefix: 'claude' });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

  const cap = await checkDailyCap();
  if (!cap.allowed) {
    return res.status(503).json({ error: 'FYPro is at capacity for today. Please try again tomorrow.' });
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[claude] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  // Everything from here — including body access — is inside try/catch so that any
  // unexpected shape (undefined body, missing fields) produces a logged 500 rather
  // than a silent crash.
  try {
    // Guard with || {} so destructuring never throws if body-parsing produced undefined
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
      console.log('[claude] cache HIT for step:', prefix);
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25'
      },
      body: JSON.stringify({ model, max_tokens, system, messages, temperature: 0 })
    });

    const data = await response.json();
    console.log('[claude] Anthropic responded with status:', response.status);
    if (data.usage) {
      trackUsage(data.usage.input_tokens, data.usage.output_tokens, model);
    }

    res.setHeader('X-Cache', 'MISS');
    if (response.ok) {
      setCached(cacheKey, data, ttl); // fire and forget — do not await
    }
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[claude] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// Attach the Vercel API config to the handler function before exporting.
// bodyParser: true  — parse JSON / form bodies automatically (this is the default,
//                     but being explicit prevents surprises if defaults ever change).
// sizeLimit: '1mb' — prompts are large strings; the default 1 mb is sufficient.


export default handler;
