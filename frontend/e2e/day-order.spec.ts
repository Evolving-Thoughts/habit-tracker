import { openView, today, daysAfter } from "./helpers";
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

  await expect(page.locator("#focus-title")).toHaveText("Zahnarzt");
  await expect(page.locator(".order .planner-item")).toHaveCount(0);
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

test("Quest forms plan a day; only an appointment gets a time", async ({
  page,
  request,
}) => {
  const date = await today(request);
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
  await expect(page.getByText("Steuerberater")).toBeVisible();
});
