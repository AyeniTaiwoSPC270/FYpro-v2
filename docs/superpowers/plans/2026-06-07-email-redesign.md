# Email Redesign — Dark Prestige Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign all 5 user-facing FYPro email templates to the Dark Prestige direction — full dark navy, inline SVG shield header, color-coded accent per email type.

**Architecture:** Templates 1–3 are React Email components (`@react-email/components`) that must be updated in both `src/emails/templates/` and `api/_emails/templates/` (identical copies). Templates 4–5 are raw HTML strings inside serverless functions replaced in-place. No new files created.

**Tech Stack:** React Email (`@react-email/components`), TypeScript, raw HTML strings in Node.js serverless functions.

---

## File Map

| File | Action | What changes |
|---|---|---|
| `src/emails/templates/welcome.tsx` | Modify | Full rewrite — Dark Prestige, green accent |
| `api/_emails/templates/welcome.tsx` | Modify | Identical copy of src version |
| `src/emails/templates/defense-nudge.tsx` | Modify | Full rewrite — Dark Prestige, blue accent |
| `api/_emails/templates/defense-nudge.tsx` | Modify | Identical copy of src version |
| `src/emails/templates/urgency-reminder.tsx` | Modify | Full rewrite — Dark Prestige, red accent, checklist |
| `api/_emails/templates/urgency-reminder.tsx` | Modify | Identical copy of src version |
| `api/payments.js` | Modify | Replace `sendReceiptEmail()` HTML string — amber accent |
| `api/notify.js` | Modify | Replace `buildBroadcastHtml()` HTML string — teal accent |

---

## Shared Design Tokens (reference for all tasks)

```
Background outer:  #060E18
Background card:   #0D1B2A
Header gradient:   linear-gradient(160deg, #0D1B2A 0%, #0a1520 100%)
Body text:         rgba(255,255,255,0.85)
Muted text:        rgba(255,255,255,0.48)
Footer text:       rgba(255,255,255,0.2)
Divider:           rgba(255,255,255,0.06)
Font stack:        Arial, Helvetica, sans-serif

Shield container:  34×34px, background rgba(0,102,255,0.12), border 1.5px solid rgba(0,102,255,0.35), border-radius 7px
Shield SVG path:   M9 2L3 5v5c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V5L9 2z
Checkmark path:    M6.5 9.5l2 2 3-3
SVG stroke:        #3b82f6, stroke-width 1.4, viewBox 0 0 18 18

Wordmark "FY":     #ffffff, 17px, font-weight 800
Wordmark "Pro":    #3b82f6, 17px, font-weight 800
Tagline:           rgba(255,255,255,0.28), 9px, uppercase, letter-spacing 1.8px

Pill font:         9px, font-weight 800, uppercase, letter-spacing 1.5px, border-radius 4px, padding 3px 8px, border 1px solid
Accent bar:        height 3px, full width

Colors per email:
  Welcome:          #16A34A (green)
  Defense Nudge:    #0066FF (blue)
  Urgency Reminder: #DC2626 (red)
  Payment Receipt:  #D97706 (amber) — amount text uses #F59E0B
  Broadcast:        #0891B2 (teal)
```

---

## Task 1: Rewrite `welcome.tsx` (src copy)

**Files:**
- Modify: `src/emails/templates/welcome.tsx`

- [ ] **Step 1: Replace the entire file with the Dark Prestige version**

```tsx
import {
  Body, Container, Head, Heading, Hr,
  Html, Link, Preview, Section, Text, Row, Column,
} from '@react-email/components'

interface Props { name: string; baseUrl: string }

const outer: React.CSSProperties = {
  backgroundColor: '#060E18',
  fontFamily: 'Arial, Helvetica, sans-serif',
  margin: '0',
  padding: '0',
}
const wrapper: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 16px',
}
const accentBar: React.CSSProperties = {
  height: '3px',
  backgroundColor: '#16A34A',
  borderRadius: '8px 8px 0 0',
}
const header: React.CSSProperties = {
  background: 'linear-gradient(160deg, #0D1B2A 0%, #0a1520 100%)',
  padding: '18px 22px',
  display: 'flex',
  alignItems: 'center',
  gap: '11px',
}
const shieldWrap: React.CSSProperties = {
  width: '34px',
  height: '34px',
  backgroundColor: 'rgba(0,102,255,0.12)',
  border: '1.5px solid rgba(0,102,255,0.35)',
  borderRadius: '7px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  verticalAlign: 'middle',
}
const wordmarkMain: React.CSSProperties = {
  fontSize: '17px',
  fontWeight: '800',
  color: '#ffffff',
  lineHeight: '1',
  letterSpacing: '-0.3px',
  margin: '0',
}
const tagline: React.CSSProperties = {
  fontSize: '9px',
  color: 'rgba(255,255,255,0.28)',
  textTransform: 'uppercase',
  letterSpacing: '1.8px',
  margin: '3px 0 0',
}
const cardBody: React.CSSProperties = {
  backgroundColor: '#0D1B2A',
  padding: '22px 22px 20px',
  borderRadius: '0 0 8px 8px',
  border: '1px solid rgba(255,255,255,0.06)',
  borderTop: 'none',
}
const pill: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '9px',
  fontWeight: '800',
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  borderRadius: '4px',
  padding: '3px 8px',
  marginBottom: '14px',
  border: '1px solid rgba(22,163,74,0.3)',
  backgroundColor: 'rgba(22,163,74,0.08)',
  color: '#16A34A',
}
const h1: React.CSSProperties = {
  fontSize: '17px',
  fontWeight: '700',
  color: '#f8fafc',
  lineHeight: '1.35',
  margin: '0 0 10px',
}
const para: React.CSSProperties = {
  fontSize: '13px',
  color: 'rgba(255,255,255,0.5)',
  lineHeight: '1.75',
  margin: '0 0 18px',
}
const btn: React.CSSProperties = {
  backgroundColor: '#16A34A',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '11px 20px',
  fontSize: '13px',
  fontWeight: '700',
  textDecoration: 'none',
  display: 'inline-block',
}
const divider: React.CSSProperties = {
  borderColor: 'rgba(255,255,255,0.06)',
  margin: '18px 0 14px',
}
const footer: React.CSSProperties = {
  fontSize: '10.5px',
  color: 'rgba(255,255,255,0.2)',
  lineHeight: '1.6',
  margin: '0',
}
const footerLink: React.CSSProperties = {
  color: 'rgba(255,255,255,0.3)',
}

export default function Welcome({ name, baseUrl }: Props) {
  const firstName = name ? name.split(' ')[0] : 'there'
  return (
    <Html lang="en">
      <Head />
      <Preview>Your FYPro journey starts now — validate your topic in 2 minutes</Preview>
      <Body style={outer}>
        <div style={wrapper}>
          {/* Accent bar */}
          <div style={accentBar} />

          {/* Header */}
          <div style={header}>
            <div style={shieldWrap}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 2L3 5v5c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V5L9 2z" stroke="#3b82f6" strokeWidth="1.4" fill="none"/>
                <path d="M6.5 9.5l2 2 3-3" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '11px' }}>
              <p style={wordmarkMain}>FY<span style={{ color: '#3b82f6' }}>Pro</span></p>
              <p style={tagline}>Your Final Year Companion</p>
            </div>
          </div>

          {/* Body */}
          <div style={cardBody}>
            <div style={pill}>Welcome</div>
            <Heading style={h1}>{firstName}, your research journey starts today.</Heading>
            <Text style={para}>
              You've joined thousands of Nigerian final year students who are taking their
              project seriously. Your next step is simple — paste your topic idea and find out
              if it's defensible before your supervisor ever sees it.
            </Text>
            <Section>
              <a href={`${baseUrl}/app/topic-validator`} style={btn}>
                Validate your topic now →
              </a>
            </Section>
            <Hr style={divider} />
            <Text style={footer}>
              You're receiving this because you signed up at fypro.com.ng<br />
              FYPro · Lagos, Nigeria ·{' '}
              <Link href={`${baseUrl}/account/email-preferences`} style={footerLink}>
                Manage preferences
              </Link>
            </Text>
          </div>
        </div>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/emails/templates/welcome.tsx
git commit -m "feat: redesign welcome email — Dark Prestige, green accent"
```

---

## Task 2: Mirror welcome.tsx to api/_emails

**Files:**
- Modify: `api/_emails/templates/welcome.tsx`

- [ ] **Step 1: Copy the exact content from `src/emails/templates/welcome.tsx` into `api/_emails/templates/welcome.tsx`**

The two files must be byte-for-byte identical. Copy the full content written in Task 1.

- [ ] **Step 2: Commit**

```bash
git add api/_emails/templates/welcome.tsx
git commit -m "feat: mirror welcome email redesign to api/_emails"
```

---

## Task 3: Rewrite `defense-nudge.tsx` (src copy)

**Files:**
- Modify: `src/emails/templates/defense-nudge.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
import {
  Body, Head, Heading, Hr,
  Html, Link, Preview, Section, Text,
} from '@react-email/components'

interface Props { name: string; baseUrl: string }

const outer: React.CSSProperties = {
  backgroundColor: '#060E18',
  fontFamily: 'Arial, Helvetica, sans-serif',
  margin: '0',
  padding: '0',
}
const wrapper: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 16px',
}
const accentBar: React.CSSProperties = {
  height: '3px',
  backgroundColor: '#0066FF',
  borderRadius: '8px 8px 0 0',
}
const header: React.CSSProperties = {
  background: 'linear-gradient(160deg, #0D1B2A 0%, #0a1520 100%)',
  padding: '18px 22px',
}
const shieldWrap: React.CSSProperties = {
  width: '34px',
  height: '34px',
  backgroundColor: 'rgba(0,102,255,0.12)',
  border: '1.5px solid rgba(0,102,255,0.35)',
  borderRadius: '7px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  verticalAlign: 'middle',
}
const wordmarkMain: React.CSSProperties = {
  fontSize: '17px',
  fontWeight: '800',
  color: '#ffffff',
  lineHeight: '1',
  letterSpacing: '-0.3px',
  margin: '0',
}
const tagline: React.CSSProperties = {
  fontSize: '9px',
  color: 'rgba(255,255,255,0.28)',
  textTransform: 'uppercase',
  letterSpacing: '1.8px',
  margin: '3px 0 0',
}
const cardBody: React.CSSProperties = {
  backgroundColor: '#0D1B2A',
  padding: '22px 22px 20px',
  borderRadius: '0 0 8px 8px',
  border: '1px solid rgba(255,255,255,0.06)',
  borderTop: 'none',
}
const pill: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '9px',
  fontWeight: '800',
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  borderRadius: '4px',
  padding: '3px 8px',
  marginBottom: '14px',
  border: '1px solid rgba(0,102,255,0.3)',
  backgroundColor: 'rgba(0,102,255,0.08)',
  color: '#3b82f6',
}
const h1: React.CSSProperties = {
  fontSize: '17px',
  fontWeight: '700',
  color: '#f8fafc',
  lineHeight: '1.35',
  margin: '0 0 10px',
}
const para: React.CSSProperties = {
  fontSize: '13px',
  color: 'rgba(255,255,255,0.5)',
  lineHeight: '1.75',
  margin: '0 0 18px',
}
const btn: React.CSSProperties = {
  backgroundColor: '#0066FF',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '11px 20px',
  fontSize: '13px',
  fontWeight: '700',
  textDecoration: 'none',
  display: 'inline-block',
}
const divider: React.CSSProperties = {
  borderColor: 'rgba(255,255,255,0.06)',
  margin: '18px 0 14px',
}
const footer: React.CSSProperties = {
  fontSize: '10.5px',
  color: 'rgba(255,255,255,0.2)',
  lineHeight: '1.6',
  margin: '0',
}
const footerLink: React.CSSProperties = { color: 'rgba(255,255,255,0.3)' }

export default function DefenseNudge({ name, baseUrl }: Props) {
  const firstName = name ? name.split(' ')[0] : 'there'
  return (
    <Html lang="en">
      <Head />
      <Preview>Meet your AI examiners before the real thing — free first session inside</Preview>
      <Body style={outer}>
        <div style={wrapper}>
          <div style={accentBar} />
          <div style={header}>
            <div style={shieldWrap}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 2L3 5v5c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V5L9 2z" stroke="#3b82f6" strokeWidth="1.4" fill="none"/>
                <path d="M6.5 9.5l2 2 3-3" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '11px' }}>
              <p style={wordmarkMain}>FY<span style={{ color: '#3b82f6' }}>Pro</span></p>
              <p style={tagline}>Your Final Year Companion</p>
            </div>
          </div>
          <div style={cardBody}>
            <div style={pill}>Defense Prep</div>
            <Heading style={h1}>{firstName}, have you met your examiners yet?</Heading>
            <Text style={para}>
              Most students walk into their defense never having practiced out loud. FYPro's
              Defense Simulator puts you in front of three AI examiners who push back exactly
              the way the real panel will. Find out where you're weak before it matters.
            </Text>
            <Section>
              <a href={`${baseUrl}/app/defense`} style={btn}>
                Try a Defense Simulation →
              </a>
            </Section>
            <Hr style={divider} />
            <Text style={footer}>
              You're receiving this because you signed up at fypro.com.ng<br />
              FYPro · Lagos, Nigeria ·{' '}
              <Link href={`${baseUrl}/account/email-preferences`} style={footerLink}>
                Manage preferences
              </Link>
            </Text>
          </div>
        </div>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/emails/templates/defense-nudge.tsx
git commit -m "feat: redesign defense nudge email — Dark Prestige, blue accent"
```

---

## Task 4: Mirror defense-nudge.tsx to api/_emails

**Files:**
- Modify: `api/_emails/templates/defense-nudge.tsx`

- [ ] **Step 1: Copy the exact content from `src/emails/templates/defense-nudge.tsx` into `api/_emails/templates/defense-nudge.tsx`**

- [ ] **Step 2: Commit**

```bash
git add api/_emails/templates/defense-nudge.tsx
git commit -m "feat: mirror defense nudge email redesign to api/_emails"
```

---

## Task 5: Rewrite `urgency-reminder.tsx` (src copy)

**Files:**
- Modify: `src/emails/templates/urgency-reminder.tsx`

- [ ] **Step 1: Replace the entire file**

```tsx
import {
  Body, Head, Heading, Hr,
  Html, Link, Preview, Section, Text,
} from '@react-email/components'

interface Props { name: string; baseUrl: string }

const outer: React.CSSProperties = {
  backgroundColor: '#060E18',
  fontFamily: 'Arial, Helvetica, sans-serif',
  margin: '0',
  padding: '0',
}
const wrapper: React.CSSProperties = {
  maxWidth: '560px',
  margin: '0 auto',
  padding: '32px 16px',
}
const accentBar: React.CSSProperties = {
  height: '3px',
  backgroundColor: '#DC2626',
  borderRadius: '8px 8px 0 0',
}
const header: React.CSSProperties = {
  background: 'linear-gradient(160deg, #0D1B2A 0%, #0a1520 100%)',
  padding: '18px 22px',
}
const shieldWrap: React.CSSProperties = {
  width: '34px',
  height: '34px',
  backgroundColor: 'rgba(0,102,255,0.12)',
  border: '1.5px solid rgba(0,102,255,0.35)',
  borderRadius: '7px',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  verticalAlign: 'middle',
}
const wordmarkMain: React.CSSProperties = {
  fontSize: '17px',
  fontWeight: '800',
  color: '#ffffff',
  lineHeight: '1',
  letterSpacing: '-0.3px',
  margin: '0',
}
const tagline: React.CSSProperties = {
  fontSize: '9px',
  color: 'rgba(255,255,255,0.28)',
  textTransform: 'uppercase',
  letterSpacing: '1.8px',
  margin: '3px 0 0',
}
const cardBody: React.CSSProperties = {
  backgroundColor: '#0D1B2A',
  padding: '22px 22px 20px',
  borderRadius: '0 0 8px 8px',
  border: '1px solid rgba(255,255,255,0.06)',
  borderTop: 'none',
}
const pill: React.CSSProperties = {
  display: 'inline-block',
  fontSize: '9px',
  fontWeight: '800',
  textTransform: 'uppercase',
  letterSpacing: '1.5px',
  borderRadius: '4px',
  padding: '3px 8px',
  marginBottom: '14px',
  border: '1px solid rgba(220,38,38,0.3)',
  backgroundColor: 'rgba(220,38,38,0.08)',
  color: '#EF4444',
}
const h1: React.CSSProperties = {
  fontSize: '17px',
  fontWeight: '700',
  color: '#f8fafc',
  lineHeight: '1.35',
  margin: '0 0 10px',
}
const para: React.CSSProperties = {
  fontSize: '13px',
  color: 'rgba(255,255,255,0.5)',
  lineHeight: '1.75',
  margin: '0 0 14px',
}
const checkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '10px',
  marginBottom: '10px',
}
const checkBox: React.CSSProperties = {
  width: '15px',
  height: '15px',
  borderRadius: '3px',
  border: '1.5px solid rgba(255,255,255,0.15)',
  flexShrink: '0' as any,
  marginTop: '1px',
  display: 'inline-block',
}
const checkText: React.CSSProperties = {
  fontSize: '13px',
  color: 'rgba(255,255,255,0.55)',
  lineHeight: '1.4',
  margin: '0',
}
const btn: React.CSSProperties = {
  backgroundColor: '#DC2626',
  color: '#ffffff',
  borderRadius: '8px',
  padding: '11px 20px',
  fontSize: '13px',
  fontWeight: '700',
  textDecoration: 'none',
  display: 'inline-block',
  marginTop: '6px',
}
const divider: React.CSSProperties = {
  borderColor: 'rgba(255,255,255,0.06)',
  margin: '18px 0 14px',
}
const footer: React.CSSProperties = {
  fontSize: '10.5px',
  color: 'rgba(255,255,255,0.2)',
  lineHeight: '1.6',
  margin: '0',
}
const footerLink: React.CSSProperties = { color: 'rgba(255,255,255,0.3)' }

const CHECKLIST = [
  'Topic locked and validated?',
  'Methodology chosen and defensible?',
  'Project PDF uploaded for review?',
  'Defense Simulator score 7 or above?',
]

export default function UrgencyReminder({ name, baseUrl }: Props) {
  const firstName = name ? name.split(' ')[0] : 'there'
  return (
    <Html lang="en">
      <Head />
      <Preview>Defense checklist — where do you stand right now?</Preview>
      <Body style={outer}>
        <div style={wrapper}>
          <div style={accentBar} />
          <div style={header}>
            <div style={shieldWrap}>
              <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 2L3 5v5c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V5L9 2z" stroke="#3b82f6" strokeWidth="1.4" fill="none"/>
                <path d="M6.5 9.5l2 2 3-3" stroke="#3b82f6" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </div>
            <div style={{ display: 'inline-block', verticalAlign: 'middle', marginLeft: '11px' }}>
              <p style={wordmarkMain}>FY<span style={{ color: '#3b82f6' }}>Pro</span></p>
              <p style={tagline}>Your Final Year Companion</p>
            </div>
          </div>
          <div style={cardBody}>
            <div style={pill}>Checklist</div>
            <Heading style={h1}>{firstName} — a week in. Are you ready?</Heading>
            <Text style={para}>The clock is moving. Run through this before you do anything else:</Text>
            {CHECKLIST.map((item) => (
              <div key={item} style={checkRow}>
                <div style={checkBox} />
                <Text style={checkText}>{item}</Text>
              </div>
            ))}
            <Section>
              <a href={`${baseUrl}/dashboard`} style={btn}>
                Open my dashboard →
              </a>
            </Section>
            <Hr style={divider} />
            <Text style={footer}>
              You're receiving this because you signed up at fypro.com.ng<br />
              FYPro · Lagos, Nigeria ·{' '}
              <Link href={`${baseUrl}/account/email-preferences`} style={footerLink}>
                Manage preferences
              </Link>
            </Text>
          </div>
        </div>
      </Body>
    </Html>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/emails/templates/urgency-reminder.tsx
git commit -m "feat: redesign urgency reminder email — Dark Prestige, red accent, checklist"
```

---

## Task 6: Mirror urgency-reminder.tsx to api/_emails

**Files:**
- Modify: `api/_emails/templates/urgency-reminder.tsx`

- [ ] **Step 1: Copy the exact content from `src/emails/templates/urgency-reminder.tsx` into `api/_emails/templates/urgency-reminder.tsx`**

- [ ] **Step 2: Commit**

```bash
git add api/_emails/templates/urgency-reminder.tsx
git commit -m "feat: mirror urgency reminder email redesign to api/_emails"
```

---

## Task 7: Rewrite payment receipt HTML in `api/payments.js`

**Files:**
- Modify: `api/payments.js` — `sendReceiptEmail()` function only (lines ~33–68)

- [ ] **Step 1: Replace the `html` template string inside `sendReceiptEmail()`**

Find `sendReceiptEmail` in `api/payments.js`. Replace only the `html:` value passed to `resend.emails.send()`. The function signature, the `planDisplay` lookup, and the `resend.emails.send()` call remain unchanged — only the HTML string changes.

Replace:
```js
html: `
<div style="font-family: Arial, sans-serif; max-width: 480px; margin: 0 auto;">
  ...existing receipt HTML...
</div>`
```

With:
```js
html: `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background-color:#060E18;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="height:3px;background-color:#D97706;border-radius:8px 8px 0 0;"></div>
  <div style="background:linear-gradient(160deg,#0D1B2A 0%,#0a1520 100%);padding:18px 22px;">
    <div style="display:inline-block;width:34px;height:34px;background:rgba(0,102,255,0.12);border:1.5px solid rgba(0,102,255,0.35);border-radius:7px;text-align:center;line-height:34px;vertical-align:middle;">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-top:-2px;"><path d="M9 2L3 5v5c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V5L9 2z" stroke="#3b82f6" stroke-width="1.4" fill="none"/><path d="M6.5 9.5l2 2 3-3" stroke="#3b82f6" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div style="display:inline-block;vertical-align:middle;margin-left:11px;">
      <p style="font-size:17px;font-weight:800;color:#ffffff;line-height:1;letter-spacing:-0.3px;margin:0;">FY<span style="color:#3b82f6;">Pro</span></p>
      <p style="font-size:9px;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:1.8px;margin:3px 0 0;">Your Final Year Companion</p>
    </div>
  </div>
  <div style="background-color:#0D1B2A;padding:22px 22px 20px;border-radius:0 0 8px 8px;border:1px solid rgba(255,255,255,0.06);border-top:none;">
    <div style="display:inline-block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;border-radius:4px;padding:3px 8px;margin-bottom:14px;border:1px solid rgba(217,119,6,0.3);background:rgba(217,119,6,0.08);color:#F59E0B;">Payment Confirmed</div>
    <h1 style="font-size:17px;font-weight:700;color:#f8fafc;line-height:1.35;margin:0 0 16px;">Your FYPro access is unlocked.</h1>
    <div style="background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.07);border-radius:8px;padding:14px;margin-bottom:16px;">
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="font-size:12px;color:rgba(255,255,255,0.35);">Plan</span><span style="font-size:12px;color:rgba(255,255,255,0.75);font-weight:600;">${planDisplay}</span></div>
      <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="font-size:12px;color:rgba(255,255,255,0.35);">Amount paid</span><span style="font-size:12px;color:#F59E0B;font-weight:600;">&#x20A6;${amount}</span></div>
      <div style="display:flex;justify-content:space-between;"><span style="font-size:12px;color:rgba(255,255,255,0.35);">Reference</span><span style="font-size:11px;color:rgba(255,255,255,0.6);font-family:monospace;">${reference}</span></div>
    </div>
    <p style="font-size:13px;color:rgba(255,255,255,0.5);line-height:1.75;margin:0 0 16px;">You now have full access. Log in to continue.</p>
    <a href="https://fypro.com.ng/dashboard" style="display:inline-block;background-color:#D97706;color:#ffffff;border-radius:8px;padding:11px 20px;font-size:13px;font-weight:700;text-decoration:none;">Go to my dashboard &#8594;</a>
    <div style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:18px 0 14px;"></div>
    <p style="font-size:10.5px;color:rgba(255,255,255,0.2);line-height:1.6;margin:0;">Keep this email as your receipt.<br>FYPro &middot; Lagos, Nigeria &middot; <a href="mailto:hello@fypro.com.ng" style="color:rgba(255,255,255,0.3);">hello@fypro.com.ng</a></p>
  </div>
</div>
</body></html>`
```

- [ ] **Step 2: Commit**

```bash
git add api/payments.js
git commit -m "feat: redesign payment receipt email — Dark Prestige, amber accent"
```

---

## Task 8: Rewrite broadcast HTML in `api/notify.js`

**Files:**
- Modify: `api/notify.js` — `buildBroadcastHtml()` function only (lines ~60–89)

- [ ] **Step 1: Replace the entire `buildBroadcastHtml` function**

```js
function buildBroadcastHtml(body) {
  const safe = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>')
  return `<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"></head><body style="margin:0;padding:0;background-color:#060E18;font-family:Arial,Helvetica,sans-serif;">
<div style="max-width:560px;margin:0 auto;padding:32px 16px;">
  <div style="height:3px;background-color:#0891B2;border-radius:8px 8px 0 0;"></div>
  <div style="background:linear-gradient(160deg,#0D1B2A 0%,#0a1520 100%);padding:18px 22px;">
    <div style="display:inline-block;width:34px;height:34px;background:rgba(0,102,255,0.12);border:1.5px solid rgba(0,102,255,0.35);border-radius:7px;text-align:center;line-height:34px;vertical-align:middle;">
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg" style="vertical-align:middle;margin-top:-2px;"><path d="M9 2L3 5v5c0 3.5 2.5 6.5 6 7.5 3.5-1 6-4 6-7.5V5L9 2z" stroke="#3b82f6" stroke-width="1.4" fill="none"/><path d="M6.5 9.5l2 2 3-3" stroke="#3b82f6" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
    <div style="display:inline-block;vertical-align:middle;margin-left:11px;">
      <p style="font-size:17px;font-weight:800;color:#ffffff;line-height:1;letter-spacing:-0.3px;margin:0;">FY<span style="color:#3b82f6;">Pro</span></p>
      <p style="font-size:9px;color:rgba(255,255,255,0.28);text-transform:uppercase;letter-spacing:1.8px;margin:3px 0 0;">Your Final Year Companion</p>
    </div>
  </div>
  <div style="background-color:#0D1B2A;padding:22px 22px 20px;border-radius:0 0 8px 8px;border:1px solid rgba(255,255,255,0.06);border-top:none;">
    <div style="display:inline-block;font-size:9px;font-weight:800;text-transform:uppercase;letter-spacing:1.5px;border-radius:4px;padding:3px 8px;margin-bottom:14px;border:1px solid rgba(8,145,178,0.3);background:rgba(8,145,178,0.08);color:#22D3EE;">Announcement</div>
    <h1 style="font-size:17px;font-weight:700;color:#f8fafc;line-height:1.35;margin:0 0 14px;">A message from FYPro</h1>
    <div style="background:rgba(8,145,178,0.08);border-left:3px solid #0891B2;border-radius:0 6px 6px 0;padding:12px 16px;margin-bottom:18px;">
      <p style="font-size:13px;color:rgba(255,255,255,0.6);line-height:1.75;margin:0;">${safe}</p>
    </div>
    <div style="border:none;border-top:1px solid rgba(255,255,255,0.06);margin:18px 0 14px;"></div>
    <p style="font-size:10.5px;color:rgba(255,255,255,0.2);line-height:1.6;margin:0;">You're receiving this because you have an account at fypro.com.ng.<br>FYPro &middot; Lagos, Nigeria</p>
  </div>
</div>
</body></html>`
}
```

- [ ] **Step 2: Commit**

```bash
git add api/notify.js
git commit -m "feat: redesign broadcast email — Dark Prestige, teal accent"
```

---

## Self-Review Notes

- All 5 emails covered: welcome ✓, defense-nudge ✓, urgency-reminder ✓, payment receipt ✓, broadcast ✓
- Both `src/` and `api/_emails/` copies updated for React Email templates ✓
- No `@import` or Google Fonts — Arial stack only ✓
- No CSS animations ✓
- All styles inline (React Email) or inline strings (raw HTML) ✓
- `planDisplay`, `amount`, `reference` interpolations preserved in receipt ✓
- `safe` escaping preserved in broadcast ✓
- Shield SVG identical across all 5 ✓
- Color tokens consistent with spec ✓
- Subjects unchanged ✓
- Sending logic unchanged ✓
