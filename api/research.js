// FYPro — Research proxy
// ?action=validate → Topic Validator (5 papers, augments system prompt)
// ?action=lit-map  → Literature Map  (20 papers, clusters into themes)

import { rateLimitCheck }                 from './_lib/rate-limit.js';
import { setCorsHeaders }                 from './_lib/cors.js';
import { checkDailyCap, trackUsage }      from './_lib/usage-tracker.js';
import { getCached, setCached, buildCacheKey } from './_lib/cache.js';
import { fetchPapersForValidation, fetchPapersForLitMap } from './_lib/papers.js';
import { supabaseAdmin }                  from './_lib/supabase-admin.js';

const CLAUDE_TTL = 86400; // 24h

async function handleValidate(req, res) {
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
    const topicWordCount = topic.trim() === '' ? 0 : topic.trim().split(/\s+/).length;
    if (topicWordCount > 500) {
      return res.status(400).json({ error: 'Input too long. Please shorten your text to continue.' });
    }

    const userContent = messages?.find(m => m.role === 'user')?.content ?? '';
    const userPrompt  = typeof userContent === 'string' ? userContent : JSON.stringify(userContent);
    const claudeKey   = buildCacheKey('topic-validator', system ?? '', userPrompt);

    const claudeCached = await getCached(claudeKey);
    if (claudeCached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(claudeCached);
    }

    const papersResult = await fetchPapersForValidation(topic.trim());

    let augmentedSystem = system ?? '';
    if (papersResult.papers.length > 0) {
      const papersList = papersResult.papers
        .map((p, i) => {
          const authors  = p.authors.slice(0, 3).join(', ') || 'Unknown';
          const abstract = p.abstract ? ` Abstract: ${p.abstract}.` : '';
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

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens, system: augmentedSystem, messages, temperature: 0 }),
    });

    const data = await response.json();
    if (data.usage) trackUsage(data.usage.input_tokens, data.usage.output_tokens, 'claude-sonnet-4-6');

    if (response.ok && data.content?.[0]?.text) {
      try {
        const raw     = data.content[0].text;
        const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        const match   = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          const verdict = JSON.parse(match[0]);
          verdict.papers            = papersResult.papers;
          verdict.papers_status     = papersResult.status;
          verdict.sparse_literature = papersResult.sparse_literature;
          data.content[0].text      = JSON.stringify(verdict);
        }
      } catch {
        console.warn('[research/validate] Could not inject papers into Claude response — returning verdict only');
      }
    }

    res.setHeader('X-Cache', 'MISS');
    if (response.ok) setCached(claudeKey, data, CLAUDE_TTL);
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[research/validate] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleLitMap(req, res) {
  const rl = await rateLimitCheck(req, { userDay: 20, ipDay: 60, prefix: 'literature-map' });
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

  const cap = await checkDailyCap();
  if (!cap.allowed) return res.status(503).json({ error: 'FYPro is at capacity for today. Please try again tomorrow.' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return res.status(500).json({ error: 'API key not configured on server.' });

  try {
    const { system, messages, max_tokens = 3000, topic } = req.body || {};

    if (!topic || typeof topic !== 'string' || topic.trim().length < 5) {
      return res.status(400).json({ error: 'Topic must be at least 5 characters.' });
    }

    const userContent = messages?.find(m => m.role === 'user')?.content ?? '';
    const userPrompt  = typeof userContent === 'string' ? userContent : JSON.stringify(userContent);
    const claudeKey   = buildCacheKey('literature-map', system ?? '', userPrompt);

    const claudeCached = await getCached(claudeKey);
    if (claudeCached) {
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(claudeCached);
    }

    const papersResult = await fetchPapersForLitMap(topic.trim());

    let papers = papersResult.papers;
    if (papersResult.sparse_literature) {
      papers = papers.filter(p => p.abstract != null && p.abstract.length > 0);
    }

    if (papers.length === 0) {
      return res.status(422).json({
        error:   'no_papers_found',
        message: "We couldn't find papers for this topic. Try broadening it (remove geographic specifics like 'in Nigeria') or check the spelling.",
      });
    }

    const papersList = papers
      .map((p, i) => {
        const firstAuthor = p.authors?.[0] || 'Unknown';
        const citations   = typeof p.citationCount === 'number' ? ` Citations: ${p.citationCount}.` : '';
        const abstract    = p.abstract ? ` Abstract: ${p.abstract}` : '';
        return `${i + 1}. "${p.title}" (${p.year || 'n.d.'}). Authors: ${firstAuthor}.${citations}${abstract}`;
      })
      .join('\n');

    const augmentedSystem = (system ?? '') +
      `\n\nReal papers in this area:\n${papersList}\n\n` +
      `Cluster these real papers into 4–6 themes. Use ONLY the papers provided. ` +
      `Do NOT invent papers or add citations not in this list. ` +
      `Each theme should contain the paper numbers (1-based indices) that belong to it — ` +
      `include a "paper_indices" array of integers in each thematic_area object.` +
      (papersResult.sparse_literature ? '\nNote: limited published work was found — acknowledge this as a potential research gap in the synthesis_guide.' : '');

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({ model: 'claude-sonnet-4-6', max_tokens, system: augmentedSystem, messages, temperature: 0 }),
    });

    const data = await response.json();
    if (data.usage) trackUsage(data.usage.input_tokens, data.usage.output_tokens, 'claude-sonnet-4-6');

    if (response.ok && data.content?.[0]?.text) {
      try {
        const raw     = data.content[0].text;
        const cleaned = raw.replace(/```json/gi, '').replace(/```/g, '').trim();
        const match   = cleaned.match(/\{[\s\S]*\}/);
        if (match) {
          const litMap = JSON.parse(match[0]);
          litMap.papers            = papers;
          litMap.papers_status     = papersResult.status;
          litMap.sparse_literature = papersResult.sparse_literature;
          data.content[0].text     = JSON.stringify(litMap);
        }
      } catch {
        console.warn('[research/lit-map] Could not inject papers into Claude response — returning map only');
      }
    }

    res.setHeader('X-Cache', 'MISS');
    if (response.ok) setCached(claudeKey, data, CLAUDE_TTL);
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[research/lit-map] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
}

async function handleUserCount(req, res) {
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3600');
  try {
    const { count, error } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true });
    if (error) throw error;
    return res.status(200).json({ count: count ?? 0 });
  } catch (err) {
    console.error('[research/user-count]', err.message);
    return res.status(200).json({ count: 0 });
  }
}

export default async function handler(req, res) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') return res.status(200).end();

  const { action } = req.query;

  if (action === 'user-count') return handleUserCount(req, res);

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  if (action === 'validate') return handleValidate(req, res);
  if (action === 'lit-map')  return handleLitMap(req, res);
  return res.status(400).json({ error: 'Unknown action. Use ?action=validate, ?action=lit-map, or ?action=user-count' });
}
