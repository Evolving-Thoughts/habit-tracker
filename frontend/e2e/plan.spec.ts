import type { APIRequestContext, Page } from "@playwright/test";
import { API_URL } from "./environment";
import { test, expect } from "./fixtures";
import { dayLabel, daysAfter, openView, shortDate, today } from "./helpers";

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
/** A quest's one move control: drag it, step it with arrows, tap it for a day. */
const grip = (page: Page, title: string) =>
  page.getByRole("button", { name: `${title} verschieben`, exact: true });
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
});

test("Plan: sort a day and move a quest to the next day with the grip's arrow keys", async ({
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

  await grip(page, "Drittes").focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("status").filter({ hasText: "Drittes" })).toHaveText(
    "„Drittes“ steht jetzt an Stelle 2 von 3.",
  );
  await expect(grip(page, "Drittes")).toBeFocused();
  await expect
    .poll(() => storedDay(request, nextMonday))
    .toEqual(["Erstes", "Drittes", "Zweites"]);

  await page.keyboard.press("ArrowRight");
  await expect
    .poll(() => storedDay(request, tuesday))
    .toEqual(["Am Dienstag", "Drittes"]);
  await expect(grip(page, "Drittes")).toBeFocused();
  expect(await shownDay(page, nextMonday)).toEqual(["Erstes", "Zweites"]);

  await page.reload();
  await loaded(page);
  expect(await shownDay(page, tuesday)).toEqual(["Am Dienstag", "Drittes"]);
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

  await grip(page, "Steuer abgeben").click();
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

  const from = (await grip(page, "Wandert").boundingBox())!;
  const to = (await grip(page, "Bleibt unten").boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Several steps, as a hand would move: SortableJS decides on the way.
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 8, {
    steps: 16,
  });
  await page.mouse.move(to.x + to.width / 2, to.y - 4, { steps: 6 });
  await page.mouse.up();

  await expect
    .poll(() => storedDay(request, tuesday))
    .toEqual(["Bleibt oben", "Wandert", "Bleibt unten"]);
  expect(await shownDay(page, tuesday)).toEqual([
    "Bleibt oben",
    "Wandert",
    "Bleibt unten",
  ]);
  expect(await shownDay(page, nextMonday)).toEqual([]);
  // A drag is no tap: the day dialog stays closed.
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

  const from = (await questlogRow(page, "Aus dem Questlog")
    .locator(".sort-handle")
    .boundingBox())!;
  const to = (await grip(page, "Bleibt unten").boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 8, {
    steps: 16,
  });
  await page.mouse.move(to.x + to.width / 2, to.y - 4, { steps: 6 });
  await page.mouse.up();

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
