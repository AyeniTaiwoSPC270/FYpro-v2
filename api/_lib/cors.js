// Restrict CORS to the production origin and localhost for development.
// All API endpoints authenticate via Bearer token (not cookies), so CORS is
// defence-in-depth — it prevents other origins from reading our responses.

const ALLOWED_ORIGINS = [
  process.env.APP_URL || 'https://fypro.vercel.app',
  'https://fypro.com.ng',
  'https://www.fypro.com.ng',
];

function isAllowedOrigin(origin) {
  if (!origin) return false;
  if (ALLOWED_ORIGINS.includes(origin)) return true;
  // Allow any Vercel preview deployment for this project
  if (/^https:\/\/fypro(-[a-z0-9]+)?\.vercel\.app$/.test(origin)) return true;
  // Allow localhost for local development
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

export function setCorsHeaders(req, res) {
  const origin = req.headers.origin || '';
  const allowed = isAllowedOrigin(origin) ? origin : ALLOWED_ORIGINS[0];
  res.setHeader('Access-Control-Allow-Origin', allowed);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}
