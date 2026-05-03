// FYPro — Topic Validator endpoint
// Fetches real papers, augments the Claude system prompt with them,
// then calls Anthropic and injects the papers array into the JSON response.

import { rateLimitCheck }          from './_lib/rate-limit.js';
import { checkDailyCap, trackUsage } from './_lib/usage-tracker.js';
import { getCached, setCached, buildCacheKey } from './_lib/cache.js';
import { fetchPapersForValidation } from './_lib/papers.js';

const CLAUDE_TTL = 86400; // 24h

const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const rl = await rateLimitCheck(req, { userDay: 10, ipDay: 30, prefix: 'topic-validator' });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

  const cap = await checkDailyCap();
  if (!cap.allowed) return res.status(503).json({ error: 'FYPro is at capacity for today. Please try again tomorrow.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server.' });

  try {
    const { system, messages, max_tokens = 2000, topic } = req.body || {};

    if (!topic || typeof topic !== 'string' || topic.trim().length < 5) {
      return res.status(400).json({ error: 'Topic must be at least 5 characters.' });
    }

    // Build Claude cache key from the base system + user prompt (before paper injection)
    const userContent = messages?.find(m => m.role === 'user')?.content ?? '';
    const userPrompt  = typeof userContent === 'string' ? userContent : JSON.stringify(userContent);
    const claudeKey   = buildCacheKey('topic-validator', system ?? '', userPrompt);

    const claudeCached = await getCached(claudeKey);
    if (claudeCached) {
      console.log('[topic-validator] Claude cache HIT');
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(claudeCached);
    }

    // Fetch real papers
    const papersResult = await fetchPapersForValidation(topic.trim());
    console.log(`[topic-validator] papers | count:${papersResult.papers.length} | status:${papersResult.status} | papers_cache:${papersResult.cache_hit}`);

    // Augment system prompt
    let augmentedSystem = system ?? '';
    if (papersResult.papers.length > 0) {
      const papersList = papersResult.papers
        .map((p, i) => {
          const authors   = p.authors.slice(0, 3).join(', ') || 'Unknown';
          const abstract  = p.abstract ? ` Abstract: ${p.abstract}.` : '';
          return `${i + 1}. "${p.title}" (${p.year || 'n.d.'}). Authors: ${authors}.${abstract}`;
        })
        .join('\n');

      augmentedSystem += `\n\nReal papers in this area:\n${papersList}\n\nUse these to inform your validation. DO NOT invent papers.`;

      if (papersResult.sparse_literature) {
        augmentedSystem += '\nSparse literature flag is active — do not penalize the topic for low paper count. Frame it as "limited prior work, which can strengthen originality but increases methodology risk."';
      }
      if (papersResult.status === 'metadata_only') {
        augmentedSystem += '\nOnly paper titles and authors are available — no abstracts. Validate based on topic construction and what the titles reveal.';
      }
    } else {
      augmentedSystem += '\n\nNo real papers were found for this topic. Validate the topic based on its construction and feasibility alone. Mention to the student that we could not find directly related published work — this may be a research gap or may indicate the topic needs reframing.';
    }

    // Call Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':    'application/json',
        'x-api-key':       apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:      'claude-sonnet-4-6',
        max_tokens,
        system:     augmentedSystem,
        messages,
        temperature: 0,
      }),
    });

    const data = await response.json();
    console.log('[topic-validator] Anthropic status:', response.status);

    if (data.usage) {
      trackUsage(data.usage.input_tokens, data.usage.output_tokens, 'claude-sonnet-4-6');
    }

    // Inject papers into Claude's text so the frontend gets them as part of the parsed result
    if (response.ok && data.content?.[0]?.text) {
      try {
        const raw     = data.content[0].text;
        const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        const match   = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          const verdict = JSON.parse(match[0]);
          verdict.papers             = papersResult.papers;
          verdict.papers_status      = papersResult.status;
          verdict.sparse_literature  = papersResult.sparse_literature;
          data.content[0].text       = JSON.stringify(verdict);
        }
      } catch {
        console.warn('[topic-validator] Could not inject papers into Claude response — returning verdict only');
      }
    }

    res.setHeader('X-Cache', 'MISS');
    if (response.ok) {
      setCached(claudeKey, data, CLAUDE_TTL);
    }

    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[topic-validator] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

export default handler;
