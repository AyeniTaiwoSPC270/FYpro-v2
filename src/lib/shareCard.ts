import { supabase } from './supabase'

/**
 * Fetches a server-rendered 1080×1350 PNG for a completed defense session.
 * The server validates ownership — the client only provides a project ID.
 * The score comes from the database, not the client.
 */
export async function fetchShareCardBlob(projectId: string): Promise<Blob> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const res = await fetch('/api/share-card', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ project_id: projectId }),
  })

  if (!res.ok) {
    let msg = `Share card error: ${res.status}`
    try {
      const json = await res.json()
      if (json?.error) msg = json.error
    } catch { /* ignore */ }
    throw new Error(msg)
  }

  return res.blob()
}

/**
 * Shares the card via Web Share API (with PNG file) if supported,
 * otherwise downloads the PNG and opens WhatsApp with pre-filled text.
 */
export async function shareToWhatsApp(
  blob: Blob,
  score: number | null,
  _topic: string
): Promise<void> {
  const scoreText = score != null ? `${score}/10` : '?/10'
  const shareText = `I just simulated my project defense on FYPro. Score: ${scoreText}. Try it: https://fypro.com.ng`

  const file = new File([blob], 'fypro-defense-result.png', { type: 'image/png' })

  if (typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text: shareText })
      return
    } catch (err: unknown) {
      // User cancelled — don't fall through to WhatsApp
      if (err instanceof Error && err.name === 'AbortError') return
      // Other errors fall through to download fallback
    }
  }

  // Fallback: download the PNG, then open WhatsApp with text
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = 'fypro-defense-result.png'
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)

  const encoded = encodeURIComponent(shareText)
  window.open(`https://wa.me/?text=${encoded}`, '_blank', 'noopener,noreferrer')
}
