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
