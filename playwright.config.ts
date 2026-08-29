import { existsSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Real-browser smoke tests for routing/auth/mobile nav (see e2e/). These do
// NOT exercise a real backend — no Apps Script Web App is deployed yet — so
// they can only prove the client-side wiring (redirects, form submission,
// error handling), not that sign-in actually succeeds end to end. See
// GO_LIVE_CHECKLIST.md for the real-backend auth smoke test still pending.

// Some sandboxes pre-install Chromium outside Playwright's own managed cache.
// Only point at it when it's actually there, so this config still works
// unmodified on a machine that relies on Playwright's normal browser install.
const preinstalledChromium = '/opt/pw-browsers/chromium'
const executablePath = existsSync(preinstalledChromium) ? preinstalledChromium : undefined

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:4173',
    launchOptions: { executablePath },
  },
  webServer: {
    command: 'npm run preview -- --port 4173',
    url: 'http://localhost:4173',
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'mobile-chromium',
      use: { ...devices['Pixel 7'] },
    },
  ],
})
