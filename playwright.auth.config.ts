import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  testMatch: "auth-reliability.spec.ts",
  fullyParallel: true,
  timeout: 90_000,
  reporter: "list",
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "firefox", use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", use: { ...devices["Desktop Safari"] } },
  ],
  use: {
    baseURL: "http://127.0.0.1:4174",
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: {
    command: "npx vite --config vite.spa.config.ts --host 127.0.0.1 --port 4174",
    env: {
      VITE_ZGR_API_URL: "http://127.0.0.1:4174/api/clients",
      VITE_ZGR_BUILD_ID: "auth-browsers-local",
    },
    url: "http://127.0.0.1:4174",
    reuseExistingServer: false,
    timeout: 120_000,
  },
});
