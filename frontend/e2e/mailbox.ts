import type { APIRequestContext } from "@playwright/test";
import { expect } from "@playwright/test";
export const MAILBOX_URL = "http://127.0.0.1:18025";
export async function clearMailbox(request: APIRequestContext): Promise<void> {
  const result = await request.delete(`${MAILBOX_URL}/api/v1/messages`, {
    headers: { Origin: MAILBOX_URL },
  });
  expect(result.ok()).toBeTruthy();
}
export async function mailToken(
  request: APIRequestContext,
  email: string,
  kind: "verify" | "reset",
): Promise<string> {
  let token = "";
  await expect
    .poll(
      async () => {
        const response = await request.get(`${MAILBOX_URL}/api/v1/messages`, {
          headers: { Origin: MAILBOX_URL },
        });
        expect(response.ok()).toBeTruthy();
        const list = (await response.json()) as {
          messages: {
            ID: string;
            To: { Address: string }[];
            Subject: string;
          }[];
        };
        const match = list.messages.find(
          (m) =>
            m.To.some((to) => to.Address === email) &&
            m.Subject ===
              (kind === "verify"
                ? "E-Mail-Adresse bestätigen"
                : "Passwort zurücksetzen"),
        );
        if (!match) return false;
        const detail = await request.get(
          `${MAILBOX_URL}/api/v1/message/${match.ID}`,
          { headers: { Origin: MAILBOX_URL } },
        );
        const body = (await detail.json()) as { Text: string };
        token =
          body.Text.match(new RegExp(`#${kind}=([A-Za-z0-9_-]{43})`))?.[1] ??
          "";
        return !!token;
      },
      {
        timeout: 10_000,
        message: "Expected authentication email in isolated Mailpit",
      },
    )
    .toBe(true);
  return token;
}
