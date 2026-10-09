import { test, expect } from "./fixtures";
import { visit, createTodo, daysAfter, today } from "./helpers";
import { API_URL } from "./environment";
import type { TimerResponse } from "../src/api/timers.api";
const read = async (request: import("@playwright/test").APIRequestContext) => {
  const r = await request.get(`${API_URL}/timers/current`);
  expect(r.ok()).toBeTruthy();
  return (await r.json()) as TimerResponse;
};
test("Todo timer: direct play, sticky bar, reload, second device, pause/duration/resume/confirmed stop", async ({
  page,
  request,
  context,
  browser,
}) => {
  await visit(page, "Todo-Dump");
  await createTodo(page, "Schreiben");
  await page
    .getByRole("button", { name: "Timer für Schreiben starten", exact: true })
    .click();
  const bar = page.getByRole("complementary", { name: "Aktueller Timer" });
  await expect(bar).toContainText("Timer läuft");
  expect((await read(request)).timer?.durationMinutes).toBe(30);
  await page.reload();
  await expect(bar).toContainText("Schreiben");
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Habits", exact: true })
    .click();
  await expect(bar).toBeVisible();
  const other = await browser.newContext({
    storageState: await context.storageState(),
    baseURL: "http://127.0.0.1:4173",
    timezoneId: "Europe/Berlin",
  });
  const device = await other.newPage();
  await device.goto("/");
  await expect(device.getByRole("complementary")).toContainText("Schreiben");
  await page
    .getByRole("button", { name: "Timer pausieren", exact: true })
    .click();
  await expect(bar).toContainText("Pausiert");
  await expect(device.getByRole("complementary")).toContainText("Pausiert");
  await page
    .getByRole("button", { name: "Timerdauer ändern", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Gesamtdauer in Minuten").fill("35");
  await dialog
    .getByRole("button", { name: "Dauer speichern", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect((await read(request)).timer?.durationMinutes).toBe(35);
  await page
    .getByRole("button", { name: "Timer fortsetzen", exact: true })
    .click();
  await expect(bar).toContainText("Timer läuft");
  await page
    .getByRole("button", { name: "Timer stoppen", exact: true })
    .click();
  await expect(dialog).toBeVisible();
  expect((await read(request)).timer?.state).toBe("running");
  await dialog
    .getByRole("button", { name: "Timer stoppen", exact: true })
    .click();
  await expect(bar).toHaveCount(0);
  await expect(device.getByRole("complementary")).toHaveCount(0);
  await other.close();
  const todos = (await (await request.get(`${API_URL}/todos`)).json()) as {
    completed: boolean;
    plannedDurationMinutes: number;
  }[];
  expect(todos[0]).toMatchObject({
    completed: false,
    plannedDurationMinutes: 35,
  });
});
test("switching requires confirmation and completing a Dump Todo persists it in Today", async ({
  page,
  request,
}) => {
  await visit(page, "Todo-Dump");
  await createTodo(page, "Erste Aufgabe");
  await createTodo(page, "Zweite Aufgabe");
  await page
    .getByRole("button", {
      name: "Timer für Erste Aufgabe starten",
      exact: true,
    })
    .click();
  const old = (await read(request)).timer!.id;
  await page
    .getByRole("button", {
      name: "Timer für Zweite Aufgabe starten",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Anderen Timer starten?");
  expect((await read(request)).timer?.id).toBe(old);
  await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
  expect((await read(request)).timer?.id).toBe(old);
  await page
    .getByRole("button", {
      name: "Timer für Zweite Aufgabe starten",
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", { name: "Timer wechseln", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("complementary")).toContainText("Zweite Aufgabe");
  await page
    .getByRole("button", { name: "Zweite Aufgabe erledigen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Zweite Aufgabe", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Heute", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Zweite Aufgabe", exact: true }),
  ).toBeVisible();
  await expect(
    page.locator(".planner-item").filter({
      has: page.getByRole("heading", { name: "Zweite Aufgabe", exact: true }),
    }),
  ).toContainText("Erledigt um");
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Zweite Aufgabe", exact: true }),
  ).toBeVisible();
  const rows = (await (await request.get(`${API_URL}/todos`)).json()) as {
    title: string;
    completedAt: string | null;
    scheduledAt: string | null;
  }[];
  expect(rows.find((t) => t.title === "Zweite Aufgabe")).toMatchObject({
    scheduledAt: null,
    completedAt: expect.any(String),
  });
});
test("Habit play availability and occurrence-only timer duration", async ({
  page,
  request,
}) => {
  const date = await today(request);
  for (const [title, startDate] of [
    ["Gitarre", date],
    ["Zukünftig", daysAfter(date, 3)],
  ]) {
    expect(
      (
        await request.post(`${API_URL}/habits`, {
          data: {
            title,
            startDate,
            plannedDurationMinutes: 5,
            schedule: { type: "interval", intervalDays: 1 },
          },
        })
      ).ok(),
    ).toBeTruthy();
  }
  await visit(page, "Habits");
  await expect(
    page.getByRole("button", {
      name: "Timer für Zukünftig: keine offene fällige Ausführung",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Timer für Gitarre starten", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Timer pausieren", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Timerdauer ändern", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("nur an dieser Habit-Ausführung");
  await dialog.getByLabel("Gesamtdauer in Minuten").fill("7");
  await dialog
    .getByRole("button", { name: "Dauer speichern", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  const habits = (await (await request.get(`${API_URL}/habits`)).json()) as {
    title: string;
    plannedDurationMinutes: number;
    timerDurationMinutes: number;
  }[];
  expect(habits.find((h) => h.title === "Gitarre")).toMatchObject({
    plannedDurationMinutes: 5,
    timerDurationMinutes: 7,
  });
});
test("timer bar remains visible during long scrolling and icons have symmetric 44px targets", async ({
  page,
  request,
}) => {
  for (let i = 0; i < 18; i++)
    await request.post(`${API_URL}/todos`, {
      data: { title: `Aufgabe ${i}`, plannedDurationMinutes: 5 },
    });
  await visit(page, "Todo-Dump");
  await page
    .getByRole("button", { name: "Timer für Aufgabe 0 starten", exact: true })
    .click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const bar = page.getByRole("complementary");
  await expect(bar).toBeInViewport();
  for (const button of await bar.locator(".timer-icon").all()) {
    const box = await button.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toEqual(box!.width);
    const svg = await button.locator("svg").boundingBox();
    expect(
      Math.abs(svg!.x + svg!.width / 2 - box!.x - box!.width / 2),
    ).toBeLessThan(1);
    expect(
      Math.abs(svg!.y + svg!.height / 2 - box!.y - box!.height / 2),
    ).toBeLessThan(1);
  }
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

test("a remote replacement closes an old local stop confirmation", async ({
  page,
  request,
}) => {
  await visit(page, "Todo-Dump");
  await createTodo(page, "Erster Timer");
  await createTodo(page, "Zweiter Timer");
  await page
    .getByRole("button", {
      name: "Timer für Erster Timer starten",
      exact: true,
    })
    .click();
  // A click can finish before the start POST has committed. Wait for the
  // authoritative response to render before reading its replacement ID.
  await expect(page.getByRole("complementary")).toContainText("Erster Timer");
  const old = (await read(request)).timer!;
  await page
    .getByRole("button", { name: "Timer stoppen", exact: true })
    .click();
  await expect(page.getByRole("dialog")).toBeVisible();
  const todos = (await (await request.get(`${API_URL}/todos`)).json()) as {
    id: number;
    title: string;
  }[];
  const target = todos.find((t) => t.title === "Zweiter Timer")!;
  expect(
    (
      await request.post(`${API_URL}/timers`, {
        data: { kind: "todo", targetId: target.id, replaceTimerId: old.id },
      })
    ).status(),
  ).toBe(201);
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await expect(page.getByRole("complementary")).toContainText("Zweiter Timer");
  expect((await read(request)).timer?.state).toBe("running");
});
