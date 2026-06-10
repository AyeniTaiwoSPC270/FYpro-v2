import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'pkce',
  },
})

// Background token auto-refresh stays ENABLED (the default).
// History: stopAutoRefresh() was added here because TOKEN_REFRESHED events
// retriggered useProjectState's load effect and caused a white-screen on
// tab-return. That effect is now keyed on user?.id (not the user object),
// so refresh events no longer cause reloads — and disabling auto-refresh
// meant a tab left open past token expiry (~1h) silently got 401s on every
// API call (serverless endpoints verify the JWT and reject expired tokens).
