import { defineConfig, devices } from "@playwright/test";

const baseURL = process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000";
const hasAuthCredentials = Boolean(
  process.env.PLAYWRIGHT_TEST_EMAIL && process.env.PLAYWRIGHT_TEST_PASSWORD,
);

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? "github" : "list",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: hasAuthCredentials
    ? [
        { name: "setup", testMatch: /auth\.setup\.ts/ },
        {
          name: "chromium",
          use: {
            ...devices["Desktop Chrome"],
            storageState: "tests/e2e/.auth/user.json",
          },
          dependencies: ["setup"],
          testIgnore: /login\.spec\.ts/,
        },
        {
          name: "unauthenticated",
          use: { ...devices["Desktop Chrome"] },
          testMatch: /login\.spec\.ts/,
        },
      ]
    : [
        {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
        },
      ],
  webServer: process.env.PLAYWRIGHT_SKIP_WEBSERVER
    ? undefined
    : {
        command: "npm run dev -- --port 3000",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
