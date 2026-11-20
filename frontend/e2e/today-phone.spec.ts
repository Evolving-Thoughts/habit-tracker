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

  // No grip: the whole card drags after a long press, so a swipe still scrolls.
  await expect(page.locator(".sort-handle")).toHaveCount(0);
  await expect(focus).toHaveClass(/card-drag/);

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

test("Heute at 375 px: Daily marker and Warum on the next rows, and the plus button never covers the last row's ▶ and …", async ({
  page,
  request,
}, info) => {
  test.skip(
    info.project.name !== "mobile-chromium",
    "A phone layout, measured once on the phone project.",
  );
  const date = await today(request);
  for (const [index, title] of [
    "Steuer sortieren",
    "Fahrrad putzen",
    "Mails",
    "Keller",
    "Rechnung",
    "Blumen",
    "Wäsche",
    "Anruf",
  ].entries()) {
    const response = await request.post(`${API_URL}/todos`, {
      data: {
        title,
        scheduledDate: date,
        why: index < 4 ? `Warum ${title}` : undefined,
      },
    });
    expect(response.status()).toBe(201);
  }
  expect(
    (
      await request.post(`${API_URL}/habits`, {
        data: {
          title: "Dehnen",
          why: "Damit der Rücken mitmacht",
          schedule: { type: "interval", intervalDays: 1 },
        },
      })
    ).status(),
  ).toBe(201);
  // The quests in the order they were made, the Daily last.
  const planned = (await (
    await request.get(`${API_URL}/day-planner/today`)
  ).json()) as {
    items: { type: string; todoId?: number; occurrenceId?: number }[];
  };
  const order = planned.items.map((item) =>
    item.type === "todo"
      ? { type: "todo", id: item.todoId! }
      : { type: "habit", id: item.occurrenceId! },
  );
  order.sort((a, b) =>
    a.type === b.type ? a.id - b.id : a.type === "habit" ? 1 : -1,
  );
  expect(
    (
      await request.put(`${API_URL}/day-planner/order`, {
        data: { items: order },
      })
    ).status(),
  ).toBe(204);
  await page.goto("/");
  await expect(page.locator("#focus-title")).toHaveText("Steuer sortieren");

  // The next two rows carry their Warum on one line; later rows leave it out.
  const rows = page.locator(".order .planner-item");
  await expect(rows.nth(0).locator(".planner-item__why")).toHaveText(
    "Warum Fahrrad putzen",
  );
  await expect(rows.nth(1).locator(".planner-item__why")).toBeVisible();
  await expect(rows.nth(2).locator(".planner-item__why")).toBeHidden();
  const rowWithWhy = (await rows.nth(0).boundingBox())!;
  expect(rowWithWhy.height).toBeLessThanOrEqual(92);
  const daily = rows.filter({ hasText: "Dehnen" });
  await expect(daily.locator(".planner-item__daily")).toHaveText("Daily");

  const plus = page.locator(".create-button");
  async function lastRowClear(label: string): Promise<void> {
    await page.evaluate(() =>
      window.scrollTo(0, document.documentElement.scrollHeight),
    );
    const end = (await rows.last().locator(".item-row__end").boundingBox())!;
    const button = (await plus.boundingBox())!;
    const gap = button.y - (end.y + end.height);
    test.info().annotations.push({
      type: "measured",
      description: `${label}: last row's ▶/… end ${Math.round(gap)} px above the plus button`,
    });
    const overlaps =
      end.x < button.x + button.width &&
      end.x + end.width > button.x &&
      end.y < button.y + button.height &&
      end.y + end.height > button.y;
    expect(overlaps).toBe(false);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  }
  await lastRowClear("without the stopwatch bar");

  await page
    .locator(".focus")
    .getByRole("button", {
      name: "Stoppuhr für Steuer sortieren starten",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("complementary", { name: "Aktuelle Stoppuhr" }),
  ).toBeVisible();
  await lastRowClear("with the stopwatch bar");

  // In reading order the plus button follows the content.
  const reading = await page.evaluate(() => {
    const buttons = [...document.querySelectorAll("main button")];
    return {
      first: buttons[0]?.classList.contains("create-button"),
      afterList: !!(
        document
          .querySelector(".order")!
          .compareDocumentPosition(document.querySelector(".create-button")!) &
        Node.DOCUMENT_POSITION_FOLLOWING
      ),
    };
  });
  expect(reading).toEqual({ first: false, afterList: true });
});
