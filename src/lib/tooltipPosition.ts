// Shared helper for badge tooltips (StepBadge, DefenseReadyBadge, AchievementsRow).
// Each tooltip is portaled to document.body and centered on its trigger via
// `left: centerX; transform: translateX(-50%)`. For triggers near the left/right
// edge of a narrow viewport, that centered box runs off-screen and gets cut off.
// Clamping the center keeps a box of `width` fully within the viewport.
export function clampTooltipCenterX(centerX: number, width: number, margin = 12): number {
  const halfWidth = width / 2
  const min = halfWidth + margin
  const max = window.innerWidth - halfWidth - margin
  if (max < min) return window.innerWidth / 2
  return Math.min(Math.max(centerX, min), max)
}
