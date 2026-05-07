# Security Headers — Design Spec
Date: 2026-05-07

## Summary

Add HTTP security headers to all FYPro routes via Vercel's `headers` config in `vercel.json`. One file modified. No frontend code changes.

## Context

The current `vercel.json` has two top-level keys:
- `functions` — sets `maxDuration` for `api/claude.js` (60s) and `api/speak.js` (30s)
- `rewrites` — SPA catch-all routing to `/index.html`

A `headers` array will be added as a third top-level key.

## External Domain Audit

All external connections made from the browser (not server-side API routes):

| Domain | Purpose | In CSP |
|--------|---------|--------|
| `*.supabase.co` | Auth + database | `connect-src` |
| `js.paystack.co` | Paystack JS widget | `script-src`, `frame-src` |
| `fonts.googleapis.com` | Google Fonts CSS | `style-src` |
| `fonts.gstatic.com` | Google Fonts files | `font-src` |
| `*.ingest.sentry.io` | Sentry error reporting | `connect-src` ← added |
| `api.anthropic.com` | Claude API | `connect-src` (proxied server-side, included for completeness) |
| `api.elevenlabs.io` | ElevenLabs TTS | `connect-src` (proxied server-side, included for completeness) |
| `api.paystack.co` | Paystack verify | `connect-src` (proxied server-side, included for completeness) |

Server-side only (not in CSP): Resend, Upstash Redis, Semantic Scholar, OpenAlex, Crossref.

## Headers

Applied to all routes via `"source": "/(.*)"`:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-XSS-Protection` | `1; mode=block` | Legacy XSS filter |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Limit referrer leakage |
| `Permissions-Policy` | `camera=(), microphone=(self), geolocation=()` | `microphone=(self)` allows Defense Simulator voice mode |
| `Strict-Transport-Security` | `max-age=63072000; includeSubDomains; preload` | Force HTTPS for 2 years |
| `Content-Security-Policy` | See below | Restrict resource origins |

### Content-Security-Policy (full value)

```
default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.paystack.co; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; img-src 'self' data: https:; connect-src 'self' https://api.anthropic.com https://*.supabase.co https://api.elevenlabs.io https://api.paystack.co https://*.ingest.sentry.io; frame-src https://js.paystack.co; media-src 'self' blob:;
```

Notes:
- `'unsafe-inline'` and `'unsafe-eval'` in `script-src` are required by Vite's production build
- `media-src blob:` is required for voice recording in Defense Simulator

## Files Modified

- `vercel.json` — merge `headers` array into existing config

## Out of Scope

- No frontend code changes
- No new API routes
- No environment variable changes
- Headers only take effect on Vercel (not localhost)
