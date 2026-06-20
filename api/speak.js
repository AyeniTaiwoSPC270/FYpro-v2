// FYPro — Vercel Serverless Function: ElevenLabs TTS proxy
// Receives { text, examiner } in a POST body, picks the correct ElevenLabs
// voice ID for that examiner, calls the ElevenLabs API, and returns the
// audio as an audio/mpeg blob. The EL_API_KEY is read from the Vercel
// environment and never exposed to the browser.

import { rateLimitCheck } from './_lib/rate-limit.js';
import { Sentry }         from './_lib/sentry-server.js';
import { setCorsHeaders } from './_lib/cors.js';
import { supabaseAdmin }  from './_lib/supabase-admin.js';
import { sendTelegramAlert, sendTelegramAlertOnce } from './_lib/telegram.js';

// Body parser config — must be a named `config` export to take effect
// (a `handler.config` property is silently ignored by Vercel).
// sizeLimit: '1mb' is well above any examiner question text.
export const config = {
  api: {
    bodyParser: {
      sizeLimit: '1mb'
    }
  }
};

// ElevenLabs voice IDs assigned to each examiner role
const VOICE_IDS = {
  methodologist:    'k8FSF54xc37FsOoEA7IB',
  subjectExpert:    'uo5MH4uAr7YWuzTN7BV5',
  externalExaminer: 'MJ4KRCYkUZJJEOyUlY9o'
};

const VOICE_SETTINGS = {
  methodologist: {
    stability:         0.75,
    similarity_boost:  0.75,
    style:             0.20,
    use_speaker_boost: true
  },
  subjectExpert: {
    stability:         0.70,
    similarity_boost:  0.80,
    style:             0.30,
    use_speaker_boost: true
  },
  externalExaminer: {
    stability:         0.85,
    similarity_boost:  0.70,
    style:             0.15,
    use_speaker_boost: true
  }
};

/**
 * resolveVoiceKey — Maps the examiner display name sent from the frontend to
 * one of the three internal keys used in VOICE_IDS.
 * Matches on substrings so minor name variations are handled gracefully.
 *
 * @param {string} examiner — e.g. "The External Examiner"
 * @returns {string} 'methodologist' | 'subjectExpert' | 'externalExaminer'
 */
function resolveVoiceKey(examiner) {
  if (!examiner) return 'methodologist';
  var n = examiner.toLowerCase();
  if (n.indexOf('methodologist') !== -1) return 'methodologist';
  if (n.indexOf('subject') !== -1)       return 'subjectExpert';
  if (n.indexOf('external') !== -1)      return 'externalExaminer';
  return 'methodologist'; // safe default so the function never crashes
}

/**
 * handler — Vercel serverless function entry point.
 * Validates the request, resolves the voice, calls ElevenLabs, and streams
 * the audio/mpeg binary back to the browser as a blob response.
 */
const handler = async (req, res) => {
  try {
  setCorsHeaders(req, res);

  // Handle CORS preflight so browsers don't block the POST
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required.' });

  let authResult;
  try {
    authResult = await supabaseAdmin.auth.getUser(token);
  } catch (err) {
    console.error('[speak] auth.getUser threw:', err.message);
    return res.status(503).json({ error: 'Authentication service unavailable. Please try again.' });
  }
  const { data: { user }, error: authError } = authResult;
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired authentication token.' });

  // Entitlement + rate limit in parallel — TTS voices are a Defense Pack feature,
  // and the Defense Simulator itself is already gated on defense_pack server-side.
  // Without this check any logged-in user could burn ElevenLabs quota directly.
  let entResult, rl;
  try {
    [entResult, rl] = await Promise.all([
      supabaseAdmin.from('user_entitlements').select('paid_features').eq('user_id', user.id).maybeSingle(),
      rateLimitCheck(req, { userDay: 30, ipDay: 60, prefix: 'speak' }).catch(rlErr => {
        console.error('[speak] rate limiter threw (failing open):', rlErr.message);
        return { allowed: true, reason: '' };
      }),
    ]);
  } catch (err) {
    console.error('[speak] entitlement check threw:', err.message);
    return res.status(503).json({ error: 'Service unavailable. Please try again.' });
  }
  if (!rl.allowed) return res.status(429).json({ error: rl.reason });

  if (entResult.error) {
    console.error('[speak] entitlements query error:', entResult.error.message);
    return res.status(500).json({ error: 'Failed to verify entitlements. Please try again.' });
  }
  const paidFeatures = Array.isArray(entResult.data?.paid_features) ? entResult.data.paid_features : [];
  if (!paidFeatures.includes('defense_pack') && !paidFeatures.includes('express_defense')) {
    return res.status(403).json({ error: 'Feature not unlocked. Please purchase the Defense Pack.' });
  }

  // Guard: EL_API_KEY must be set in Vercel environment variables.
  // (The env var name is EL_API_KEY — not ELEVENLABS_API_KEY.)
  // If it is missing the function returns 500 and the frontend silently falls
  // back to text-only mode — the student session is never interrupted.
  const apiKey = process.env.EL_API_KEY;
  if (!apiKey) {
    console.error('[speak] EL_API_KEY is not set in the Vercel environment');
    sendTelegramAlertOnce('🔴 ElevenLabs TTS broken: EL_API_KEY is not set in Vercel env', 'tg:speak:no-key').catch(() => null);
    return res.status(500).json({ error: 'TTS API key not configured on server.' });
  }

  try {
    // Guard with || {} so destructuring never throws when body parsing fails
    const { text, examiner } = req.body || {};

    // Guard: text is required — 400 so the frontend .catch() triggers the fallback
    if (!text || typeof text !== 'string' || !text.trim()) {
      return res.status(400).json({ error: 'text is required' });
    }

    // Cost guard: ElevenLabs bills per character. Examiner questions are 1-3
    // sentences; anything beyond this is not a legitimate Defense Simulator call.
    if (text.length > 1500) {
      return res.status(400).json({ error: 'Text too long for TTS.' });
    }

    // Resolve the correct ElevenLabs voice ID for this examiner
    const voiceKey = resolveVoiceKey(examiner);
    const voiceId  = VOICE_IDS[voiceKey];

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
          voice_settings: VOICE_SETTINGS[voiceKey]
        })
      }
    );

    // If ElevenLabs returns non-2xx, log the full detail and forward the status
    // so the frontend can fall back to text-only mode.
    // Common causes: 401 invalid/expired key, 429 quota exceeded, 400 text too long.
    if (!ttsResponse.ok) {
      const errBody = await ttsResponse.text();
      console.error('[speak] ElevenLabs API error', {
        status:    ttsResponse.status,
        voiceKey,
        voiceId,
        hasApiKey: !!apiKey,
        detail:    errBody.slice(0, 500),
      });
      const today = new Date().toISOString().slice(0, 10);
      sendTelegramAlertOnce(`🔴 ElevenLabs TTS error ${ttsResponse.status} — examiner voices down in Defense Simulator`, `tg:speak:err:${ttsResponse.status}:${today}`).catch(() => null);
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
    sendTelegramAlert(`🔴 TTS failed for user:${user?.id?.slice(0, 8) || 'unknown'} — ${err.message}`).catch(() => null);
    return res.status(500).json({ error: err.message });
  }
  } catch (err) {
    Sentry.captureException(err);
    console.error('[api/speak] unhandled error:', err);
    if (!res.headersSent) return res.status(500).json({ error: 'Internal server error' });
  }
};

export default handler;
