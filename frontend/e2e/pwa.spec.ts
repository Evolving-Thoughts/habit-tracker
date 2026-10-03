import { test, expect } from "./fixtures";

test("built PWA has a valid standalone manifest and installable icons", async ({
  page,
}) => {
  await page.goto("/");
  const response = await page.request.get("/manifest.webmanifest");
  expect(response.headers()["content-type"]).toContain(
    "application/manifest+json",
  );
  const manifest = (await response.json()) as {
    id: string;
    start_url: string;
    scope: string;
    display: string;
    icons: { src: string; purpose: string }[];
  };
  expect(manifest).toMatchObject({
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
  });
  for (const icon of manifest.icons) {
    expect(icon.purpose).toContain("maskable");
    expect((await page.request.get(icon.src)).ok()).toBe(true);
  }
  await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
    "href",
    "/manifest.webmanifest",
  );
  const session = await page.context().newCDPSession(page);
  const result = await session.send("Page.getAppManifest");
  expect(result.errors).toEqual([]);
  const install = await session.send("Page.getInstallabilityErrors");
  expect(install.installabilityErrors).toEqual([]);
  await session.detach();
});

test("service worker controls the built app without caching authenticated API data", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "Abmelden", exact: true }),
  ).toBeVisible();
  await page.waitForFunction(() => navigator.serviceWorker.controller !== null);
  const response = await page.request.get("/api/auth/me");
  expect(response.status()).toBe(200);
  expect(response.headers()["cache-control"]).toBe("no-store");
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
  await context.setOffline(true);
  const status = await page.evaluate(async () => {
    try {
      await fetch("/api/auth/me");
      return "unexpected-response";
    } catch {
      return "network-unavailable";
    }
  });
  expect(status).toBe("network-unavailable");
  await context.setOffline(false);
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Anmelden", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(async () => (await fetch("/api/auth/me")).status),
  ).toBe(401);
  expect(await page.evaluate(() => caches.keys())).toEqual([]);
});

test("same-origin API never exposes local services or accepts a forged write origin", async ({
  page,
}) => {
  await page.goto("/");
  for (const path of ["/.env", "/src/main.ts", "/mailpit", "/apiX"])
    expect((await page.request.get(path)).status()).toBe(404);
  const rejected = await page.request.post("/api/todos", {
    headers: { Origin: "https://evil.example" },
    data: { title: "Must not be created" },
  });
  expect(rejected.status()).toBe(403);
});
