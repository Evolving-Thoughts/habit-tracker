import { test, expect } from "./fixtures";
import { API_URL } from "./environment";
import {
  cardMenu,
  openView,
  shortDate,
  showResolved,
  today,
  visit,
} from "./helpers";

/** Days left in the month of `date`, `date` included. */
function daysLeft(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const last = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  return last - day! + 1;
}

test("Monats-Challenge: started on a Daily, its run in Heute's order, ticked there", async ({
  page,
  request,
}) => {
  const date = await today(request);
  const left = daysLeft(date);
  expect(
    (
      await request.post(`${API_URL}/habits`, {
        data: {
          title: "Sport",
          schedule: {
            type: "interval",
            intervalDays: 1,
            missedOccurrencePolicy: "skip",
          },
        },
      })
    ).status(),
  ).toBe(201);

  // The Dailies hold the challenge section; none runs yet.
  await visit(page, "Dailies");
  const section = page.locator("#abschnitt-challenge");
  await expect(
    section.getByRole("heading", { name: "Monats-Challenge", exact: true }),
  ).toBeVisible();
  await section.getByRole("button", { name: "Challenge starten" }).click();

  const dialog = page.getByRole("dialog", { name: "Monats-Challenge starten" });
  await expect(dialog).toContainText(
    `Gezählt wird ab heute, ${shortDate(date)}: ${left === 1 ? "1 Tag" : `${left} Tage`}.`,
  );
  await expect(dialog.locator('[name="challengeHabit"]')).toHaveValue(/\d+/);
  await expect(
    dialog.locator('[name="challengeHabit"] option:checked'),
  ).toHaveText("Sport");
  await expect(dialog.locator('[name="challengeReminder"]')).toHaveValue(
    "19:00",
  );
  await dialog
    .getByRole("button", { name: "Challenge starten", exact: true })
    .click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator(".habits-view__status")).toContainText(
    "Monats-Challenge mit „Sport“ gestartet.",
  );

  const current = section.locator(".challenge-item").first();
  await expect(current.getByRole("heading", { name: "Sport" })).toBeVisible();
  await expect(current).toContainText(`Tag 1 · noch ${left}`);
  // The Daily wears the marker on its card.
  const card = page
    .locator(".habit-card")
    .filter({ has: page.getByRole("heading", { name: "Sport", exact: true }) });
  await expect(
    card.getByRole("img", { name: "Monats-Challenge" }),
  ).toBeVisible();

  // Heute: no card of its own. The run is the day's only item, so it is the
  // focus card, which names the challenge and where it stands.
  await openView(page, "Heute");
  await expect(page.locator(".challenge-card")).toHaveCount(0);
  const focus = page.locator(".focus");
  await expect(
    focus.getByRole("heading", { name: "Sport", exact: true }),
  ).toBeVisible();
  await expect(focus.locator(".focus__challenge")).toHaveText(
    `Monats-Challenge · Tag 1 · noch ${left}`,
  );

  // Its menu leads to the challenges in the Dailies.
  await cardMenu(page, "Sport", "Zur Monats-Challenge");
  await expect(page).toHaveURL(/#\/dailies\?abschnitt=challenge$/);
  await expect(section.locator(".challenge-item").first()).toContainText(
    `Tag 1 · noch ${left}`,
  );

  // Ticked on Heute, the run goes to the done items with the new count.
  await openView(page, "Heute");
  await focus
    .getByRole("button", { name: "Sport erledigen", exact: true })
    .click();
  await showResolved(page);
  await expect(
    page.locator(".resolved .planner-item__challenge"),
  ).toHaveText(
    left > 1
      ? `Monats-Challenge · Tag 1 · 1 von 1 geschafft · noch ${left - 1}`
      : "Monats-Challenge · Tag 1 · 1 von 1 geschafft",
  );

  await openView(page, "Dailies");
  await expect(section.locator(".challenge-item").first()).toContainText(
    "1 von 1 geschafft",
  );
});
