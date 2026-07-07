// Structural validation for Claude's raw JSON output — run this BEFORE deciding
// whether a request charges a free-tier run or gets cached. Mirrors the
// extraction logic already duplicated across src/services/api.js (strip code
// fences, regex-match, JSON.parse), so the server rejects the same malformed
// output the client would reject anyway — but before spending the user's free
// run on it.

/**
 * @param {object} data - Raw Anthropic Messages API response body.
 * @returns {{ ok: true, parsed: object } | { ok: false, reason: 'truncated' | 'unparseable' }}
 */
export function extractModelJson(data) {
  if (data?.stop_reason === 'max_tokens') {
    return { ok: false, reason: 'truncated' };
  }

  const text = data?.content?.[0]?.text ?? '';
  try {
    const cleaned = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    const match   = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    const parsed  = JSON.parse(match ? match[0] : cleaned);
    if (parsed && typeof parsed === 'object') return { ok: true, parsed };
    return { ok: false, reason: 'unparseable' };
  } catch {
    return { ok: false, reason: 'unparseable' };
  }
}
