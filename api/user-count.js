import { supabaseAdmin } from './_lib/supabase-admin.js'
import { setCorsHeaders } from './_lib/cors.js'

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()

  // CDN cache: fresh for 1 hour, revalidate in background for another hour
  res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate=3600')

  try {
    const { count, error } = await supabaseAdmin
      .from('users')
      .select('*', { count: 'exact', head: true })

    if (error) throw error

    return res.status(200).json({ count: count ?? 0 })
  } catch (err) {
    console.error('[user-count]', err.message)
    return res.status(200).json({ count: 0 })
  }
}
