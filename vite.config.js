import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // 'prompt' means we control when the SW activates via useRegisterSW
      registerType: 'prompt',
      // null = we handle SW registration ourselves via useRegisterSW hook
      injectRegister: null,
      // false = we manage public/manifest.json directly
      manifest: false,
      workbox: {
        // Precache all built assets
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        // Serve index.html for all navigation requests (client-side routing)
        navigateFallback: 'index.html',
        // Never serve index.html for /api/* — let those fail to network
        navigateFallbackDenylist: [/^\/api\//],
        runtimeCaching: [
          {
            // Google Fonts stylesheet — stale while revalidate (fast + fresh)
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'StaleWhileRevalidate',
            options: {
              cacheName: 'google-fonts-stylesheets',
            },
          },
          {
            // Font files themselves — cache for 30 days (they never change)
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-webfonts',
              expiration: {
                maxEntries: 30,
                maxAgeSeconds: 60 * 60 * 24 * 30,
              },
            },
          },
        ],
      },
    }),
  ],
})
