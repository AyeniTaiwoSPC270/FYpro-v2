import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'

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

// A page load gets a fresh module instance while sessionStorage survives —
// re-importing the module models the reload the browser actually performs.
async function loadPage() {
  vi.resetModules()
  return (await import('./chunkReload')).tryChunkReload
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

  it('reloads once on the first failure', async () => {
    const tryChunkReload = await loadPage()
    expect(tryChunkReload()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('tells a second caller in the same page load that a reload is already in flight', async () => {
    const tryChunkReload = await loadPage()
    // One failed chunk reaches both recovery paths: main.jsx's vite:preloadError
    // handler, then App.jsx's safeLazy (Vite resolves the import as undefined once
    // the event is default-prevented). The second call must not spend an attempt,
    // or safeLazy throws while the reload is already on its way.
    expect(tryChunkReload()).toBe(true)
    expect(tryChunkReload()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('gives up when the reload did not fix it (prevents reload loop)', async () => {
    const beforeReload = await loadPage()
    expect(beforeReload()).toBe(true)

    const afterReload = await loadPage()
    expect(afterReload()).toBe(false)
    expect(reload).toHaveBeenCalledTimes(1)
  })

  it('allows a fresh reload once the time window has passed', async () => {
    const beforeReload = await loadPage()
    expect(beforeReload()).toBe(true)

    const afterReload = await loadPage()
    expect(afterReload()).toBe(false)

    // A failure long after the last attempt is a new incident, not a loop.
    Date.now.mockReturnValue(1_000_000 + 31_000)
    const laterPage = await loadPage()
    expect(laterPage()).toBe(true)
    expect(reload).toHaveBeenCalledTimes(2)
  })

  it('does not throw when sessionStorage is unavailable', async () => {
    vi.stubGlobal('sessionStorage', {
      getItem: () => { throw new Error('blocked') },
      setItem: () => { throw new Error('blocked') },
    })
    const tryChunkReload = await loadPage()
    expect(() => tryChunkReload()).not.toThrow()
    expect(reload).toHaveBeenCalledTimes(1)
  })
})
