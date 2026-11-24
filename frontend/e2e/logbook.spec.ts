import { test, expect } from "./fixtures";
import {
  berlinTime,
  daysAfter,
  openCalendar,
  openView,
  timerBarAction,
  today,
} from "./helpers";
import { API_URL } from "./environment";

test("Logbuch: time added by hand shows in the day, the week and the month; a stopwatch stretch of seconds does not", async ({
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
  const mails = await create({ title: "Mails", scheduledDate: date });
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
  // And a single minute today, just after midnight.
  expect(
    (
      await request.post(`${API_URL}/work-logs`, {
        data: {
          kind: "todo",
          targetId: mails,
          startedAt: berlinTime(date, "00:00").toISOString(),
          endedAt: berlinTime(date, "00:01").toISOString(),
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
  // Ended within seconds: a stretch under a minute is not logged.
  await timerBarAction(page, "Stoppuhr beenden");
  await expect(bar).toHaveCount(0);

  const view = await openCalendar(page, "Tag");
  const logbook = view.getByRole("region", { name: /^Logbuch/ });
  // One column: the plan and the Logbuch share the hour axis.
  const lane = logbook.getByRole("list", { name: "Zeitachse", exact: true });
  const stretch = lane.getByRole("button", { name: /^Mails, / });
  await expect(stretch).toHaveCount(1);
  await expect(stretch).toHaveAccessibleName(/ohne Kampagne, korrigieren$/);
  // Drawn one line high, so its name reads; its gauge keeps the minute's
  // actual share of the 64 px hour.
  expect((await stretch.boundingBox())!.height).toBeLessThanOrEqual(24);
  expect(
    await stretch.evaluate((block) =>
      parseFloat(
        getComputedStyle(block).backgroundSize.split(",")[0]!.trim().split(" ")[1]!,
      ),
    ),
  ).toBeLessThanOrEqual(2);
  await stretch.click();
  const dialog = page.getByRole("dialog", { name: "Abschnitt korrigieren" });
  await expect(dialog).toContainText("Nachtrag");
  await expect(dialog.getByLabel("Start", { exact: true })).toBeVisible();
  await dialog.getByRole("button", { name: "Abbrechen", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBe(0);

  await view.getByRole("button", { name: "Voriger Zeitraum" }).click();
  await expect(page.locator('[name="historyDate"]')).toHaveValue(yesterday);
  await expect(logbook.getByRole("heading", { level: 2 })).toHaveText(
    "Logbuch 1 Std. 30 Min.",
  );
  await expect(
    lane.getByRole("button", {
      name: /^Kapitel schreiben, .*, 1 Std\. 30 Min\., Kampagne Buch, korrigieren$/,
    }),
  ).toBeVisible();

  await view.getByRole("button", { name: "Woche", exact: true }).click();
  const head = page.locator(`.week-head[data-date="${yesterday}"]`);
  await expect(head.locator(".week-head__worked")).toHaveText("1 Std. 30 Min.");
  // Nothing was planned, but time was measured: the sentence says both.
  await expect(head).toHaveAccessibleDescription(
    "Nichts geplant · 1 Std. 30 Min. gemessen",
  );
  // The stretch stands in its day's column, named with its campaign.
  await expect(
    page
      .locator(`.week-column[data-date="${yesterday}"]`)
      .getByRole("button", { name: /^Kapitel schreiben, .*Kampagne Buch/ }),
  ).toBeVisible();

  await view.getByRole("button", { name: "Monat", exact: true }).click();
  await expect(page.locator(`.month-day[data-date="${yesterday}"]`)).toHaveAttribute(
    "aria-label",
    /1 Std\. 30 Min\. im Logbuch$/,
  );
});

test("Logbuch: short stretches keep a readable one-line label, side by side when they follow each other", async ({
  page,
  request,
  isMobile,
}) => {
  test.skip(isMobile, "Measured once, on the desktop day calendar.");
  const yesterday = daysAfter(await today(request), -1);
  const create = async (title: string) =>
    (
      (await (
        await request.post(`${API_URL}/todos`, {
          data: { title, scheduledDate: yesterday },
        })
      ).json()) as { id: number }
    ).id;
  const reading = await create("Lesen");
  const mails = await create("Mails");
  for (const [targetId, start, end] of [
    [reading, "12:00", "12:05"],
    [mails, "12:05", "12:08"],
    [reading, "15:00", "15:05"],
  ] as const)
    expect(
      (
        await request.post(`${API_URL}/work-logs`, {
          data: {
            kind: "todo",
            targetId,
            startedAt: `${yesterday}T${start}:00.000Z`,
            endedAt: `${yesterday}T${end}:00.000Z`,
          },
        })
      ).status(),
    ).toBe(201);

  await page.goto("/");
  const view = await openCalendar(page, "Tag");
  await view.getByRole("button", { name: "Voriger Zeitraum" }).click();
  await expect(page.locator('[name="historyDate"]')).toHaveValue(yesterday);
  const lane = view
    .getByRole("region", { name: /^Logbuch/ })
    .getByRole("list", { name: "Zeitachse", exact: true });
  const blocks = lane.getByRole("button", { name: /^(Lesen|Mails), / });
  await expect(blocks).toHaveCount(3);
  await blocks.first().scrollIntoViewIfNeeded();

  const measured = await blocks.evaluateAll((elements) =>
    elements.map((block) => {
      const title = block.querySelector<HTMLElement>(".day-calendar__title-text")!;
      const style = getComputedStyle(title);
      const box = block.getBoundingClientRect();
      const label = title.getBoundingClientRect();
      return {
        text: block.textContent!.replace(/\s+/g, " ").trim(),
        fontSize: parseFloat(style.fontSize),
        lineHeight: parseFloat(style.lineHeight),
        labelHeight: label.height,
        // The label lies wholly inside its block: nothing cut off above or below.
        inside: label.top >= box.top - 0.5 && label.bottom <= box.bottom + 0.5,
        box: { top: box.top, bottom: box.bottom, left: box.left, right: box.right },
      };
    }),
  );
  for (const block of measured) {
    expect(block.fontSize).toBeGreaterThanOrEqual(12);
    expect(block.labelHeight).toBeGreaterThanOrEqual(block.lineHeight - 0.5);
    expect(block.inside).toBe(true);
  }
  // Alone, a five-minute stretch names its length; following each other, the
  // two share the width and never cover one another.
  expect(measured.map((block) => block.text)).toEqual([
    "Lesen",
    "Mails",
    "Lesen · 5 Min.",
  ]);
  const [first, second] = measured;
  const overlap =
    first!.box.left < second!.box.right &&
    second!.box.left < first!.box.right &&
    first!.box.top < second!.box.bottom &&
    second!.box.top < first!.box.bottom;
  expect(overlap).toBe(false);
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
  const blocks = logbook.getByRole("button", { name: /^Lesen, / });
  const title = logbook.getByRole("heading", { level: 2 });
  await expect(blocks).toHaveCount(2);
  await expect(title).toHaveText("Logbuch 50 Min.");
  const dialog = page.getByRole("dialog", { name: "Abschnitt korrigieren" });
  const deleteFirst = async () => {
    await blocks.first().click();
    await dialog.getByRole("button", { name: "Löschen", exact: true }).click();
    await expect(dialog).toHaveCount(0);
  };

  // Deleting takes the stretch out at once; the DELETE waits for the toast.
  await deleteFirst();
  await expect(blocks).toHaveCount(1);
  const toast = page.locator(".undo-toast");
  await expect(toast).toContainText("Abschnitt „Lesen“ gelöscht");
  await expect(title).toHaveText("Logbuch");
  expect(await stored()).toBe(2);
  await toast.getByRole("button", { name: "Rückgängig", exact: true }).click();
  await expect(blocks).toHaveCount(2);
  await expect(title).toHaveText("Logbuch 50 Min.");

  // Without Rückgängig the stretch is gone once the toast has run out.
  await deleteFirst();
  await expect(toast).toContainText("Abschnitt „Lesen“ gelöscht");
  await expect(toast.getByRole("button")).toHaveCount(0, { timeout: 8000 });
  await expect.poll(stored).toBe(1);
  await expect(title).toHaveText("Logbuch 20 Min.");
  await expect(blocks).toHaveCount(1);
});

test("Logbuch: a stretch is resized by dragging its bottom edge, and Escape cancels", async ({
  page,
  request,
  isMobile,
}) => {
  test.skip(isMobile, "The drag is a pointer gesture; the dialog covers phones.");
  const yesterday = daysAfter(await today(request), -1);
  const todo = (
    (await (
      await request.post(`${API_URL}/todos`, {
        data: { title: "Lesen", scheduledDate: yesterday },
      })
    ).json()) as { id: number }
  ).id;
  expect(
    (
      await request.post(`${API_URL}/work-logs`, {
        data: {
          kind: "todo",
          targetId: todo,
          startedAt: `${yesterday}T12:00:00.000Z`,
          endedAt: `${yesterday}T13:00:00.000Z`,
        },
      })
    ).status(),
  ).toBe(201);

  await page.goto("/");
  const view = await openCalendar(page, "Tag");
  await view.getByRole("button", { name: "Voriger Zeitraum" }).click();
  await expect(page.locator('[name="historyDate"]')).toHaveValue(yesterday);
  const logbook = view.getByRole("region", { name: /^Logbuch/ });
  const block = logbook.getByRole("button", { name: /^Lesen, / });
  await expect(block).toHaveAccessibleName(/, 1 Std\., /);
  await block.scrollIntoViewIfNeeded();
  /* An hour of the axis is 4rem: 32px are half an hour. */
  const pull = async (pixels: number, escape = false) => {
    const box = (await block.boundingBox())!;
    const x = box.x + box.width / 2;
    const y = box.y + box.height - 3;
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x, y + pixels, { steps: 5 });
    if (escape) await page.keyboard.press("Escape");
    await page.mouse.up();
  };

  await pull(32, true);
  await expect(block).toHaveAccessibleName(/, 1 Std\., /);

  await pull(32);
  await expect(block).toHaveAccessibleName(/, 1 Std\. 30 Min\., /);
  await expect(logbook.getByRole("heading", { level: 2 })).toHaveText(
    "Logbuch 1 Std. 30 Min.",
  );
  const logs = (
    (await (
      await request.get(`${API_URL}/history?date=${yesterday}&view=day`)
    ).json()) as { days: { work: { logs: { endedAt: string }[] } }[] }
  ).days[0]!.work.logs;
  expect(logs.map((log) => log.endedAt)).toEqual([
    `${yesterday}T13:30:00.000Z`,
  ]);
});

test("Logbuch: the axis reaches an early stretch and a completion, and time is added in a dialog", async ({
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
  const lane = logbook.getByRole("list", { name: "Zeitachse", exact: true });
  await expect(lane).toContainText(/Zahnarzt anrufen, erledigt um \d\d:\d\d/);

  // "Zeit nachtragen" in the head of the day opens a dialog.
  const toggle = logbook.getByRole("button", {
    name: "Zeit nachtragen",
    exact: true,
  });
  await toggle.click();
  const dialog = page.getByRole("dialog", { name: "Zeit nachtragen" });
  const target = dialog.locator('[name="target"]');
  await target.selectOption({ label: "Notizen ordnen" });
  // A refused stretch (end before start) keeps what was typed.
  await dialog.locator('[name="from"]').fill("00:01");
  await dialog.locator('[name="to"]').fill("00:00");
  await dialog.getByRole("button", { name: "Nachtragen", exact: true }).click();
  await expect(dialog.getByRole("alert")).toBeVisible();
  await expect(dialog.locator('[name="from"]')).toHaveValue("00:01");
  // Early in the day, so the end is never in the future.
  await dialog.locator('[name="from"]').fill("00:00");
  await dialog.locator('[name="to"]').fill("00:01");
  await dialog.getByRole("button", { name: "Nachtragen", exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(toggle).toBeFocused();
  await expect(
    lane.getByRole("button", { name: /^Notizen ordnen, 00:00 bis 00:01/ }),
  ).toBeVisible();

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
  await expect(
    logbook
      .locator(".day-calendar__hours > span:not(.day-calendar__now-time)")
      .first(),
  ).toHaveText(`${hour}:00`);
  await expect(lane.getByRole("button", { name: /^Früh lesen, / })).toBeVisible();
});
