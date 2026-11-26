import { test, expect } from "./fixtures";
import { plusButton, today, visit } from "./helpers";
import { API_URL } from "./environment";

for (const view of ["Questlog", "Heute", "Dailies"] as const) {
  test(`${view}: long list, fixed symmetric plus, modal and focus restoration`, async ({
    page,
    request,
    isMobile,
  }) => {
    const date = await today(request);
    for (let i = 1; i <= 20; i++) {
      const response = await request.post(
        `${API_URL}/${view === "Dailies" ? "habits" : "todos"}`,
        {
          data:
            view === "Dailies"
              ? {
                  title: `Quest ${i}`,
                  schedule: { type: "interval", intervalDays: 2 },
                }
              : {
                  title: `Quest ${i}`,
                  plannedDurationMinutes: 30,
                  ...(view === "Heute"
                    ? { scheduledDate: date }
                    : {}),
                },
        },
      );
      expect(response.status()).toBe(201);
    }
    await visit(page, view);
    // Beside Heute's day calendar "Neue Quest" in the head takes its place.
    const split = view === "Heute" && !isMobile;
    const plus = page.locator(split ? ".today-view__create" : ".create-button");
    if (!split) {
      await expect(plus).toBeVisible();
      await expect(plus).not.toHaveAttribute("data-hidden");
      const top = await plus.boundingBox();
      expect(top).not.toBeNull();
      await page.evaluate(() =>
        window.scrollTo(0, document.documentElement.scrollHeight),
      );
      if (isMobile) {
        // A phone's plus button steps aside while the page scrolls down and
        // comes back, at the same place, on the way up.
        await expect(plus).toHaveAttribute("data-hidden");
        await page.evaluate(() => window.scrollBy(0, -120));
        await expect(plus).not.toHaveAttribute("data-hidden");
      }
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
    }
    const edit = page.getByRole("button", {
      name: "Quest 20 bearbeiten",
      exact: true,
    });
    await edit.scrollIntoViewIfNeeded();
    const scroll = await page.evaluate(() => scrollY);
    await edit.click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toBeVisible();
    // Touch screens keep the keyboard closed until a field is tapped.
    await expect(
      isMobile
        ? dialog
        : dialog.locator('[name="title"]'),
    ).toBeFocused();
    expect(await dialog.evaluate((el) => el.matches(":modal"))).toBe(true);
    // Whole in the window, once a phone's sheet has slid up.
    await expect
      .poll(async () => {
        const box = (await dialog.boundingBox())!;
        return (
          box.y >= 0 && box.y + box.height <= page.viewportSize()!.height + 1
        );
      })
      .toBe(true);
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
    // Where the walk ends depends on the form's length. Inside the notes
    // Escape only leaves the field (RichTextEditor), so it starts from one
    // that is the same in every editor.
    await dialog.locator('[name="title"]').focus();
    await page.keyboard.press("Escape");
    await expect(dialog).not.toBeVisible();
    await expect(edit).toBeFocused();
    expect(await page.evaluate(() => scrollY)).toBeCloseTo(scroll, 0);
    await (await plusButton(page)).click();
    await expect(
      page.getByRole("dialog", {
        name: view === "Dailies" ? "Neues Daily" : "Neue Quest",
      }),
    ).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(plus).toBeFocused();
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth <= innerWidth,
      ),
    ).toBe(true);
  });
}
