import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: ".",
  testMatch: "offline.spec.ts",
  outputDir: "../../../output/playwright/pwa",
  workers: 1,
  timeout: 60_000,
  use: {
    browserName: "chromium", viewport: { width: 390, height: 844 },
    launchOptions: { executablePath: process.env.PWA_CHROMIUM_EXECUTABLE },
    screenshot: "only-on-failure",
  },
});
