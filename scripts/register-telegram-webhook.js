// scripts/register-telegram-webhook.js
//
// Registers https://fypro.com.ng/api/notify as the Telegram bot webhook.
// Run this once after the first deployment, or whenever the webhook URL changes.
//
// Usage:
//   TELEGRAM_BOT_TOKEN=xxx TELEGRAM_WEBHOOK_SECRET=xxx node scripts/register-telegram-webhook.js
//
// Or with a .env file:
//   node -r dotenv/config scripts/register-telegram-webhook.js

const TOKEN  = process.env.TELEGRAM_BOT_TOKEN
const SECRET = process.env.TELEGRAM_WEBHOOK_SECRET

if (!TOKEN || !SECRET) {
  console.error('Error: TELEGRAM_BOT_TOKEN and TELEGRAM_WEBHOOK_SECRET must be set.')
  process.exit(1)
}

const WEBHOOK_URL = 'https://fypro.com.ng/api/notify'

async function register() {
  const res = await fetch(`https://api.telegram.org/bot${TOKEN}/setWebhook`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ url: WEBHOOK_URL, secret_token: SECRET }),
  })
  const data = await res.json()
  if (data.ok) {
    console.log(`✅ Webhook registered: ${WEBHOOK_URL}`)
    console.log('   Pending update count:', data.result?.pending_update_count ?? 0)
  } else {
    console.error('❌ Failed:', data.description)
    process.exit(1)
  }
}

register().catch(err => {
  console.error('❌ Error:', err.message)
  process.exit(1)
})
