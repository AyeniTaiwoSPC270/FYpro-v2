import type { GlyphName } from './types'

export type NotificationType =
  | 'welcome'
  | 'step_completed'
  | 'payment_confirmed'
  | 'certificate_unlocked'
  | 'referral_join'
  | 'referral_credit'
  | 'announcement'

export interface NotificationIconStyle {
  glyph: GlyphName
  bg: string
  stroke: string
  fill: string
}

// SINGLE SOURCE OF TRUTH for which glyph + colors each notification type
// uses. Read by NotificationPanel.jsx. `bg` is the icon chip's circle
// background (0.15 alpha tint); `fill` is the glyph's own duotone paint
// (0.35 alpha, same hue) — kept distinct so the glyph reads clearly against
// its chip instead of blending into it.
export const NOTIFICATION_ICONS: Record<NotificationType, NotificationIconStyle> = {
  welcome:               { glyph: 'seedling', bg: 'rgba(59,130,246,0.15)',  stroke: '#3B82F6', fill: 'rgba(59,130,246,0.35)' },
  step_completed:        { glyph: 'flag',      bg: 'rgba(6,182,212,0.15)',  stroke: '#06B6D4', fill: 'rgba(6,182,212,0.35)' },
  payment_confirmed:     { glyph: 'diamond',   bg: 'rgba(22,163,74,0.15)',  stroke: '#16A34A', fill: 'rgba(22,163,74,0.35)' },
  certificate_unlocked:  { glyph: 'trophy',    bg: 'rgba(245,158,11,0.15)', stroke: '#F59E0B', fill: 'rgba(245,158,11,0.35)' },
  referral_join:         { glyph: 'network',   bg: 'rgba(139,92,246,0.15)', stroke: '#8B5CF6', fill: 'rgba(139,92,246,0.35)' },
  referral_credit:       { glyph: 'star',      bg: 'rgba(139,92,246,0.15)', stroke: '#8B5CF6', fill: 'rgba(139,92,246,0.35)' },
  announcement:          { glyph: 'megaphone', bg: 'rgba(236,72,153,0.15)', stroke: '#EC4899', fill: 'rgba(236,72,153,0.35)' },
}

const FALLBACK: NotificationIconStyle = {
  glyph: 'bell',
  bg: 'var(--bg-input)',
  stroke: 'var(--text-muted)',
  fill: 'rgba(148,163,184,0.25)',
}

// Safe lookup — never throws, so unknown/future notification types degrade
// gracefully to a neutral bell instead of crashing the panel.
export function getNotificationIcon(type: string): NotificationIconStyle {
  return NOTIFICATION_ICONS[type as NotificationType] ?? FALLBACK
}
