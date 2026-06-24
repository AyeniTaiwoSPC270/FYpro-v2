// FYPro — notifications + Telegram bot
//
// POST with { update_id, message, ... }         → Telegram bot (inbound from Telegram servers)
// POST with { action: 'contact', ... }          → contact form (public, no JWT required)
// POST with { action, payload } + JWT           → outbound admin alerts (defense complete, project created)

import { Resend } from 'resend'
import { Sentry } from './_lib/sentry-server.js'
import { supabaseAdmin } from './_lib/supabase-admin.js'
import { sendTelegramAlert, escapeTgHtml } from './_lib/telegram.js'
import { setCorsHeaders } from './_lib/cors.js'
import { setMaintenanceMode } from './_lib/maintenance.js'
import webpush from 'web-push'

function getWebPush() {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    throw new Error('[push] VAPID keys not configured')
  }
  webpush.setVapidDetails(
    'mailto:hello@fypro.com.ng',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
  )
  return webpush
}

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

function buildBroadcastHtml(body) {
  const safe = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background-color:#060E18;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="height:3px;background-color:#0891B2;border-radius:8px 8px 0 0;"></div>
  <div style="background:linear-gradient(160deg,#0D1B2A 0%,#0a1520 100%);padding:20px 22px;text-align:center;">
    <img src="https://fypro.com.ng/fypro-logo.png" alt="FYPro" height="40" style="display:block;margin:0 auto;" />
  </div>
  <div style="background-color:#0D1B2A;padding:22px 22px 20px;border-radius:0 0 8px 8px;border:1px solid rgba(255,255,255,0.06);border-top:none;">
    <div style="display:inline-block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;border-radius:4px;padding:3px 8px;margin-bottom:14px;border:1px solid rgba(8,145,178,0.3);background:rgba(8,145,178,0.08);color:#22D3EE;">Announcement</div>
    <h1 style="font-size:17px;font-weight:700;color:#f8fafc;line-height:1.35;margin:0 0 14px;">A message from FYPro</h1>
    <div style="background:rgba(8,145,178,0.08);border-left:3px solid #0891B2;border-radius:0 6px 6px 0;padding:12px 16px;margin-bottom:18px;">
      <p style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.75;margin:0;">${safe}</p>
    </div>
    <div style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:18px 0 14px;"></div>
    <p style="font-size:10.5px;color:rgba(255,255,255,0.2);line-height:1.6;margin:0;">You're receiving this because you have an account at fypro.com.ng.<br>FYPro &middot; Lagos, Nigeria</p>
  </div>
</div>
</body></html>`
}

function buildReportEmail({ email, type, description, context }) {
  const typeColor = type === 'error' ? '#DC2626' : '#0066FF'
  const typeLabel = type === 'error' ? 'Error Report' : 'General Report'
  const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head>
<body style="margin:0;padding:0;background-color:#F0F4F8;font-family:Arial,sans-serif;">
<div style="max-width:560px;margin:32px auto;">
  <div style="height:3px;background-color:${typeColor};border-radius:8px 8px 0 0;"></div>
  <div style="background:#0D1B2A;padding:20px 22px;text-align:center;">
    <img src="https://fypro.com.ng/fypro-logo.png" alt="FYPro" height="40" style="display:block;margin:0 auto;" />
  </div>
  <div style="background:#fff;padding:32px;border-radius:0 0 8px 8px;border:1px solid #E5E7EB;border-top:none;">
    <div style="display:inline-block;font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:1px;border-radius:4px;padding:3px 10px;margin-bottom:16px;background:${typeColor}22;color:${typeColor};border:1px solid ${typeColor}55;">${typeLabel}</div>
    <h1 style="font-size:18px;font-weight:700;color:#0D1B2A;margin:0 0 16px;">User Issue Report</h1>
    <div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">From</div><div style="font-size:14px;color:#111827;">${esc(email)}</div></div>
    <div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">URL</div><div style="font-size:14px;color:#111827;">${esc(context.url)}</div></div>
    ${context.step_name ? `<div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">Step</div><div style="font-size:14px;color:#111827;">${esc(context.step_name)}</div></div>` : ''}
    ${context.error_message ? `<div style="margin-bottom:12px;"><div style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:2px;">Error</div><div style="font-size:13px;color:#DC2626;font-family:monospace;background:#FFF5F5;padding:8px 10px;border-radius:4px;">${esc(context.error_message)}</div></div>` : ''}
    <div><div style="font-size:11px;font-weight:600;color:#6B7280;text-transform:uppercase;letter-spacing:0.05em;margin-bottom:6px;">Description</div><div style="font-size:14px;color:#111827;white-space:pre-wrap;background:#F9FAFB;padding:12px;border-radius:6px;border:1px solid #E5E7EB;">${esc(description)}</div></div>
    <hr style="border:none;border-top:1px solid #E5E7EB;margin:24px 0 12px;">
    <p style="font-size:11px;color:#9CA3AF;margin:0;">Manage in <a href="https://www.fypro.com.ng/admin/health" style="color:#0066FF;">Mission Control</a> or use /resolve-report in Telegram.</p>
  </div>
</div>
</body></html>`
}

// ─── Telegram send ────────────────────────────────────────────────────────────

async function sendReply(chatId, text, keyboard = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  const payload = { chat_id: chatId, text, parse_mode: 'HTML' }
  if (keyboard) payload.reply_markup = keyboard
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(8000),
    })
  } catch (err) {
    console.error('[notify/bot] sendReply failed:', err.message)
  }
}

async function editMessage(chatId, messageId, text, keyboard = null) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return false
  const payload = { chat_id: chatId, message_id: messageId, text, parse_mode: 'HTML' }
  if (keyboard) payload.reply_markup = keyboard
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/editMessageText`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(payload),
      signal:  AbortSignal.timeout(8000),
    })
    return r.ok
  } catch (err) {
    console.error('[notify/bot] editMessage failed:', err.message)
    return false
  }
}

async function answerCallbackQuery(callbackQueryId) {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) return
  try {
    await fetch(`https://api.telegram.org/bot${token}/answerCallbackQuery`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ callback_query_id: callbackQueryId }),
      signal:  AbortSignal.timeout(4000),
    })
  } catch {}
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

async function listAllUsers() {
  const pageSize = 1000
  let page = 1
  let all  = []
  while (true) {
    const { data } = await supabaseAdmin.auth.admin.listUsers({ perPage: pageSize, page })
    const users = data?.users || []
    all = all.concat(users)
    if (users.length < pageSize) break
    page++
  }
  return all
}

// ─── Bot commands ─────────────────────────────────────────────────────────────

async function cmdStats() {
  const today    = new Date().toISOString().slice(0, 10)
  const todayISO = `${today}T00:00:00.000Z`
  const weekAgo  = new Date(Date.now() - 7 * 24 * 3600000).toISOString()
  const cap      = parseFloat(process.env.DAILY_CAP_USD || '10')

  const [users, paymentsRes, usageRes] = await Promise.all([
    listAllUsers(),
    supabaseAdmin.from('payments').select('user_id').eq('status', 'success'),
    supabaseAdmin.from('daily_usage').select('total_cost_usd').eq('date', today).maybeSingle(),
  ])

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
  const users  = await listAllUsers()
  const latest = users
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
    .select('id, created_at, feature, source, plain_message')
    .eq('severity', 'error')
    .eq('resolved', false)
    .order('created_at', { ascending: false })
    .limit(5)

  if (!rows || rows.length === 0) return '✅ <b>No unresolved errors</b>'

  const lines = rows.map(r => {
    const feature = r.feature || r.source || '?'
    const msg     = (r.plain_message || '—').slice(0, 80)
    const shortId = r.id?.slice(0, 8) || '?'
    return `🔴 [${feature}] — ${timeAgo(r.created_at)}\n    ${msg}\n    <code>/resolve ${shortId}</code>`
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

  const [sbOk, redisOk, usageRes, claudeStatus] = await Promise.all([
    supabaseAdmin.from('daily_usage').select('date').limit(1).then(() => true).catch(() => false),
    UPSTASH_URL && UPSTASH_TOKEN
      ? fetch(`${UPSTASH_URL}/ping`, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } })
          .then(r => r.ok).catch(() => false)
      : Promise.resolve(null),
    supabaseAdmin.from('daily_usage').select('total_cost_usd').eq('date', today).maybeSingle(),
    (async () => {
      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) return '⚠️ Key not set'
      try {
        const r = await fetch('https://api.anthropic.com/v1/models', {
          headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
          signal:  AbortSignal.timeout(5000),
        })
        return r.status < 500 ? '🟢 OK' : '🔴 Error'
      } catch {
        return '🔴 Unreachable'
      }
    })(),
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
🤖 Claude API: ${claudeStatus}
💸 Spend cap: ${spendStatus}`
}

async function cmdToday() {
  const today    = new Date().toISOString().slice(0, 10)
  const todayISO = `${today}T00:00:00.000Z`
  const cap      = parseFloat(process.env.DAILY_CAP_USD || '10')

  const [
    usageRes,
    signupsTodayRes,
    revTodayRes,
    revTotalRes,
    errRes,
    defensesTodayRes,
    certsTodayRes,
    projectsTodayRes,
  ] = await Promise.all([
    supabaseAdmin.from('daily_usage').select('total_cost_usd, request_count').eq('date', today).maybeSingle(),
    supabaseAdmin.from('users').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
    supabaseAdmin.from('payments').select('amount_kobo').eq('status', 'success').gte('created_at', todayISO),
    supabaseAdmin.from('payments').select('amount_kobo').eq('status', 'success'),
    supabaseAdmin.from('system_logs').select('*', { count: 'exact', head: true }).eq('severity', 'error').eq('resolved', false),
    supabaseAdmin.from('defense_sessions').select('*', { count: 'exact', head: true }).not('completed_at', 'is', null).gte('completed_at', todayISO),
    supabaseAdmin.from('defense_certificates').select('*', { count: 'exact', head: true }).gte('issued_at', todayISO),
    supabaseAdmin.from('projects').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
  ])

  const spent       = parseFloat(usageRes.data?.total_cost_usd || 0)
  const capPct      = cap > 0 ? ((spent / cap) * 100).toFixed(1) : '0.0'
  const spendIcon   = spent / cap >= 1 ? '🔴' : spent / cap >= 0.8 ? '🔶' : '🟢'
  const revToday    = (revTodayRes.data || []).reduce((s, p) => s + (p.amount_kobo || 0), 0)
  const revTotal    = (revTotalRes.data || []).reduce((s, p) => s + (p.amount_kobo || 0), 0)
  const errorCount  = errRes.count || 0
  const errorIcon   = errorCount > 0 ? '🔴' : '✅'

  return `📋 <b>Today — ${today}</b>

👤 Signups: <b>${signupsTodayRes.count || 0} new</b>
📁 Projects: <b>${projectsTodayRes.count || 0} new</b>
🎓 Defenses: <b>${defensesTodayRes.count || 0} completed</b>
🏆 Certs: <b>${certsTodayRes.count || 0} issued</b>

💰 Revenue today: <b>${ngn(revToday)}</b>
💵 All-time total: <b>${ngn(revTotal)}</b>

${spendIcon} API spend: <b>${usd(spent)}</b> (${capPct}% of $${cap})
📬 Requests: <b>${usageRes.data?.request_count || 0}</b>
${errorIcon} Unresolved errors: <b>${errorCount}</b>`
}

async function cmdProjects() {
  const { data: rows } = await supabaseAdmin
    .from('projects')
    .select('id, title, current_step, created_at, user_id')
    .order('created_at', { ascending: false })
    .limit(5)

  if (!rows || rows.length === 0) return '📁 <b>No projects yet</b>'

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

  const STEP_LABELS = {
    topic_validator:     'Step 1',
    chapter_architect:   'Step 2',
    methodology_advisor: 'Step 3',
    writing_planner:     'Step 5',
    defense_prep:        'Step 6',
  }

  const lines = rows.map(r => {
    const email = emailMap[r.user_id] || '—'
    const step  = STEP_LABELS[r.current_step] || r.current_step || '—'
    const title = (r.title || 'Untitled').slice(0, 50)
    return `📝 <b>${title}</b>\n    ${email} · ${step} · ${timeAgo(r.created_at)}`
  }).join('\n\n')

  return `📁 <b>Last 5 Projects</b>\n\n${lines}`
}

async function cmdCerts() {
  const today    = new Date().toISOString().slice(0, 10)
  const todayISO = `${today}T00:00:00.000Z`

  const [totalRes, todayRes, lastRow] = await Promise.all([
    supabaseAdmin.from('defense_certificates').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('defense_certificates').select('*', { count: 'exact', head: true }).gte('issued_at', todayISO),
    supabaseAdmin.from('defense_certificates')
      .select('certificate_number, issued_at, user_id, score')
      .order('issued_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  let lastLine = '—'
  if (lastRow.data) {
    let email = '—'
    try {
      const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(lastRow.data.user_id)
      if (user) email = user.email
    } catch {}
    lastLine = `<code>${lastRow.data.certificate_number}</code> · ${email} · ${lastRow.data.score}/10 · ${timeAgo(lastRow.data.issued_at)}`
  }

  return `🏆 <b>Defense Certificates</b>

Total issued: <b>${totalRes.count || 0}</b>
Today: <b>${todayRes.count || 0}</b>
Last: ${lastLine}`
}

async function cmdReferrals() {
  const today    = new Date().toISOString().slice(0, 10)
  const todayISO = `${today}T00:00:00.000Z`

  const [totalRes, qualifiedRes, rewardedRes, todayRes] = await Promise.all([
    supabaseAdmin.from('referrals').select('*', { count: 'exact', head: true }),
    supabaseAdmin.from('referrals').select('*', { count: 'exact', head: true }).eq('status', 'qualified'),
    supabaseAdmin.from('referrals').select('*', { count: 'exact', head: true }).eq('status', 'rewarded'),
    supabaseAdmin.from('referrals').select('*', { count: 'exact', head: true }).gte('created_at', todayISO),
  ])

  return `🔗 <b>Referral Stats</b>

Total tracked: <b>${totalRes.count || 0}</b>
Qualified: <b>${qualifiedRes.count || 0}</b>
Rewarded (milestone credits): <b>${rewardedRes.count || 0}</b>
Today: <b>${todayRes.count || 0} new</b>`
}

async function cmdLogs() {
  const { data: rows } = await supabaseAdmin
    .from('system_logs')
    .select('created_at, feature, source, plain_message, severity')
    .order('created_at', { ascending: false })
    .limit(10)

  if (!rows || rows.length === 0) return '📜 <b>No system logs</b>'

  const SEV_ICON = { error: '🔴', warning: '🟡', info: '🔵' }

  const lines = rows.map(r => {
    const icon    = SEV_ICON[r.severity] || '⚪'
    const feature = r.feature || r.source || '?'
    const msg     = (r.plain_message || '—').slice(0, 80)
    return `${icon} [${feature}] — ${timeAgo(r.created_at)}\n    ${msg}`
  }).join('\n\n')

  return `📜 <b>System Logs (last 10)</b>\n\n${lines}`
}

async function cmdResolve(id) {
  if (!id || id.length < 4) return '❌ Usage: /resolve &lt;log-id-prefix&gt; (min 4 chars)'

  const safeId = id.replace(/[%_]/g, '')
  const { data: rows } = await supabaseAdmin
    .from('system_logs')
    .select('id, plain_message')
    .ilike('id', `${safeId}%`)
    .eq('resolved', false)
    .limit(2)

  if (!rows || rows.length === 0) return `❌ No unresolved log found matching <code>${id}</code>`
  if (rows.length > 1) return `⚠️ Multiple matches for <code>${id}</code> — use more characters`

  const { error } = await supabaseAdmin
    .from('system_logs')
    .update({ resolved: true, resolved_at: new Date().toISOString() })
    .eq('id', rows[0].id)

  if (error) return `❌ Failed to resolve: ${error.message}`

  return `✅ Resolved: ${(rows[0].plain_message || '—').slice(0, 80)}`
}

async function cmdMaintenance(args) {
  const onOff = args[0]?.toLowerCase()
  if (onOff !== 'on' && onOff !== 'off') {
    return '❌ Usage: /maintenance on | /maintenance off'
  }

  const enabled = onOff === 'on'

  try {
    await setMaintenanceMode(enabled)
    const status = enabled ? '🔴 ENABLED' : '🟢 DISABLED'
    return `🔧 Maintenance mode ${status}`
  } catch (err) {
    return `❌ Failed to toggle maintenance mode: ${err.message}`
  }
}

async function cmdBroadcast(body, paidOnly) {
  // 1. Fetch all auth users
  const allUsers = await listAllUsers()

  // 2. Narrow to paid users if requested
  let targetUsers = allUsers
  if (paidOnly) {
    const { data: payments } = await supabaseAdmin
      .from('payments')
      .select('user_id')
      .eq('status', 'success')
    const paidIds = new Set((payments || []).map(p => p.user_id))
    targetUsers = allUsers.filter(u => paidIds.has(u.id))
  }

  // 3. Remove globally unsubscribed users
  const { data: optedOut } = await supabaseAdmin
    .from('email_preferences')
    .select('user_id')
    .eq('unsubscribed_all', true)
  const optedOutIds = new Set((optedOut || []).map(r => r.user_id))
  targetUsers = targetUsers.filter(u => u.email && !optedOutIds.has(u.id))

  if (targetUsers.length === 0) return 0

  // 4. Send emails in batches of 10
  const resend = new Resend(process.env.RESEND_API_KEY)
  const html   = buildBroadcastHtml(body)
  let sentCount = 0

  for (let i = 0; i < targetUsers.length; i += 10) {
    const batch = targetUsers.slice(i, i + 10)
    await Promise.all(
      batch.map(async u => {
        try {
          const { error } = await resend.emails.send({
            from:    'FYPro <hello@fypro.com.ng>',
            to:      u.email,
            subject: 'FYPro Announcement',
            html,
          })
          if (!error) sentCount++
        } catch (err) {
          console.error('[notify/broadcast] Resend failed for', u.email, err.message)
        }
      })
    )
  }

  // 5. Bulk-insert in-app notifications (best-effort)
  const { error: insertError } = await supabaseAdmin
    .from('notifications')
    .insert(
      targetUsers.map(u => ({
        user_id: u.id,
        type:    'announcement',
        title:   'Announcement from FYPro',
        message: body,
      }))
    )
  if (insertError) {
    console.error('[notify/broadcast] notification insert failed:', insertError.message)
  }

  return sentCount
}

async function cmdReports() {
  const { data: rows } = await supabaseAdmin
    .from('user_reports')
    .select('id, user_id, type, description, context, created_at')
    .eq('status', 'open')
    .order('created_at', { ascending: false })
    .limit(10)

  if (!rows || rows.length === 0) return '✅ <b>No open reports</b>'

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

  const lines = rows.map((r, i) => {
    const email   = emailMap[r.user_id] || '—'
    const loc     = r.context?.step_name || r.context?.url || '—'
    const preview = (r.description || '').slice(0, 60)
    const shortId = (r.id || '').slice(0, 8)
    return (
      `${i + 1}. [${r.type}] ${escapeTgHtml(email)}\n` +
      `    ${escapeTgHtml(loc)} · ${timeAgo(r.created_at)}\n` +
      `    "${escapeTgHtml(preview)}"\n` +
      `    <code>/resolve-report ${shortId}</code>`
    )
  }).join('\n\n')

  return `📋 <b>Open Reports (${rows.length})</b>\n\n${lines}`
}

async function cmdRatings() {
  const { data: rows } = await supabaseAdmin
    .from('user_ratings')
    .select('user_id, stars, trigger_type, suggestion_feature, suggestion_ui, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (!rows || rows.length === 0) return '⭐ <b>No ratings yet</b>'

  const weekAgo    = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const twoWksAgo  = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const total      = rows.length
  const avg        = rows.reduce((s, r) => s + r.stars, 0) / total
  const withText   = rows.filter(r => r.suggestion_feature || r.suggestion_ui).length
  const thisWeek   = rows.filter(r => r.created_at >= weekAgo).length
  const lastWeek   = rows.filter(r => r.created_at < weekAgo && r.created_at >= twoWksAgo).length
  const delta      = thisWeek - lastWeek
  const deltaStr   = delta >= 0 ? `↑${delta}` : `↓${Math.abs(delta)}`
  const starStr    = '★'.repeat(Math.round(avg)) + '☆'.repeat(5 - Math.round(avg))

  const dsRows = rows.filter(r => r.trigger_type === 'defense_simulator')
  const smRows = rows.filter(r => r.trigger_type === 'steps_milestone')
  const dsAvg  = dsRows.length ? (dsRows.reduce((s,r) => s+r.stars, 0) / dsRows.length).toFixed(1) : '—'
  const smAvg  = smRows.length ? (smRows.reduce((s,r) => s+r.stars, 0) / smRows.length).toFixed(1) : '—'

  const recent5  = rows.slice(0, 5)
  const emailMap = {}
  await Promise.all(
    [...new Set(recent5.map(r => r.user_id))].map(async uid => {
      try {
        const { data: { user } } = await supabaseAdmin.auth.admin.getUserById(uid)
        if (user) emailMap[uid] = (user.email || '').split('@')[0]
      } catch {}
    })
  )

  const lines = recent5.map((r, i) => {
    const name    = escapeTgHtml(emailMap[r.user_id] || '—')
    const stars   = '★'.repeat(r.stars) + '☆'.repeat(5 - r.stars)
    const feat    = r.suggestion_feature
      ? `\n   💡 "${escapeTgHtml(r.suggestion_feature.slice(0, 80))}"`
      : '\n   💡 —'
    const ui      = r.suggestion_ui
      ? `\n   🎨 "${escapeTgHtml(r.suggestion_ui.slice(0, 80))}"`
      : '\n   🎨 —'
    return `${i + 1}. ${name} · ${stars} · ${r.trigger_type}${feat}${ui}`
  }).join('\n\n')

  return (
    `⭐ <b>Ratings Summary</b>\n\n` +
    `Avg score:   ${starStr}  ${avg.toFixed(1)} / 5\n` +
    `Total:       ${total} ratings\n` +
    `With text:   ${withText} (${Math.round((withText/total)*100)}%)\n` +
    `This week:   ${thisWeek}  ${deltaStr} vs last\n\n` +
    `By trigger:\n` +
    `🎓 Defense Simulator  — ★${dsAvg}  (${dsRows.length})\n` +
    `📋 Steps Milestone    — ★${smAvg}  (${smRows.length})\n\n` +
    `── Recent submissions ──\n\n` +
    lines
  )
}

// ─── /data command — query any of the 29 allowed tables ─────────────────────

const DATA_KEY_COLS = {
  users:                ['id','email','full_name','university','created_at'],
  user_entitlements:    ['user_id','paid_features','total_lifetime_paid_ngn'],
  projects:             ['id','user_id','title','status','current_step','created_at'],
  project_steps:        ['id','project_id','step_name','completed_at'],
  defense_sessions:     ['id','user_id','total_score','completed_at'],
  defense_turns:        ['id','session_id','turn_number','examiner_question'],
  defense_certificates: ['id','user_id','certificate_number','issued_at'],
  defense_credits:      ['user_id','reason','source_referral_id'],
  payments:             ['id','user_id','amount_kobo','tier','status','created_at'],
  user_achievements:    ['user_id','achievement_key','earned_at'],
  notifications:        ['id','user_id','title','read','created_at'],
  push_subscriptions:   ['user_id','last_nudged_at','created_at'],
  app_config:           ['key','value','updated_at'],
  daily_usage:          ['date','total_cost_usd','request_count'],
  institutions:         ['id','name','short_name'],
  user_onboarding:      ['user_id','referral_source','primary_goal','expected_defence_band'],
  referrals:            ['id','referrer_id','referred_id','created_at'],
  email_log:            ['id','user_id','type','sent_at'],
  email_preferences:    ['user_id','notify_email','notify_push'],
  generation_failures:  ['id','user_id','feature','error_message','created_at'],
  auth_attempts:        ['id','email','success','created_at'],
  payment_issues:       ['id','user_id','description','created_at'],
  feature_feedback:     ['id','user_id','feature','rating','created_at'],
  response_times:       ['id','endpoint','duration_ms','created_at'],
  system_logs:          ['id','action','user_id','created_at'],
  user_progress:        ['user_id','current_step','updated_at'],
  admin_users:          ['id','email','created_at'],
  user_reports:         ['id','user_id','reason','created_at'],
  user_ratings:         ['id','user_id','rating','feedback','created_at'],
}

// Precomputed set of allowed table names — avoids rebuilding on every /data call
const ALLOWED_DATA_TABLES = new Set(Object.keys(DATA_KEY_COLS))

async function cmdData(args) {
  const table = ((args && args[0]) || '').trim().split(/\s+/)[0].toLowerCase()

  if (!table || !ALLOWED_DATA_TABLES.has(table)) {
    const list = Object.keys(DATA_KEY_COLS).join(', ')
    return `❓ Usage: /data &lt;table&gt;\n\nAvailable tables:\n${list}`
  }

  // Use select('*') and discover real columns from the row — avoids hardcoded column mismatches
  let queryData, queryError
  const ordered = await supabaseAdmin
    .from(table)
    .select('*')
    .order('created_at', { ascending: false })
    .limit(5)

  if (ordered.error && (ordered.error.code === 'PGRST116' || ordered.error.message?.includes('created_at'))) {
    // Table has no created_at column — retry without order
    const unordered = await supabaseAdmin
      .from(table)
      .select('*')
      .limit(5)
    queryData  = unordered.data
    queryError = unordered.error
  } else {
    queryData  = ordered.data
    queryError = ordered.error
  }

  if (queryError) return `❌ Error querying ${table}: ${escapeTgHtml(queryError.message)}`
  if (!queryData || queryData.length === 0) return `📭 No rows in <code>${table}</code>`

  // Show first 5 columns to keep message compact
  const displayCols = Object.keys(queryData[0]).slice(0, 5)

  const rows = queryData.map((row, i) => {
    const fields = displayCols.map(c => {
      let v = row[c]
      if (v === null || v === undefined) v = '—'
      else if (typeof v === 'object') {
        const s = JSON.stringify(v)
        v = escapeTgHtml(s.slice(0, 40) + (s.length > 40 ? '…' : ''))
      } else {
        v = escapeTgHtml(String(v).slice(0, 60))
      }
      return `  ${c}: ${v}`
    }).join('\n')
    return `[${i + 1}]\n${fields}`
  }).join('\n\n')

  const { count } = await supabaseAdmin
    .from(table)
    .select('*', { count: 'exact', head: true })

  const footer = count !== null ? `\nTotal rows: ${count}` : ''
  const msg = `📊 <b>${table}</b> (last 5)${footer}\n<pre>${rows}</pre>`
  return msg
}

async function cmdResolveReport(id) {
  if (!id || id.length < 4) return '❌ Usage: /resolve-report &lt;id-prefix&gt; (min 4 chars)'

  const safeId = id.replace(/[%_]/g, '')
  const { data: rows } = await supabaseAdmin
    .from('user_reports')
    .select('id, description')
    .ilike('id', `${safeId}%`)
    .neq('status', 'resolved')
    .limit(2)

  if (!rows || rows.length === 0) return `❌ No open report found matching <code>${id}</code>`
  if (rows.length > 1) return `⚠️ Multiple matches for <code>${id}</code> — use more characters`

  const { error } = await supabaseAdmin
    .from('user_reports')
    .update({ status: 'resolved' })
    .eq('id', rows[0].id)

  if (error) return `❌ Failed to resolve report: ${error.message}`
  return `✅ Report resolved: "${(rows[0].description || '').slice(0, 80)}"`
}

async function cmdSetPhoto(chatId) {
  const url   = UPSTASH_URL
  const token = UPSTASH_TOKEN
  if (!url || !token) return '❌ Redis not configured — cannot set pending flag.'

  await fetch(`${url}/set/telegram_setphoto_pending/1/ex/300`, {
    method:  'POST',
    headers: { Authorization: `Bearer ${token}` },
  })

  return '📷 Send your photo now. You have 5 minutes.'
}

async function handleIncomingPhoto(chatId, photoArray) {
  const url   = UPSTASH_URL
  const token = UPSTASH_TOKEN
  if (!url || !token) {
    return '❌ Redis not configured.'
  }

  // Check pending flag
  const flagRes = await fetch(`${url}/get/telegram_setphoto_pending`, {
    headers: { Authorization: `Bearer ${token}` },
  }).then(r => r.json()).catch(() => null)

  if (!flagRes?.result) return null // no pending flag — ignore silently

  const botToken = process.env.TELEGRAM_BOT_TOKEN
  if (!botToken) return '❌ Bot token not configured.'

  // Largest photo is last element
  const largest = photoArray[photoArray.length - 1]
  const fileId  = largest?.file_id
  if (!fileId) return '❌ Could not read photo file ID.'

  try {
    // 1. Get file path from Telegram
    const fileRes = await fetch(
      `https://api.telegram.org/bot${botToken}/getFile?file_id=${fileId}`,
      { signal: AbortSignal.timeout(8000) }
    )
    const fileData = await fileRes.json()
    const filePath = fileData.result?.file_path
    if (!filePath) throw new Error('no file_path in getFile response')

    // 2. Download binary
    const photoRes = await fetch(
      `https://api.telegram.org/file/bot${botToken}/${filePath}`,
      { signal: AbortSignal.timeout(15000) }
    )
    if (!photoRes.ok) throw new Error(`photo download failed: ${photoRes.status}`)
    const photoBuffer = await photoRes.arrayBuffer()

    // 3. Upload to Supabase Storage (upsert — always overwrites founder/profile.jpg)
    const { error: uploadErr } = await supabaseAdmin.storage
      .from('admin-assets')
      .upload('founder/profile.jpg', photoBuffer, {
        contentType: 'image/jpeg',
        upsert:      true,
      })
    if (uploadErr) throw uploadErr

    // 4. Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('admin-assets')
      .getPublicUrl('founder/profile.jpg')

    // Cache-bust URL to prevent stale images on browser update
    const bustUrl = `${publicUrl}?v=${Date.now()}`

    // 5. Persist URL in app_config
    const { error: dbErr } = await supabaseAdmin
      .from('app_config')
      .upsert({ key: 'founder_photo', value: bustUrl, updated_at: new Date().toISOString() })
    if (dbErr) throw dbErr

    // 6. Clear pending flag
    await fetch(`${url}/del/telegram_setphoto_pending`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
    })

    return '✅ Founder photo updated!'
  } catch (err) {
    console.error('[notify/setphoto]', err.message)
    // Clear flag on error so admin can retry immediately
    await fetch(`${url}/del/telegram_setphoto_pending`, {
      method:  'POST',
      headers: { Authorization: `Bearer ${token}` },
    }).catch(() => {})
    return `❌ Upload failed: ${err.message}. Try again.`
  }
}

function cmdHelp() {
  return `🛡️ <b>FYPro Admin Bot</b>

Tap a button or type a command:

<b>Quick view</b>
/today — combined daily snapshot
/stats — users, conversion, spend
/revenue — revenue by tier
/health — system status

<b>Data</b>
/users — last 5 signups
/projects — last 5 projects
/payments — last 5 payments
/certs — certificate stats
/referrals — referral stats
/reports — open user reports
/ratings — star rating summary
/spend — API spend detail
/errors — unresolved errors
/logs — recent system logs

<b>Actions</b>
/resolve &lt;id&gt; — mark error resolved
/resolve-report &lt;id&gt; — mark report resolved
/maintenance on|off — toggle maintenance mode

<b>Database</b>
/data &lt;table&gt; — browse last 5 rows of any of the 29 tables`
}

const KEYBOARD = {
  inline_keyboard: [
    [
      { text: '📋 Today',     callback_data: 'today'     },
      { text: '🏥 Health',    callback_data: 'health'    },
    ],
    [
      { text: '📊 Stats',     callback_data: 'stats'     },
      { text: '💰 Revenue',   callback_data: 'revenue'   },
    ],
    [
      { text: '👥 Users',     callback_data: 'users'     },
      { text: '💸 Spend',     callback_data: 'spend'     },
    ],
    [
      { text: '📁 Projects',  callback_data: 'projects'  },
      { text: '🏆 Certs',     callback_data: 'certs'     },
    ],
    [
      { text: '🔴 Errors',    callback_data: 'errors'    },
      { text: '💳 Payments',  callback_data: 'payments'  },
    ],
    [
      { text: '🔗 Referrals', callback_data: 'referrals' },
      { text: '📜 Logs',      callback_data: 'logs'      },
    ],
    [
      { text: '📋 Reports',   callback_data: 'reports'   },
      { text: '⭐ Ratings',   callback_data: 'ratings'   },
    ],
  ],
}

// ─── Telegram bot handler ─────────────────────────────────────────────────────

async function runCommand(key, args = []) {
  if      (key === 'today'       ) return cmdToday()
  else if (key === 'stats'       ) return cmdStats()
  else if (key === 'revenue'     ) return cmdRevenue()
  else if (key === 'users'       ) return cmdUsers()
  else if (key === 'spend'       ) return cmdSpend()
  else if (key === 'errors'      ) return cmdErrors()
  else if (key === 'payments'    ) return cmdPayments()
  else if (key === 'health'      ) return cmdHealth()
  else if (key === 'projects'    ) return cmdProjects()
  else if (key === 'certs'       ) return cmdCerts()
  else if (key === 'referrals'   ) return cmdReferrals()
  else if (key === 'logs'        ) return cmdLogs()
  else if (key === 'resolve'         ) return cmdResolve(args[0])
  else if (key === 'resolve-report'  ) return cmdResolveReport(args[0])
  else if (key === 'reports'         ) return cmdReports()
  else if (key === 'ratings'         ) return cmdRatings()
  else if (key === 'maintenance'     ) return cmdMaintenance(args)
  else if (key === 'data'            ) return cmdData(args)
  else if (key === 'help'            ) return cmdHelp()
  return null
}

async function handleTelegramBot(req, res) {
  // Verify the shared secret Telegram sends in every webhook request.
  // Set when registering the webhook: POST api.telegram.org/bot<TOKEN>/setWebhook
  //   with body { url: "...", secret_token: process.env.TELEGRAM_WEBHOOK_SECRET }
  // If the env var is not set, fail closed — reject all inbound updates.
  const webhookSecret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!webhookSecret) {
    console.error('[notify/bot] TELEGRAM_WEBHOOK_SECRET is not configured — rejecting update')
    return res.status(401).end()
  }
  const incoming = req.headers['x-telegram-bot-api-secret-token'] || ''
  if (incoming !== webhookSecret) {
    console.error('[notify/bot] webhook secret mismatch — possible spoofed request')
    return res.status(401).end()
  }

  const body = req.body

  // ── Button tap (callback_query) — edit in-place ──────────────────────────
  if (body?.callback_query) {
    const cq      = body.callback_query
    const chatId  = cq.message?.chat?.id
    const msgId   = cq.message?.message_id
    const admId   = String(process.env.TELEGRAM_CHAT_ID)

    if (String(chatId) !== admId) return res.status(200).end()

    try {
      const reply = await runCommand(cq.data, [])
      if (reply) {
        const edited = await editMessage(chatId, msgId, reply, KEYBOARD)
        if (!edited) await sendReply(chatId, reply, KEYBOARD)
      }
      await answerCallbackQuery(cq.id)
    } catch (err) {
      console.error('[notify/bot] callback error:', err.message)
      await answerCallbackQuery(cq.id)
      await sendReply(chatId, `❌ Command failed — check server logs`, KEYBOARD)
    }

    return res.status(200).end()
  }

  // ── Typed command or photo message ──────────────────────────────────────
  const message = body?.message
  if (!message) return res.status(200).end()

  const isFromAdmin = String(message.chat?.id) === String(process.env.TELEGRAM_CHAT_ID)
  if (!isFromAdmin) return res.status(200).end()

  const chatId = message.chat.id

  // ── Photo message (only process when /setphoto pending flag is set) ──────
  if (message.photo) {
    const reply = await handleIncomingPhoto(chatId, message.photo)
    if (reply) await sendReply(chatId, reply)
    return res.status(200).end()
  }

  if (!message?.text) return res.status(200).end()

  const msgText = (message.text || '').trim()

  // ── Broadcast commands — handled before generic command parser ───────────
  const lowerMsg = msgText.toLowerCase()
  if (lowerMsg === '/broadcast' || lowerMsg.startsWith('/broadcast ') ||
      lowerMsg === '/broadcast_paid' || lowerMsg.startsWith('/broadcast_paid ')) {
    const adminId = Number(process.env.TELEGRAM_ADMIN_ID)
    if (!adminId || Number(message.from?.id) !== adminId) return res.status(200).end()

    const paidOnly = lowerMsg.startsWith('/broadcast_paid')
    const prefix   = paidOnly ? '/broadcast_paid' : '/broadcast'
    const broadcastText = msgText.slice(prefix.length).trim()

    if (!broadcastText) {
      await sendReply(chatId, `❌ Usage: ${prefix} &lt;message&gt;`)
      return res.status(200).end()
    }

    if (broadcastText.length > 2000) {
      await sendReply(chatId, `❌ Broadcast body too long (${broadcastText.length} chars). Maximum is 2000.`)
      return res.status(200).end()
    }

    try {
      const count = await cmdBroadcast(broadcastText, paidOnly)
      await sendReply(chatId, `✅ Broadcast sent to ${count} users`)
    } catch (err) {
      console.error('[notify/broadcast] failed:', err.message)
      await sendReply(chatId, `❌ Broadcast failed — check server logs`)
    }
    return res.status(200).end()
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── /setphoto — must be handled before runCommand since it needs chatId ──
  if (msgText === '/setphoto') {
    const reply = await cmdSetPhoto(chatId)
    await sendReply(chatId, reply)
    return res.status(200).end()
  }

  const raw    = msgText.toLowerCase().split('@')[0]

  if (!raw.startsWith('/')) return res.status(200).end()

  const parts  = raw.slice(1).split(' ')
  const key    = parts[0]
  const args   = parts.slice(1)
  const cmdKey = key === 'start' ? 'help' : key

  try {
    const reply = await runCommand(cmdKey, args)
    if (!reply) return res.status(200).end()
    await sendReply(chatId, reply, KEYBOARD)
  } catch (err) {
    console.error('[notify/bot] command error:', err.message)
    await sendReply(chatId, `❌ Command failed — check server logs`, KEYBOARD)
  }

  // Respond AFTER sendReply — Vercel freezes the function on res.end(),
  // so responding first kills the outbound Telegram fetch.
  return res.status(200).end()
}

// ─── Outbound notify handler (JWT-authenticated, client-side events) ──────────

async function handleNotify(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).end()

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).end()

  const { action, payload } = req.body || {}
  const ALLOWED_ACTIONS = ['defense_completed', 'project_created', 'oauth_signup']
  if (!ALLOWED_ACTIONS.includes(action)) return res.status(400).json({ error: 'Unknown action' })

  const email = user.email || 'unknown'

  if (action === 'defense_completed') {
    const score = Number(payload?.score)
    if (!isNaN(score)) {
      await sendTelegramAlert(`🎓 Defense completed: ${escapeTgHtml(email)} scored <b>${score}/10</b>`)
    }
  }

  if (action === 'project_created') {
    const title = String(payload?.title || 'untitled').slice(0, 80)
    await sendTelegramAlert(`📁 New project: ${escapeTgHtml(email)} started '<b>${escapeTgHtml(title)}</b>'`)
  }

  if (action === 'oauth_signup') {
    await sendTelegramAlert(`👤 New signup: ${escapeTgHtml(email)} (Google, free)`)
  }

  return res.status(200).json({ ok: true })
}

// ─── Contact form handler (public — no JWT required) ─────────────────────────

async function handleContact(req, res) {
  const ip = String(
    req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown'
  ).split(',')[0].trim()

  // Simple per-IP daily cap to prevent abuse
  const UPSTASH_URL   = process.env.UPSTASH_REDIS_REST_URL
  const UPSTASH_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const key = `rl:contact:${ip}:${new Date().toISOString().slice(0, 10)}`
    const r = await fetch(`${UPSTASH_URL}/incr/${key}`, {
      headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    }).then(x => x.json()).catch(() => null)
    if (r?.result > 10) {
      return res.status(429).json({ error: 'Too many requests. Please try again tomorrow.' })
    }
    // Set TTL on first increment so key auto-expires after 25 hours
    if (r?.result === 1) {
      fetch(`${UPSTASH_URL}/expire/${key}/90000`, {
        headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
      }).catch(() => null)
    }
  }

  const { name, email, subject, message } = req.body || {}

  if (!name || typeof name !== 'string' || name.trim().length < 2) {
    return res.status(400).json({ error: 'Name is required (minimum 2 characters).' })
  }
  if (!email || typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
    return res.status(400).json({ error: 'A valid email address is required.' })
  }
  if (!message || typeof message !== 'string' || message.trim().length < 10) {
    return res.status(400).json({ error: 'Message is required (minimum 10 characters).' })
  }

  const safeName    = name.trim().slice(0, 120)
  const safeEmail   = email.trim().slice(0, 254)
  const safeSubject = (subject || 'General Question').slice(0, 120)
  const safeMessage = message.trim().slice(0, 5000)

  const resend = new Resend(process.env.RESEND_API_KEY)

  const html = `<!DOCTYPE html><html><head>
    <style>
      body { margin:0; padding:0; background:#F0F4F8; font-family:'Poppins',Arial,sans-serif; }
      .wrapper { max-width:560px; margin:32px auto; }
      .header { background:#0f172a; border-radius:12px 12px 0 0; padding:24px; text-align:center; }
      .header img { height:36px; width:auto; }
      .box { background:#fff; border-radius:0 0 12px 12px; padding:40px; }
      h1 { font-size:20px; font-weight:700; color:#0D1B2A; margin:0 0 20px; }
      .row { margin-bottom:14px; }
      .label { font-size:12px; font-weight:600; color:#6B7280; text-transform:uppercase; letter-spacing:0.05em; }
      .value { font-size:15px; color:#111827; margin-top:2px; white-space:pre-wrap; }
      hr { border:none; border-top:1px solid #E5E7EB; margin:24px 0; }
      .foot { font-size:12px; color:#9CA3AF; }
    </style>
  </head><body>
    <div class="wrapper">
      <div class="header">
        <img src="https://fypro.com.ng/fypro-logo.png" alt="FYPro" />
      </div>
      <div class="box">
        <h1>New Contact Form Submission</h1>
        <div class="row"><div class="label">From</div><div class="value">${safeName} &lt;${safeEmail}&gt;</div></div>
        <div class="row"><div class="label">Subject</div><div class="value">${safeSubject}</div></div>
        <div class="row"><div class="label">Message</div><div class="value">${safeMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}</div></div>
        <hr>
        <p class="foot">Sent via fypro.com.ng/contact · Reply directly to respond to ${safeName}.</p>
      </div>
    </div>
  </body></html>`

  try {
    const { error } = await resend.emails.send({
      from:     'FYPro <hello@fypro.com.ng>',
      to:       'hello@fypro.com.ng',
      replyTo:  safeEmail,
      subject:  `[FYPro Contact] ${safeSubject}`,
      html,
    })
    if (error) throw new Error(error.message)
  } catch (err) {
    console.error('[notify/contact] Resend failed:', err.message)
    return res.status(500).json({ error: 'Failed to send message. Please email us directly at hello@fypro.com.ng.' })
  }

  await sendTelegramAlert(`📬 Contact form: <b>${escapeTgHtml(safeName)}</b> (${escapeTgHtml(safeEmail)})\nSubject: ${escapeTgHtml(safeSubject)}`).catch(() => null)

  return res.status(200).json({ ok: true })
}

// ─── Submit report (JWT required) ────────────────────────────────────────────

async function handleSubmitReport(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  // Rate limiting via Upstash
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || 'unknown').split(',')[0].trim()
  if (UPSTASH_URL && UPSTASH_TOKEN) {
    const today   = new Date().toISOString().slice(0, 10)
    const userKey = `rl:report:user:${user.id}:${today}`
    const ipKey   = `rl:report:ip:${ip}:${today}`
    const [userR, ipR] = await Promise.all([
      fetch(`${UPSTASH_URL}/incr/${userKey}`, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }).then(x => x.json()).catch(() => null),
      fetch(`${UPSTASH_URL}/incr/${ipKey}`,   { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }).then(x => x.json()).catch(() => null),
    ])
    if ((userR?.result ?? 0) > 5 || (ipR?.result ?? 0) > 10) {
      return res.status(429).json({ error: 'Too many reports. Please try again tomorrow.' })
    }
    if (userR?.result === 1) fetch(`${UPSTASH_URL}/expire/${userKey}/90000`, { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }).catch(() => null)
    if (ipR?.result  === 1) fetch(`${UPSTASH_URL}/expire/${ipKey}/90000`,   { headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` } }).catch(() => null)
  }

  const { type, description, context } = req.body || {}

  if (!['error', 'general'].includes(type)) {
    return res.status(400).json({ error: 'Invalid report type' })
  }
  if (!description || typeof description !== 'string' || !description.trim()) {
    return res.status(400).json({ error: 'Description is required' })
  }
  if (description.length > 1000) {
    return res.status(400).json({ error: 'Description must be 1000 characters or less' })
  }

  const safeContext = {
    url: typeof context?.url === 'string' ? context.url.slice(0, 500) : '?',
    ...(context?.step_name     && { step_name:     String(context.step_name).slice(0, 100) }),
    ...(context?.error_message && { error_message: String(context.error_message).slice(0, 500) }),
  }

  const { error: insertError } = await supabaseAdmin
    .from('user_reports')
    .insert({ user_id: user.id, type, description: description.trim(), context: safeContext })

  if (insertError) {
    console.error('[notify/submit-report] insert error:', insertError.message)
    return res.status(500).json({ error: 'Failed to save report' })
  }

  const email   = user.email || 'unknown'
  const preview = description.trim().slice(0, 100)
  const step    = safeContext.step_name || safeContext.url

  // Await Telegram so it completes before Vercel terminates the function.
  // Email is best-effort (fire-and-forget).
  await sendTelegramAlert(
    `🚨 <b>User Report [${type}]</b>\n` +
    `👤 ${escapeTgHtml(email)}\n` +
    (safeContext.step_name ? `📍 Step: ${escapeTgHtml(safeContext.step_name)}\n` : '') +
    `🔗 ${escapeTgHtml(safeContext.url)}\n` +
    `💬 "${escapeTgHtml(preview)}"\n⏱ just now`
  ).catch(err => console.error('[notify/submit-report] Telegram error:', err.message));

  (async () => {
    try {
      const resend = new Resend(process.env.RESEND_API_KEY)
      await resend.emails.send({
        from:    'FYPro <hello@fypro.com.ng>',
        to:      'hello@fypro.com.ng',
        subject: `[FYPro Report] ${type} — ${step}`,
        html:    buildReportEmail({ email, type, description: description.trim(), context: safeContext }),
      })
    } catch (err) {
      console.error('[notify/submit-report] Resend error:', err.message)
    }
  })()

  return res.status(200).json({ ok: true })
}

// ─── Update report status (admin-only) ───────────────────────────────────────

async function handleUpdateReportStatus(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const { report_id, status } = req.body || {}
  if (!['acknowledged', 'resolved'].includes(status)) {
    return res.status(400).json({ error: 'status must be acknowledged or resolved' })
  }
  if (!report_id || typeof report_id !== 'string') {
    return res.status(400).json({ error: 'report_id is required' })
  }

  const { error: updateError } = await supabaseAdmin
    .from('user_reports')
    .update({ status })
    .eq('id', report_id)

  if (updateError) {
    console.error('[notify/update-report-status] error:', updateError.message)
    return res.status(500).json({ error: 'Failed to update report' })
  }

  return res.status(200).json({ ok: true })
}

// ─── Get reports (admin-only) ─────────────────────────────────────────────────

async function handleGetReports(req, res) {
  const token = req.headers.authorization?.replace('Bearer ', '')
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Unauthorized' })

  const adminEmail = process.env.ADMIN_EMAIL
  if (!adminEmail || user.email?.toLowerCase() !== adminEmail.toLowerCase()) {
    return res.status(403).json({ error: 'Forbidden' })
  }

  const statusFilter = req.body?.status
  let query = supabaseAdmin
    .from('user_reports')
    .select('id, user_id, type, description, context, status, created_at')
    .order('created_at', { ascending: false })
    .limit(100)

  if (statusFilter && ['open', 'acknowledged', 'resolved'].includes(statusFilter)) {
    query = query.eq('status', statusFilter)
  }

  const { data: reports, error: fetchError } = await query
  if (fetchError) {
    console.error('[notify/get-reports] error:', fetchError.message)
    return res.status(500).json({ error: 'Failed to fetch reports' })
  }

  const userIds = [...new Set((reports || []).map(r => r.user_id).filter(Boolean))]
  const emailMap = {}
  await Promise.all(
    userIds.map(async uid => {
      try {
        const { data: { user: u } } = await supabaseAdmin.auth.admin.getUserById(uid)
        if (u) emailMap[uid] = u.email
      } catch {}
    })
  )

  const enriched = (reports || []).map(r => ({ ...r, email: emailMap[r.user_id] || '—' }))
  return res.status(200).json({ reports: enriched })
}

// ─── Push nudge delivery (cron) ───────────────────────────────────────────────

const NUDGE_PAYLOADS = {
  inactive_3: {
    title: 'FYPro',
    body: "Your project is waiting — you haven't worked on it in 3 days. Keep going.",
    url: '/app',
  },
  inactive_7: {
    title: 'FYPro',
    body: "It's been a week. Your final year project needs you — don't let it drift.",
    url: '/app',
  },
  defense_reminder: {
    title: 'FYPro',
    body: "You've done the research. Have you tried the AI defense panel yet?",
    url: '/app',
  },
}

const REQUIRED_STEPS_FOR_DEFENSE = [
  'topic_validator',
  'chapter_architect',
  'methodology_advisor',
  'writing_planner',
]

async function handleSendNudges(req, res) {
  if (req.query?.secret !== process.env.CRON_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  // Fetch all current subscriptions
  const { data: subs, error: subErr } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')

  if (subErr) {
    console.error('[nudges] failed to fetch subscriptions:', subErr.message)
    return res.status(500).json({ error: 'DB error' })
  }

  const now = Date.now()
  const DAY_MS = 86_400_000
  const results = { sent: 0, skipped: 0, cleaned: 0, errors: 0 }
  for (const sub of subs) {
    try {
      let nudgeKey = null

      // Last activity = most recent project_steps.updated_at for this user
      const { data: lastStepRows } = await supabaseAdmin
        .from('project_steps')
        .select('updated_at')
        .eq('user_id', sub.user_id)
        .order('updated_at', { ascending: false })
        .limit(1)

      const lastStepAt = lastStepRows?.[0]?.updated_at
      if (!lastStepAt) { results.skipped++; continue } // no activity yet

      const daysInactive    = (now - new Date(lastStepAt).getTime()) / DAY_MS
      const daysSinceNudged = sub.last_nudged_at
        ? (now - new Date(sub.last_nudged_at).getTime()) / DAY_MS
        : Infinity

      // Inactivity nudges — 7-day check takes priority
      if (daysInactive >= 7 && daysSinceNudged > 7) {
        nudgeKey = 'inactive_7'
      } else if (daysInactive >= 3 && daysSinceNudged > 3) {
        nudgeKey = 'inactive_3'
      }

      // Defense reminder — only if no inactivity nudge fired
      if (!nudgeKey && daysSinceNudged > 7 && daysInactive >= 2) {
        const { data: steps } = await supabaseAdmin
          .from('project_steps')
          .select('step_type')
          .eq('user_id', sub.user_id)

        const completedNames = steps?.map((s) => s.step_type) ?? []
        const hasAllSteps = REQUIRED_STEPS_FOR_DEFENSE.every((s) => completedNames.includes(s))

        if (hasAllSteps) {
          const { count: defenseCount } = await supabaseAdmin
            .from('defense_sessions')
            .select('*', { count: 'exact', head: true })
            .eq('user_id', sub.user_id)

          if ((defenseCount ?? 0) === 0) nudgeKey = 'defense_reminder'
        }
      }
      if (!nudgeKey) { results.skipped++; continue }

      // Send the push notification
      await getWebPush().sendNotification(
        sub.subscription,
        JSON.stringify(NUDGE_PAYLOADS[nudgeKey])
      )

      // Update last_nudged_at
      await supabaseAdmin
        .from('push_subscriptions')
        .update({ last_nudged_at: new Date().toISOString() })
        .eq('user_id', sub.user_id)

      results.sent++
      console.log(`[nudges] sent ${nudgeKey} to ${sub.user_id}`)
    } catch (err) {
      if (err.statusCode === 410 || err.statusCode === 404) {
        // Subscription expired or revoked — clean up
        await supabaseAdmin
          .from('push_subscriptions')
          .delete()
          .eq('user_id', sub.user_id)
        results.cleaned++
        console.log(`[nudges] cleaned expired subscription for ${sub.user_id}`)
      } else {
        results.errors++
        console.error(`[nudges] error for ${sub.user_id}:`, err.message)
      }
    }
  }

  console.log('[nudges] run complete:', results)
  return res.status(200).json({ ok: true, ...results })
}

// ─── Push subscription management ────────────────────────────────────────────

async function handleSubscribe(req, res) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { subscription } = req.body || {}
  if (!subscription?.endpoint || !subscription?.keys?.p256dh || !subscription?.keys?.auth) {
    return res.status(400).json({ error: 'Invalid subscription object' })
  }

  const { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert({ user_id: user.id, subscription }, { onConflict: 'user_id' })

  if (error) {
    console.error('[notify/subscribe] upsert error:', error.message)
    return res.status(500).json({ error: 'Failed to save subscription' })
  }

  return res.status(200).json({ ok: true })
}

async function handleUnsubscribe(req, res) {
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Unauthorized' })

  const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token)
  if (authErr || !user) return res.status(401).json({ error: 'Unauthorized' })

  const { error: delErr } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('user_id', user.id)

  if (delErr) {
    console.error('[notify/unsubscribe] delete error:', delErr.message)
    return res.status(500).json({ error: 'Failed to remove subscription' })
  }

  return res.status(200).json({ ok: true })
}

// ─── Router ───────────────────────────────────────────────────────────────────

export default async function handler(req, res) {
  try {
    setCorsHeaders(req, res)
    if (req.method === 'OPTIONS') return res.status(200).end()

    // GET: cron-triggered actions
    if (req.method === 'GET') {
      const action = req.query?.action
      if (action === 'send-nudges') return handleSendNudges(req, res)
      return res.status(405).end()
    }

    if (req.method !== 'POST') return res.status(405).end()

    // Telegram updates always carry update_id; our notify calls never do.
    if (req.body?.update_id !== undefined) return handleTelegramBot(req, res)

    // Contact form — public, no JWT required
    if (req.body?.action === 'contact') return handleContact(req, res)

    // Push subscription management — JWT required
    if (req.body?.action === 'subscribe')   return handleSubscribe(req, res)
    if (req.body?.action === 'unsubscribe') return handleUnsubscribe(req, res)

    // User report actions — JWT required
    if (req.body?.action === 'submit-report')        return handleSubmitReport(req, res)
    if (req.body?.action === 'update-report-status') return handleUpdateReportStatus(req, res)
    if (req.body?.action === 'get-reports')          return handleGetReports(req, res)

    return handleNotify(req, res)
  } catch (err) {
    Sentry.captureException(err)
    console.error('[api/notify] unhandled error:', err)
    if (!res.headersSent) return res.status(500).json({ error: 'Internal server error' })
  }
}
