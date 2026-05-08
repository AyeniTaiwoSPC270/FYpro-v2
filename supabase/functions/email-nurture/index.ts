import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VERCEL_SEND_URL = 'https://fypro.vercel.app/api/send-nurture-email'
const CRON_SECRET     = Deno.env.get('CRON_SECRET') ?? ''
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

type EmailType = 'welcome' | 'defense_nudge' | 'urgency_reminder'

interface EligibleUser {
  user_id: string
  email:   string
  name:    string | null
}

const DAY_THRESHOLDS: Record<EmailType, number> = {
  welcome:          0,
  defense_nudge:    3,
  urgency_reminder: 7,
}

async function getEligibleUsers(emailType: EmailType): Promise<EligibleUser[]> {
  const { data, error } = await supabase.rpc('get_eligible_nurture_users', {
    p_email_type: emailType,
    p_min_days:   DAY_THRESHOLDS[emailType],
  })

  if (error) {
    console.error(`[email-nurture] eligibility query failed for ${emailType}:`, error.message)
    return []
  }
  return (data ?? []) as EligibleUser[]
}

async function isSubscribed(userId: string, emailType: EmailType): Promise<boolean> {
  const { data } = await supabase
    .from('email_preferences')
    .select('unsubscribed_all, welcome_enabled, defense_nudge_enabled, urgency_reminder_enabled')
    .eq('user_id', userId)
    .maybeSingle()

  if (!data) return true // no row = default subscribed (all enabled)
  if (data.unsubscribed_all) return false

  const toggle: Record<EmailType, boolean> = {
    welcome:          data.welcome_enabled,
    defense_nudge:    data.defense_nudge_enabled,
    urgency_reminder: data.urgency_reminder_enabled,
  }
  return toggle[emailType] !== false
}

async function sendEmail(user: EligibleUser, emailType: EmailType): Promise<void> {
  try {
    const res = await fetch(VERCEL_SEND_URL, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization:  `Bearer ${CRON_SECRET}`,
      },
      body: JSON.stringify({
        userId:    user.user_id,
        emailType,
        email:     user.email,
        name:      user.name ?? '',
      }),
    })
    if (!res.ok) {
      console.error(`[email-nurture] Vercel function returned ${res.status}`, {
        userId:    user.user_id,
        emailType,
      })
    }
  } catch (err) {
    console.error(`[email-nurture] fetch to Vercel failed`, {
      userId:    user.user_id,
      emailType,
      message:   (err as Error).message,
    })
  }
}

Deno.serve(async () => {
  const emailTypes: EmailType[] = ['welcome', 'defense_nudge', 'urgency_reminder']

  for (const emailType of emailTypes) {
    const users = await getEligibleUsers(emailType)
    console.log(`[email-nurture] ${emailType}: ${users.length} eligible`)

    for (const user of users) {
      const subscribed = await isSubscribed(user.user_id, emailType)
      if (!subscribed) continue
      await sendEmail(user, emailType)
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
