import { expect, test } from "./fixtures";
import { API_URL } from "./environment";
import { today } from "./helpers";

/*
 * Heute on a phone: rows carry only ring, title, ▶ and "…", so the first
 * view shows the focus card and what comes after it. The tab labels fit.
 */
test.use({ viewport: { width: 375, height: 812 } });

test("Heute at 375 px: focus card in one action row, the next row in view, short rows, labels uncut", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "mobile-chromium",
    "A phone layout, measured once on the phone project.",
  );
  const date = await today(request);
  for (const title of ["Steuer sortieren", "Fahrrad putzen", "Mails"]) {
    const response = await request.post(`${API_URL}/todos`, {
      data: { title, scheduledDate: date, plannedDurationMinutes: 25 },
    });
    expect(response.status()).toBe(201);
  }
  await page.goto("/");
  const focus = page.locator(".focus");
  await expect(page.locator("#focus-title")).toHaveText("Steuer sortieren");

  // One action row: Erledigt, the stopwatch, Fokus-Modus and the menu share a line.
  const tops = await focus
    .locator(".focus__actions > button, .focus__actions > a")
    .evaluateAll((elements) =>
      elements.map((element) => {
        const box = element.getBoundingClientRect();
        return Math.round(box.top + box.height / 2);
      }),
    );
  expect(tops.length).toBe(4);
  expect(Math.max(...tops) - Math.min(...tops)).toBeLessThanOrEqual(2);
  await expect(
    focus.getByRole("link", { name: "Fokus-Modus", exact: true }),
  ).toBeVisible();
  await expect(focus.getByRole("button", { name: "Überspringen" })).toHaveCount(
    0,
  );

  // The grip sits in the top right corner of the card, clear of the plus button.
  const grip = (await focus
    .getByRole("button", {
      name: "Steuer sortieren in der Reihenfolge verschieben",
      exact: true,
    })
    .boundingBox())!;
  const card = (await focus.boundingBox())!;
  expect(grip.y - card.y).toBeLessThan(40);
  const plus = (await page.locator(".create-button").boundingBox())!;
  const overlaps =
    grip.x < plus.x + plus.width &&
    grip.x + grip.width > plus.x &&
    grip.y < plus.y + plus.height &&
    grip.y + grip.height > plus.y;
  expect(overlaps).toBe(false);

  // A row with one meta line stays short and carries no text buttons.
  const row = page.locator(".order .planner-item").first();
  const rowBox = (await row.boundingBox())!;
  expect(rowBox.height).toBeLessThanOrEqual(72);
  await expect(
    row.getByRole("button", { name: /Verschieben|Überspringen/ }),
  ).toHaveCount(0);

  // The first viewport shows the focus card and at least the next row.
  const viewport = page.viewportSize()!;
  const tabBar = (await page.locator(".tab-bar").boundingBox())!;
  expect(rowBox.y + rowBox.height).toBeLessThanOrEqual(
    Math.min(viewport.height, tabBar.y),
  );
  test.info().annotations.push({
    type: "measured",
    description: `row ${Math.round(rowBox.height)} px, its bottom at ${Math.round(rowBox.y + rowBox.height)} px of ${Math.round(Math.min(viewport.height, tabBar.y))} px`,
  });

  // No sideways scrolling and no tab label cut off, at 375 and at 360 px.
  for (const width of [375, 360]) {
    await page.setViewportSize({ width, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
    const clipped = await page
      .locator(".tab-bar__inner > .tab-bar__tab > span, .tab-bar__more > span")
      .evaluateAll((labels) =>
        labels
          .filter((label) => label.getBoundingClientRect().width > 0)
          .filter((label) => label.scrollWidth > label.clientWidth)
          .map((label) => label.textContent),
      );
    expect(clipped).toEqual([]);
  }
});
