// FYPro — notifications + Telegram bot
//
// POST with { update_id, message, ... }  → Telegram bot (inbound from Telegram servers)
// POST with { action, payload } + JWT    → outbound admin alerts (defense complete, project created)

import { supabaseAdmin } from './_lib/supabase-admin.js'
import { sendTelegramAlert } from './_lib/telegram.js'
import { setCorsHeaders } from './_lib/cors.js'

const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL
const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN

// ─── Formatting helpers ───────────────────────────────────────────────────────

function ngn(kobo) {
  return `₦${Math.round(kobo / 100).toLocaleString('en-NG')}`
}

function usd(val) {
  return `$${parseFloat(val || 0).toFixed(3)}`
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: '2-digit' })
}

function timeAgo(iso) {
  if (!iso) return '—'
  const diff  = Date.now() - new Date(iso).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins  < 60) return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

function bar(value, max, len = 10) {
  const filled = max > 0 ? Math.min(len, Math.round((value / max) * len)) : 0
  return '█'.repeat(filled) + '░'.repeat(len - filled)
}

// ─── Telegram send ────────────────────────────────────────────────────────────

async function sendReply(chatId, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    })
  } catch (err) {
    console.error('[notify/bot] sendReply failed:', err.message)
  }
}

// ─── Bot commands ─────────────────────────────────────────────────────────────

async function cmdStats() {
  const today    = new Date().toISOString().slice(0, 10)
  const todayISO = `${today}T00:00:00.000Z`
  const weekAgo  = new Date(Date.now() - 7 * 24 * 3600000).toISOString()
  const cap      = parseFloat(process.env.DAILY_CAP_USD || '10')

  const [authRes, paymentsRes, usageRes] = await Promise.all([
    supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 }),
    supabaseAdmin.from('payments').select('user_id').eq('status', 'success'),
    supabaseAdmin.from('daily_usage').select('total_cost_usd').eq('date', today).maybeSingle(),
  ])

  const users       = authRes.data?.users || []
  const totalUsers  = users.length
  const activeToday = users.filter(u => u.last_sign_in_at >= todayISO).length
  const activeWeek  = users.filter(u => u.last_sign_in_at >= weekAgo).length
  const paidIds     = new Set((paymentsRes.data || []).map(p => p.user_id))
  const totalPaid   = paidIds.size
  const conversion  = totalUsers > 0 ? ((totalPaid / totalUsers) * 100).toFixed(1) : '0.0'
  const spent       = parseFloat(usageRes.data?.total_cost_usd || 0)
  const capPct      = cap > 0 ? ((spent / cap) * 100).toFixed(1) : '0.0'

  return `📊 <b>FYPro Stats</b> — ${today}

👥 Total users: <b>${totalUsers}</b>
🟢 Active today: <b>${activeToday}</b>
📅 Active this week: <b>${activeWeek}</b>
💳 Paid users: <b>${totalPaid}</b>
📈 Conversion: <b>${conversion}%</b>
💸 API spend: <b>${usd(spent)}</b> (${capPct}% of cap)`
}

async function cmdRevenue() {
  const { data: payments } = await supabaseAdmin
    .from('payments')
    .select('tier, amount_kobo')
    .eq('status', 'success')

  const tiers = {
    student_pack:  { count: 0, kobo: 0 },
    defense_pack:  { count: 0, kobo: 0 },
    project_reset: { count: 0, kobo: 0 },
  }
  let totalKobo = 0
  for (const p of payments || []) {
    totalKobo += p.amount_kobo || 0
    if (tiers[p.tier]) {
      tiers[p.tier].count++
      tiers[p.tier].kobo += p.amount_kobo || 0
    }
  }

  return `💰 <b>Revenue Breakdown</b>

✅ Student Pack: <b>${tiers.student_pack.count}x</b> → ${ngn(tiers.student_pack.kobo)}
🛡️ Defense Pack: <b>${tiers.defense_pack.count}x</b> → ${ngn(tiers.defense_pack.kobo)}
🔄 Project Reset: <b>${tiers.project_reset.count}x</b> → ${ngn(tiers.project_reset.kobo)}

💵 Total: <b>${ngn(totalKobo)}</b>`
}

async function cmdUsers() {
  const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: 1000, page: 1 })
  const latest = (data?.users || [])
    .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
    .slice(0, 5)

  const ids = latest.map(u => u.id)
  const { data: payments } = await supabaseAdmin
    .from('payments')
    .select('user_id, tier')
    .eq('status', 'success')
    .in('user_id', ids)

  const paidMap = {}
  for (const p of payments || []) {
    if (!paidMap[p.user_id]) paidMap[p.user_id] = []
    paidMap[p.user_id].push(p.tier)
  }

  const lines = latest.map(u => {
    const tiers = paidMap[u.id] || []
    const plan  = tiers.includes('defense_pack') ? '🛡️'
                : tiers.length > 0               ? '✅'
                :                                  '🆓'
    return `${plan} ${u.email}\n    ${fmtDate(u.created_at)}`
  }).join('\n\n')

  return `👥 <b>Last 5 Signups</b>\n\n${lines}`
}

async function cmdSpend() {
  const today = new Date().toISOString().slice(0, 10)
  const cap   = parseFloat(process.env.DAILY_CAP_USD || '10')

  const { data } = await supabaseAdmin
    .from('daily_usage')
    .select('*')
    .eq('date', today)
    .maybeSingle()

  if (!data) return `💸 <b>API Spend — ${today}</b>\n\nNo usage recorded today yet.`

  const spent  = parseFloat(data.total_cost_usd || 0)
  const pct    = cap > 0 ? spent / cap : 0
  const status = pct >= 1   ? '🔴 CAP HIT'
               : pct >= 0.8 ? '🔶 Warning'
               :              '🟢 OK'

  return `💸 <b>API Spend — ${today}</b>

${bar(spent, cap)} ${(pct * 100).toFixed(1)}%
💵 ${usd(spent)} of $${cap.toFixed(2)} cap
📬 Requests: <b>${data.request_count || 0}</b>
🔤 Tokens in: <b>${(data.total_tokens_in || 0).toLocaleString()}</b>
🔤 Tokens out: <b>${(data.total_tokens_out || 0).toLocaleString()}</b>
Status: ${status}`
}

async function cmdErrors() {
  const { data: rows } = await supabaseAdmin
    .from('system_logs')
    .select('created_at, feature, source, plain_message')
    .eq('severity', 'error')
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!rows || rows.length === 0) return '✅ <b>No unresolved errors</b>'

  const lines = rows.map(r => {
    const feature = r.feature || r.source || '?'
    const msg     = (r.plain_message || '—').slice(0, 80)
    return `🔴 [${feature}] — ${timeAgo(r.created_at)}\n    ${msg}`
  }).join('\n\n')

  return `🔴 <b>Last 5 Errors</b>\n\n${lines}`
}

async function cmdPayments() {
  const { data: rows } = await supabaseAdmin
    .from('payments')
    .select('user_id, tier, amount_kobo, status, created_at')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!rows || rows.length === 0) return '💳 <b>No payments yet</b>'

  const userIds = [...new Set(rows.map(r => r.user_id).filter(Boolean))]
  const emailMap = {}
  await Promise.all(
    userIds.map(async uid => {
      try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(uid)
        if (user) emailMap[uid] = user.email
      } catch {}
    })
  )

  const TIER = {
    student_pack:  'Student Pack',
    defense_pack:  'Defense Pack',
    project_reset: 'Project Reset',
  }

  const lines = rows.map(r => {
    const email = emailMap[r.user_id] || '—'
    const plan  = TIER[r.tier] || r.tier
    const icon  = r.status === 'success' ? '✅' : r.status === 'failed' ? '❌' : '⏳'
    return `${icon} ${email}\n    ${plan} — ${ngn(r.amount_kobo || 0)} — ${fmtDate(r.created_at)}`
  }).join('\n\n')

  return `💳 <b>Last 5 Payments</b>\n\n${lines}`
}

async function cmdHealth() {
  const today = new Date().toISOString().slice(0, 10)
  const cap   = parseFloat(process.env.DAILY_CAP_USD || '10')

  const [sbOk, redisOk, usageRes] = await Promise.all([
    supabaseAdmin.from('daily_usage').select('date').limit(1).then(() => true).catch(() => false),
    UPSTASH_URL && UPSTASH_TOKEN
      ? fetch(`${UPSTASH_URL}/ping`, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } })
          .then(r => r.ok).catch(() => false)
      : Promise.resolve(null),
    supabaseAdmin.from('daily_usage').select('total_cost_usd').eq('date', today).maybeSingle(),
  ])

  const sbStatus    = sbOk ? '🟢 OK' : '🔴 Error'
  const redisStatus = redisOk === null ? '⚠️ Not configured'
                    : redisOk          ? '🟢 OK'
                    :                   '🔴 Error'

  const spent = parseFloat(usageRes.data?.total_cost_usd || 0)
  const pct   = cap > 0 ? spent / cap : 0
  const spendStatus = pct >= 1   ? `🔴 CAP HIT — ${usd(spent)} / $${cap}`
                    : pct >= 0.8 ? `🔶 ${(pct * 100).toFixed(0)}% used — ${usd(spent)} / $${cap}`
                    :              `🟢 ${(pct * 100).toFixed(0)}% used — ${usd(spent)} / $${cap}`

  return `🏥 <b>System Health</b>

🗄️ Supabase: ${sbStatus}
⚡ Redis: ${redisStatus}
💸 Spend cap: ${spendStatus}`
}

function cmdHelp() {
  return `🤖 <b>FYPro Admin Bot</b>

<b>Commands:</b>
/stats — users, signups, conversion, spend
/revenue — revenue breakdown by tier
/users — last 5 signups with plan
/spend — API usage and cost today
/errors — last 5 unresolved errors
/payments — last 5 payment records
/health — Supabase, Redis, spend cap
/help — this message`
}

// ─── Telegram bot handler ─────────────────────────────────────────────────────

async function handleTelegramBot(req, res) {
  // Respond 200 immediately so Telegram does not retry on slow queries.
  res.status(200).end()

  const message = req.body?.message
  if (!message?.text) return

  // Security: ignore any chat that is not the admin chat.
  if (String(message.chat.id) !== String(process.env.TELEGRAM_CHAT_ID)) return

  const chatId = message.chat.id
  const text   = (message.text || '').trim().toLowerCase().split('@')[0]

  try {
    let reply
    if      (text.startsWith('/stats'))    reply = await cmdStats()
    else if (text.startsWith('/revenue'))  reply = await cmdRevenue()
    else if (text.startsWith('/users'))    reply = await cmdUsers()
    else if (text.startsWith('/spend'))    reply = await cmdSpend()
    else if (text.startsWith('/errors'))   reply = await cmdErrors()
    else if (text.startsWith('/payments')) reply = await cmdPayments()
    else if (text.startsWith('/health'))   reply = await cmdHealth()
    else if (text.startsWith('/help'))     reply = cmdHelp()
    else return

    await sendReply(chatId, reply)
  } catch (err) {
    console.error('[notify/bot] command error:', err.message)
    await sendReply(chatId, `❌ Error: ${err.message.slice(0, 120)}`)
  }
}

// ─── Outbound notify handler (JWT-authenticated, client-side events) ──────────

async function handleNotify(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).end()

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).end()

  const { action, payload } = req.body || {}
  const email = user.email || 'unknown'

  if (action === 'defense_completed') {
    const score = Number(payload?.score)
    if (!isNaN(score)) {
      await sendTelegramAlert(`🎓 Defense completed: ${email} scored ${score}/10`)
    }
  }

  if (action === 'project_created') {
    const title = String(payload?.title || 'untitled').slice(0, 80)
    await sendTelegramAlert(`📁 New project: ${email} started '${title}'`)
  }

  return res.status(200).json({ ok: true })
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  setCorsHeaders(req, res)
  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST')   return res.status(405).end()

  // Telegram updates always carry update_id; our notify calls never do.
  if (req.body?.update_id !== undefined) return handleTelegramBot(req, res)

  return handleNotify(req, res)
}
