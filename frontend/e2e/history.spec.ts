import { test, expect } from "./fixtures";
import { createTodo, today, visit, daysAfter } from "./helpers";
import { API_URL } from "./environment";
import type { HistoryResponse } from "../src/types/history";

async function history(page: import("@playwright/test").Page) {
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Verlauf", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Verlauf", exact: true }),
  ).toBeVisible();
  await expect(page.getByRole("status")).toHaveCount(0);
}

test("History: a completed Dump Todo has no invented schedule, persists, and disappears after reopen", async ({
  page,
  request,
}) => {
  const date = await today(request);
  await visit(page, "Todo-Dump");
  await createTodo(page, "Ideen sammeln");
  await page
    .getByRole("button", { name: "Ideen sammeln erledigen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ideen sammeln", exact: true }),
  ).toHaveCount(0);
  await history(page);
  const card = page
    .locator(".history-item")
    .filter({ hasText: "Ideen sammeln" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Aus dem Todo-Dump");
  await expect(card).toContainText("Erledigt um");
  await expect(card).not.toContainText("Geplant für");
  await expect(page.locator('[name="historyDate"]')).toHaveValue(date);
  await expect(card.getByRole("button")).toHaveCount(0);
  await page.reload();
  await history(page);
  await expect(card).toBeVisible();
  await page
    .getByRole("navigation")
    .getByRole("button", { name: "Heute", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Ideen sammeln wieder öffnen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ideen sammeln", exact: true }),
  ).toHaveCount(0);
  await history(page);
  await expect(card).toHaveCount(0);
  await expect(page.locator(".empty")).toContainText("keine Einträge");
});

test("History: automatic skips stay on planned days; completed and deleted Habits remain in the read-only history", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const earlier = daysAfter(date, -4);
  const result = await request.post(`${API_URL}/habits`, {
    data: {
      title: "Joggen",
      startDate: earlier,
      schedule: {
        type: "interval",
        intervalDays: 2,
        missedOccurrencePolicy: "skip",
      },
    },
  });
  expect(result.status()).toBe(201);
  const habit = (await result.json()) as { id: number };
  const dueResponse = await request.get(`${API_URL}/habit-occurrences/today`);
  const occurrences = (await dueResponse.json()) as {
    id: number;
    habitId: number;
    status: string;
  }[];
  const pending = occurrences.find(
    (item) => item.habitId === habit.id && item.status === "pending",
  )!;
  expect(pending).toBeTruthy();
  expect(
    (
      await request.patch(`${API_URL}/habit-occurrences/${pending.id}/status`, {
        data: { status: "completed" },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.delete(`${API_URL}/habits/${habit.id}`, { data: {} })
    ).status(),
  ).toBe(204);
  await page.goto("/");
  await history(page);
  await expect(
    page
      .getByRole("region", { name: "Erledigt", exact: true })
      .getByText("Joggen", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".history-item")).toContainText("Gelöscht");
  await page.locator('[name="historyDate"]').fill(earlier);
  const skips = page.getByRole("region", { name: "Übersprungen", exact: true });
  await expect(skips.getByText("Joggen", { exact: true })).toBeVisible();
  await expect(skips).toContainText(
    `Geplant für ${earlier.split("-").reverse().join(".")}`,
  );
  const before = await request.get(
    `${API_URL}/history?date=${earlier}&view=week`,
  );
  await page.getByRole("button", { name: "Woche", exact: true }).click();
  await expect(page.locator("details.week-day")).toHaveCount(7);
  await page.locator('[name="historyFilter"]').selectOption("todos");
  await expect(page.locator(".empty")).toBeVisible();
  const after = await request.get(
    `${API_URL}/history?date=${earlier}&view=week`,
  );
  expect(await after.json()).toEqual(await before.json());
});

test("History: Monday-first weekly navigation, filters, expandable days and soft-deleted Todos", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const created = await request.post(`${API_URL}/todos`, {
    data: {
      title: "Abgeschlossener Artikel",
      plannedDurationMinutes: 15,
      scheduledAt: `${daysAfter(date, -2)}T10:00:00Z`,
    },
  });
  const todo = (await created.json()) as { id: number };
  expect(
    (
      await request.patch(`${API_URL}/todos/${todo.id}`, {
        data: { completed: true },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.delete(`${API_URL}/todos/${todo.id}`, { data: {} })
    ).status(),
  ).toBe(204);
  await page.goto("/");
  await history(page);
  await expect(page.locator(".history-item")).toContainText("Gelöscht");
  await expect(page.locator(".history-item")).toContainText("Geplant für");
  await page.getByRole("button", { name: "Woche", exact: true }).click();
  await expect(page.locator("details.week-day")).toHaveCount(7);
  await expect(page.locator("summary").first()).toContainText("Montag");
  await expect(page.locator("summary").last()).toContainText("Sonntag");
  const day = page.locator(`details[data-date="${date}"]`);
  await day.locator("summary").click();
  await expect(day).toContainText("1 Todo erledigt");
  await expect(
    day.getByRole("heading", { name: "Abgeschlossener Artikel", exact: true }),
  ).toBeVisible();
  await day.getByRole("button", { name: "Tag öffnen", exact: true }).click();
  await expect(
    page.getByRole("button", { name: "Tag", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[name="historyDate"]')).toHaveValue(date);
  await page.getByRole("button", { name: "Vorheriger Zeitraum" }).click();
  await expect(page.locator('[name="historyDate"]')).toHaveValue(
    daysAfter(date, -1),
  );
  await expect(page.locator(".empty")).toBeVisible();
  await page.getByRole("button", { name: "Heute", exact: true }).last().click();
  await expect(page.locator(".history-item")).toBeVisible();
  await page.locator('[name="historyFilter"]').selectOption("habits");
  await expect(page.locator(".empty")).toContainText("für diesen Filter");
  await page.locator('[name="historyFilter"]').selectOption("todos");
  await expect(page.locator(".history-item")).toBeVisible();
  const api = await request.get(`${API_URL}/history?date=${date}`);
  expect(
    ((await api.json()) as HistoryResponse).days[0]!.items[0]!.scheduledDate,
  ).toBe(daysAfter(date, -2));
});

test("History: error retry and logout do not retain private results", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await context.route("**/api/history?**", (route) =>
    route.fulfill({
      status: 503,
      contentType: "application/json",
      body: JSON.stringify({ message: "Verlauf nicht erreichbar" }),
    }),
  );
  await history(page);
  await expect(page.getByRole("alert")).toContainText(
    "Verlauf nicht erreichbar",
  );
  await context.unroute("**/api/history?**");
  await page
    .getByRole("button", { name: "Erneut versuchen", exact: true })
    .click();
  await expect(page.locator(".empty")).toBeVisible();
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Willkommen zurück" }),
  ).toBeVisible();
  await expect(page.locator(".history-view")).toHaveCount(0);
});
