import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { browserEnvironment } =
  require("../../backend/test/browser-e2e/environment.cjs") as {
    browserEnvironment: (source?: NodeJS.ProcessEnv) => Record<string, string>;
  };
export const browserEnv = browserEnvironment();
export const API_URL = "http://127.0.0.1:4310";
