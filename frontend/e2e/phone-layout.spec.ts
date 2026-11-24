import type { APIRequestContext, Page } from "@playwright/test";
import { expect, test } from "./fixtures";
import { API_URL } from "./environment";
import { daysAfter, today } from "./helpers";

/*
 * Every view at 360 px, the narrowest phone in use: nothing runs out of the
 * window sideways, and the tab bar stays at the bottom in view. The Plan
 * shows one column per screen and opens on Heute; its chips jump.
 */
test.use({ viewport: { width: 360, height: 740 } });
test.beforeEach(({ isMobile }) => {
  test.skip(!isMobile, "The phone's layout, checked on the phone project.");
});

async function post(
  request: APIRequestContext,
  path: string,
  data: object,
): Promise<number> {
  const response = await request.post(`${API_URL}${path}`, { data });
  expect(response.status(), path).toBe(201);
  return ((await response.json()) as { id: number }).id;
}

/** A day with what makes rows long: a campaign with a long name, a Daily, an overdue quest. */
async function fillDays(request: APIRequestContext): Promise<string> {
  const date = await today(request);
  const campaign = await post(request, "/todos", {
    title: "Halbmarathon im März mit Freunden laufen",
    color: "teal",
    why: "Damit der Frühling mit einem Ziel beginnt.",
  });
  await post(request, "/todos", {
    title: "Intervalle 6×800 m auf der Bahn",
    parentId: campaign,
    scheduledDate: date,
    plannedDurationMinutes: 50,
    why: "Tempo für die zweite Hälfte.",
  });
  await post(request, "/todos", {
    title: "Langer Lauf",
    parentId: campaign,
    scheduledDate: daysAfter(date, -2),
    plannedDurationMinutes: 90,
  });
  await post(request, "/todos", {
    title: "Steuererklärung sortieren",
    plannedDurationMinutes: 30,
  });
  await post(request, "/habits", {
    title: "Dehnen",
    why: "Damit der Rücken mitmacht",
    schedule: { type: "interval", intervalDays: 1 },
  });
  return date;
}

async function expectFits(page: Page, where: string): Promise<void> {
  const sizes = await page.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    window: window.innerWidth,
  }));
  expect(sizes.scroll, `${where}: page wider than the window`).toBeLessThanOrEqual(
    sizes.window,
  );
  const tabBar = page.locator(".tab-bar");
  await expect(tabBar, `${where}: tab bar`).toBeInViewport({ ratio: 1 });
  const box = (await tabBar.boundingBox())!;
  expect(Math.round(box.y + box.height)).toBe(page.viewportSize()!.height);
}

/** Waits until a view has drawn its content (no loading status left). */
async function settled(page: Page): Promise<void> {
  await expect(page.locator("main")).toBeVisible();
  await expect(page.locator('main [role="status"][aria-label$="geladen"]')).toHaveCount(0);
}

test("phone at 360 px: no view runs out of the window sideways, the tab bar stays in view", async ({
  page,
  request,
}) => {
  await fillDays(request);
  const views = [
    "/#/heute",
    "/#/kalender",
    "/#/plan",
    "/#/questlog",
    "/#/kampagnen",
    "/#/dailies",
    "/#/rueckblick",
    "/#/das-beste",
    "/#/einstellungen",
  ];
  for (const view of views) {
    await page.goto(view);
    await settled(page);
    await expectFits(page, view);
  }

  // The Kalender's week once widened the page to 789 px; the day sits below it.
  await page.goto("/#/kalender");
  const calendar = page.locator(".calendar-view");
  for (const mode of ["Woche", "Tag", "Monat"]) {
    await calendar.getByRole("button", { name: mode, exact: true }).click();
    await expect(
      calendar.getByRole("button", { name: mode, exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await settled(page);
    await expectFits(page, `Kalender ${mode}`);
  }

  // The Dailies' fourteen days scroll in themselves and start at today.
  await page.goto("/#/dailies");
  const strip = page.getByRole("list", { name: "Verlauf der letzten 14 Tage" });
  await expect(strip.first()).toBeVisible();
  await expect
    .poll(() =>
      strip.first().evaluate((list) => ({
        atEnd: list.scrollLeft + list.clientWidth >= list.scrollWidth - 2,
        tabStop: list.scrollWidth > list.clientWidth ? list.tabIndex : 0,
      })),
    )
    .toEqual({ atEnd: true, tabStop: 0 });
  await expectFits(page, "Dailies with history");
});

test("phone at 360 px: the Plan opens on Heute, one column per screen, and its chips jump", async ({
  page,
  request,
}) => {
  const date = await fillDays(request);
  await page.goto("/#/plan");
  await expect(page.getByRole("status", { name: "Plan wird geladen" })).toHaveCount(0);
  const board = page.locator(".plan-view__board");
  const todayColumn = page.locator(`section.plan-day[data-date="${date}"]`);
  await expect(todayColumn).toBeInViewport({ ratio: 1 });

  // Every column as wide as the board, snapping into place.
  const layout = await board.evaluate((element) => {
    const columns = [...element.children] as HTMLElement[];
    return {
      snap: getComputedStyle(element).scrollSnapType,
      widths: columns.map((column) => column.offsetWidth - element.clientWidth),
      scrollLeft: element.scrollLeft,
    };
  });
  expect(layout.snap).toBe("x mandatory");
  expect(new Set(layout.widths)).toEqual(new Set([0]));
  expect(layout.scrollLeft).toBeGreaterThan(0);

  // The chips name the columns; the one in view is marked in words, not only in colour.
  const chips = page.getByRole("navigation", { name: "Spalten des Plans" });
  const chipLabels = await chips.getByRole("button").allInnerTexts();
  expect(chipLabels.slice(0, 3)).toEqual(["Questlog", "Liegen geblieben", "Heute"]);
  const todayChip = chips.getByRole("button", { name: /^Heute, / });
  await expect(todayChip).toHaveAttribute("aria-current", "true");

  // A tap on Questlog brings the Questlog, an ordinary first column.
  await chips.getByRole("button", { name: "Questlog", exact: true }).click();
  const questlog = page.locator("aside.plan-questlog");
  await expect(questlog).toBeInViewport({ ratio: 1 });
  await expect(questlog).toContainText("Steuererklärung sortieren");
  await expect(chips.getByRole("button", { name: "Questlog", exact: true })).toHaveAttribute(
    "aria-current",
    "true",
  );
  await expect(todayChip).not.toHaveAttribute("aria-current", "true");
  expect(await questlog.evaluate((element) => getComputedStyle(element).position)).toBe(
    "static",
  );
  await expect(
    questlog.getByRole("button", { name: "Questlog ausblenden" }),
  ).toBeHidden();

  // A swipe to the next column moves the mark along.
  await board.evaluate((element) => {
    const gap = parseFloat(getComputedStyle(element).columnGap) || 0;
    element.scrollTo({ left: element.clientWidth + gap });
  });
  await expect(
    chips.getByRole("button", { name: "Liegen geblieben", exact: true }),
  ).toHaveAttribute("aria-current", "true");

  // The quick add of a day writes in 16 px, so a phone does not zoom in.
  const field = todayColumn.getByRole("textbox");
  expect(await field.evaluate((input) => getComputedStyle(input).fontSize)).toBe("16px");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
});
