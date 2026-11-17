import { test, expect } from "./fixtures";
import { daysAfter, openCalendar, openView, today } from "./helpers";
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
    .getByRole("button", { name: "Timer für Mails starten", exact: true })
    .click();
  const bar = page.getByRole("complementary", { name: "Aktueller Timer" });
  await expect(bar).toContainText("Stoppuhr läuft");
  await page
    .getByRole("button", { name: "Timer beenden", exact: true })
    .click();
  await expect(bar).toHaveCount(0);

  const view = await openCalendar(page, "Tag");
  const logbook = view.getByRole("region", { name: /^Logbuch/ });
  const lane = logbook.getByRole("list", { name: "Logbuch", exact: true });
  const stretch = lane.getByRole("button", { name: /^Mails, / });
  await expect(stretch).toBeVisible();
  await expect(stretch).toHaveAccessibleName(/ohne Kampagne, korrigieren$/);
  // A stretch of seconds is still drawn large enough to tap.
  expect((await stretch.boundingBox())!.height).toBeGreaterThanOrEqual(44);
  await expect(
    logbook.getByRole("list", { name: "Einträge im Logbuch" }),
  ).toContainText("Timer");
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
