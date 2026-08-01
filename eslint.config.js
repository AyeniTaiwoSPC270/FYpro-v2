import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores([
    'dist',
    // Not shipped: old branch checkouts, a frozen copy of the v1 app, and
    // agent-tooling directories. Linting them adds noise for code that never runs.
    '.claude/worktrees/**',
    '.claude/old fypro folder/**',
    '.claude/skills/**',
    '.agents/skills/**',
    'graphify-out/**',
  ]),
  {
    files: ['**/*.{js,jsx}'],
    extends: [
      js.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        ecmaFeatures: { jsx: true },
        sourceType: 'module',
      },
    },
    rules: {
      'no-unused-vars': ['error', { varsIgnorePattern: '^[A-Z_]' }],
    },
  },
  {
    // api/ (Vercel serverless functions) and scripts/ (dev/ops CLIs) run under
    // Node, not the browser — grant them Node globals (process, Buffer, etc.)
    // instead of the browser set so they don't trip no-undef.
    files: ['api/**/*.js', 'scripts/**/*.js', 'middleware.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Root config files (vite.config.js, tailwind.config.js, postcss.config.js,
    // this file) also run under Node at build time, not in the browser.
    files: ['*.config.js'],
    languageOptions: {
      globals: globals.node,
    },
  },
  {
    // Service worker source runs in the SW global scope (self, clients, caches),
    // not the browser window/document scope.
    files: ['src/sw.js', 'src/service-worker.js', 'src/**/*sw*.js'],
    languageOptions: {
      globals: globals.serviceworker,
    },
  },
  {
    // Test files run under Node/Vitest, not the browser — grant them Node globals
    // (process, Buffer, etc.) on top of the browser set so they don't trip no-undef.
    files: ['**/*.test.{js,jsx}'],
    languageOptions: {
      globals: globals.node,
    },
  },
])
