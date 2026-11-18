import { test, expect } from "./fixtures";
import {
  visit,
  createTodo,
  daysAfter,
  today,
  openView,
  showResolved,
  timerBarAction,
} from "./helpers";
import { API_URL } from "./environment";
import type { TimerResponse } from "../src/api/timers.api";
const read = async (request: import("@playwright/test").APIRequestContext) => {
  const r = await request.get(`${API_URL}/timers/current`);
  expect(r.ok()).toBeTruthy();
  return (await r.json()) as TimerResponse;
};
test("Quest timer: direct play, sticky bar, reload, second device, pause/target/resume/stop", async ({
  page,
  request,
  context,
  browser,
}) => {
  await visit(page, "Questlog");
  await createTodo(page, "Schreiben");
  await page
    .getByRole("button", {
      name: "Stoppuhr für Schreiben starten",
      exact: true,
    })
    .click();
  const bar = page.getByRole("complementary", { name: "Aktuelle Stoppuhr" });
  await expect(bar).toContainText("Stoppuhr läuft");
  expect((await read(request)).timer?.targetMinutes).toBe(30);
  await page.reload();
  await expect(bar).toContainText("Schreiben");
  await openView(page, "Dailies");
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
    .getByRole("button", { name: "Stoppuhr pausieren", exact: true })
    .click();
  await expect(bar).toContainText("Pausiert");
  await expect(device.getByRole("complementary")).toContainText("Pausiert");
  await timerBarAction(page, "Soll ändern");
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Geplante Minuten").fill("35");
  await dialog
    .getByRole("button", { name: "Soll speichern", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  expect((await read(request)).timer?.targetMinutes).toBe(35);
  await page
    .getByRole("button", { name: "Stoppuhr fortsetzen", exact: true })
    .click();
  await expect(bar).toContainText("Stoppuhr läuft");
  // Ending needs no confirmation: the time worked is in the logbook.
  await timerBarAction(page, "Stoppuhr beenden");
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
test("switching requires confirmation and completing a Questlog Quest persists it in Today", async ({
  page,
  request,
}) => {
  await visit(page, "Questlog");
  await createTodo(page, "Erste Quest");
  await createTodo(page, "Zweite Quest");
  await page
    .getByRole("button", {
      name: "Stoppuhr für Erste Quest starten",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Aktuelle Stoppuhr" }),
  ).toContainText("Erste Quest");
  const old = (await read(request)).timer!.id;
  await page
    .getByRole("button", {
      name: "Stoppuhr für Zweite Quest starten",
      exact: true,
    })
    .click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("Andere Stoppuhr starten?");
  expect((await read(request)).timer?.id).toBe(old);
  await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
  expect((await read(request)).timer?.id).toBe(old);
  await page
    .getByRole("button", {
      name: "Stoppuhr für Zweite Quest starten",
      exact: true,
    })
    .click();
  await dialog
    .getByRole("button", { name: "Stoppuhr wechseln", exact: true })
    .click();
  await expect(dialog).not.toBeVisible();
  await expect(page.getByRole("complementary")).toContainText("Zweite Quest");
  // The bar completes what its stopwatch runs on, from any view.
  await timerBarAction(page, "Zweite Quest erledigen");
  await expect(
    page.getByRole("heading", { name: "Zweite Quest", exact: true }),
  ).toHaveCount(0);
  await expect(page.getByRole("complementary")).toHaveCount(0);
  await openView(page, "Heute");
  await showResolved(page);
  await expect(
    page.getByRole("heading", { name: "Zweite Quest", exact: true }),
  ).toBeVisible();
  await page.reload();
  await showResolved(page);
  await expect(
    page.getByRole("heading", { name: "Zweite Quest", exact: true }),
  ).toBeVisible();
  const rows = (await (await request.get(`${API_URL}/todos`)).json()) as {
    title: string;
    completedAt: string | null;
    scheduledDate: string | null;
  }[];
  expect(rows.find((t) => t.title === "Zweite Quest")).toMatchObject({
    scheduledDate: null,
    completedAt: expect.any(String),
  });
});
test("Daily play availability and occurrence-only timer duration", async ({
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
  await visit(page, "Dailies");
  await expect(
    page.getByRole("button", {
      name: "Stoppuhr für Zukünftig: keine offene fällige Ausführung",
      exact: true,
    }),
  ).toBeDisabled();
  await page
    .getByRole("button", { name: "Stoppuhr für Gitarre starten", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Stoppuhr pausieren", exact: true })
    .click();
  await timerBarAction(page, "Soll ändern");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("nur an dieser Daily-Ausführung");
  await dialog.getByLabel("Geplante Minuten").fill("7");
  await dialog
    .getByRole("button", { name: "Soll speichern", exact: true })
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
      data: { title: `Quest ${i}`, plannedDurationMinutes: 5 },
    });
  await visit(page, "Questlog");
  await page
    .getByRole("button", { name: "Stoppuhr für Quest 0 starten", exact: true })
    .click();
  await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
  const bar = page.getByRole("complementary");
  await expect(bar).toBeInViewport();
  // The phone keeps the rarer steps in the bar's menu; measure what shows.
  for (const button of await bar.locator(".timer-icon:visible").all()) {
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

test("a remote replacement closes an old local target dialog", async ({
  page,
  request,
}) => {
  await visit(page, "Questlog");
  await createTodo(page, "Erster Timer");
  await createTodo(page, "Zweiter Timer");
  await page
    .getByRole("button", {
      name: "Stoppuhr für Erster Timer starten",
      exact: true,
    })
    .click();
  // A click can finish before the start POST has committed. Wait for the
  // authoritative response to render before reading its replacement ID.
  await expect(page.getByRole("complementary")).toContainText("Erster Timer");
  const old = (await read(request)).timer!;
  await timerBarAction(page, "Soll ändern");
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
