import { defineConfig, devices } from '@playwright/test';

import { loadPagesBasePath } from './scripts/pages-config.mjs';

const baseURL = new URL(loadPagesBasePath(), 'http://127.0.0.1:4173').href;

export default defineConfig({
  testDir: './tests/browser',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  // CI runs 117 tests across 3 viewport projects on a 2-worker runner; the
  // longest specs (multi-account login/logout flows) can exceed the default
  // 30s test timeout under that contention even though nothing is actually
  // broken, so give CI more headroom than local runs need.
  timeout: process.env.CI ? 60_000 : 30_000,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL,
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command:
      'VITE_AUTH_ADAPTER=controlled npm run build:pages && npm run preview:pages',
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
