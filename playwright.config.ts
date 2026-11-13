import { defineConfig, devices } from "@playwright/test";

/**
 * End to end against a running app — `docker compose up` locally, the same
 * in CI — with its seeded demo accounts. Nothing here starts a server.
 */
export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    locale: "ar-SA",
    timezoneId: "Asia/Riyadh",
    trace: "retain-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
