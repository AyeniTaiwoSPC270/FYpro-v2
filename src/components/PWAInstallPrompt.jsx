import { useEffect, useRef, useState } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'
import { trackEvent } from '../lib/analytics'

const DISMISSED_KEY = 'fypro_pwa_prompt_dismissed'
const PROMPT_DELAY_MS = 30_000

export default function PWAInstallPrompt() {
  const [showInstall, setShowInstall] = useState(false)
  const [showUpdate, setShowUpdate] = useState(false)
  const deferredPrompt = useRef(null)

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return
      const doUpdate = () => { if (navigator.onLine) registration.update().catch(() => {}) }
      // Poll every 60 s so the toast appears while the user is already in the app.
      const id = setInterval(doUpdate, 60_000)
      // Check immediately when the tab becomes visible (mobile app-switch) or focused (desktop tab-switch).
      const onVisible = () => { if (document.visibilityState === 'visible') doUpdate() }
      document.addEventListener('visibilitychange', onVisible)
      window.addEventListener('focus', doUpdate)
      registration._cleanup = () => {
        clearInterval(id)
        document.removeEventListener('visibilitychange', onVisible)
        window.removeEventListener('focus', doUpdate)
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error)
    },
  })

  // Show update toast when a new SW version is waiting
  useEffect(() => {
    if (needRefresh) setShowUpdate(true)
  }, [needRefresh])

  // Listen for the browser's install eligibility signal
  useEffect(() => {
    // Skip if already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) return
    // Skip if student already dismissed or installed
    if (localStorage.getItem(DISMISSED_KEY)) return

    let timerId = null

    function handler(e) {
      e.preventDefault()
      deferredPrompt.current = e
      // Wait 30s before showing — don't interrupt mid-task
      timerId = setTimeout(() => {
        setShowInstall(true)
        trackEvent('pwa_prompt_shown')
      }, PROMPT_DELAY_MS)
    }

    window.addEventListener('beforeinstallprompt', handler)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      if (timerId) clearTimeout(timerId)
    }
  }, [])

  async function handleInstall() {
    if (!deferredPrompt.current) return
    setShowInstall(false)
    // Set dismissed flag before prompt — prevents re-show if user backgrounds the app
    localStorage.setItem(DISMISSED_KEY, '1')
    deferredPrompt.current.prompt()
    const { outcome } = await deferredPrompt.current.userChoice
    deferredPrompt.current = null
    trackEvent(outcome === 'accepted' ? 'pwa_installed' : 'pwa_prompt_dismissed')
  }

  function handleDismiss() {
    setShowInstall(false)
    localStorage.setItem(DISMISSED_KEY, '1')
    trackEvent('pwa_prompt_dismissed')
  }

  return (
    <>
      {showInstall && (
        <>
          <div className="pwa-backdrop" onClick={handleDismiss} />
          <div className="pwa-sheet">
            <div className="pwa-sheet__header">
              <img src="/shield-star.svg" alt="" className="pwa-sheet__icon" />
              <div>
                <div className="pwa-sheet__title">Install FYPro</div>
                <div className="pwa-sheet__subtitle">
                  Add to your home screen for faster access
                </div>
              </div>
            </div>
            <div className="pwa-sheet__actions">
              <button className="pwa-sheet__btn pwa-sheet__btn--primary" onClick={handleInstall}>
                Install
              </button>
              <button className="pwa-sheet__btn pwa-sheet__btn--ghost" onClick={handleDismiss}>
                Not now
              </button>
            </div>
          </div>
        </>
      )}

      {showUpdate && (
        <div className="pwa-update-toast">
          <span>New version available</span>
          <button
            className="pwa-update-toast__reload"
            onClick={() => {
              setShowUpdate(false)
              // Wait for the new SW to take control before reloading, so we don't
              // reload before skipWaiting() resolves and end up on the old version.
              if ('serviceWorker' in navigator) {
                navigator.serviceWorker.addEventListener('controllerchange', () => {
                  window.location.reload()
                }, { once: true })
              }
              updateServiceWorker(false)
            }}
          >
            Reload
          </button>
          <button
            className="pwa-update-toast__close"
            onClick={() => setShowUpdate(false)}
          >
            ✕
          </button>
        </div>
      )}
    </>
  )
}
