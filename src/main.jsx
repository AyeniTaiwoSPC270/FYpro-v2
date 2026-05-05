import './lib/sentry'
import * as Sentry from "@sentry/react";
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const SentryErrorFallback = () => (
  <div style={{
    display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center',
    height: '100vh', backgroundColor: '#0a0f1e',
    color: 'white', fontFamily: 'Arial, sans-serif'
  }}>
    <h2>Something went wrong</h2>
    <p>We've been notified and are working on a fix.</p>
    <button
      onClick={() => window.location.reload()}
      style={{
        marginTop: '16px', padding: '10px 24px',
        backgroundColor: '#2563eb', color: 'white',
        border: 'none', borderRadius: '8px', cursor: 'pointer'
      }}
    >
      Reload page
    </button>
  </div>
);

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Sentry.ErrorBoundary fallback={<SentryErrorFallback />}>
      <App />
    </Sentry.ErrorBoundary>
  </StrictMode>,
)
