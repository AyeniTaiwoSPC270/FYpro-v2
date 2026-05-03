// FYPro — Literature Map endpoint
// Fetches 20 real papers, augments Claude's system prompt with them,
// instructs Claude to cluster ONLY those papers into thematic groups,
// then injects the papers array into the JSON response.

import { rateLimitCheck }            from './_lib/rate-limit.js';
import { checkDailyCap, trackUsage } from './_lib/usage-tracker.js';
import { getCached, setCached, buildCacheKey } from './_lib/cache.js';
import { fetchPapersForLitMap }      from './_lib/papers.js';

const CLAUDE_TTL = 86400; // 24h

const handler = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

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

    // Build Claude cache key from base system + user prompt (before paper injection)
    const userContent = messages?.find(m => m.role === 'user')?.content ?? '';
    const userPrompt  = typeof userContent === 'string' ? userContent : JSON.stringify(userContent);
    const claudeKey   = buildCacheKey('literature-map', system ?? '', userPrompt);

    const claudeCached = await getCached(claudeKey);
    if (claudeCached) {
      console.log('[literature-map] Claude cache HIT');
      res.setHeader('X-Cache', 'HIT');
      return res.status(200).json(claudeCached);
    }

    // Fetch real papers (20)
    const papersResult = await fetchPapersForLitMap(topic.trim());
    console.log(`[literature-map] papers | count:${papersResult.papers.length} | status:${papersResult.status} | sparse:${papersResult.sparse_literature} | papers_cache:${papersResult.cache_hit}`);

    // If sparse, drop papers with no abstract — clustering depends on abstract content
    let papers = papersResult.papers;
    if (papersResult.sparse_literature) {
      papers = papers.filter(p => p.abstract != null && p.abstract.length > 0);
    }

    // Cannot cluster without papers — return descriptive error
    if (papers.length === 0) {
      return res.status(422).json({
        error:   'no_papers_found',
        message: "We couldn't find papers for this topic. Try broadening it (remove geographic specifics like 'in Nigeria') or check the spelling.",
      });
    }

    // Build numbered paper list for Claude's system prompt
    const papersList = papers
      .map((p, i) => {
        const firstAuthor = p.authors?.[0] || 'Unknown';
        const citations   = typeof p.citationCount === 'number' ? ` Citations: ${p.citationCount}.` : '';
        const abstract    = p.abstract ? ` Abstract: ${p.abstract}` : '';
        return `${i + 1}. "${p.title}" (${p.year || 'n.d.'}). Authors: ${firstAuthor}.${citations}${abstract}`;
      })
      .join('\n');

    let augmentedSystem = (system ?? '') +
      `\n\nReal papers in this area:\n${papersList}\n\n` +
      `Cluster these real papers into 4–6 themes. Use ONLY the papers provided. ` +
      `Do NOT invent papers or add citations not in this list. ` +
      `Each theme should contain the paper numbers (1-based indices) that belong to it — ` +
      `include a "paper_indices" array of integers in each thematic_area object.`;

    if (papersResult.sparse_literature) {
      augmentedSystem += '\nNote: limited published work was found — acknowledge this as a potential research gap in the synthesis_guide.';
    }

    // Call Anthropic
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method:  'POST',
      headers: {
        'Content-Type':      'application/json',
        'x-api-key':         apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model:       'claude-sonnet-4-6',
        max_tokens,
        system:      augmentedSystem,
        messages,
        temperature: 0,
      }),
    });

    const data = await response.json();
    console.log('[literature-map] Anthropic status:', response.status);

    if (data.usage) {
      trackUsage(data.usage.input_tokens, data.usage.output_tokens, 'claude-sonnet-4-6');
    }

    // Inject papers + metadata into the Claude JSON so frontend receives them
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
        console.warn('[literature-map] Could not inject papers into Claude response — returning map only');
      }
    }

    res.setHeader('X-Cache', 'MISS');
    if (response.ok) {
      setCached(claudeKey, data, CLAUDE_TTL);
    }

    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[literature-map] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

export default handler;
