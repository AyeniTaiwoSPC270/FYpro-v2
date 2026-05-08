import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'
import { renderTemplate, EmailType } from '../src/emails/render'

const BASE_URL        = 'https://fypro.vercel.app'
const FROM            = 'FYPro <hello@fypro.com.ng>'
const LIST_UNSUB      = '<mailto:unsubscribe@fypro.com.ng>, <https://fypro.com.ng/account/email-preferences>'

const SUBJECTS: Record<EmailType, string> = {
  welcome:          'Welcome to FYPro — validate your topic now',
  defense_nudge:    'Have you met your AI examiners yet?',
  urgency_reminder: 'Defense checklist — where do you stand?',
}

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const auth = (req.headers['authorization'] as string) ?? ''
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { userId, emailType, email, name } = req.body as {
    userId:    string
    emailType: EmailType
    email:     string
    name:      string
  }

  if (!userId || !emailType || !email) {
    return res.status(400).json({ error: 'Missing required fields: userId, emailType, email' })
  }

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  )
  const resend = new Resend(process.env.RESEND_API_KEY)

  let resendId: string | null = null
  let status: 'sent' | 'failed' = 'sent'

  try {
    const html = await renderTemplate(emailType, { name: name ?? '', baseUrl: BASE_URL })

    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: SUBJECTS[emailType],
      html,
      headers: { 'List-Unsubscribe': LIST_UNSUB },
    })

    if (error) throw new Error(error.message)
    resendId = data?.id ?? null
  } catch (err) {
    status = 'failed'
    // Log metadata only — no email address, no HTML body
    console.error('[send-nurture-email] Resend failed', {
      userId,
      emailType,
      message: (err as Error).message,
    })
  }

  try {
    await supabase.from('email_log').insert({
      user_id:    userId,
      email_type: emailType,
      resend_id:  resendId,
      status,
    })
  } catch (dbErr: any) {
    // 23505 = unique_violation: this user already received this email type
    if (dbErr?.code === '23505') {
      return res.status(200).json({ ok: true, alreadySent: true })
    }
    // Log but don't crash the response — send may have succeeded
    console.error('[send-nurture-email] email_log insert failed', { userId, emailType })
  }

  return res.status(200).json({ ok: status === 'sent', resendId, alreadySent: false })
}
