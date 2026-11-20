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
    `${API_URL}/day-planner/week?start=${mondayOf(date)}`,
  );
  expect(response.ok()).toBeTruthy();
  const body = (await response.json()) as {
    days: { date: string; entries: { title: string }[] }[];
  };
  return body.days
    .find((day) => day.date === date)!
    .entries.map(({ title }) => title);
};
const column = (page: Page, date: string) =>
  page.locator(`section.plan-day[data-date="${date}"]`);
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
/** Waits until the board has loaded. */
const loaded = async (page: Page) => {
  await expect(page.getByRole("status", { name: "Plan wird geladen" })).toHaveCount(0);
  await expect(page.locator("section.plan-day")).toHaveCount(7);
};

test("Plan: open it from the navigation, add a quest to a day and keep the week on reload", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const nextMonday = daysAfter(mondayOf(date), 7);
  const wednesday = daysAfter(nextMonday, 2);
  await page.goto("/");
  await openView(page, "Plan");
  await expect(page).toHaveURL(/#\/plan$/);
  await expect(page).toHaveTitle("Plan · Habit Tracker");
  await loaded(page);
  await expect(column(page, date)).toHaveAttribute("aria-current", "date");
  await expect(column(page, date)).toBeInViewport();
  // On the current week the way back to it would change nothing.
  await expect(
    page.getByRole("button", { name: "Diese Woche", exact: true }),
  ).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBe(0);

  await page.getByRole("button", { name: "Nächste Woche", exact: true }).click();
  await expect(page).toHaveURL(new RegExp(`#/plan\\?woche=${nextMonday}$`));
  await loaded(page);
  await expect(page.getByRole("heading", { level: 1 })).toContainText(
    shortDate(daysAfter(nextMonday, 6)),
  );

  const field = page.getByRole("textbox", {
    name: `Quest für ${dayLabel(wednesday)} hinzufügen`,
  });
  await field.fill("Geschenk besorgen");
  await field.press("Enter");
  await expect(field).toHaveValue("");
  await expect.poll(() => shownDay(page, wednesday)).toEqual(["Geschenk besorgen"]);
  await field.fill("Karte schreiben");
  await field.press("Enter");
  await expect
    .poll(() => storedDay(request, wednesday))
    .toEqual(["Geschenk besorgen", "Karte schreiben"]);

  await page.reload();
  await loaded(page);
  expect(await shownDay(page, wednesday)).toEqual([
    "Geschenk besorgen",
    "Karte schreiben",
  ]);

  // The current week has the plain address; Back returns to the week before.
  await page.getByRole("button", { name: "Vorige Woche", exact: true }).click();
  await expect(page).toHaveURL(/#\/plan$/);
  await page.goBack();
  await expect(page).toHaveURL(new RegExp(`woche=${nextMonday}$`));
  await loaded(page);
  await page.getByRole("button", { name: "Diese Woche", exact: true }).click();
  await expect(page).toHaveURL(/#\/plan$/);
  await loaded(page);
  await expect(column(page, date)).toHaveAttribute("aria-current", "date");
  // The button left with the step; the heading names the week and has the focus.
  await expect(
    page.getByRole("button", { name: "Diese Woche", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
});

test("Plan: sort a day with Nach oben and Nach unten in a card's menu", async ({
  page,
  request,
}) => {
  const nextMonday = daysAfter(mondayOf(await today(request)), 7);
  const tuesday = daysAfter(nextMonday, 1);
  for (const title of ["Erstes", "Zweites", "Drittes"])
    await plan(request, { title, scheduledDate: nextMonday });
  await plan(request, { title: "Am Dienstag", scheduledDate: tuesday });
  await page.goto(`/#/plan?woche=${nextMonday}`);
  await loaded(page);
  expect(await shownDay(page, nextMonday)).toEqual(["Erstes", "Zweites", "Drittes"]);

  // No grip on the cards: they drag as a whole, the menu moves them by key.
  await expect(column(page, nextMonday).locator(".sort-handle")).toHaveCount(0);
  await cardMenu(page, "Drittes", "Drittes nach oben");
  await expect(page.getByRole("status").filter({ hasText: "Drittes" })).toHaveText(
    "„Drittes“ steht jetzt an Stelle 2 von 3.",
  );
  await expect(menuButton(page, "Drittes")).toBeFocused();
  await expect
    .poll(() => storedDay(request, nextMonday))
    .toEqual(["Erstes", "Drittes", "Zweites"]);

  await cardMenu(page, "Erstes", "Erstes nach unten");
  await expect
    .poll(() => storedDay(request, nextMonday))
    .toEqual(["Drittes", "Erstes", "Zweites"]);
  await expect(menuButton(page, "Erstes")).toBeFocused();
  expect(await shownDay(page, tuesday)).toEqual(["Am Dienstag"]);

  await page.reload();
  await loaded(page);
  expect(await shownDay(page, nextMonday)).toEqual(["Drittes", "Erstes", "Zweites"]);
});

test("Plan: move a quest to today without dragging, and Heute shows it", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const tomorrow = daysAfter(date, 1);
  await plan(request, { title: "Steuer abgeben", scheduledDate: tomorrow });
  await page.goto(`/#/plan?woche=${mondayOf(tomorrow)}`);
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

test("Plan: a quest opens its editor; dailies are fixed rows", async ({
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
  await page.goto(`/#/plan?woche=${nextMonday}`);
  await loaded(page);

  const monday = column(page, nextMonday);
  await expect(monday).toContainText("08:15");
  await expect(monday).toContainText("45 Min.");
  const dailyRow = monday.locator(".plan-entry--daily");
  await expect(dailyRow).toContainText("Laufen");
  await expect(dailyRow).toContainText("Daily");
  await expect(dailyRow.getByRole("button")).toHaveCount(0);

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
  // A daily's card opens nothing.
  await dailyRow.click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("Plan: drag a quest onto another day and into place", async ({ page, request }, info) => {
  test.skip(
    info.project.name !== "chromium",
    "Dragging between columns is covered with the mouse; phones use the same code path, and their non-drag path is covered above.",
  );
  const nextMonday = daysAfter(mondayOf(await today(request)), 7);
  const tuesday = daysAfter(nextMonday, 1);
  await plan(request, { title: "Wandert", scheduledDate: nextMonday });
  await plan(request, { title: "Bleibt oben", scheduledDate: tuesday });
  await plan(request, { title: "Bleibt unten", scheduledDate: tuesday });
  await page.goto(`/#/plan?woche=${nextMonday}`);
  await loaded(page);

  await dragCard(page, card(page, "Wandert"), card(page, "Bleibt unten"));

  await expect
    .poll(() => storedDay(request, tuesday))
    .toEqual(["Bleibt oben", "Wandert", "Bleibt unten"]);
  expect(await shownDay(page, tuesday)).toEqual([
    "Bleibt oben",
    "Wandert",
    "Bleibt unten",
  ]);
  expect(await shownDay(page, nextMonday)).toEqual([]);
  // A drag is no tap: the editor stays closed.
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

/** A quest of the Questlog column (from 56rem), by title. */
const questlogRow = (page: Page, title: string) =>
  page
    .locator("aside.plan-questlog li[data-todo-id]")
    .filter({ hasText: title });

test("Plan: drag a quest from the Questlog column onto a day and into place", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "The Questlog column is a desktop column from 56rem; the phone's Plan stays as it was.",
  );
  const nextMonday = daysAfter(mondayOf(await today(request)), 7);
  const tuesday = daysAfter(nextMonday, 1);
  await plan(request, { title: "Aus dem Questlog" });
  await plan(request, { title: "Bleibt oben", scheduledDate: tuesday });
  await plan(request, { title: "Bleibt unten", scheduledDate: tuesday });
  await page.goto(`/#/plan?woche=${nextMonday}`);
  await loaded(page);
  await expect(questlogRow(page, "Aus dem Questlog")).toBeVisible();

  await dragCard(
    page,
    questlogRow(page, "Aus dem Questlog"),
    card(page, "Bleibt unten"),
  );

  await expect
    .poll(() => storedDay(request, tuesday))
    .toEqual(["Bleibt oben", "Aus dem Questlog", "Bleibt unten"]);
  expect(await shownDay(page, tuesday)).toEqual([
    "Bleibt oben",
    "Aus dem Questlog",
    "Bleibt unten",
  ]);
  await expect(questlogRow(page, "Aus dem Questlog")).toHaveCount(0);
  const backlog = await request.get(`${API_URL}/todos/backlog`);
  expect(((await backlog.json()) as unknown[]).length).toBe(0);
});

test("Plan: the Questlog column lists only quests to work on, no campaigns", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "The Questlog column is a desktop column from 56rem; the phone's Plan stays as it was.",
  );
  const book = await plan(request, { title: "Buch schreiben" });
  const series = await plan(request, { title: "Kapitel", parentId: book.id });
  await plan(request, { title: "Kapitel 1", parentId: series.id });
  await plan(request, { title: "Marathon im Frühjahr", icon: "dumbbell" });
  await plan(request, { title: "Einkaufen" });
  await page.goto("/#/plan");
  await loaded(page);
  await expect(page.locator("aside.plan-questlog li[data-todo-id] h3")).toHaveText([
    "Kapitel 1",
    "Einkaufen",
  ]);
  // The Questlog view reads the same list.
  await openView(page, "Questlog");
  await expect(page.locator(".questlog li[data-todo-id] .item-row__heading")).toHaveText([
    "Kapitel 1",
    "Einkaufen",
  ]);
});

test("Plan: plan a Questlog quest by keyboard from its menu; the column remembers being closed", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "The Questlog column is a desktop column from 56rem; the phone's Plan stays as it was.",
  );
  const nextMonday = daysAfter(mondayOf(await today(request)), 7);
  const tuesday = daysAfter(nextMonday, 1);
  await plan(request, { title: "Steht schon da", scheduledDate: tuesday });
  await plan(request, { title: "Per Taste" });
  await page.goto(`/#/plan?woche=${nextMonday}`);
  await loaded(page);

  const trigger = questlogRow(page, "Per Taste").getByRole("button", {
    name: "Aktionen für Per Taste",
    exact: true,
  });
  await trigger.focus();
  await page.keyboard.press("Enter");
  const menu = page.getByRole("menu", { name: "Per Taste", exact: true });
  await expect(menu.getByRole("menuitem").first()).toBeFocused();
  // Monday first, then Tuesday.
  await page.keyboard.press("ArrowDown");
  await expect(
    menu.getByRole("menuitem", {
      name: `Per Taste einplanen am ${dayLabel(tuesday)}`,
      exact: true,
    }),
  ).toBeFocused();
  await page.keyboard.press("Enter");

  await expect
    .poll(() => storedDay(request, tuesday))
    .toEqual(["Steht schon da", "Per Taste"]);
  expect(await shownDay(page, tuesday)).toEqual([
    "Steht schon da",
    "Per Taste",
  ]);
  await expect(questlogRow(page, "Per Taste")).toHaveCount(0);

  await page
    .getByRole("button", { name: "Questlog ausblenden", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Questlog einblenden", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  await page.reload();
  await loaded(page);
  await expect(
    page.getByRole("button", { name: "Questlog einblenden", exact: true }),
  ).toHaveAttribute("aria-expanded", "false");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBe(0);
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

/** Quick-add placeholders wider than the room their field gives them. */
const cutPlaceholders = (page: Page) =>
  page.evaluate(() => {
    const context = document.createElement("canvas").getContext("2d")!;
    return [...document.querySelectorAll<HTMLInputElement>(".plan-day input[name=quickTitle]")]
      .filter((input) => {
        const style = getComputedStyle(input);
        context.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
        const room =
          input.clientWidth -
          parseFloat(style.paddingLeft) -
          parseFloat(style.paddingRight);
        return context.measureText(input.placeholder).width > room;
      })
      .map((input) => input.placeholder);
  });

test("Plan: at common desktop widths the week fits, titles wrap between words and Montag shows", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "Desktop widths with the Questlog column; the phone shows one day at a time.",
  );
  const monday = mondayOf(await today(request));
  // Usual German titles, spread over the week (earlier days carry over to today).
  const titles = [
    "Steuererklärung vorbereiten",
    "Halbmarathon im März",
    "Kapitel 2 überarbeiten",
    "Einkaufen",
    "Wohnung aufräumen und Fenster putzen",
    "Präsentation für Montag vorbereiten",
    "Wochenplanung",
  ];
  for (const [index, title] of titles.entries())
    await plan(request, { title, scheduledDate: daysAfter(monday, index) });
  await plan(request, { title: "Versicherung kündigen" });

  for (const width of [1164, 1280]) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/#/plan");
    await loaded(page);
    // Below 80rem the Questlog column starts as a rail, from there it is open.
    await expect(
      page.getByRole("button", {
        name: width < 1280 ? "Questlog einblenden" : "Questlog ausblenden",
        exact: true,
      }),
    ).toBeVisible();
    // Judge the widths alone: where a German dictionary exists the browser
    // may hyphenate, and the board must not depend on that.
    await page.addStyleTag({
      content: ".plan-entry__title { hyphens: manual !important; }",
    });
    expect(await splitWords(page), `split words at ${width}px`).toEqual([]);
    expect(await cutPlaceholders(page), `cut placeholders at ${width}px`).toEqual([]);

    // The whole week fits: Montag is fully in view, right of the column.
    const board = page.locator(".plan-view__board");
    expect(
      await board.evaluate((element) => element.scrollWidth - element.clientWidth),
    ).toBe(0);
    await expect(column(page, monday)).toBeInViewport({ ratio: 1 });
    const boardBox = (await board.boundingBox())!;
    const mondayBox = (await column(page, monday).boundingBox())!;
    expect(mondayBox.x).toBeGreaterThanOrEqual(boardBox.x);
    expect(
      await page.evaluate(
        () =>
          document.documentElement.scrollWidth -
          document.documentElement.clientWidth,
      ),
    ).toBe(0);
  }
});
