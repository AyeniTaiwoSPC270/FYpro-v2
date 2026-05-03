// RLS regression test — run after every DB-touching change.
// Zero output = all good.  Any SECURITY FAIL line = fix the policy, not the script.
//
// Run: node scripts/verify-rls-after-refactor.js
//
// Requires VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in environment.
// Load from .env.local: node -r dotenv/config scripts/verify-rls-after-refactor.js

import { createClient } from '@supabase/supabase-js'

const url     = process.env.VITE_SUPABASE_URL     || process.env.NEXT_PUBLIC_SUPABASE_URL
const anonKey = process.env.VITE_SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!url || !anonKey) {
  console.error('Missing VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY in environment.')
  process.exit(1)
}

// Unauthenticated client — simulates an anonymous visitor
const noAuth = createClient(url, anonKey)

const TABLES = [
  'users',
  'user_entitlements',
  'projects',
  'project_steps',
  'defense_sessions',
  'defense_turns',
  'payments',
  'daily_usage',
]

let failed = false

for (const table of TABLES) {
  const { data, error } = await noAuth.from(table).select('*').limit(1)
  if (data && data.length > 0) {
    console.error(`SECURITY FAIL: anonymous client can read table "${table}"`)
    failed = true
  } else {
    console.log(`OK  ${table}: anonymous read blocked (${error?.code ?? 'empty result'})`)
  }
}

if (failed) {
  console.error('\nOne or more tables are readable without authentication. Fix the RLS policy.')
  process.exit(1)
} else {
  console.log('\nAll tables RLS-protected against anonymous access.')
}
