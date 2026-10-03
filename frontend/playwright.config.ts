import { defineConfig, devices } from "@playwright/test";
import { fileURLToPath } from "node:url";
import { browserEnv } from "./e2e/environment";
const frontendDir = fileURLToPath(new URL(".", import.meta.url));
const backendDir = fileURLToPath(new URL("../backend", import.meta.url));
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  workers: 1,
  forbidOnly: !!process.env.CI,
  failOnFlakyTests: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  timeout: 30_000,
  expect: { timeout: 8_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: "http://127.0.0.1:4173",
    locale: "de-DE",
    extraHTTPHeaders: { Origin: "http://127.0.0.1:4173" },
    timezoneId: "Europe/Berlin",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "mobile-chromium", use: { ...devices["Pixel 7"] } },
  ],
  webServer: [
    {
      command: "node test/browser-e2e/server.cjs",
      cwd: backendDir,
      env: browserEnv,
      url: "http://127.0.0.1:4310",
      reuseExistingServer: false,
      timeout: 60_000,
    },
    {
      command: "npm run build && npm run serve:tunnel",
      cwd: frontendDir,
      env: {
        VITE_API_BASE_URL: "/api",
        TUNNEL_PORT: "4173",
        TUNNEL_API_PORT: "4310",
        TUNNEL_ORIGIN: "",
      },
      url: "http://127.0.0.1:4173",
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
