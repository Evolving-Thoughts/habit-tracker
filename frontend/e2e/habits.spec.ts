import { test, expect } from "./fixtures";
import {
  createHabit,
  daysAfter,
  today,
  visit,
  list,
  openView,
  showResolved,
} from "./helpers";
import { API_URL } from "./environment";

test("Today: create Daily, complete/reopen and skip/reopen one occurrence", async ({
  page,
  request,
}) => {
  await visit(page, "Heute");
  await createHabit(page, "Joggen");
  await page
    .getByRole("button", { name: "Joggen erledigen", exact: true })
    .click();
  await showResolved(page);
  await page
    .getByRole("button", { name: "Joggen wieder öffnen", exact: true })
    .click();
  // Überspringen waits in the row's menu.
  await page
    .getByRole("button", { name: "Aktionen für Joggen", exact: true })
    .click();
  await page
    .getByRole("menuitem", { name: "Joggen überspringen", exact: true })
    .click();
  await showResolved(page);
  const row = page.locator("#resolved-list .planner-item").filter({
    has: page.getByRole("heading", { name: "Joggen", exact: true }),
  });
  await expect(row).toContainText("Übersprungen");
  const habits = await list(request, "habits");
  const history = await request.get(
    `${API_URL}/habits/${habits[0].id}/occurrences`,
  );
  expect(await history.json()).toEqual([
    expect.objectContaining({ status: "skipped" }),
  ]);
  await page
    .getByRole("button", { name: "Joggen wieder öffnen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Joggen erledigen", exact: true }),
  ).toBeVisible();
});

for (const type of ["fixed_weekdays", "weekly_target"] as const) {
  test(`Dailies: create and persist a ${type} schedule`, async ({
    page,
    request,
  }) => {
    await visit(page, "Dailies");
    await createHabit(page, "Gitarre spielen", type);
    const habits = await list(request, "habits");
    expect(habits[0].currentSchedule.schedule).toMatchObject(
      type === "fixed_weekdays"
        ? { type, weekdays: ["monday", "thursday"] }
        : { type, weeklyTarget: 3 },
    );
    await page.reload();
    await openView(page, "Dailies");
    await expect(
      page.getByRole("heading", { name: "Gitarre spielen", exact: true }),
    ).toBeVisible();
  });
}

test("Daily management: future schedule change, pause/reactivate and delete", async ({
  page,
  request,
}) => {
  const date = await today(request),
    future = daysAfter(date, 7);
  await visit(page, "Dailies");
  await createHabit(page, "Joggen");
  await page
    .getByRole("button", { name: "Joggen bearbeiten", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('[name="changeSchedule"]').check();
  await dialog.locator('[name="effectiveFrom"]').fill(future);
  await dialog.locator('[name="scheduleType"]').selectOption("fixed_weekdays");
  await dialog.getByLabel("Montag", { exact: true }).check();
  await dialog.getByLabel("Donnerstag", { exact: true }).check();
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  let habits = await list(request, "habits");
  expect(habits[0].currentSchedule.schedule).toMatchObject({
    type: "interval",
    intervalDays: 2,
  });
  expect(habits[0].upcomingSchedule).toMatchObject({
    effectiveFrom: future,
    schedule: { type: "fixed_weekdays", weekdays: ["monday", "thursday"] },
  });
  await page
    .getByRole("button", { name: "Joggen bearbeiten", exact: true })
    .click();
  await dialog.locator('[name="isActive"]').uncheck();
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await expect(page.locator('[data-group="paused"]')).toContainText("Joggen");
  await openView(page, "Heute");
  await expect(
    page.getByRole("heading", { name: "Joggen", exact: true }),
  ).toHaveCount(0);
  await openView(page, "Dailies");
  await page
    .getByRole("button", { name: "Joggen bearbeiten", exact: true })
    .click();
  await dialog.locator('[name="isActive"]').check();
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  habits = await list(request, "habits");
  expect(habits[0].isActive).toBe(true);
  expect(habits[0].upcomingSchedule.effectiveFrom).toBe(future);
  await page
    .getByRole("button", { name: "Joggen bearbeiten", exact: true })
    .click();
  await dialog.locator('[data-test="request-delete"]').click();
  await dialog.locator('[data-test="confirm-delete"]').click();
  await expect(dialog).not.toBeVisible();
  expect(await list(request, "habits")).toEqual([]);
  await expect(page.locator(".create-button")).toBeFocused();
});

test("future-start Daily is manageable but not due in Today", async ({
  page,
  request,
}) => {
  const future = daysAfter(await today(request), 7);
  await visit(page, "Dailies");
  await createHabit(page, "Zukunftshabit", "interval", future);
  await expect(
    page.getByRole("heading", { name: "Zukunftshabit", exact: true }),
  ).toBeVisible();
  await page
    .getByRole("button", { name: "Zukunftshabit bearbeiten", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  await dialog.locator('[data-test="edit-upcoming"]').click();
  await dialog.locator('[name="scheduleType"]').selectOption("weekly_target");
  await dialog.locator('[name="weeklyTarget"]').fill("4");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  expect(
    (await list(request, "habits"))[0].upcomingSchedule.schedule,
  ).toMatchObject({ type: "weekly_target", weeklyTarget: 4 });
  await openView(page, "Heute");
  await expect(
    page.getByRole("heading", { name: "Zukunftshabit", exact: true }),
  ).toHaveCount(0);
});

test("Dailies: each Daily shows its why and where it stands this week", async ({
  page,
  request,
}) => {
  const post = async (data: object) =>
    expect((await request.post(`${API_URL}/habits`, { data })).status()).toBe(
      201,
    );
  await post({
    title: "Lesen",
    why: "Damit der Abend ruhig wird",
    schedule: { type: "interval", intervalDays: 1 },
  });
  await post({
    title: "Krafttraining",
    schedule: { type: "weekly_target", weeklyTarget: 3 },
  });

  await visit(page, "Dailies");
  const card = (title: string) =>
    page.locator(".habit-card").filter({
      has: page.getByRole("heading", { name: title, exact: true }),
    });
  await expect(card("Lesen").locator(".habit-card__why")).toHaveText(
    "Damit der Abend ruhig wird",
  );
  await expect(card("Lesen").locator(".habit-card__status")).toHaveText(
    "heute fällig",
  );
  await expect(card("Krafttraining").locator(".habit-card__status")).toHaveText(
    "0 von 3 diese Woche",
  );
  // The lead stands below the title, as in every other view.
  const title = (await page.locator(".page-title").boundingBox())!;
  const lead = (await page.locator(".page-lead").boundingBox())!;
  expect(lead.y).toBeGreaterThanOrEqual(title.y + title.height - 1);

  await openView(page, "Heute");
  await page
    .getByRole("button", { name: "Lesen erledigen", exact: true })
    .click();
  await expect(
    page.getByRole("button", { name: "Lesen erledigen", exact: true }),
  ).toHaveCount(0);
  await openView(page, "Dailies");
  await expect(card("Lesen").locator(".habit-card__status")).toHaveText(
    "heute erledigt",
  );
});
