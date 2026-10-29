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
  const preview = (await (
    await request.get(`${API_URL}/todos/${todo.id}/deletion-preview`)
  ).json()) as { confirmationToken: string };
  expect(
    (
      await request.delete(`${API_URL}/todos/${todo.id}`, {
        data: { confirmationToken: preview.confirmationToken },
      })
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

test("History week: open plans, overdue Todos and weekly targets stay read-only", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const overdueDate = daysAfter(date, -10);
  for (const [title, scheduledAt] of [
    ["Überfälliger Artikel", `${overdueDate}T10:00:00Z`],
    ["Heutiger Termin", `${date}T10:00:00Z`],
  ] as const) {
    expect(
      (
        await request.post(`${API_URL}/todos`, {
          data: { title, scheduledAt, plannedDurationMinutes: 15 },
        })
      ).status(),
    ).toBe(201);
  }
  for (const [title, schedule] of [
    ["Tägliche Gitarre", { type: "interval", intervalDays: 1 }],
    ["Leseziel", { type: "weekly_target", weeklyTarget: 3 }],
  ] as const) {
    expect(
      (
        await request.post(`${API_URL}/habits`, { data: { title, schedule } })
      ).status(),
    ).toBe(201);
  }
  const stored = await request.get(`${API_URL}/habits`);
  const habits = (await stored.json()) as { id: number }[];
  await page.goto("/");
  await history(page);
  await expect(
    page.getByRole("region", { name: "Offen / geplant", exact: true }),
  ).toContainText("Tägliche Gitarre");
  await expect(
    page.getByRole("region", { name: "Wochenziele", exact: true }),
  ).toContainText("Noch 3 von 3 Ausführungen");
  const before = await Promise.all(
    habits.map(async (h) => {
      const result = await request.get(`${API_URL}/habits/${h.id}/occurrences`);
      expect(result.ok()).toBeTruthy();
      return result.json() as Promise<unknown>;
    }),
  );
  await page.getByRole("button", { name: "Woche", exact: true }).click();
  const day = page.locator(`details[data-date="${date}"]`);
  await expect(day.locator("summary")).toContainText("3 offen / geplant");
  await day.locator("summary").click();
  const planned = day.getByRole("region", {
    name: "Offen / geplant",
    exact: true,
  });
  await expect(planned).toContainText(
    `überfällig seit ${overdueDate.split("-").reverse().join(".")}`,
  );
  await expect(planned).toContainText("Tägliche Gitarre");
  await expect(planned.getByRole("button")).toHaveCount(0);
  const targets = page.getByRole("region", {
    name: "Wochenziele",
    exact: true,
  });
  await expect(targets).toContainText("Leseziel");
  await expect(targets).toContainText("Noch 3 von 3 Ausführungen");
  await expect(page.locator(".empty")).toHaveCount(0);
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((el) => el.clientWidth),
  );
  await page.screenshot({
    path: test.info().outputPath("week-open-plans.png"),
    fullPage: true,
  });
  await page.locator('[name="historyFilter"]').selectOption("todos");
  await expect(targets).toHaveCount(0);
  await expect(day.locator("summary")).toContainText("2 offen / geplant");
  await page.locator('[name="historyFilter"]').selectOption("habits");
  await expect(day.locator("summary")).toContainText("1 offen / geplant");
  await expect(targets).toBeVisible();
  await page.locator('[name="historyDate"]').fill(daysAfter(date, -14));
  await expect(page.locator(".planned-item")).toHaveCount(0);
  await expect(targets).toHaveCount(0);
  const after = await Promise.all(
    habits.map(
      async (h) =>
        (
          await request.get(`${API_URL}/habits/${h.id}/occurrences`)
        ).json() as Promise<unknown>,
    ),
  );
  expect(after).toEqual(before);
});

test("History forecast: future date placement, schedule change, pause and deletion", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const later = daysAfter(date, 14);
  const weekDay = new Date(`${later}T12:00:00Z`).getUTCDay();
  const monday = daysAfter(later, -((weekDay + 6) % 7));
  const dates = Array.from({ length: 7 }, (_, index) =>
    daysAfter(monday, index),
  );
  const ids: number[] = [];
  for (const title of [
    "Wechselnder Rhythmus",
    "Pausierter Rhythmus",
    "Gelöschter Rhythmus",
  ]) {
    const result = await request.post(`${API_URL}/habits`, {
      data: { title, schedule: { type: "interval", intervalDays: 1 } },
    });
    expect(result.status()).toBe(201);
    ids.push(((await result.json()) as { id: number }).id);
  }
  expect(
    (
      await request.post(`${API_URL}/habits/${ids[0]}/schedule-changes`, {
        data: {
          effectiveFrom: dates[3],
          schedule: { type: "fixed_weekdays", weekdays: ["friday", "sunday"] },
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.patch(`${API_URL}/habits/${ids[1]}`, {
        data: { isActive: false },
      })
    ).status(),
  ).toBe(200);
  expect(
    (
      await request.delete(`${API_URL}/habits/${ids[2]}`, { data: {} })
    ).status(),
  ).toBe(204);
  expect(
    (
      await request.post(`${API_URL}/todos`, {
        data: {
          title: "Geplanter Artikel",
          scheduledAt: `${dates[1]}T10:00:00Z`,
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/");
  await history(page);
  await page.locator('[name="historyDate"]').fill(monday);
  await page.getByRole("button", { name: "Woche", exact: true }).click();
  await expect(page.locator("details.week-day")).toHaveCount(7);
  const expected = [
    ["Wechselnder Rhythmus"],
    ["Geplanter Artikel", "Wechselnder Rhythmus"],
    ["Wechselnder Rhythmus"],
    [],
    ["Wechselnder Rhythmus"],
    [],
    ["Wechselnder Rhythmus"],
  ];
  for (let index = 0; index < 7; index++) {
    const day = page.locator(`details[data-date="${dates[index]}"]`);
    await day.locator("summary").click();
    await expect(day.locator(".planned-item strong")).toHaveText(
      expected[index]!,
    );
  }
  await expect(page.locator(".week-days")).not.toContainText(
    "Pausierter Rhythmus",
  );
  await expect(page.locator(".week-days")).not.toContainText(
    "Gelöschter Rhythmus",
  );
  await page.locator('[name="historyFilter"]').selectOption("todos");
  await expect(page.locator(".planned-item strong")).toHaveText([
    "Geplanter Artikel",
  ]);
});

test("History day: date placement, filters, overdue plans and completion refresh", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const tomorrow = daysAfter(date, 1);
  const old = daysAfter(date, -10);
  const response = await request.post(`${API_URL}/todos`, {
    data: { title: "Überfälliges Todo", scheduledAt: `${old}T10:00:00Z` },
  });
  expect(response.status()).toBe(201);
  const todo = (await response.json()) as { id: number };
  expect(
    (
      await request.post(`${API_URL}/todos`, {
        data: {
          title: "Morgiger Termin",
          scheduledAt: `${tomorrow}T10:00:00Z`,
        },
      })
    ).status(),
  ).toBe(201);
  const created = await request.post(`${API_URL}/habits`, {
    data: {
      title: "Täglicher Habit",
      schedule: { type: "interval", intervalDays: 1 },
    },
  });
  expect(created.status()).toBe(201);
  const habit = (await created.json()) as { id: number };
  await page.goto("/");
  await history(page);
  const planned = page.getByRole("region", {
    name: "Offen / geplant",
    exact: true,
  });
  await expect(planned.locator(".planned-item strong")).toHaveText([
    "Überfälliges Todo",
    "Täglicher Habit",
  ]);
  await expect(planned).toContainText(
    `überfällig seit ${old.split("-").reverse().join(".")}`,
  );
  await expect(planned.getByRole("button")).toHaveCount(0);
  const before = (await (
    await request.get(`${API_URL}/habits/${habit.id}/occurrences`)
  ).json()) as unknown;
  await page.locator('[name="historyDate"]').fill(tomorrow);
  await expect(planned.locator(".planned-item strong")).toHaveText([
    "Morgiger Termin",
    "Täglicher Habit",
  ]);
  await expect(planned).not.toContainText("überfällig");
  await page.locator('[name="historyFilter"]').selectOption("todos");
  await expect(planned.locator(".planned-item strong")).toHaveText([
    "Morgiger Termin",
  ]);
  await page.locator('[name="historyFilter"]').selectOption("habits");
  await expect(planned.locator(".planned-item strong")).toHaveText([
    "Täglicher Habit",
  ]);
  await expect(page.locator(".empty")).toHaveCount(0);
  expect(
    await (
      await request.get(`${API_URL}/habits/${habit.id}/occurrences`)
    ).json(),
  ).toEqual(before);
  await page.locator('[name="historyFilter"]').selectOption("all");
  await page.locator('[name="historyDate"]').fill(date);
  expect(
    (
      await request.patch(`${API_URL}/todos/${todo.id}`, {
        data: { completed: true },
      })
    ).status(),
  ).toBe(200);
  await page
    .getByRole("button", { name: "Aktualisieren", exact: true })
    .click();
  await expect(planned.locator(".planned-item strong")).toHaveText([
    "Täglicher Habit",
  ]);
  await expect(
    page.getByRole("region", { name: "Erledigt", exact: true }),
  ).toContainText("Überfälliges Todo");
  await page.screenshot({
    path: test.info().outputPath("day-open-plans.png"),
    fullPage: true,
  });
  await page.locator('[name="historyDate"]').fill(daysAfter(date, -14));
  await expect(planned).toHaveCount(0);
  await expect(page.locator(".empty")).toBeVisible();
});
