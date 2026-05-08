import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const VERCEL_SEND_URL = 'https://fypro.com.ng/api/send-nurture-email'
const CRON_SECRET     = Deno.env.get('CRON_SECRET') ?? ''
const SUPABASE_URL    = Deno.env.get('SUPABASE_URL') ?? ''
const SERVICE_ROLE    = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''

// Fix 2: Fail fast on missing env vars
if (!CRON_SECRET || !SUPABASE_URL || !SERVICE_ROLE) {
  throw new Error('[email-nurture] missing required env: CRON_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY')
}

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

// Fix 3: Replace N+1 isSubscribed with a single batch query
async function getPrefsMap(userIds: string[]): Promise<Map<string, Record<string, boolean>>> {
  if (userIds.length === 0) return new Map()
  const { data } = await supabase
    .from('email_preferences')
    .select('user_id, unsubscribed_all, welcome_enabled, defense_nudge_enabled, urgency_reminder_enabled')
    .in('user_id', userIds)
  const map = new Map<string, Record<string, boolean>>()
  for (const row of data ?? []) map.set(row.user_id, row)
  return map
}

function isSubscribedFromPrefs(prefs: Record<string, boolean> | undefined, emailType: EmailType): boolean {
  if (!prefs) return true // no row = default subscribed
  if (prefs.unsubscribed_all) return false
  const toggle: Record<EmailType, boolean> = {
    welcome:          prefs.welcome_enabled,
    defense_nudge:    prefs.defense_nudge_enabled,
    urgency_reminder: prefs.urgency_reminder_enabled,
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

// Fix 1: Accept req and check CRON_SECRET auth header
Deno.serve(async (req) => {
  const auth = req.headers.get('authorization') ?? ''
  if (auth !== `Bearer ${CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 })
  }

  const emailTypes: EmailType[] = ['welcome', 'defense_nudge', 'urgency_reminder']

  for (const emailType of emailTypes) {
    const users = await getEligibleUsers(emailType)
    console.log(`[email-nurture] ${emailType}: ${users.length} eligible`)

    // Fix 4: Replace sequential fan-out with batched concurrency (10 at a time)
    const prefsMap = await getPrefsMap(users.map(u => u.user_id))
    const eligible = users.filter(u => isSubscribedFromPrefs(prefsMap.get(u.user_id), emailType))
    const BATCH = 10
    for (let i = 0; i < eligible.length; i += BATCH) {
      await Promise.allSettled(eligible.slice(i, i + BATCH).map(u => sendEmail(u, emailType)))
    }
  }

  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
