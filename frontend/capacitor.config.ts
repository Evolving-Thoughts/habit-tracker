import type { CapacitorConfig } from "@capacitor/cli";

/**
 * The APK is a window onto the app's server: same origin, so the session
 * cookie works as in a browser. By default it opens the live server over
 * HTTPS. CAP_SERVER_URL points it elsewhere, e.g. the dev server in the
 * WLAN (`http://192.168.178.22:5174`); only such an http address allows
 * cleartext traffic. See docs/android-test.md.
 */
const PRODUCTION_URL = "https://plan.evolving-thoughts.com";
const url = process.env.CAP_SERVER_URL || PRODUCTION_URL;
if (!/^https?:\/\//.test(url))
  throw new Error(`CAP_SERVER_URL must start with http:// or https://: ${url}`);

const config: CapacitorConfig = {
  appId: "local.habittracker.app",
  appName: "Habit Tracker",
  webDir: "dist",
  server: { url, cleartext: url.startsWith("http://") },
  android: { adjustMarginsForEdgeToEdge: "force" },
};

export default config;
