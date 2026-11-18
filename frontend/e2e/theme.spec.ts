import type { Page } from "@playwright/test";
import { openView } from "./helpers";
import { test, expect } from "./fixtures";

/* The ground of each theme, as getComputedStyle writes it. */
const LIGHT_GROUND = "rgb(253, 228, 208)";
const DARK_GROUND = "rgb(30, 22, 17)";

const groundColor = (page: Page) =>
  page.evaluate(
    () => getComputedStyle(document.documentElement).backgroundColor,
  );

// page.route cannot hold back what the service worker fetches.
test.use({ serviceWorkers: "block" });

async function openSettings(page: Page) {
  await page.goto("/");
  await openView(page, "Einstellungen");
  const group = page.getByRole("radiogroup", { name: "Darstellung" });
  await expect(group).toBeVisible();
  return group;
}

test("Darstellung: Dunkel turns the app dark and survives a reload without a light first paint", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "light" });
  const group = await openSettings(page);
  await expect(
    group.getByRole("radio", { name: "Wie das Gerät" }),
  ).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  expect(await groundColor(page)).toBe(LIGHT_GROUND);

  await group.getByText("Dunkel", { exact: true }).click();
  await expect(group.getByRole("radio", { name: "Dunkel" })).toBeChecked();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    DARK_GROUND,
  );
  await expect(page.locator(".settings-view .card").first()).not.toHaveCSS(
    "background-color",
    "rgb(255, 255, 255)",
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#1e1611",
  );

  // Hold the app's script back: the theme must already be there without it.
  let release: () => void = () => undefined;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route(
    "**/assets/index-*.js",
    async (route) => {
      await held;
      await route.continue();
    },
    { times: 1 },
  );
  await page.reload({ waitUntil: "commit" });
  await expect
    .poll(() =>
      page.evaluate(() => ({
        theme: document.documentElement.dataset.theme,
        mounted: (document.getElementById("app")?.childElementCount ?? 0) > 0,
        ground: getComputedStyle(document.documentElement).backgroundColor,
      })),
    )
    .toEqual({ theme: "dark", mounted: false, ground: DARK_GROUND });
  release();

  await expect(
    page.getByRole("radiogroup", { name: "Darstellung" }).getByRole("radio", {
      name: "Dunkel",
    }),
  ).toBeChecked();
  expect(await groundColor(page)).toBe(DARK_GROUND);
});

test("Darstellung: Wie das Gerät follows the device live, Hell stays light", async ({
  page,
}) => {
  await page.emulateMedia({ colorScheme: "dark" });
  const group = await openSettings(page);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.getByText("Gerade dunkel, wie dein Gerät.")).toBeVisible();

  await page.emulateMedia({ colorScheme: "light" });
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveCSS(
    "background-color",
    LIGHT_GROUND,
  );
  await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute(
    "content",
    "#fde4d0",
  );

  await page.emulateMedia({ colorScheme: "dark" });
  await expect(page.locator("html")).toHaveCSS("background-color", DARK_GROUND);

  await group.getByText("Hell", { exact: true }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(
    page.getByRole("radiogroup", { name: "Darstellung" }).getByRole("radio", {
      name: "Hell",
    }),
  ).toBeChecked();
});

test("Darstellung from the command menu", async ({ page, isMobile }) => {
  test.skip(isMobile, "Das Befehlsmenü öffnet am Handy niemand mit Strg K.");
  await page.emulateMedia({ colorScheme: "light" });
  await page.goto("/");
  await expect(page.locator(".today-view")).toBeVisible();
  await page.keyboard.press("Control+k");
  const menu = page.getByRole("dialog", { name: "Befehle" });
  await menu.getByRole("combobox").fill("dunkel");
  await menu.getByRole("option", { name: "Darstellung: Dunkel" }).click();
  await expect(menu).toHaveCount(0);
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveCSS("background-color", DARK_GROUND);
});
