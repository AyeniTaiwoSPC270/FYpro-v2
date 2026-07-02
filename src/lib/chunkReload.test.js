import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { tryChunkReload } from './chunkReload'

// In-memory sessionStorage stub (node test env has none).
function makeStorage() {
  const map = new Map()
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
    clear: () => map.clear(),
  }
}

describe('tryChunkReload', () => {
  let reload

  beforeEach(() => {
    reload = vi.fn()
    vi.stubGlobal('sessionStorage', makeStorage())
    vi.stubGlobal('window', { location: { reload } })
    vi.spyOn(Date, 'now').mockReturnValue(1_000_000)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it('reloads once on the first failure', () => {
    expect(tryChunkReload()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('gives up on an immediate second failure (prevents reload loop)', () => {
    expect(tryChunkReload()).toBe(true)
    expect(tryChunkReload()).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('allows a fresh reload once the time window has passed', () => {
    expect(tryChunkReload()).toBe(true)
    expect(tryChunkReload()).toBe(false)

    // Simulate a failure long after the last attempt — a new incident, not a loop.
    Date.now.mockReturnValue(1_000_000 + 31_000)
    expect(tryChunkReload()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('does not throw when sessionStorage is unavailable', () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    expect(() => tryChunkReload()).not.toThrow()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
