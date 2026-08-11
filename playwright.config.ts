import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests",
  testMatch: ["responsive.spec.ts", "pwa.spec.ts"],
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["line"], ["html", { open: "never" }]] : "line",
  use: {
    baseURL: "http://127.0.0.1:4173",
    locale: "he-IL",
    timezoneId: "Asia/Jerusalem",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "npm run db:deploy && npm run db:seed && npm run api:start",
    url: "http://127.0.0.1:4173/api/health/ready",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: "4173",
      APP_ORIGIN: "http://127.0.0.1:4173",
      NODE_ENV: "production",
      JWT_ACCESS_SECRET: "responsive-test-access-secret-longer-than-thirty-two-characters",
      JWT_ISSUER: "linoy-designs-responsive-test",
      JWT_AUDIENCE: "linoy-designs-responsive-test-client",
      SHUTDOWN_TIMEOUT_MS: "5000",
    },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  outputDir: "test-results/responsive",
});
