// FYPro — Supervisor Meeting Prep endpoint
// Generates 8 specific, actionable questions for a student's next supervisor meeting.

import { rateLimitCheck }             from './_lib/rate-limit.js';
import { checkDailyCap, trackUsage }  from './_lib/usage-tracker.js';
import { getCached, setCached, buildCacheKey } from './_lib/cache.js';

const SUPERVISOR_PREP_TTL = 21600; // 6 hours

const SYSTEM = `You are a final year project advisor at a Nigerian university.
A student is preparing for a supervisor meeting.
Based on their project stage, last supervisor feedback, and current blockers,
generate 8 specific questions they should ask their supervisor in their next meeting.
Questions must be concrete and actionable — not generic.
Format: return ONLY a JSON array of 8 strings. No preamble. No markdown.`;

const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const rl = await rateLimitCheck(req, { userDay: 5, ipDay: 15, prefix: 'supervisor-prep' });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

  const cap = await checkDailyCap();
  if (!cap.allowed) return res.status(503).json({ error: 'FYPro is at capacity for today. Please try again tomorrow.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server.' });

  try {
    const { stage, lastFeedback, stuckOn } = req.body || {};

    if (!stage || typeof stage !== 'string' || !stage.trim()) {
      return res.status(400).json({ error: 'Project stage is required.' });
    }

    const userPrompt = `Stage: ${stage.trim()}. Last feedback: ${lastFeedback || 'none'}. Stuck on: ${stuckOn || 'nothing specific'}.`;
    const cacheKey   = buildCacheKey('supervisor-prep', SYSTEM, userPrompt);

    const cached = await getCached(cacheKey);
    if (cached) {
      console.log('[supervisor-prep] cache HIT');
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(cached);
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:       'claude-sonnet-4-6',
        max_tokens:  1000,
        system:      SYSTEM,
        messages:    [{ role: 'user', content: userPrompt }],
        temperature: 0,
      }),
    });

    const data = await response.json();
    console.log('[supervisor-prep] Anthropic status:', response.status);

    if (data.usage) {
      trackUsage(data.usage.input_tokens, data.usage.output_tokens, 'claude-sonnet-4-6');
    }

    if (!response.ok) {
      return res.status(response.status).json({ error: data.error?.message || 'Anthropic error' });
    }

    const text = data.content?.[0]?.text ?? '';
    let questions;
    try {
      const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
      const match   = cleaned.match(/\[[\s\S]*\]/);
      questions     = JSON.parse(match ? match[0] : cleaned);
      if (!Array.isArray(questions)) throw new Error('Not an array');
    } catch {
      console.error('[supervisor-prep] parse error — raw text:', text.slice(0, 200));
      return res.status(500).json({ error: 'Failed to parse response. Please try again.' });
    }

    const result = { questions };
    res.setHeader('X-Cache', 'MISS');
    setCached(cacheKey, result, SUPERVISOR_PREP_TTL);

    return res.status(200).json(result);
  } catch (err) {
    console.error('[supervisor-prep] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

export default handler;
