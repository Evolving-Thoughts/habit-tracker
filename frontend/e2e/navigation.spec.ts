import { openView } from "./helpers";
import { test, expect } from "./fixtures";

test("views have their own address: Back returns and a reload stays", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/#\/heute$/);
  await expect(page).toHaveTitle("Heute · Habit Tracker");

  await openView(page, "Questlog");
  await expect(page).toHaveURL(/#\/questlog$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Questlog");
  await expect(page.locator("main")).toBeFocused();

  await openView(page, "Kampagnen");
  await expect(page).toHaveTitle("Kampagnen · Habit Tracker");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Kampagnen");

  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Questlog");
  await page.goBack();
  await expect(page).toHaveURL(/#\/heute$/);
});

test("an unknown address opens Heute", async ({ page }) => {
  await page.goto("/#/gibt-es-nicht");
  await expect(page).toHaveURL(/#\/heute$/);
  await expect(page.locator(".today-view")).toBeVisible();
});

test.describe("wide navigation", () => {
  test.skip(
    ({ isMobile }) => isMobile,
    "Die obere Leiste gibt es erst ab 56rem; das Handy behält die Tab-Leiste.",
  );

  test("from 56rem every view is a labelled tab, in groups, and Einstellungen is the gear at the end", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 896, height: 768 });
    await page.goto("/");
    const navigation = page.getByRole("navigation", { name: "Ansichten" });
    await expect(
      navigation.getByRole("button", { name: "Mehr", exact: true }),
    ).toBeHidden();
    await expect(navigation.locator(".tab-bar__inner > :visible")).toHaveText([
      "Heute",
      "Fokus",
      "Kalender",
      "Plan",
      "Questlog",
      "Kampagnen",
      "Dailies",
      "Wochenrückblick",
      "Befehle",
      "Einstellungen",
    ]);
    // Kategorien is a section of Einstellungen now, not a view of its own.
    await expect(
      navigation.getByRole("link", { name: "Kategorien" }),
    ).toHaveCount(0);

    const gear = navigation.getByRole("link", {
      name: "Einstellungen",
      exact: true,
    });
    await expect(gear).toHaveAttribute("title", "Einstellungen (,)");
    await gear.click();
    await expect(page).toHaveURL(/#\/einstellungen$/);
    await expect(gear).toHaveAttribute("aria-current", "page");
  });

  test("the bar never overflows; the tabs get their icons from 70rem", async ({
    page,
  }) => {
    await page.goto("/");
    const navigation = page.getByRole("navigation", { name: "Ansichten" });
    for (const width of [896, 1024, 1119, 1120, 1280, 1440]) {
      await page.setViewportSize({ width, height: 800 });
      await expect(
        navigation.getByRole("button", { name: "Mehr", exact: true }),
      ).toBeHidden();
      for (const name of ["Wochenrückblick", "Einstellungen"])
        await expect(
          navigation.getByRole("link", { name, exact: true }),
        ).toBeVisible();
      await expect(
        navigation.getByRole("button", { name: /Befehle/ }),
      ).toBeVisible();
      await expect(
        navigation.getByRole("link", { name: "Heute" }).locator("svg"),
      ).toBeVisible({ visible: width >= 1120 });
      const fit = await page.evaluate(() => {
        const inner = document.querySelector<HTMLElement>(".tab-bar__inner")!;
        const box = inner.getBoundingClientRect();
        const items = [...inner.querySelectorAll<HTMLElement>("a, button")]
          .map((item) => item.getBoundingClientRect())
          .filter((rect) => rect.width > 0 && rect.top < box.bottom);
        return {
          inner: inner.scrollWidth <= inner.clientWidth,
          items: items.every(
            (rect) =>
              rect.left >= box.left - 0.5 && rect.right <= box.right + 0.5,
          ),
          labels: [
            ...inner.querySelectorAll<HTMLElement>("a > span, button > span"),
          ]
            // Wider than 1px: the visually hidden name of an icon button is not a label.
            .filter((label) => label.getBoundingClientRect().width > 1)
            .every((label) => label.scrollWidth <= label.clientWidth),
          page: document.documentElement.scrollWidth <= window.innerWidth,
        };
      });
      expect(fit, `${width}px`).toEqual({
        inner: true,
        items: true,
        labels: true,
        page: true,
      });
    }
  });
});

test("the old address of Kategorien opens its section in Einstellungen, and Back leaves it", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/#\/heute$/);
  await page.goto("/#/kategorien");
  await expect(page).toHaveURL(/#\/einstellungen\?abschnitt=kategorien$/);
  const title = page.getByRole("heading", { name: "Kategorien", level: 2 });
  await expect(title).toBeFocused();
  await expect(title).toBeInViewport();
  // Not under the fixed bar at the top of wide screens.
  const titleTop = await title.evaluate(
    (element) => element.getBoundingClientRect().top,
  );
  const barBottom = await page
    .getByRole("navigation", { name: "Ansichten" })
    .evaluate((bar) => {
      const box = bar.getBoundingClientRect();
      return box.top < 1 ? box.bottom : 0;
    });
  expect(titleTop).toBeGreaterThanOrEqual(barBottom);
  await expect(page.getByLabel("Neue Kategorie")).toBeVisible();

  await page.goBack();
  await expect(page).toHaveURL(/#\/heute$/);
});

test("a view opens at its top, and Back returns to where the page was", async ({
  page,
}) => {
  await page.goto("/");
  await openView(page, "Einstellungen");
  await expect(page.getByRole("heading", { name: "Konto" })).toBeVisible();
  // The page is held at its top while it loads; scroll once that is over.
  await expect(page.locator("html[data-scroll-hold]")).toHaveCount(0);
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(
    100,
  );
  const scrolled = await page.evaluate(() => window.scrollY);

  await openView(page, "Kalender");
  await expect(page.locator(".calendar-view")).toBeVisible();
  await expect(
    page.getByRole("status", { name: "Kalender wird geladen" }),
  ).toHaveCount(0);
  // Still at the top once the view has loaded, the title in full view.
  await expect.poll(() => page.evaluate(() => window.scrollY)).toBe(0);

  await page.goBack();
  await expect(page).toHaveURL(/#\/einstellungen$/);
  await expect
    .poll(() => page.evaluate(() => window.scrollY))
    .toBeGreaterThan(scrolled - 10);
});

test("phone: four tabs and Mehr, no command button and no shortcut settings", async ({
  page,
  isMobile,
}) => {
  test.skip(!isMobile, "Gilt nur für die Tab-Leiste des Handys.");
  await page.goto("/");
  const navigation = page.getByRole("navigation", { name: "Ansichten" });
  await expect(
    navigation.getByRole("button", { name: "Mehr", exact: true }),
  ).toBeVisible();
  await expect(
    navigation.getByRole("button", { name: /Befehle/ }),
  ).toBeHidden();
  await openView(page, "Einstellungen");
  await expect(page.getByRole("heading", { name: "Konto" })).toBeVisible();
  await expect(page.getByRole("switch", { name: "Tastenkürzel" })).toHaveCount(
    0,
  );
});
