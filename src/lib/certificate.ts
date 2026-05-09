import { supabase } from './supabase'

export interface Certificate {
  id:                 string
  user_id:            string
  defense_session_id: string
  score:              number
  topic_title:        string
  recipient_name:     string
  issued_at:          string
  certificate_number: string
}

/**
 * POST /api/certificate with the defense session ID, trigger a PDF download.
 * Throws 'NAME_REQUIRED' (as error.message) when the user has no full_name set.
 */
export async function downloadCertificate(defenseSessionId: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session?.access_token) throw new Error('Not authenticated')

  const res = await fetch('/api/certificate', {
    method: 'POST',
    headers: {
      'Content-Type':  'application/json',
      'Authorization': `Bearer ${session.access_token}`,
    },
    body: JSON.stringify({ defense_session_id: defenseSessionId }),
  })

  if (!res.ok) {
    let data: { error?: string; message?: string } = {}
    try { data = await res.json() } catch { /* ignore */ }
    throw new Error(data.error || data.message || 'Failed to generate certificate')
  }

  const blob = await res.blob()
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  const disposition = res.headers.get('Content-Disposition') || ''
  const match = disposition.match(/filename="([^"]+)"/)
  a.download = match?.[1] || 'FYPro-Certificate.pdf'
  a.href = url
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/** Fetch all certificates earned by the signed-in user, newest first. */
export async function fetchMyCertificates(): Promise<Certificate[]> {
  const { data, error } = await supabase
    .from('defense_certificates')
    .select('*')
    .order('issued_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data ?? []
}
