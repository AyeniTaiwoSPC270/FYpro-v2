import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: null,
      manifest: false,
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.js',
      injectManifest: {
        // Precache all built assets — same scope as before
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
      },
    }),
  ],
  test: {
    environment: 'node',
    // Orphaned git worktrees under api/.worktrees/ hold stale duplicates of the
    // real suite. They are gitignored, so CI never collects them — excluding them
    // here keeps a local `npm run test` honest about what CI will actually run.
    exclude: ['**/node_modules/**', '**/dist/**', '**/.worktrees/**'],
  },
})
