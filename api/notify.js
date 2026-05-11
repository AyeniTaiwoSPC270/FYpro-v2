// Lightweight endpoint for client-side admin notifications.
// Events that happen in the browser (defense completion, project creation)
// call this endpoint fire-and-forget with a JWT so the server can verify
// identity and read ground-truth data before alerting.

import { supabaseAdmin } from './_lib/supabase-admin.js'
import { sendTelegramAlert } from './_lib/telegram.js'
import { setCorsHeaders } from './_lib/cors.js'

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).end()

  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).end()

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).end()

  const { action, payload } = req.body || {}
  const email = user.email || 'unknown'

  if (action === 'defense_completed') {
    const score = Number(payload?.score)
    if (!isNaN(score)) {
      sendTelegramAlert(`🎓 Defense completed: ${email} scored ${score}/10`)
    }
  }

  if (action === 'project_created') {
    const title = String(payload?.title || 'untitled').slice(0, 80)
    sendTelegramAlert(`📁 New project: ${email} started '${title}'`)
  }

  return res.status(200).json({ ok: true })
}
