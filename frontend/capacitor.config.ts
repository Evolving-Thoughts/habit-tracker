import type { CapacitorConfig } from "@capacitor/cli";

const url = process.env.CAP_SERVER_URL;
if (!url) throw new Error("Set CAP_SERVER_URL, see docs/android-test.md");

// The test APK is only a window onto the dev server: same origin, so the
// session cookie works as in a browser.
const config: CapacitorConfig = {
  appId: "local.habittracker.app",
  appName: "Habit Tracker",
  webDir: "dist",
  server: { url, cleartext: true },
  android: { adjustMarginsForEdgeToEdge: "force" },
};

export default config;
