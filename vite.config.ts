import path from 'node:path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Foundation only: no aggressive precaching/offline strategy yet.
      // Consistency of the database is prioritized over full offline support (see ARCHITECTURE.md).
      injectRegister: 'auto',
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
        // Minimal precache of the app shell only — no runtime caching of API/data.
        globPatterns: ['**/*.{js,css,html,svg}'],
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
