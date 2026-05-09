// Share card image generator — server-side only.
// Why server-side rendering is non-negotiable:
//   The client cannot be trusted to supply an accurate score. A user who intercepts
//   their own request can replace "4/10" with "10/10" before it reaches any image
//   generator. By reading the score from Supabase (via service_role, bypassing RLS)
//   and generating the PNG here, we guarantee the card reflects the actual result
//   on file — fabrication is impossible without compromising the service_role key.
//
// Requires: npm install @vercel/og
// Image: 1080×1350 (portrait 4:5) — optimal for WhatsApp direct image sharing.
//   Landscape OG (1200×630) looks like a link preview; 9:16 stories require full-screen.
//   4:5 portrait renders full-width in WhatsApp chat with no letterboxing.

import { ImageResponse }    from '@vercel/og'
import { supabaseAdmin }    from './_lib/supabase-admin.js'
import { rateLimitCheck }   from './_lib/rate-limit.js'
import * as React           from 'react'

const WIDTH  = 1080
const HEIGHT = 1350

async function fetchLogoBase64() {
  try {
    const res = await fetch('https://fypro.com.ng/fypro-logo.png')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const buf = await res.arrayBuffer()
    return `data:image/png;base64,${Buffer.from(buf).toString('base64')}`
  } catch (err) {
    console.log('[share-card] logo fetch failed:', err.message)
    return null
  }
}

function scoreColor(score) {
  if (score == null) return '#3B82F6'
  if (score >= 8) return '#16A34A'
  if (score >= 5) return '#F59E0B'
  return '#DC2626'
}

function truncate(str, max) {
  if (!str) return ''
  return str.length <= max ? str : str.slice(0, max - 1) + '…'
}

function buildCardElement(score, scoreLabel, topic, studentName, logoBase64) {
  const color = scoreColor(score)
  const scoreDisplay = score != null ? String(score) : '?'

  return React.createElement('div', {
    style: {
      display: 'flex',
      flexDirection: 'column',
      width: WIDTH,
      height: HEIGHT,
      background: 'linear-gradient(160deg, #060E18 0%, #0a1628 100%)',
      fontFamily: "'Poppins', sans-serif",
      position: 'relative',
      overflow: 'hidden',
    },
  },
    // Subtle dot texture overlay
    React.createElement('div', {
      style: {
        position: 'absolute', inset: 0,
        backgroundImage: 'radial-gradient(circle, rgba(0,102,255,0.05) 2px, transparent 2px)',
        backgroundSize: '40px 40px',
        pointerEvents: 'none',
      },
    }),

    // Blue glow accent top-right
    React.createElement('div', {
      style: {
        position: 'absolute', top: -100, right: -100,
        width: 400, height: 400, borderRadius: '50%',
        background: 'radial-gradient(circle, rgba(0,102,255,0.12), transparent 70%)',
        filter: 'blur(40px)',
      },
    }),

    // Score glow centre
    React.createElement('div', {
      style: {
        position: 'absolute',
        top: '35%', left: '50%',
        transform: 'translate(-50%, -50%)',
        width: 340, height: 340, borderRadius: '50%',
        background: `radial-gradient(circle, ${color}18, transparent 70%)`,
        filter: 'blur(50px)',
      },
    }),

    // ── Header ────────────────────────────────────────────────────────────────
    React.createElement('div', {
      style: {
        display: 'flex', alignItems: 'center',
        padding: '64px 80px 0',
        gap: 16,
        position: 'relative',
      },
    },
      // Logo image — falls back to text wordmark if file unavailable
      logoBase64
        ? React.createElement('img', {
            src: logoBase64,
            style: { height: 48, width: 'auto', objectFit: 'contain' },
          })
        : React.createElement('span', {
            style: {
              fontFamily: 'Georgia, serif',
              fontSize: 40,
              fontWeight: 700,
              color: '#FFFFFF',
              letterSpacing: '-0.01em',
            },
          }, 'FYPro'),

      // Spacer
      React.createElement('div', { style: { flex: 1 } }),

      // "Defence Result" tag
      React.createElement('span', {
        style: {
          fontFamily: 'monospace',
          fontSize: 20,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.3)',
          textTransform: 'uppercase',
          letterSpacing: '0.1em',
        },
      }, 'Defence Result'),
    ),

    // ── Score block ───────────────────────────────────────────────────────────
    React.createElement('div', {
      style: {
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        position: 'relative',
        gap: 24,
      },
    },
      // "Panel Score" label
      React.createElement('span', {
        style: {
          fontFamily: 'monospace',
          fontSize: 24,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.35)',
          textTransform: 'uppercase',
          letterSpacing: '0.18em',
        },
      }, 'Panel Score'),

      // Score number
      React.createElement('div', {
        style: { display: 'flex', alignItems: 'baseline', gap: 8 },
      },
        React.createElement('span', {
          style: {
            fontFamily: 'monospace',
            fontSize: 200,
            fontWeight: 700,
            color,
            lineHeight: 1,
            letterSpacing: '-0.04em',
          },
        }, scoreDisplay),
        React.createElement('span', {
          style: {
            fontFamily: 'monospace',
            fontSize: 72,
            fontWeight: 400,
            color: 'rgba(255,255,255,0.3)',
            lineHeight: 1,
          },
        }, '/10'),
      ),

      // Score label badge
      scoreLabel && React.createElement('div', {
        style: {
          display: 'flex',
          padding: '10px 36px',
          borderRadius: 999,
          border: `2px solid ${color}66`,
          background: `${color}18`,
        },
      },
        React.createElement('span', {
          style: {
            fontFamily: 'monospace',
            fontSize: 28,
            fontWeight: 700,
            color,
            textTransform: 'uppercase',
            letterSpacing: '0.14em',
          },
        }, (scoreLabel || '').toUpperCase()),
      ),

      // Student name
      studentName && React.createElement('span', {
        style: {
          fontFamily: 'sans-serif',
          fontSize: 32,
          fontWeight: 600,
          color: 'rgba(255,255,255,0.75)',
          letterSpacing: '0.01em',
          marginTop: 8,
        },
      }, truncate(studentName, 40)),
    ),

    // ── Topic ─────────────────────────────────────────────────────────────────
    React.createElement('div', {
      style: {
        padding: '0 80px 40px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
      },
    },
      React.createElement('div', {
        style: { width: '72%', height: 3, background: '#0066FF', borderRadius: 999, opacity: 0.85 },
      }),
      React.createElement('p', {
        style: {
          fontFamily: 'sans-serif',
          fontSize: 30,
          color: 'rgba(255,255,255,0.55)',
          lineHeight: 1.5,
          margin: 0,
          textAlign: 'center',
        },
      }, truncate(topic || '', 80)),
    ),

    // ── Caption + Footer ──────────────────────────────────────────────────────
    React.createElement('div', {
      style: {
        borderTop: '1px solid rgba(255,255,255,0.08)',
        padding: '36px 80px 56px',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
      },
    },
      React.createElement('p', {
        style: {
          fontFamily: 'sans-serif',
          fontSize: 28,
          color: 'rgba(255,255,255,0.4)',
          margin: 0,
          textAlign: 'center',
          lineHeight: 1.5,
        },
      }, 'I just simulated my project defense on FYPro.'),
      React.createElement('span', {
        style: {
          fontFamily: 'monospace',
          fontSize: 26,
          fontWeight: 700,
          color: '#0066FF',
          letterSpacing: '0.06em',
          opacity: 0.85,
        },
      }, 'fypro.com.ng'),
    ),
  )
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

  if (req.method === 'OPTIONS') return res.status(200).end()
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' })

  // ── Rate limit: 30 share cards per user per day ───────────────────────────
  const rl = await rateLimitCheck(req, { userDay: 30, ipDay: 60, prefix: 'share-card' })
  if (!rl.allowed) return res.status(429).json({ error: rl.reason })

  // ── Auth ──────────────────────────────────────────────────────────────────
  const authHeader = req.headers.authorization || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null
  if (!token) return res.status(401).json({ error: 'Authentication required' })

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token)
  if (authError || !user) return res.status(401).json({ error: 'Invalid or expired token' })

  // ── Fetch defense result (server reads the score — client cannot fake it) ─
  const { project_id } = req.body || {}
  if (!project_id) return res.status(400).json({ error: 'project_id required' })

  const { data: step, error: stepError } = await supabaseAdmin
    .from('project_steps')
    .select('result_json, user_id')
    .eq('project_id', project_id)
    .eq('step_type', 'defense_prep')
    .eq('user_id', user.id)   // ownership enforced here — not via RLS (we use service_role)
    .maybeSingle()

  if (stepError || !step) {
    return res.status(403).json({ error: 'Defense session not found or access denied' })
  }

  // Fetch project title for the card
  const { data: project } = await supabaseAdmin
    .from('projects')
    .select('title')
    .eq('id', project_id)
    .eq('user_id', user.id)
    .maybeSingle()

  const result = step.result_json || {}
  const score       = result.panel_score ?? null
  const scoreLabel  = result.panel_score_label ?? null
  const topic       = project?.title || result.topic || ''
  const studentName = user.user_metadata?.full_name || ''

  // ── Render PNG via @vercel/og ─────────────────────────────────────────────
  const logoSrc = await fetchLogoBase64()

  try {
    const imgResponse = new ImageResponse(
      buildCardElement(score, scoreLabel, topic, studentName, logoSrc),
      { width: WIDTH, height: HEIGHT }
    )

    const arrayBuffer = await imgResponse.arrayBuffer()

    res.setHeader('Content-Type', 'image/png')
    res.setHeader('Cache-Control', 'private, no-store')
    res.setHeader('Content-Disposition', 'attachment; filename="fypro-defense-result.png"')
    return res.end(Buffer.from(arrayBuffer))
  } catch (err) {
    console.error('[share-card] render failed:', err.message)
    return res.status(500).json({ error: 'Image generation failed' })
  }
}
