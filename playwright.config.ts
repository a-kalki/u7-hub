import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    baseURL: 'http://localhost:3001',
    ignoreHTTPSErrors: true,
  },
  webServer: {
    command: 'NODE_ENV=test bun run build.ts --dev && NODE_ENV=test bun run packages/core/src/server.ts',
    port: 3001,
    reuseExistingServer: !process.env.CI,
    stdout: 'pipe',
    timeout: 30_000,
    env: {
      PORT: '3001',
      DB_PATH: ':memory:',
      NODE_ENV: 'test'
    }
  },
});