import { render } from '@react-email/render'
import Welcome from './templates/welcome'
import DefenseNudge from './templates/defense-nudge'
import UrgencyReminder from './templates/urgency-reminder'

export type EmailType = 'welcome' | 'defense_nudge' | 'urgency_reminder'

export interface EmailProps {
  name: string
  baseUrl: string
}

export async function renderTemplate(type: EmailType, props: EmailProps): Promise<string> {
  switch (type) {
    case 'welcome':
      return await render(<Welcome {...props} />)
    case 'defense_nudge':
      return await render(<DefenseNudge {...props} />)
    case 'urgency_reminder':
      return await render(<UrgencyReminder {...props} />)
    default:
      throw new Error(`Unknown email type: ${type}`)
  }
}
