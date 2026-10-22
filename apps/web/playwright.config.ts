import { defineConfig } from '@playwright/test'

/**
 * End-to-end tests against a running app: the Docker image or `node apps/server/dist/index.js`
 * (http://localhost:3000, the default), or `pnpm dev` (E2E_BASE_URL=http://localhost:15173).
 * The host account comes from E2E_USERNAME / E2E_PASSWORD.
 *
 * Locally the installed Chrome is used (no browser download); CI sets E2E_CHANNEL=chromium
 * after `playwright install chromium`.
 */
const baseURL = process.env.E2E_BASE_URL ?? 'http://localhost:3000'

export default defineConfig({
  testDir: 'e2e',
  testMatch: '*.e2e.ts',
  globalSetup: './e2e/global-setup.ts',
  timeout: 120_000,
  expect: { timeout: 15_000 },
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL,
    // The first visit's storage notice is a fixed card that could cover buttons; legal.e2e.ts checks it
    // in a context of its own. Contexts the specs open themselves inherit this too.
    storageState: {
      cookies: [],
      origins: [{ origin: new URL(baseURL).origin, localStorage: [{ name: 'quizmoo.storageNotice', value: 'seen' }] }],
    },
    locale: 'en-US',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    {
      name: 'chrome',
      use: process.env.E2E_CHANNEL === 'chromium' ? { browserName: 'chromium' } : { browserName: 'chromium', channel: 'chrome' },
    },
  ],
})
