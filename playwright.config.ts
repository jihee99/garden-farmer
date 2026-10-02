import { defineConfig } from '@playwright/test'

export default defineConfig({
  testDir: 'tests/e2e',
  timeout: 60_000,
  workers: 1,
  use: {
    baseURL: 'http://localhost:3000',
    channel: 'chrome',
    viewport: { width: 390, height: 844 },
  },
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000/login',
    reuseExistingServer: true,
    timeout: 120_000,
  },
})
