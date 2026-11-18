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

  test("between 56rem and 70rem the rarer views sit behind a labelled Mehr menu", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1024, height: 768 });
    await page.goto("/");
    const navigation = page.getByRole("navigation", { name: "Ansichten" });
    const more = navigation.getByRole("button", { name: "Mehr", exact: true });
    const review = navigation.getByRole("link", { name: "Wochenrückblick" });
    await expect(navigation.getByRole("link", { name: "Plan" })).toBeVisible();
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(review).toBeHidden();

    // Keyboard: Enter opens, Tab walks the links, Escape closes and returns.
    await more.focus();
    await page.keyboard.press("Enter");
    await expect(more).toHaveAttribute("aria-expanded", "true");
    for (const name of [
      "Wochenrückblick",
      "Fokus",
      "Dailies",
      "Kategorien",
      "Einstellungen",
    ])
      await expect(
        navigation.getByRole("link", { name, exact: true }),
      ).toBeVisible();
    await page.keyboard.press("Tab");
    await expect(review).toBeFocused();
    await page.keyboard.press("Escape");
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(more).toBeFocused();

    // A click outside closes it.
    await more.click();
    await page.locator("main").click({ position: { x: 5, y: 5 } });
    await expect(more).toHaveAttribute("aria-expanded", "false");

    // Picking a view closes it, and Mehr is then the current tab.
    await more.click();
    await navigation
      .getByRole("link", { name: "Dailies", exact: true })
      .click();
    await expect(page).toHaveURL(/#\/dailies$/);
    await expect(more).toHaveAttribute("aria-expanded", "false");
    await expect(more).toHaveAttribute("data-active-medium");
    await openView(page, "Plan");
    await expect(more).not.toHaveAttribute("data-active-medium");
  });

  test("from 70rem Wochenrückblick, Fokus and Dailies are tabs; Mehr keeps the settings views", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 1148, height: 800 });
    await page.goto("/");
    const navigation = page.getByRole("navigation", { name: "Ansichten" });
    const more = navigation.getByRole("button", { name: "Mehr", exact: true });
    for (const name of ["Wochenrückblick", "Fokus", "Dailies"])
      await expect(
        navigation.getByRole("link", { name, exact: true }),
      ).toBeVisible();
    await expect(
      navigation.getByRole("link", { name: "Kategorien", exact: true }),
    ).toBeHidden();

    await more.click();
    await expect(navigation.locator("#more-views a:visible")).toHaveText([
      "Kategorien",
      "Einstellungen",
    ]);

    // A view with its own tab no longer makes Mehr current; one inside it does.
    await navigation.getByRole("link", { name: "Einstellungen" }).click();
    await expect(more).toHaveAttribute("data-active");
    await navigation
      .getByRole("link", { name: "Dailies", exact: true })
      .click();
    await expect(page).toHaveURL(/#\/dailies$/);
    await expect(more).toHaveCSS(
      "color",
      await navigation
        .getByRole("link", { name: "Questlog", exact: true })
        .evaluate((link) => getComputedStyle(link).color),
    );
  });

  test("the bar never overflows, and from 82rem every view has its labelled tab", async ({
    page,
  }) => {
    await page.goto("/");
    const navigation = page.getByRole("navigation", { name: "Ansichten" });
    for (const width of [
      896, 1024, 1119, 1120, 1148, 1152, 1280, 1311, 1312, 1440,
    ]) {
      await page.setViewportSize({ width, height: 800 });
      const wide = width >= 1312;
      await expect(
        navigation.getByRole("button", { name: "Mehr", exact: true }),
      ).toBeVisible({ visible: !wide });
      await expect(
        navigation.getByRole("link", { name: "Einstellungen" }),
      ).toBeVisible({ visible: wide });
      await expect(
        navigation.getByRole("link", { name: "Wochenrückblick" }),
      ).toBeVisible({ visible: width >= 1120 });
      await expect(
        navigation.getByRole("button", { name: /Befehle/ }),
      ).toBeVisible();
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
