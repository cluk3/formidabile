import { defineConfig, devices } from "@playwright/test";

const referenceHost = "http://localhost:4173";

export default defineConfig({
  testDir: ".",
  testMatch: "**/*.spec.ts",
  outputDir: "../test-results",
  reporter: process.env.CI
    ? [["github"], ["html", { outputFolder: "../playwright-report" }]]
    : "list",
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  use: { baseURL: referenceHost },
  // `vp preview` builds nothing, so the task depends on the reference host's build (and the renderer's, through it).
  webServer: {
    command: "vp run @fb/reference-host#preview",
    url: referenceHost,
    reuseExistingServer: !process.env.CI,
    cwd: "..",
    timeout: 120_000,
  },
  projects: [
    { name: "renderer-chromium", testDir: "./renderer", use: { ...devices["Desktop Chrome"] } },
    { name: "renderer-firefox", testDir: "./renderer", use: { ...devices["Desktop Firefox"] } },
    { name: "renderer-webkit", testDir: "./renderer", use: { ...devices["Desktop Safari"] } },
  ],
});
