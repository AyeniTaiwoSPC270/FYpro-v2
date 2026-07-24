import { describe, it, expect } from 'vitest'

// send-nurture-email.ts imports supabase-admin.js, which throws at import time
// if these env vars are unset. Static `import` statements are hoisted above
// any other code in the module, so a plain `process.env.X = ...` above a
// static import runs too late. Set the env vars, then use a dynamic import
// (same pattern as auth.test.js / payments.test.js) — we're only exercising
// the pure render functions here, not touching Supabase.
process.env.SUPABASE_URL = 'https://test.supabase.co'
process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-role-key'

const { renderHtml, renderText } = await import('./send-nurture-email')

const meta = { ip: '105.112.1.1', userAgent: 'Mozilla/5.0 Test', loginAt: '2026-07-24T13:32:00.000Z' }

describe('login_alert email', () => {
  it('renders name, time context, ip, and device', () => {
    const html = renderHtml('login_alert', 'Ada Lovelace', 'https://fypro.com.ng', meta)
    expect(html).toContain('Ada, we noticed a new login')
    expect(html).toContain('105.112.1.1')
    expect(html).toContain('Mozilla/5.0 Test')
    expect(html).toContain('/forgot-password')
  })

  it('escapes HTML in ip/userAgent to prevent injection', () => {
    const html = renderHtml('login_alert', 'Ada', 'https://fypro.com.ng', {
      ...meta,
      userAgent: '<script>alert(1)</script>',
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).toContain('&lt;script&gt;')
  })

  it('does not include the unsubscribe/manage-preferences link', () => {
    const html = renderHtml('login_alert', 'Ada', 'https://fypro.com.ng', meta)
    expect(html).not.toContain('Manage preferences')
  })

  it('falls back to "there" when name is empty', () => {
    const html = renderHtml('login_alert', '', 'https://fypro.com.ng', meta)
    expect(html).toContain('there, we noticed a new login')
  })

  it('renderText includes the reset-password link', () => {
    const text = renderText('login_alert', 'Ada', 'https://fypro.com.ng', meta)
    expect(text).toContain('https://fypro.com.ng/forgot-password')
  })
})

describe('existing email types still render (regression)', () => {
  it('welcome is unaffected by the login_alert changes', () => {
    const html = renderHtml('welcome', 'Ada', 'https://fypro.com.ng')
    expect(html).toContain('Manage preferences')
    expect(html).toContain('Validate your topic now')
  })
})
