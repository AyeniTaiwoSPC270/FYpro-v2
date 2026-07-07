import { describe, it, expect } from 'vitest';
import { extractModelJson } from './parse-model-json.js';

function anthropicResponse(text, stopReason = 'end_turn') {
  return { stop_reason: stopReason, content: [{ text }] };
}

describe('extractModelJson', () => {
  it('accepts clean JSON', () => {
    const r = extractModelJson(anthropicResponse('{"verdict":"strong"}'));
    expect(r).toEqual({ ok: true, parsed: { verdict: 'strong' } });
  });

  it('accepts JSON wrapped in a ```json code fence', () => {
    const r = extractModelJson(anthropicResponse('```json\n{"verdict":"strong"}\n```'));
    expect(r.ok).toBe(true);
    expect(r.parsed).toEqual({ verdict: 'strong' });
  });

  it('accepts JSON with surrounding prose', () => {
    const r = extractModelJson(anthropicResponse('Here is the result: {"verdict":"strong"} Hope that helps!'));
    expect(r.ok).toBe(true);
    expect(r.parsed).toEqual({ verdict: 'strong' });
  });

  it('accepts a JSON array', () => {
    const r = extractModelJson(anthropicResponse('[{"a":1},{"a":2}]'));
    expect(r.ok).toBe(true);
    expect(r.parsed).toEqual([{ a: 1 }, { a: 2 }]);
  });

  it('rejects truncated output even if the partial text looks parseable', () => {
    const r = extractModelJson(anthropicResponse('{"verdict":"str', 'max_tokens'));
    expect(r).toEqual({ ok: false, reason: 'truncated' });
  });

  it('rejects unparseable prose with no JSON in it', () => {
    const r = extractModelJson(anthropicResponse('Sorry, I cannot help with that request.'));
    expect(r).toEqual({ ok: false, reason: 'unparseable' });
  });

  it('rejects empty content', () => {
    const r = extractModelJson({ stop_reason: 'end_turn', content: [] });
    expect(r).toEqual({ ok: false, reason: 'unparseable' });
  });

  it('rejects a bare JSON primitive (not an object or array)', () => {
    const r = extractModelJson(anthropicResponse('42'));
    expect(r).toEqual({ ok: false, reason: 'unparseable' });
  });
});
