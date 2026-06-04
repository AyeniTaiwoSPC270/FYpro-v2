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
            onClick={() => updateServiceWorker(true)}
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
