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
    // Orphaned git worktrees hold stale duplicates of the real suite. CI's
    // checkout never has them (a plain `actions/checkout` doesn't populate
    // nested worktree gitlinks), so excluding them here keeps a local
    // `npm run test` honest about what CI will actually run. Deliberately
    // '**/worktrees/**', not '**/.worktrees/**' — the pattern must also match
    // .claude/worktrees/<name>/ (no leading dot on "worktrees" itself), which
    // holds a real, currently-registered worktree from prior UI-fix work.
    exclude: ['**/node_modules/**', '**/dist/**', '**/worktrees/**'],
  },
})
