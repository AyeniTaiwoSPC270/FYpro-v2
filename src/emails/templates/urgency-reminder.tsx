import {
  Body, Button, Container, Head, Heading, Hr,
  Html, Link, Preview, Section, Text,
} from '@react-email/components'

interface Props { name: string; baseUrl: string }

const main  = { backgroundColor: '#F0F4F8', fontFamily: "'Poppins', Arial, sans-serif" }
const box   = { backgroundColor: '#ffffff', borderRadius: '12px', padding: '40px', maxWidth: '560px', margin: '32px auto' }
const h1    = { fontSize: '22px', fontWeight: '700', color: '#0D1B2A', margin: '0 0 16px' }
const para  = { fontSize: '15px', lineHeight: '1.7', color: '#374151', margin: '0 0 16px' }
const item  = { fontSize: '15px', lineHeight: '1.7', color: '#374151', margin: '0 0 10px', paddingLeft: '8px' }
const btn   = { backgroundColor: '#16A34A', color: '#ffffff', borderRadius: '8px', padding: '12px 24px', fontSize: '15px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }
const hr    = { borderColor: '#E5E7EB', margin: '24px 0' }
const foot  = { fontSize: '12px', color: '#9CA3AF', lineHeight: '1.6' }

export default function UrgencyReminder({ name, baseUrl }: Props) {
  const firstName = name ? name.split(' ')[0] : 'there'
  return (
    <Html lang="en">
      <Head />
      <Preview>Defense checklist — where do you stand right now?</Preview>
      <Body style={main}>
        <Container style={box}>
          <Heading style={h1}>Defense checklist, {firstName} — are you ready?</Heading>
          <Text style={para}>
            A week in and the clock is moving. Run through this before you do anything else:
          </Text>
          <Text style={item}>☐ &nbsp; Topic locked and validated?</Text>
          <Text style={item}>☐ &nbsp; Methodology chosen and defensible?</Text>
          <Text style={item}>☐ &nbsp; Project PDF uploaded for review?</Text>
          <Text style={item}>☐ &nbsp; Defense Simulator score 7 or above?</Text>
          <Text style={{ ...para, marginTop: '16px' }}>
            If any box is unchecked, open your dashboard and work through it.
            Your panel will not go easy on gaps.
          </Text>
          <Section>
            <Button href={`${baseUrl}/dashboard`} style={btn}>
              Open my dashboard
            </Button>
          </Section>
          <Hr style={hr} />
          <Text style={foot}>
            You're receiving this because you signed up for FYPro.<br />
            FYPro · Lagos, Nigeria<br />
            <Link href={`${baseUrl}/account/email-preferences`} style={{ color: '#6B7280' }}>
              Manage email preferences
            </Link>
          </Text>
        </Container>
      </Body>
    </Html>
  )
}
