// FYPro — Shared paper-fetch module
// Primary: Semantic Scholar → Fallback: OpenAlex → Last resort: Crossref

import { createHash } from 'crypto';
import { getCached, setCached } from './cache.js';

const TTL_VALIDATOR = 7 * 24 * 3600;  // 7 days
const TTL_LITMAP    = 3 * 24 * 3600;  // 3 days

// ── Public API ────────────────────────────────────────────────────────────────

export async function fetchPapersForValidation(topic) {
  return fetchWithCache(topic, 5, 'validator', TTL_VALIDATOR);
}

export async function fetchPapersForLitMap(topic) {
  return fetchWithCache(topic, 20, 'litmap', TTL_LITMAP);
}

// ── Cache layer ───────────────────────────────────────────────────────────────

async function fetchWithCache(topic, count, feature, ttl) {
  const normalized = normalizeTopic(topic);
  if (!normalized || normalized.length < 5) {
    return { papers: [], status: 'no_papers_found', sparse_literature: false, cache_hit: false };
  }

  const hash     = createHash('sha256').update(normalized).digest('hex');
  const cacheKey = `papers:${feature}:${hash}`;

  const cached = await getCached(cacheKey);
  if (cached) {
    console.log(`[papers] cache HIT | feature:${feature} | normalized:"${normalized.slice(0, 60)}"`);
    return { ...cached, cache_hit: true };
  }

  const result = await fetchPapers(topic, normalized, count);
  console.log(`[papers] cache MISS | feature:${feature} | source:${result.papers[0]?.source || 'none'} | count:${result.papers.length} | sparse:${result.sparse_literature}`);

  if (result.papers.length > 0) {
    setCached(cacheKey, result, ttl); // fire and forget
  }

  return { ...result, cache_hit: false };
}

// ── Core fallback chain ───────────────────────────────────────────────────────

async function fetchPapers(rawTopic, normalizedTopic, count) {
  const outbound = sanitizeOutbound(rawTopic);
  if (!outbound) {
    return { papers: [], status: 'no_papers_found', sparse_literature: false };
  }

  // Primary: Semantic Scholar with full topic
  let papers = await trySemanticScholar(outbound, count);

  // Broadened query: strip geographic modifiers and retry SS
  if (papers.length < 3) {
    const broadened = sanitizeOutbound(normalizedTopic);
    if (broadened && broadened !== outbound) {
      const extra = await trySemanticScholar(broadened, count);
      papers = dedupe([...papers, ...extra]);
    }
  }

  // Fallback: OpenAlex
  if (papers.length < 3) {
    const oaPapers = await tryOpenAlex(outbound, count);
    papers = dedupe([...papers, ...oaPapers]);
  }

  // Last resort: Crossref (metadata only)
  if (papers.length < 3) {
    const crPapers = await tryCrossref(outbound, count);
    papers = dedupe([...papers, ...crPapers]);
  }

  const final  = papers.slice(0, count);
  const sparse = final.length < 3;
  const allMetadataOnly = final.length > 0 && final.every(p => !p.abstract && p.source === 'crossref');
  const status = final.length === 0 ? 'no_papers_found'
               : allMetadataOnly ? 'metadata_only'
               : 'ok';

  return { papers: final, status, sparse_literature: sparse };
}

// ── Semantic Scholar ──────────────────────────────────────────────────────────

async function trySemanticScholar(topic, count) {
  const fields = 'title,abstract,authors,year,externalIds,citationCount,tldr';
  const url    = `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(topic)}&limit=${count}&fields=${fields}`;
  const hdrs   = { 'User-Agent': 'FYPro/2.0 (mailto:hello@fypro.app)' };

  try {
    let res = await fetch(url, { headers: hdrs, signal: AbortSignal.timeout(8000) });

    // 429: wait 1s and retry once before falling through
    if (res.status === 429) {
      await new Promise(r => setTimeout(r, 1000));
      res = await fetch(url, { headers: hdrs, signal: AbortSignal.timeout(8000) });
      if (res.status === 429) {
        console.warn('[papers] Semantic Scholar 429 (x2) — falling through');
        return [];
      }
    }
    if (!res.ok) return [];

    const json = await res.json();
    // Validate shape before using
    if (!json.data || !Array.isArray(json.data)) return [];

    return json.data
      .filter(p => p && typeof p.title === 'string')
      .map(p => ({
        title:         sanitizeString(p.title, 300),
        authors:       (p.authors || []).map(a => sanitizeString(a.name, 100)).filter(Boolean),
        year:          typeof p.year === 'number' ? p.year : null,
        abstract:      sanitizeString(p.abstract || p.tldr?.text || null, 1000),
        doi:           p.externalIds?.DOI || null,
        url:           sanitizeUrl(`https://www.semanticscholar.org/paper/${p.paperId}`),
        citationCount: typeof p.citationCount === 'number' ? p.citationCount : 0,
        source:        'semantic_scholar',
      }))
      .filter(p => p.title);
  } catch {
    return [];
  }
}

// ── OpenAlex ──────────────────────────────────────────────────────────────────

async function tryOpenAlex(topic, count) {
  const url = `https://api.openalex.org/works?search=${encodeURIComponent(topic)}&per_page=${count}&mailto=hello@fypro.app`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FYPro/2.0 (mailto:hello@fypro.app)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const json = await res.json();
    if (!json.results || !Array.isArray(json.results)) return [];

    return json.results
      .filter(w => w && typeof w.title === 'string')
      .map(w => {
        const doi = w.doi ? w.doi.replace('https://doi.org/', '') : null;
        return {
          title:         sanitizeString(w.title, 300),
          authors:       (w.authorships || []).map(a => sanitizeString(a.author?.display_name, 100)).filter(Boolean),
          year:          typeof w.publication_year === 'number' ? w.publication_year : null,
          abstract:      sanitizeString(reconstructAbstract(w.abstract_inverted_index), 1000),
          doi,
          url:           sanitizeUrl(w.primary_location?.landing_page_url || null),
          citationCount: typeof w.cited_by_count === 'number' ? w.cited_by_count : 0,
          source:        'openalex',
        };
      })
      .filter(p => p.title);
  } catch {
    return [];
  }
}

// ── Crossref ──────────────────────────────────────────────────────────────────

async function tryCrossref(topic, count) {
  const url = `https://api.crossref.org/works?query=${encodeURIComponent(topic)}&rows=${count}`;

  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'FYPro/2.0 (mailto:hello@fypro.app)' },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];

    const json = await res.json();
    const items = json.message?.items;
    if (!Array.isArray(items)) return [];

    return items
      .filter(item => item && typeof item.title?.[0] === 'string')
      .map(item => {
        const year = item.published?.['date-parts']?.[0]?.[0] ?? null;
        const authors = (item.author || [])
          .map(a => [a.given, a.family].filter(Boolean).join(' '))
          .filter(Boolean);
        return {
          title:         sanitizeString(item.title[0], 300),
          authors:       authors.map(a => sanitizeString(a, 100)).filter(Boolean),
          year:          typeof year === 'number' ? year : null,
          abstract:      null,
          doi:           item.DOI || null,
          url:           sanitizeUrl(item.URL || null),
          citationCount: 0,
          source:        'crossref',
        };
      })
      .filter(p => p.title);
  } catch {
    return [];
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function normalizeTopic(topic) {
  if (!topic || typeof topic !== 'string') return '';
  return topic
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .replace(/(\s)-|-(\s)/g, ' ')
    // Remove study-framing prefixes common in Nigerian FYP titles
    .replace(/\b(an?\s+)?(study|analysis|investigation|examination|assessment|evaluation)\s+(of|into|on)\s+/gi, '')
    .replace(/\bimpact\s+of\s+/gi, '')
    .replace(/^(a |an |the )/i, '')
    // Remove geographic modifiers
    .replace(/\s+in\s+(nigeria|lagos|abuja|kano|ibadan|kaduna|enugu|port harcourt|ogun|oyo|osun|ekiti|imo|delta|rivers|anambra|borno|bauchi|sokoto|kebbi|zamfara|niger|kogi|kwara|benue|plateau|nasarawa|taraba|gombe|yobe|adamawa|akwa ibom)(\s+state)?\b.*/gi, '')
    .replace(/\s+in\s+\w+\s+state\b.*/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function sanitizeOutbound(topic) {
  if (!topic || typeof topic !== 'string') return '';
  const cleaned = topic
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .trim()
    .slice(0, 500);
  return cleaned.length >= 5 ? cleaned : '';
}

function sanitizeString(value, maxLen) {
  if (value == null) return null;
  const str = String(value)
    .replace(/<[^>]*>/g, '')
    .replace(/[\x00-\x1F\x7F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLen);
  return str.length >= 1 ? str : null;
}

function sanitizeUrl(url) {
  if (!url || typeof url !== 'string') return null;
  const trimmed = url.trim();
  return trimmed.startsWith('https://') ? trimmed : null;
}

function reconstructAbstract(invertedIndex) {
  if (!invertedIndex || typeof invertedIndex !== 'object') return null;
  const words = [];
  for (const [word, positions] of Object.entries(invertedIndex)) {
    if (!Array.isArray(positions)) continue;
    for (const pos of positions) {
      if (typeof pos === 'number') words[pos] = word;
    }
  }
  const text = words.filter(Boolean).join(' ').trim();
  return text.length >= 10 ? text : null;
}

function dedupe(papers) {
  const seenDois   = new Set();
  const seenTitles = new Set();

  return papers.filter(p => {
    const doi = p.doi ? `doi:${p.doi.toLowerCase().trim()}` : null;
    if (doi) {
      if (seenDois.has(doi)) return false;
      seenDois.add(doi);
    }
    const titleKey = (p.title || '').toLowerCase().replace(/\s+/g, ' ').trim();
    if (seenTitles.has(titleKey)) return false;
    seenTitles.add(titleKey);
    return true;
  });
}
