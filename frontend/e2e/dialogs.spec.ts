import { test, expect } from "./fixtures";
import { today, visit } from "./helpers";
import { API_URL } from "./environment";

for (const view of ["Todo-Dump", "Heute", "Habits"] as const) {
test(`${view}: long list, fixed symmetric plus, modal and focus restoration`, async ({
  page,
  request,
}) => {
  const date = await today(request);
  for (let i = 1; i <= 20; i++) {
    const response = await request.post(`${API_URL}/${view === "Habits" ? "habits" : "todos"}`, {
      data: view === "Habits"
        ? { title: `Aufgabe ${i}`, schedule: { type: "interval", intervalDays: 2 } }
        : { title: `Aufgabe ${i}`, plannedDurationMinutes: 30, ...(view === "Heute" ? { scheduledAt: `${date}T10:00:00Z` } : {}) },
    });
    expect(response.status()).toBe(201);
  }
  await visit(page, view);
  const plus = page.locator(".create-button");
  const top = await plus.boundingBox();
  expect(top).not.toBeNull();
  await page.evaluate(() =>
    window.scrollTo(0, document.documentElement.scrollHeight),
  );
  await expect
    .poll(async () => Math.round((await plus.boundingBox())!.y))
    .toBe(Math.round(top!.y));
  const geometry = await plus.locator("svg").evaluate((svg) => {
    const icon = svg.getBoundingClientRect(),
      button = svg.closest("button")!.getBoundingClientRect();
    return {
      dx: Math.abs((icon.left + icon.right - button.left - button.right) / 2),
      dy: Math.abs((icon.top + icon.bottom - button.top - button.bottom) / 2),
    };
  });
  expect(geometry.dx).toBeLessThan(1);
  expect(geometry.dy).toBeLessThan(1);
  const edit = page.getByRole("button", {
    name: "Aufgabe 20 bearbeiten",
    exact: true,
  });
  await edit.scrollIntoViewIfNeeded();
  const scroll = await page.evaluate(() => scrollY);
  await edit.click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog.locator(view === "Todo-Dump" ? '[name="editTitle"]' : '[name="title"]')).toBeFocused();
  expect(await dialog.evaluate((el) => el.matches(":modal"))).toBe(true);
  const box = await dialog.boundingBox();
  expect(box!.y).toBeGreaterThanOrEqual(0);
  expect(box!.y + box!.height).toBeLessThanOrEqual(
    page.viewportSize()!.height + 1,
  );
  // Chromium may briefly focus browser chrome (activeElement === body).
  // It must never focus a control in the inert background page.
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press("Tab");
    expect(
      await dialog.evaluate(
        (el) =>
          el.contains(document.activeElement) ||
          document.activeElement === document.body,
      ),
    ).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(dialog).not.toBeVisible();
  await expect(edit).toBeFocused();
  expect(await page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
  await plus.click();
  await expect(page.getByRole("dialog", { name: view === "Todo-Dump" ? "Neues Todo" : view === "Habits" ? "Neues Habit" : "Was möchtest du erstellen?" })).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(plus).toBeFocused();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth,
    ),
  ).toBe(true);
});

}
