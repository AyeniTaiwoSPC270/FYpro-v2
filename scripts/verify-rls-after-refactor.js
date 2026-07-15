// RLS regression test — run after every DB-touching change.
// Exit code 0 = no failures. Any SECURITY FAIL line = fix the policy, not the script.
//
// Run: node scripts/verify-rls-after-refactor.js
//   or: node -r dotenv/config scripts/verify-rls-after-refactor.js
//
// Requires VITE_SUPABASE_URL + VITE_SUPABASE_ANON_KEY (the anonymous-visitor check).
// STRONGLY RECOMMENDED: also set SUPABASE_SERVICE_ROLE_KEY — it lets the script
// tell a genuinely-empty table apart from one that is empty *because* RLS is
// working. Without it, empty tables can only be reported INCONCLUSIVE.
//
// Why the service-role cross-check matters:
//   PostgREST + RLS does not error on a blocked read — it returns an empty array.
//   So "anon read returned []" is ambiguous: either RLS blocked it, OR the table
//   is simply empty (and might have NO RLS at all). The old version treated every
//   empty result as OK, which means an empty table with RLS accidentally disabled
//   would PASS silently. We resolve the ambiguity by reading the same table with
//   the service role (which bypasses RLS): if it has rows but anon sees none, the
//   block is real (VERIFIED); if it is truly empty, we say INCONCLUSIVE instead of
//   pretending it passed.
import './load-env.js'
import { createClient } from '@supabase/supabase-js'

const url         = process.env.VITE_SUPABASE_URL      || process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey     = process.env.VITE_SUPABASE_ANON_KEY  || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const serviceKey  = process.env.SUPABASE_SERVICE_ROLE_KEY || null

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment.')
  console.error('Add them to .env.local (or export them) and re-run.')
  process.exit(1)
}

// Unauthenticated client — simulates an anonymous visitor.
const noAuth = createClient(url, anonKey, { auth: { persistSession: false } })
// Service-role client (optional) — bypasses RLS, used only to distinguish an
// empty table from an RLS-blocked one. Never prints row contents.
const admin = serviceKey ? createClient(url, serviceKey, { auth: { persistSession: false } }) : null

// Every table in the public schema (CLAUDE.md §5 + the Telegram /data allow-list).
// Keep this list in sync when a migration adds a table.
const TABLES = [
  'admin_users',
  'app_config',
  'auth_attempts',
  'daily_usage',
  'defense_certificates',
  'defense_credits',
  'defense_sessions',
  'defense_turns',
  'email_log',
  'email_preferences',
  'feature_feedback',
  'generation_failures',
  'institutions',        // reference data: authenticated-readable, but anon must still be blocked
  'notifications',
  'payment_issues',
  'payments',
  'project_steps',
  'projects',
  'push_subscriptions',
  'referrals',
  'response_times',
  'system_logs',
  'user_achievements',
  'user_entitlements',
  'user_onboarding',
  'user_progress',
  'user_ratings',
  'user_reports',
  'users',
]

const results = { fail: [], verified: [], inconclusive: [] }

for (const table of TABLES) {
  // 1. What can an anonymous visitor read?
  const { data: anonRows } = await noAuth.from(table).select('*').limit(1)

  if (anonRows && anonRows.length > 0) {
    console.error(`SECURITY FAIL: anonymous client can read table "${table}"`)
    results.fail.push(table)
    continue
  }

  // 2. Anon saw nothing. Is that because RLS blocked it, or is the table empty?
  if (admin) {
    const { count, error: adminErr } = await admin
      .from(table)
      .select('*', { count: 'exact', head: true })

    if (adminErr) {
      console.log(`??  ${table}: anon blocked; service-role count failed (${adminErr.code ?? adminErr.message})`)
      results.inconclusive.push(table)
    } else if (count > 0) {
      console.log(`OK  ${table}: has ${count} row(s), anonymous read blocked — RLS VERIFIED`)
      results.verified.push(table)
    } else {
      console.log(`--  ${table}: empty table, anon read blocked — INCONCLUSIVE (confirm via pg_tables)`)
      results.inconclusive.push(table)
    }
  } else {
    console.log(`OK? ${table}: anonymous read blocked (unverified — set SUPABASE_SERVICE_ROLE_KEY to confirm)`)
    results.inconclusive.push(table)
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log(
  `\nChecked ${TABLES.length} tables — ` +
  `${results.verified.length} verified, ` +
  `${results.inconclusive.length} inconclusive, ` +
  `${results.fail.length} failed.`
)

if (results.inconclusive.length && admin) {
  console.log(
    'Inconclusive tables are empty, so anon-read cannot prove RLS from data alone. ' +
    'Confirm with the canonical query in Supabase SQL editor:\n' +
    "  SELECT tablename FROM pg_tables WHERE schemaname='public' AND rowsecurity = false;\n" +
    '  (must return zero rows)'
  )
}

if (results.fail.length) {
  console.error('\nOne or more tables are readable without authentication. Fix the RLS policy.')
  process.exit(1)
}

console.log('\nNo tables were readable by an anonymous client.')
