import posthog from 'posthog-js'

export function trackEvent(name, properties = {}) {
  posthog.capture(name, properties)
}

export function identifyUser(userId, properties = {}) {
  posthog.identify(userId, properties)
}

export function resetUser() {
  posthog.reset()
}
