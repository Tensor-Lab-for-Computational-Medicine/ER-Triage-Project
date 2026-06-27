import { defineConfig, devices } from '@playwright/test';

const previewPort = process.env.PLAYWRIGHT_PORT || '4173';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${previewPort}`;
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true';
const isCI = Boolean(process.env.CI);
const skipWebServer = process.env.PLAYWRIGHT_SKIP_WEBSERVER === 'true';

export default defineConfig({
  testDir: './tests',
  timeout: 60_000,
  retries: isCI ? 1 : 0,
  workers: isCI ? 1 : undefined,
  expect: {
    timeout: 10_000
  },
  fullyParallel: false,
  reporter: isCI ? [['github'], ['list']] : [['list']],
  use: {
    baseURL,
    trace: 'on-first-retry'
  },
  webServer: skipWebServer
    ? undefined
    : {
        command: `npm run preview -- --host 127.0.0.1 --port ${previewPort} --strictPort`,
        url: baseURL,
        reuseExistingServer,
        timeout: 120_000
      },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
