import { test, expect } from "./fixtures";
import { API_URL } from "./environment";
import { openView, shortDate, today, visit } from "./helpers";

/** Days left in the month of `date`, `date` included. */
function daysLeft(date: string): number {
  const [year, month, day] = date.split("-").map(Number);
  const last = new Date(Date.UTC(year!, month!, 0)).getUTCDate();
  return last - day! + 1;
}

test("Monats-Challenge: started on a Daily, at the top of Heute, ticked there", async ({
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

  // Heute: the card sits at the top with its progress and today's ring.
  await openView(page, "Heute");
  const challenge = page.locator(".challenge-card");
  await expect(
    challenge.getByRole("heading", { name: "Sport", exact: true }),
  ).toBeVisible();
  await expect(challenge.locator(".challenge-card__progress")).toHaveText(
    `Tag 1 · noch ${left}`,
  );
  // Its run in the day's list carries the marker too.
  await expect(
    page
      .locator(".today-view")
      .getByRole("img", { name: "Monats-Challenge" })
      .first(),
  ).toBeVisible();

  await challenge
    .getByRole("button", { name: "Sport heute erledigen", exact: true })
    .click();
  await expect(challenge.locator(".challenge-card__progress")).toHaveText(
    left > 1
      ? `Tag 1 · 1 von 1 geschafft · noch ${left - 1}`
      : "Tag 1 · 1 von 1 geschafft",
  );
  await expect(
    challenge.getByRole("button", {
      name: "Sport heute wieder öffnen",
      exact: true,
    }),
  ).toBeVisible();
  await expect(
    challenge.getByRole("progressbar", { name: "Monats-Challenge Sport" }),
  ).toHaveAttribute("aria-valuenow", "1");

  // The card leads to the challenges in the Dailies.
  await challenge.getByRole("link", { name: "Challenges" }).click();
  await expect(page).toHaveURL(/#\/dailies\?abschnitt=challenge$/);
  await expect(section.locator(".challenge-item").first()).toContainText(
    "1 von 1 geschafft",
  );
});
