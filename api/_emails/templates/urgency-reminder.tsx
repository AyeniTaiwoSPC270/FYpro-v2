import {
  Body, Head, Heading, Hr,
  Html, Img, Link, Preview, Section, Text,
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
  padding: '20px 22px',
  textAlign: 'center',
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
  flexShrink: 0,
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
            <Img src="https://fypro.com.ng/fypro-logo.png" alt="FYPro" height={40} style={{ display: 'block', margin: '0 auto' }} />
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
