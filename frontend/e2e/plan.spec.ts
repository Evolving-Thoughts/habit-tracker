import type { APIRequestContext, Page } from "@playwright/test";
import { API_URL } from "./environment";
import { test, expect } from "./fixtures";
import {
  cardMenu,
  dayLabel,
  daysAfter,
  dragCard,
  openView,
  shortDate,
  today,
} from "./helpers";

/** Monday of the week containing `date`. */
function mondayOf(date: string): string {
  const weekday = new Date(`${date}T12:00:00Z`).getUTCDay();
  return daysAfter(date, -((weekday + 6) % 7));
}

const plan = async (request: APIRequestContext, data: object) => {
  const response = await request.post(`${API_URL}/todos`, { data });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number };
};
/** Titles of a day as the server orders it. */
const storedDay = async (request: APIRequestContext, date: string) => {
  const response = await request.get(
    `${API_URL}/day-planner/plan?from=${date}&days=1`,
  );
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    days: { date: string; entries: { title: string }[] }[];
  };
  return body.days[0]!.entries.map(({ title }) => title);
};
/** Titles of the Questlog in its stored order. */
const storedQuestlog = async (request: APIRequestContext) => {
  const response = await request.get(`${API_URL}/todos/backlog`);
  expect(response.ok()).toBeTruthy();
  return ((await response.json()) as { title: string }[]).map(
    ({ title }) => title,
  );
};
const column = (page: Page, date: string) =>
  page.locator(`section.plan-day[data-date="${date}"]`);
const dayColumns = (page: Page) => page.locator("section.plan-day");
/** Open titles of a day as shown. */
const shownDay = (page: Page, date: string) =>
  column(page, date).locator(".plan-day__list").first().locator("h3").allInnerTexts();
/** A quest's card on the board: it drags from anywhere but its controls. */
const card = (page: Page, title: string) =>
  page
    .locator("section.plan-day li[data-todo-id]")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
const menuButton = (page: Page, title: string) =>
  page.getByRole("button", { name: `Aktionen für ${title}`, exact: true });
/** A quest of the Questlog column, by title. */
const questlogRow = (page: Page, title: string) =>
  page
    .locator("aside.plan-questlog li[data-todo-id]")
    .filter({ hasText: title });
/** Waits until the board has loaded. */
const loaded = async (page: Page) => {
  await expect(page.getByRole("status", { name: "Plan wird geladen" })).toHaveCount(0);
  await expect(dayColumns(page).first()).toBeVisible();
};
/** How far the page itself scrolls sideways; the board never makes it. */
const pageOverflow = (page: Page) =>
  page.evaluate(
    () =>
      document.documentElement.scrollWidth -
      document.documentElement.clientWidth,
  );
/**
 * The Questlog stays reachable: beside the days on a wide board, behind
 * its chip on a phone, where every column is a screen of its own.
 */
const questlogReachable = async (page: Page, isMobile: boolean) => {
  if (isMobile)
    await expect(
      page
        .getByRole("navigation", { name: "Spalten des Plans" })
        .getByRole("button", { name: "Questlog", exact: true }),
    ).toBeVisible();
  else await expect(page.locator("aside.plan-questlog")).toBeInViewport();
};

test("Plan: opens on today, steps through the days by as many as fit and keeps the first day on reload", async ({
  page,
  request,
  isMobile,
}) => {
  const date = await today(request);
  await page.goto("/");
  await openView(page, "Plan");
  await expect(page).toHaveURL(/#\/plan$/);
  await expect(page).toHaveTitle("Plan · Habit Tracker");
  await loaded(page);
  // The Questlog at the far left, then today first; no past day.
  await expect(dayColumns(page).first()).toHaveAttribute("data-date", date);
  await expect(column(page, date)).toHaveAttribute("aria-current", "date");
  await expect(column(page, date)).toBeInViewport({ ratio: 1 });
  await questlogReachable(page, isMobile);
  // At today the way back would change nothing, and there is no going back.
  await expect(page.getByRole("button", { name: "Heute", exact: true })).toHaveCount(0);
  await expect(page.getByRole("button", { name: "Vorige Tage", exact: true })).toBeDisabled();
  expect(await pageOverflow(page)).toBe(0);

  const shown = await dayColumns(page).count();
  const next = daysAfter(date, shown);
  await page.getByRole("button", { name: "Nächste Tage", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#/plan\\?ab=${next}$`));
  await loaded(page);
  await expect(dayColumns(page).first()).toHaveAttribute("data-date", next);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    shortDate(daysAfter(next, shown - 1)),
  );

  // The quick add sits on top of the column, above its cards.
  const field = page.getByRole("textbox", {
    name: `Quest für ${dayLabel(next)} hinzufügen`,
  });
  await field.fill("Geschenk besorgen");
  await field.press("Enter");
  await expect(field).toHaveValue("");
  await expect.poll(() => shownDay(page, next)).toEqual(["Geschenk besorgen"]);
  await field.fill("Karte schreiben");
  await field.press("Enter");
  await expect
    .poll(() => storedDay(request, next))
    .toEqual(["Geschenk besorgen", "Karte schreiben"]);
  // ↑ in the head puts the next one on top of the day.
  await page.getByRole("button", { name: "Oben einfügen", exact: true }).click();
  await field.fill("Zuerst anrufen");
  await field.press("Enter");
  await expect
    .poll(() => storedDay(request, next))
    .toEqual(["Zuerst anrufen", "Geschenk besorgen", "Karte schreiben"]);

  await page.reload();
  await loaded(page);
  expect(await shownDay(page, next)).toEqual([
    "Zuerst anrufen",
    "Geschenk besorgen",
    "Karte schreiben",
  ]);
  // The choice of ↑ holds on this device.
  await expect(
    page.getByRole("button", { name: "Oben einfügen", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");

  // Today has the plain address; Back returns to the days before.
  await page.getByRole("button", { name: "Vorige Tage", exact: true }).click();
  await expect(page).toHaveURL(/#\/plan$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`ab=${next}$`));
  await loaded(page);
  await page.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(page).toHaveURL(/#\/plan$/);
  await loaded(page);
  await expect(column(page, date)).toHaveAttribute("aria-current", "date");
  // The button left with the step; the heading names the days and has the focus.
  await expect(page.getByRole("button", { name: "Heute", exact: true })).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});

test("Plan: an old link to a week opens that week's first day still ahead", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const nextMonday = daysAfter(mondayOf(date), 7);
  await page.goto(`/#/plan?woche=${nextMonday}`);
  await expect(page).toHaveURL(new RegExp(`#/plan\\?ab=${nextMonday}$`));
  await loaded(page);
  await expect(dayColumns(page).first()).toHaveAttribute("data-date", nextMonday);
  await page.goto(`/#/plan?woche=${mondayOf(date)}`);
  await expect(page).toHaveURL(/#\/plan$/);
});

test("Plan: sort a day with Nach oben and Nach unten in a card's menu", async ({
  page,
  request,
}) => {
  const date = await today(request);
  for (const title of ["Erstes", "Zweites", "Drittes"])
    await plan(request, { title, scheduledDate: date });
  await page.goto("/#/plan");
  await loaded(page);
  expect(await shownDay(page, date)).toEqual(["Erstes", "Zweites", "Drittes"]);

  // No grip on the cards: they drag as a whole, the menu moves them by key.
  await expect(column(page, date).locator(".sort-handle")).toHaveCount(0);
  await cardMenu(page, "Drittes", "Drittes nach oben");
  await expect(page.getByRole("status").filter({ hasText: "Drittes" })).toHaveText(
    "„Drittes“ steht jetzt an Stelle 2 von 3.",
  );
  await expect(menuButton(page, "Drittes")).toBeFocused();
  await expect
    .poll(() => storedDay(request, date))
    .toEqual(["Erstes", "Drittes", "Zweites"]);

  await cardMenu(page, "Erstes", "Erstes nach unten");
  await expect
    .poll(() => storedDay(request, date))
    .toEqual(["Drittes", "Erstes", "Zweites"]);
  await expect(menuButton(page, "Erstes")).toBeFocused();

  await page.reload();
  await loaded(page);
  expect(await shownDay(page, date)).toEqual(["Drittes", "Erstes", "Zweites"]);
});

test("Plan: sort a day and move a quest to the next day with the arrow keys on its card", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "Moving to the next day needs two days side by side; a phone shows one, and its sorting by key is covered above.",
  );
  const date = await today(request);
  const tomorrow = daysAfter(date, 1);
  for (const title of ["Erstes", "Zweites", "Drittes"])
    await plan(request, { title, scheduledDate: date });
  await plan(request, { title: "Morgen schon", scheduledDate: tomorrow });
  await page.goto("/#/plan");
  await loaded(page);

  const drittes = page.getByRole("button", {
    name: "Drittes bearbeiten",
    exact: true,
  });
  await drittes.focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("status").filter({ hasText: "Drittes" })).toHaveText(
    "„Drittes“ steht jetzt an Stelle 2 von 3.",
  );
  await expect(drittes).toBeFocused();
  await expect
    .poll(() => storedDay(request, date))
    .toEqual(["Erstes", "Drittes", "Zweites"]);

  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => storedDay(request, tomorrow))
    .toEqual(["Morgen schon", "Drittes"]);
  await expect(drittes).toBeFocused();
  expect(await shownDay(page, date)).toEqual(["Erstes", "Zweites"]);
});

test("Plan: move a quest to today without dragging, and Heute shows it", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const tomorrow = daysAfter(date, 1);
  await plan(request, { title: "Steuer abgeben", scheduledDate: tomorrow });
  await page.goto(`/#/plan?ab=${tomorrow}`);
  await loaded(page);
  await expect(column(page, tomorrow)).toContainText("Steuer abgeben");

  await cardMenu(page, "Steuer abgeben", "Steuer abgeben verschieben");
  const dialog = page.getByRole("dialog", { name: "Verschieben" });
  await dialog.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(column(page, tomorrow)).not.toContainText("Steuer abgeben");

  await page.goto("/#/plan");
  await loaded(page);
  expect(await shownDay(page, date)).toEqual(["Steuer abgeben"]);
  await openView(page, "Heute");
  await expect(page.locator("#focus-title")).toHaveText("Steuer abgeben");
});

test("Plan: what was left behind has its own column before today and moves onto a day", async ({
  page,
  request,
  isMobile,
}) => {
  const date = await today(request);
  const earlier = daysAfter(date, -2);
  await plan(request, { title: "Liegt noch", scheduledDate: earlier });
  await plan(request, { title: "Für heute", scheduledDate: date });
  await page.goto("/#/plan");
  await loaded(page);

  const overdue = page.locator("section.plan-overdue");
  await expect(overdue.getByRole("heading", { level: 2 })).toContainText(
    "Liegen geblieben",
  );
  await expect(overdue).toContainText("Liegt noch");
  await expect(overdue).toContainText(`seit ${shortDate(earlier)}`);
  // Not on today: it waits apart, as under Nachholen on Heute.
  expect(await shownDay(page, date)).toEqual(["Für heute"]);
  // Questlog and today stay in view, even where the board has to scroll.
  await expect(column(page, date)).toBeInViewport({ ratio: 1 });
  await questlogReachable(page, isMobile);
  expect(await pageOverflow(page)).toBe(0);

  await cardMenu(page, "Liegt noch", "Liegt noch auf heute");
  await expect(overdue).toHaveCount(0);
  await expect
    .poll(() => storedDay(request, date))
    .toEqual(["Für heute", "Liegt noch"]);
});

test("Plan: a quest opens its editor; a forecast daily opens its daily", async ({
  page,
  request,
}) => {
  const nextMonday = daysAfter(mondayOf(await today(request)), 7);
  await plan(request, {
    title: "Zahnarzt",
    scheduledDate: nextMonday,
    timeOfDay: "08:15",
    plannedDurationMinutes: 45,
  });
  expect(
    (
      await request.post(`${API_URL}/habits`, {
        data: { title: "Laufen", schedule: { type: "interval", intervalDays: 1 } },
      })
    ).status(),
  ).toBe(201);
  await page.goto(`/#/plan?ab=${nextMonday}`);
  await loaded(page);

  const monday = column(page, nextMonday);
  await expect(monday).toContainText("08:15");
  await expect(monday).toContainText("45 Min.");
  const dailyRow = monday
    .locator(".plan-entry")
    .filter({ has: page.getByRole("heading", { name: "Laufen", exact: true }) });
  await expect(dailyRow).toContainText("Daily");
  // Only forecast so far: nothing stored to drag, but its daily can be edited.
  await dailyRow
    .getByRole("button", { name: "Aktionen für Laufen", exact: true })
    .click();
  await expect(
    page.getByRole("menu", { name: "Laufen", exact: true }).getByRole("menuitem"),
  ).toHaveText(["Bearbeiten", "Löschen"]);
  await page.keyboard.press("Escape");

  await page
    .getByRole("button", { name: "Zahnarzt bearbeiten", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Quest bearbeiten" });
  await expect(dialog.locator('input[name="title"]')).toHaveValue("Zahnarzt");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(
    page.getByRole("button", { name: "Zahnarzt bearbeiten", exact: true }),
  ).toBeFocused();

  // A click anywhere else on the card opens the same editor.
  await card(page, "Zahnarzt").getByText("45 Min.", { exact: true }).click();
  await expect(dialog.locator('input[name="title"]')).toHaveValue("Zahnarzt");
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  // A daily's card opens its daily's editor.
  await dailyRow.getByText("Daily", { exact: true }).click();
  const daily = page.getByRole("dialog", { name: "Daily bearbeiten" });
  await expect(daily.locator('input[name="title"]')).toHaveValue("Laufen");
  await page.keyboard.press("Escape");
  await expect(daily).not.toBeVisible();
});

test("Plan: today's run of a daily sorts, moves within its window and opens with its notes", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const tomorrow = daysAfter(date, 1);
  await plan(request, { title: "Erstes", scheduledDate: date });
  // Every second day: today's run may wait until tomorrow.
  expect(
    (
      await request.post(`${API_URL}/habits`, {
        data: { title: "Laufen", schedule: { type: "interval", intervalDays: 2 } },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/#/plan");
  await loaded(page);

  const run = column(page, date)
    .locator("li[data-run-id]")
    .filter({ has: page.getByRole("heading", { name: "Laufen", exact: true }) });
  await expect(run).toContainText("Daily");
  // The same steps as on Heute, the order of the day among them.
  await run.getByRole("button", { name: "Aktionen für Laufen", exact: true }).click();
  const menu = page.getByRole("menu", { name: "Laufen", exact: true });
  await expect(menu.getByRole("menuitem", { name: "Laufen überspringen", exact: true })).toBeVisible();
  await menu.getByRole("menuitem", { name: "Laufen auf morgen", exact: true }).click();
  await expect.poll(() => storedDay(request, tomorrow)).toContain("Laufen");
  // A phone shows one day at a time: tomorrow is the next step.
  if ((await dayColumns(page).count()) < 2)
    await page.getByRole("button", { name: "Nächste Tage", exact: true }).click();
  await expect(
    column(page, tomorrow).locator("li[data-run-id]").filter({
      has: page.getByRole("heading", { name: "Laufen", exact: true }),
    }),
  ).toBeVisible();
  expect(await storedDay(request, date)).toEqual(["Erstes"]);

  // Its card opens the daily with the notes of this one run.
  await column(page, tomorrow)
    .getByRole("button", { name: "Laufen bearbeiten", exact: true })
    .click();
  const editor = page.getByRole("dialog", { name: "Daily bearbeiten" });
  await expect(editor).toContainText("Notizen zu diesem Lauf");
  await page.keyboard.press("Escape");
  await expect(editor).not.toBeVisible();
});

test("Plan: drag a quest onto another day and into place", async ({ page, request }, info) => {
  test.skip(
    info.project.name !== "chromium",
    "Dragging between columns is covered with the mouse; phones use the same code path, and their non-drag path is covered above.",
  );
  const date = await today(request);
  const tomorrow = daysAfter(date, 1);
  await plan(request, { title: "Wandert", scheduledDate: date });
  await plan(request, { title: "Bleibt oben", scheduledDate: tomorrow });
  await plan(request, { title: "Bleibt unten", scheduledDate: tomorrow });
  await page.goto("/#/plan");
  await loaded(page);

  await dragCard(page, card(page, "Wandert"), card(page, "Bleibt unten"));

  await expect
    .poll(() => storedDay(request, tomorrow))
    .toEqual(["Bleibt oben", "Wandert", "Bleibt unten"]);
  expect(await shownDay(page, tomorrow)).toEqual([
    "Bleibt oben",
    "Wandert",
    "Bleibt unten",
  ]);
  expect(await shownDay(page, date)).toEqual([]);
  // A drag is no tap: the editor stays closed.
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Plan: drag a quest from the Questlog column onto a day and back into the column", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "Dragging is covered with the mouse; a phone's Questlog starts as a rail and plans through the menu.",
  );
  const tomorrow = daysAfter(await today(request), 1);
  await plan(request, { title: "Aus dem Questlog" });
  await plan(request, { title: "Bleibt im Questlog" });
  await plan(request, { title: "Bleibt oben", scheduledDate: tomorrow });
  await plan(request, { title: "Bleibt unten", scheduledDate: tomorrow });
  await page.goto("/#/plan");
  await loaded(page);
  await expect(questlogRow(page, "Aus dem Questlog")).toBeVisible();

  await dragCard(
    page,
    questlogRow(page, "Aus dem Questlog"),
    card(page, "Bleibt unten"),
  );

  await expect
    .poll(() => storedDay(request, tomorrow))
    .toEqual(["Bleibt oben", "Aus dem Questlog", "Bleibt unten"]);
  expect(await shownDay(page, tomorrow)).toEqual([
    "Bleibt oben",
    "Aus dem Questlog",
    "Bleibt unten",
  ]);
  await expect(questlogRow(page, "Aus dem Questlog")).toHaveCount(0);
  expect(await storedQuestlog(request)).toEqual(["Bleibt im Questlog"]);

  // Back into the column, above the quest already there: it loses its day.
  await dragCard(
    page,
    card(page, "Bleibt oben"),
    questlogRow(page, "Bleibt im Questlog"),
  );
  await expect
    .poll(() => storedQuestlog(request))
    .toEqual(["Bleibt oben", "Bleibt im Questlog"]);
  await expect(page.locator("aside.plan-questlog li[data-todo-id] h3")).toHaveText([
    "Bleibt oben",
    "Bleibt im Questlog",
  ]);
  expect(await storedDay(request, tomorrow)).toEqual([
    "Aus dem Questlog",
    "Bleibt unten",
  ]);
});

test("Plan: the Questlog column lists only quests to work on, no campaigns, in the Questlog's order", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "A phone's Questlog column starts as a rail; the list itself is the same.",
  );
  const book = await plan(request, { title: "Buch schreiben" });
  const series = await plan(request, { title: "Kapitel", parentId: book.id });
  const chapter = await plan(request, { title: "Kapitel 1", parentId: series.id });
  await plan(request, { title: "Marathon im Frühjahr", icon: "dumbbell" });
  const shopping = await plan(request, { title: "Einkaufen" });
  // Sorted in the Questlog: the order holds in the column too.
  expect(
    (
      await request.put(`${API_URL}/todos/backlog/order`, {
        data: { ids: [shopping.id, chapter.id] },
      })
    ).status(),
  ).toBe(204);
  await page.goto("/#/plan");
  await loaded(page);
  await expect(page.locator("aside.plan-questlog li[data-todo-id] h3")).toHaveText([
    "Einkaufen",
    "Kapitel 1",
  ]);
  // The Questlog view reads the same list.
  await openView(page, "Questlog");
  await expect(page.locator(".questlog li[data-todo-id] .item-row__heading")).toHaveText([
    "Einkaufen",
    "Kapitel 1",
  ]);
});

test("Plan: plan a Questlog quest by keyboard from its menu; the column remembers being closed", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "A phone's Questlog column starts as a rail; its menu is the same.",
  );
  const date = await today(request);
  const tomorrow = daysAfter(date, 1);
  await plan(request, { title: "Steht schon da", scheduledDate: tomorrow });
  await plan(request, { title: "Per Taste" });
  await page.goto("/#/plan");
  await loaded(page);

  const trigger = questlogRow(page, "Per Taste").getByRole("button", {
    name: "Aktionen für Per Taste",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Per Taste", exact: true });
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  // Today first, then tomorrow.
  await page.keyboard.press("ArrowDown");
  await expect(
    menu.getByRole("menuitem", {
      name: `Per Taste einplanen am ${dayLabel(tomorrow)}`,
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect
    .poll(() => storedDay(request, tomorrow))
    .toEqual(["Steht schon da", "Per Taste"]);
  expect(await shownDay(page, tomorrow)).toEqual(["Steht schon da", "Per Taste"]);
  await expect(questlogRow(page, "Per Taste")).toHaveCount(0);

  const shownOpen = await dayColumns(page).count();
  await page
    .getByRole("button", { name: "Questlog ausblenden", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Questlog einblenden", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  // The rail gives its room to the days.
  await expect.poll(() => dayColumns(page).count()).toBeGreaterThanOrEqual(shownOpen);
  await page.reload();
  await loaded(page);
  await expect(
    page.getByRole("button", { name: "Questlog einblenden", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(await pageOverflow(page)).toBe(0);
});

test("Questlog: keeps the order it is sorted into, by menu and by dragging", async ({
  page,
  request,
}, info) => {
  for (const title of ["Erstes", "Zweites", "Drittes"]) await plan(request, { title });
  await page.goto("/");
  await openView(page, "Questlog");
  const titles = page.locator(".questlog li[data-todo-id] .item-row__heading");
  await expect(titles).toHaveText(["Erstes", "Zweites", "Drittes"]);

  await cardMenu(page, "Erstes", "Erstes nach unten");
  await expect(titles).toHaveText(["Zweites", "Erstes", "Drittes"]);
  await expect(menuButton(page, "Erstes")).toBeFocused();
  await expect
    .poll(() => storedQuestlog(request))
    .toEqual(["Zweites", "Erstes", "Drittes"]);

  if (info.project.name === "chromium") {
    const row = (title: string) =>
      page
        .locator(".questlog li[data-todo-id]")
        .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
    await dragCard(page, row("Drittes"), row("Zweites"));
    await expect
      .poll(() => storedQuestlog(request))
      .toEqual(["Drittes", "Zweites", "Erstes"]);
  }

  const expected = await storedQuestlog(request);
  await page.reload();
  await expect(titles).toHaveText(expected);
});

/**
 * Words of the board's titles that the browser split across two lines: for
 * each word a Range, whose rectangles all share one line when it is whole.
 */
const splitWords = (page: Page) =>
  page.evaluate(() => {
    const split: string[] = [];
    for (const title of document.querySelectorAll(".plan-day .plan-entry__title")) {
      const walker = document.createTreeWalker(title, NodeFilter.SHOW_TEXT);
      for (let node = walker.nextNode(); node; node = walker.nextNode()) {
        for (const match of (node.textContent ?? "").matchAll(/\S+/g)) {
          const range = document.createRange();
          range.setStart(node, match.index);
          range.setEnd(node, match.index + match[0].length);
          const tops = [...range.getClientRects()]
            .filter((rect) => rect.width > 0)
            .map((rect) => Math.round(rect.top));
          if (new Set(tops).size > 1) split.push(match[0]);
        }
      }
    }
    return split;
  });

/**
 * Quick-add placeholders wider than the room their field gives them: the
 * border box less borders and padding (an input's clientWidth leaves the
 * padding out in Chromium 158 and keeps it in older ones).
 */
const cutPlaceholders = (page: Page) =>
  page.evaluate(() => {
    const context = document.createElement("canvas").getContext("2d")!;
    return [...document.querySelectorAll<HTMLInputElement>(".plan-day input[name=quickTitle]")]
      .filter((input) => {
        const style = getComputedStyle(input);
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const room =
          input.offsetWidth -
          parseFloat(style.borderLeftWidth) -
          parseFloat(style.borderRightWidth) -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight);
        return context.measureText(input.placeholder).width > room;
      })
      .map((input) => input.placeholder);
  });

test("Plan: at common desktop widths the days fit without scrolling and titles wrap between words", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "Desktop widths; the phone's rail and single day are covered above.",
  );
  const date = await today(request);
  // Usual German titles, spread over the first days.
  const titles = [
    "Steuererklärung vorbereiten",
    "Halbmarathon im März",
    "Kapitel 2 überarbeiten",
    "Wohnung aufräumen und Fenster putzen",
    "Präsentation für Montag vorbereiten",
  ];
  for (const [index, title] of titles.entries())
    await plan(request, { title, scheduledDate: daysAfter(date, index) });
  await plan(request, { title: "Versicherung kündigen" });

  for (const width of [1164, 1280, 1920]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/plan");
    await loaded(page);
    // With room for it beside a day, the Questlog column starts open.
    await expect(
      page.getByRole("button", { name: "Questlog ausblenden", exact: true }),
    ).toBeVisible();
    // Judge the widths alone: where a German dictionary exists the browser
    // may hyphenate, and the board must not depend on that.
    await page.addStyleTag({
      content: ".plan-entry__title { hyphens: manual !important; }",
    });
    expect(await splitWords(page), `split words at ${width}px`).toEqual([]);
    expect(await cutPlaceholders(page), `cut placeholders at ${width}px`).toEqual([]);

    // As many days as fit, each at least 14rem, and none cut off.
    const board = page.locator(".plan-view__board");
    expect(
      await board.evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBe(0);
    const widths = await dayColumns(page).evaluateAll((columns) =>
      columns.map((element) => element.getBoundingClientRect().width),
    );
    expect(widths.length, `days at ${width}px`).toBeGreaterThanOrEqual(width >= 1920 ? 6 : 4);
    for (const columnWidth of widths) expect(columnWidth).toBeGreaterThanOrEqual(224);
    await expect(column(page, date)).toBeInViewport({ ratio: 1 });
    expect(await pageOverflow(page)).toBe(0);
  }
});
