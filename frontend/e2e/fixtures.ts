import { test as base, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { browserEnv } from "./environment";
const run = promisify(execFile);
const script = fileURLToPath(
  new URL("../../backend/test/browser-e2e/reset.cjs", import.meta.url),
);
const reset = () =>
  run(process.execPath, [script], {
    env: { ...process.env, ...browserEnv },
    timeout: 10_000,
  });
// One shared DB -> one worker. Each test/retry/project gets a clean database and browser context.
export const test = base.extend<{ isolatedDatabase: void }>({
  isolatedDatabase: [
    async ({}, use) => {
      await reset();
      try {
        await use();
      } finally {
        await reset();
      }
    },
    { auto: true },
  ],
});
export { expect };
