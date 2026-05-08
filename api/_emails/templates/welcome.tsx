import {
  Body, Button, Container, Head, Heading, Hr,
  Html, Link, Preview, Section, Text,
} from '@react-email/components'

interface Props { name: string; baseUrl: string }

const main    = { backgroundColor: '#F0F4F8', fontFamily: "'Poppins', Arial, sans-serif" }
const box     = { backgroundColor: '#ffffff', borderRadius: '12px', padding: '40px', maxWidth: '560px', margin: '32px auto' }
const h1      = { fontSize: '22px', fontWeight: '700', color: '#0D1B2A', margin: '0 0 16px' }
const para    = { fontSize: '15px', lineHeight: '1.7', color: '#374151', margin: '0 0 24px' }
const btn     = { backgroundColor: '#16A34A', color: '#ffffff', borderRadius: '8px', padding: '12px 24px', fontSize: '15px', fontWeight: '600', textDecoration: 'none', display: 'inline-block' }
const hr      = { borderColor: '#E5E7EB', margin: '24px 0' }
const foot    = { fontSize: '12px', color: '#9CA3AF', lineHeight: '1.6' }

export default function Welcome({ name, baseUrl }: Props) {
  const firstName = name ? name.split(' ')[0] : 'there'
  return (
    <Html lang="en">
      <Head />
      <Preview>Your FYPro journey starts now — validate your topic in 2 minutes</Preview>
      <Body style={main}>
        <Container style={box}>
          <Heading style={h1}>Welcome to FYPro, {firstName}</Heading>
          <Text style={para}>
            You've just joined thousands of Nigerian final year students who are taking their
            project seriously. Your next step is simple — paste your topic idea into our Topic
            Validator and find out if it's defensible before your supervisor ever sees it.
          </Text>
          <Section>
            <Button href={`${baseUrl}/app/topic-validator`} style={btn}>
              Validate your topic now
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
