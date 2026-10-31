import { defineConfig, mergeConfig } from "vitest/config";
import viteConfig from "./vite.config.ts";

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: "jsdom",
      setupFiles: ["src/test/setup.ts"],
      include: ["src/**/*.spec.ts"],
      // Tests must never reach a running dev backend.
      env: { VITE_API_BASE_URL: "http://127.0.0.1:9" },
    },
  }),
);
