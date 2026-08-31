import { defineConfig, devices } from "@playwright/test";

const baseURL = "http://127.0.0.1:4321";

export default defineConfig({
  testDir: "./tests/browser",
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: 0,
  reporter: process.env.CI
    ? [["json", { outputFile: "test-results/results.json" }]]
    : "list",
  use: {
    baseURL,
    trace: "off",
    screenshot: "off",
  },
  webServer: {
    command: "pnpm preview",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 120_000,
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "firefox",
      use: { ...devices["Desktop Firefox"] },
    },
    {
      name: "webkit",
      use: { ...devices["Desktop Safari"] },
    },
  ],
});
