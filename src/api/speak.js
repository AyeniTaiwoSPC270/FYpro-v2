// FYPro — Vercel Serverless Function: ElevenLabs TTS proxy
// Receives { text, examiner } in a POST body, picks the correct ElevenLabs
// voice ID for that examiner, calls the ElevenLabs API, and returns the
// audio as an audio/mpeg blob. The EL_API_KEY is read from the Vercel
// environment and never exposed to the browser.

// ElevenLabs voice IDs assigned to each examiner role
const VOICE_IDS = {
  methodologist:  'YGoleLoJg5Y6OkKrTexX',
  subjectExpert:  'dwX6ydOD1vkI5xiHj677',
  devilsAdvocate: 'quN8ZSreVm3LJ24tiFFX'
};

/**
 * resolveVoiceKey — Maps the examiner display name sent from the frontend to
 * one of the three internal keys used in VOICE_IDS.
 * Matches on substrings so minor name variations are handled gracefully.
 *
 * @param {string} examiner — e.g. "The Devil's Advocate"
 * @returns {string} 'methodologist' | 'subjectExpert' | 'devilsAdvocate'
 */
function resolveVoiceKey(examiner) {
  if (!examiner) return 'methodologist';
  var n = examiner.toLowerCase();
  if (n.indexOf('methodologist') !== -1) return 'methodologist';
  if (n.indexOf('subject') !== -1)       return 'subjectExpert';
  if (n.indexOf('devil') !== -1)         return 'devilsAdvocate';
  return 'methodologist'; // safe default so the function never crashes
}

/**
 * handler — Vercel serverless function entry point.
 * Validates the request, resolves the voice, calls ElevenLabs, and streams
 * the audio/mpeg binary back to the browser as a blob response.
 */
const handler = async (req, res) => {
  // Log every incoming request so Vercel function logs show what arrived.
  // Fires even on early returns so failures are always visible in the dashboard.
  console.log('[speak] incoming — method:', req.method);

  // CORS headers — mirrors the pattern used in api/claude.js
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // Handle CORS preflight so browsers don't block the POST
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  // Guard: EL_API_KEY must be set in Vercel environment variables.
  // If it is missing the function returns 500 and the frontend falls back to
  // browser speechSynthesis — the student session is never interrupted.
  const apiKey = process.env.EL_API_KEY;
  if (!apiKey) {
    console.error('[speak] EL_API_KEY is not set in the Vercel environment');
    return res.status(500).json({ error: 'TTS API key not configured on server.' });
  }

  try {
    // Guard with || {} so destructuring never throws when body parsing fails
    const { text, examiner } = req.body || {};

    // Guard: text is required — 400 so the frontend .catch() triggers the fallback
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }

    // Resolve the correct ElevenLabs voice ID for this examiner
    const voiceKey = resolveVoiceKey(examiner);
    const voiceId  = VOICE_IDS[voiceKey];
    console.log('[speak] voiceKey:', voiceKey, '| voiceId:', voiceId);

    // Call the ElevenLabs text-to-speech API.
    // eleven_multilingual_v2 is used because it handles Nigerian English accent
    // better than English-only models such as eleven_monolingual_v1.
    const ttsResponse = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'xi-api-key':   apiKey,
          'Accept':       'audio/mpeg'
        },
        body: JSON.stringify({
          text:           text.trim(),
          model_id:       'eleven_multilingual_v2',
          voice_settings: {
            stability:        0.5,  // 0.5 = balanced naturalness/consistency
            similarity_boost: 0.8   // 0.8 = strong voice character retention
          }
        })
      }
    );

    // If ElevenLabs returns non-2xx, forward the status so the browser can fall back.
    // Common cases: 429 quota exceeded, 401 bad key, 400 text too long.
    if (!ttsResponse.ok) {
      const errBody = await ttsResponse.text();
      console.error('[speak] ElevenLabs error:', ttsResponse.status, errBody);
      return res.status(ttsResponse.status).json({ error: 'ElevenLabs error', detail: errBody });
    }

    // Read the binary audio response and send it back as audio/mpeg.
    // Buffer.from(ArrayBuffer) converts the fetch ArrayBuffer to a Node.js Buffer
    // that Vercel's res.send() can transmit as raw binary.
    const audioBuffer = await ttsResponse.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'no-store'); // questions are unique per session
    return res.status(200).send(Buffer.from(audioBuffer));

  } catch (err) {
    // Catches network failures, JSON parse errors, and any unexpected throws.
    // Returns 500 so the frontend .catch() triggers browser TTS fallback.
    console.error('[speak] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};

// Body parser config — same pattern as api/claude.js.
// sizeLimit: '1mb' is well above any examiner question text.
handler.config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb'
    }
  }
};

module.exports = handler;
