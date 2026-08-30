import { execSync } from 'node:child_process'
import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// Vercel exposes the deployed commit as an env var at build time; falling
// back to a local `git rev-parse` covers `npm run build`/`dev` outside
// Vercel. Surfaced in Mais → Sobre so a stuck-on-old-version report can be
// diagnosed at a glance (see PwaUpdate below for why that shouldn't happen).
function resolveBuildSha(): string {
  const fromVercel = process.env.VERCEL_GIT_COMMIT_SHA
  if (fromVercel) return fromVercel
  try {
    return execSync('git rev-parse HEAD').toString().trim()
  } catch {
    return 'dev'
  }
}

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_BUILD_SHA__: JSON.stringify(resolveBuildSha()),
    __APP_BUILD_TIME__: JSON.stringify(new Date().toISOString()),
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Registration is done by hand in src/lib/pwa/useAppUpdate.ts (via
      // virtual:pwa-register/react) instead of the plugin's auto-injected
      // script, so the app can check for updates on foreground/online (not
      // just at load) and guard against a reload loop. Because injectRegister
      // isn't 'auto' anymore, the plugin no longer sets workbox.skipWaiting/
      // clientsClaim for us (see node_modules/vite-plugin-pwa/dist/index.js) —
      // set explicitly below instead of relying on that implicit default.
      injectRegister: false,
      manifest: {
        name: 'Polly Veículos',
        short_name: 'Polly',
        description: 'Estoque, vendas e comissão da Polly Veículos',
        lang: 'pt-BR',
        start_url: '/',
        display: 'standalone',
        background_color: '#0f172a',
        theme_color: '#0f172a',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-512-maskable.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Versioned build output (content-hashed by Vite) is safe to precache
        // aggressively — a new deploy always ships new filenames, so there's
        // no staleness risk. HTML is deliberately NOT precached: see
        // navigateFallback below.
        globPatterns: ['**/*.{js,css,svg,png,ico,woff2}'],
        cleanupOutdatedCaches: true,
        skipWaiting: true,
        clientsClaim: true,
        // The default (navigateFallback: 'index.html') would precache-and-route
        // every navigation through the app-shell cache — effectively Cache
        // First for HTML, which is exactly what traps users on a stale build.
        // Disabling it (workbox-build only registers that route when truthy —
        // see node_modules/workbox-build/build/templates/sw-template.js)
        // leaves navigation entirely to the NetworkFirst rule below instead.
        navigateFallback: undefined,
        runtimeCaching: [
          {
            urlPattern: ({ request }) => request.mode === 'navigate',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'polly-pages',
              networkTimeoutSeconds: 3,
              expiration: { maxEntries: 10 },
            },
          },
        ],
      },
    }),
  ],
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
    // e2e/ holds Playwright specs, run separately via `npm run test:e2e` —
    // exclude them here so Vitest doesn't try to execute them too.
    exclude: ['**/node_modules/**', '**/dist/**', 'e2e/**'],
  },
})
