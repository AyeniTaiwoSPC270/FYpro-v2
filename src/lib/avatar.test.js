import { describe, it, expect } from 'vitest'
import { withCacheBust } from './avatar'

describe('withCacheBust', () => {
  it('appends a t= query param to a bare URL', () => {
    const out = withCacheBust('https://cdn.example.com/a.jpg')
    expect(out).toMatch(/^https:\/\/cdn\.example\.com\/a\.jpg\?t=\d+$/)
  })

  it('uses & when the URL already has a query string', () => {
    const out = withCacheBust('https://cdn.example.com/a.jpg?v=1')
    expect(out).toMatch(/^https:\/\/cdn\.example\.com\/a\.jpg\?v=1&t=\d+$/)
  })

  it('returns falsy input unchanged', () => {
    expect(withCacheBust('')).toBe('')
    expect(withCacheBust(null)).toBe(null)
    expect(withCacheBust(undefined)).toBe(undefined)
  })
})
