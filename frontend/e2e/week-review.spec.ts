import { test, expect } from "./fixtures";
import { daysAfter, openView, today } from "./helpers";
import { API_URL } from "./environment";

test("Wochenrückblick: the week in numbers, its campaigns, what was done, and three answers that stay", async ({
  page,
  request,
  isMobile,
}) => {
  const date = await today(request);
  const create = async (data: Record<string, unknown>) => {
    const response = await request.post(`${API_URL}/todos`, { data });
    expect(response.status()).toBe(201);
    return ((await response.json()) as { id: number }).id;
  };
  // A campaign with a colour and a weekly goal, two quests, one of them done.
  const book = await create({
    title: "Buch",
    color: "berry",
    weeklyTargetMinutes: 360,
  });
  const chapter = await create({
    title: "Kapitel schreiben",
    parentId: book,
    scheduledDate: date,
  });
  await create({ title: "Gliederung", parentId: book });
  expect(
    (
      await request.put(`${API_URL}/quest-hours/target`, {
        data: { weeklyTargetMinutes: 600 },
      })
    ).status(),
  ).toBe(200);
  // Forty-five minutes on the quest, ending a minute ago.
  const end = Date.now() - 60_000;
  expect(
    (
      await request.post(`${API_URL}/work-logs`, {
        data: {
          kind: "todo",
          targetId: chapter,
          startedAt: new Date(end - 45 * 60_000).toISOString(),
          endedAt: new Date(end).toISOString(),
        },
      })
    ).status(),
  ).toBe(201);
  expect(
    (
      await request.patch(`${API_URL}/todos/${chapter}`, {
        data: { completed: true },
      })
    ).status(),
  ).toBe(200);

  await page.goto("/");
  await openView(page, "Wochenrückblick");
  await expect(page).toHaveURL(/#\/rueckblick$/);
  await expect(page).toHaveTitle("Wochenrückblick · Habit Tracker");
  const view = page.locator(".week-review");
  await expect(
    view.getByRole("status", { name: "Wochenrückblick wird geladen" }),
  ).toHaveCount(0);
  // On the current week the way back to it would change nothing.
  await expect(
    view.getByRole("button", { name: "Diese Woche", exact: true }),
  ).toHaveCount(0);

  // Key figures: the week against the overall goal.
  const questHours = view.locator(".figures__item--hours");
  await expect(questHours.locator(".figures__value")).toHaveText("45 Min.");
  await expect(questHours).toContainText("von 10 Std. Wochenziel");
  await expect(questHours).toContainText("8 % vom Ziel");
  // Seven days, today's value written out.
  const todayBar = view.locator(`.day-bars__day[data-date="${date}"]`);
  await expect(todayBar).toContainText("0:45");
  await expect(todayBar).toContainText("Heute");
  // Hours per campaign, against its own goal.
  await expect(
    view.locator(`.campaign-hours__row[data-campaign-id="${book}"]`),
  ).toContainText("45 Min. von 6 Std.");
  // Progress links to the campaign, where its burn-up is.
  const progress = view.locator(`a[data-campaign-id="${book}"]`);
  // Two quests below the campaign, one done: the campaign itself does not count.
  await expect(progress).toContainText("1 von 2 Quests · 50 %");
  await expect(progress).toHaveAttribute(
    "href",
    `#/kampagnen?kampagne=${book}`,
  );
  // The running week among the weeks before, marked as what it is so far.
  await expect(view.locator(".week-trend__label--shown")).toContainText(
    "bisher",
  );
  // The done list starts closed on a phone and opens on request.
  const showDone = view.getByRole("button", { name: "Liste zeigen" });
  if (isMobile) await showDone.click();
  else await expect(showDone).toHaveCount(0);
  // It names the quest with its campaign.
  await expect(
    view.locator(`[data-done-key="todo-${chapter}"]`),
  ).toContainText("Kapitel schreibenKampagne Buch");
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBe(0);

  // Three answers, saved explicitly, still there after a reload.
  await view.locator('[name="wentWell"]').fill("Ein Kapitel fertig");
  await view.locator('[name="wentBadly"]').fill("Zu spät angefangen");
  await view.locator('[name="changeNext"]').fill("Morgens zuerst schreiben");
  await view.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    view.getByRole("status").filter({ hasText: "Gespeichert" }),
  ).toBeVisible();
  await page.reload();
  await expect(view.locator('[name="wentWell"]')).toHaveValue(
    "Ein Kapitel fertig",
  );
  await expect(view.locator('[name="wentBadly"]')).toHaveValue(
    "Zu spät angefangen",
  );
  await expect(view.locator('[name="changeNext"]')).toHaveValue(
    "Morgens zuerst schreiben",
  );

  // The week before: in the address, calm, and its own empty answers.
  await view.getByRole("button", { name: "Vorige Woche", exact: true }).click();
  const monday = await page.evaluate(() => location.hash);
  expect(monday).toMatch(/woche=\d{4}-\d{2}-\d{2}$/);
  expect(monday.slice(-10) <= daysAfter(date, -7)).toBe(true);
  await expect(view.locator(".empty-state")).toContainText(
    "In dieser Woche ist nichts gemessen und nichts erledigt.",
  );
  await expect(view.locator('[name="wentWell"]')).toHaveValue("");
  await page.reload();
  await expect(view.locator(".empty-state")).toBeVisible();

  await view.getByRole("button", { name: "Diese Woche", exact: true }).click();
  await expect(page).toHaveURL(/#\/rueckblick$/);
  await expect(view.locator('[name="wentWell"]')).toHaveValue(
    "Ein Kapitel fertig",
  );
});
