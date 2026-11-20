import { test, expect } from "./fixtures";
import { openView, today } from "./helpers";
import { API_URL } from "./environment";

test("Kampagnen-Stunden: goals, a campaign's colour and icon, its tile and the line in Heute", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const create = async (data: Record<string, unknown>) => {
    const response = await request.post(`${API_URL}/todos`, { data });
    expect(response.status()).toBe(201);
    return ((await response.json()) as { id: number }).id;
  };
  const book = await create({ title: "Buch" });
  const chapter = await create({
    title: "Kapitel schreiben",
    parentId: book,
    scheduledDate: date,
  });
  // A second quest of the day, listed below the focus with its stripe.
  await create({ title: "Gliederung", parentId: book, scheduledDate: date });

  // The overall goal in the settings.
  await page.goto("/");
  await openView(page, "Einstellungen");
  const goal = page.locator('[name="weeklyQuestTargetHours"]');
  await expect(goal).toBeEnabled();
  await goal.fill("20");
  await page.locator('[name="weeklyQuestTargetMinutes"]').fill("");
  await page.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(
    page.getByRole("status").filter({ hasText: "Gespeichert." }),
  ).toBeVisible();

  // Colour, icon and weekly goal of the campaign, in its editor: the
  // overview holds only tiles, the campaign's page has "Bearbeiten".
  await openView(page, "Kampagnen");
  await page
    .locator(`[data-campaign-tile="${book}"]`)
    .getByRole("button", { name: "Buch", exact: true })
    .click();
  await page
    .getByRole("button", { name: "Kampagne Buch bearbeiten", exact: true })
    .click();
  const dialog = page.getByRole("dialog");
  // A campaign's own form shows colour, icon and goal directly, without
  // a group to open, and no day or duration.
  await expect(
    dialog.getByRole("button", { name: /^Kampagne \(/ }),
  ).toHaveCount(0);
  await expect(dialog.locator('[name="weeklyTarget"]')).toBeVisible();
  const choose = async (name: string) => {
    const radio = page.getByRole("radio", { name, exact: true });
    await dialog.locator("label").filter({ has: radio }).click();
    await expect(
      dialog.getByRole("radio", { name, exact: true }),
    ).toBeChecked();
  };
  await choose("Beere");
  await choose("Buch");
  // The chosen colour is also named in words.
  await expect(dialog.locator(".mark-picker__chosen")).toHaveText(
    "Beere",
  );
  await dialog.locator('[name="weeklyTarget"]').fill("6");
  await dialog.getByRole("button", { name: "Speichern", exact: true }).click();
  await expect(dialog).not.toBeVisible();
  await page.getByRole("button", { name: "Alle Kampagnen", exact: true }).click();
  await expect(page).not.toHaveURL(/kampagne=/);

  // Half an hour on its quest, added by hand and ending a minute ago.
  const end = Date.now() - 60_000;
  expect(
    (
      await request.post(`${API_URL}/work-logs`, {
        data: {
          kind: "todo",
          targetId: chapter,
          startedAt: new Date(end - 30 * 60_000).toISOString(),
          endedAt: new Date(end).toISOString(),
        },
      })
    ).status(),
  ).toBe(201);

  await page.reload();
  const tile = page.locator(`[data-campaign-tile="${book}"]`);
  await expect(tile).toContainText(/\d+ Min\. von 6 Std\. diese Woche/);
  await expect(tile).toContainText(/Insgesamt \d+ Min\./);
  await expect(tile).toHaveAttribute("style", /--color-mark-berry/);
  await expect(tile.getByRole("img")).toHaveAccessibleName(
    /^Letzte 8 Wochen: .*diese Woche \d+\sMin\.$/,
  );
  await expect(tile.getByText("8 Wochen", { exact: true })).toBeVisible();
  expect(
    (await tile.getByRole("button", { name: "Buch", exact: true }).boundingBox())!
      .height,
  ).toBeGreaterThanOrEqual(44);
  // The figures above the tiles: this week and ever, running and done.
  await expect(page.locator('[data-stat="week"] dd')).toHaveText(/\d+\sMin\./);

  // The tile opens the campaign: its quests, its progress, its burnup.
  await tile.getByRole("button", { name: "Buch", exact: true }).click();
  await expect(page).toHaveURL(/kampagne=/);
  await expect(page.locator("#campaign-detail-title")).toHaveText("Buch");
  await expect(page.locator("#campaign-detail-title")).toBeFocused();
  await expect(
    page.getByRole("region", { name: "Fortschritt der Kampagne" }),
  ).toBeVisible();
  await expect(
    page.getByRole("heading", { name: "Kapitel schreiben", exact: true }),
  ).toBeVisible();
  expect(
    await page.evaluate(
      () =>
        document.documentElement.scrollWidth -
        document.documentElement.clientWidth,
    ),
  ).toBe(0);
  await page.goBack();
  await expect(tile).toBeVisible();

  // Heute relates the time worked to its quest hours, then the week against the goal.
  await openView(page, "Heute");
  // Right after midnight the half hour may lie wholly on yesterday.
  // A figure keeps its unit with a no-break space, which \s matches.
  await expect(page.locator(".today-view__time")).toHaveText(
    /^(\d+\sMin\. gearbeitet, alles auf Kampagnen · Woche|Kampagnen diese Woche) \d+\sMin\. von 20\sStd\.$/,
  );
  await expect(
    page.getByRole("progressbar", {
      name: "Kampagnen-Stunden diese Woche gegen das Wochenziel",
    }),
  ).toHaveAttribute("aria-valuemax", "1200");
  // The quest's stripe takes the campaign's stored colour.
  await expect(page.locator(".planner-item.item-row--campaign").first()).toHaveAttribute(
    "style",
    /--color-mark-berry/,
  );
});
