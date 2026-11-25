import {
  berlinTime,
  cardMenu,
  dragCard,
  openView,
  today,
  daysAfter,
} from "./helpers";
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
/** A row of the day's order, by its title. */
const card = (page: Page, title: string) =>
  page
    .locator(".order .planner-item")
    .filter({ has: page.getByRole("heading", { name: title, exact: true }) });
const menuButton = (page: Page, title: string) =>
  page.getByRole("button", { name: `Aktionen für ${title}`, exact: true });

test("Heute: sort the day with Nach oben in the menu; the head becomes the focus and it persists", async ({
  page,
  request,
}) => {
  const date = await today(request);
  for (const title of ["Erstes", "Zweites", "Drittes"])
    await plan(request, { title, scheduledDate: date });
  await page.goto("/");
  await expect(page.locator("#focus-title")).toHaveText("Erstes");
  expect(await shownOrder(page)).toEqual(["Erstes", "Zweites", "Drittes"]);

  await cardMenu(page, "Drittes", "Drittes nach oben");
  await expect(
    page.getByRole("status").filter({ hasText: "Drittes" }),
  ).toHaveText("„Drittes“ steht jetzt an Stelle 2 von 3.");
  // The keyboard stays on the moved card's menu button.
  await expect(menuButton(page, "Drittes")).toBeFocused();
  await cardMenu(page, "Drittes", "Drittes nach oben");
  await expect(page.locator("#focus-title")).toHaveText("Drittes");
  await expect
    .poll(() => storedOrder(request))
    .toEqual(["Drittes", "Erstes", "Zweites"]);

  await page.reload();
  await expect(page.locator("#focus-title")).toHaveText("Drittes");
  expect(await shownOrder(page)).toEqual(["Drittes", "Erstes", "Zweites"]);
});

test("Heute: a fixed appointment can be dragged onto the focus card and stays there after reload", async ({
  page,
  request,
}, info) => {
  test.skip(info.project.name !== "chromium", "Mouse drag");
  const date = await today(request);
  await page.clock.install({ time: berlinTime(date, "08:00") });
  for (const [title, timeOfDay] of [
    ["Transporter", "10:00"],
    ["Meeting", "14:30"],
    ["Texte", null],
  ]) {
    await plan(request, { title, scheduledDate: date, timeOfDay });
  }
  await page.goto("/");
  await expect(page.locator("#focus-title")).toHaveText("Texte");
  await dragCard(page, card(page, "Transporter"), page.locator(".focus"));
  await expect(page.locator("#focus-title")).toHaveText("Transporter");
  await expect
    .poll(() => storedOrder(request))
    .toEqual(["Transporter", "Texte", "Meeting"]);
  await page.reload();
  await expect(page.locator("#focus-title")).toHaveText("Transporter");
});

test("Heute: drag a quest by its card above another one; a click opens the editor", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "chromium",
    "Dragging is covered with the mouse; phones use the same code path by touch.",
  );
  const date = await today(request);
  for (const title of ["Erstes", "Zweites", "Drittes", "Viertes"])
    await plan(request, { title, scheduledDate: date });
  await page.goto("/");
  await expect(page.locator("#focus-title")).toHaveText("Erstes");

  // No grip: the card itself drags, from anywhere but its controls.
  await expect(page.locator(".order .sort-handle")).toHaveCount(0);
  await dragCard(page, card(page, "Viertes"), card(page, "Zweites"));

  await expect
    .poll(() => storedOrder(request))
    .toEqual(["Erstes", "Viertes", "Zweites", "Drittes"]);
  expect(await shownOrder(page)).toEqual([
    "Erstes",
    "Viertes",
    "Zweites",
    "Drittes",
  ]);

  // A short click on the same spot is no drag: it opens the editor.
  const meta = card(page, "Drittes").locator("h3");
  const box = (await meta.boundingBox())!;
  await page.mouse.click(box.x + box.width - 6, box.y + box.height / 2);
  await expect(
    page.getByRole("dialog", { name: "Quest bearbeiten" }),
  ).toBeVisible();
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
  await expect
    .poll(() => shownOrder(page))
    .toEqual(["Schon da", "Hinten dran"]);

  // The small toggle beside the field; the choice holds on this device.
  const top = page.getByRole("button", { name: "Oben einfügen", exact: true });
  await top.click();
  await expect(top).toHaveAttribute("aria-pressed", "true");
  await field.fill("Ganz vorn");
  await field.press("Enter");
  await expect(page.locator("#focus-title")).toHaveText("Ganz vorn");
  expect(await storedOrder(request)).toEqual([
    "Ganz vorn",
    "Schon da",
    "Hinten dran",
  ]);
});

test("Heute: appointments sit in the list by their time and stay when the rest moves to tomorrow", async ({
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

  // In the list with its time, an anchor of the order: cards drop next to it,
  // it never lifts itself.
  const appointment = card(page, "Zahnarzt");
  await expect(appointment).toHaveClass(/today-view__appointment/);
  await expect(appointment).toContainText("23:58");
  await expect(appointment).toHaveAttribute("data-sort-key", /todo-/);

  // On a phone "Auf morgen" waits in the header's "…" menu.
  if ((page.viewportSize()?.width ?? 1280) < 640) {
    await page
      .getByRole("button", { name: "Weitere Aktionen für heute", exact: true })
      .click();
    await page
      .getByRole("menuitem", {
        name: "Offenes auf morgen verschieben",
        exact: true,
      })
      .click();
  } else {
    await page.getByRole("button", { name: "Auf morgen", exact: true }).click();
  }
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("2 offene Einträge wandern auf morgen");
  await dialog
    .getByRole("button", { name: "Auf morgen verschieben", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();

  // An appointment never stands in for an empty order: it waits in the list.
  await expect(page.locator("#focus-title")).toHaveCount(0);
  await expect(
    page.locator(
      ".order [data-sort-key]:not(.today-view__appointment):not([data-sort-anchor])",
    ),
  ).toHaveCount(0);
  await expect(page.locator(".today-view__empty")).toContainText(
    "Nächster Termin: 23:58 Zahnarzt.",
  );
  await expect(appointment).toBeVisible();
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

  // Before: the next item of the order; the appointment waits in the list.
  await expect(page.locator("#focus-title")).toHaveText("Steuer sortieren");
  await expect(card(page, "Teamrunde")).toContainText("10:00");
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

  // After: back to the order; the unfinished appointment stays and asks quietly.
  await page.clock.fastForward(30 * 60_000);
  await expect(page.locator("#focus-title")).toHaveText("Steuer sortieren");
  const past = page.locator(".today-view__appointment--past");
  await expect(past).toContainText("Teamrunde");
  await expect(past).toContainText("Vorbei – erledigt?");
  // Its move leads the card's "…" menu; the card itself stays compact.
  await past
    .getByRole("button", { name: "Aktionen für Teamrunde", exact: true })
    .click();
  await page
    .getByRole("menuitem", {
      name: "Teamrunde auf einen anderen Tag",
      exact: true,
    })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.keyboard.press("Escape");
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
  // The time waits behind "Termin (feste Uhrzeit)", and needs a day.
  const appointment = dialog.getByRole("button", { name: /^Termin/ });
  await expect(appointment).toHaveAttribute("aria-expanded", "false");
  await appointment.click();
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
  // An appointment waits in the list, with its time, until its turn.
  await expect(card(page, "Steuerberater")).toContainText("23:57");
});
