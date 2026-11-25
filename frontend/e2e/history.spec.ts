import { test, expect } from "./fixtures";
import {
  createTodo,
  today,
  visit,
  daysAfter,
  openView,
  showResolved,
  openCalendar,
  filterCalendar,
  shortDate,
  dayLabel,
} from "./helpers";
import { API_URL } from "./environment";
import type { HistoryResponse } from "../src/types/history";

test("Calendar day: a completed Questlog Quest has no invented schedule, persists, and disappears after reopen", async ({
  page,
  request,
}) => {
  const date = await today(request);
  await visit(page, "Questlog");
  await createTodo(page, "Ideen sammeln");
  await page
    .getByRole("button", { name: "Ideen sammeln erledigen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ideen sammeln", exact: true }),
  ).toHaveCount(0);
  await openCalendar(page, "Tag");
  const card = page
    .locator(".history-item")
    .filter({ hasText: "Ideen sammeln" });
  await expect(card).toBeVisible();
  await expect(card).toContainText("Aus dem Questlog");
  await expect(card).toContainText("Erledigt um");
  await expect(card).not.toContainText("Geplant für");
  await expect(page.locator('[name="historyDate"]')).toHaveValue(date);
  await expect(card.getByRole("button")).toHaveCount(0);
  await page.reload();
  await openCalendar(page, "Tag");
  await expect(card).toBeVisible();
  await openView(page, "Heute");
  await showResolved(page);
  await page
    .getByRole("button", { name: "Ideen sammeln wieder öffnen", exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "Ideen sammeln", exact: true }),
  ).toHaveCount(0);
  await openCalendar(page, "Tag");
  await expect(card).toHaveCount(0);
  await expect(page.locator(".empty-state")).toContainText(
    "Für diesen Zeitraum gibt es nichts.",
  );
});

test("Calendar day: automatic skips stay on planned days; completed and deleted Dailies remain in the read-only history", async ({
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
  await openCalendar(page, "Tag");
  await expect(
    page
      .getByRole("region", { name: "Erledigt", exact: true })
      .getByText("Joggen", { exact: true }),
  ).toBeVisible();
  await expect(page.locator(".history-item")).toContainText("Gelöscht");
  await page.locator('[name="historyDate"]').fill(earlier);
  const skips = page.getByRole("region", { name: "Übersprungen", exact: true });
  await expect(skips.getByText("Joggen", { exact: true })).toBeVisible();
  // A skip stays on its planned day, so no extra "Geplant für" line.
  await expect(skips).toContainText("Übersprungen");
  await expect(skips).not.toContainText("Geplant für");
  const before = await request.get(
    `${API_URL}/history?date=${earlier}&view=week`,
  );
  await page.getByRole("button", { name: "Woche", exact: true }).click();
  await expect(page.locator(".week-head")).toHaveCount(7);
  await filterCalendar(page, "Quests");
  await expect(page.locator(".empty-state")).toBeVisible();
  const after = await request.get(
    `${API_URL}/history?date=${earlier}&view=week`,
  );
  expect(await after.json()).toEqual(await before.json());
});

test("Calendar: month opens a day, Monday-first week rows, filters and soft-deleted Quests", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const created = await request.post(`${API_URL}/todos`, {
    data: {
      title: "Abgeschlossener Artikel",
      plannedDurationMinutes: 15,
      scheduledDate: daysAfter(date, -2),
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
  const view = await openCalendar(page);
  // The head stays short: no "Heute" while today is shown, the filter a quiet icon.
  await expect(
    view.getByRole("button", { name: "Heute", exact: true }),
  ).toHaveCount(0);
  await expect(
    view.getByRole("button", { name: "Einträge: Alle", exact: true }),
  ).toHaveText("");
  // Monat is the default, with today selected.
  const cell = view.locator(`.month-day[data-date="${date}"]`);
  await expect(cell).toHaveAttribute("aria-pressed", "true");
  await expect(cell).toHaveAttribute("aria-label", /1 erledigt/);
  await expect(view.locator(".selected-day .history-item")).toContainText(
    "Abgeschlossener Artikel",
  );
  await view
    .getByRole("button", { name: `Tag öffnen: ${dayLabel(date)}`, exact: true })
    .click();
  await expect(
    view.getByRole("button", { name: "Tag", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(".history-item")).toContainText("Gelöscht");
  await expect(page.locator(".history-item")).toContainText("Geplant für");
  await view.getByRole("button", { name: "Woche", exact: true }).click();
  await expect(page.locator(".week-head")).toHaveCount(7);
  // Seven day columns on one hour axis, Monday first.
  await expect(page.locator(".week-head").first()).toHaveAccessibleName(
    /^Montag, /,
  );
  await expect(page.locator(".week-head").last()).toHaveAccessibleName(
    /^Sonntag, /,
  );
  await expect(page.locator(".week-column")).toHaveCount(7);
  const day = page.locator(`.week-head[data-date="${date}"]`);
  // The head names what the day holds without a time; the sentence counts it.
  await expect(day.locator(".week-head__summary")).toHaveText("1 Quest");
  await expect(day).toHaveAccessibleDescription(/1 von 1 erledigt/);
  await page
    .getByRole("button", { name: `${dayLabel(date)} öffnen`, exact: true })
    .click();
  await expect(
    view.getByRole("button", { name: "Tag", exact: true }),
  ).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator('[name="historyDate"]')).toHaveValue(date);
  await expect(
    page.getByRole("heading", { name: "Abgeschlossener Artikel", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Voriger Zeitraum" }).click();
  await expect(page.locator('[name="historyDate"]')).toHaveValue(
    daysAfter(date, -1),
  );
  await expect(page.locator(".empty-state")).toBeVisible();
  await view.getByRole("button", { name: "Heute", exact: true }).click();
  await expect(page.locator(".history-item")).toBeVisible();
  await filterCalendar(page, "Dailies");
  await expect(page.locator(".empty-state")).toContainText(
    "Gezeigt werden nur Dailies.",
  );
  await filterCalendar(page, "Quests");
  await expect(page.locator(".history-item")).toBeVisible();
  const api = await request.get(`${API_URL}/history?date=${date}`);
  expect(
    ((await api.json()) as HistoryResponse).days[0]!.items[0]!.scheduledDate,
  ).toBe(daysAfter(date, -2));
});

test("Calendar: error retry and logout do not retain private results", async ({
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
  await openCalendar(page);
  await expect(page.getByRole("alert")).toContainText(
    "Verlauf nicht erreichbar",
  );
  await context.unroute("**/api/history?**");
  await page
    .getByRole("button", { name: "Erneut versuchen", exact: true })
    .click();
  await expect(page.locator(".month-day")).not.toHaveCount(0);
  await openView(page, "Einstellungen");
  await page.getByRole("button", { name: "Abmelden", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "Willkommen zurück" }),
  ).toBeVisible();
  await expect(page.locator(".calendar-view")).toHaveCount(0);
});

test("Calendar week: open plans, overdue Quests and weekly targets stay calm", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const overdueDate = daysAfter(date, -10);
  for (const [title, scheduledDate] of [
    ["Überfälliger Artikel", overdueDate],
    ["Heutiger Termin", date],
  ] as const) {
    expect(
      (
        await request.post(`${API_URL}/todos`, {
          data: { title, scheduledDate, plannedDurationMinutes: 15 },
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
  const view = await openCalendar(page, "Tag");
  const planned = page.getByRole("region", {
    name: "Offen / geplant",
    exact: true,
  });
  const targets = page.getByRole("region", {
    name: "Wochenziele",
    exact: true,
  });
  await expect(planned).toContainText("Tägliche Gitarre");
  await expect(targets).toContainText("0 von 3 erledigt · noch 3");
  const before = await Promise.all(
    habits.map(async (h) => {
      const result = await request.get(`${API_URL}/habits/${h.id}/occurrences`);
      expect(result.ok()).toBeTruthy();
      return result.json() as Promise<unknown>;
    }),
  );
  await view.getByRole("button", { name: "Woche", exact: true }).click();
  const day = page.locator(`.week-head[data-date="${date}"]`);
  // Counted like Heute: today's own (with the weekly target's run Heute
  // lists) and, apart, what waits from an earlier day.
  await expect(day).toHaveAccessibleDescription(
    /^0 von 3 erledigt · 1 von früher/,
  );
  await expect(day.locator(".week-head__summary")).toContainText(
    "1 von früher",
  );
  await expect(targets).toContainText("Leseziel");
  await expect(targets).toContainText("0 von 3 erledigt · noch 3");
  await expect(targets).not.toContainText("Gültig");
  await day.click();
  const earlier = page.getByRole("region", { name: "Von früher", exact: true });
  await expect(earlier).toContainText(
    `noch offen seit ${shortDate(overdueDate)}`,
  );
  await expect(earlier).not.toContainText("überfällig");
  await expect(planned).not.toContainText("noch offen seit");
  await expect(planned).toContainText("Tägliche Gitarre");
  // Open quests and today's Daily runs get the ring, as on Heute.
  await expect(planned.getByRole("button", { name: /erledigen$/ })).toHaveCount(
    3,
  );
  await expect(
    planned.getByRole("button", {
      name: "Tägliche Gitarre erledigen",
      exact: true,
    }),
  ).toHaveCount(1);
  await expect(earlier.getByRole("button", { name: /erledigen$/ })).toHaveCount(
    1,
  );
  // Moving sits in the row's menu, not on a lone button.
  await earlier
    .getByRole("button", {
      name: "Aktionen für Überfälliger Artikel",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("menuitem", {
      name: "Überfälliger Artikel verschieben",
      exact: true,
    }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".empty-state")).toHaveCount(0);
  await expect(page.locator("body")).toHaveJSProperty(
    "scrollWidth",
    await page.locator("body").evaluate((el) => el.clientWidth),
  );
  await page.screenshot({
    path: test.info().outputPath("day-open-plans.png"),
    fullPage: true,
  });
  await view.getByRole("button", { name: "Woche", exact: true }).click();
  await page.screenshot({
    path: test.info().outputPath("week-open-plans.png"),
    fullPage: true,
  });
  await filterCalendar(page, "Quests");
  await expect(targets).toHaveCount(0);
  await expect(day).toHaveAccessibleDescription(
    /^0 von 1 erledigt · 1 von früher/,
  );
  await filterCalendar(page, "Dailies");
  await expect(day).toHaveAccessibleDescription(/^0 von 2 erledigt/);
  await expect(targets).toBeVisible();
  await page.locator('[name="historyDate"]').fill(daysAfter(date, -14));
  await expect(page.locator(".week-head")).toHaveCount(0);
  await expect(page.locator(".empty-state")).toBeVisible();
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

test("Calendar forecast: future date placement, schedule change, pause and deletion", async ({
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
          scheduledDate: dates[1],
        },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/");
  const view = await openCalendar(page, "Woche");
  await page.locator('[name="historyDate"]').fill(monday);
  await expect(page.locator(".week-head")).toHaveCount(7);
  const expected = [
    ["Wechselnder Rhythmus"],
    ["Geplanter Artikel", "Wechselnder Rhythmus"],
    ["Wechselnder Rhythmus"],
    [],
    ["Wechselnder Rhythmus"],
    [],
    ["Wechselnder Rhythmus"],
  ];
  // The head names quests and Dailies without a time; the sentence counts the day.
  const untimed = [
    "1 Daily",
    "1 Quest · 1 Daily",
    "1 Daily",
    null,
    "1 Daily",
    null,
    "1 Daily",
  ];
  for (let index = 0; index < 7; index++) {
    const head = page.locator(`.week-head[data-date="${dates[index]}"]`);
    const line = untimed[index];
    if (line)
      await expect(head.locator(".week-head__summary")).toHaveText(line);
    else await expect(head.locator(".week-head__summary")).toHaveCount(0);
    await expect(head).toHaveAccessibleDescription(
      expected[index]!.length
        ? `${expected[index]!.length} geplant`
        : "Nichts geplant",
    );
  }
  await page
    .getByRole("button", { name: `${dayLabel(monday)} öffnen`, exact: true })
    .click();
  for (let index = 0; index < 7; index++) {
    await expect(page.locator('[name="historyDate"]')).toHaveValue(
      dates[index]!,
    );
    await expect(page.locator(".planned-item h3")).toHaveText(expected[index]!);
    if (expected[index]!.length)
      await expect(
        page
          .locator(".planned-item")
          .filter({ hasText: "Wechselnder Rhythmus" }),
      ).toContainText("voraussichtlich");
    await expect(view).not.toContainText("Pausierter Rhythmus");
    await expect(view).not.toContainText("Gelöschter Rhythmus");
    if (index < 6)
      await page.getByRole("button", { name: "Nächster Zeitraum" }).click();
  }
  await page.locator('[name="historyDate"]').fill(dates[1]!);
  await filterCalendar(page, "Quests");
  await expect(page.locator(".planned-item h3")).toHaveText([
    "Geplanter Artikel",
  ]);
});

test("Calendar day: date placement, filters, overdue plans and completion refresh", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const tomorrow = daysAfter(date, 1);
  const old = daysAfter(date, -10);
  const response = await request.post(`${API_URL}/todos`, {
    data: { title: "Überfälliges Quest", scheduledDate: old },
  });
  expect(response.status()).toBe(201);
  const todo = (await response.json()) as { id: number };
  expect(
    (
      await request.post(`${API_URL}/todos`, {
        data: {
          title: "Morgiger Termin",
          scheduledDate: tomorrow,
        },
      })
    ).status(),
  ).toBe(201);
  const created = await request.post(`${API_URL}/habits`, {
    data: {
      title: "Täglicher Daily",
      schedule: { type: "interval", intervalDays: 1 },
    },
  });
  expect(created.status()).toBe(201);
  const habit = (await created.json()) as { id: number };
  await page.goto("/");
  await openCalendar(page, "Tag");
  const planned = page.getByRole("region", {
    name: "Offen / geplant",
    exact: true,
  });
  // What waits from an earlier day stands apart, like Heute's Nachholen.
  const earlier = page.getByRole("region", { name: "Von früher", exact: true });
  await expect(planned.locator(".planned-item h3")).toHaveText([
    "Täglicher Daily",
  ]);
  await expect(earlier.locator(".planned-item h3")).toHaveText([
    "Überfälliges Quest",
  ]);
  await expect(earlier).toContainText(`noch offen seit ${shortDate(old)}`);
  // The open quest and today's Daily run have their ring, as on Heute.
  await expect(
    earlier.getByRole("button", {
      name: "Überfälliges Quest erledigen",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    planned.getByRole("button", {
      name: "Täglicher Daily erledigen",
      exact: true,
    }),
  ).toBeVisible();
  const before = (await (
    await request.get(`${API_URL}/habits/${habit.id}/occurrences`)
  ).json()) as unknown;
  await page.locator('[name="historyDate"]').fill(tomorrow);
  await expect(planned.locator(".planned-item h3")).toHaveText([
    "Morgiger Termin",
    "Täglicher Daily",
  ]);
  await expect(planned).not.toContainText("noch offen seit");
  // Future days have no reflection or time logging.
  await expect(page.locator("form.day-reflection")).toHaveCount(0);
  await filterCalendar(page, "Quests");
  await expect(planned.locator(".planned-item h3")).toHaveText([
    "Morgiger Termin",
  ]);
  await filterCalendar(page, "Dailies");
  await expect(planned.locator(".planned-item h3")).toHaveText([
    "Täglicher Daily",
  ]);
  await expect(page.locator(".empty-state")).toHaveCount(0);
  expect(
    await (
      await request.get(`${API_URL}/habits/${habit.id}/occurrences`)
    ).json(),
  ).toEqual(before);
  await filterCalendar(page, "Alle");
  await page.locator('[name="historyDate"]').fill(date);
  expect(
    (
      await request.patch(`${API_URL}/todos/${todo.id}`, {
        data: { completed: true },
      })
    ).status(),
  ).toBe(200);
  // There is no refresh button: opening the view again loads fresh data.
  await openView(page, "Heute");
  await openCalendar(page, "Tag");
  await expect(planned.locator(".planned-item h3")).toHaveText([
    "Täglicher Daily",
  ]);
  await expect(
    page.getByRole("region", { name: "Erledigt", exact: true }),
  ).toContainText("Überfälliges Quest");
  await page.screenshot({
    path: test.info().outputPath("day-open-plans.png"),
    fullPage: true,
  });
  await page.locator('[name="historyDate"]').fill(daysAfter(date, -14));
  await expect(planned).toHaveCount(0);
  await expect(page.locator(".empty-state")).toBeVisible();
});

test("Calendar day: reflection saves only after a change and time is logged in the Logbuch", async ({
  page,
  request,
}) => {
  const date = await today(request);
  expect(
    (
      await request.post(`${API_URL}/todos`, {
        data: { title: "Schreibzeit", scheduledDate: date },
      })
    ).status(),
  ).toBe(201);
  await page.goto("/");
  const view = await openCalendar(page, "Tag");
  const reflection = view.locator("form.day-reflection");
  await expect(
    reflection.getByRole("button", { name: "Speichern", exact: true }),
  ).toHaveCount(0);
  await reflection.getByLabel("Reflexion").fill("Ruhiger Tag");
  await reflection
    .getByRole("button", { name: "Speichern", exact: true })
    .click();
  // Its own status line (the microphone has one of its own).
  await expect(reflection.locator(".day-reflection__saved")).toHaveText(
    "Gespeichert",
  );
  await page.reload();
  await openCalendar(page, "Tag");
  await expect(reflection.getByLabel("Reflexion")).toHaveValue("Ruhiger Tag");

  const logbook = view.getByRole("region", { name: /^Logbuch/ });
  await logbook
    .getByRole("button", { name: "Zeit nachtragen", exact: true })
    .click();
  const dialog = page.getByRole("dialog", { name: "Zeit nachtragen" });
  await dialog
    .locator('[name="target"]')
    .selectOption({ label: "Schreibzeit" });
  // Early in the day, so the end is never in the future.
  await dialog.locator('[name="from"]').fill("00:00");
  await dialog.locator('[name="to"]').fill("00:01");
  await dialog.getByRole("button", { name: "Nachtragen", exact: true }).click();
  // Saved, the dialog closes and the stretch stands on the day's column.
  await expect(dialog).toHaveCount(0);
  await expect(
    logbook
      .getByRole("list", { name: "Zeitachse", exact: true })
      .getByRole("button", { name: /^Schreibzeit, 00:00 bis 00:01, 1 Min\./ }),
  ).toBeVisible();
  await expect(logbook.getByRole("heading", { level: 2 })).toHaveText(
    "Logbuch 1 Min.",
  );
});

test("Calendar day: sorted like Heute, counted like Heute, and Dailies are ticked with undo", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const quest = async (data: object) => {
    const response = await request.post(`${API_URL}/todos`, { data });
    expect(response.status()).toBe(201);
    return (await response.json()) as { id: number };
  };
  const zebra = await quest({ title: "Zebra füttern", scheduledDate: date });
  const apple = await quest({ title: "Äpfel kaufen", scheduledDate: date });
  await quest({ title: "Arzt", scheduledDate: date, timeOfDay: "23:55" });
  await quest({ title: "Altlast", scheduledDate: daysAfter(date, -3) });
  const done = await quest({ title: "Gliederung", scheduledDate: date });
  const created = await request.post(`${API_URL}/habits`, {
    data: {
      title: "Lesen",
      why: "Für ruhige Abende",
      schedule: { type: "interval", intervalDays: 1 },
    },
  });
  expect(created.status()).toBe(201);
  // Heute creates today's run; the order puts Zebra before Äpfel.
  await page.goto("/");
  await expect(page.locator("#focus-title")).toBeVisible();
  const planner = (await (
    await request.get(`${API_URL}/day-planner/today`)
  ).json()) as { items: { type: string; occurrenceId?: number }[] };
  const run = planner.items.find((item) => item.type === "habit")!;
  expect(
    (
      await request.put(`${API_URL}/day-planner/order`, {
        data: {
          items: [
            { type: "todo", id: zebra.id },
            { type: "habit", id: run.occurrenceId },
            { type: "todo", id: apple.id },
          ],
        },
      })
    ).status(),
  ).toBe(204);
  expect(
    (
      await request.patch(`${API_URL}/todos/${done.id}`, {
        data: { completed: true },
      })
    ).status(),
  ).toBe(200);

  await page.reload();
  await expect(page.locator(".today-view__progress")).toHaveText(
    "1 von 5 erledigt · 1 von früher",
  );
  await openCalendar(page, "Tag");
  // The same words for the same day as on Heute.
  await expect(page.locator(".calendar-day__tally")).toHaveText(
    "1 von 5 erledigt · 1 von früher",
  );
  const planned = page.getByRole("region", {
    name: "Offen / geplant",
    exact: true,
  });
  // The appointment by its time, then the day's order, not the alphabet.
  await expect(planned.locator(".planned-item h3")).toHaveText([
    "Arzt",
    "Zebra füttern",
    "Lesen",
    "Äpfel kaufen",
  ]);
  const daily = planned.locator(".planned-item").filter({ hasText: "Lesen" });
  await expect(daily).toContainText("Daily");
  await expect(daily).toContainText("Für ruhige Abende");

  // The completion mark on the axis reads as one phrase.
  await expect(
    page
      .getByRole("list", { name: "Zeitachse", exact: true })
      .getByRole("listitem")
      .filter({ hasText: "Gliederung" }),
  ).toMatchAriaSnapshot(
    String.raw`- listitem: /Gliederung, erledigt um \d\d:\d\d/`,
  );

  await daily
    .getByRole("button", { name: "Lesen erledigen", exact: true })
    .click();
  const toast = page.locator(".undo-toast");
  await expect(toast).toContainText("„Lesen“ erledigt");
  await expect(
    page.getByRole("region", { name: "Erledigt", exact: true }),
  ).toContainText("Lesen");
  await expect(page.locator(".calendar-day__tally")).toHaveText(
    "2 von 5 erledigt · 1 von früher",
  );
  await toast.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(planned.locator(".planned-item h3")).toContainText(["Lesen"]);
  await expect
    .poll(async () => {
      const occurrences = (await (
        await request.get(`${API_URL}/habit-occurrences/today`)
      ).json()) as { id: number; status: string }[];
      return occurrences.find((item) => item.id === run.occurrenceId)?.status;
    })
    .toBe("pending");
});
