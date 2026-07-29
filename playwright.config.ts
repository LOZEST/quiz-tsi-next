import { defineConfig, devices } from '@playwright/test';

const baseURL = 'http://127.0.0.1:4173/quiz-tsi-next/';

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build:pages && npm run preview:pages',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  projects: [
    {
      name: 'desktop',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'ipad-portrait',
      use: { ...devices['iPad Pro 11'], browserName: 'chromium' },
    },
    {
      name: 'ipad-landscape',
      use: {
        ...devices['iPad Pro 11 landscape'],
        browserName: 'chromium',
      },
    },
  ],
});
