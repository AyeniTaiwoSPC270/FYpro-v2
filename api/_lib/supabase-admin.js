import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Every api/*.js function imports supabaseAdmin at module load time. Throwing
// here synchronously used to crash the entire serverless module before Vercel
// could even route to the handler's own try/catch — the platform then returns
// a bare 502 with no JSON body, no Sentry capture, no Telegram alert, and no
// system_logs row (there's nothing left running to write one). Deferring the
// throw to first use means the failure surfaces inside a normal request
// handler's try/catch instead, as a clean, logged 500 with the real reason.
let _client = null;
let _initError = null;

if (!supabaseUrl) {
  _initError = new Error('Missing env var: SUPABASE_URL');
} else if (!serviceRoleKey) {
  _initError = new Error('Missing env var: SUPABASE_SERVICE_ROLE_KEY');
} else {
  try {
    _client = createClient(supabaseUrl, serviceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
  } catch (err) {
    _initError = err;
  }
}

export const supabaseAdmin = _client || new Proxy({}, {
  get() { throw _initError; },
});
