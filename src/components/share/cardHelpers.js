export function scoreColor(score) {
  if (score == null) return '#3B82F6'
  if (score >= 8) return '#16A34A'
  if (score >= 5) return '#F59E0B'
  return '#DC2626'
}

export function truncate(str, max) {
  if (!str) return ''
  return str.length <= max ? str : str.slice(0, max - 1) + '…'
}
