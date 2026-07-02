import { describe, it, expect } from 'vitest'
import { GLYPHS } from './glyphs'
import type { GlyphName } from './types'

const ALL_GLYPHS: GlyphName[] = [
  'shield', 'cap', 'target', 'flame', 'seedling', 'halfRing',
  'rocket', 'stopwatch', 'flag', 'star', 'diamond', 'loop',
  'comeback', 'megaphone', 'network', 'trophy', 'share', 'moon', 'sunrise',
  'bell',
]

describe('GLYPHS registry', () => {
  it('defines all 20 named glyphs', () => {
    expect(Object.keys(GLYPHS).sort()).toEqual([...ALL_GLYPHS].sort())
  })
  it('every glyph is a defined React element', () => {
    ALL_GLYPHS.forEach(name => {
      expect(GLYPHS[name]).toBeTruthy()
    })
  })
})
