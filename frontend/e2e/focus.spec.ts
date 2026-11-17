import { today } from "./helpers";
import { test, expect } from "./fixtures";
import { API_URL } from "./environment";
import type { APIRequestContext } from "@playwright/test";
import type { TimerResponse } from "../src/api/timers.api";

const plan = async (request: APIRequestContext, data: object) => {
  const response = await request.post(`${API_URL}/todos`, { data });
  expect(response.status()).toBe(201);
  return (await response.json()) as { id: number };
};
const timer = async (request: APIRequestContext) =>
  ((await (await request.get(`${API_URL}/timers/current`)).json()) as TimerResponse)
    .timer;

test("Fokus-Modus: one quest in view, stopwatch into the logbook, done brings the next", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const campaign = await plan(request, {
    title: "Buch schreiben",
    why: "Mein Wissen weitergeben",
  });
  // No planned duration: the stopwatch runs without a target.
  await plan(request, {
    title: "Kapitel schreiben",
    parentId: campaign.id,
    scheduledDate: date,
  });
  await plan(request, { title: "Einkaufen", scheduledDate: date });

  await page.goto("/");
  await page.getByRole("link", { name: "Fokus-Modus", exact: true }).click();
  await expect(page).toHaveURL(/#\/fokus$/);
  await expect(page).toHaveTitle("Fokus · Habit Tracker");
  // The view stands alone: no navigation, no timer bar.
  await expect(page.getByRole("navigation")).toHaveCount(0);

  const heading = page.getByRole("heading", { level: 1 });
  const stopwatch = page.getByRole("timer", { name: "Gearbeitete Zeit" });
  await expect(heading).toHaveText("Kapitel schreiben");
  await expect(page.getByText("Buch schreiben", { exact: true })).toBeVisible();
  await expect(page.getByText("Mein Wissen weitergeben")).toBeVisible();
  await expect(stopwatch).toHaveText("00:00");
  await expect(page.getByText("Einkaufen")).toBeVisible();

  await page.getByRole("button", { name: "Starten", exact: true }).click();
  await expect(page.getByText("Läuft", { exact: true })).toBeVisible();
  await expect(stopwatch).not.toHaveText("00:00");
  await expect(page.getByRole("complementary")).toHaveCount(0);
  expect(await timer(request)).toMatchObject({
    state: "running",
    title: "Kapitel schreiben",
    targetMinutes: null,
  });

  await page.getByRole("button", { name: "Pausieren", exact: true }).click();
  await expect(page.getByText("Pausiert", { exact: true })).toBeVisible();
  const logs = (
    (await (
      await request.get(`${API_URL}/work-logs?date=${date}`)
    ).json()) as { logs: { title: string; source: string }[] }
  ).logs;
  expect(logs).toEqual([
    expect.objectContaining({ title: "Kapitel schreiben", source: "timer" }),
  ]);

  await page
    .getByRole("button", { name: "Kapitel schreiben erledigen", exact: true })
    .click();
  await expect(heading).toHaveText("Einkaufen");
  await expect(stopwatch).toHaveText("00:00");
  expect(await timer(request)).toBeNull();

  await page
    .getByRole("button", { name: "Einkaufen erledigen", exact: true })
    .click();
  await expect(heading).toHaveText("Alles erledigt");
  await page.getByRole("link", { name: "Zurück zu Heute" }).click();
  await expect(page).toHaveURL(/#\/heute$/);
  await expect(page.getByRole("navigation")).toBeVisible();
});

test("Fokus-Modus: 'Später' puts a quest behind the rest; keys start it and lead back", async ({
  page,
  request,
}) => {
  const date = await today(request);
  for (const title of ["Erstes", "Zweites", "Drittes"])
    await plan(request, { title, scheduledDate: date });
  await page.goto("/#/fokus");
  const heading = page.getByRole("heading", { level: 1 });
  await expect(heading).toHaveText("Erstes");

  await page.getByRole("button", { name: "Später", exact: true }).click();
  await expect(heading).toHaveText("Zweites");
  const order = (
    (await (await request.get(`${API_URL}/day-planner/today`)).json()) as {
      items: { title: string }[];
    }
  ).items.map(({ title }) => title);
  expect(order).toEqual(["Zweites", "Drittes", "Erstes"]);

  // Space starts the stopwatch when no control has the focus.
  await page.locator("main").focus();
  await page.keyboard.press("Space");
  await expect(page.getByText("Läuft", { exact: true })).toBeVisible();
  expect((await timer(request))?.title).toBe("Zweites");

  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(/#\/heute$/);
  // Back in the app, the running stopwatch shows in the bar again.
  await expect(
    page.getByRole("complementary", { name: "Aktueller Timer" }),
  ).toContainText("Zweites");
});
