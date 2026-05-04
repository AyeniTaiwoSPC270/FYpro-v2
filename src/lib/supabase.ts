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

// Stop Supabase from listening to visibilitychange / focus events.
// Without this, every tab-return triggers TOKEN_REFRESHED → SIGNED_IN,
// which caused setIsLoading(true) in useProjectState and the white-screen bug.
// Tokens still refresh reactively during API calls; we refresh proactively
// on mount only via getSession().
supabase.auth.stopAutoRefresh()
