import { test, expect } from "./fixtures";
import { API_URL } from "./environment";
import { mailToken } from "./mailbox";
test.use({ signedIn: false });
const EMAIL = "person@example.test";
const PASSWORD = "a-long-browser-test-password";
async function registerThroughUI(
  page: import("@playwright/test").Page,
): Promise<void> {
  await page.goto("/");
  await page
    .getByRole("button", { name: "Konto erstellen", exact: true })
    .click();
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(EMAIL);
  await page.getByLabel("Passwort", { exact: true }).fill(PASSWORD);
  await page.getByLabel("Passwort wiederholen").fill(PASSWORD);
  await page.getByRole("button", { name: "Registrieren", exact: true }).click();
  await expect(page.getByRole("status")).toContainText("Bestätigungslink");
}
test("register, verify through SMTP email, login, reload, logout", async ({
  page,
  request,
}) => {
  await registerThroughUI(page);
  const token = await mailToken(request, EMAIL, "verify");
  await page.goto(`/#verify=${token}`);
  await expect(
    page.getByRole("heading", { name: "E-Mail bestätigen" }),
  ).toBeVisible();
  expect(new URL(page.url()).hash).toBe("");
  await page
    .getByRole("button", { name: "E-Mail bestätigen", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("E-Mail bestätigt");
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(EMAIL);
  await page.getByLabel("Passwort", { exact: true }).fill(PASSWORD);
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("navigation")).toBeVisible();
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Willkommen zurück" }),
  ).toBeVisible();
  await expect(page.getByRole("navigation")).toHaveCount(0);
});
test("password reset by email invalidates an existing device session", async ({
  page,
  request,
}) => {
  await registerThroughUI(page);
  const verify = await mailToken(request, EMAIL, "verify");
  expect(
    (
      await request.post(`${API_URL}/auth/verify-email`, {
        data: { token: verify },
      })
    ).status(),
  ).toBe(204);
  expect(
    (
      await request.post(`${API_URL}/auth/login`, {
        data: { email: EMAIL, password: PASSWORD },
      })
    ).status(),
  ).toBe(200);
  await page
    .getByRole("button", { name: "Zur Anmeldung", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Passwort vergessen?", exact: true })
    .click();
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(EMAIL);
  await page
    .getByRole("button", { name: "Reset-Link senden", exact: true })
    .click();
  await expect(page.getByRole("status")).toBeVisible();
  const token = await mailToken(request, EMAIL, "reset");
  await page.goto(`/#reset=${token}`);
  await page
    .getByLabel("Neues Passwort", { exact: true })
    .fill("brand-new-password-for-tests");
  await page
    .getByLabel("Passwort wiederholen")
    .fill("brand-new-password-for-tests");
  await page
    .getByRole("button", { name: "Passwort speichern", exact: true })
    .click();
  await expect(page.getByRole("status")).toContainText("Passwort geändert");
  expect((await request.get(`${API_URL}/auth/me`)).status()).toBe(401);
  await page.getByLabel("E-Mail-Adresse", { exact: true }).fill(EMAIL);
  await page
    .getByLabel("Passwort", { exact: true })
    .fill("brand-new-password-for-tests");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  await expect(page.getByRole("navigation")).toBeVisible();
});
