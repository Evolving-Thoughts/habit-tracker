import { test, expect } from "./fixtures";
import { API_URL } from "./environment";
import { berlinTime, daysAfter, openView, today } from "./helpers";

test("Das Beste des Tages: written in Heute in the evening, then in its timeline, the Wochenrückblick and the search", async ({
  page,
  request,
  isMobile,
}) => {
  const date = await today(request);
  // Before 20:00 Heute does not ask: no card at all.
  await page.clock.install({ time: berlinTime(date, "19:58") });
  await page.goto("/");
  const view = page.locator(".today-view");
  await expect(view.locator('input[name="quickTitle"]')).toBeVisible();
  const card = view.locator(".day-best-card");
  await expect(card).toHaveCount(0);

  // From the card time on, a calm card with one short line.
  await page.clock.fastForward(3 * 60_000);
  await expect(
    card.getByRole("heading", { name: "Das Beste des Tages?" }),
  ).toBeVisible();
  const line = card.getByRole("textbox", { name: "Was war heute das Beste?" });
  await line.fill("Abendlicht über dem Kanal");
  await line.press("Enter");
  // Saved: the line stands quietly, the pencil changes it.
  await expect(card.getByText("Abendlicht über dem Kanal")).toBeVisible();
  await expect(card.getByRole("status")).toHaveText("Gespeichert.");
  const pencil = card.getByRole("button", {
    name: "Das Beste des Tages bearbeiten",
  });
  await expect(pencil).toBeFocused();
  await expect(
    card.getByRole("heading", { name: "Das Beste des Tages", exact: true }),
  ).toBeVisible();

  // A line from an earlier day, written elsewhere.
  const earlier = daysAfter(date, -1);
  expect(
    (
      await request.put(`${API_URL}/day-bests/${earlier}`, {
        data: { text: "Brief von Oma" },
      })
    ).status(),
  ).toBe(200);

  // The timeline: newest first, in months with their count.
  await openView(page, "Das Beste");
  await expect(page).toHaveURL(/#\/das-beste$/);
  await expect(page).toHaveTitle("Das Beste · Habit Tracker");
  const timeline = page.locator(".day-best-view");
  await expect(
    timeline.getByRole("status", { name: "Das Beste wird geladen" }),
  ).toHaveCount(0);
  const todayRow = timeline.locator(`#best-${date}`);
  await expect(todayRow).toContainText("Abendlicht über dem Kanal");
  await expect(timeline.locator(".day-best-month__head").first()).toContainText(
    /\d+ von \d+ Tagen?/,
  );
  // Today has its line: no extra field for it.
  await expect(timeline.locator(".day-best-view__today")).toHaveCount(0);

  // A tap changes the line in place.
  await todayRow.getByRole("button").click();
  const edit = todayRow.getByRole("textbox");
  await expect(edit).toBeFocused();
  await edit.fill("Abendlicht über dem Kanal, mit Enten");
  await edit.press("Enter");
  await expect(todayRow.getByRole("button")).toContainText("mit Enten");
  await expect(todayRow.getByRole("button")).toBeFocused();

  // The Wochenrückblick lists the week's lines.
  await openView(page, "Wochenrückblick");
  const week = page.locator(".review-day-bests");
  await expect(week).toContainText("Abendlicht über dem Kanal, mit Enten");
  // Yesterday belongs to this week unless today is a Monday.
  if (new Date(`${date}T12:00:00Z`).getUTCDay() !== 1)
    await expect(week).toContainText("Brief von Oma");

  // The Kalender day carries the line next to the reflection, editable.
  await page.goto(`/#/kalender?tag=${earlier}`);
  const dayBest = page.locator(".day-best-day");
  await expect(dayBest.getByRole("textbox")).toHaveValue("Brief von Oma");

  if (isMobile) return;
  // The search finds it and opens the timeline at that day.
  await page.goto("/");
  await expect(view.locator('input[name="quickTitle"]')).toBeVisible();
  await page.keyboard.press("Control+k");
  const menu = page.getByRole("dialog", { name: "Befehle" });
  await menu.getByRole("combobox").fill("oma");
  const texts = menu.getByRole("group", { name: "In Notizen und Texten" });
  await expect(
    texts.getByRole("option", { name: /^Das Beste vom / }),
  ).toContainText("Brief von Oma");
  await page.keyboard.press("Enter");
  await expect(menu).toHaveCount(0);
  await expect(page).toHaveURL(new RegExp(`#/das-beste\\?tag=${earlier}$`));
  await expect(
    page.locator(`#best-${earlier}`).getByRole("button"),
  ).toBeFocused();
});

test("Das Beste des Tages: the card time and the reminder live in Einstellungen", async ({
  page,
  request,
}) => {
  const date = await today(request);
  await page.clock.install({ time: berlinTime(date, "07:30") });
  await page.goto("/");
  await openView(page, "Einstellungen");
  const time = page.getByLabel("Heute fragt ab");
  await expect(time).toHaveValue("20:00");
  const reminder = page.getByRole("switch", {
    name: "Abends an das Beste des Tages erinnern",
  });
  await expect(reminder).toHaveAttribute("aria-checked", "true");
  await reminder.click();
  await expect(reminder).toHaveAttribute("aria-checked", "false");

  // From midnight on the card shows at once.
  await time.fill("00:00");
  await time.blur();
  await expect(
    page.locator(".day-best-setting").getByRole("status"),
  ).toHaveText("Gespeichert.");
  await expect
    .poll(async () =>
      (await request.get(`${API_URL}/day-best-settings`)).json(),
    )
    .toEqual({ cardTime: "00:00", reminderEnabled: false });

  await openView(page, "Heute");
  await expect(
    page.locator(".day-best-card").getByRole("heading", {
      name: "Das Beste des Tages?",
    }),
  ).toBeVisible();
});
