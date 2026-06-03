import { precacheAndRoute } from 'workbox-precaching'
import { NavigationRoute, registerRoute } from 'workbox-routing'
import { NetworkFirst, StaleWhileRevalidate, CacheFirst } from 'workbox-strategies'
import { ExpirationPlugin } from 'workbox-expiration'

// Workbox injects the precache manifest array here at build time
precacheAndRoute(self.__WB_MANIFEST)

// Serve index.html for all navigation requests — never intercept /api/
registerRoute(
  new NavigationRoute(new NetworkFirst(), {
    denylist: [/^\/api\//],
  })
)

// Google Fonts stylesheet — stale-while-revalidate (fast + stays fresh)
registerRoute(
  /^https:\/\/fonts\.googleapis\.com\/.*/i,
  new StaleWhileRevalidate({ cacheName: 'google-fonts-stylesheets' })
)

// Google Fonts files — cache for 30 days (they are immutable)
registerRoute(
  /^https:\/\/fonts\.gstatic\.com\/.*/i,
  new CacheFirst({
    cacheName: 'google-fonts-webfonts',
    plugins: [
      new ExpirationPlugin({ maxEntries: 30, maxAgeSeconds: 60 * 60 * 24 * 30 }),
    ],
  })
)

// Push event: parse the JSON payload and show a system notification
self.addEventListener('push', (event) => {
  const data = event.data?.json() ?? {}
  event.waitUntil(
    self.registration.showNotification(data.title ?? 'FYPro', {
      body: data.body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: { url: data.url ?? '/app' },
    })
  )
})

// Notification tap: focus an existing window or open the app at the target URL
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = event.notification.data?.url ?? '/app'
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const existing = list.find((c) => c.url.includes(self.location.origin))
      return existing ? existing.focus() : clients.openWindow(url)
    })
  )
})
