import { Resend } from 'resend'
import { supabaseAdmin } from './_lib/supabase-admin.js'
import { sendTelegramAlert } from './_lib/telegram.js'

const BASE_URL    = 'https://fypro.com.ng'
const FROM        = 'FYPro <hello@fypro.com.ng>'
const LIST_UNSUB  = '<mailto:unsubscribe@fypro.com.ng>, <https://fypro.com.ng/account/email-preferences>'

type EmailType = 'welcome' | 'defense_nudge' | 'urgency_reminder'

const SUBJECTS: Record<EmailType, string> = {
  welcome:          'Welcome to FYPro — validate your topic now',
  defense_nudge:    'Have you met your AI examiners yet?',
  urgency_reminder: 'Defense checklist — where do you stand?',
}

// Preheader text shown after subject line in inbox previews
const PREHEADERS: Record<EmailType, string> = {
  welcome:          'Validate your topic idea before your supervisor sees it.',
  defense_nudge:    'Three AI examiners are waiting to push back on your work.',
  urgency_reminder: 'Run through your checklist before the panel does it for you.',
}

// All CSS is inlined — Gmail strips <style> blocks
function header(baseUrl: string) {
  return `
    <div style="background:#0f172a;border-radius:12px 12px 0 0;padding:24px;text-align:center;">
      <img src="${baseUrl}/fypro-logo.png" alt="FYPro" style="height:36px;width:auto;" />
    </div>
  `
}

function footer(baseUrl: string) {
  return `
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0;">
    <p style="font-size:12px;color:#9CA3AF;line-height:1.6;margin:0;">
      You're receiving this because you signed up for FYPro.<br>
      FYPro · Lagos, Nigeria<br>
      <a href="${baseUrl}/account/email-preferences" style="color:#6B7280;">Manage email preferences</a>
    </p>
  `
}

function preheader(text: string) {
  return `<div style="display:none;max-height:0;overflow:hidden;mso-hide:all;">${text}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;</div>`
}

function renderHtml(type: EmailType, name: string, baseUrl: string): string {
  const firstName = name ? name.split(' ')[0] : 'there'
  const pre       = preheader(PREHEADERS[type])

  if (type === 'welcome') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F0F4F8;font-family:Arial,sans-serif;">
      ${pre}
      <div style="max-width:560px;margin:32px auto;">
        ${header(baseUrl)}
        <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:40px;">
          <h1 style="font-size:22px;font-weight:700;color:#0D1B2A;margin:0 0 16px;">${firstName}, welcome to FYPro</h1>
          <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 24px;">You've just joined thousands of Nigerian final year students who are taking their project seriously. Your next step is simple — paste your topic idea into our Topic Validator and find out if it's defensible before your supervisor ever sees it.</p>
          <a href="${baseUrl}/app" style="display:inline-block;background:#16A34A;color:#ffffff;border-radius:8px;padding:12px 24px;font-size:15px;font-weight:600;text-decoration:none;">Validate your topic now</a>
          ${footer(baseUrl)}
        </div>
      </div>
    </body></html>`
  }

  if (type === 'defense_nudge') {
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F0F4F8;font-family:Arial,sans-serif;">
      ${pre}
      <div style="max-width:560px;margin:32px auto;">
        ${header(baseUrl)}
        <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:40px;">
          <h1 style="font-size:22px;font-weight:700;color:#0D1B2A;margin:0 0 16px;">${firstName}, have you met your examiners yet?</h1>
          <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 24px;">Most students walk into their defense never having practiced out loud. FYPro's Defense Simulator puts you in front of three AI examiners — a methodologist, a subject expert, and an external examiner — who push back on your work exactly the way the real panel will. Find out where you're weak before it matters.</p>
          <a href="${baseUrl}/app" style="display:inline-block;background:#0066FF;color:#ffffff;border-radius:8px;padding:12px 24px;font-size:15px;font-weight:600;text-decoration:none;">Try a Defense Simulation</a>
          ${footer(baseUrl)}
        </div>
      </div>
    </body></html>`
  }

  // urgency_reminder
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;background:#F0F4F8;font-family:Arial,sans-serif;">
    ${pre}
    <div style="max-width:560px;margin:32px auto;">
      ${header(baseUrl)}
      <div style="background:#ffffff;border-radius:0 0 12px 12px;padding:40px;">
        <h1 style="font-size:22px;font-weight:700;color:#0D1B2A;margin:0 0 16px;">${firstName} — defense checklist, where do you stand?</h1>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 8px;">A week in and the clock is moving. Run through this before you do anything else:</p>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 10px;padding-left:8px;">☐ &nbsp; Topic locked and validated?</p>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 10px;padding-left:8px;">☐ &nbsp; Methodology chosen and defensible?</p>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 10px;padding-left:8px;">☐ &nbsp; Project PDF uploaded for review?</p>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 16px;padding-left:8px;">☐ &nbsp; Defense Simulator score 7 or above?</p>
        <p style="font-size:15px;line-height:1.7;color:#374151;margin:0 0 24px;">If any box is unchecked, open your dashboard and work through it. Your panel will not go easy on gaps.</p>
        <a href="${baseUrl}/dashboard" style="display:inline-block;background:#16A34A;color:#ffffff;border-radius:8px;padding:12px 24px;font-size:15px;font-weight:600;text-decoration:none;">Open my dashboard</a>
        ${footer(baseUrl)}
      </div>
    </div>
  </body></html>`
}

function renderText(type: EmailType, name: string, baseUrl: string): string {
  const firstName = name ? name.split(' ')[0] : 'there'

  if (type === 'welcome') {
    return `${firstName}, welcome to FYPro\n\nYou've just joined thousands of Nigerian final year students who are taking their project seriously.\n\nYour next step is simple — paste your topic idea into our Topic Validator and find out if it's defensible before your supervisor ever sees it.\n\nValidate your topic now: ${baseUrl}/app\n\n---\nManage email preferences: ${baseUrl}/account/email-preferences`
  }

  if (type === 'defense_nudge') {
    return `${firstName}, have you met your examiners yet?\n\nMost students walk into their defense never having practiced out loud. FYPro's Defense Simulator puts you in front of three AI examiners who push back on your work the way the real panel will.\n\nTry a Defense Simulation: ${baseUrl}/app\n\n---\nManage email preferences: ${baseUrl}/account/email-preferences`
  }

  return `${firstName} — defense checklist, where do you stand?\n\nA week in and the clock is moving. Run through this:\n\n☐  Topic locked and validated?\n☐  Methodology chosen and defensible?\n☐  Project PDF uploaded for review?\n☐  Defense Simulator score 7 or above?\n\nIf any box is unchecked, open your dashboard and work through it.\n\nOpen my dashboard: ${baseUrl}/dashboard\n\n---\nManage email preferences: ${baseUrl}/account/email-preferences`
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

  const resend = new Resend(process.env.RESEND_API_KEY)

  let resendId: string | null = null
  let status: 'sent' | 'failed' = 'sent'

  try {
    const html = renderHtml(emailType, name ?? '', BASE_URL)

    const text = renderText(emailType, name ?? '', BASE_URL)

    const { data, error } = await resend.emails.send({
      from:    FROM,
      to:      email,
      subject: SUBJECTS[emailType],
      html,
      text,
      headers: {
        'List-Unsubscribe':      LIST_UNSUB,
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
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
    sendTelegramAlert(`🔴 Nurture email failed: ${emailType} for user:${userId} — ${(err as Error).message}`).catch(() => null)
  }

  try {
    await supabaseAdmin.from('email_log').insert({
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
