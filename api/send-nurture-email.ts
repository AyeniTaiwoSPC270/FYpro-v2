import { Resend } from 'resend'
import { createClient } from '@supabase/supabase-js'

const BASE_URL   = 'https://fypro.com.ng'
const FROM       = 'FYPro <hello@fypro.com.ng>'
const LIST_UNSUB = '<mailto:unsubscribe@fypro.com.ng>, <https://fypro.com.ng/account/email-preferences>'

type EmailType = 'welcome' | 'defense_nudge' | 'urgency_reminder'

const SUBJECTS: Record<EmailType, string> = {
  welcome:          'Welcome to FYPro — validate your topic now',
  defense_nudge:    'Have you met your AI examiners yet?',
  urgency_reminder: 'Defense checklist — where do you stand?',
}

const STYLES = `
  <style>
    body { margin:0; padding:0; background:#F0F4F8; font-family:'Poppins',Arial,sans-serif; }
    .box { background:#fff; border-radius:12px; padding:40px; max-width:560px; margin:32px auto; }
    h1 { font-size:22px; font-weight:700; color:#0D1B2A; margin:0 0 16px; }
    p { font-size:15px; line-height:1.7; color:#374151; margin:0 0 24px; }
    .item { font-size:15px; line-height:1.7; color:#374151; margin:0 0 10px; padding-left:8px; }
    .btn-green { display:inline-block; background:#16A34A; color:#fff; border-radius:8px; padding:12px 24px; font-size:15px; font-weight:600; text-decoration:none; }
    .btn-blue  { display:inline-block; background:#0066FF; color:#fff; border-radius:8px; padding:12px 24px; font-size:15px; font-weight:600; text-decoration:none; }
    hr { border:none; border-top:1px solid #E5E7EB; margin:24px 0; }
    .foot { font-size:12px; color:#9CA3AF; line-height:1.6; }
    .foot a { color:#6B7280; }
  </style>
`

function footer(baseUrl: string) {
  return `
    <hr>
    <p class="foot">
      You're receiving this because you signed up for FYPro.<br>
      FYPro · Lagos, Nigeria<br>
      <a href="${baseUrl}/account/email-preferences">Manage email preferences</a>
    </p>
  `
}

function renderHtml(type: EmailType, name: string, baseUrl: string): string {
  const firstName = name ? name.split(' ')[0] : 'there'

  if (type === 'welcome') {
    return `<!DOCTYPE html><html><head>${STYLES}</head><body>
      <div class="box">
        <h1>Welcome to FYPro, ${firstName}</h1>
        <p>You've just joined thousands of Nigerian final year students who are taking their
        project seriously. Your next step is simple — paste your topic idea into our Topic
        Validator and find out if it's defensible before your supervisor ever sees it.</p>
        <a href="${baseUrl}/app/topic-validator" class="btn-green">Validate your topic now</a>
        ${footer(baseUrl)}
      </div>
    </body></html>`
  }

  if (type === 'defense_nudge') {
    return `<!DOCTYPE html><html><head>${STYLES}</head><body>
      <div class="box">
        <h1>Have you met your examiners yet, ${firstName}?</h1>
        <p>Most students walk into their defense never having practiced out loud. FYPro's
        Defense Simulator puts you in front of three AI examiners — a methodologist, a
        subject expert, and an external examiner — who push back on your work exactly the
        way the real panel will. Find out where you're weak before it matters.</p>
        <a href="${baseUrl}/app/defense" class="btn-blue">Try a Defense Simulation</a>
        ${footer(baseUrl)}
      </div>
    </body></html>`
  }

  // urgency_reminder
  return `<!DOCTYPE html><html><head>${STYLES}</head><body>
    <div class="box">
      <h1>Defense checklist, ${firstName} — are you ready?</h1>
      <p>A week in and the clock is moving. Run through this before you do anything else:</p>
      <p class="item">☐ &nbsp; Topic locked and validated?</p>
      <p class="item">☐ &nbsp; Methodology chosen and defensible?</p>
      <p class="item">☐ &nbsp; Project PDF uploaded for review?</p>
      <p class="item">☐ &nbsp; Defense Simulator score 7 or above?</p>
      <p style="margin-top:16px">If any box is unchecked, open your dashboard and work through it.
      Your panel will not go easy on gaps.</p>
      <a href="${baseUrl}/dashboard" class="btn-green">Open my dashboard</a>
      ${footer(baseUrl)}
    </div>
  </body></html>`
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
    const html = renderHtml(emailType, name ?? '', BASE_URL)

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
    if (dbErr?.code === '23505') {
      return res.status(200).json({ ok: true, alreadySent: true })
    }
    console.error('[send-nurture-email] email_log insert failed', { userId, emailType })
  }

  return res.status(200).json({ ok: status === 'sent', resendId, alreadySent: false })
}
