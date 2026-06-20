import * as Sentry from '@sentry/node';

// VITE_SENTRY_DSN is a public key — not a secret. In Vercel, all env vars
// (including VITE_-prefixed ones) are available as process.env.* in serverless
// functions at runtime, even though only VITE_* vars get embedded in the
// client bundle by Vite at build time.
const dsn = process.env.VITE_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.VITE_APP_ENV || 'production',
    // No performance tracing in serverless — just error capture
    tracesSampleRate: 0,
    beforeSend(event) {
      if (event.user) {
        delete event.user.ip_address;
        delete event.user.email;
        delete event.user.username;
      }
      return event;
    },
  });
}

export { Sentry };
