import {
  Body, Button, Container, Head, Heading, Hr,
  Html, Link, Preview, Section, Text,
} from '@react-email/components'

interface Props { name: string; baseUrl: string }

const main = { backgroundColor: '#F0F4F8', fontFamily: "'Poppins', Arial, sans-serif" }
const box  = { backgroundColor: '#ffffff', borderRadius: '12px', padding: '40px', maxWidth: '560px', margin: '32px auto' }
const h1   = { fontSize: '22px', fontWeight: '700', color: '#0D1B2A', margin: '0 0 16px' }
const para = { fontSize: '15px', lineHeight: '1.7', color: '#374151', margin: '0 0 24px' }
const btn  = { backgroundColor: '#0066FF', color: '#ffffff', borderRadius: '8px', padding: '12px 24px', fontSize: '15px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }
const hr   = { borderColor: '#E5E7EB', margin: '24px 0' }
const foot = { fontSize: '12px', color: '#9CA3AF', lineHeight: '1.6' }

export default function DefenseNudge({ name, baseUrl }: Props) {
  const firstName = name ? name.split(' ')[0] : 'there'
  return (
    <Html lang="en">
      <Head />
      <Preview>Meet your AI examiners before the real thing — free first session inside</Preview>
      <Body style={main}>
        <Container style={box}>
          <Heading style={h1}>Have you met your examiners yet, {firstName}?</Heading>
          <Text style={para}>
            Most students walk into their defense never having practiced out loud. FYPro's
            Defense Simulator puts you in front of three AI examiners — a methodologist, a
            subject expert, and an external examiner — who push back on your work exactly the
            way the real panel will. Find out where you're weak before it matters.
          </Text>
          <Section>
            <Button href={`${baseUrl}/app/defense`} style={btn}>
              Try a Defense Simulation
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
