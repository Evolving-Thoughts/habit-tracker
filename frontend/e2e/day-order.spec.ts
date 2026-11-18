import { berlinTime, openView, today, daysAfter } from "./helpers";
import { test, expect } from "./fixtures";
import { API_URL } from "./environment";
import type { APIRequestContext, Page } from "@playwright/test";

const plan = async (request: APIRequestContext, data: object) => {
  const response = await request.post(`${API_URL}/todos`, { data });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number };
};
/** Titles of the day's order as shown: the focus card first, then the rows. */
const shownOrder = async (page: Page) => [
  await page.locator("#focus-title").innerText(),
  ...(await page.locator(".order .planner-item h3").allInnerTexts()),
];
/** The order the server has stored, by title. */
const storedOrder = async (request: APIRequestContext) =>
  (
    (await (await request.get(`${API_URL}/day-planner/today`)).json()) as {
      items: { title: string }[];
    }
  ).items.map(({ title }) => title);
const grip = (page: Page, title: string) =>
  page.getByRole("button", {
    name: `${title} in der Reihenfolge verschieben`,
    exact: true,
  });

test("Heute: sort the day with the grip's arrow keys; the head becomes the focus and it persists", async ({
  page,
  request,
}) => {
  const date = await today(request);
  for (const title of ["Erstes", "Zweites", "Drittes"])
    await plan(request, { title, scheduledDate: date });
  await page.goto("/");
  await expect(page.locator("#focus-title")).toHaveText("Erstes");
  expect(await shownOrder(page)).toEqual(["Erstes", "Zweites", "Drittes"]);

  await grip(page, "Drittes").focus();
  await page.keyboard.press("ArrowUp");
  await expect(page.getByRole("status").filter({ hasText: "Drittes" })).toHaveText(
    "„Drittes“ steht jetzt an Stelle 2 von 3.",
  );
  await expect(grip(page, "Drittes")).toBeFocused();
  await page.keyboard.press("ArrowUp");
  await expect(page.locator("#focus-title")).toHaveText("Drittes");
  await expect
    .poll(() => storedOrder(request))
    .toEqual(["Drittes", "Erstes", "Zweites"]);

  await page.reload();
  await expect(page.locator("#focus-title")).toHaveText("Drittes");
  expect(await shownOrder(page)).toEqual(["Drittes", "Erstes", "Zweites"]);
});

test("Heute: drag a quest above another one", async ({ page, request }, info) => {
  test.skip(
    info.project.name !== "chromium",
    "Dragging is covered with the mouse; phones use the same code path by touch.",
  );
  const date = await today(request);
  for (const title of ["Erstes", "Zweites", "Drittes", "Viertes"])
    await plan(request, { title, scheduledDate: date });
  await page.goto("/");
  await expect(page.locator("#focus-title")).toHaveText("Erstes");

  const from = (await grip(page, "Viertes").boundingBox())!;
  const to = (await grip(page, "Zweites").boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  // Several steps, as a hand would move: SortableJS decides on the way.
  await page.mouse.move(to.x + to.width / 2, to.y + to.height / 2 + 8, {
    steps: 12,
  });
  await page.mouse.move(to.x + to.width / 2, to.y + 2, { steps: 6 });
  await page.mouse.up();

  await expect
    .poll(() => storedOrder(request))
    .toEqual(["Erstes", "Viertes", "Zweites", "Drittes"]);
  expect(await shownOrder(page)).toEqual([
    "Erstes",
    "Viertes",
    "Zweites",
    "Drittes",
  ]);
});

test("Heute: quick add puts a quest at the end or at the head of today", async ({
  page,
  request,
}) => {
  const date = await today(request);
  await plan(request, { title: "Schon da", scheduledDate: date });
  await page.goto("/");
  const field = page.getByRole("textbox", {
    name: "Quest für heute hinzufügen",
  });

  await field.fill("Hinten dran");
  await field.press("Enter");
  await expect(field).toHaveValue("");
  await expect.poll(() => shownOrder(page)).toEqual(["Schon da", "Hinten dran"]);

  await page.getByRole("button", { name: "Oben", exact: true }).click();
  await field.fill("Ganz vorn");
  await field.press("Enter");
  await expect(page.locator("#focus-title")).toHaveText("Ganz vorn");
  expect(await storedOrder(request)).toEqual([
    "Ganz vorn",
    "Schon da",
    "Hinten dran",
  ]);
});

test("Heute: appointments sit on the time axis and stay when the rest moves to tomorrow", async ({
  page,
  request,
}) => {
  const date = await today(request);
  // Noon in the browser, whatever the hour the suite runs at.
  await page.clock.install({ time: berlinTime(date, "12:00") });
  await plan(request, {
    title: "Zahnarzt",
    scheduledDate: date,
    timeOfDay: "23:58",
  });
  await plan(request, { title: "Aufräumen", scheduledDate: date });
  await plan(request, { title: "Einkaufen", scheduledDate: date });
  await page.goto("/");

  const axis = page.getByRole("region", { name: "Termine" });
  await expect(axis).toContainText("23:58");
  await expect(axis).toContainText("Zahnarzt");
  await expect(grip(page, "Zahnarzt")).toHaveCount(0);

  await page.getByRole("button", { name: "Auf morgen", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("2 offene Einträge wandern auf morgen");
  await dialog
    .getByRole("button", { name: "Auf morgen verschieben", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();

  // An appointment never stands in for an empty order: it waits on the axis.
  await expect(page.locator("#focus-title")).toHaveCount(0);
  await expect(page.locator(".order .planner-item")).toHaveCount(0);
  await expect(page.locator(".today-view__empty")).toContainText(
    "Nächster Termin: 23:58 Zahnarzt.",
  );
  await expect(axis).toContainText("Zahnarzt");
  const todos = (await (await request.get(`${API_URL}/todos`)).json()) as {
    title: string;
    scheduledDate: string;
  }[];
  expect(
    Object.fromEntries(todos.map((todo) => [todo.title, todo.scheduledDate])),
  ).toEqual({
    Zahnarzt: date,
    Aufräumen: daysAfter(date, 1),
    Einkaufen: daysAfter(date, 1),
  });
});

test("Heute: an appointment is the focus card from its start to its end", async ({
  page,
  request,
}) => {
  const date = await today(request);
  // The browser's clock, not the wall clock: 09:50 on the server's day.
  await page.clock.install({ time: berlinTime(date, "09:50") });
  await plan(request, {
    title: "Teamrunde",
    scheduledDate: date,
    timeOfDay: "10:00",
    plannedDurationMinutes: 30,
  });
  await plan(request, { title: "Steuer sortieren", scheduledDate: date });
  await plan(request, { title: "Mails", scheduledDate: date });
  await page.goto("/");
  const focus = page.locator(".focus");
  const axis = page.getByRole("region", { name: "Termine" });

  // Before: the next item of the order; the appointment waits on the axis.
  await expect(page.locator("#focus-title")).toHaveText("Steuer sortieren");
  await expect(axis).toContainText("Teamrunde");
  await expect(
    focus.getByRole("link", { name: "Fokus-Modus", exact: true }),
  ).toBeVisible();

  // During: the page stays open and the card changes on its own.
  await page.clock.fastForward(11 * 60_000);
  await expect(page.locator("#focus-title")).toHaveText("Teamrunde");
  await expect(focus.locator(".focus__slot")).toHaveText("10:00–10:30");
  await expect(
    focus.getByRole("button", { name: "Teamrunde erledigen", exact: true }),
  ).toBeVisible();
  await expect(
    focus.getByRole("button", {
      name: "Stoppuhr für Teamrunde starten",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    focus.getByRole("link", { name: "Fokus-Modus", exact: true }),
  ).toHaveCount(0);
  await focus
    .getByRole("button", { name: "Aktionen für Teamrunde", exact: true })
    .click();
  await expect(
    page.getByRole("menuitem", { name: "Teamrunde verschieben", exact: true }),
  ).toHaveText(/Termin verschieben/);
  await page.keyboard.press("Escape");
  // The rest of the order is unchanged below it.
  await expect(page.locator(".order .planner-item h3")).toHaveText([
    "Steuer sortieren",
    "Mails",
  ]);

  // After: back to the order; the unfinished appointment stays, as past.
  await page.clock.fastForward(30 * 60_000);
  await expect(page.locator("#focus-title")).toHaveText("Steuer sortieren");
  await expect(axis.locator(".timeline__entry--past")).toContainText(
    "Teamrunde",
  );
});

test("Quest forms plan a day; only an appointment gets a time", async ({
  page,
  request,
}) => {
  const date = await today(request);
  // Noon in the browser, so 23:57 is still ahead whenever the suite runs.
  await page.clock.install({ time: berlinTime(date, "12:00") });
  await page.goto("/");
  await openView(page, "Questlog");
  await page.locator(".create-button").click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('[name="title"]').fill("Steuerberater");
  await expect(dialog.locator('[name="timeOfDay"]')).toBeDisabled();
  await dialog.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(dialog.locator('[name="scheduledDate"]')).toHaveValue(date);
  await dialog.locator('[name="timeOfDay"]').fill("23:57");
  await dialog
    .getByRole("button", { name: "Quest erstellen", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();

  const [todo] = (await (await request.get(`${API_URL}/todos`)).json()) as {
    scheduledDate: string;
    timeOfDay: string;
  }[];
  expect(todo).toMatchObject({ scheduledDate: date, timeOfDay: "23:57" });
  await openView(page, "Heute");
  // An appointment waits on the time axis until its turn.
  await expect(
    page
      .getByRole("region", { name: "Termine" })
      .getByRole("heading", { name: "Steuerberater", exact: true }),
  ).toBeVisible();
});
