# FYPro — Papers Architecture

**Purpose:** This document is the single source of truth for how FYPro fetches real academic papers from Semantic Scholar, OpenAlex, and Crossref. It powers two features:

1. **Topic Validator** — fetches 5 real papers to validate topic feasibility before Claude judges it.
2. **Literature Map** — fetches 20 real papers, then asks Claude to cluster them into 4–6 themes.

Claude Code reads this file before touching `/api/topic-validator` (Day 33) and `/api/literature-map` (Day 34). Do not modify those routes without first updating this document.

---

## 1. Which API for Which Use Case

FYPro uses three APIs in a **primary → fallback → enrichment** pattern, not a "pick one" pattern. Each API is good at something different.

### Semantic Scholar — PRIMARY for both features

**Why it's the default:**
- Returns full **abstracts** alongside titles and author lists. No other free API gives abstracts at this quality.
- Built specifically for academic paper search — relevance ranking is tuned for research queries, not general web search.
- Returns `tldr` field (one-sentence AI summary) on many papers — useful for Literature Map clustering when abstracts are long.
- Supports a clean `/paper/search` endpoint with `limit`, `fields`, and `year` parameters.
- Returns `citationCount` — which Claude can use to weight which papers to take seriously.

**Use it for:**
- Topic Validator: top 5 papers by relevance, with abstracts.
- Literature Map: top 20 papers by relevance, with abstracts + citation counts.

**Endpoint:** `https://api.semanticscholar.org/graph/v1/paper/search`

### OpenAlex — FALLBACK when Semantic Scholar fails or returns < 3 papers

**Why it's the fallback, not the primary:**
- Larger raw corpus than Semantic Scholar (~250M works vs ~200M) — better coverage for obscure or local research.
- Returns abstracts as an inverted index (word → positions), which means we have to reconstruct the abstract text ourselves. Annoying but doable.
- Relevance ranking is decent but not as tuned for student-style queries as Semantic Scholar.
- More generous rate limits than Semantic Scholar's unauthenticated tier.

**Use it for:**
- Any time Semantic Scholar returns fewer than 3 papers (likely Nigerian / niche topics).
- Any time Semantic Scholar returns a 429 or 5xx.
- Backup when Semantic Scholar is down (their service has occasional outages).

**Endpoint:** `https://api.openalex.org/works`

### Crossref — ENRICHMENT and last-resort fallback

**Why it's third, not first:**
- Crossref does NOT return abstracts in most responses (publishers don't supply them). You get titles, authors, DOIs, journal names — but no abstract text.
- For Topic Validator and Literature Map, abstracts are the whole point. Without them, Claude can't judge feasibility or cluster themes.
- However, Crossref has the **most complete metadata** for verifying a paper actually exists and is citeable.

**Use it for:**
- DOI verification when Claude wants to check a paper is real (later feature, not v2).
- Last-resort fallback if both Semantic Scholar AND OpenAlex fail. In that case, return titles + authors + journal + year only, and let Claude validate the topic without abstracts. Mark the response with `"abstract_quality": "metadata_only"` so the frontend can display a less-confident verdict.

**Endpoint:** `https://api.crossref.org/works`

---

## 2. Fallback Strategy

The order is: **Semantic Scholar → OpenAlex → Crossref → graceful failure.**

### Trigger conditions

| Condition | Action |
|---|---|
| Semantic Scholar returns 200 with ≥ 3 papers | Use it. Done. |
| Semantic Scholar returns 200 with < 3 papers | Try OpenAlex. Merge results, dedupe by DOI. |
| Semantic Scholar returns 429 (rate limited) | Wait 1s, retry once. If still 429, fall through to OpenAlex. |
| Semantic Scholar returns 5xx or times out (>8s) | Fall through to OpenAlex immediately. No retry. |
| OpenAlex also returns < 3 papers | Try Crossref for metadata-only results. |
| All three fail or return zero papers | Return `{ papers: [], status: "no_papers_found", reason: "..." }`. Frontend shows "We couldn't find papers for this topic — Claude will validate based on the topic itself." |

### Why no retry on 5xx

Retries on 5xx multiply latency. For Topic Validator the user is waiting on a loading spinner. Better to fall through to the next API in 200ms than to retry Semantic Scholar twice and add 4 seconds. The user sees real papers either way.

### Deduplication

When merging results from two APIs, dedupe by:
1. **DOI exact match** (preferred)
2. **Normalized title match** (lowercase, strip punctuation, strip stopwords like "the", "a", "of")

Always prefer the Semantic Scholar version of a paper when both APIs return it (better abstract quality).

### Pseudo-code (for reference, not literal implementation)

```
async function fetchPapers(topic, count) {
  let papers = []

  papers = await trySemanticScholar(topic, count)
  if (papers.length >= 3) return papers

  const openAlexPapers = await tryOpenAlex(topic, count)
  papers = dedupe([...papers, ...openAlexPapers])
  if (papers.length >= 3) return papers

  const crossrefPapers = await tryCrossref(topic, count)
  papers = dedupe([...papers, ...crossrefPapers])
  if (papers.length > 0) return { papers, abstract_quality: "metadata_only" }

  return { papers: [], status: "no_papers_found" }
}
```

---

## 3. Caching Strategy (Upstash Redis)

Real-paper fetches are the **most expensive operation in FYPro** — not in money (the APIs are free) but in latency. A Topic Validator run with no cache takes 3–6 seconds just for the paper fetch, before Claude even starts thinking. Caching is mandatory.

### What to cache

Cache the **result of the entire fallback chain**, not individual API responses. The cache key is the normalized topic, not the raw topic.

### Cache key

```
papers:{feature}:{normalized_topic_hash}
```

Where:
- `feature` is `validator` (5 papers) or `litmap` (20 papers) — different counts, different cache entries.
- `normalized_topic_hash` is SHA-256 of the topic after normalization.

### Topic normalization (before hashing)

This is important. Two students will phrase the same topic differently. Normalization catches more cache hits.

1. Lowercase.
2. Strip punctuation except hyphens inside words.
3. Collapse whitespace.
4. Remove leading articles ("a", "an", "the").
5. Remove trailing words like "in Nigeria", "a study of", "an analysis of" — these are common student framings that don't change which papers are relevant.

Example:
- `"An Analysis of the Effect of Annealing on Tensile Strength of Mild Steel in Nigeria"` 
- → `"effect of annealing on tensile strength of mild steel"`
- → SHA-256 hash → cache key.

### TTL (time to live)

| Feature | TTL | Reasoning |
|---|---|---|
| Topic Validator papers (5) | **7 days** | New papers come out daily but for student topic validation, week-old results are fine. Aggressive cache. |
| Literature Map papers (20) | **3 days** | Students using Literature Map are deeper in research and more likely to want fresh results. Tighter cache. |

### Cache size discipline

20 papers with abstracts can be 20–40KB JSON. With Upstash free tier (256MB), that's enough for ~6,000 cached topics — comfortable for v2 launch volume.

### Cache invalidation

No manual invalidation needed. TTL handles it. Don't build admin tooling to flush specific topics — not worth it at this scale.

### What NOT to cache

- Do not cache failed responses (`papers: []`). The next user might get a different result if the API recovers.
- Do not cache the Claude clustering output for Literature Map — that depends on the specific papers and Claude's response is already cached separately by the Day 31 caching layer. Caching twice wastes Redis space.

---

## 4. Rate Limits

| API | Unauthenticated limit | Authenticated limit | Notes |
|---|---|---|---|
| Semantic Scholar | **100 requests / 5 minutes per IP** (~20/min) | 1 request/second with API key (so ~60/min) | The hard ceiling. Cache aggressively to stay under it. |
| OpenAlex | **10 requests/second per IP** | Same, but "polite pool" with email gives priority during outages | Most generous. Always include `mailto=hello@fypro.app` in requests for polite pool access. |
| Crossref | **50 requests/second** (unofficial, polite use expected) | Same, with `User-Agent: FYPro/2.0 (mailto:hello@fypro.app)` for polite pool | Easy to stay under. |

### What this means for FYPro

- Without caching, 20 students using Topic Validator in 5 minutes would exhaust Semantic Scholar's unauthenticated limit. **Caching is non-optional.**
- With the 7-day cache and OpenAlex fallback, FYPro can comfortably serve 500+ daily Topic Validator uses without hitting any limit.
- Per-IP rate limiting on the Vercel serverless function (Day 29) protects against a single abusive user burning through the quota for everyone.

### Server-side rate limit handling

If Semantic Scholar returns 429:
1. Read the `Retry-After` header if present.
2. Do NOT retry — fall through to OpenAlex.
3. Log the 429 to Vercel logs so we can see if it's becoming a pattern.

---

## 5. API Keys

| API | Key required? | Recommendation |
|---|---|---|
| Semantic Scholar | No, but recommended | **Skip the key for v2.** Apply only if rate limits become a real problem after launch. The application form is at https://www.semanticscholar.org/product/api#api-key-form. Approval can take weeks. |
| OpenAlex | No | Just include `mailto=hello@fypro.app` in the query string for polite pool access. No application needed. |
| Crossref | No | Include `User-Agent: FYPro/2.0 (mailto:hello@fypro.app)` in headers for polite pool. No application needed. |

**Decision: ship v2 with zero API keys.** All three APIs work without keys at the volume FYPro needs in months 1–3. Revisit only if Semantic Scholar 429s become frequent (>5% of requests).

If a Semantic Scholar key is added later, store it in Vercel environment variable `SEMANTIC_SCHOLAR_API_KEY`. Never commit to repo. Send as `x-api-key` header.

---

## 6. Edge Cases

### Edge case 1: Nigerian / African topics with sparse literature

This is the most important edge case for FYPro. A topic like *"impact of NYSC on rural development in Akwa Ibom State"* will return 0–2 papers from Semantic Scholar.

**Strategy:**
1. Try the full topic on Semantic Scholar first.
2. If < 3 results, **broaden the query** by stripping geographic modifiers ("in Nigeria", "in Lagos", "in [State] State") and retry.
3. If still < 3 results, fall through to OpenAlex (which often has better African coverage via partnerships with regional aggregators).
4. If still < 3 results, return what we have and add a flag: `"sparse_literature": true`.
5. The Topic Validator system prompt includes: *"If `sparse_literature` is true, do not penalize the topic for low paper count — instead, frame it as 'limited prior work, which can strengthen originality but increases methodology risk.'"*

This is a feature, not a failure. Sparse literature is a real signal Nigerian students need.

### Edge case 2: Topic too vague

Topic: *"machine learning"*. Semantic Scholar returns 10,000 results. The top 5 by relevance may be canonical ML papers totally unsuited to a student project.

**Strategy:** Don't try to fix this in the paper layer. Topic Validator's Claude prompt already catches "too broad" topics and gives the student a verdict before they care about papers. Just return what Semantic Scholar gives — Claude's verdict will tell the student to narrow down anyway.

### Edge case 3: Topic in a language other than English

Most Nigerian university projects are submitted in English. Edge case: a Yoruba-language topic on linguistics.

**Strategy:** The APIs all assume English. If the topic contains non-ASCII characters, log it and pass through anyway — Semantic Scholar handles some multilingual content. Do not attempt translation in v2. Add to v3 backlog if real users hit this.

### Edge case 4: Very long topic (>500 characters)

Some students paste their entire research question.

**Strategy:** Truncate to 500 characters before sending to any API. Most APIs reject longer queries silently.

### Edge case 5: All three APIs return zero papers

**Strategy:** Return `{ papers: [], status: "no_papers_found" }`. Topic Validator falls back to validating purely on Claude's judgment with no real-paper context. The Claude prompt should handle this case: *"If real_papers array is empty, validate the topic based on its construction and feasibility alone. Mention to the student that we could not find directly related published work, which may be a research gap or may indicate the topic needs reframing."*

Literature Map cannot function without papers. If zero papers, return an error to the frontend with a friendly message: *"We couldn't find papers for this topic. Try broadening it (remove geographic specifics) or check the spelling."*

### Edge case 6: API returns malformed JSON or unexpected shape

Semantic Scholar has changed response shapes before without warning. OpenAlex is stable but their inverted-index abstract format is fiddly.

**Strategy:**
1. Wrap every API call in try/catch.
2. Validate response shape before using — at minimum, check that `data.data` exists and is an array, and that each paper has `title` (string) and `abstract` (string or null).
3. Discard any paper that fails validation. Don't crash the whole request.
4. If validation strips the result down to < 3 papers, treat as a fallback trigger.

### Edge case 7: Paper has no abstract

Common with conference papers and older journal articles.

**Strategy:** Include the paper but mark `abstract: null`. For Topic Validator, Claude can still use title + authors + year. For Literature Map, drop papers without abstracts before sending to Claude for clustering — clustering needs abstract content.

### Edge case 8: Duplicate paper from same source

Semantic Scholar occasionally returns the same paper twice with slightly different IDs. Dedupe on DOI within a single response, not just across sources.

---

## 7. Input Sanitization

External APIs are friendly — but the topic string we send originated from user input. Sanitize before sending.

### Outbound (FYPro → external API)

1. **Trim whitespace.**
2. **Truncate to 500 characters.**
3. **Strip control characters** (anything below ASCII 32 except space).
4. **URL-encode** before placing in query string. Never concatenate raw user input into a URL.
5. **Reject empty topics.** If trimmed topic is < 5 characters, return error before making any API call.

### Inbound (external API → FYPro → frontend)

This is the bigger risk. External API responses are **untrusted input** — paper titles can contain HTML, JavaScript URIs, or unicode tricks.

1. **Validate response shape** as described in edge case 6.
2. **Strip HTML tags** from `title` and `abstract` fields before storing or returning. Use a tiny library (`sanitize-html` with all tags disallowed) or a simple regex (`.replace(/<[^>]*>/g, '')`) — abstracts should be plain text.
3. **Never use `dangerouslySetInnerHTML`** when rendering. React's default text rendering is safe — keep it that way. (This is also called out in the Day 33 prompt and the Day 34 prompt.)
4. **Validate URLs** — paper `url`, `doi`, `pdfUrl` fields should start with `https://`. Reject anything else (no `javascript:`, no `data:`, no relative URLs).
5. **Limit field lengths** before passing to Claude — truncate abstracts to 1000 characters. Long abstracts waste Claude tokens and don't improve clustering quality.

### What goes into the Claude system prompt

When passing real papers into Claude's system prompt (for Topic Validator or Literature Map), structure them as a clean list:

```
Real papers in this area:
1. "[sanitized title]" ([year]). Authors: [authors]. Abstract: [sanitized abstract, truncated].
2. ...
```

Do NOT pass through the raw API response JSON. Always restructure into a controlled format. This prevents prompt-injection attempts hidden inside paper metadata.

---

## 8. Response Shape (FYPro internal contract)

After all fallbacks, deduplication, and sanitization, the paper-fetch layer returns this shape to the route handler:

```json
{
  "papers": [
    {
      "title": "string, sanitized, max 300 chars",
      "authors": ["string", "string"],
      "year": 2023,
      "abstract": "string, sanitized, max 1000 chars, may be null",
      "doi": "string or null",
      "url": "string starting with https:// or null",
      "citationCount": 42,
      "source": "semantic_scholar" | "openalex" | "crossref"
    }
  ],
  "status": "ok" | "no_papers_found" | "metadata_only",
  "sparse_literature": false,
  "cache_hit": true | false
}
```

The route handler passes `papers` into the Claude system prompt and exposes `status`, `sparse_literature`, and `cache_hit` to the frontend for display logic.

---

## 9. Implementation Notes for Claude Code

When wiring this on Days 33 and 34:

1. Build paper-fetch logic as a **shared module**: `/api/_lib/papers.js`. Both Topic Validator and Literature Map import from it. Don't duplicate the fallback logic in two places.
2. Module exports two functions: `fetchPapersForValidation(topic)` (returns 5) and `fetchPapersForLitMap(topic)` (returns 20).
3. Inside the module, both functions call the same internal `fetchPapers(topic, count)` — only the count differs.
4. Keep the module under 300 lines. If it grows past that, the fallback logic is over-engineered.
5. Add structured logging (Vercel logs): log the source that ultimately returned papers, the number of papers, and whether it was a cache hit. This is the dataset for tuning the cache TTL after launch.

---

## 10. What's NOT in This Architecture

Explicitly out of scope for v2:

- **Full-text PDF retrieval.** We use abstracts only.
- **Citation graph traversal** (finding papers that cite this paper). Future feature.
- **Author profile pages.** Future feature.
- **Saved-papers / personal library.** v3 territory.
- **Cross-reference verification** (is this DOI real?). Future feature for the "Project Reviewer" upgrade.

If a feature request lands that touches any of the above — reject it for v2 and add to the v3 roadmap.

---

**Last updated:** May 4, 2026 — Day 32 of the v2 build companion.
**Owned by:** Architecture decisions in this document supersede inline comments in route handlers. If something here is wrong, fix this document first, then update the code to match.
