import { describe, it, expect } from 'vitest'
import { NOTIFICATION_ICONS, getNotificationIcon } from './notificationIcons'
import { GLYPHS } from './glyphs'

const TYPES = [
  'welcome', 'step_completed', 'payment_confirmed', 'certificate_unlocked',
  'referral_join', 'referral_credit', 'announcement',
]

describe('NOTIFICATION_ICONS', () => {
  it('maps exactly the 7 known notification types', () => {
    expect(Object.keys(NOTIFICATION_ICONS).sort()).toEqual([...TYPES].sort())
  })
  it('every mapped glyph exists in the glyph registry', () => {
    Object.values(NOTIFICATION_ICONS).forEach(v => {
      expect(GLYPHS[v.glyph]).toBeTruthy()
    })
  })
  it('every entry defines bg, stroke, and fill colors', () => {
    Object.values(NOTIFICATION_ICONS).forEach(v => {
      expect(typeof v.bg).toBe('string')
      expect(typeof v.stroke).toBe('string')
      expect(typeof v.fill).toBe('string')
    })
  })
  it('falls back to the bell glyph for unknown types', () => {
    const fallback = getNotificationIcon('does_not_exist')
    expect(fallback.glyph).toBe('bell')
    expect(GLYPHS[fallback.glyph]).toBeTruthy()
  })
})
