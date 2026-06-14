import { defineConfig, devices } from '@playwright/test';

const previewPort = process.env.PLAYWRIGHT_PORT || '4173';
const baseURL = process.env.PLAYWRIGHT_BASE_URL || `http://127.0.0.1:${previewPort}`;
const backendPort = process.env.PLAYWRIGHT_BACKEND_PORT || '8000';
const backendURL = process.env.VITE_ED_SIM_API || `http://127.0.0.1:${backendPort}`;
const reuseExistingServer = process.env.PLAYWRIGHT_REUSE_EXISTING_SERVER === 'true';
const isCI = Boolean(process.env.CI);

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
  webServer: [
    {
      command: `python -m uvicorn backend.api.main:app --host 127.0.0.1 --port ${backendPort}`,
      url: `${backendURL}/health`,
      cwd: '..',
      reuseExistingServer: true,
      timeout: 120_000
    },
    {
      command: `npm run preview -- --host 127.0.0.1 --port ${previewPort} --strictPort`,
      url: baseURL,
      reuseExistingServer,
      timeout: 120_000
    }
  ],
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] }
    }
  ]
});
