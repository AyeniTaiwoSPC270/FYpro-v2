// FYPro — Vercel Serverless Function
// Proxies requests to Anthropic API. The API key never touches the browser.

// Explicitly enable Vercel's built-in JSON body parser and raise the size limit.
// Prompts can be several KB — 1 mb is well above what we need.
const handler = async (req, res) => {
  // Log every incoming request so Vercel's function logs show exactly what arrived.
  // This is the first thing we do — before any early returns — so the log fires even
  // when the function bails out early (e.g. wrong method, missing API key).
  console.log('[claude] incoming request — method:', req.method, '| body:', JSON.stringify(req.body));

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error('[claude] ANTHROPIC_API_KEY is not set');
    return res.status(500).json({ error: 'API key not configured on server.' });
  }

  // Everything from here — including body access — is inside try/catch so that any
  // unexpected shape (undefined body, missing fields) produces a logged 500 rather
  // than a silent crash.
  try {
    // Guard with || {} so destructuring never throws if body-parsing produced undefined
    const {
      system,
      messages,
      max_tokens = 2000,
      model = 'claude-sonnet-4-6'
    } = req.body || {};

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'anthropic-beta': 'pdfs-2024-09-25'
      },
      body: JSON.stringify({ model, max_tokens, system, messages })
    });

    const data = await response.json();
    console.log('[claude] Anthropic responded with status:', response.status);
    return res.status(response.status).json(data);
  } catch (err) {
    console.error('[claude] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// Attach the Vercel API config to the handler function before exporting.
// bodyParser: true  — parse JSON / form bodies automatically (this is the default,
//                     but being explicit prevents surprises if defaults ever change).
// sizeLimit: '1mb' — prompts are large strings; the default 1 mb is sufficient.


export default handler;
