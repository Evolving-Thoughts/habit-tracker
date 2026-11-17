import { openView } from "./helpers";
import { test, expect } from "./fixtures";

test("views have their own address: Back returns and a reload stays", async ({
  page,
}) => {
  await page.goto("/");
  await expect(page).toHaveURL(/#\/heute$/);
  await expect(page).toHaveTitle("Heute · Habit Tracker");

  await openView(page, "Questlog");
  await expect(page).toHaveURL(/#\/questlog$/);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Questlog");
  await expect(page.locator("main")).toBeFocused();

  await openView(page, "Kampagnen");
  await expect(page).toHaveTitle("Kampagnen · Habit Tracker");
  await page.reload();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText(
    "Kampagnen",
  );

  await page.goBack();
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Questlog");
  await page.goBack();
  await expect(page).toHaveURL(/#\/heute$/);
});

test("an unknown address opens Heute", async ({ page }) => {
  await page.goto("/#/gibt-es-nicht");
  await expect(page).toHaveURL(/#\/heute$/);
  await expect(page.locator(".today-view")).toBeVisible();
});
