import { describe, it, expect } from 'vitest'
import { esc, STEP_COLORS, SHIELD_PATH } from './generateReport.js'

describe('esc', () => {
  it('escapes HTML special characters', () => {
    expect(esc('<b>hello & "world"</b>')).toBe('&lt;b&gt;hello &amp; &quot;world&quot;&lt;/b&gt;')
  })
  it('returns empty string for null', () => { expect(esc(null)).toBe('') })
  it('returns empty string for undefined', () => { expect(esc(undefined)).toBe('') })
  it('converts numbers to string', () => { expect(esc(42)).toBe('42') })
})

describe('STEP_COLORS', () => {
  it('has exactly 6 entries', () => { expect(STEP_COLORS).toHaveLength(6) })
  it('each entry has border, bg, label, name', () => {
    STEP_COLORS.forEach((c, i) => {
      expect(c.border, `step ${i} border`).toBeTruthy()
      expect(c.bg,     `step ${i} bg`).toBeTruthy()
      expect(c.label,  `step ${i} label`).toBeTruthy()
      expect(c.name,   `step ${i} name`).toBeTruthy()
    })
  })
  it('step 1 is blue',   () => { expect(STEP_COLORS[0].border).toBe('#0066FF') })
  it('step 2 is teal',   () => { expect(STEP_COLORS[1].border).toBe('#0891B2') })
  it('step 3 is purple', () => { expect(STEP_COLORS[2].border).toBe('#7C3AED') })
  it('step 4 is amber',  () => { expect(STEP_COLORS[3].border).toBe('#F59E0B') })
  it('step 5 is green',  () => { expect(STEP_COLORS[4].border).toBe('#16A34A') })
  it('step 6 is red',    () => { expect(STEP_COLORS[5].border).toBe('#DC2626') })
})

describe('SHIELD_PATH', () => {
  it('is a non-empty string', () => { expect(typeof SHIELD_PATH).toBe('string'); expect(SHIELD_PATH.length).toBeGreaterThan(10) })
})
