import { test, expect } from "./fixtures";
import {
  daysAfter,
  openCalendar,
  openView,
  timerBarAction,
  today,
} from "./helpers";
import { API_URL } from "./environment";

test("Logbuch: a stopwatch stretch and time added by hand show in the day, the week and the month", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const yesterday = daysAfter(date, -1);
  const create = async (data: Record<string, unknown>) => {
    const response = await request.post(`${API_URL}/todos`, { data });
    expect(response.status()).toBe(201);
    return ((await response.json()) as { id: number }).id;
  };
  await create({ title: "Mails", scheduledDate: date });
  const chapter = await create({
    title: "Kapitel schreiben",
    parentId: await create({ title: "Buch" }),
  });
  // Time added by hand for yesterday: an hour and a half, never in the future.
  expect(
    (
      await request.post(`${API_URL}/work-logs`, {
        data: {
          kind: "todo",
          targetId: chapter,
          startedAt: `${yesterday}T12:00:00.000Z`,
          endedAt: `${yesterday}T13:30:00.000Z`,
        },
      })
    ).status(),
  ).toBe(201);

  await page.goto("/");
  await openView(page, "Heute");
  await page
    .getByRole("button", { name: "Stoppuhr für Mails starten", exact: true })
    .click();
  const bar = page.getByRole("complementary", { name: "Aktuelle Stoppuhr" });
  await expect(bar).toContainText("Stoppuhr läuft");
  await timerBarAction(page, "Stoppuhr beenden");
  await expect(bar).toHaveCount(0);

  const view = await openCalendar(page, "Tag");
  const logbook = view.getByRole("region", { name: /^Logbuch/ });
  // The section is the Logbuch; its lanes say what they hold.
  await expect(logbook.locator(".day-timeline__head")).toHaveText(
    "GeplantGemessen",
  );
  const lane = logbook.getByRole("list", { name: "Gemessen", exact: true });
  const stretch = lane.getByRole("button", { name: /^Mails, / });
  await expect(stretch).toBeVisible();
  await expect(stretch).toHaveAccessibleName(/ohne Kampagne, korrigieren$/);
  // A stretch of seconds is still drawn large enough to tap.
  expect((await stretch.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(
    logbook.getByRole("list", { name: "Einträge im Logbuch" }),
  ).toContainText("Stoppuhr");
  await stretch.click();
  await expect(logbook.getByLabel("Start", { exact: true })).toBeFocused();
  await logbook.getByRole("button", { name: "Abbrechen", exact: true }).click();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBe(0);

  await view.getByRole("button", { name: "Voriger Zeitraum" }).click();
  await expect(page.locator('[name="historyDate"]')).toHaveValue(yesterday);
  await expect(logbook).toContainText("1 Std. 30 Min.");
  await expect(
    lane.getByRole("button", {
      name: /^Kapitel schreiben, .*, 1 Std\. 30 Min\., Kampagne Buch, korrigieren$/,
    }),
  ).toBeVisible();

  await view.getByRole("button", { name: "Woche", exact: true }).click();
  const day = page.locator(`.week-day[data-date="${yesterday}"]`);
  await expect(day.locator(".week-day__worked")).toHaveText("1 Std. 30 Min.");
  // Nothing was planned, but time was measured: the words say both.
  await expect(day.locator(".week-day__summary")).toHaveText(
    "Nichts geplant · 1 Std. 30 Min. gemessen",
  );
  await expect(day.locator(".work-bar i")).toHaveCount(1);
  await expect(
    page.getByRole("region", { name: /^Logbuch/ }).getByRole("listitem"),
  ).toContainText(["Buch"]);

  await view.getByRole("button", { name: "Monat", exact: true }).click();
  await expect(page.locator(`.month-day[data-date="${yesterday}"]`)).toHaveAttribute(
    "aria-label",
    /1 Std\. 30 Min\. im Logbuch$/,
  );
});

test("Logbuch: a deleted stretch waits behind the undo toast and comes back with Rückgängig", async ({
  page,
  request,
}) => {
  const yesterday = daysAfter(await today(request), -1);
  const todo = (
    (await (
      await request.post(`${API_URL}/todos`, {
        data: { title: "Lesen", scheduledDate: yesterday },
      })
    ).json()) as { id: number }
  ).id;
  for (const [start, end] of [
    ["12:00", "12:30"],
    ["14:00", "14:20"],
  ])
    expect(
      (
        await request.post(`${API_URL}/work-logs`, {
          data: {
            kind: "todo",
            targetId: todo,
            startedAt: `${yesterday}T${start}:00.000Z`,
            endedAt: `${yesterday}T${end}:00.000Z`,
          },
        })
      ).status(),
    ).toBe(201);
  const stored = async () =>
    (
      (await (
        await request.get(
          `${API_URL}/history?date=${yesterday}&view=day&filter=all`,
        )
      ).json()) as { days: { work: { logs: unknown[] } }[] }
    ).days[0]!.work.logs.length;

  await page.goto("/");
  const view = await openCalendar(page, "Tag");
  await view.getByRole("button", { name: "Voriger Zeitraum" }).click();
  await expect(page.locator('[name="historyDate"]')).toHaveValue(yesterday);
  const logbook = view.getByRole("region", { name: /^Logbuch/ });
  const entries = logbook.getByRole("list", { name: "Einträge im Logbuch" });
  await expect(entries.getByRole("listitem")).toHaveCount(2);
  await expect(logbook.locator("#day-axis-title")).toHaveText("Logbuch 50 Min.");

  // Deleting takes the stretch out at once; the DELETE waits for the toast.
  await entries
    .getByRole("button", { name: /^Lesen \d\d:\d\d löschen$/ })
    .first()
    .click();
  await expect(entries.getByRole("listitem")).toHaveCount(1);
  const toast = page.locator(".undo-toast");
  await expect(toast).toContainText("Abschnitt „Lesen“ gelöscht");
  await expect(logbook.locator("#day-axis-title")).toHaveText("Logbuch");
  expect(await stored()).toBe(2);
  await toast.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(entries.getByRole("listitem")).toHaveCount(2);
  await expect(logbook.locator("#day-axis-title")).toHaveText("Logbuch 50 Min.");

  // Without Rückgängig the stretch is gone once the toast has run out.
  await entries
    .getByRole("button", { name: /^Lesen \d\d:\d\d löschen$/ })
    .first()
    .click();
  await expect(toast).toContainText("Abschnitt „Lesen“ gelöscht");
  await expect(toast.getByRole("button")).toHaveCount(0, { timeout: 8000 });
  await expect.poll(stored).toBe(1);
  await expect(logbook.locator("#day-axis-title")).toHaveText("Logbuch 20 Min.");
  await expect(entries.getByRole("listitem")).toHaveCount(1);
});

test("Logbuch: the axis reaches an early stretch and a completion, and time is added behind one button", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const yesterday = daysAfter(date, -1);
  const create = async (data: Record<string, unknown>) => {
    const response = await request.post(`${API_URL}/todos`, { data });
    expect(response.status()).toBe(201);
    return ((await response.json()) as { id: number }).id;
  };
  const early = await create({ title: "Früh lesen", scheduledDate: yesterday });
  const startedAt = `${yesterday}T03:37:00.000Z`;
  expect(
    (
      await request.post(`${API_URL}/work-logs`, {
        data: {
          kind: "todo",
          targetId: early,
          startedAt,
          endedAt: `${yesterday}T04:07:00.000Z`,
        },
      })
    ).status(),
  ).toBe(201);
  // A quest ticked off today stands on the axis at the time it was done.
  const ticked = await create({ title: "Zahnarzt anrufen" });
  expect(
    (
      await request.patch(`${API_URL}/todos/${ticked}`, {
        data: { completed: true },
      })
    ).status(),
  ).toBe(200);
  await create({ title: "Notizen ordnen", scheduledDate: date });

  await page.goto("/");
  const view = await openCalendar(page, "Tag");
  const logbook = view.getByRole("region", { name: /^Logbuch/ });
  await expect(
    logbook.getByRole("list", { name: "Geplant", exact: true }),
  ).toContainText(/Zahnarzt anrufen, erledigt um \d\d:\d\d/);

  // "Zeit nachtragen" waits behind one quiet button and opens in place.
  const toggle = logbook.getByRole("button", {
    name: "Zeit nachtragen",
    exact: true,
  });
  const target = logbook.locator('[name="target"]');
  await expect(toggle).toHaveAttribute("aria-expanded", "false");
  await expect(target).toHaveCount(0);
  await toggle.click();
  await expect(target).toBeFocused();
  await target.selectOption({ label: "Notizen ordnen" });
  // A refused stretch (end before start) keeps what was typed.
  await logbook.locator('[name="from"]').fill("00:01");
  await logbook.locator('[name="to"]').fill("00:00");
  await logbook.getByRole("button", { name: "Nachtragen", exact: true }).click();
  await expect(logbook.getByRole("alert")).toBeVisible();
  await expect(logbook.locator('[name="from"]')).toHaveValue("00:01");
  // Early in the day, so the end is never in the future.
  await logbook.locator('[name="from"]').fill("00:00");
  await logbook.locator('[name="to"]').fill("00:01");
  await logbook.getByRole("button", { name: "Nachtragen", exact: true }).click();
  await expect(target).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(
    logbook.getByRole("list", { name: "Einträge im Logbuch" }),
  ).toContainText("Notizen ordnen");

  await view.getByRole("button", { name: "Voriger Zeitraum" }).click();
  await expect(page.locator('[name="historyDate"]')).toHaveValue(yesterday);
  // 03:37 UTC is 04:37 or 05:37 in Berlin; the axis starts at that full hour.
  const hour = new Intl.DateTimeFormat("de-DE", {
    timeZone: "Europe/Berlin",
    hour: "2-digit",
    minute: "2-digit",
  })
    .format(new Date(startedAt))
    .slice(0, 2);
  await expect(logbook.locator(".day-timeline__hours > span").first()).toHaveText(
    `${hour}:00`,
  );
  await expect(
    logbook
      .getByRole("list", { name: "Gemessen", exact: true })
      .getByRole("button", { name: /^Früh lesen, / }),
  ).toBeVisible();
});
