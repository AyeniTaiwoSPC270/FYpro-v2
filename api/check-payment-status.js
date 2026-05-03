import { supabaseAdmin } from './_lib/supabase-admin.js'

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { reference } = req.query
  if (!reference || typeof reference !== 'string') {
    return res.status(400).json({ error: 'Missing reference' })
  }

  const { data, error } = await supabaseAdmin
    .from('payments')
    .select('status')
    .eq('paystack_reference', reference)
    .single()

  if (error || !data) {
    return res.status(200).json({ status: 'not_found' })
  }

  return res.status(200).json({
    status: data.status === 'success' ? 'success' : 'pending',
  })
}
