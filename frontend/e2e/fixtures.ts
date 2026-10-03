import { test as base, expect } from "@playwright/test";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";
import { API_URL } from "./environment";
import { clearMailbox, mailToken } from "./mailbox";
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
export const test = base.extend<{ isolatedDatabase: void; signedIn: boolean }>({
  signedIn: [true, { option: true }],
  isolatedDatabase: [
    async ({ request, context, signedIn }, use) => {
      await reset();
      try {
        await clearMailbox(request);
        if (signedIn) {
          const credentials = {
            email: "browser@example.test",
            password: "only-for-browser-tests",
          };
          expect(
            (
              await request.post(`${API_URL}/auth/register`, {
                data: credentials,
              })
            ).status(),
          ).toBe(202);
          const token = await mailToken(request, credentials.email, "verify");
          expect(
            (
              await request.post(`${API_URL}/auth/verify-email`, {
                data: { token },
              })
            ).status(),
          ).toBe(204);
          expect(
            (
              await request.post(`${API_URL}/auth/login`, { data: credentials })
            ).status(),
          ).toBe(200);
          await context.addCookies((await request.storageState()).cookies);
        }
        await use();
      } finally {
        await reset();
      }
    },
    { auto: true },
  ],
});
export { expect };
