import { test, expect } from "./fixtures";
// Real Service Worker/IndexedDB/API. Permission and the external provider
// subscription are simulated: headless CI never calls real FCM or sends a push.
async function mockBrowserSubscription(page: import("@playwright/test").Page) {
  await page.addInitScript(() => {
    Object.defineProperty(Notification, "permission", {
      configurable: true,
      get: () => "granted",
    });
    let active: PushSubscription | null = null;
    PushManager.prototype.getSubscription = async () => active;
    PushManager.prototype.subscribe = async () => {
      const curve = await crypto.subtle.generateKey(
        { name: "ECDH", namedCurve: "P-256" },
        true,
        ["deriveBits"],
      );
      const key = new Uint8Array(
        await crypto.subtle.exportKey("raw", curve.publicKey),
      );
      const auth = crypto.getRandomValues(new Uint8Array(16));
      const encoded = (bytes: Uint8Array) =>
        btoa(String.fromCharCode(...bytes))
          .replace(/\+/g, "-")
          .replace(/\//g, "_")
          .replace(/=+$/, "");
      const endpoint = `https://fcm.googleapis.com/wp/test-${crypto.randomUUID()}`;
      active = {
        options: {},
        toJSON: () => ({
          endpoint,
          keys: { p256dh: encoded(key), auth: encoded(auth) },
        }),
        unsubscribe: async () => {
          active = null;
          return true;
        },
      } as unknown as PushSubscription;
      return active;
    };
  });
}
test("push setting persists explicit opt-out and rebinds opted-in devices after login", async ({
  page,
  context,
}) => {
  await context.grantPermissions(["notifications"]);
  await mockBrowserSubscription(page);
  await page.goto("/");
  await page
    .getByRole("button", { name: "Benachrichtigungen", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  const toggle = dialog.getByRole("switch");
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await dialog.getByRole("button", { name: "Dialog schließen" }).click();
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
  await page
    .getByLabel("E-Mail-Adresse", { exact: true })
    .fill("browser@example.test");
  await page
    .getByLabel("Passwort", { exact: true })
    .fill("only-for-browser-tests");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await page
    .getByRole("button", { name: "Benachrichtigungen", exact: true })
    .click();
  await expect(toggle).toHaveAttribute("aria-checked", "true");
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await page.reload();
  await page
    .getByRole("button", { name: "Benachrichtigungen", exact: true })
    .click();
  await expect(toggle).toHaveAttribute("aria-checked", "false");
  await expect(
    dialog.getByText(/ohne Aufgaben- oder Habit-Titel/),
  ).toBeVisible();
});
test("blocked push permission has an actionable hint and never forces a prompt", async ({
  page,
}) => {
  await page.addInitScript(() =>
    Object.defineProperty(Notification, "permission", { get: () => "denied" }),
  );
  await page.goto("/");
  await page
    .getByRole("button", { name: "Benachrichtigungen", exact: true })
    .click();
  await expect(
    page.getByRole("dialog").getByText(/Website-Einstellungen/),
  ).toBeVisible();
  await expect(page.getByRole("switch")).toHaveCount(0);
});
