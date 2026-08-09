// Tests for logAiCall — the single write path for ai_call_log (W3). Every
// Anthropic call site and every cache-hit branch across api/_lib/anthropic-proxy.js,
// api/ai.js, api/project-reviewer.js, and api/research.js routes through this
// function — see docs/specs/2026-08-03-w3-cost-telemetry-design.md.

import { describe, it, expect, beforeEach, vi } from 'vitest'

const h = vi.hoisted(() => ({ insert: null, lastTable: null, lastRow: null }))

vi.mock('./supabase-admin.js', () => ({
  supabaseAdmin: {
    from: (table) => ({
      insert: (row) => { h.lastTable = table; h.lastRow = row; return h.insert(row) },
    }),
  },
}))

const { logAiCall } = await import('./ai-cost-log.js')

beforeEach(() => {
  h.insert = vi.fn().mockResolvedValue({ data: null, error: null })
  h.lastTable = null
  h.lastRow = null
})

describe('logAiCall', () => {
  it('writes to the ai_call_log table', async () => {
    await logAiCall({ userId: 'u1', feature: 'topic-validator', model: 'claude-sonnet-4-6', tokensIn: 100, tokensOut: 50 })
    expect(h.lastTable).toBe('ai_call_log')
  })

  it('computes cost_usd from tokens and model using existing Sonnet pricing', async () => {
    await logAiCall({ userId: 'u1', feature: 'topic-validator', model: 'claude-sonnet-4-6', tokensIn: 1_000_000, tokensOut: 100_000, traceId: 'fyp-abc', durationMs: 500 })
    expect(h.lastRow).toMatchObject({
      user_id: 'u1', feature: 'topic-validator', model: 'claude-sonnet-4-6',
      tokens_in: 1_000_000, tokens_out: 100_000, cache_hit: false,
      trace_id: 'fyp-abc', duration_ms: 500,
    })
    expect(h.lastRow.cost_usd).toBeCloseTo(3 + 1.5) // Sonnet: $3/1M in, $15/1M out
  })

  it('uses Haiku pricing for a Haiku model', async () => {
    await logAiCall({ userId: 'u1', feature: 'defense-simulator', model: 'claude-haiku-4-5-20251001', tokensIn: 1_000_000, tokensOut: 100_000 })
    expect(h.lastRow.cost_usd).toBeCloseTo(1 + 0.5)
  })

  it('writes a zero-cost, zero-token row for a cache hit', async () => {
    await logAiCall({ userId: 'u1', feature: 'chapter-architect', model: 'claude-sonnet-4-6', cacheHit: true, traceId: 'fyp-def' })
    expect(h.lastRow).toMatchObject({ cache_hit: true, tokens_in: 0, tokens_out: 0, cost_usd: 0 })
  })

  it('defaults user_id to null when no userId is given', async () => {
    await logAiCall({ feature: 'topic-validator', model: 'claude-sonnet-4-6', cacheHit: true })
    expect(h.lastRow.user_id).toBeNull()
  })

  it('never throws when the insert rejects', async () => {
    h.insert.mockRejectedValue(new Error('db down'))
    await expect(logAiCall({ userId: 'u1', feature: 'topic-validator', model: 'claude-sonnet-4-6' })).resolves.toBeUndefined()
  })

  it('never hangs past the 3s timeout race when the insert never resolves', async () => {
    vi.useFakeTimers()
    h.insert.mockReturnValue(new Promise(() => {}))
    const p = logAiCall({ userId: 'u1', feature: 'topic-validator', model: 'claude-sonnet-4-6' })
    await vi.advanceTimersByTimeAsync(3000)
    await expect(p).resolves.toBeUndefined()
    vi.useRealTimers()
  })
})
