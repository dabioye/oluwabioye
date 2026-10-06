import os from 'node:os';
import path from 'node:path';
import { defineConfig, devices } from '@playwright/test';

// End-to-end tests against the real static builds (run `npm run build` first) behind the local
// Firebase Hosting stand-in, with a throwaway JSON data store.
const PUBLIC = 'http://localhost:3100';
const INVITE = 'http://localhost:3101';
const META = 'http://localhost:3199';

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['list']] : 'list',
  use: {
    ...devices['Pixel 7'],
    trace: 'retain-on-failure',
    // Lets a pre-installed Chromium be used where `playwright install` isn't possible.
    launchOptions: process.env.PW_CHROMIUM ? { executablePath: process.env.PW_CHROMIUM } : {},
  },
  metadata: { PUBLIC, INVITE, META },
  webServer: [
    { command: 'node tests/e2e/fake-meta.mjs', url: `${META}/__sent`, reuseExistingServer: false, env: { PORT: '3199' } },
    {
      command: 'node scripts/serve.mjs',
      url: `${PUBLIC}/api/session`,
      reuseExistingServer: false,
      env: {
        PUBLIC_PORT: '3100',
        INVITE_PORT: '3101',
        BASE_URL: PUBLIC,
        INVITE_URL: INVITE,
        STORE: 'json',
        DATA_DIR: path.join(os.tmpdir(), `sd-e2e-${Date.now()}`),
        ADMIN_PASSWORD: 'test-admin',
        CHECKIN_PIN: '4321',
        SESSION_SECRET: 'e2e-secret-e2e-secret-e2e-secret',
        LOGIN_LIMIT: '100',
        // WhatsApp Business, against the stand-in above
        WHATSAPP_API_BASE: META,
        WHATSAPP_TOKEN: 'e2e-token',
        WHATSAPP_PHONE_ID: 'PHONE1',
        WHATSAPP_APP_SECRET: 'e2e-app-secret',
        WHATSAPP_ALERT_TO: '08011112222',
      },
    },
  ],
});

export { INVITE, META, PUBLIC };
